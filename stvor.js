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

// ========== ШИФРОВАЛЬНЫЕ ФУНКЦИИ ==========

function generateUserKeys() {
    const now = Date.now().toString();
    const base = btoa(now + Math.random().toString()).slice(0, 32);

    const publicKey = base;
    const privateKey = base.split("").reverse().join("");

    return { publicKey, privateKey };
}

const keyStorage = {
    save: async (keys, userId) => {
        try {
            localStorage.setItem("cryptoVault_" + userId, JSON.stringify(keys));
            return true;
        } catch (e) {
            console.error("Ошибка сохранения ключей:", e);
            return false;
        }
    },
    load: async (userId) => {
        try {
            const keys = localStorage.getItem("cryptoVault_" + userId);
            if (!keys) return false;

            const parsed = JSON.parse(keys);
            window.userCrypto = parsed;
            return true;
        } catch (e) {
            console.error("Ошибка загрузки ключей:", e);
            return false;
        }
    }
};

// ========== РЕГИСТРАЦИЯ ==========

async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!username || !password) {
        alert("Заполните все поля");
        return;
    }

    const email = username + "@academic-chat.ru";

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;

        const keys = generateUserKeys();
        const success = await keyStorage.save(keys, userId);

        if (!success) {
            alert("Ваша учетная запись создана, но возникла проблема с криптографическими ключами.");
        } else {
            alert("Регистрация успешна!");
            location.reload();
        }
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        alert("Ошибка регистрации: " + error.message);
    }
}

// ========== ВХОД ==========

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
            alert("Неверный логин или пароль: " + error.message);
        });
}

// ========== ПРОВЕРКА АВТОРИЗАЦИИ ==========

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userId = user.uid;
        console.log("Пользователь вошёл:", userId);

        const keysLoaded = await keyStorage.load(userId);
        if (keysLoaded) {
            console.log("Ключи успешно загружены");
            document.getElementById('authContainer').style.display = 'none';
            document.getElementById('welcomeMessage').style.display = 'block';
            document.getElementById('welcomeUser').innerText = user.email.split('@')[0];
        } else {
            alert("Криптографические ключи не найдены. Пожалуйста, зарегистрируйтесь заново.");
        }
    } else {
        console.log("Пользователь вышел");
        document.getElementById('authContainer').style.display = 'block';
        document.getElementById('welcomeMessage').style.display = 'none';
    }
});
