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

// Расширенный алфавит
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*";

function generateKey(seed, length = 100) {
  let hash = sha512(seed);
  let key = "";
  let used = [];
  let i = 0;
  while (key.length < length) {
    let index = parseInt(hash.substr((i * 2) % hash.length, 2), 16) % ALPHABET.length;
    let char = ALPHABET[index];
    if (!used.includes(char)) {
      key += char;
      used.push(char);
      if (used.length > 15) used.shift();
    }
    i++;
  }
  return key;
}

function sha512(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const buffer = crypto.subtle.digest("SHA-512", data);
  return buffer.then(b => {
    const hexCodes = [];
    const view = new DataView(b);
    for (let i = 0; i < view.byteLength; i += 4) {
      const value = view.getUint32(i);
      const stringValue = value.toString(16);
      const padding = "00000000".substring(stringValue.length);
      hexCodes.push(padding + stringValue);
    }
    return hexCodes.join("");
  });
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

async function encryptMessage() {
  const username = document.getElementById("username").value.trim();
  const recipient = document.getElementById("recipient").value.trim();
  const message = document.getElementById("message").value.trim();
  const seed = `${username}-${Date.now()}`;

  if (!username || !recipient || !message) return alert("⚠️ Заполните все поля");

  const hash = await sha512(seed);
  const key = generateKey(hash);
  const encrypted = encrypt(message, key);

  db.ref("messages").push({
    from: username,
    to: recipient,
    encrypted,
    seed
  });

  document.getElementById("message").value = "";
}

function clearMessages() {
  document.getElementById("chatList").innerHTML = "";
  localStorage.removeItem("messages");
}

function exportMessages() {
  const list = document.getElementById("chatList").innerText;
  const blob = new Blob([list], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "messages.txt";
  link.click();
}

db.ref("messages").on("value", async snapshot => {
  const chatList = document.getElementById("chatList");
  const currentUser = document.getElementById("username").value.trim();
  chatList.innerHTML = "";
  const data = snapshot.val();
  if (!data) return;
  for (let id in data) {
    const { from, to, encrypted, seed } = data[id];
    if (to === currentUser || from === currentUser) {
      const hash = await sha512(seed);
      const key = generateKey(hash);
      const decrypted = decrypt(encrypted, key);
      const li = document.createElement("li");
      li.textContent = `${from} → ${to}: ${decrypted}`;
      chatList.appendChild(li);
    }
  }
});

