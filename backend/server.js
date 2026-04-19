require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectRedis } = require('./config/redisClient');
const authRoutes = require('./routes/authRoutes');
const todoRoutes = require('./routes/todoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);

// Healthcheck
app.get('/health', (req, res) => res.json({ status: 'OK' }));

const startServer = async () => {
    try {
        await connectRedis();
        console.log('Redis connected successfully');
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
        process.exit(1); // Let Kubernetes restart cleanly
    }
};

startServer();