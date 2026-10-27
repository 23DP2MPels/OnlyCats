import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config } from '../src/config';
import { PrismaService } from '../src/prisma.service';
import { PaypalService } from '../src/paypal.service';
import { SubscriptionsService } from '../src/subscriptions.service';
import { hasPaidAccess } from '../src/access';

async function main() {
  config.paypal.baseUrl = 'http://127.0.0.1:4900/paypal';
  Object.assign(config.paypal, {
    clientId: 'simulation',
    clientSecret: 'simulation',
    planId: 'P-SIMULATION',
    webhookId: 'WH-SIMULATION',
  });
  const prisma = new PrismaService();
  const paypal = new PaypalService();
  const service = new SubscriptionsService(prisma, paypal);
  const user = await prisma.user.create({
    data: {
      email: `simulation-${randomUUID()}@onlycats.test`,
      name: 'Disposable integration user',
      passwordHash: 'not-a-login-account',
    },
  });
  const catId = '11111111-1111-4111-8111-111111111111';
  const eventId = `EVENT-${randomUUID()}`;
  try {
    const first = await service.checkout(user.id, catId);
    assert.match(first.approvalUrl!, /^https:\/\/www\.sandbox\.paypal\.com/);
    assert.equal(
      (await service.checkout(user.id, catId)).approvalUrl,
      first.approvalUrl,
    );
    const sub = (await prisma.subscription.findUnique({
      where: { userId_catId: { userId: user.id, catId } },
    }))!;
    assert.equal(hasPaidAccess(sub), false);
    await assert.rejects(
      () => service.confirm('another-user', sub.paypalId!),
      (error) => (error as { getStatus(): number }).getStatus() === 404,
    );
    await paypal.request('/__test/activate', 'POST', { id: sub.paypalId });
    const event = {
      id: eventId,
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: { id: sub.paypalId! },
    };
    await assert.rejects(() =>
      service.webhook({ 'paypal-transmission-sig': 'invalid' }, event),
    );
    assert.equal(
      await prisma.webhookEvent.count({ where: { id: eventId } }),
      0,
    );
    const headers = { 'paypal-transmission-sig': 'valid-test-signature' };
    await service.webhook(headers, event);
    await service.webhook(headers, event);
    assert.equal(
      await prisma.webhookEvent.count({ where: { id: eventId } }),
      1,
    );
    assert.equal(
      hasPaidAccess(await service.confirm(user.id, sub.paypalId!)),
      true,
    );
    await assert.rejects(() => service.checkout(user.id, catId), /активна/);
    assert.equal(hasPaidAccess(await service.cancel(user.id, sub.id)), false);
    assert.equal((await service.cancel(user.id, sub.id)).status, 'CANCELLED');
    console.log(
      'Subscription integration passed: real SQLite + PayPal HTTP simulation, repeated checkout, ownership, invalid signature, duplicate webhook, paid access and idempotent cancellation.',
    );
  } finally {
    await prisma.webhookEvent.deleteMany({ where: { id: eventId } });
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
