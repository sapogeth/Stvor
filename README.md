<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Strava Chat — Ilyazh Encrypt</title>
    <link rel="stylesheet" href="strava.css">
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-database-compat.js"></script>

</head>
<body>
    <h1>🔐 Strava</h1>

    <div class="input-group">
        <input type="text" id="username" placeholder="Ваше имя">
        <input type="text" id="recipient" placeholder="Кому отправить">
    </div>

    <textarea id="message" placeholder="Введите сообщение или пакет для расшифровки..."></textarea>

    <div class="button-group">
        <button onclick="encryptMessage()">🔒 Зашифровать</button>
        <button onclick="decryptMessage()">🔓 Расшифровать</button>
        <button onclick="exportMessages()">💾 Экспорт</button>
        <button onclick="clearMessages()">🧹 Очистить</button>
    </div>

    <div id="result"></div>

    <h2>📜 Переписка</h2>
    <ul id="chatList"></ul>

    <script src="strava.js"></script>
</body>
</html>
