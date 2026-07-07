const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, 'catalog_saas.db');
const db = new DatabaseSync(dbPath);

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS catalogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const seed = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (seed.count === 0) {
    const insert = db.prepare('INSERT INTO users (name, email, password_hash, role, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)');
    insert.run('Admin User', 'admin@catalogue.com', hashPassword('admin123'), 'admin', 'active', 'default');
    insert.run('Demo User', 'user@catalogue.com', hashPassword('user123'), 'user', 'active', 'default');
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

function getDb() {
  return db;
}

function createSession(userId, token) {
  db.prepare('INSERT INTO sessions (user_id, token) VALUES (?, ?)').run(userId, token);
}

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function listUsers(tenantId) {
  return db.prepare('SELECT id, name, email, role, status, tenant_id FROM users WHERE tenant_id = ? ORDER BY id').all(tenantId);
}

function createUser({ name, email, password, tenantId = 'default' }) {
  const insert = db.prepare('INSERT INTO users (name, email, password_hash, role, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?)');
  const result = insert.run(name, email, hashPassword(password), 'user', 'active', tenantId);
  return getUserById(result.lastInsertRowid);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

function updateUserRole(id, role) {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
}

function updateUserStatus(id, status) {
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
}

function createCatalog({ tenantId, name, sku, category, price, stock, status }) {
  const insert = db.prepare('INSERT INTO catalogs (tenant_id, name, sku, category, price, stock, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const result = insert.run(tenantId, name, sku, category, price, stock, status);
  return db.prepare('SELECT * FROM catalogs WHERE id = ?').get(result.lastInsertRowid);
}

function listCatalogs(tenantId) {
  return db.prepare('SELECT * FROM catalogs WHERE tenant_id = ? ORDER BY id DESC').all(tenantId);
}

function updateCatalog(id, values) {
  const fields = [];
  const params = [];
  Object.entries(values).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    params.push(value);
  });
  params.push(id);
  db.prepare(`UPDATE catalogs SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return db.prepare('SELECT * FROM catalogs WHERE id = ?').get(id);
}

function deleteCatalog(id) {
  db.prepare('DELETE FROM catalogs WHERE id = ?').run(id);
}

initDb();

module.exports = {
  getDb,
  initDb,
  hashPassword,
  verifyPassword,
  getUserByEmail,
  getUserById,
  createUser,
  sanitizeUser,
  listUsers,
  updateUserRole,
  updateUserStatus,
  createSession,
  createCatalog,
  listCatalogs,
  updateCatalog,
  deleteCatalog
};
