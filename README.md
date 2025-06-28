<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Strava – Социальный менеджер</title>
  <link rel="stylesheet" href="strava.css" />

  <!-- Firebase SDK — обязательно -->
  <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>
</head>
<body>
  <h1>📡 Strava (без шифра)</h1>

  <input type="text" id="username" placeholder="Ваше имя" disabled />
  <input type="text" id="recipient" placeholder="Кому" />
  <textarea id="message" placeholder="Введите сообщение..."></textarea>

  <div class="buttons">
    <button onclick="encryptMessage()">Отправить (текст)</button>
    <button onclick="decryptMessage()">Расшифровать (нет шифра)</button>
    <button onclick="exportMessages()">💾 Экспорт</button>
    <button onclick="clearMessages()">🧹 Очистить</button>
  </div>

  <div id="result"></div>
  <ul id="chatList"></ul>

  <script src="strava.js"></script>
</body>
</html>
