<!-- stvor.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Chat — Ilyazh Encrypt</title>
    <link rel="stylesheet" href="stvor.css">
    <!-- Подключаем Firebase -->
    <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔐 Secure Chat</h1>
            <p class="subtitle">End-to-End Encrypted Messaging</p>
        </header>

        <div class="card">
            <div class="input-group">
                <label for="username">Ваше имя</label>
                <input type="text" id="username" placeholder="Введите ваше имя">
                <label for="recipient">Получатель</label>
                <input type="text" id="recipient" placeholder="Кому отправить">
            </div>

            <div class="message-container">
                <label for="message">Сообщение</label>
                <textarea id="message" placeholder="Введите сообщение или пакет для расшифровки..."></textarea>
            </div>

            <div class="button-group">
                <button class="btn-primary" onclick="encryptMessage()">
                    <span class="icon">🔒</span> Зашифровать
                </button>
                <button class="btn-secondary" onclick="decryptMessage()">
                    <span class="icon">🔓</span> Расшифровать
                </button>
                <button class="btn-export" onclick="exportMessages()">
                    <span class="icon">💾</span> Экспорт
                </button>
                <button class="btn-import" onclick="importMessages()">
                    <span class="icon">📥</span> Импорт
                </button>
                <button class="btn-danger" onclick="clearMessages()">
                    <span class="icon">🧹</span> Очистить
                </button>
            </div>
        </div>

        <div class="card result-card">
            <h3>Результат</h3>
            <div id="result"></div>
        </div>

        <div class="card chat-card">
            <div class="chat-header">
                <h3>📜 История переписки</h3>
                <div class="search-container">
                    <input type="text" id="searchInput" placeholder="Поиск...">
                    <button onclick="searchMessages()">🔍</button>
                </div>
            </div>
            <ul id="chatList"></ul>
        </div>

        <footer>
            <p>Secure Chat v1.0 | End-to-End Encryption</p>
        </footer>
    </div>

    <script src="stvor.js"></script>
</body>
</html>
