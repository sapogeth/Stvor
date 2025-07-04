// stvor.js
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*";
const CIPHER_VERSION = "AESv2";

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

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Обработчики навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            showSection(target);
        });
    });
    
    // Проверка авторизации
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email
            };
            
            // Сохраняем в localStorage
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Показываем основной интерфейс
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            document.getElementById('currentUserDisplay').textContent = currentUser.displayName;
            
            // Загружаем данные
            loadUserChats();
            loadContacts();
            
            // Слушаем новые сообщения
            listenForNewMessages();
        } else {
            // Показываем экран приветствия
            document.getElementById('welcomeScreen').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
        }
    });
    
    // Если есть сохранённый пользователь, пробуем автоматический вход
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            firebase.auth().signInWithEmailAndPassword(userData.email, atob(userData.password))
                .catch(error => {
                    console.error("Автоматический вход не удался:", error);
                    localStorage.removeItem('currentUser');
                });
        } catch (e) {
            localStorage.removeItem('currentUser');
        }
    }
});

// Функции аутентификации
function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
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

function register() {
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
    
    // Создаём пользователя
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Обновляем информацию о пользователе
            return userCredential.user.updateProfile({
                displayName: fullName
            }).then(() => {
                // Сохраняем дополнительную информацию в базу
                return db.ref('users/' + userCredential.user.uid).set({
                    username: username,
                    fullName: fullName,
                    createdAt: new Date().toISOString()
                });
            });
        })
        .then(() => {
            // Сохраняем для автоматического входа
            localStorage.setItem('currentUser', JSON.stringify({
                uid: auth.currentUser.uid,
                email: email,
                displayName: fullName,
                password: btoa(password) // В реальном приложении так делать НЕЛЬЗЯ!
            }));
            
            alert("Регистрация прошла успешно! Добро пожаловать!");
        })
        .catch(error => {
            console.error("Ошибка регистрации:", error);
            alert("Ошибка регистрации: " + error.message);
        });
}

function logout() {
    auth.signOut()
        .then(() => {
            localStorage.removeItem('currentUser');
            currentUser = null;
            currentChat = null;
        })
        .catch(error => {
            console.error("Ошибка выхода:", error);
        });
}

// Навигация
function showSection(sectionId) {
    // Скрыть все секции
    document.querySelectorAll('.app-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Показать выбранную секцию
    document.getElementById(sectionId).style.display = 'block';
    
    // Обновить активную кнопку навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelector(`.nav-btn[data-target="${sectionId}"]`).classList.add('active');
}

// Шифрование
async function sha512(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateKey(seed = Date.now().toString(), length = 256) {
    let hash = await sha512(seed);
    let key = "";
    let i = 0;
    
    while (key.length < length && i * 2 + 2 <= hash.length) {
        let chunk = hash.substr(i * 2, 2);
        let index = parseInt(chunk, 16) % ALPHABET.length;
        key += ALPHABET[index];
        i++;
    }
    
    return key.substring(0, length);
}

function encrypt(text, key) {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (!ALPHABET.includes(char)) {
            result += char;
            continue;
        }
        let shift = ALPHABET.indexOf(key[i % key.length]);
        let newIndex = (ALPHABET.indexOf(char) + shift) % ALPHABET.length;
        result += ALPHABET[newIndex];
    }
    return result;
}

function decrypt(text, key) {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (!ALPHABET.includes(char)) {
            result += char;
            continue;
        }
        let shift = ALPHABET.indexOf(key[i % key.length]);
        let newIndex = (ALPHABET.indexOf(char) - shift + ALPHABET.length) % ALPHABET.length;
        result += ALPHABET[newIndex];
    }
    return result;
}

// Работа с сообщениями
async function encryptMessage() {
    try {
        const recipient = document.getElementById('recipient').value.trim();
        const message = document.getElementById('message').value;
        
        if (!recipient) return alert("Введите получателя!");
        if (!message) return alert("Введите сообщение!");
        
        // Получаем UID получателя
        const recipientUid = await findUserUid(recipient);
        if (!recipientUid) return alert("Пользователь не найден!");
        
        const seed = Date.now().toString();
        const key = await generateKey(seed);
        const encrypted = encrypt(message, key);
        
        const resultBlock = document.getElementById('result');
        resultBlock.innerHTML = `
            <div class="result-header">✅ Сообщение зашифровано</div>
            <div><strong>Кому:</strong> ${recipient}</div>
            <div><strong>Шифр:</strong> ${encrypted}</div>
            <div><strong>Seed:</strong> ${seed}</div>
            <div class="result-packet"><strong>Пакет для отправки:</strong> ${CIPHER_VERSION}:${encrypted}|${key}|${seed}</div>
        `;
        
        // Очищаем поле сообщения
        document.getElementById('message').value = "";
    } catch (err) {
        alert("Ошибка шифрования: " + err.message);
        console.error(err);
    }
}

