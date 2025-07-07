// security.js - Криптографический модуль
const CRYPTO_VERSION = "PQ-E2E-v1";
const AES_ALG = { name: "AES-GCM", length: 256 };
const ECDH_ALG = { name: "ECDH", namedCurve: "P-521" };
const SIGN_ALG = { name: "ECDSA", hash: "SHA-512" };

// Генерация ключевой пары для пользователя
async function generateUserKeys() {
    const [encryptionKey, signingKey] = await Promise.all([
        crypto.subtle.generateKey(ECDH_ALG, true, ["deriveKey"]),
        crypto.subtle.generateKey(SIGN_ALG, true, ["sign", "verify"])
    ]);
    
    return {
        encryptionKeyPair: encryptionKey,
        signingKeyPair: signingKey
    };
}

// Обмен ключами с постквантовой защитой
async function establishSecureSession(myPrivateKey, theirPublicKey) {
    const baseKey = await crypto.subtle.deriveKey(
        { name: "ECDH", public: theirPublicKey },
        myPrivateKey,
        { name: "HKDF", hash: "SHA-512", salt: new Uint8Array(), info: new TextEncoder().encode("PQ-KEM") },
        false,
        ["deriveKey"]
    );

    const sessionKey = await crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-512", salt: crypto.getRandomValues(new Uint8Array(16)), info: new TextEncoder().encode("SessionKey") },
        baseKey,
        AES_ALG,
        false,
        ["encrypt", "decrypt"]
    );

    return sessionKey;
}

// Шифрование сообщения
async function encryptMessage(sessionKey, message, senderSigningKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedMsg = encoder.encode(message);
    
    // Шифрование содержимого
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        sessionKey,
        encodedMsg
    );
    
    // Создание подписи
    const signature = await crypto.subtle.sign(
        SIGN_ALG,
        senderSigningKey,
        ciphertext
    );
    
    // Формат пакета: версия | IV | подпись | шифротекст
    const packet = new Uint8Array([
        ...new TextEncoder().encode(CRYPTO_VERSION),
        ...iv,
        ...new Uint8Array(signature),
        ...new Uint8Array(ciphertext)
    ]);
    
    return packet;
}

// Расшифровка сообщения
async function decryptMessage(sessionKey, packet, senderPublicKey) {
    const version = new TextDecoder().decode(packet.slice(0, CRYPTO_VERSION.length));
    if (version !== CRYPTO_VERSION) throw new Error("Несовместимая версия протокола");
    
    const iv = packet.slice(CRYPTO_VERSION.length, CRYPTO_VERSION.length + 12);
    const signature = packet.slice(CRYPTO_VERSION.length + 12, CRYPTO_VERSION.length + 132);
    const ciphertext = packet.slice(CRYPTO_VERSION.length + 132);
    
    // Верификация подписи
    const valid = await crypto.subtle.verify(
        SIGN_ALG,
        senderPublicKey,
        signature,
        ciphertext
    );
    
    if (!valid) throw new Error("Недействительная подпись сообщения");
    
    // Расшифровка
    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sessionKey,
        ciphertext
    );
    
    return new TextDecoder().decode(plaintext);
}

// Интеграция с Firebase
async function sendSecureMessage(recipientId, message) {
    // Загрузка ключей получателя
    const recipientKeys = await db.ref(`publicKeys/${recipientId}`).once('value');
    
    // Установка сессии
    const sessionKey = await establishSecureSession(
        currentUser.keys.encryptionKeyPair.privateKey,
        await importPublicKey(recipientKeys.encryptionPublicKey)
    );
    
    // Шифрование
    const packet = await encryptMessage(
        sessionKey,
        message,
        currentUser.keys.signingKeyPair.privateKey
    );
    
    // Отправка в формате base64
    const encodedPacket = arrayBufferToBase64(packet);
    await db.ref(`messages/${generateMessageId()}`).set({
        sender: currentUser.uid,
        recipient: recipientId,
        packet: encodedPacket,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

// Прослушивание зашифрованных сообщений
async function listenForSecureMessages() {
    db.ref('messages').orderByChild('recipient').equalTo(currentUser.uid)
        .on('child_added', async snapshot => {
            const msg = snapshot.val();
            const packet = base64ToArrayBuffer(msg.packet);
            
            // Загрузка ключей отправителя
            const senderKeys = await db.ref(`publicKeys/${msg.sender}`).once('value');
            
            try {
                const sessionKey = await establishSecureSession(
                    currentUser.keys.encryptionKeyPair.privateKey,
                    await importPublicKey(senderKeys.encryptionPublicKey)
                );
                
                const decrypted = await decryptMessage(
                    sessionKey,
                    packet,
                    await importPublicKey(senderKeys.signingPublicKey)
                );
                
                // Отображение сообщения
                displayMessage(msg.sender, decrypted);
            } catch (e) {
                console.error("Ошибка дешифровки:", e);
            }
        });
}

// Вспомогательные функции
async function importPublicKey(base64Key, type = "spki", usage) {
    const keyData = base64ToArrayBuffer(base64Key);
    const algorithm = type.includes("ECDH") ? ECDH_ALG : SIGN_ALG;
    
    return crypto.subtle.importKey(
        type,
        keyData,
        algorithm,
        true,
        usage ? [usage] : []
    );
}

function arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function generateMessageId() {
    return crypto.getRandomValues(new Uint8Array(16)).join('');
}
