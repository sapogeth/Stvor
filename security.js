// security.js - Совместимая и безопасная криптография
const CRYPTO_VERSION = "ASC-v1";
const AES_ALG = { name: "AES-GCM", length: 256 };
const ECDH_ALG = { name: "ECDH", namedCurve: "P-256" };
const SIGN_ALG = { name: "ECDSA", hash: {name: "SHA-256"} };
const KEY_DERIVATION_ALG = { name: "HKDF", hash: "SHA-256" };

// Генерация ключевой пары пользователя
async function generateUserKeys() {
    try {
        console.log("Начало генерации ключей...");
        
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
        
        console.log("Ключи успешно сгенерированы");
        return {
            encryptionKeyPair: encryptionKey,
            signingKeyPair: signingKey
        };
    } catch (error) {
        console.error("Ошибка генерации ключей:", error);
        throw new Error("Ошибка генерации ключей: " + error.message);
    }
}

// Экспорт публичного ключа
async function exportPublicKey(key) {
    try {
        const exported = await crypto.subtle.exportKey("spki", key);
        return arrayBufferToBase64(exported);
    } catch (error) {
        console.error("Ошибка экспорта ключа:", error);
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
        console.error("Ошибка импорта ключа:", error);
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
        console.error("Ошибка импорта ключа подписи:", error);
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
                info: new TextEncoder().encode("ASC-SessionKey")
            },
            baseKey,
            AES_ALG,
            false,
            ["encrypt", "decrypt"]
        );
    } catch (error) {
        console.error("Ошибка установки сессии:", error);
        throw new Error("Ошибка установки сессии: " + error.message);
    }
}

// Шифрование сообщения
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
        
        const signature = await crypto.subtle.sign(
            SIGN_ALG,
            signingKey,
            ciphertext
        );
        
        return arrayBufferToBase64(new Uint8Array([
            ...iv,
            ...new Uint8Array(signature),
            ...new Uint8Array(ciphertext)
        ]));
    } catch (error) {
        console.error("Ошибка шифрования сообщения:", error);
        throw new Error("Ошибка шифрования сообщения");
    }
}

// Дешифровка сообщения
async function decryptMessage(sessionKey, base64Packet, publicKey) {
    try {
        const packet = base64ToArrayBuffer(base64Packet);
        const iv = packet.slice(0, 12);
        const signature = packet.slice(12, 12 + 64);
        const ciphertext = packet.slice(12 + 64);
        
        const valid = await crypto.subtle.verify(
            SIGN_ALG,
            publicKey,
            signature,
            ciphertext
        );
        
        if (!valid) {
            throw new Error("Недействительная подпись");
        }
        
        const plaintext = await crypto.subtle.decrypt(
            { ...AES_ALG, iv },
            sessionKey,
            ciphertext
        );
        
        return new TextDecoder().decode(plaintext);
    } catch (error) {
        console.error("Ошибка дешифровки сообщения:", error);
        throw new Error("Ошибка дешифровки сообщения");
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
        console.error("Ошибка генерации отпечатка:", error);
        return "unknown";
    }
}

// Хранилище ключей
const keyStorage = {
    save: async function(keys, userId) {
        try {
            const encryptionPrivate = await crypto.subtle.exportKey("pkcs8", keys.encryptionKeyPair.privateKey);
            const signingPrivate = await crypto.subtle.exportKey("pkcs8", keys.signingKeyPair.privateKey);
            
            const vault = {
                encryptionPrivate: arrayBufferToBase64(encryptionPrivate),
                signingPrivate: arrayBufferToBase64(signingPrivate)
            };
            
            localStorage.setItem(`cryptoVault_${userId}`, JSON.stringify(vault));
            return true;
        } catch (error) {
            console.error("Ошибка сохранения ключей:", error);
            return false;
        }
    },
    
    load: async function(userId) {
        try {
            const vaultStr = localStorage.getItem(`cryptoVault_${userId}`);
            if (!vaultStr) return null;
            
            const vault = JSON.parse(vaultStr);
            
            const encryptionPrivateKey = await crypto.subtle.importKey(
                "pkcs8",
                base64ToArrayBuffer(vault.encryptionPrivate),
                ECDH_ALG,
                true,
                ["deriveKey"]
            );
            
            const signingPrivateKey = await crypto.subtle.importKey(
                "pkcs8",
                base64ToArrayBuffer(vault.signingPrivate),
                SIGN_ALG,
                true,
                ["sign"]
            );
            
            return {
                encryptionKeyPair: {
                    privateKey: encryptionPrivateKey
                },
                signingKeyPair: {
                    privateKey: signingPrivateKey
                }
            };
        } catch (error) {
            console.error("Ошибка загрузки ключей:", error);
            return null;
        }
    }
};

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
