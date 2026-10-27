import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const base = process.env.TEST_API_URL || 'http://localhost:3000/api';
const password = 'TemporaryOnlyCats2026!';
const users = [];
async function call(path, method = 'GET', body, cookie) {
  const r = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await r.text();
  return {
    status: r.status,
    data: text ? JSON.parse(text) : null,
    cookie: r.headers.get('set-cookie')?.split(';')[0],
  };
}
try {
  const tag = randomUUID().slice(0, 8);
  for (const name of ['Owner', 'Viewer', 'Stranger']) {
    const email = `lifecycle-${tag}-${name.toLowerCase()}@onlycats.test`;
    const r = await call('/auth/register', 'POST', {
      email,
      name: 'Lifecycle ' + tag + ' ' + name,
      password,
    });
    assert.equal(r.status, 201);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    users.push({ id: user.id, cookie: r.cookie });
  }
  const [owner, viewer, stranger] = users;
  const cat = await call(
    '/cats',
    'POST',
    {
      name: 'Lifecycle ' + tag,
      breed: 'Home cat',
      bio: 'A temporary cat profile for HTTP verification.',
    },
    owner.cookie,
  );
  assert.equal(cat.status, 201);
  const catId = cat.data.id;
  const post = await call(
    '/cats/' + catId + '/posts',
    'POST',
    { title: 'A private post', body: 'Gift-only secret', isPrivate: true },
    owner.cookie,
  );
  assert.equal(post.status, 201);
  const id = post.data.id;
  assert.equal(
    (await call('/posts/' + id, 'DELETE', undefined, stranger.cookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        '/cats/' + catId + '/gifts',
        'POST',
        { userId: viewer.id },
        stranger.cookie,
      )
    ).status,
    403,
  );
  const gift = await call(
    '/cats/' + catId + '/gifts',
    'POST',
    { userId: viewer.id },
    owner.cookie,
  );
  assert.equal(gift.status, 201);
  let sub = await db.subscription.findUniqueOrThrow({
    where: { id: gift.data.id },
  });
  assert.equal(sub.paypalId, null);
  assert.equal(
    await db.ownerPayment.count({ where: { subscriptionId: sub.id } }),
    0,
  );
  assert.equal(
    (await call('/cats/' + catId + '/posts', 'GET', undefined, viewer.cookie))
      .data[0].locked,
    false,
  );
  assert.equal(
    (
      await call('/feed?scope=subscriptions', 'GET', undefined, viewer.cookie)
    ).data.items.some((p) => p.id === id),
    true,
  );
  assert.equal(
    (await call('/cats/' + catId + '/posts', 'GET', undefined, stranger.cookie))
      .data[0].locked,
    true,
  );
  const until = sub.giftUntil.getTime();
  assert.equal(
    (await call('/subscriptions/' + sub.id, 'DELETE', undefined, viewer.cookie))
      .status,
    200,
  );
  sub = await db.subscription.findUniqueOrThrow({ where: { id: sub.id } });
  assert.equal(sub.giftUntil.getTime(), until);
  assert.equal(
    (await call('/cats/' + catId + '/posts', 'GET', undefined, viewer.cookie))
      .data[0].locked,
    false,
  );
  await db.subscription.update({
    where: { id: sub.id },
    data: { giftUntil: new Date(Date.now() - 1000) },
  });
  assert.equal(
    (await call('/cats/' + catId + '/posts', 'GET', undefined, viewer.cookie))
      .data[0].locked,
    true,
  );
  // Paid cancellation remains accessible until its original boundary too.
  const paidUntil = new Date(Date.now() + 86400000);
  await db.subscription.update({
    where: { id: sub.id },
    data: { status: 'ACTIVE', paidUntil, giftUntil: null },
  });
  await call('/subscriptions/' + sub.id, 'DELETE', undefined, viewer.cookie);
  assert.equal(
    (
      await db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    ).paidUntil.getTime(),
    paidUntil.getTime(),
  );
  assert.equal(
    (await call('/cats/' + catId + '/posts', 'GET', undefined, viewer.cookie))
      .data[0].locked,
    false,
  );
  assert.equal(
    (await call('/feed', 'GET', undefined, viewer.cookie)).data.items.find(
      (p) => p.id === id,
    ).locked,
    false,
  );
  await db.subscription.update({
    where: { id: sub.id },
    data: { paidUntil: new Date(Date.now() - 1000) },
  });
  assert.equal(
    (await call('/cats/' + catId + '/posts', 'GET', undefined, viewer.cookie))
      .data[0].locked,
    true,
  );
  // Number and localized decimal inputs both arrive at the integer-cent ledger.
  await db.ownerPayment.create({
    data: {
      paypalTransactionId: 'test-' + tag,
      paypalSubscriptionId: 'TEST',
      subscriptionId: sub.id,
      ownerId: owner.id,
      catId,
      amountCents: 1234,
      status: 'COMPLETED',
      paidAt: new Date(),
    },
  });
  for (const amount of [12.34, '12,34', ' 12.34 ']) {
    const r = await call(
      '/creator/withdrawals',
      'POST',
      { amount, requestId: randomUUID() },
      owner.cookie,
    );
    assert.equal(r.status, 201, JSON.stringify(r.data));
    const request = await db.withdrawalRequest.findUniqueOrThrow({
      where: { id: r.data.id },
    });
    assert.equal(request.amountCents, 1234);
    await call(
      '/creator/withdrawals/' + r.data.id,
      'DELETE',
      undefined,
      owner.cookie,
    );
  }
  for (const amount of ['1.001', '1e2', -1])
    assert.equal(
      (
        await call(
          '/creator/withdrawals',
          'POST',
          { amount, requestId: randomUUID() },
          owner.cookie,
        )
      ).status,
      400,
    );
  const results = await call('/search?q=' + encodeURIComponent(tag));
  assert.equal(results.status, 200);
  assert.ok(results.data.users.some((u) => u.id === owner.id));
  assert.ok(results.data.cats.some((c) => c.id === catId));
  assert.equal(JSON.stringify(results.data).includes('passwordHash'), false);
  assert.equal(JSON.stringify(results.data).includes('@onlycats.test'), false);
  const profile = await call('/users/' + owner.id);
  assert.equal(profile.data.cats[0].id, catId);
  assert.equal(
    (await call('/posts/' + id, 'DELETE', undefined, owner.cookie)).status,
    200,
  );
  assert.equal((await call('/posts/' + id + '/comments')).status, 404);
  await call(
    '/cats/' + catId + '/posts',
    'POST',
    { title: 'Delete with account', body: 'Cleanup me', isPrivate: false },
    owner.cookie,
  );
  assert.equal(
    (await call('/account', 'DELETE', { password: 'wrong' }, owner.cookie))
      .status,
    400,
  );
  assert.equal(
    (await call('/account', 'DELETE', { password }, owner.cookie)).status,
    200,
  );
  assert.equal(
    (await call('/account', 'GET', undefined, owner.cookie)).status,
    401,
  );
  assert.equal((await call('/users/' + owner.id)).status, 404);
  assert.equal(await db.cat.count({ where: { ownerId: owner.id } }), 0);
  console.log(
    'Lifecycle HTTP passed: owner-only deletion, account cleanup/session invalidation, free gifts, cancellation boundaries, search privacy and numeric/comma USD input.',
  );
} finally {
  for (const user of users)
    if (await db.user.findUnique({ where: { id: user.id } })) {
      const r = await call('/account', 'DELETE', { password }, user.cookie);
      assert.equal(r.status, 200, 'Fixture cleanup failed');
    }
  await db.$disconnect();
}
