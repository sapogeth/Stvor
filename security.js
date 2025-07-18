// security.js - Усовершенствованная криптография с детальным логированием
const CRYPTO_VERSION = "ASC-v3";
const AES_ALG = { name: "AES-GCM", length: 256 };
const ECDH_ALG = { name: "ECDH", namedCurve: "P-521" };
const SIGN_ALG = { name: "ECDSA", hash: "SHA-512" };
const KEY_DERIVATION_ALG = { name: "HKDF", hash: "SHA-512" };

// Расширенное логирование
function logCryptoOperation(operation, success = true, details = "") {
    const timestamp = new Date().toISOString();
    const status = success ? "УСПЕХ" : "ОШИБКА";
    console.log(`[${timestamp}] [${operation}] ${status} ${details}`);
}

// Генерация ключевой пары пользователя
async function generateUserKeys() {
    try {
        console.time("KeyGeneration");
        
        // Генерация ключей с промежуточными проверками
        const encryptionKey = await crypto.subtle.generateKey(
            ECDH_ALG,
            true,
            ["deriveKey"]
        ).catch(err => {
            logCryptoOperation("GenerateEncryptionKey", false, err.message);
            throw new Error("Ошибка генерации ключа шифрования");
        });
        
        const signingKey = await crypto.subtle.generateKey(
            SIGN_ALG,
            true,
            ["sign", "verify"]
        ).catch(err => {
            logCryptoOperation("GenerateSigningKey", false, err.message);
            throw new Error("Ошибка генерации ключа подписи");
        });
        
        // Проверка наличия ключей
        if (!encryptionKey.privateKey || !signingKey.privateKey) {
            throw new Error("Сгенерированные ключи недействительны");
        }
        
        logCryptoOperation("KeyGeneration", true);
        console.timeEnd("KeyGeneration");
        
        return {
            encryptionKeyPair: encryptionKey,
            signingKeyPair: signingKey
        };
    } catch (error) {
        logCryptoOperation("KeyGeneration", false, error.message);
        throw new Error("Критическая ошибка генерации ключей: " + error.message);
    }
}

// Экспорт публичного ключа
async function exportPublicKey(key) {
    try {
        const exported = await crypto.subtle.exportKey("spki", key);
        logCryptoOperation("ExportPublicKey", true);
        return arrayBufferToBase64(exported);
    } catch (error) {
        logCryptoOperation("ExportPublicKey", false, error.message);
        throw new Error("Ошибка экспорта ключа: " + error.message);
    }
}

// Импорт публичного ключа
async function importPublicKey(base64Key) {
    try {
        const keyData = base64ToArrayBuffer(base64Key);
        const key = await crypto.subtle.importKey(
            "spki",
            keyData,
            ECDH_ALG,
            true,
            ["deriveKey"]
        );
        
        logCryptoOperation("ImportPublicKey", true);
        return key;
    } catch (error) {
        logCryptoOperation("ImportPublicKey", false, error.message);
        throw new Error("Ошибка импорта ключа: " + error.message);
    }
}

// Импорт ключа подписи
async function importSigningKey(base64Key) {
    try {
        const keyData = base64ToArrayBuffer(base64Key);
        const key = await crypto.subtle.importKey(
            "spki",
            keyData,
            SIGN_ALG,
            true,
            ["verify"]
        );
        
        logCryptoOperation("ImportSigningKey", true);
        return key;
    } catch (error) {
        logCryptoOperation("ImportSigningKey", false, error.message);
        throw new Error("Ошибка импорта ключа подписи: " + error.message);
    }
}

// Установка защищенной сессии
async function establishSecureSession(myPrivateKey, theirPublicKey) {
    try {
        // Проверка входных параметров
        if (!myPrivateKey || !theirPublicKey) {
            throw new Error("Невалидные ключи для установки сессии");
        }
        
        const baseKey = await crypto.subtle.deriveKey(
            { name: "ECDH", public: theirPublicKey },
            myPrivateKey,
            { ...KEY_DERIVATION_ALG, salt: new Uint8Array(), info: new TextEncoder().encode("ASC-KEM") },
            false,
            ["deriveKey"]
        ).catch(err => {
            logCryptoOperation("DeriveBaseKey", false, err.message);
            throw new Error("Ошибка получения базового ключа");
        });

        const sessionKey = await crypto.subtle.deriveKey(
            { ...KEY_DERIVATION_ALG, salt: crypto.getRandomValues(new Uint8Array(32)), info: new TextEncoder().encode("SessionKey") },
            baseKey,
            AES_ALG,
            false,
            ["encrypt", "decrypt"]
        ).catch(err => {
            logCryptoOperation("DeriveSessionKey", false, err.message);
            throw new Error("Ошибка получения сессионного ключа");
        });
        
        logCryptoOperation("EstablishSession", true);
        return sessionKey;
    } catch (error) {
        logCryptoOperation("EstablishSession", false, error.message);
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
        ).catch(err => {
            logCryptoOperation("EncryptContent", false, err.message);
            throw new Error("Ошибка шифрования содержимого");
        });
        
        const signature = await crypto.subtle.sign(
            SIGN_ALG,
            signingKey,
            ciphertext
        ).catch(err => {
            logCryptoOperation("SignContent", false, err.message);
            throw new Error("Ошибка подписи содержимого");
        });
        
        logCryptoOperation("EncryptMessage", true, `Длина: ${message.length} байт`);
        
        return arrayBufferToBase64(new Uint8Array([
            ...new TextEncoder().encode(CRYPTO_VERSION),
            ...iv,
            ...new Uint8Array(signature),
            ...new Uint8Array(ciphertext)
        ]));
    } catch (error) {
        logCryptoOperation("EncryptMessage", false, error.message);
        throw new Error("Ошибка шифрования сообщения: " + error.message);
    }
}

