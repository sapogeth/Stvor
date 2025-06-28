const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*";

function generateKey(from, to, seed = Date.now().toString(), length = 100) {
    const input = `${from}-${to}-${seed}`;
    let hash = sha512(input);
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

function encryptMessage() {
    try {
        const user = document.getElementById("username").value.trim();
        const recipient = document.getElementById("recipient").value.trim();
        const message = document.getElementById("message").value;
        if (!user || !recipient || !message) return alert("Введите имя, получателя и сообщение!");

        const seed = Date.now().toString();
        const key = generateKey(user, recipient, seed);
        const encrypted = encrypt(message, key);

        const resultBlock = document.getElementById("result");
        const output = document.createElement("div");
        output.innerHTML = `
            <hr>
            👤 <b>От:</b> ${user}<br>
            📨 <b>Кому:</b> ${recipient}<br>
            📝 <b>Сообщение:</b> ${message}<br>
            🔐 <b>Шифр:</b> ${encrypted}<br>
            🧬 <b>Seed:</b> ${seed}<br>
            📦 <b>Пакет:</b> ${encrypted}|${key}|${seed}
        `;
        resultBlock.appendChild(output);

        const packet = `${encrypted}|${key}|${seed}`;
        saveMessage(user, recipient, packet, message);
        showChats(user);
    } catch (err) {
        alert("Ошибка шифрования: " + err.message);
    }
}

function decryptMessage() {
    try {
        const packet = document.getElementById("message").value.trim();
        const parts = packet.split("|");
        if (parts.length !== 3) throw new Error("Формат: шифр|ключ|seed");

        const [cipher, key, seed] = parts;
        const decrypted = decrypt(cipher, key);
        const resultBlock = document.getElementById("result");
        const output = document.createElement("div");
        output.innerHTML = `📨 <b>Расшифровка:</b> ${decrypted}`;
        resultBlock.appendChild(output);
    } catch (err) {
        alert("Ошибка расшифровки: " + err.message);
    }
}

function saveMessage(from, to, encryptedPacket, originalText) {
    const key = `${from}-${to}`;
    let messages = {};
    try {
        messages = JSON.parse(localStorage.getItem("ilyazh_messages") || "{}");
    } catch (e) {
        messages = {};
    }
    if (!messages[key]) messages[key] = [];
    messages[key].push({ time: new Date().toISOString(), text: originalText, cipher: encryptedPacket });
    localStorage.setItem("ilyazh_messages", JSON.stringify(messages));
}

function showChats(currentUser) {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    let messages = {};
    try {
        messages = JSON.parse(localStorage.getItem("ilyazh_messages") || "{}");
    } catch (e) {
        messages = {};
    }
    for (let key in messages) {
        if (!key.startsWith(currentUser + "-")) continue;
        messages[key].slice(-10).forEach(msg => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>${key}</strong><br>📝 ${msg.text}<br>🔐 ${msg.cipher}`;
            list.appendChild(li);
        });
    }
}

function exportMessages() {
    try {
        const data = localStorage.getItem("ilyazh_messages") || "{}";
        const blob = new Blob([data], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "ilyazh_chats.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert("Ошибка экспорта: " + e.message);
    }
}

function clearMessages() {
    localStorage.removeItem("ilyazh_messages");
    document.getElementById("chatList").innerHTML = "";
    document.getElementById("result").innerHTML = "";
    alert("Все сообщения удалены.");
}

function sha512(str) {
    const utf8 = new TextEncoder().encode(str);
    const hex = Array.from(utf8).map(b => b.toString(16).padStart(2, "0")).join("");
    let sum = 0;
    for (let i = 0; i < hex.length; i++) {
        sum += parseInt(hex[i], 16) * (i + 1);
    }
    return (sum.toString(16).repeat(64)).substr(0, 128);
}