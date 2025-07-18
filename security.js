// security.js - Исправленная версия
const CRYPTO_VERSION = "PQ-E2E-v2";
const AES_ALG = { name: "AES-GCM", length: 256 };
const ECDH_ALG = { name: "ECDH", namedCurve: "P-384" }; // Исправлено на P-384 для лучшей совместимости
const SIGN_ALG = { name: "ECDSA", hash: "SHA-384" }; // Исправлено на SHA-384
const KEY_DERIVATION_ALG = { name: "HKDF", hash: "SHA-256" }; // Упрощено для совместимости

// Генерация ключевой пары пользователя
async function generateUserKeys() {
    try {
        const encryptionKey = await crypto.subtle.generateKey(
            ECDH_ALG, 
            true, 
            ["deriveKey"]
        );
        
        const signingKey = await crypto.subtle.generateKey(
            SIGN_ALG, 
            true, 
            ["sign", "verify"]
        );
        
        return {
            encryptionKeyPair: encryptionKey,
            signingKeyPair: signingKey
        };
    } catch (error) {
        console.error("Key generation error:", error);
        throw new Error("Ошибка генерации ключей: " + error.message);
    }
}

// Экспорт публичного ключа
async function exportPublicKey(key) {
    try {
        const exported = await crypto.subtle.exportKey("spki", key);
        return arrayBufferToBase64(exported);
    } catch (error) {
        console.error("Export public key error:", error);
        throw new Error("Ошибка экспорта ключа");
    }
}

// Импорт публичного ключа
async function importPublicKey(base64Key) {
    try {
        const keyData = base64ToArrayBuffer(base64Key);
        return crypto.subtle.importKey(
            "spki",
            keyData,
            ECDH_ALG,
            true,
            ["deriveKey"]
        );
    } catch (error) {
        console.error("Import public key error:", error);
        throw new Error("Ошибка импорта ключа");
    }
}

// Импорт ключа подписи
async function importSigningKey(base64Key) {
    try {
        const keyData = base64ToArrayBuffer(base64Key);
        return crypto.subtle.importKey(
            "spki",
            keyData,
            SIGN_ALG,
            true,
            ["verify"]
        );
    } catch (error) {
        console.error("Import signing key error:", error);
        throw new Error("Ошибка импорта ключа подписи");
    }
}

// Установка защищенной сессии
async function establishSecureSession(myPrivateKey, theirPublicKey) {
    try {
        const baseKey = await crypto.subtle.deriveKey(
            { name: "ECDH", public: theirPublicKey },
            myPrivateKey,
            { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: new Uint8Array() },
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            { 
                name: "HKDF", 
                hash: "SHA-256",
                salt: crypto.getRandomValues(new Uint8Array(16)), 
                info: new TextEncoder().encode("SessionKey")
            },
            baseKey,
            AES_ALG,
            false,
            ["encrypt", "decrypt"]
        );
    } catch (error) {
        console.error("Session establishment failed:", error);
        throw new Error("Ошибка установки сессии: " + error.message);
    }
}

// Шифрование сообщения (упрощенная версия)
async function encryptMessage(sessionKey, message, signingKey) {
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const encodedMsg = encoder.encode(message);
        
        const ciphertext = await crypto.subtle.encrypt(
            { ...AES_ALG, iv },
            sessionKey,
            encodedMsg
        );
        
        return arrayBufferToBase64(new Uint8Array([
            ...iv,
            ...new Uint8Array(ciphertext)
        ]));
    } catch (error) {
        console.error("Encryption failed:", error);
        throw new Error("Ошибка шифрования: " + error.message);
    }
}

// Дешифровка сообщения (упрощенная версия)
async function decryptMessage(sessionKey, base64Packet) {
    try {
        const packet = base64ToArrayBuffer(base64Packet);
        const iv = packet.slice(0, 12);
        const ciphertext = packet.slice(12);
        
        const plaintext = await crypto.subtle.decrypt(
            { ...AES_ALG, iv },
            sessionKey,
            ciphertext
        );
        
        return new TextDecoder().decode(plaintext);
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Ошибка дешифровки: " + error.message);
    }
}

// Генерация отпечатка ключа
async function getKeyFingerprint(key) {
    try {
        const exported = await crypto.subtle.exportKey("spki", key);
        const hash = await crypto.subtle.digest("SHA-256", exported);
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray.slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join(':');
    } catch (error) {
        console.error("Fingerprint generation failed:", error);
        return "unknown";
    }
}

// Хранилище ключей в localStorage (упрощенное)
const keyStorage = {
    save: async function(keys, userId) {
        try {
            const vault = {
                encryptionPrivate: arrayBufferToBase64(
                    await crypto.subtle.exportKey("pkcs8", keys.encryptionKeyPair.privateKey)
                ),
                signingPrivate: arrayBufferToBase64(
                    await crypto.subtle.exportKey("pkcs8", keys.signingKeyPair.privateKey)
                )
            };
            
            localStorage.setItem(`cryptoVault_${userId}`, JSON.stringify(vault));
        } catch (error) {
            console.error("Key save error:", error);
            throw new Error("Ошибка сохранения ключей");
        }
    },
    
    load: async function(userId) {
        try {
            const vaultStr = localStorage.getItem(`cryptoVault_${userId}`);
            if (!vaultStr) return null;
            
            const vault = JSON.parse(vaultStr);
            return {
                encryptionKeyPair: {
                    privateKey: await crypto.subtle.importKey(
                        "pkcs8",
                        base64ToArrayBuffer(vault.encryptionPrivate),
                        ECDH_ALG,
                        true,
                        ["deriveKey"]
                    )
                },
                signingKeyPair: {
                    privateKey: await crypto.subtle.importKey(
                        "pkcs8",
                        base64ToArrayBuffer(vault.signingPrivate),
                        SIGN_ALG,
                        true,
                        ["sign"]
                    )
                }
            };
        } catch (error) {
            console.error("Key load error:", error);
            return null;
        }
    }
};

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

// Экспорт функций
export { 
    generateUserKeys, 
    exportPublicKey, 
    importPublicKey,
    importSigningKey,
    establishSecureSession, 
    encryptMessage, 
    decryptMessage,
    keyStorage,
    getKeyFingerprint
};
