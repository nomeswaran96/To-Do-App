const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { redisClient } = require('../config/redisClient');
const { generateMfaSecret, verifyMfaToken } = require('../utils/mfaUtils');
const { encrypt, decrypt } = require('../utils/encryptionUtils');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const JWT_ISSUER = 'todo-app';
const JWT_AUDIENCE = 'todo-app-users';

const register = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

        const lookupKey = `user:lookup:${username}`;
        const existingUserId = await redisClient.get(lookupKey);

        if (existingUserId) return res.status(400).json({ message: 'Username already exists' });

        const userId = uuidv4();
        // Increase salt rounds to 12
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate MFA Setup
        const mfa = await generateMfaSecret(username);
        
        // Encrypt MFA Secret before saving
        const encryptedMfaSecret = encrypt(mfa.base32);

        await redisClient.set(lookupKey, userId);
        await redisClient.hSet(`user:${userId}`, {
            id: userId,
            username: username,
            passwordHash: passwordHash,
            mfaEnabled: 'false',
            mfaSecret: encryptedMfaSecret
        });

        // Generate a temporary JWT token for activating MFA right after registration
        const tempToken = jwt.sign(
            { id: userId, username: username }, 
            JWT_SECRET, 
            { expiresIn: '15m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
        );

        // For registration, we return the MFA QR code URL so user can set it up immediately.
        res.status(201).json({
            message: 'User registered successfully. Please scan the QR code to set up MFA.',
            userId,
            mfaQrCode: mfa.qrCodeUrl,
            mfaSecret: mfa.base32, // send raw text once for display only
            tempToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const login = async (req, res) => {
    try {
        const { username, password, token } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

        const userId = await redisClient.get(`user:lookup:${username}`);
        if (!userId) return res.status(401).json({ message: 'Invalid credentials' });

        const user = await redisClient.hGetAll(`user:${userId}`);
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        // MFA flow
        if (user.mfaEnabled === 'true') {
            if (!token) {
                return res.status(403).json({ message: 'MFA token required', mfaRequired: true });
            }
            // Decrypt MFA secret
            const decryptedSecret = decrypt(user.mfaSecret);
            const isTokenValid = verifyMfaToken(decryptedSecret, token);
            if (!isTokenValid) {
                return res.status(401).json({ message: 'Invalid MFA token' });
            }
        }
        // If mfaEnabled === 'false', just skip MFA check — user can enable it separately

        const jwtToken = jwt.sign(
            { id: user.id, username: user.username }, 
            JWT_SECRET, 
            { expiresIn: '1d', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
        );

        res.json({
            message: 'Login successful',
            token: jwtToken,
            user: { id: user.id, username: user.username, mfaEnabled: user.mfaEnabled === 'true' }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await redisClient.hGetAll(`user:${userId}`);
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({ id: user.id, username: user.username, mfaEnabled: user.mfaEnabled === 'true' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const enableMfa = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;
        const user = await redisClient.hGetAll(`user:${userId}`);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.mfaEnabled === 'true') return res.status(400).json({ message: 'MFA already enabled' });

        const decryptedSecret = decrypt(user.mfaSecret);
        const isTokenValid = verifyMfaToken(decryptedSecret, token);
        if (!isTokenValid) return res.status(401).json({ message: 'Invalid MFA token' });

        await redisClient.hSet(`user:${userId}`, 'mfaEnabled', 'true');
        res.json({ message: 'MFA enabled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { register, login, getMe, enableMfa };
