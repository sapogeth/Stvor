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

let currentUser;
window.addEventListener("DOMContentLoaded", () => {
  currentUser = localStorage.getItem("user");
  if (!currentUser) {
    currentUser = prompt("Введите ваше имя:");
    if (currentUser) {
      localStorage.setItem("user", currentUser);
    } else {
      alert("Имя обязательно!");
      location.reload();
    }
  }

  // Подставим имя в поле (если есть input с id="username")
  const usernameField = document.getElementById("username");
  if (usernameField) usernameField.value = currentUser;

function encryptMessage() {
  const from = currentUser;
  const to = document.getElementById("recipient").value.trim();
  const text = document.getElementById("message").value.trim();
  if (!from || !to || !text) return alert("Заполните все поля!");

  const ref = db.ref("messages").push();
  ref.set({
    from, to,
    time: new Date().toISOString(),
    text
  });
  document.getElementById("message").value = "";
}

function clearMessages() {
  db.ref("messages").remove();
  document.getElementById("chatList").innerHTML = "";
}

function exportMessages() {
  db.ref("messages").once("value", snapshot => {
    const data = JSON.stringify(snapshot.val() || {});
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "strava_messages.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

function showChats() {
  const list = document.getElementById("chatList");
  db.ref("messages").on("value", snapshot => {
    list.innerHTML = "";
    const data = snapshot.val();
    if (!data) return;
    for (let id in data) {
      const msg = data[id];
      if (msg.from === currentUser || msg.to === currentUser) {
        const li = document.createElement("li");
        li.innerHTML = `<b>${msg.from}</b> → <b>${msg.to}</b><br>${msg.text}`;
        list.appendChild(li);
      }
    }
  });
}

showChats();
