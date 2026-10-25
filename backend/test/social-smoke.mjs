import assert from 'node:assert/strict';
const base = process.env.TEST_API_URL || 'http://127.0.0.1:3000/api';
async function call(path, method = 'GET', cookie, body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: await response.json(),
  };
}
const catId = '11111111-1111-4111-8111-111111111111';
const creator = await call('/auth/login', 'POST', undefined, {
  email: 'creator@onlycats.test',
  password: 'OnlyCatsDemo2026!',
});
const viewer = await call('/auth/login', 'POST', undefined, {
  email: 'viewer@onlycats.test',
  password: 'OnlyCatsDemo2026!',
});
assert.equal(creator.status, 200);
assert.equal(viewer.status, 200);
const created = [];
try {
  const initial = await call('/feed');
  assert.equal(initial.status, 200);
  const locked = initial.data.items.find((post) => post.isPrivate);
  assert.ok(locked);
  assert.equal(locked.body, null);
  assert.equal(locked.imageUrl, null);
  assert.equal(locked.imageKey, undefined);
  assert.equal((await call(`/posts/${locked.id}/comments`)).status, 403);
  assert.equal(
    (await call(`/posts/${locked.id}/like`, 'PUT', viewer.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call(`/posts/${locked.id}/comments`, 'POST', viewer.cookie, {
        body: 'No access',
      })
    ).status,
    403,
  );
  assert.equal((await call('/feed?scope=subscriptions')).status, 403);
  assert.equal((await call('/feed?scope=invalid')).status, 400);
  assert.equal((await call('/feed?cursor=not-a-uuid')).status, 400);
  const first = await call(`/cats/${catId}/posts`, 'POST', creator.cookie, {
    title: 'Social smoke test',
    body: 'Temporary social post',
    isPrivate: false,
  });
  assert.equal(first.status, 201);
  const id = first.data.id;
  created.push(id);
  assert.equal((await call(`/posts/${id}/like`, 'PUT')).status, 401);
  for (let i = 0; i < 2; i++) {
    const like = await call(`/posts/${id}/like`, 'PUT', viewer.cookie);
    assert.equal(like.data.likes, 1);
  }
  assert.equal(
    (await call('/feed', 'GET', viewer.cookie)).data.items.find(
      (post) => post.id === id,
    ).liked,
    true,
  );
  assert.equal(
    (await call(`/posts/${id}/like`, 'DELETE', viewer.cookie)).data.likes,
    0,
  );
  assert.equal(
    (
      await call(`/posts/${id}/comments`, 'POST', viewer.cookie, {
        body: '   ',
      })
    ).status,
    400,
  );
  const comment = await call(`/posts/${id}/comments`, 'POST', viewer.cookie, {
    body: '  Nice cat!  ',
  });
  assert.equal(comment.status, 201);
  assert.equal(comment.data.body, 'Nice cat!');
  assert.equal(comment.data.user.passwordHash, undefined);
  assert.equal(
    (await call(`/posts/${id}/comments`)).data[0].id,
    comment.data.id,
  );
  for (let i = 0; i < 20; i++) {
    const post = await call(`/cats/${catId}/posts`, 'POST', creator.cookie, {
      title: `Social pagination ${i}`,
      body: 'Disposable pagination fixture',
      isPrivate: false,
    });
    assert.equal(post.status, 201);
    created.push(post.data.id);
  }
  const page1 = (await call('/feed')).data;
  assert.equal(page1.items.length, 20);
  assert.ok(page1.nextCursor);
  const page2 = (await call(`/feed?cursor=${page1.nextCursor}`)).data;
  const ids = [...page1.items, ...page2.items].map((post) => post.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(created.every((id) => ids.includes(id)));
  console.log(
    'Social HTTP smoke passed: persisted likes/comments, idempotent like, auth, private-post protection, input validation, cursor pagination without duplicates.',
  );
} finally {
  for (const id of created)
    await call(`/posts/${id}`, 'DELETE', creator.cookie);
}
