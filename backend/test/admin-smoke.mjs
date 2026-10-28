// Run against a disposable migrated database and a running local API.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const base = process.env.TEST_API_URL || 'http://127.0.0.1:3000/api';
const ids = [];
async function call(path, cookie, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
try {
  const suffix = randomUUID();
  const register = async (name) => {
    const result = await call('/auth/register', null, 'POST', {
      name,
      email: `${name}-${suffix}@onlycats.test`,
      password: 'OnlyCatsAdmin2026!',
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.isAdmin, false);
    ids.push(result.data.id);
    return result;
  };
  const admin = await register('Admin');
  const viewer = await register('Viewer');
  const other = await register('Other');
  await db.user.update({
    where: { id: admin.data.id },
    data: { isAdmin: true },
  });
  const rejected = await call('/auth/register', null, 'POST', {
    name: 'Attack',
    email: `attack-${suffix}@onlycats.test`,
    password: 'OnlyCatsAdmin2026!',
    isAdmin: true,
  });
  assert.equal(rejected.status, 400);
  const body = { name: 'Updated', email: other.data.email, isAdmin: true };
  for (const path of ['/admin/users', '/admin/posts', '/admin/withdrawals']) {
    assert.equal((await call(path)).status, 401);
    assert.equal((await call(path, viewer.cookie)).status, 403);
  }
  assert.equal(
    (await call(`/admin/users/${other.data.id}`, viewer.cookie, 'PATCH', body))
      .status,
    403,
  );
  let result = await call(`/admin/users?search=${suffix}`, admin.cookie);
  assert.equal(result.status, 200);
  assert.equal(result.data.total, 3);
  assert.equal(result.data.pageSize, 20);
  assert.ok(!JSON.stringify(result.data).includes('passwordHash'));
  const extraUsers = Array.from({ length: 21 }, (_, index) => ({
    id: randomUUID(),
    name: `Page ${index}`,
    email: `page-${index}-${suffix}@onlycats.test`,
    passwordHash: 'unused-test-hash',
  }));
  ids.push(...extraUsers.map((user) => user.id));
  await db.user.createMany({ data: extraUsers });
  const firstPage = (
    await call(`/admin/users?search=${suffix}&page=1`, admin.cookie)
  ).data;
  const secondPage = (
    await call(`/admin/users?search=${suffix}&page=2`, admin.cookie)
  ).data;
  assert.equal(firstPage.total, 24);
  assert.equal(firstPage.items.length, 20);
  assert.equal(secondPage.items.length, 4);
  assert.equal(
    new Set([...firstPage.items, ...secondPage.items].map((user) => user.id))
      .size,
    24,
  );
  assert.equal((await call('/admin/users?page=0', admin.cookie)).status, 400);
  assert.equal(
    (
      await call(`/admin/users/${other.data.id}`, admin.cookie, 'PATCH', {
        ...body,
        isAdmin: 'true',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/admin/users/${other.data.id}`, admin.cookie, 'PATCH', {
        ...body,
        passwordHash: 'attack',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/admin/users/${other.data.id}`, admin.cookie, 'PATCH', {
        ...body,
        email: viewer.data.email.toUpperCase(),
      })
    ).status,
    409,
  );
  result = await call(`/admin/users/${other.data.id}`, admin.cookie, 'PATCH', {
    ...body,
    name: '  Updated user  ',
    email: `  UPDATED-${suffix}@ONLYCATS.TEST  `,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.name, 'Updated user');
  assert.equal(result.data.email, `updated-${suffix}@onlycats.test`);
  assert.equal((await call('/admin/users', other.cookie)).status, 200);
  assert.equal(
    (
      await call(`/admin/users/${admin.data.id}`, admin.cookie, 'PATCH', {
        name: 'Admin',
        email: admin.data.email,
        isAdmin: false,
      })
    ).status,
    400,
  );
  const cat = await db.cat.create({
    data: {
      name: 'Moderation cat',
      breed: 'Test cat',
      bio: 'A cat for moderation tests',
      ownerId: viewer.data.id,
    },
  });
  const image = await db.storedImage.create({
    data: { data: new Uint8Array([1, 2, 3]) },
  });
  const post = await db.post.create({
    data: {
      catId: cat.id,
      title: `Private-${suffix}`,
      body: 'Private text',
      isPrivate: true,
      imageKey: image.id,
    },
  });
  await db.comment.create({
    data: { userId: viewer.data.id, postId: post.id, body: 'Test' },
  });
  await db.like.create({ data: { userId: viewer.data.id, postId: post.id } });
  result = await call(`/admin/posts?search=${suffix}`, admin.cookie);
  assert.equal(result.data.items[0].body, 'Private text');
  assert.equal(
    (await call(`/posts/${post.id}`, other.cookie, 'DELETE')).status,
    200,
  );
  assert.equal(await db.post.count({ where: { id: post.id } }), 0);
  assert.equal(await db.storedImage.count({ where: { id: image.id } }), 0);
  assert.equal(await db.comment.count({ where: { postId: post.id } }), 0);
  assert.equal(await db.like.count({ where: { postId: post.id } }), 0);
  await call(`/admin/users/${other.data.id}`, admin.cookie, 'PATCH', {
    name: 'Updated user',
    email: `updated-${suffix}@onlycats.test`,
    isAdmin: false,
  });
  assert.equal((await call('/admin/posts', other.cookie)).status, 403);
  const remaining = await db.post.create({
    data: {
      catId: cat.id,
      title: 'Keep this post',
      body: 'Test',
      isPrivate: false,
    },
  });
  assert.equal(
    (await call(`/posts/${remaining.id}`, other.cookie, 'DELETE')).status,
    403,
  );
  assert.equal(await db.post.count({ where: { id: remaining.id } }), 1);
  assert.equal(
    (await call(`/admin/users/${randomUUID()}`, admin.cookie, 'PATCH', body))
      .status,
    404,
  );
  console.log(
    'Admin HTTP checks passed: access control, validation, updates, immediate revocation and post/image/comment deletion.',
  );
} finally {
  await db.cat.deleteMany({ where: { ownerId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
}
