const API_URL = '/api';
// State
let isLogin = true;
let mfaRequired = false;
let qrCode = null;
let mfaSecret = null;
let token = localStorage.getItem('token') || null;

// DOM Elements
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const switchAuthLink = document.getElementById('switch-auth-link');
const switchAuthText = document.getElementById('switch-auth-text');
const mfaGroup = document.getElementById('mfa-group');
const authError = document.getElementById('auth-error');
const submitBtn = document.getElementById('submit-btn');
const qrContainer = document.getElementById('qr-container');
const mfaSecretText = document.getElementById('mfa-secret-text');
const qrCodeImg = document.getElementById('qr-code-img');
const logoutBtn = document.getElementById('logout-btn');
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const dashboardTitle = document.getElementById('dashboard-title');

// General API Request Helper
async function apiRequest(endpoint, options = {}) {
    if (!options.headers) options.headers = {};
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    options.headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_URL}${endpoint}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (res.status === 401 && !data.mfaRequired) {
            handleLogout();
        }
        throw { status: res.status, data };
    }
    return data;
}

// Initialization Flow
function init() {
    if (token) {
        showDashboard();
    } else {
        showAuth();
    }
}

// UI Toggles
function showAuth() {
    authContainer.style.display = 'block';
    dashboardContainer.style.display = 'none';
    updateAuthUi();
}

function showDashboard() {
    authContainer.style.display = 'none';
    dashboardContainer.style.display = 'block';
    mfaRequired = false;
    qrContainer.style.display = 'none';
    fetchUser();
    fetchTodos();
}

function updateAuthUi() {
    authTitle.innerText = isLogin ? 'Welcome Back' : 'Create Account';
    authSubtitle.innerText = isLogin ? 'Sign in to access your ToDo list' : 'Sign up to start organizing';
    submitBtn.innerText = isLogin ? 'Sign In' : 'Sign Up';
    switchAuthText.innerText = isLogin ? "Don't have an account? " : "Already have an account? ";
    switchAuthLink.innerText = isLogin ? 'Sign Up' : 'Sign In';
    mfaGroup.style.display = mfaRequired ? 'block' : 'none';
    authError.style.display = 'none';
}

function showError(msg) {
    authError.innerText = msg;
    authError.style.display = 'block';
}

// Authentication Handlers
switchAuthLink.addEventListener('click', () => {
    isLogin = !isLogin;
    mfaRequired = false;
    qrContainer.style.display = 'none';
    updateAuthUi();
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const mfaTokenVal = document.getElementById('mfa-token').value;

    authError.style.display = 'none';

    try {
        if (isLogin) {
            const body = { username, password };
            if (mfaRequired) body.token = mfaTokenVal;
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            token = data.token;
            localStorage.setItem('token', token);
            showDashboard();
        } else {
            const data = await apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            qrCodeImg.src = data.mfaQrCode;
            mfaSecretText.innerText = data.mfaSecret;
            qrContainer.style.display = 'block';
            isLogin = true;
            updateAuthUi();
        }
    } catch (err) {
        if (err.status === 403 && err.data && err.data.mfaRequired) {
            mfaRequired = true;
            updateAuthUi();
        } else {
            showError(err.data?.message || 'Authentication failed');
        }
    }
});

// Dashboard Data
async function fetchUser() {
    try {
        const data = await apiRequest('/auth/me');
        dashboardTitle.innerText = `${data.username}'s Tasks`;
    } catch (err) {
        console.error('Failed to fetch user', err);
    }
}

async function fetchTodos() {
    try {
        const todos = await apiRequest('/todos');
        renderTodos(todos);
    } catch (err) {
        console.error('Failed to fetch todos', err);
    }
}

// Todo List Rendering
function renderTodos(todos) {
    todoList.innerHTML = '';
    todos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;

        li.innerHTML = `
            <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo('${todo.id}', ${todo.completed})">
            <span>${todo.title}</span>
            <button class="delete-btn" onclick="deleteTodo('${todo.id}')">Delete</button>
        `;
        todoList.appendChild(li);
    });
}

// Todo Actions
todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (!title) return;

    try {
        await apiRequest('/todos', {
            method: 'POST',
            body: JSON.stringify({ title })
        });
        todoInput.value = '';
        fetchTodos();
    } catch (err) {
        console.error('Failed to add todo', err);
    }
});

window.toggleTodo = async (id, currentCompleted) => {
    try {
        await apiRequest(`/todos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ completed: !currentCompleted })
        });
        fetchTodos();
    } catch (err) {
        console.error('Failed to update todo', err);
    }
};

window.deleteTodo = async (id) => {
    try {
        await apiRequest(`/todos/${id}`, {
            method: 'DELETE'
        });
        fetchTodos();
    } catch (err) {
        console.error('Failed to delete todo', err);
    }
};

// Logout
function handleLogout() {
    token = null;
    localStorage.removeItem('token');
    showAuth();
}

logoutBtn.addEventListener('click', handleLogout);

// Start
init();
