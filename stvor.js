// stvor.js - Основная логика приложения
import { 
    generateUserKeys, 
    exportPublicKey, 
    importPublicKey,
    importSigningKey,
    establishSecureSession, 
    encryptMessage, 
    decryptMessage,
    keyStorage,
    getKeyFingerprint
} from './security.js';

// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC10SFqDWCZRpScbeXGTicz82JArs9sKeY",
  authDomain: "strava-acb02.firebaseapp.com",
  databaseURL: "https://strava-acb02-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "strava-acb02",
  storageBucket: "strava-acb02.firebasestorage.app",
  messagingSenderId: "824827518683",
  appId: "1:824827518683:web:3839d038de2a1d88da76fe",
  measurementId: "G-96FJDKB2H3"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let usersCache = {};
let userKeys = null;
const sessionKeyCache = new Map();

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Привязка обработчиков кнопок
    document.getElementById('showRegisterFormBtn').addEventListener('click', showRegisterForm);
    document.getElementById('showLoginFormBtn').addEventListener('click', showLoginForm);
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('registerBtn').addEventListener('click', register);
    
    // Обработчики навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            showSection(target);
        });
    });
    
    // Проверка авторизации
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email
            };
            
            // Сохраняем в localStorage
            localStorage.setItem('currentUser', JSON.stringify({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName
            }));
            
            try {
                // Загрузка или генерация ключей
                userKeys = await loadOrGenerateKeys();
                
                // Показываем основной интерфейс
                document.getElementById('welcomeScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                document.getElementById('currentUserDisplay').textContent = currentUser.displayName;
                
                // Загружаем данные
                await Promise.all([loadUserChats(), loadContacts()]);
                
                // Слушаем новые сообщения
                listenForSecureMessages();
            } catch (error) {
                console.error("Ошибка инициализации:", error);
                alert("Ошибка загрузки приложения. Попробуйте перезагрузить страницу.");
                logout();
            }
        } else {
            // Показываем экран приветствия
            document.getElementById('welcomeScreen').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
            currentUser = null;
            currentChat = null;
            userKeys = null;
            sessionKeyCache.clear();
        }
    });
    
    // Автоматический вход
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            firebase.auth().signInWithEmailAndPassword(userData.email, userData.password || "")
                .catch(console.error);
        } catch (e) {
            localStorage.removeItem('currentUser');
        }
    }
});

// Управление ключами
async function loadOrGenerateKeys() {
    try {
        let keys = await keyStorage.load(currentUser.uid);
        
        if (!keys) {
            keys = await generateUserKeys();
            await keyStorage.save(keys, currentUser.uid);
            await publishPublicKeys(keys);
        }
        
        return keys;
    } catch (error) {
        console.error("Key management error:", error);
        throw new Error("Не удалось загрузить или сгенерировать ключи");
    }
}

async function publishPublicKeys(keys) {
    try {
        const publicKeys = {
            encryption: await exportPublicKey(keys.encryptionKeyPair.publicKey),
            signing: await exportPublicKey(keys.signingKeyPair.publicKey),
            fingerprint: await getKeyFingerprint(keys.encryptionKeyPair.publicKey)
        };
        
        await db.ref(`publicKeys/${currentUser.uid}`).set(publicKeys);
        console.log("Public keys published");
    } catch (error) {
        console.error("Failed to publish keys:", error);
        throw error;
    }
}

// Функции аутентификации
function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('regUsername').focus();
}

function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('loginUsername').focus();
}

function login() {
    const email = document.getElementById('loginUsername').value.trim() + "@academic-chat.ru";
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        alert("Заполните все поля");
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            console.error("Ошибка входа:", error);
            alert("Неверный логин или пароль");
        });
}

