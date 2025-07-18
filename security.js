// security.js - Криптографические функции
const CRYPTO_VERSION = "PQ-E2E-v2";
const AES_ALG = { name: "AES-GCM", length: 256 };
const ECDH_ALG = { name: "ECDH", namedCurve: "P-521" };
const SIGN_ALG = { name: "ECDSA", hash: "SHA-512" };
const KEY_DERIVATION_ALG = { name: "HKDF", hash: "SHA-512" };

// Генерация ключевой пары пользователя
async function generateUserKeys() {
    try {
        const [encryptionKey, signingKey] = await Promise.all([
            crypto.subtle.generateKey(ECDH_ALG, true, ["deriveKey"]),
            crypto.subtle.generateKey(SIGN_ALG, true, ["sign", "verify"])
        ]);
        
        return {
            encryptionKeyPair: encryptionKey,
            signingKeyPair: signingKey
        };
    } catch (error) {
        console.error("Key generation error:", error);
        throw new Error("Ошибка генерации ключей");
    }
}

// Экспорт публичного ключа
async function exportPublicKey(key) {
    const exported = await crypto.subtle.exportKey("spki", key);
    return arrayBufferToBase64(exported);
}

// Импорт публичного ключа
async function importPublicKey(base64Key) {
    const keyData = base64ToArrayBuffer(base64Key);
    return crypto.subtle.importKey(
        "spki",
        keyData,
        ECDH_ALG,
        true,
        ["deriveKey"]
    );
}

// Импорт ключа подписи
async function importSigningKey(base64Key) {
    const keyData = base64ToArrayBuffer(base64Key);
    return crypto.subtle.importKey(
        "spki",
        keyData,
        SIGN_ALG,
        true,
        ["verify"]
    );
}

// Установка защищенной сессии
async function establishSecureSession(myPrivateKey, theirPublicKey) {
    try {
        const baseKey = await crypto.subtle.deriveKey(
            { name: "ECDH", public: theirPublicKey },
            myPrivateKey,
            { ...KEY_DERIVATION_ALG, salt: new Uint8Array(), info: new TextEncoder().encode("PQ-KEM") },
            false,
            ["deriveKey"]
        );

        const sessionKey = await crypto.subtle.deriveKey(
            { 
                ...KEY_DERIVATION_ALG, 
                salt: crypto.getRandomValues(new Uint8Array(32)),
                info: new TextEncoder().encode("SessionKey-" + Date.now())
            },
            baseKey,
            AES_ALG,
            false,
            ["encrypt", "decrypt"]
        );
        
        return sessionKey;
    } catch (error) {
        console.error("Session establishment failed:", error);
        throw new Error("Ошибка установки безопасной сессии");
    }
}

// Шифрование сообщения
async function encryptMessage(sessionKey, message, signingKey) {
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const encodedMsg = encoder.encode(message);
        
        const additionalData = new TextEncoder().encode(
            `v=${CRYPTO_VERSION}&t=${Date.now()}`
        );
        
        const ciphertext = await crypto.subtle.encrypt(
            { 
                ...AES_ALG, 
                iv,
                additionalData
            },
            sessionKey,
            encodedMsg
        );
        
        const dataToSign = new Uint8Array([
            ...additionalData,
            ...new Uint8Array(ciphertext)
        ]);
        
        const signature = await crypto.subtle.sign(
            SIGN_ALG,
            signingKey,
            dataToSign
        );
        
        return arrayBufferToBase64(new Uint8Array([
            ...additionalData,
            ...iv,
            ...new Uint8Array(signature),
            ...new Uint8Array(ciphertext)
        ]));
    } catch (error) {
        console.error("Encryption failed:", error);
        throw new Error("Ошибка шифрования сообщения");
    }
}

// Дешифровка сообщения
async function decryptMessage(sessionKey, base64Packet, publicKey) {
    try {
        const packet = base64ToArrayBuffer(base64Packet);
        
        const versionData = new TextDecoder().decode(
            packet.slice(0, 30)
        );
        if (!versionData.includes(CRYPTO_VERSION)) {
            throw new Error("Unsupported protocol version");
        }
        
        const additionalData = packet.slice(0, 30);
        const iv = packet.slice(30, 42);
        const signature = packet.slice(42, 42 + 132);
        const ciphertext = packet.slice(42 + 132);
        
        const dataToVerify = new Uint8Array([
            ...new Uint8Array(additionalData),
            ...new Uint8Array(ciphertext)
        ]);
        
        const valid = await crypto.subtle.verify(
            SIGN_ALG,
            publicKey,
            signature,
            dataToVerify
        );
        
        if (!valid) throw new Error("Invalid message signature");
        
        const plaintext = await crypto.subtle.decrypt(
            { 
                ...AES_ALG, 
                iv,
                additionalData
            },
            sessionKey,
            ciphertext
        );
        
        return new TextDecoder().decode(plaintext);
    } catch (error) {
        console.error("Decryption failed:", error);
        throw new Error("Ошибка дешифровки сообщения");
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
        console.error("Fingerprint generation failed:", error);
        return "unknown";
    }
}

// Безопасное хранилище ключей
const keyStorage = {
    db: null,
    
    init: async function() {
        if (!this.db) {
            this.db = await new Promise((resolve, reject) => {
                const request = indexedDB.open("CryptoVaultDB", 1);
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('keys')) {
                        db.createObjectStore('keys', { keyPath: 'userId' });
                    }
                };
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return this.db;
    },
    
    save: async function(keys, userId) {
        try {
            const db = await this.init();
            const tx = db.transaction('keys', 'readwrite');
            const store = tx.objectStore('keys');
            
            const privateKeys = {
                encryptionPrivate: arrayBufferToBase64(
                    await crypto.subtle.exportKey("pkcs8", keys.encryptionKeyPair.privateKey)
                ),
                signingPrivate: arrayBufferToArrayBuffer(
                    await crypto.subtle.exportKey("pkcs8", keys.signingKeyPair.privateKey)
                )
            };
            
            await store.put({ userId, keys: privateKeys });
            return new Promise(resolve => tx.oncomplete = resolve);
        } catch (error) {
            console.error("Key save error:", error);
            throw new Error("Ошибка сохранения ключей");
        }
    },
    
    load: async function(userId) {
        try {
            const db = await this.init();
            const tx = db.transaction('keys', 'readonly');
            const store = tx.objectStore('keys');
            const request = store.get(userId);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = async () => {
                    if (!request.result) {
                        resolve(null);
                        return;
                    }
                    
                    const vault = request.result.keys;
                    try {
                        resolve({
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
                        });
                    } catch (importError) {
                        console.error("Key import error:", importError);
                        resolve(null);
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
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
