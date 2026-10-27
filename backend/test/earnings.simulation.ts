import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { config } from '../src/config';
import { AuthGuard, sessionToken } from '../src/auth';
import { PrismaService } from '../src/prisma.service';
import { PaypalService } from '../src/paypal.service';
import { EarningsService } from '../src/earnings.service';
import { SubscriptionsService } from '../src/subscriptions.service';
import { CreatorController } from '../src/creator.controller';
import { AccountController } from '../src/account.controller';

async function main() {
  config.paypal.baseUrl = 'http://127.0.0.1:4900/paypal';
  Object.assign(config.paypal, {
    clientId: 'simulation',
    clientSecret: 'simulation',
    planId: 'P-SIMULATION',
    webhookId: 'WH-SIMULATION',
  });
  config.jwtSecret = 'earnings-integration-test-secret-at-least-32-characters';
  const prisma = new PrismaService();
  const paypal = new PaypalService();
  const earnings = new EarningsService(prisma, paypal);
  const subscriptions = new SubscriptionsService(prisma, paypal, earnings);
  @Module({
    controllers: [CreatorController, AccountController],
    providers: [
      AuthGuard,
      { provide: PrismaService, useValue: prisma },
      { provide: EarningsService, useValue: earnings },
    ],
  })
  class TestModule {}
  const app = await NestFactory.create(TestModule, { logger: ['error'] });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const users = await Promise.all(
    ['Owner', 'Buyer', 'Other'].map((name) =>
      prisma.user.create({
        data: {
          email: `earnings-${randomUUID()}@onlycats.test`,
          name,
          passwordHash: 'not-a-login-account',
        },
      }),
    ),
  );
  const [owner, buyer, other] = users;
  const cat = await prisma.cat.create({
    data: {
      name: 'Earnings test cat',
      breed: 'Domestic',
      bio: 'Disposable earnings integration fixture',
      ownerId: owner.id,
    },
  });
  let eventId: string | undefined;
  try {
    await app.listen(0, '127.0.0.1');
    const base = (await app.getUrl()) + '/api';
    async function call(
      path: string,
      user = owner,
      method = 'GET',
      body?: unknown,
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Cookie: 'onlycats_session=' + sessionToken(user),
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json() };
    }
    assert.equal((await fetch(base + '/creator/earnings')).status, 401);
    assert.equal((await call('/creator/earnings')).data.receivedCents, 0);
    await subscriptions.checkout(buyer.id, cat.id);
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_catId: { userId: buyer.id, catId: cat.id } },
    });
    assert.equal(
      (await call('/creator/earnings/sync', owner, 'POST')).data.receivedCents,
      0,
    );
    await paypal.request('/__test/activate', 'POST', { id: sub.paypalId });
    eventId = 'EARNINGS-' + randomUUID();
    const event = {
      id: eventId,
      event_type: 'PAYMENT.SALE.COMPLETED',
      resource: { billing_agreement_id: sub.paypalId! },
    };
    await assert.rejects(() =>
      subscriptions.webhook({ 'paypal-transmission-sig': 'bad' }, event),
    );
    assert.equal(
      await prisma.ownerPayment.count({ where: { ownerId: owner.id } }),
      0,
    );
    const headers = { 'paypal-transmission-sig': 'valid-test-signature' };
    await subscriptions.webhook(headers, event);
    await subscriptions.webhook(headers, event);
    let summary = (await call('/creator/earnings/sync', owner, 'POST')).data;
    assert.equal(summary.receivedCents, 500);
    assert.equal(summary.availableCents, 500);
    assert.equal(summary.payoutsEnabled, false);
    assert.equal(summary.sandbox, true);
    assert.equal(summary.payments.length, 1);
    assert.equal((await fetch(base + '/account/transactions')).status, 401);
    const ownerTransactions = (await call('/account/transactions')).data;
    const buyerTransactions = (await call('/account/transactions', buyer)).data;
    assert.equal(ownerTransactions.length, 1);
    assert.equal(ownerTransactions[0].direction, 'INCOME');
    assert.equal(buyerTransactions[0].direction, 'EXPENSE');
    assert.equal(buyerTransactions[0].amountCents, 500);
    assert.equal(Object.hasOwn(buyerTransactions[0], 'ownerId'), false);
    assert.equal(
      (await call('/account/transactions?ownerId=' + owner.id, other)).data
        .length,
      0,
    );
    assert.equal(
      (await call('/account/transactions/sync', buyer, 'POST')).data.length,
      1,
    );
    assert.deepEqual(Object.keys(summary.payments[0]).sort(), [
      'amountCents',
      'cat',
      'id',
      'paidAt',
      'status',
    ]);
    assert.equal(
      (await call('/creator/earnings', other)).data.receivedCents,
      0,
    );
    for (const amount of ['0', '-1', '5.001', '1e2', 5]) {
      assert.equal(
        (
          await call('/creator/withdrawals', owner, 'POST', {
            amount,
            requestId: randomUUID(),
          })
        ).status,
        400,
      );
    }
    assert.equal(
      (
        await call('/creator/withdrawals', owner, 'POST', {
          amount: '1.00',
          requestId: randomUUID(),
          ownerId: other.id,
        })
      ).status,
      400,
    );
    const key = randomUUID();
    const raced = await Promise.all([
      call('/creator/withdrawals', owner, 'POST', {
        amount: '4.00',
        requestId: key,
      }),
      call('/creator/withdrawals', owner, 'POST', {
        amount: '4.00',
        requestId: randomUUID(),
      }),
    ]);
    assert.deepEqual(raced.map((r) => r.status).sort(), [201, 400]);
    const winner = raced.find((r) => r.status === 201)!.data;
    const row = await prisma.withdrawalRequest.findUniqueOrThrow({
      where: { id: winner.id },
    });
    const replay = await call('/creator/withdrawals', owner, 'POST', {
      amount: '4.00',
      requestId: row.requestId,
    });
    assert.equal(replay.data.id, winner.id);
    assert.equal(
      (
        await call('/creator/withdrawals', owner, 'POST', {
          amount: '1.00',
          requestId: row.requestId,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call('/creator/withdrawals', other, 'POST', {
          amount: '4.00',
          requestId: row.requestId,
        })
      ).status,
      409,
    );
    assert.equal(
      (await call('/creator/withdrawals/' + winner.id, other, 'DELETE')).status,
      404,
    );
    summary = (await call('/creator/earnings')).data;
    assert.equal(summary.reservedCents, 400);
    assert.equal(summary.availableCents, 100);
    assert.equal(summary.withdrawals.length, 1);
    assert.equal(
      (await call('/creator/earnings', other)).data.withdrawals.length,
      0,
    );
    await call('/creator/withdrawals/' + winner.id, owner, 'DELETE');
    await call('/creator/withdrawals/' + winner.id, owner, 'DELETE');
    assert.equal((await call('/creator/earnings')).data.availableCents, 500);
    await paypal.request('/__test/payment', 'POST', {
      subscriptionId: sub.paypalId,
      id: 'TX-RENEWAL-' + sub.id,
      amount: '2.29',
    });
    await paypal.request('/__test/payment', 'POST', {
      subscriptionId: sub.paypalId,
      id: 'TX-PENDING-' + sub.id,
      amount: '99.00',
      status: 'PENDING',
    });
    for (let i = 0; i < 2; i++) {
      summary = (await call('/creator/earnings/sync', owner, 'POST')).data;
      assert.equal(summary.receivedCents, 729);
      assert.equal(summary.payments.length, 2);
    }
    await paypal.request('/__test/transaction-failure', 'POST', {
      id: sub.paypalId,
      enabled: true,
    });
    assert.equal(
      (await call('/creator/earnings/sync', owner, 'POST')).status,
      503,
    );
    assert.equal((await call('/creator/earnings')).data.receivedCents, 729);
    await paypal.request('/__test/transaction-failure', 'POST', {
      id: sub.paypalId,
      enabled: false,
    });
    await subscriptions.cancel(buyer.id, sub.id);
    assert.equal((await call('/creator/earnings')).data.receivedCents, 729);
    await paypal.request('/__test/payment', 'POST', {
      subscriptionId: sub.paypalId,
      id: `TX-${sub.paypalId}-1`,
      status: 'REFUNDED',
    });
    summary = (await call('/creator/earnings/sync', owner, 'POST')).data;
    assert.equal(summary.receivedCents, 229);
    assert.equal(
      summary.payments.find((p: { status: string }) => p.status === 'REFUNDED')
        .amountCents,
      500,
    );
    assert.equal(
      (await new EarningsService(prisma, paypal).summary(owner.id))
        .availableCents,
      229,
    );
    // Simulate a delayed old COMPLETED response after a known refund.
    await paypal.request('/__test/payment', 'POST', {
      subscriptionId: sub.paypalId,
      id: `TX-${sub.paypalId}-1`,
      status: 'COMPLETED',
    });
    summary = (await call('/creator/earnings/sync', owner, 'POST')).data;
    assert.equal(summary.receivedCents, 229);
    console.log(
      'Earnings integration passed: real PostgreSQL + PayPal HTTP, verified receipts, renewals, duplicate events/sync, owner isolation, DTOs, idempotent/concurrent requests, cancellation, refunds and upstream failure. No payout calls.',
    );
  } finally {
    if (eventId)
      await prisma.webhookEvent.deleteMany({ where: { id: eventId } });
    await prisma.withdrawalRequest.deleteMany({
      where: { ownerId: { in: users.map((u) => u.id) } },
    });
    await prisma.ownerPayment.deleteMany({ where: { ownerId: owner.id } });
    await prisma.subscription.deleteMany({ where: { catId: cat.id } });
    await prisma.cat.delete({ where: { id: cat.id } });
    await prisma.user.deleteMany({
      where: { id: { in: users.map((u) => u.id) } },
    });
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
