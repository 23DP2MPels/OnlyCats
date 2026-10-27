// Requires a disposable migrated database and a running API with TRUST_PROXY unset.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const base = process.env.TEST_API_URL || 'http://127.0.0.1:3000/api';
const ids = [];
async function call(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, data: await response.json() };
}
try {
  const email = `history-${randomUUID()}@onlycats.test`;
  const password = 'OnlyCatsHistory2026!';
  const register = await call('/auth/register', {
    method: 'POST',
    body: { name: 'History test', email, password },
    headers: {
      'User-Agent': 'OnlyCats-History-Register',
      'X-Forwarded-For': '203.0.113.77',
    },
  });
  assert.equal(register.response.status, 201);
  ids.push(register.data.id);
  const cookie = register.response.headers.get('set-cookie').split(';')[0];
  let history = await call('/account/login-history', { cookie });
  assert.equal(history.response.status, 200);
  assert.equal(history.data.length, 1);
  assert.equal(history.data[0].kind, 'REGISTER');
  assert.equal(history.data[0].userAgent, 'OnlyCats-History-Register');
  assert.notEqual(history.data[0].ipAddress, '203.0.113.77');
  assert.equal((await call('/account/login-history')).response.status, 401);
  assert.equal(
    (
      await call('/auth/login', {
        method: 'POST',
        body: { email, password: 'WrongPassword2026!' },
      })
    ).response.status,
    400,
  );
  assert.equal(
    (await call('/account/login-history', { cookie })).data.length,
    1,
  );
  const login = await call('/auth/login', {
    method: 'POST',
    body: { email, password },
    headers: { 'User-Agent': 'OnlyCats-History-Login' },
  });
  assert.equal(login.response.status, 200);
  const loginCookie = login.response.headers.get('set-cookie').split(';')[0];
  history = await call('/account/login-history', { cookie: loginCookie });
  assert.equal(history.data.length, 2);
  assert.equal(history.data[0].kind, 'LOGIN');
  assert.equal(history.data[0].userAgent, 'OnlyCats-History-Login');
  assert.deepEqual(Object.keys(history.data[0]).sort(), [
    'createdAt',
    'id',
    'ipAddress',
    'kind',
    'userAgent',
  ]);
  const other = await call('/auth/register', {
    method: 'POST',
    body: {
      name: 'Other history user',
      email: `other-${randomUUID()}@onlycats.test`,
      password,
    },
  });
  assert.equal(other.response.status, 201);
  ids.push(other.data.id);
  const otherCookie = other.response.headers.get('set-cookie').split(';')[0];
  const otherHistory = await call('/account/login-history?userId=' + ids[0], {
    cookie: otherCookie,
  });
  assert.equal(otherHistory.data.length, 1);
  assert.ok(
    otherHistory.data.every(
      (entry) => !history.data.some((own) => own.id === entry.id),
    ),
  );
  assert.deepEqual(
    (await call('/account/transactions', { cookie: otherCookie })).data,
    [],
  );
  console.log(
    'Account history smoke passed: successful login/registration history, failed-login exclusion, trusted IP handling, private fields, user isolation and authenticated transaction history.',
  );
} finally {
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
}
