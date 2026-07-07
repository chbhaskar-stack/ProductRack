const STORAGE_KEYS = {
  currentUser: 'catalogue_saas_current_user',
  token: 'catalogue_saas_token'
};

let users = [];
let currentUser = loadCurrentUser();

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
  localStorage.removeItem(STORAGE_KEYS.token);
}

function getStoredToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

function saveToken(token) {
  localStorage.setItem(STORAGE_KEYS.token, token);
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

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  const msg = document.getElementById('authMessage');
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (!response.ok) {
    showMessage(msg, 'error', data.error || 'Login failed.');
    return;
  }
  currentUser = data.user;
  saveCurrentUser(currentUser);
  saveToken(data.token);
  window.location.href = currentUser.role === 'admin' ? 'admin.html' : 'dashboard.html';
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('name')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  const tenantId = document.getElementById('tenantId')?.value.trim() || 'default';
  const msg = document.getElementById('authMessage');
  if (!name || !email || !password) {
    showMessage(msg, 'error', 'Please fill in all fields.');
    return;
  }
  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, tenant_id: tenantId })
  });
  const data = await response.json();
  if (!response.ok) {
    showMessage(msg, 'error', data.error || 'Registration failed.');
    return;
  }
  showMessage(msg, 'success', 'Account created. You can now log in.');
  document.getElementById('registerForm')?.reset();
}

async function loadUserProfile() {
  const token = getStoredToken();
  if (!token) return null;
  const response = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    clearCurrentUser();
    return null;
  }
  const data = await response.json();
  currentUser = data.user;
  saveCurrentUser(currentUser);
  return currentUser;
}

let catalogItems = [];

function resetCatalogForm() {
  document.getElementById('catalogId').value = '';
  document.getElementById('catalogName').value = '';
  document.getElementById('catalogSku').value = '';
  document.getElementById('catalogCategory').value = '';
  document.getElementById('catalogPrice').value = '';
  document.getElementById('catalogStock').value = '';
  document.getElementById('catalogStatus').value = 'active';
  document.getElementById('catalogImageUrl').value = '';
  document.getElementById('catalogDescription').value = '';
  document.getElementById('catalogImageFile').value = '';
}

function showCatalogForm() {
  document.getElementById('catalogForm').style.display = 'grid';
}

function hideCatalogForm() {
  document.getElementById('catalogForm').style.display = 'none';
  resetCatalogForm();
}

function renderCatalogTable() {
  const tbody = document.getElementById('catalogTableBody');
  if (!tbody) return;
  tbody.innerHTML = catalogItems.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.sku}</td>
      <td>${item.category}</td>
      <td>$${Number(item.price).toFixed(2)}</td>
      <td>${item.stock}</td>
      <td>${item.status}</td>
      <td>
        <button class="btn btn-secondary" data-action="edit-catalog" data-id="${item.id}">Edit</button>
        <button class="btn btn-danger" data-action="delete-catalog" data-id="${item.id}">Delete</button>
      </td>
    </tr>
  `).join('');
  const catalogCount = document.getElementById('catalogCount');
  if (catalogCount) catalogCount.textContent = catalogItems.length;
  const totalStock = document.getElementById('totalStock');
  if (totalStock) totalStock.textContent = catalogItems.reduce((sum, item) => sum + Number(item.stock || 0), 0);
  const catalogValue = document.getElementById('catalogValue');
  if (catalogValue) catalogValue.textContent = `$${catalogItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.stock || 0), 0).toFixed(2)}`;
}

async function loadCatalogs() {
  const response = await fetch('/api/catalogs', { headers: { Authorization: `Bearer ${getStoredToken()}` } });
  if (!response.ok) return;
  const data = await response.json();
  catalogItems = data.items || [];
  renderCatalogTable();
}

async function handleCatalogSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('catalogImageFile');
  let imageUrl = document.getElementById('catalogImageUrl').value;
  if (fileInput?.files?.[0]) {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getStoredToken()}` },
      body: formData
    });
    const uploadData = await uploadRes.json();
    imageUrl = uploadData.url || imageUrl;
  }
  const payload = {
    id: document.getElementById('catalogId').value || undefined,
    name: document.getElementById('catalogName').value,
    sku: document.getElementById('catalogSku').value,
    category: document.getElementById('catalogCategory').value,
    price: document.getElementById('catalogPrice').value,
    stock: document.getElementById('catalogStock').value,
    status: document.getElementById('catalogStatus').value,
    image_url: imageUrl,
    description: document.getElementById('catalogDescription').value
  };
  const method = payload.id ? 'PUT' : 'POST';
  const response = await fetch('/api/catalogs', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
    body: JSON.stringify(payload)
  });
  if (response.ok) {
    hideCatalogForm();
    loadCatalogs();
  }
}

