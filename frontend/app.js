const API_URL = '/api';
// State
let isLogin = true;
let mfaRequired = false;
let qrCode = null;
let mfaSecret = null;
let token = localStorage.getItem('token') || null;
let tempRegistrationToken = null;

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
const todoDateInput = document.getElementById('todo-date-input');
const todoList = document.getElementById('todo-list');
const completedList = document.getElementById('completed-list');
const dashboardTitle = document.getElementById('dashboard-title');
const activateMfaForm = document.getElementById('activate-mfa-form');
const authFormContainer = document.getElementById('auth-form');
const switchAuthContainer = document.getElementById('switch-auth-container');
const newTaskBtn = document.getElementById('new-task-btn');
const cancelTaskBtn = document.getElementById('cancel-task-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

// Theme Initializer
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    if (themeToggleBtn) themeToggleBtn.innerText = '☀️';
}

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
    authFormContainer.style.display = 'block';
    switchAuthContainer.style.display = 'block';
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
    authError.style.color = 'var(--error-color)';
    authError.style.backgroundColor = '#fef2f2';
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
            
            tempRegistrationToken = data.tempToken;
            
            qrCodeImg.src = data.mfaQrCode;
            mfaSecretText.innerText = data.mfaSecret;
            
            // Hide normal auth form to focus on MFA Setup
            authFormContainer.style.display = 'none';
            switchAuthContainer.style.display = 'none';
            qrContainer.style.display = 'block';
            authTitle.innerText = 'Setup MFA';
            authSubtitle.innerText = 'Secure your account with Multi-Factor Authentication';
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

// Activate MFA after registration
if (activateMfaForm) {
    activateMfaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otpVal = document.getElementById('activate-mfa-token').value;
        const errorDiv = document.getElementById('activate-mfa-error');
        errorDiv.style.display = 'none';

        try {
            const res = await fetch(`${API_URL}/auth/enable-mfa`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tempRegistrationToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: otpVal })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw { status: res.status, data };

            qrContainer.style.display = 'none';
            
            isLogin = true;
            mfaRequired = false;
            tempRegistrationToken = null;
            document.getElementById('password').value = '';
            document.getElementById('activate-mfa-token').value = '';
            
            authFormContainer.style.display = 'block';
            switchAuthContainer.style.display = 'block';
            updateAuthUi();

            authError.style.color = 'limegreen';
            authError.style.backgroundColor = '#f0fdf4';
            authError.innerText = 'MFA activated! Please log in.';
            authError.style.display = 'block';

        } catch (err) {
            errorDiv.innerText = err.data?.message || 'Invalid OTP token';
            errorDiv.style.display = 'block';
        }
    });
}

// Dashboard Data
async function fetchUser() {
    try {
        const data = await apiRequest('/auth/me');
        dashboardTitle.innerText = `${data.username}'s Tasks`;
        
        // Show MFA Setup if not enabled
        const mfaSetupDiv = document.getElementById('dashboard-mfa-setup');
        if (!data.mfaEnabled) {
            mfaSetupDiv.style.display = 'block';
        } else {
            mfaSetupDiv.style.display = 'none';
        }
    } catch (err) {
        console.error('Failed to fetch user', err);
    }
}

// Enable MFA Handler (from dashboard)
const enableMfaForm = document.getElementById('enable-mfa-form');
if (enableMfaForm) {
    enableMfaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tokenVal = document.getElementById('setup-mfa-token').value;
        const errorDiv = document.getElementById('mfa-setup-error');
        const successDiv = document.getElementById('mfa-setup-success');
        
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
        
        try {
            await apiRequest('/auth/enable-mfa', {
                method: 'POST',
                body: JSON.stringify({ token: tokenVal })
            });
            successDiv.style.display = 'block';
            document.getElementById('setup-mfa-token').value = '';
            setTimeout(() => {
                document.getElementById('dashboard-mfa-setup').style.display = 'none';
            }, 3000);
        } catch (err) {
            errorDiv.innerText = err.data?.message || 'Failed to enable MFA';
            errorDiv.style.display = 'block';
        }
    });
}

async function fetchTodos() {
    try {
        const todos = await apiRequest('/todos');
        renderTodos(todos);
    } catch (err) {
        console.error('Failed to fetch todos', err);
    }
}

// Date Formatter
function formatDueDate(dateString) {
    if (!dateString) return 'No due date';
    const d = new Date(dateString);
    if(isNaN(d.getTime())) return 'No due date';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Todo List Rendering
function renderTodos(todos) {
    todoList.innerHTML = '';
    if (completedList) completedList.innerHTML = '';

    todos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;

        li.innerHTML = `
            <div class="todo-item-left" onclick="toggleTodo('${todo.id}', ${todo.completed})">
                <div class="todo-box ${todo.completed ? 'checked' : ''}">
                    ${todo.completed ? '✓' : ''}
                </div>
            </div>
            <div class="todo-item-center">
                <h3 class="todo-title">${todo.title}</h3>
                <p class="todo-subtitle">${formatDueDate(todo.dueDate)}</p>
            </div>
            <div class="todo-item-right">
                <button class="action-btn edit-btn" onclick="editTodo('${todo.id}', '${todo.title.replace(/'/g, "\\'")}')" aria-label="Edit">✏️</button>
                <button class="action-btn delete-btn" onclick="deleteTodo('${todo.id}')" aria-label="Delete">🗑️</button>
            </div>
        `;
        
        if (todo.completed && completedList) {
            completedList.appendChild(li);
        } else {
            todoList.appendChild(li);
        }
    });
}

// Toggle Add Form
if (newTaskBtn) {
    newTaskBtn.addEventListener('click', () => {
        todoForm.style.display = 'block';
    });
}
if (cancelTaskBtn) {
    cancelTaskBtn.addEventListener('click', () => {
        todoForm.style.display = 'none';
        todoInput.value = '';
        if (todoDateInput) todoDateInput.value = '';
    });
}

// Theme Toggle
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggleBtn.innerText = isDark ? '☀️' : '🌙';
    });
}

// Todo Actions
todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    const dueDate = todoDateInput ? todoDateInput.value : '';
    if (!title) return;

    try {
        await apiRequest('/todos', {
            method: 'POST',
            body: JSON.stringify({ title, dueDate })
        });
        todoInput.value = '';
        if (todoDateInput) todoDateInput.value = '';
        todoForm.style.display = 'none';
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

window.editTodo = async (id, currentTitle) => {
    const newTitle = prompt('Edit Task:', currentTitle);
    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) return;

    try {
        await apiRequest(`/todos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ title: newTitle.trim() })
        });
        fetchTodos();
    } catch (err) {
        console.error('Failed to update task title', err);
    }
};

// Logout
function handleLogout() {
    token = null;
    tempRegistrationToken = null;
    localStorage.removeItem('token');
    showAuth();
}

logoutBtn.addEventListener('click', handleLogout);

// Start
init();
