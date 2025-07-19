import { 
    generateUserKeys as generateCryptoKeys, 
    keyStorage as cryptoKeyStorage,
    exportPublicKey,
    importPublicKey,
    importSigningKey,
    establishSecureSession,
    encryptMessageHybrid,
    decryptMessageHybrid
} from './security.js';

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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

window.db = db;
window.auth = auth;
let currentUser = null;

function validatePassword(password) {
    const minLength = 8;
    const hasLetter = /[a-zA-Zа-яА-Я]/.test(password);
    const hasNumber = /\d/.test(password);
    return password.length >= minLength && hasLetter && hasNumber;
}

async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const fullName = document.getElementById('regFullName').value.trim();

    if (!username || !password || !confirmPassword || !fullName) {
        alert("Пожалуйста, заполните все поля");
        return;
    }

    if (password !== confirmPassword) {
        alert("Пароли не совпадают!");
        return;
    }

    if (!validatePassword(password)) {
        alert("Пароль должен содержать минимум 8 символов, включая буквы и цифры");
        return;
    }

    const email = `${username}@academic-chat.ru`;

    try {
        const registerBtn = document.getElementById('registerBtn');
        registerBtn.disabled = true;
        registerBtn.textContent = "Регистрация...";
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        
        const keys = await generateCryptoKeys();
        await cryptoKeyStorage.save(keys, userId);
        
        const publicKey = await exportPublicKey(keys.encryptionKeyPair.publicKey);
        
        // Сохраняем пользователя в базе данных
        await db.ref('users/' + userId).set({
            username,
            fullName,
            publicKey,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        alert("Регистрация успешна!");
        showLoginForm();
    } catch (error) {
        let errorMessage = "Ошибка регистрации";
        if (error.code === 'auth/email-already-in-use') errorMessage = "Пользователь с таким именем уже существует";
        else if (error.code === 'auth/weak-password') errorMessage = "Пароль слишком слабый";
        alert(`${errorMessage}: ${error.message}`);
    } finally {
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.textContent = "Зарегистрироваться";
        }
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        alert("Пожалуйста, заполните все поля");
        return;
    }
    
    const email = `${username}@academic-chat.ru`;
    
    try {
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = true;
        loginBtn.textContent = "Вход...";
        
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        let errorMessage = "Ошибка входа";
        if (error.code === 'auth/user-not-found') errorMessage = "Пользователь не найден";
        else if (error.code === 'auth/wrong-password') errorMessage = "Неверный пароль";
        alert(`${errorMessage}: ${error.message}`);
    } finally {
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = "Войти";
        }
    }
}

function logout() {
    auth.signOut();
}

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