async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const fullName = document.getElementById('regFullName').value.trim();
    
    if (!username || !password || !fullName) {
        alert("Заполните все обязательные поля");
        return;
    }
    
    if (password !== confirmPassword) {
        alert("Пароли не совпадают");
        return;
    }
    
    if (password.length < 6) {
        alert("Пароль должен содержать не менее 6 символов");
        return;
    }
    
    const email = username + "@academic-chat.ru";
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: fullName });
        
        await db.ref('users/' + userCredential.user.uid).set({
            username: username,
            fullName: fullName,
            createdAt: new Date().toISOString()
        });
        
        // Генерация и сохранение ключей
        userKeys = await generateUserKeys();
        await keyStorage.save(userKeys, userCredential.user.uid);
        await publishPublicKeys(userKeys);
        
        localStorage.setItem('currentUser', JSON.stringify({
            uid: userCredential.user.uid,
            email: email,
            displayName: fullName
        }));
        
        alert("Регистрация прошла успешно!");
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        alert("Ошибка регистрации: " + error.message);
    }
}

function logout() {
    auth.signOut()
        .then(() => {
            localStorage.removeItem('currentUser');
            currentUser = null;
            currentChat = null;
            userKeys = null;
            sessionKeyCache.clear();
        })
        .catch(console.error);
}

// Навигация
function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(section => {
        section.style.display = 'none';
    });
    
    document.getElementById(sectionId).style.display = 'block';
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelector(`.nav-btn[data-target="${sectionId}"]`).classList.add('active');
}

// Работа с сообщениями
async function getSessionKey(recipientId) {
    if (sessionKeyCache.has(recipientId)) {
        return sessionKeyCache.get(recipientId);
    }
    
    try {
        const snapshot = await db.ref(`publicKeys/${recipientId}`).once('value');
        if (!snapshot.exists()) throw new Error("Ключи получателя не найдены");
        
        const recipientKeys = snapshot.val();
        const encryptionPublicKey = await importPublicKey(recipientKeys.encryption);
        const signingPublicKey = await importSigningKey(recipientKeys.signing);
        
        const sessionKey = await establishSecureSession(
            userKeys.encryptionKeyPair.privateKey,
            encryptionPublicKey
        );
        
        sessionKeyCache.set(recipientId, { 
            key: sessionKey, 
            publicKey: encryptionPublicKey,
            fingerprint: recipientKeys.fingerprint
        });
        
        return sessionKeyCache.get(recipientId);
    } catch (error) {
        console.error("Ошибка установки сессии:", error);
        throw error;
    }
}