// Дешифровка сообщения
async function decryptMessage(sessionKey, base64Packet, publicKey) {
    try {
        const packet = base64ToArrayBuffer(base64Packet);
        const version = new TextDecoder().decode(packet.slice(0, CRYPTO_VERSION.length));
        if (version !== CRYPTO_VERSION) {
            throw new Error(`Неверная версия протокола: ${version} (ожидалось ${CRYPTO_VERSION})`);
        }
        
        const iv = packet.slice(CRYPTO_VERSION.length, CRYPTO_VERSION.length + 12);
        const signature = packet.slice(CRYPTO_VERSION.length + 12, CRYPTO_VERSION.length + 132);
        const ciphertext = packet.slice(CRYPTO_VERSION.length + 132);
        
        const valid = await crypto.subtle.verify(
            SIGN_ALG,
            publicKey,
            signature,
            ciphertext
        ).catch(err => {
            logCryptoOperation("VerifySignature", false, err.message);
            throw new Error("Ошибка проверки подписи");
        });
        
        if (!valid) {
            throw new Error("Недействительная подпись сообщения");
        }
        
        const plaintext = await crypto.subtle.decrypt(
            { ...AES_ALG, iv },
            sessionKey,
            ciphertext
        ).catch(err => {
            logCryptoOperation("DecryptContent", false, err.message);
            throw new Error("Ошибка дешифровки содержимого");
        });
        
        logCryptoOperation("DecryptMessage", true, `Длина: ${plaintext.byteLength} байт`);
        return new TextDecoder().decode(plaintext);
    } catch (error) {
        logCryptoOperation("DecryptMessage", false, error.message);
        throw new Error("Ошибка дешифровки сообщения: " + error.message);
    }
}

// Генерация отпечатка ключа
async function getKeyFingerprint(key) {
    try {
        const exported = await crypto.subtle.exportKey("spki", key);
        const hash = await crypto.subtle.digest("SHA-256", exported);
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join(':').substring(0, 24);
    } catch (error) {
        logCryptoOperation("KeyFingerprint", false, error.message);
        return "unknown";
    }
}

// Безопасное хранилище ключей
const keyStorage = {
    save: async function(keys, userId) {
        try {
            if (!keys.encryptionKeyPair.privateKey || !keys.signingKeyPair.privateKey) {
                throw new Error("Попытка сохранить неполные ключи");
            }
            
            const encryptionPrivate = await crypto.subtle.exportKey("pkcs8", keys.encryptionKeyPair.privateKey);
            const signingPrivate = await crypto.subtle.exportKey("pkcs8", keys.signingKeyPair.privateKey);
            
            const vault = {
                encryptionPrivate: arrayBufferToBase64(encryptionPrivate),
                signingPrivate: arrayBufferToBase64(signingPrivate)
            };
            
            localStorage.setItem(`cryptoVault_${userId}`, JSON.stringify(vault));
            logCryptoOperation("KeyStorageSave", true, `Для пользователя: ${userId}`);
        } catch (error) {
            logCryptoOperation("KeyStorageSave", false, error.message);
            throw new Error("Ошибка сохранения ключей: " + error.message);
        }
    },
    
    load: async function(userId) {
        try {
            const vaultStr = localStorage.getItem(`cryptoVault_${userId}`);
            if (!vaultStr) {
                logCryptoOperation("KeyStorageLoad", false, "Ключи не найдены");
                return null;
            }
            
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
            
            logCryptoOperation("KeyStorageLoad", true, `Для пользователя: ${userId}`);
            
            return {
                encryptionKeyPair: {
                    privateKey: encryptionPrivateKey
                },
                signingKeyPair: {
                    privateKey: signingPrivateKey
                }
            };
        } catch (error) {
            logCryptoOperation("KeyStorageLoad", false, error.message);
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
    getKeyFingerprint,
    logCryptoOperation
};
