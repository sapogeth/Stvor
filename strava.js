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

// Имя через prompt, однократно
let currentUser = localStorage.getItem("user");
if (!currentUser) {
  currentUser = prompt("Введите ваше имя:");
  if (!currentUser) return alert("Имя обязательно! Перезагрузите страницу.");
  localStorage.setItem("user", currentUser);
}
document.getElementById("username").value = currentUser;

// Отправка "сырого" текста
function encryptMessage() {
  const from = currentUser;
  const to = document.getElementById("recipient").value.trim();
  const text = document.getElementById("message").value;
  if (!from || !to || !text) return alert("Введите имя получателя и сообщение!");

  const packet = text; // без шифра

  // Отобразим результат
  const div = document.createElement("div");
  div.innerHTML = `<strong>${from} → ${to}</strong><br>Сообщение: ${text}`;
  document.getElementById("result").prepend(div);

  // Сохраняем в базу
  db.ref("messages").push({
    from, to, time: Date.now(),
    text: text, cipher: packet
  });

  showChats();
}

function decryptMessage() {
  alert("🔓 Шифрование отключено — расшифровка недоступна.");
}

// Отображение входящих/исходящих
function showChats() {
  const list = document.getElementById("chatList");
  list.innerHTML = "";
  db.ref("messages").off();

  db.ref("messages").orderByChild("time")
    .on("child_added", snap => {
      const m = snap.val();
      if (m.from === currentUser || m.to === currentUser) {
        const li = document.createElement("li");
        const who = m.from === currentUser ? "🟢 Вы" : `👤 ${m.from}`;
        const target = m.to === currentUser ? "🟢 Вам" : m.to;
        li.innerHTML = `<strong>${who} → ${target}</strong><br>${m.text}`;
        list.appendChild(li);
      }
    });
}

function exportMessages() {
  db.ref("messages").once("value", snap => {
    const data = JSON.stringify(snap.val() || {});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = "messages.json";
    a.click();
  });
}

function clearMessages() {
  db.ref("messages").remove();
  document.getElementById("result").innerHTML = "";
  document.getElementById("chatList").innerHTML = "";
  alert("Переписка очищена.");
}

showChats();