function decryptMessage() {
    try {
        const packet = document.getElementById('message').value.trim();
        
        // Проверяем версию шифра
        if (!packet.startsWith(CIPHER_VERSION + ":")) {
            throw new Error("Неверный формат пакета. Используйте последнюю версию приложения.");
        }
        
        const payload = packet.split(':')[1];
        const parts = payload.split('|');
        if (parts.length !== 3) throw new Error("Неверный формат пакета. Должен быть: шифр|ключ|seed");
        
        const [cipher, key, seed] = parts;
        const decrypted = decrypt(cipher, key);
        
        const resultBlock = document.getElementById('result');
        resultBlock.innerHTML = `
            <div class="result-header">🔓 Сообщение расшифровано</div>
            <div><strong>Текст:</strong> ${decrypted}</div>
        `;
        
        // Очищаем поле сообщения
        document.getElementById('message').value = "";
    } catch (err) {
        alert("Ошибка дешифровки: " + err.message);
    }
}

// Поиск пользователей
async function findUserUid(username) {
    // Проверяем кэш
    if (usersCache[username]) {
        return usersCache[username];
    }
    
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
    
    // Загружаем чаты пользователя
    const snapshot = await db.ref('userChats/' + currentUser.uid).once('value');
    const chats = snapshot.val() || {};
    
    for (const chatId in chats) {
        const chatData = chats[chatId];
        const userId = chatData.userId;
        const userInfo = await getUserInfo(userId);
        
        if (userInfo) {
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
    
    // Обновляем заголовок чата
    document.getElementById('currentChatHeader').innerHTML = `
        <h3>Чат с ${userInfo.fullName}</h3>
        <span>@${userInfo.username}</span>
    `;
    
    // Загружаем сообщения
    loadChatMessages(userId);
    
    // Помечаем активный чат
    document.querySelectorAll('#chatList li').forEach(li => {
        li.classList.remove('active');
    });
    document.querySelector(`#chatList li[data-user-id="${userId}"]`).classList.add('active');
}

async function loadChatMessages(userId) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    const snapshot = await db.ref('messages')
        .orderByChild('chatId')
        .equalTo(getChatId(currentUser.uid, userId))
        .once('value');
    
    const messages = [];
    snapshot.forEach(child => {
        messages.push({ id: child.key, ...child.val() });
    });
    
    // Сортируем по времени (от старых к новым)
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-chat">
                <div class="empty-icon">💬</div>
                <p>Диалог пуст. Начните общение!</p>
            </div>
        `;
        return;
    }
    
    messages.forEach(msg => {
        const isSent = msg.senderId === currentUser.uid;
        const date = new Date(msg.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageEl = document.createElement('div');
        messageEl.classList.add('message', isSent ? 'message-sent' : 'message-received');
        messageEl.innerHTML = `
            <div class="message-sender">${isSent ? 'Вы' : msg.senderName}</div>
            <div class="message-text">${msg.text}</div>
            <div class="message-time">${timeStr}</div>
        `;
        
        messagesContainer.appendChild(messageEl);
    });
    
    // Прокрутка вниз
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

async function sendMessage() {
    if (!currentChat) {
        alert("Выберите диалог для отправки сообщения");
        return;
    }
    
    const messageText = document.getElementById('chatMessageInput').value.trim();
    if (!messageText) return;
    
    try {
        // Получаем информацию о получателе
        const recipientInfo = await getUserInfo(currentChat);
        
        // Создаём объект сообщения
        const message = {
            chatId: getChatId(currentUser.uid, currentChat),
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            recipientId: currentChat,
            recipientName: recipientInfo.fullName,
            text: messageText,
            timestamp: new Date().toISOString(),
            encrypted: false
        };
        
        // Сохраняем сообщение
        const newMessageRef = db.ref('messages').push();
        await newMessageRef.set(message);
        
        // Обновляем последнее сообщение в чате
        await updateLastMessage(currentUser.uid, currentChat, messageText);
        await updateLastMessage(currentChat, currentUser.uid, messageText);
        
        // Очищаем поле ввода
        document.getElementById('chatMessageInput').value = "";
        
        // Перезагружаем сообщения
        loadChatMessages(currentChat);
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
        alert("Не удалось отправить сообщение");
    }
}

async function updateLastMessage(userId, partnerId, message) {
    const chatRef = db.ref(`userChats/${userId}/${getChatId(userId, partnerId)}`);
    await chatRef.set({
        userId: partnerId,
        lastMessage: message,
        lastUpdated: new Date().toISOString()
    });
}

function listenForNewMessages() {
    db.ref('messages').orderByChild('timestamp').on('child_added', snapshot => {
        const message = snapshot.val();
        
        // Если сообщение адресовано текущему пользователю
        if (message.recipientId === currentUser.uid) {
            // Если открыт чат с отправителем
            if (currentChat === message.senderId) {
                // Добавляем сообщение в чат
                const messagesContainer = document.getElementById('chatMessages');
                
                const isSent = message.senderId === currentUser.uid;
                const date = new Date(message.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                const messageEl = document.createElement('div');
                messageEl.classList.add('message', isSent ? 'message-sent' : 'message-received');
                messageEl.innerHTML = `
                    <div class="message-sender">${isSent ? 'Вы' : message.senderName}</div>
                    <div class="message-text">${message.text}</div>
                    <div class="message-time">${timeStr}</div>
                `;
                
                messagesContainer.appendChild(messageEl);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            
            // Обновляем список чатов
            loadUserChats();
        }
    });
}

// Контакты
async function loadContacts() {
    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';
    
    // Загружаем всех пользователей
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    
    for (const uid in users) {
        if (uid !== currentUser.uid) {
            const user = users[uid];
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
    
    // Обработчики для кнопок чата
    document.querySelectorAll('.btn-chat').forEach(btn => {
        btn.addEventListener('click', async () => {
            const partnerId = btn.dataset.uid;
            const userInfo = await getUserInfo(partnerId);
            openChat(partnerId, userInfo);
            showSection('chatSection');
        });
    });
}

async function searchUsers() {
    const query = document.getElementById('contactSearch').value.trim().toLowerCase();
    if (!query) return;
    
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    // Поиск по пользователям
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    
    let found = false;
    
    for (const uid in users) {
        if (uid !== currentUser.uid) {
            const user = users[uid];
            
            if (user.fullName.toLowerCase().includes(query) || 
                user.username.toLowerCase().includes(query)) {
                
                found = true;
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

async function searchAllUsers() {
    const query = document.getElementById('userSearch').value.trim().toLowerCase();
    if (!query) return;
    
    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';
    
    // Поиск по всем пользователям
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    
    let found = false;
    
    for (const uid in users) {
        if (uid !== currentUser.uid) {
            const user = users[uid];
            
            if (user.fullName.toLowerCase().includes(query) || 
                user.username.toLowerCase().includes(query)) {
                
                found = true;
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
    }
    
    // Добавляем обработчики для новых кнопок
    document.querySelectorAll('.btn-chat').forEach(btn => {
        btn.addEventListener('click', async () => {
            const partnerId = btn.dataset.uid;
            const userInfo = await getUserInfo(partnerId);
            openChat(partnerId, userInfo);
            showSection('chatSection');
        });
    });
    
    if (!found) {
        contactList.innerHTML = '<li class="empty">Пользователи не найдены</li>';
    }
}

// Дополнительные функции
function exportMessages() {
    alert("Функция экспорта будет реализована в следующей версии");
}

async function encryptSelected() {
    const message = document.getElementById('chatMessageInput').value.trim();
    if (!message) return;
    
    if (!currentChat) {
        alert("Выберите диалог для шифрования сообщения");
        return;
    }
    
    try {
        const seed = Date.now().toString();
        const key = await generateKey(seed);
        const encrypted = encrypt(message, key);
        
        document.getElementById('chatMessageInput').value = `${CIPHER_VERSION}:${encrypted}|${key}|${seed}`;
    } catch (err) {
        alert("Ошибка шифрования: " + err.message);
        console.error(err);
    }
}
