const express = require('express');
const { register, login, getMe, enableMfa } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/enable-mfa', requireAuth, enableMfa);
router.get('/me', requireAuth, getMe);

module.exports = router;