async function handleAuthStateChange(user) {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (user) {
        try {
            const userId = user.uid;
            const keys = await cryptoKeyStorage.load(userId);
            
            if (!keys) throw new Error("Криптографические ключи не найдены");
            
            currentUser = {
                id: userId,
                username: user.email.split('@')[0],
                keys
            };
            
            document.getElementById('currentUserDisplay').textContent = currentUser.username;
            welcomeScreen.style.display = 'none';
            mainApp.style.display = 'block';
            
            // Загружаем контакты после входа
            loadContacts();
        } catch (error) {
            alert("Ошибка загрузки пользовательских данных: " + error.message);
            auth.signOut();
        }
    } else {
        currentUser = null;
        welcomeScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
}

function switchSection(targetId) {
    document.querySelectorAll('.app-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(targetId).style.display = 'block';
    
    document.querySelectorAll('.nav-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.target === targetId);
    });
}

async function searchUsers() {
    const searchTerm = document.getElementById('contactSearch').value.trim();
    if (!searchTerm) return;
    
    try {
        const snapshot = await db.ref('users').orderByChild('username').once('value');
        const users = snapshot.val();
        const chatList = document.getElementById('chatList');
        chatList.innerHTML = '';
        
        if (!users) return;
        
        for (const userId in users) {
            if (userId === currentUser.id) continue;
            
            const username = users[userId].username.toLowerCase();
            if (username.includes(searchTerm.toLowerCase())) {
                const li = document.createElement('li');
                li.textContent = users[userId].username;
                li.dataset.userId = userId;
                li.addEventListener('click', () => startChat(userId));
                chatList.appendChild(li);
            }
        }
    } catch (error) {
        console.error("Ошибка поиска:", error);
        alert("Ошибка поиска пользователей");
    }
}

async function encryptMessage() {
    const recipient = document.getElementById('recipient').value.trim();
    const message = document.getElementById('message').value;
    const resultDiv = document.getElementById('result');
    
    if (!recipient || !message) {
        alert("Заполните все поля");
        return;
    }
    
    try {
        // Поиск пользователя в базе
        const snapshot = await db.ref('users').orderByChild('username').equalTo(recipient).once('value');
        const users = snapshot.val();
        
        if (!users) {
            throw new Error("Пользователь не найден");
        }
        
        const userId = Object.keys(users)[0];
        const userData = users[userId];
        
        if (!userData.publicKey) {
            throw new Error("Публичный ключ пользователя не найден");
        }
        
        const publicKey = await importPublicKey(userData.publicKey);
        
        // Установка сессии
        const sessionKey = await establishSecureSession(
            currentUser.keys.encryptionKeyPair.privateKey,
            publicKey
        );
        
        // Шифрование
        const encrypted = await encryptMessageHybrid(
            sessionKey,
            message,
            currentUser.keys.signingKeyPair.privateKey
        );
        
        resultDiv.textContent = encrypted;
    } catch (error) {
        console.error("Ошибка шифрования:", error);
        alert(`Ошибка шифрования: ${error.message}`);
    }
}

async function decryptMessage() {
    const packet = document.getElementById('result').textContent;
    const resultDiv = document.getElementById('result');
    
    if (!packet) {
        alert("Нет данных для дешифровки");
        return;
    }
    
    try {
        const recipient = document.getElementById('recipient').value.trim();
        if (!recipient) throw new Error("Укажите отправителя");
        
        const snapshot = await db.ref('users').orderByChild('username').equalTo(recipient).once('value');
        const users = snapshot.val();
        
        if (!users) throw new Error("Пользователь не найден");
        
        const userId = Object.keys(users)[0];
        const userData = users[userId];
        
        if (!userData.publicKey) throw new Error("Публичный ключ не найден");
        
        const publicKey = await importSigningKey(userData.publicKey);
        const encryptionPublicKey = await importPublicKey(userData.publicKey);
        
        // Установка сессии
        const sessionKey = await establishSecureSession(
            currentUser.keys.encryptionKeyPair.privateKey,
            encryptionPublicKey
        );
        
        // Дешифровка
        const decrypted = await decryptMessageHybrid(
            sessionKey,
            packet,
            publicKey
        );
        
        resultDiv.textContent = decrypted;
    } catch (error) {
        console.error("Ошибка дешифровки:", error);
        alert(`Ошибка дешифровки: ${error.message}`);
    }
}

async function loadContacts() {
    try {
        const snapshot = await db.ref('users').once('value');
        const users = snapshot.val();
        const contactList = document.getElementById('contactList');
        if (!contactList) return;
        
        contactList.innerHTML = '';
        
        if (!users) {
            contactList.innerHTML = '<li>Пока нет контактов</li>';
            return;
        }
        
        for (const userId in users) {
            if (userId === currentUser.id) continue;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${users[userId].username}</span>
                <div class="contact-actions">
                    <button class="contact-btn btn-chat" data-userid="${userId}">Чат</button>
                </div>
            `;
            contactList.appendChild(li);
        }
        
        // Добавляем обработчики для кнопок чата
        document.querySelectorAll('.btn-chat').forEach(btn => {
            btn.addEventListener('click', () => {
                startChat(btn.dataset.userid);
            });
        });
    } catch (error) {
        console.error("Ошибка загрузки контактов:", error);
        const contactList = document.getElementById('contactList');
        if (contactList) contactList.innerHTML = '<li>Ошибка загрузки контактов</li>';
    }
}

async function startChat(userId) {
    try {
        const snapshot = await db.ref(`users/${userId}`).once('value');
        const user = snapshot.val();
        
        document.getElementById('currentChatHeader').innerHTML = `
            <h3>Чат с ${user.username}</h3>
            <div id="securityIndicator">🔒 Защищено сквозным шифрованием</div>
        `;
        
        // Очищаем сообщения
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '<div class="empty-chat"><div class="empty-icon">💬</div><p>Начните диалог</p></div>';
        
        // Сохраняем текущий чат
        currentChat = userId;
    } catch (error) {
        console.error("Ошибка начала чата:", error);
        alert("Не удалось начать чат");
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('chatMessageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentChat) return;
    
    try {
        // Получаем данные получателя
        const snapshot = await db.ref(`users/${currentChat}`).once('value');
        const recipient = snapshot.val();
        
        if (!recipient || !recipient.publicKey) {
            throw new Error("Публичный ключ получателя не найден");
        }
        
        // Импортируем публичный ключ
        const publicKey = await importPublicKey(recipient.publicKey);
        
        // Устанавливаем сессию
        const sessionKey = await establishSecureSession(
            currentUser.keys.encryptionKeyPair.privateKey,
            publicKey
        );
        
        // Шифруем сообщение
        const encrypted = await encryptMessageHybrid(
            sessionKey,
            message,
            currentUser.keys.signingKeyPair.privateKey
        );
        
        // Сохраняем сообщение в базе
        const chatRef = db.ref(`chats/${currentUser.id}_${currentChat}`);
        await chatRef.push({
            sender: currentUser.id,
            message: encrypted,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Добавляем сообщение в интерфейс
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = ''; // Очищаем предыдущее состояние
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message message-sent';
        messageElement.innerHTML = `
            <div class="message-sender">Вы</div>
            <div class="message-text">${message}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        chatMessages.appendChild(messageElement);
        
        // Очищаем поле ввода
        messageInput.value = '';
        
        // Прокручиваем вниз
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
        alert("Не удалось отправить сообщение: " + error.message);
    }
}

let currentChat = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('registerBtn').addEventListener('click', register);
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('showRegisterFormBtn').addEventListener('click', showRegisterForm);
    document.getElementById('showLoginFormBtn').addEventListener('click', showLoginForm);
    
    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => {
            switchSection(button.dataset.target);
        });
    });
    
    document.getElementById('chatMessageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Обработчики для кнопок шифрования
    document.getElementById('encryptMessageBtn').addEventListener('click', encryptMessage);
    document.getElementById('decryptMessageBtn').addEventListener('click', decryptMessage);
    
    // Обработчики для поиска
    document.getElementById('searchUsersBtn').addEventListener('click', searchUsers);
    document.getElementById('searchAllUsersBtn').addEventListener('click', loadContacts);
    
    // Обработчик отправки сообщений
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
    
    auth.onAuthStateChanged(handleAuthStateChange);
});
