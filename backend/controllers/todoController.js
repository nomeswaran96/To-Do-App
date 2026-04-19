const { v4: uuidv4 } = require('uuid');
const { redisClient } = require('../config/redisClient');

const getTodos = async (req, res) => {
    try {
        const userId = req.user.id;
        const todoIds = await redisClient.sMembers(`user:${userId}:todos`);
        
        if (todoIds.length === 0) {
            return res.json([]);
        }

        // Fetch all todos associated with the user
        const todos = await Promise.all(todoIds.map(async (todoId) => {
            const todo = await redisClient.hGetAll(`todo:${todoId}`);
            if (Object.keys(todo).length === 0) return null;
            return {
                ...todo,
                completed: todo.completed === 'true' // Convert string back to bool
            };
        }));

        // Filter out any nulls if an ID existed in set but hash was deleted (cleanup issue)
        res.json(todos.filter(t => t !== null));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const createTodo = async (req, res) => {
    try {
        const { title } = req.body;
        const userId = req.user.id;

        if (!title) return res.status(400).json({ message: 'Title is required' });

        const todoId = uuidv4();
        const createdAt = new Date().toISOString();

        await redisClient.hSet(`todo:${todoId}`, {
            id: todoId,
            title: title,
            completed: 'false',
            createdAt: createdAt,
            userId: userId
        });

        await redisClient.sAdd(`user:${userId}:todos`, todoId);

        res.status(201).json({
            id: todoId,
            title,
            completed: false,
            createdAt,
            userId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const updateTodo = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, completed } = req.body;
        const userId = req.user.id;

        const todo = await redisClient.hGetAll(`todo:${id}`);
        if (Object.keys(todo).length === 0) return res.status(404).json({ message: 'Todo not found' });
        
        if (todo.userId !== userId) return res.status(403).json({ message: 'Unauthorized' });

        // Update fields if provided
        if (title !== undefined) await redisClient.hSet(`todo:${id}`, 'title', title);
        if (completed !== undefined) await redisClient.hSet(`todo:${id}`, 'completed', completed.toString());

        const updatedTodo = await redisClient.hGetAll(`todo:${id}`);
        res.json({
            ...updatedTodo,
            completed: updatedTodo.completed === 'true'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteTodo = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const todo = await redisClient.hGetAll(`todo:${id}`);
        if (Object.keys(todo).length === 0) return res.status(404).json({ message: 'Todo not found' });
        
        if (todo.userId !== userId) return res.status(403).json({ message: 'Unauthorized' });

        // Remove from hash and user set
        await redisClient.del(`todo:${id}`);
        await redisClient.sRem(`user:${userId}:todos`, id);

        res.json({ message: 'Todo deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { getTodos, createTodo, updateTodo, deleteTodo };