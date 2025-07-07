// security.js - Modern End-to-End Encryption
const CRYPTO_VERSION = "PQ-E2E-v1";
const AES_ALG = { name: "AES-GCM", length: 256 };
const ECDH_ALG = { name: "ECDH", namedCurve: "P-521" };
const SIGN_ALG = { name: "ECDSA", hash: "SHA-512" };
const KEY_DERIVATION_ALG = { name: "HKDF", hash: "SHA-512" };

// Генерация ключевой пары пользователя
export async function generateUserKeys() {
    const [encryptionKey, signingKey] = await Promise.all([
        crypto.subtle.generateKey(ECDH_ALG, true, ["deriveKey"]),
        crypto.subtle.generateKey(SIGN_ALG, true, ["sign", "verify"])
    ]);
    
    return {
        encryptionKeyPair: encryptionKey,
        signingKeyPair: signingKey
    };
}

// Экспорт публичного ключа
export async function exportPublicKey(key) {
    const exported = await crypto.subtle.exportKey("spki", key);
    return arrayBufferToBase64(exported);
}

// Импорт публичного ключа
export async function importPublicKey(base64Key, type = "spki", algorithm = ECDH_ALG) {
    const keyData = base64ToArrayBuffer(base64Key);
    return crypto.subtle.importKey(
        type,
        keyData,
        algorithm,
        true,
        ["deriveKey"]
    );
}

// Установка защищенной сессии
export async function establishSecureSession(myPrivateKey, theirPublicKey) {
    const baseKey = await crypto.subtle.deriveKey(
        { name: "ECDH", public: theirPublicKey },
        myPrivateKey,
        { ...KEY_DERIVATION_ALG, salt: new Uint8Array(), info: new TextEncoder().encode("PQ-KEM") },
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        { ...KEY_DERIVATION_ALG, salt: crypto.getRandomValues(new Uint8Array(16)), info: new TextEncoder().encode("SessionKey") },
        baseKey,
        AES_ALG,
        false,
        ["encrypt", "decrypt"]
    );
}

// Шифрование сообщения
export async function encryptMessage(sessionKey, message, signingKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedMsg = encoder.encode(message);
    
    const ciphertext = await crypto.subtle.encrypt(
        { ...AES_ALG, iv },
        sessionKey,
        encodedMsg
    );
    
    const signature = await crypto.subtle.sign(
        SIGN_ALG,
        signingKey,
        ciphertext
    );
    
    return arrayBufferToBase64(new Uint8Array([
        ...new TextEncoder().encode(CRYPTO_VERSION),
        ...iv,
        ...new Uint8Array(signature),
        ...new Uint8Array(ciphertext)
    ]));
}

// Дешифровка сообщения
export async function decryptMessage(sessionKey, base64Packet, publicKey) {
    const packet = base64ToArrayBuffer(base64Packet);
    const version = new TextDecoder().decode(packet.slice(0, CRYPTO_VERSION.length));
    if (version !== CRYPTO_VERSION) throw new Error("Unsupported protocol version");
    
    const iv = packet.slice(CRYPTO_VERSION.length, CRYPTO_VERSION.length + 12);
    const signature = packet.slice(CRYPTO_VERSION.length + 12, CRYPTO_VERSION.length + 132);
    const ciphertext = packet.slice(CRYPTO_VERSION.length + 132);
    
    const valid = await crypto.subtle.verify(
        SIGN_ALG,
        publicKey,
        signature,
        ciphertext
    );
    if (!valid) throw new Error("Invalid message signature");
    
    const plaintext = await crypto.subtle.decrypt(
        { ...AES_ALG, iv },
        sessionKey,
        ciphertext
    );
    
    return new TextDecoder().decode(plaintext);
}

// Вспомогательные функции
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

// Безопасное хранилище ключей
export const keyStorage = {
    save: async (keys, userId) => {
        const vault = {
            encryptionPrivate: await crypto.subtle.exportKey("pkcs8", keys.encryptionKeyPair.privateKey),
            signingPrivate: await crypto.subtle.exportKey("pkcs8", keys.signingKeyPair.privateKey)
        };
        localStorage.setItem(`cryptoVault_${userId}`, JSON.stringify(vault));
    },
    
    load: async (userId) => {
        const vault = JSON.parse(localStorage.getItem(`cryptoVault_${userId}`));
        if (!vault) return null;
        
        return {
            encryptionKeyPair: {
                privateKey: await crypto.subtle.importKey(
                    "pkcs8",
                    vault.encryptionPrivate,
                    ECDH_ALG,
                    true,
                    ["deriveKey"]
                )
            },
            signingKeyPair: {
                privateKey: await crypto.subtle.importKey(
                    "pkcs8",
                    vault.signingPrivate,
                    SIGN_ALG,
                    true,
                    ["sign"]
                )
            }
        };
    }
};
