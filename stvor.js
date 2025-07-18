import { 
    generateUserKeys as generateCryptoKeys, 
    keyStorage as cryptoKeyStorage,
    exportPublicKey
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



// ========== РЕГИСТРАЦИЯ ==========

async function register() {
    // Получаем значения полей
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const fullName = document.getElementById('regFullName').value.trim();

    // Проверяем заполненность полей
    if (!username || !password || !confirmPassword || !fullName) {
        alert("Пожалуйста, заполните все поля");
        return;
    }

    // Проверяем совпадение паролей
    if (password !== confirmPassword) {
        alert("Пароли не совпадают!");
        return;
    }

    // Проверяем сложность пароля
    if (!validatePassword(password)) {
        alert("Пароль должен содержать минимум 8 символов, включая буквы и цифры");
        return;
    }

    const email = `${username}@academic-chat.ru`;

    try {
        // Создаем пользователя в Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        
        // Генерируем криптографические ключи
        const keys = await generateCryptoKeys();
        
        // Сохраняем ключи в локальное хранилище
        await cryptoKeyStorage.save(keys, userId);
        
        // Экспортируем публичный ключ для обмена
        const publicKey = await exportPublicKey(keys.encryptionKeyPair.publicKey);
        
        // Сохраняем информацию о пользователе в базу данных Firebase
        await db.ref('users/' + userId).set({
            username,
            fullName,
            publicKey,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        alert("Регистрация успешна! Теперь вы можете войти в систему.");
        showLoginForm();
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        
        // Пользовательские сообщения об ошибках
        let errorMessage = "Ошибка регистрации";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Пользователь с таким именем уже существует";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Пароль слишком слабый";
        }
        
        alert(`${errorMessage}: ${error.message}`);
    }
}

// Функция валидации пароля
function validatePassword(password) {
    const minLength = 8;
    const hasLetter = /[a-zA-Zа-яА-Я]/.test(password);
    const hasNumber = /\d/.test(password);
    
    return password.length >= minLength && hasLetter && hasNumber;
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
