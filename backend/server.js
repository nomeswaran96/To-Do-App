require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectRedis } = require('./config/redisClient');
const authRoutes = require('./routes/authRoutes');
const todoRoutes = require('./routes/todoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Redis Connection
connectRedis();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);

// Healthcheck
app.get('/health', (req, res) => res.json({ status: 'OK' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));