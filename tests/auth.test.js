const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { startServer } = require('../server');

(async () => {
  const server = await startServer(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const registerRes = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'test-user@example.com', password: 'secret123' })
    });
    assert.equal(registerRes.status, 201);

    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test-user@example.com', password: 'secret123' })
    });

    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);

    const meRes = await fetch(`${baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.email, 'test-user@example.com');

    const catalogRes = await fetch(`${baseUrl}/api/catalogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({ name: 'Aurora Jacket', sku: 'AUR-100', category: 'Outerwear', price: 129.99, stock: 12, status: 'active' })
    });
    assert.equal(catalogRes.status, 201);
    const catalogData = await catalogRes.json();
    assert.equal(catalogData.item.name, 'Aurora Jacket');

    console.log('auth smoke test passed');
  } finally {
    server.close();
  }
})();
