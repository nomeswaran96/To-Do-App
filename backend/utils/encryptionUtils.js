const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

const getEncryptionKey = () => {
    const keyString = process.env.ENCRYPTION_KEY;
    if (!keyString || keyString.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
    }
    return Buffer.from(keyString, 'hex');
};

const encrypt = (text) => {
    if (!text) return text;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    
    let encryptedData = cipher.update(text, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${encryptedData}:${authTag}`;
};

const decrypt = (encryptedString) => {
    if (!encryptedString) return encryptedString;
    const parts = encryptedString.split(':');
    if (parts.length !== 3) return encryptedString;
    
    const [ivHex, encryptedData, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
};

module.exports = {
    encrypt,
    decrypt
};
