const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  verifyPassword,
  getUserByEmail,
  getUserById,
  createUser,
  listUsers,
  updateUserRole,
  updateUserStatus,
  createSession,
  createCatalog,
  listCatalogs,
  updateCatalog,
  deleteCatalog,
  setTenantRole,
  getTenantRoles,
  getTenantRole
} = require('./db');

const root = __dirname;
const uploadsDir = path.join(root, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    req.on('error', reject);
  });
}

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': getMime(filePath) });
    res.end(content);
  });
}

function authenticate(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const session = require('./db').getDb().prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  return getUserById(session.user_id);
}

function createToken(user) {
  return crypto.createHash('sha256').update(`${user.email}:${Date.now()}`).digest('hex');
}

function startServer(port = 8000) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const { url = '/' } = req;
      if (url.startsWith('/api/login')) {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        const body = await readBody(req);
        const user = getUserByEmail(body.email);
        if (!user || !verifyPassword(body.password, user.password_hash) || user.status !== 'active') return sendJson(res, 401, { error: 'Invalid credentials' });
        const token = createToken(user);
        createSession(user.id, token);
        return sendJson(res, 200, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, tenant_id: user.tenant_id } });
      }

      if (url.startsWith('/api/register')) {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        const body = await readBody(req);
        if (!body.name || !body.email || !body.password) return sendJson(res, 400, { error: 'Missing fields' });
        if (getUserByEmail(body.email)) return sendJson(res, 409, { error: 'Email already exists' });
        const newUser = createUser({ name: body.name, email: body.email, password: body.password, tenantId: body.tenant_id || 'default' });
        return sendJson(res, 201, { user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, status: newUser.status, tenant_id: newUser.tenant_id } });
      }

      if (url.startsWith('/api/me')) {
        const user = authenticate(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        return sendJson(res, 200, { user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, tenant_id: user.tenant_id } });
      }

      if (url.startsWith('/api/users')) {
        const user = authenticate(req);
        if (!user || user.role !== 'admin') return sendJson(res, 403, { error: 'Forbidden' });

        if (req.method === 'PUT') {
          const body = await readBody(req);
          const targetUser = getUserById(Number(body.id));
          if (!targetUser) return sendJson(res, 404, { error: 'User not found' });
          if (body.action === 'toggle-role') updateUserRole(targetUser.id, targetUser.role === 'admin' ? 'user' : 'admin');
          if (body.action === 'toggle-status') updateUserStatus(targetUser.id, targetUser.status === 'active' ? 'suspended' : 'active');
          return sendJson(res, 200, { users: listUsers(user.tenant_id) });
        }

        return sendJson(res, 200, { users: listUsers(user.tenant_id) });
      }

      if (url.startsWith('/api/catalogs')) {
        const user = authenticate(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

        if (req.method === 'GET') {
          return sendJson(res, 200, { items: listCatalogs(user.tenant_id) });
        }

        if (req.method === 'POST') {
          const body = await readBody(req);
          const item = createCatalog({ tenantId: user.tenant_id, name: body.name, sku: body.sku, category: body.category, price: Number(body.price || 0), stock: Number(body.stock || 0), status: body.status || 'active', imageUrl: body.image_url || null, description: body.description || null });
          return sendJson(res, 201, { item });
        }

        if (req.method === 'PUT') {
          const body = await readBody(req);
          const item = updateCatalog(Number(body.id), {
            name: body.name,
            sku: body.sku,
            category: body.category,
            price: Number(body.price || 0),
            stock: Number(body.stock || 0),
            status: body.status,
            image_url: body.image_url,
            description: body.description
          });
          return sendJson(res, 200, { item });
        }

        if (req.method === 'DELETE') {
          const body = await readBody(req);
          deleteCatalog(Number(body.id));
          return sendJson(res, 200, { success: true });
        }
      }

      if (url.startsWith('/api/upload')) {
        const user = authenticate(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.png`;
          const filePath = path.join(uploadsDir, filename);
          fs.writeFileSync(filePath, buffer);
          return sendJson(res, 201, { url: `/uploads/${filename}` });
        });
        return;
      }

      if (url.startsWith('/api/roles')) {
        const user = authenticate(req);
        if (!user || user.role !== 'admin') return sendJson(res, 403, { error: 'Forbidden' });
        if (req.method === 'GET') return sendJson(res, 200, { roles: getTenantRoles(user.tenant_id) });
        if (req.method === 'POST') {
          const body = await readBody(req);
          setTenantRole(user.tenant_id, Number(body.user_id), body.role);
          return sendJson(res, 201, { roles: getTenantRoles(user.tenant_id) });
        }
      }

      if (url.startsWith('/api/export')) {
        const user = authenticate(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        const exportData = listCatalogs(user.tenant_id);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(exportData));
      }

      if (url.startsWith('/api/import')) {
        const user = authenticate(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        const body = await readBody(req);
        const items = Array.isArray(body) ? body : body.items || [];
        items.forEach(item => createCatalog({ tenantId: user.tenant_id, name: item.name, sku: item.sku, category: item.category, price: Number(item.price || 0), stock: Number(item.stock || 0), status: item.status || 'active', imageUrl: item.image_url || null, description: item.description || null }));
        return sendJson(res, 201, { imported: items.length });
      }

      const requestPath = url.split('?')[0];
      const safePath = requestPath === '/' ? '/index.html' : requestPath;
      const filePath = path.join(root, safePath.replace(/^\//, ''));
      if (filePath.startsWith(root) && fs.existsSync(filePath)) {
        serveFile(res, filePath);
      } else {
        serveFile(res, path.join(root, 'index.html'));
      }
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (require.main === module) {
  startServer(8000).then(server => {
    const address = server.address();
    console.log(`Catalog SaaS server running at http://127.0.0.1:${address.port}`);
  });
}

module.exports = { startServer };
