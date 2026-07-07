const STORAGE_KEYS = {
  users: 'catalogue_saas_users',
  currentUser: 'catalogue_saas_current_user'
};

const DEFAULT_USERS = [
  { id: 1, name: 'Admin User', email: 'admin@catalogue.com', password: 'admin123', role: 'admin', status: 'active' },
  { id: 2, name: 'Demo User', email: 'user@catalogue.com', password: 'user123', role: 'user', status: 'active' }
];

let users = loadUsers();
let currentUser = loadCurrentUser();

function loadUsers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.users);
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  } catch { return DEFAULT_USERS; }
}

function saveUsers() {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function loadCurrentUser() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.currentUser);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function saveCurrentUser(user) {
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

function showMessage(el, type, text) {
  if (!el) return;
  el.className = `message ${type}`;
  el.textContent = text;
}

function requireAuth(allowedRoles = []) {
  const user = currentUser || loadCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
    return null;
  }
  return user;
}

function isLoggedIn() {
  return !!currentUser;
}

function logout() {
  currentUser = null;
  clearCurrentUser();
  window.location.href = 'login.html';
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  const msg = document.getElementById('authMessage');
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    showMessage(msg, 'error', 'Invalid email or password.');
    return;
  }
  if (user.status !== 'active') {
    showMessage(msg, 'error', 'Your account is suspended.');
    return;
  }
  currentUser = { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
  saveCurrentUser(currentUser);
  window.location.href = currentUser.role === 'admin' ? 'admin.html' : 'dashboard.html';
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('name')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  const msg = document.getElementById('authMessage');
  if (!name || !email || !password) {
    showMessage(msg, 'error', 'Please fill in all fields.');
    return;
  }
  if (users.some(u => u.email === email)) {
    showMessage(msg, 'error', 'An account with this email already exists.');
    return;
  }
  const newUser = { id: Date.now(), name, email, password, role: 'user', status: 'active' };
  users.push(newUser);
  saveUsers();
  showMessage(msg, 'success', 'Account created. You can now log in.');
  document.getElementById('registerForm')?.reset();
}

function renderDashboard() {
  const user = requireAuth(['user', 'admin']);
  if (!user) return;
  const welcome = document.getElementById('welcomeName');
  if (welcome) welcome.textContent = `Welcome, ${user.name}`;
  const totalUsers = document.getElementById('totalUsers');
  if (totalUsers) totalUsers.textContent = users.length;
  const activeUsers = document.getElementById('activeUsers');
  if (activeUsers) activeUsers.textContent = users.filter(u => u.status === 'active').length;
  const adminCount = document.getElementById('adminCount');
  if (adminCount) adminCount.textContent = users.filter(u => u.role === 'admin').length;
}

function renderAdmin() {
  const user = requireAuth(['admin']);
  if (!user) return;
  const welcome = document.getElementById('adminWelcome');
  if (welcome) welcome.textContent = `Admin console · ${user.name}`;
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="badge ${u.role}">${u.role}</span></td>
      <td><span class="badge ${u.status}">${u.status}</span></td>
      <td>
        <button class="btn btn-secondary" data-action="toggle-role" data-id="${u.id}">${u.role === 'admin' ? 'Demote' : 'Promote'}</button>
        <button class="btn btn-danger" data-action="toggle-status" data-id="${u.id}">${u.status === 'active' ? 'Suspend' : 'Activate'}</button>
      </td>
    </tr>
  `).join('');
}

function handleAdminAction(target) {
  const id = Number(target.dataset.id);
  const action = target.dataset.action;
  const userToEdit = users.find(u => u.id === id);
  if (!userToEdit) return;
  if (action === 'toggle-role') {
    userToEdit.role = userToEdit.role === 'admin' ? 'user' : 'admin';
  }
  if (action === 'toggle-status') {
    userToEdit.status = userToEdit.status === 'active' ? 'suspended' : 'active';
  }
  saveUsers();
  renderAdmin();
}

function bindAuthForms() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
}

function bindDashboardActions() {
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', logout);
  document.getElementById('usersTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) handleAdminAction(btn);
  });
}

function initApp() {
  bindAuthForms();
  bindDashboardActions();
  if (document.body.dataset.page === 'dashboard') renderDashboard();
  if (document.body.dataset.page === 'admin') renderAdmin();
  if (document.body.dataset.page === 'home' && isLoggedIn()) {
    const target = currentUser?.role === 'admin' ? 'admin.html' : 'dashboard.html';
    window.location.href = target;
  }
}

document.addEventListener('DOMContentLoaded', initApp);
