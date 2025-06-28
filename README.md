
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Strava - Социальный шифратор</title>
    <link rel="stylesheet" href="strava.css">
</head>
<body>
    <h1>📡 Strava</h1>
    <input type="text" id="username" placeholder="Ваше имя" disabled>
    <input type="text" id="recipient" placeholder="Кому">
    <textarea id="message" placeholder="Введите сообщение..."></textarea>
    <div class="buttons">
        <button onclick="encryptMessage()">Зашифровать</button>
        <button onclick="decryptMessage()">Расшифровать</button>
        <button onclick="exportMessages()">Экспорт</button>
        <button onclick="clearMessages()">Очистить</button>
    </div>
    <div id="result"></div>
    <ul id="chatList"></ul>

    <!-- Firebase и основной JS -->
    <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>
    <script src="strava.js"></script>
</body>
</html>
