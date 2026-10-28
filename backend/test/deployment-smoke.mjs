// Run against a built API serving FRONTEND_DIST, with a disposable PostgreSQL database.
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

const base = process.env.TEST_API_URL || 'http://127.0.0.1:3000/api';
const site = base.replace(/\/api\/?$/, '');
const expectedApiUrl = process.env.API_URL || '/api';
const origins = (
  process.env.CORS_ORIGIN ||
  process.env.FRONTEND_URL ||
  'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const index = await fetch(site + '/');
assert.equal(index.status, 200);
const html = await index.text();
assert.match(html, /<div id="app"><\/div>/);
assert.ok(html.indexOf('/runtime-config.js') < html.indexOf('type="module"'));
const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
const assetResponse = await fetch(site + asset);
assert.equal(assetResponse.status, 200);
assert.match(assetResponse.headers.get('content-type'), /javascript/);

const route = await fetch(site + '/cats/11111111-1111-4111-8111-111111111111');
assert.equal(route.status, 200);
assert.equal(await route.text(), html);
const unknownApi = await fetch(base + '/does-not-exist');
assert.equal(unknownApi.status, 404);
assert.match(unknownApi.headers.get('content-type'), /json/);

const runtime = await fetch(site + '/runtime-config.js');
assert.match(runtime.headers.get('content-type'), /javascript/);
assert.match(runtime.headers.get('cache-control'), /no-store/);
const context = { window: {} };
runInNewContext(await runtime.text(), context);
assert.equal(context.window.__ONLYCATS_CONFIG__.apiUrl, expectedApiUrl);
assert.deepEqual(Object.keys(context.window.__ONLYCATS_CONFIG__), ['apiUrl']);

for (const origin of origins) {
  const response = await fetch(base + '/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(
    response.headers.get('access-control-allow-credentials'),
    'true',
  );
}
const denied = await fetch(base + '/auth/register', {
  method: 'POST',
  headers: {
    Origin: 'https://untrusted.invalid',
    'Content-Type': 'application/json',
  },
  body: '{}',
});
assert.equal(denied.status, 403);
assert.equal(denied.headers.get('access-control-allow-origin'), null);
console.log(
  'Deployment smoke passed: Vue assets, SPA routes, API 404, runtime API_URL, credentialed CORS and Origin rejection.',
);
