const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createShortcutRouter } = require('../src/routes/shortcuts');
const verifyToken = require('../src/middleware/verifyToken');
const Expense = require('../src/models/Expense');

process.env.JWT_SECRET = 'shortcut-test-secret-only';

async function fixture(t) {
  const credentialStore = new Map();
  const expenseStore = new Map();
  let failWrites = false;
  const credentials = {
    async findOne(query) {
      return [...credentialStore.values()].find(c => query.userId ? c.userId === query.userId
        : c.tokenHash === query.tokenHash && c.expiresAt > query.expiresAt.$gt) || null;
    },
    async findOneAndUpdate(query, update) {
      const c = { userId: query.userId, ...update.$set };
      credentialStore.set(query.userId, c); return c;
    },
    async deleteOne(query) { credentialStore.delete(query.userId); },
  };
  const key = q => `${q.userId}:${q.shortcutRequestId}`;
  const expenses = {
    async init() {},
    findOne(query) { return { async select() { return expenseStore.get(key(query)) || null; } }; },
    async create(data) {
      if (failWrites) throw new Error('Database unavailable');
      if (expenseStore.has(key(data))) throw Object.assign(new Error('Duplicate'), { code: 11000 });
      const expense = { ...data, _id: String(expenseStore.size + 1) };
      expenseStore.set(key(data), expense); return expense;
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createShortcutRouter({ credentials, expenses }));
  app.get('/private', verifyToken, (_req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(s));
  });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  async function call(path, method = 'GET', token, body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, cache: response.headers.get('cache-control'), data: response.status === 204 ? null : await response.json() };
  }
  const login = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function connect(id = 'user-a') { return (await call('/api/shortcuts/credential', 'POST', login(id))).data.token; }
  return { call, connect, login, credentialStore, expenseStore, fail: () => { failWrites = true; } };
}

const payload = { amount: 150.5, description: ' Lunch ', date: '2026-09-12', requestId: 'ae80bf79-9a77-4714-a3ca-86ec05c95939' };

test('credentials require login, return secret only on creation, rotate and revoke', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/api/shortcuts/credential', 'POST')).status, 401);
  const first = await f.connect();
  assert.match(first, /^nbsc_[a-f0-9]{64}$/);
  assert.equal(f.credentialStore.get('user-a').tokenHash, createHash('sha256').update(first).digest('hex'));
  const status = await f.call('/api/shortcuts/credential', 'GET', f.login('user-a'));
  assert.equal(status.cache, 'no-store');
  assert.deepEqual(Object.keys(status.data.credential), ['expiresAt']);
  assert.equal((await f.call('/private', 'GET', first)).status, 401);
  assert.equal((await f.call('/api/shortcuts/credential', 'POST', first)).status, 401);
  const second = await f.connect();
  assert.notEqual(first, second);
  assert.equal((await f.call('/api/shortcuts/expenses', 'POST', first, payload)).status, 401);
  assert.equal((await f.call('/api/shortcuts/credential', 'DELETE', f.login('user-a'))).status, 204);
  assert.equal((await f.call('/api/shortcuts/expenses', 'POST', second, payload)).status, 401);
});

test('rejects expired credentials and normal login JWTs at expense-only endpoint', async t => {
  const f = await fixture(t);
  const token = await f.connect();
  f.credentialStore.get('user-a').expiresAt = new Date(0);
  for (const auth of [undefined, token, f.login('user-a')]) {
    assert.equal((await f.call('/api/shortcuts/expenses', 'POST', auth, payload)).status, 401);
  }
  assert.equal(f.expenseStore.size, 0);
});

test('save is scoped to credential owner, preserves local calendar date and deduplicates retries', async t => {
  const f = await fixture(t);
  const token = await f.connect();
  const response = await f.call('/api/shortcuts/expenses', 'POST', token, { ...payload, userId: 'victim', type: 'income', category: 'food' });
  assert.equal(response.status, 201);
  assert.equal(response.data.saved, true);
  const expense = [...f.expenseStore.values()][0];
  assert.equal(expense.userId, 'user-a');
  assert.equal(expense.type, 'expense');
  assert.equal(expense.category, 'other');
  assert.equal(expense.date.toISOString(), '2026-09-12T00:00:00.000Z');
  assert.equal(expense.description, 'Lunch');
  const replay = await f.call('/api/shortcuts/expenses', 'POST', token, { ...payload, requestId: payload.requestId.toUpperCase() });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.id, response.data.id);
  assert.equal((await f.call('/api/shortcuts/expenses', 'POST', token, { ...payload, amount: 200 })).status, 409);
  assert.equal(f.expenseStore.size, 1);
  const other = await f.connect('user-b');
  assert.equal((await f.call('/api/shortcuts/expenses', 'POST', other, payload)).status, 201);
  assert.equal(f.expenseStore.size, 2);
});

test('invalid amounts, descriptions, dates and request IDs never save', async t => {
  const f = await fixture(t);
  const token = await f.connect();
  for (const invalid of [
    { amount: 0 }, { amount: -5 }, { amount: '150' }, { amount: null }, { amount: 1e10 },
    { description: '  ' }, { description: 42 }, { description: 'x'.repeat(501) },
    { date: '2026-02-30' }, { date: 'yesterday' }, { date: null }, { date: '2026-09-12T00:00:00Z' },
    { requestId: '' }, { requestId: 42 },
  ]) {
    assert.equal((await f.call('/api/shortcuts/expenses', 'POST', token, { ...payload, ...invalid })).status, 400, JSON.stringify(invalid));
  }
  assert.equal(f.expenseStore.size, 0);
});

test('concurrent submissions produce a single expense and database failures do not report success', async t => {
  const f = await fixture(t);
  const token = await f.connect();
  const results = await Promise.all(Array.from({ length: 4 }, () => f.call('/api/shortcuts/expenses', 'POST', token, payload)));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 200, 200, 201]);
  assert.equal(f.expenseStore.size, 1);
  f.fail();
  const failure = await f.call('/api/shortcuts/expenses', 'POST', token, { ...payload, requestId: 'de80bf79-9a77-4714-a3ca-86ec05c95939' });
  assert.equal(failure.status, 500);
  assert.equal(failure.data.saved, undefined);
});

test('database schema enforces uniqueness only on expenses with Shortcut request IDs', () => {
  const index = Expense.schema.indexes().find(([fields]) => fields.shortcutRequestId);
  assert.deepEqual(index[0], { userId: 1, shortcutRequestId: 1 });
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, { shortcutRequestId: { $type: 'string' } });
});
