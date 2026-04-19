const express = require('express');
const { getTodos, createTodo, updateTodo, deleteTodo } = require('../controllers/todoController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all todo routes
router.use(requireAuth);

router.get('/', getTodos);
router.post('/', createTodo);
router.put('/:id', updateTodo);
router.delete('/:id', deleteTodo);

module.exports = router;