async function sendSecureMessage(recipientId, message) {
    try {
        const sessionData = await getSessionKey(recipientId);
        const sessionKey = sessionData.key;
        
        const encryptedPacket = await encryptMessage(
            sessionKey,
            message,
            userKeys.signingKeyPair.privateKey
        );
        
        const messageRef = await db.ref('messages').push({
            sender: currentUser.uid,
            recipient: recipientId,
            packet: encryptedPacket,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await updateLastMessage(currentUser.uid, recipientId, message);
        await updateLastMessage(recipientId, currentUser.uid, message);
        
        return true;
    } catch (error) {
        console.error("Ошибка отправки:", error);
        alert("Ошибка отправки: " + error.message);
        return false;
    }
}

async function listenForSecureMessages() {
    db.ref('messages').orderByChild('timestamp').on('child_added', handleNewMessage);
    
    if (currentChat) {
        await loadChatHistory(currentChat);
    }
}

async function handleNewMessage(snapshot) {
    const msg = snapshot.val();
    if (msg.recipient !== currentUser.uid) return;
    
    try {
        const decrypted = await decryptSecureMessage(msg);
        
        if (currentChat === msg.sender) {
            displayMessage(msg.sender, decrypted, msg.timestamp, false);
        }
        
        loadUserChats();
    } catch (error) {
        console.error("Ошибка обработки сообщения:", error);
        if (currentChat === msg.sender) {
            displayMessage(msg.sender, "🔒 Не удалось расшифровать сообщение", Date.now(), false);
        }
    }
}

async function decryptSecureMessage(msg) {
    const senderKeys = await db.ref(`publicKeys/${msg.sender}`).once('value');
    if (!senderKeys.exists()) throw new Error("Ключи отправителя не найдены");
    
    const senderKeysData = senderKeys.val();
    const encryptionPublicKey = await importPublicKey(senderKeysData.encryption);
    const signingPublicKey = await importSigningKey(senderKeysData.signing);
    
    const sessionData = await getSessionKey(msg.sender);
    const sessionKey = sessionData.key;
    
    return decryptMessage(
        sessionKey,
        msg.packet,
        signingPublicKey
    );
}

async function loadChatHistory(partnerId) {
    try {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '<div class="loading">Загрузка истории...</div>';
        
        const snapshot = await db.ref('messages').once('value');
        
        const messages = [];
        snapshot.forEach(child => {
            const msg = child.val();
            if ((msg.sender === currentUser.uid && msg.recipient === partnerId) || 
                (msg.sender === partnerId && msg.recipient === currentUser.uid)) {
                messages.push(msg);
            }
        });
        
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        messagesContainer.innerHTML = '';
        for (const msg of messages) {
            try {
                const decrypted = await decryptSecureMessage(msg);
                displayMessage(
                    msg.sender, 
                    decrypted, 
                    msg.timestamp, 
                    msg.sender === currentUser.uid
                );
            } catch (error) {
                displayMessage(
                    msg.sender, 
                    "🔒 Не удалось расшифровать сообщение", 
                    msg.timestamp, 
                    msg.sender === currentUser.uid
                );
            }
        }
    } catch (error) {
        console.error("Ошибка загрузки истории:", error);
        document.getElementById('chatMessages').innerHTML = 
            '<div class="error">Ошибка загрузки истории чата</div>';
    }
}

function displayMessage(senderId, text, timestamp, isCurrentUser = null) {
    if (isCurrentUser === null) {
        isCurrentUser = senderId === currentUser.uid;
    }
    
    const messagesContainer = document.getElementById('chatMessages');
    const userInfo = usersCache[senderId] || { fullName: "Неизвестный" };
    
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', isCurrentUser ? 'message-sent' : 'message-received');
    messageEl.innerHTML = `
        <div class="message-security">🔒 End-to-End Encrypted</div>
        <div class="message-sender">${isCurrentUser ? 'Вы' : userInfo.fullName}</div>
        <div class="message-text">${text}</div>
        <div class="message-time">${new Date(timestamp).toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
    if (!currentChat) return alert("Выберите диалог");
    
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    if (!message) return;
    
    if (await sendSecureMessage(currentChat, message)) {
        input.value = "";
    }
}

// Поиск пользователей
async function findUserUid(username) {
    if (usersCache[username]) return usersCache[username];
    
    const snapshot = await db.ref('usernames').child(username).once('value');
    if (snapshot.exists()) {
        usersCache[username] = snapshot.val();
        return snapshot.val();
    }
    return null;
}

async function getUserInfo(uid) {
    const snapshot = await db.ref('users/' + uid).once('value');
    return snapshot.val();
}

// Работа с чатами
async function loadUserChats() {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    const snapshot = await db.ref('userChats/' + currentUser.uid).once('value');
    const chats = snapshot.val() || {};
    
    for (const chatId in chats) {
        const chatData = chats[chatId];
        const userId = chatData.userId;
        const userInfo = await getUserInfo(userId);
        
        if (userInfo) {
            usersCache[userId] = userInfo;
            
            const li = document.createElement('li');
            li.dataset.userId = userId;
            li.innerHTML = `
                <div class="chat-info">
                    <strong>${userInfo.fullName}</strong>
                    <span>@${userInfo.username}</span>
                </div>
                <div class="chat-preview">${chatData.lastMessage || ''}</div>
            `;
            
            li.addEventListener('click', () => openChat(userId, userInfo));
            chatList.appendChild(li);
        }
    }
    
    if (Object.keys(chats).length === 0) {
        chatList.innerHTML = '<li class="empty">У вас пока нет диалогов</li>';
    }
}

async function openChat(userId, userInfo) {
    currentChat = userId;
    
    document.getElementById('currentChatHeader').innerHTML = `
        <h3>Чат с ${userInfo.fullName}</h3>
        <span>@${userInfo.username}</span>
    `;
    
    const securityIndicator = document.getElementById('securityIndicator');
    try {
        const myFingerprint = await getKeyFingerprint(userKeys.encryptionKeyPair.publicKey);
        const theirKeys = await db.ref(`publicKeys/${userId}`).once('value');
        
        if (theirKeys.exists()) {
            const theirFingerprint = theirKeys.val().fingerprint;
            const sessionData = await getSessionKey(userId);
            
            if (sessionData.fingerprint === theirFingerprint) {
                securityIndicator.style.display = 'block';
                securityIndicator.innerHTML = '<span>🔒 Проверенный контакт</span>';
            } else {
                securityIndicator.style.display = 'block';
                securityIndicator.innerHTML = '<span style="color:#c62828;">⚠️ Ключи не совпадают!</span>';
            }
        }
    } catch (error) {
        securityIndicator.style.display = 'none';
    }
    
    await loadChatHistory(userId);
    
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    document.querySelectorAll('#chatList li').forEach(li => {
        li.classList.remove('active');
    });
    document.querySelector(`#chatList li[data-user-id="${userId}"]`).classList.add('active');
}

async function updateLastMessage(userId, partnerId, message) {
    const chatRef = db.ref(`userChats/${userId}/${getChatId(userId, partnerId)}`);
    await chatRef.set({
        userId: partnerId,
        lastMessage: message.substring(0, 30) + (message.length > 30 ? "..." : ""),
        lastUpdated: new Date().toISOString()
    });
}

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

// Контакты
async function loadContacts() {
    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';
    
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    
    for (const uid in users) {
        if (uid !== currentUser.uid) {
            const user = users[uid];
            usersCache[uid] = user;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="contact-info">
                    <strong>${user.fullName}</strong>
                    <span>@${user.username}</span>
                </div>
                <div class="contact-actions">
                    <button class="contact-btn btn-chat" data-uid="${uid}">Чат</button>
                </div>
            `;
            
            contactList.appendChild(li);
        }
    }
    
    document.querySelectorAll('.btn-chat').forEach(btn => {
        btn.addEventListener('click', async () => {
            const partnerId = btn.dataset.uid;
            const userInfo = usersCache[partnerId] || await getUserInfo(partnerId);
            openChat(partnerId, userInfo);
            showSection('chatSection');
        });
    });
}

// Поиск пользователей
async function searchUsers() {
    const query = document.getElementById('contactSearch').value.trim().toLowerCase();
    if (!query) return;
    
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    
    let found = false;
    
    for (const uid in users) {
        if (uid !== currentUser.uid) {
            const user = users[uid];
            
            if (user.fullName.toLowerCase().includes(query) || 
                user.username.toLowerCase().includes(query)) {
                
                found = true;
                usersCache[uid] = user;
                
                const li = document.createElement('li');
                li.dataset.userId = uid;
                li.innerHTML = `
                    <div class="chat-info">
                        <strong>${user.fullName}</strong>
                        <span>@${user.username}</span>
                    </div>
                `;
                
                li.addEventListener('click', () => openChat(uid, user));
                chatList.appendChild(li);
            }
        }
    }
    
    if (!found) {
        chatList.innerHTML = '<li class="empty">Пользователи не найдены</li>';
    }
}

// Дополнительные функции
function exportMessages() {
    alert("Функция экспорта будет реализована в следующей версии");
}

function encryptSelected() {
    alert("Зашифровать выделенное: функция в разработке");
}
