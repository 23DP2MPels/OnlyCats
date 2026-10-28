import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const base = process.env.TEST_API_URL || 'http://localhost:3000/api';
async function login(email) {
  const r = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'OnlyCatsDemo2026!' }),
  });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
const id = '11111111-1111-4111-8111-111111111111';
let original;
try {
  const cookie = await login('creator@onlycats.test');
  const viewer = await login('viewer@onlycats.test');
  original = await db.cat.findUniqueOrThrow({ where: { id } });
  const bytes = await readFile('../frontend/public/cats/luna.jpg');
  const send = async (cookie, bytes) => {
    const body = new FormData();
    body.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'cat.jpg');
    return fetch(base + '/cats/' + id + '/avatar', {
      method: 'POST',
      headers: cookie ? { Cookie: cookie } : {},
      body,
    });
  };
  assert.equal((await send(null, bytes)).status, 401);
  assert.equal((await send(viewer, bytes)).status, 403);
  assert.equal((await send(cookie, Buffer.from('not an image'))).status, 400);
  assert.equal(
    (await send(cookie, Buffer.alloc(8 * 1024 * 1024 + 1))).status,
    413,
  );
  const r = await send(cookie, bytes);
  assert.equal(r.status, 201);
  const { avatar } = await r.json();
  const stored = await db.storedImage.findUniqueOrThrow({
    where: { id: avatar.split('?v=')[1] },
  });
  const image = await fetch(new URL(avatar, base).href);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(
    Buffer.from(await image.arrayBuffer()),
    Buffer.from(stored.data),
  );
  const again = await send(cookie, bytes);
  assert.equal(again.status, 201);
  assert.equal(
    await db.storedImage.findUnique({ where: { id: stored.id } }),
    null,
  );
  const json = await (await fetch(base + '/cats/' + id)).json();
  assert.equal(json.data, undefined);
  console.log(
    'Photo smoke passed: PostgreSQL byte equality, own photo upload, replacement cleanup, MIME validation, 8MB limit, ownership and anonymous access.',
  );
} finally {
  if (original) {
    const cat = await db.cat.findUnique({ where: { id } });
    await db.cat.update({ where: { id }, data: { avatar: original.avatar } });
    const key = cat.avatar.match(/\?v=([^&]+)$/)?.[1];
    if (key) await db.storedImage.deleteMany({ where: { id: key } });
  }
  await db.$disconnect();
}
