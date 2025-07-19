const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.,:;@#%^&*()-_=+[]{}<>/|\\\'"`~ \n\t'];
const CRYPTO_VERSION = "ASC-v1";
const AES_ALG = { name: "AES-GCM", length: 256 };
const ECDH_ALG = { 
    name: "ECDH", 
    namedCurve: "P-256"
};
const SIGN_ALG = { 
    name: "ECDSA", 
    hash: {name: "SHA-256"},
    namedCurve: "P-256"
};

function getAlphabetIndex(char) {
    return alphabet.indexOf(char);
}

function generateKey(userId, timestamp, salt) {
    const input = `${userId}-${timestamp}-${salt}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    return crypto.subtle.digest("SHA-512", data)
        .then(hashBuffer => {
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(byte => alphabet[byte % alphabet.length]).join('');
        });
}

function ilyazhEncrypt(plaintext, key) {
    let encrypted = '';
    for (let i = 0; i < plaintext.length; ++i) {
        const pChar = plaintext[i];
        const kChar = key[i % key.length];

        const pIndex = getAlphabetIndex(pChar);
        const kIndex = getAlphabetIndex(kChar);

        if (pIndex === -1 || kIndex === -1) {
            encrypted += pChar;
        } else {
            const eIndex = (pIndex + kIndex) % alphabet.length;
            let eChar = alphabet[eIndex];

            // Anti-repetition: если символ повторяется с предыдущим, сдвинь ещё
            if (i > 0 && eChar === encrypted[i - 1]) {
                eIndex = (eIndex + 1) % alphabet.length;
                eChar = alphabet[eIndex];
            }

            encrypted += eChar;
        }
    }
    return encrypted;
}

function ilyazhDecrypt(ciphertext, key) {
    let decrypted = '';
    for (let i = 0; i < ciphertext.length; i++) {
        let cChar = ciphertext[i];
        const kChar = key[i % key.length];

        let cIndex = getAlphabetIndex(cChar);
        const kIndex = getAlphabetIndex(kChar);

        if (cIndex === -1 || kIndex === -1) {
            decrypted += cChar;
        } else {
            // Anti-repetition (на дешифровке) — учёт смещения
            if (i > 0 && cChar === ciphertext[i - 1]) {
                cIndex = (cIndex - 1 + alphabet.length) % alphabet.length;
            }

            const dIndex = (cIndex - kIndex + alphabet.length) % alphabet.length;
            decrypted += alphabet[dIndex];
        }
    }
    return decrypted;
}


async function encryptMessageHybrid(sessionKey, message, signingKey) {
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // 1. Внутреннее шифрование (Ilyazh)
        const ilyazhEncrypted = ilyazhEncrypt(message);

        // 2. Шифрование AES-GCM
        const encoded = new TextEncoder().encode(ilyazhEncrypted);
        const ciphertext = await crypto.subtle.encrypt(
            { ...AES_ALG, iv },
            sessionKey,
            encoded
        );

        // 3. Подпись ECDSA
        const signature = await crypto.subtle.sign(
            SIGN_ALG,
            signingKey,
            ciphertext
        );

        // Формат пакета: IV (12B) + Подпись (64B) + Шифртекст
        return arrayBufferToBase64(new Uint8Array([
            ...iv,
            ...new Uint8Array(signature),
            ...new Uint8Array(ciphertext)
        ]));
    } catch (error) {
        console.error("Ошибка гибридного шифрования:", error);
        throw new Error("Hybrid encryption failed");
    }
}

// Гибридное дешифрование
async function decryptMessageHybrid(sessionKey, base64Packet, publicKey) {
    try {
        const packet = base64ToArrayBuffer(base64Packet);
        const iv = packet.slice(0, 12);
        const signature = packet.slice(12, 12 + 64); // 64-байтовая подпись ECDSA
        const ciphertext = packet.slice(12 + 64);

        // 1. Проверка подписи
        const valid = await crypto.subtle.verify(
            SIGN_ALG,
            publicKey,
            signature,
            ciphertext
        );
        if (!valid) throw new Error("Подпись недействительна");

        // 2. Дешифровка AES-GCM
        const decrypted = await crypto.subtle.decrypt(
            { ...AES_ALG, iv },
            sessionKey,
            ciphertext
        );

        // 3. Дешифровка Ilyazh
        const ilyazhDecrypted = ilyazhDecrypt(new TextDecoder().decode(decrypted));
        
        return ilyazhDecrypted;
    } catch (error) {
        console.error("Ошибка гибридной дешифровки:", error);
        throw new Error("Hybrid decryption failed");
    }
}

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
        console.error("Ошибка генерации ключей:", error);
        throw new Error("Ошибка генерации ключей: " + error.message);
    }
}

async function exportPublicKey(key) {
    try {
        const exported = await crypto.subtle.exportKey("spki", key);
        return arrayBufferToBase64(exported);
    } catch (error) {
        console.error("Ошибка экспорта ключа:", error);
        throw new Error("Ошибка экспорта ключа");
    }
}

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
    encryptMessageHybrid,    
    decryptMessageHybrid,    
    keyStorage,
    getKeyFingerprint
};
