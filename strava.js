// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

let currentUser = localStorage.getItem("user");
if (!currentUser) {
    currentUser = prompt("Введите ваше имя:");
    if (currentUser) {
        localStorage.setItem("user", currentUser);
    } else {
        alert("Имя обязательно!");
        location.reload();
    }
}
document.getElementById("username").value = currentUser;

function encryptMessage() {
    try {
        const user = currentUser;
        const recipient = document.getElementById("recipient").value.trim();
        const message = document.getElementById("message").value;
        if (!user || !recipient || !message) return alert("Введите имя, получателя и сообщение!");

        alert("🔐 Шифрование временно отключено для защиты алгоритма.");

        const encrypted = "[ЗАЩИЩЕНО]";
        const seed = "[ЗАЩИЩЕНО]";
        const key = "[ЗАЩИЩЕНО]";
        const packet = `${encrypted}|${key}|${seed}`;

        const resultBlock = document.getElementById("result");
        const output = document.createElement("div");
        output.innerHTML = `
            <hr>
            👤 <b>От:</b> ${user}<br>
            📨 <b>Кому:</b> ${recipient}<br>
            📝 <b>Сообщение:</b> ${message}<br>
            🔐 <b>Шифр:</b> ${encrypted}<br>
            🧬 <b>Seed:</b> ${seed}<br>
            📦 <b>Пакет:</b> ${packet}
        `;
        resultBlock.appendChild(output);

        saveMessage(user, recipient, packet, message);
    } catch (err) {
        alert("Ошибка шифрования: " + err.message);
    }
}

function decryptMessage() {
    alert("🔓 Расшифровка временно отключена для защиты алгоритма.");
}

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

function showChats(currentUser) {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    db.ref("messages").on("value", snapshot => {
        const data = snapshot.val() || {};
        for (let id in data) {
            const msg = data[id];
            if (msg.from === currentUser || msg.to === currentUser) {
                const li = document.createElement("li");
                const sender = msg.from === currentUser ? "🟢 Вы" : `👤 ${msg.from}`;
                const receiver = msg.to === currentUser ? "🟢 Вам" : `📩 ${msg.to}`;
                li.innerHTML = `<strong>${sender} → ${receiver}</strong><br>📝 ${msg.text}<br>🔐 ${msg.cipher}`;
                list.appendChild(li);
            }
        }
    });
}

function exportMessages() {
    db.ref("messages").once("value", snapshot => {
        const data = JSON.stringify(snapshot.val() || {});
        const blob = new Blob([data], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "ilyazh_chats.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

function clearMessages() {
    db.ref("messages").remove();
    document.getElementById("chatList").innerHTML = "";
    document.getElementById("result").innerHTML = "";
    alert("Все сообщения удалены.");
}

showChats(currentUser);
