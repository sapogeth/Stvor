<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Strava Chat — Ilyazh Encrypt</title>
    <link rel="stylesheet" href="strava.css">
</head>
<body>
    <h1>🔐 Stravaр</h1>

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
