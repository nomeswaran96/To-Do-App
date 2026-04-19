const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { redisClient } = require('../config/redisClient');
const { generateMfaSecret, verifyMfaToken } = require('../utils/mfaUtils');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const register = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

        const lookupKey = `user:lookup:${username}`;
        const existingUserId = await redisClient.get(lookupKey);
        
        if (existingUserId) return res.status(400).json({ message: 'Username already exists' });

        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Generate MFA Setup
        const mfa = await generateMfaSecret(username);

        await redisClient.set(lookupKey, userId);
        await redisClient.hSet(`user:${userId}`, {
            id: userId,
            username: username,
            passwordHash: passwordHash,
            mfaEnabled: 'false',
            mfaSecret: mfa.base32
        });

        // For registration, we return the MFA QR code URL so user can set it up immediately.
        res.status(201).json({
            message: 'User registered successfully. Please scan the QR code to set up MFA.',
            userId,
            mfaQrCode: mfa.qrCodeUrl,
            mfaSecret: mfa.base32
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
            const isTokenValid = verifyMfaToken(user.mfaSecret, token);
            if (!isTokenValid) {
                return res.status(401).json({ message: 'Invalid MFA token' });
            }
        } else if (token) {
            // Optional: If providing token but it wasn't enabled, we can verify and enable it (first time setup logic)
            const isTokenValid = verifyMfaToken(user.mfaSecret, token);
            if (isTokenValid) {
                await redisClient.hSet(`user:${userId}`, 'mfaEnabled', 'true');
            } else {
                return res.status(401).json({ message: 'Invalid MFA token for setup' });
            }
        }

        const jwtToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });

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

module.exports = { register, login, getMe };
