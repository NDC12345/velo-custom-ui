const crypto = require('crypto');

// AES-256-GCM configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Get encryption key from environment (must be 32 bytes hex string = 64 characters)
const getEncryptionKey = () => {
    const key = process.env.VELO_CREDENTIALS_ENCRYPTION_KEY;
    
    if (!key) {
        throw new Error('VELO_CREDENTIALS_ENCRYPTION_KEY environment variable is not set');
    }
    
    if (key.length !== 64) {
        throw new Error('VELO_CREDENTIALS_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    
    return Buffer.from(key, 'hex');
};

/**
 * Encrypt a credential using AES-256-GCM
 * @param {string} plaintext - The credential to encrypt
 * @returns {Object} - { encrypted, iv, authTag } all as hex strings
 */
function encryptCredential(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext must be a non-empty string');
    }
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

/**
 * Decrypt a credential using AES-256-GCM
 * @param {string} encrypted - The encrypted data (hex string)
 * @param {string} iv - The initialization vector (hex string)
 * @param {string} authTag - The authentication tag (hex string)
 * @returns {string} - The decrypted plaintext
 */
function decryptCredential(encrypted, iv, authTag) {
    if (!encrypted || !iv || !authTag) {
        throw new Error('Encrypted data, IV, and auth tag are required');
    }
    
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/**
 * Generate a random encryption key (for setup/testing)
 * @returns {string} - 64 character hex string (32 bytes)
 */
function generateEncryptionKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

module.exports = {
    encryptCredential,
    decryptCredential,
    generateEncryptionKey,
    ALGORITHM,
    KEY_LENGTH,
};
