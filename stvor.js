import { 
    generateUserKeys as generateCryptoKeys, 
    keyStorage as cryptoKeyStorage,
    exportPublicKey
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
            
            window.currentUser = {
                id: userId,
                username: user.email.split('@')[0],
                keys
            };
            
            document.getElementById('currentUserDisplay').textContent = window.currentUser.username;
            welcomeScreen.style.display = 'none';
            mainApp.style.display = 'block';
        } catch (error) {
            alert("Ошибка загрузки пользовательских данных");
            auth.signOut();
        }
    } else {
        window.currentUser = null;
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
    
    auth.onAuthStateChanged(handleAuthStateChange);
});

function sendMessage() {}
function encryptSelected() {}
function searchUsers() {}
function loadContacts() {}
function loadChats() {}
