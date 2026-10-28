import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config } from '../src/config';
import { PaypalService } from '../src/paypal.service';
import { hasPaidAccess, verifiedSubscriptionState } from '../src/access';
async function main() {
  // Override inside this test process only; production has no PayPal URL setting.
  config.paypal.baseUrl = 'http://127.0.0.1:4900/paypal';
  Object.assign(config.paypal, {
    clientId: 'simulation',
    clientSecret: 'simulation',
    planId: 'P-SIMULATION',
    webhookId: 'WH-SIMULATION',
  });
  const paypal = new PaypalService();
  const localId = randomUUID();
  const key = randomUUID();
  const created = await paypal.createSubscription(localId, key);
  assert.equal((await paypal.createSubscription(localId, key)).id, created.id);
  const expected = {
    id: localId,
    paypalId: created.id,
    planId: config.paypal.planId,
  };
  assert.equal(
    hasPaidAccess(
      verifiedSubscriptionState(await paypal.details(created.id), expected),
    ),
    false,
  );
  await paypal.request('/__test/activate', 'POST', { id: created.id });
  assert.equal(
    hasPaidAccess(
      verifiedSubscriptionState(await paypal.details(created.id), expected),
    ),
    true,
  );
  assert.equal(
    await paypal.verifyWebhook(
      { 'paypal-transmission-sig': 'valid-test-signature' },
      { id: 'WH-EVENT' },
    ),
    true,
  );
  assert.equal(
    await paypal.verifyWebhook(
      { 'paypal-transmission-sig': 'invalid' },
      { id: 'WH-EVENT' },
    ),
    false,
  );
  await paypal.cancel(created.id);
  assert.equal(
    hasPaidAccess(
      verifiedSubscriptionState(await paypal.details(created.id), expected),
    ),
    false,
  );
  await assert.rejects(
    () => paypal.details('I-DOESNOTEXIST'),
    /PayPal Sandbox/,
  );
  config.paypal.baseUrl = 'http://127.0.0.1:1';
  await assert.rejects(() => paypal.details(created.id), /PayPal Sandbox/);
  console.log(
    'PayPal HTTP simulation passed: OAuth, idempotent create, pending/paid/cancelled state, valid/invalid signature, provider 404, unreachable provider.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
