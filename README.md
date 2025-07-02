<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stvor Social</title>
  <link rel="stylesheet" href="stvor.css">
  <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>
  <script defer src="stvor.js"></script>
</head>
<body>
  <div class="container">
    <h1>💬 Stvor Social</h1>
    <input type="text" id="username" readonly />
    <input type="text" id="recipient" placeholder="Получатель" />
    <textarea id="message" placeholder="Введите сообщение..."></textarea>
    <button onclick="encryptMessage()">📤 Отправить</button>
    <button onclick="clearMessages()">🗑 Очистить</button>
    <button onclick="exportMessages()">⬇️ Экспорт</button>
    <ul id="chatList"></ul>
    <div id="result"></div>
  </div>
</body>
</html>
