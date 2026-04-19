const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const generateMfaSecret = async (username) => {
    const secret = speakeasy.generateSecret({
        name: `ToDoApp (${username})`
    });
    
    // Generate QR Code data URL
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    
    return {
        ascii: secret.ascii,
        hex: secret.hex,
        base32: secret.base32,
        otpauth_url: secret.otpauth_url,
        qrCodeUrl
    };
};

const verifyMfaToken = (secret, token) => {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1 // Allow 1 step (30 seconds) tolerance
    });
};

module.exports = {
    generateMfaSecret,
    verifyMfaToken
};