async function handleCatalogAction(target) {
  const id = Number(target.dataset.id);
  if (target.dataset.action === 'delete-catalog') {
    await fetch('/api/catalogs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
      body: JSON.stringify({ id })
    });
    loadCatalogs();
    return;
  }
  const item = catalogItems.find(c => c.id === id);
  if (!item) return;
  document.getElementById('catalogId').value = item.id;
  document.getElementById('catalogName').value = item.name;
  document.getElementById('catalogSku').value = item.sku;
  document.getElementById('catalogCategory').value = item.category;
  document.getElementById('catalogPrice').value = item.price;
  document.getElementById('catalogStock').value = item.stock;
  document.getElementById('catalogStatus').value = item.status;
  document.getElementById('catalogImageUrl').value = item.image_url || '';
  document.getElementById('catalogDescription').value = item.description || '';
  showCatalogForm();
}

async function exportCatalogs() {
  const response = await fetch('/api/export', { headers: { Authorization: `Bearer ${getStoredToken()}` } });
  const data = await response.text();
  const blob = new Blob([data], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'catalog-export.json';
  link.click();
}

async function importCatalogs(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const response = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
    body: JSON.stringify(data)
  });
  if (response.ok) {
    await loadCatalogs();
  }
}

async function renderDashboard() {
  const user = await loadUserProfile();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  if (!['user', 'admin'].includes(user.role)) {
    window.location.href = 'login.html';
    return;
  }
  const welcome = document.getElementById('welcomeName');
  if (welcome) welcome.textContent = `Welcome, ${user.name}`;
  const response = await fetch('/api/users', { headers: { Authorization: `Bearer ${getStoredToken()}` } });
  if (response.ok) {
    const data = await response.json();
    users = data.users || [];
    const totalUsers = document.getElementById('totalUsers');
    if (totalUsers) totalUsers.textContent = users.length;
    const activeUsers = document.getElementById('activeUsers');
    if (activeUsers) activeUsers.textContent = users.filter(u => u.status === 'active').length;
    const adminCount = document.getElementById('adminCount');
    if (adminCount) adminCount.textContent = users.filter(u => u.role === 'admin').length;
  }
  await loadCatalogs();
}

async function renderAdmin() {
  const user = await loadUserProfile();
  if (!user || user.role !== 'admin') {
    window.location.href = 'login.html';
    return;
  }
  const welcome = document.getElementById('adminWelcome');
  if (welcome) welcome.textContent = `Admin console · ${user.name}`;
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  const response = await fetch('/api/users', { headers: { Authorization: `Bearer ${getStoredToken()}` } });
  if (!response.ok) return;
  const data = await response.json();
  users = data.users || [];
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
  const tenantName = document.getElementById('tenantName');
  if (tenantName) tenantName.textContent = user.tenant_id || 'default';
  const tenantUserCount = document.getElementById('tenantUserCount');
  if (tenantUserCount) tenantUserCount.textContent = users.length;
  const tenantCatalogCount = document.getElementById('tenantCatalogCount');
  if (tenantCatalogCount) tenantCatalogCount.textContent = catalogItems.length || 0;
  const tenantUserSelect = document.getElementById('tenantUserSelect');
  if (tenantUserSelect) {
    tenantUserSelect.innerHTML = users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('');
  }
  const roleResponse = await fetch('/api/roles', { headers: { Authorization: `Bearer ${getStoredToken()}` } });
  if (roleResponse.ok) {
    const roleData = await roleResponse.json();
    const roleAssignments = roleData.roles || [];
    const roleSummary = roleAssignments.reduce((acc, role) => `${acc}${role.name || role.email} (${role.role})\n`, '');
    if (roleSummary) {
      const summaryNode = document.getElementById('tenantRoleSummary');
      if (summaryNode) summaryNode.textContent = roleSummary;
    }
  }
}

async function assignTenantRole() {
  const userId = document.getElementById('tenantUserSelect')?.value;
  const role = document.getElementById('tenantRoleSelect')?.value;
  if (!userId || !role) return;
  await fetch('/api/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ user_id: Number(userId), role })
  });
}

async function handleAdminAction(target) {
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
  await fetch('/api/users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ id, action, value: userToEdit[action === 'toggle-role' ? 'role' : 'status'] })
  });
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
  document.getElementById('showCatalogFormBtn')?.addEventListener('click', showCatalogForm);
  document.getElementById('cancelCatalogBtn')?.addEventListener('click', hideCatalogForm);
  document.getElementById('catalogForm')?.addEventListener('submit', handleCatalogSubmit);
  document.getElementById('catalogTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) handleCatalogAction(btn);
  });
  document.getElementById('exportCatalogBtn')?.addEventListener('click', exportCatalogs);
  document.getElementById('saveTenantRoleBtn')?.addEventListener('click', assignTenantRole);
  document.getElementById('importCatalogInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await importCatalogs(file);
  });
}

async function initApp() {
  bindAuthForms();
  bindDashboardActions();
  if (document.body.dataset.page === 'dashboard') {
    await renderDashboard();
  }
  if (document.body.dataset.page === 'admin') {
    await renderAdmin();
  }
  if (document.body.dataset.page === 'home' && currentUser) {
    const target = currentUser?.role === 'admin' ? 'admin.html' : 'dashboard.html';
    window.location.href = target;
  }
}

document.addEventListener('DOMContentLoaded', initApp);
