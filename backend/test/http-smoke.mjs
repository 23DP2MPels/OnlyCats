// Run against a disposable, seeded local database: npm run test:http -w backend
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = process.env.TEST_API_URL || 'http://127.0.0.1:3000/api';
async function call(path, { method = 'GET', body, cookie, origin } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  return {
    response,
    data: response.headers.get('content-type')?.includes('json')
      ? await response.json()
      : null,
  };
}
const catId = '11111111-1111-4111-8111-111111111111';
const publicPosts = await call(`/cats/${catId}/posts`);
assert.equal(publicPosts.response.status, 200);
const locked = publicPosts.data.find((post) => post.isPrivate);
assert.equal(locked.locked, true);
assert.equal(locked.body, null);
assert.equal(locked.imageUrl, null);
assert.equal((await call(`/posts/${locked.id}/image`)).response.status, 403);
assert.equal((await call('/cats/not-a-uuid')).response.status, 400);
assert.equal(
  (await call('/cats', { method: 'POST', body: {} })).response.status,
  401,
);
assert.equal(
  (
    await call('/auth/login', {
      method: 'POST',
      body: { email: 'creator@onlycats.test', password: 'OnlyCatsDemo2026!' },
      origin: 'https://untrusted.example',
    })
  ).response.status,
  403,
);
const login = await call('/auth/login', {
  method: 'POST',
  body: { email: 'creator@onlycats.test', password: 'OnlyCatsDemo2026!' },
});
assert.equal(login.response.status, 200);
assert.equal(login.data.passwordHash, undefined);
const cookie = login.response.headers.get('set-cookie').split(';')[0];
assert.ok(login.response.headers.get('set-cookie').includes('HttpOnly'));
assert.equal(
  (await call(`/posts/${locked.id}/image`, { cookie })).response.status,
  200,
);
assert.equal(
  (
    await call('/cats', {
      method: 'POST',
      cookie,
      body: { name: 'X', breed: 'XX', bio: 'too short' },
    })
  ).response.status,
  400,
);
const viewer = await call('/auth/login', {
  method: 'POST',
  body: { email: 'viewer@onlycats.test', password: 'OnlyCatsDemo2026!' },
});
const viewerCookie = viewer.response.headers.get('set-cookie').split(';')[0];
assert.equal(
  (await call(`/posts/${locked.id}/image`, { cookie: viewerCookie })).response
    .status,
  403,
);
assert.equal(
  (
    await call(`/cats/${catId}`, {
      method: 'PATCH',
      cookie: viewerCookie,
      body: {
        name: 'Чужой кот',
        breed: 'Домашний',
        bio: 'Не должно быть разрешено',
      },
    })
  ).response.status,
  403,
);
assert.equal(
  (await call('/admin/users', { cookie: viewerCookie })).response.status,
  403,
);
let created;
try {
  created = await call(`/cats/${catId}/posts`, {
    method: 'POST',
    cookie,
    body: {
      title: 'HTTP smoke test',
      body: 'Disposable private photo',
      isPrivate: true,
    },
  });
  assert.equal(created.response.status, 201);
  const badFile = new FormData();
  badFile.append(
    'file',
    new Blob(['not an image'], { type: 'image/jpeg' }),
    'fake.jpg',
  );
  assert.equal(
    (
      await call(`/posts/${created.data.id}/image`, {
        method: 'POST',
        cookie,
        body: badFile,
      })
    ).response.status,
    400,
  );
  const validFile = new FormData();
  validFile.append(
    'file',
    new Blob(
      [
        await readFile(
          new URL('../uploads/seed-marmalade-0.jpg', import.meta.url),
        ),
      ],
      { type: 'image/jpeg' },
    ),
    'cat.jpg',
  );
  assert.equal(
    (
      await call(`/posts/${created.data.id}/image`, {
        method: 'POST',
        cookie,
        body: validFile,
      })
    ).response.status,
    201,
  );
  const ownImage = await call(`/posts/${created.data.id}/image`, { cookie });
  assert.equal(ownImage.response.status, 200);
  assert.equal(
    ownImage.response.headers.get('cache-control'),
    'private, no-store',
  );
  assert.equal(
    (await call(`/posts/${created.data.id}/image`, { cookie: viewerCookie }))
      .response.status,
    403,
  );
} finally {
  if (created?.data?.id)
    await call(`/posts/${created.data.id}`, { method: 'DELETE', cookie });
}
const registration = await call('/auth/register', {
  method: 'POST',
  body: {
    name: 'Smoke Test',
    email: `smoke-${Date.now()}@onlycats.test`,
    password: 'SmokeTestOnly2026!',
  },
});
assert.equal(registration.response.status, 201);
assert.equal(registration.data.passwordHash, undefined);
const registrationCookie = registration.response.headers
  .get('set-cookie')
  .split(';')[0];
assert.equal(
  (await call('/auth/me', { cookie: registrationCookie })).data.id,
  registration.data.id,
);
console.log(
  'HTTP smoke passed: auth, DTO validation, ownership, private-file protection, image validation/upload, admin denial, CSRF origin check.',
);
