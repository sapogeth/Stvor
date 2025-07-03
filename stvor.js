// stvor.js
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*";

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

// Проверяем и устанавливаем текущего пользователя
let currentUser = localStorage.getItem("user");
if (!currentUser) {
    currentUser = prompt("Введите ваше имя:");
    if (currentUser) {
        localStorage.setItem("user", currentUser);
    } else {
        currentUser = "Аноним_" + Math.random().toString(36).substr(2, 5);
        localStorage.setItem("user", currentUser);
    }
}
document.getElementById("username").value = currentUser;

// Функция для экранирования HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Настоящая реализация SHA-512
async function sha512(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Генерация ключа
async function generateKey(from, to, seed = Date.now().toString(), length = 100) {
    const input = `${from}-${to}-${seed}`;
    let hash = await sha512(input);
    let key = "";
    let used = [];
    let i = 0;
    
    while (key.length < length && i * 2 + 2 <= hash.length) {
        let chunk = hash.substr(i * 2, 2);
        let index = parseInt(chunk, 16) % ALPHABET.length;
        let char = ALPHABET[index];
        
        if (!used.includes(char)) {
            key += char;
            used.push(char);
            if (used.length > 15) used.shift();
        }
        i++;
    }
    
    while (key.length < length) {
        key += ALPHABET[(key.length * 13) % ALPHABET.length];
    }
    
    return key;
}

// Шифрование
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

// Дешифрование
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

// Шифрование сообщения
async function encryptMessage() {
    try {
        const user = escapeHtml(document.getElementById("username").value.trim() || currentUser);
        const recipient = escapeHtml(document.getElementById("recipient").value.trim());
        const message = document.getElementById("message").value;
        
        if (!user) return alert("Введите ваше имя!");
        if (!recipient) return alert("Введите получателя!");
        if (!message) return alert("Введите сообщение!");
        if (recipient === user) return alert("Нельзя отправлять сообщения самому себе!");

        const seed = Date.now().toString();
        const key = await generateKey(user, recipient, seed);
        const encrypted = encrypt(message, key);

        const resultBlock = document.getElementById("result");
        const output = document.createElement("div");
        output.className = "result-item";
        output.innerHTML = `
            <div class="result-header">✅ Сообщение зашифровано</div>
            <div><strong>От:</strong> ${user}</div>
            <div><strong>Кому:</strong> ${recipient}</div>
            <div><strong>Шифр:</strong> ${encrypted}</div>
            <div><strong>Seed:</strong> ${seed}</div>
            <div class="result-packet"><strong>Пакет:</strong> ${encrypted}|${key}|${seed}</div>
        `;
        resultBlock.appendChild(output);

        const packet = `${encrypted}|${key}|${seed}`;
        saveMessage(user, recipient, packet, message);
        
        // Очищаем поле сообщения
        document.getElementById("message").value = "";
    } catch (err) {
        alert("Ошибка шифрования: " + err.message);
        console.error(err);
    }
}

// Дешифрование сообщения
function decryptMessage() {
    try {
        const packet = document.getElementById("message").value.trim();
        const parts = packet.split("|");
        if (parts.length !== 3) throw new Error("Неверный формат пакета. Должен быть: шифр|ключ|seed");

        const [cipher, key, seed] = parts;
        const decrypted = decrypt(cipher, key);
        
        const resultBlock = document.getElementById("result");
        const output = document.createElement("div");
        output.className = "result-item";
        output.innerHTML = `
            <div class="result-header">🔓 Сообщение расшифровано</div>
            <div><strong>Текст:</strong> ${escapeHtml(decrypted)}</div>
        `;
        resultBlock.appendChild(output);
        
        // Очищаем поле сообщения
        document.getElementById("message").value = "";
    } catch (err) {
        alert("Ошибка дешифровки: " + err.message);
    }
}

// Сохранение сообщения в Firebase
function saveMessage(from, to, encryptedPacket, originalText) {
    const ref = db.ref("messages").push();
    ref.set({
        from,
        to,
        time: new Date().toISOString(),
        text: originalText,
        cipher: encryptedPacket
    });
}

// Отображение чатов
function showChats(currentUser) {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    
    db.ref("messages").orderByChild("time").on("value", snapshot => {
        const data = snapshot.val() || {};
        const messages = [];
        
        // Преобразуем объект в массив
        for (let id in data) {
            messages.push({ id, ...data[id] });
        }
        
        // Сортируем по времени (новые сверху)
        messages.sort((a, b) => new Date(b.time) - new Date(a.time));
        
        list.innerHTML = "";
        messages.forEach(msg => {
            if (msg.from === currentUser || msg.to === currentUser) {
                const date = new Date(msg.time);
                const timeStr = date.toLocaleString();
                
                const li = document.createElement("li");
                li.innerHTML = `
                    <div class="message-header">
                        <span class="message-sender">От: ${escapeHtml(msg.from)}</span>
                        <span class="message-recipient">Кому: ${escapeHtml(msg.to)}</span>
                        <span class="message-time">${timeStr}</span>
                    </div>
                    <div class="message-text">${escapeHtml(msg.text)}</div>
                    <div class="message-cipher">🔐 ${escapeHtml(msg.cipher)}</div>
                    <button class="reply-btn" 
                            onclick="replyToMessage('${escapeHtml(msg.from)}', '${escapeHtml(msg.text)}')">
                        <span class="icon">↩️</span> Ответить
                    </button>
                `;
                list.appendChild(li);
            }
        });
    });
}

// Ответ на сообщение
function replyToMessage(sender, text) {
    if (sender === currentUser) return;
    
    document.getElementById("recipient").value = sender;
    document.getElementById("message").value = `> ${text}\n\n`;
    document.getElementById("message").focus();
}

// Экспорт сообщений
function exportMessages() {
    db.ref("messages").once("value", snapshot => {
        const data = snapshot.val() || {};
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `secure_chat_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert("Экспорт завершен! Файл сохранен.");
    });
}

// Импорт сообщений
function importMessages() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                if (typeof data !== "object" || data === null) {
                    throw new Error("Неверный формат файла");
                }
                
                const messagesRef = db.ref("messages");
                let importedCount = 0;
                
                for (let key in data) {
                    messagesRef.child(key).set(data[key], error => {
                        if (!error) importedCount++;
                    });
                }
                
                setTimeout(() => {
                    alert(`Успешно импортировано сообщений: ${importedCount}`);
                }, 1000);
                
            } catch (err) {
                alert("Ошибка импорта: " + err.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

// Поиск сообщений
function searchMessages() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    if (!query) return;
    
    const listItems = document.querySelectorAll("#chatList li");
    let found = false;
    
    listItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = "block";
            item.style.animation = "highlight 1.5s";
            found = true;
        } else {
            item.style.display = "none";
        }
    });
    
    if (!found) {
        alert("Сообщения не найдены");
    }
}

// Очистка сообщений
function clearMessages() {
    if (!confirm("Вы уверены, что хотите удалить ВСЕ сообщения? Это действие нельзя отменить.")) return;
    
    db.ref("messages").remove()
        .then(() => {
            document.getElementById("chatList").innerHTML = "";
            document.getElementById("result").innerHTML = "";
            alert("Все сообщения удалены.");
        })
        .catch(error => {
            alert("Ошибка при удалении: " + error.message);
        });
}

// Инициализация чата
showChats(currentUser);

// Фокус на поле сообщения
document.getElementById("message").focus();

// Обработка Enter в поле сообщения
document.getElementById("message").addEventListener("keypress", function(e) {
    if (e.key === "Enter" && e.shiftKey) {
        // Shift+Enter - новая строка
        return;
    }
    
    if (e.key === "Enter") {
        e.preventDefault();
        encryptMessage();
    }
});

// Обработка Enter в поле поиска
document.getElementById("searchInput").addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        searchMessages();
    }
});
