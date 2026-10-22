import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPaidAccess,
  verifiedSubscriptionState,
  type PaypalDetails,
} from '../src/access';
const now = new Date('2026-10-25T12:00:00Z');
test('access requires an active and unexpired paid subscription', () => {
  assert.equal(hasPaidAccess(null, now), false);
  assert.equal(
    hasPaidAccess(
      { status: 'PENDING', paidUntil: new Date('2026-11-01') },
      now,
    ),
    false,
  );
  assert.equal(
    hasPaidAccess(
      { status: 'CANCELLED', paidUntil: new Date('2026-11-01') },
      now,
    ),
    false,
  );
  assert.equal(
    hasPaidAccess({ status: 'ACTIVE', paidUntil: null }, now),
    false,
  );
  assert.equal(hasPaidAccess({ status: 'ACTIVE', paidUntil: now }, now), false);
  assert.equal(
    hasPaidAccess({ status: 'ACTIVE', paidUntil: new Date('2026-11-01') }, now),
    true,
  );
});
const details: PaypalDetails = {
  id: 'I-TEST',
  status: 'ACTIVE',
  custom_id: 'local-id',
  plan_id: 'P-TEST',
  billing_info: {
    next_billing_time: '2026-11-01T00:00:00Z',
    last_payment: {
      time: '2026-10-01T00:00:00Z',
      amount: { value: '5.00', currency_code: 'USD' },
    },
  },
};
const expected = { paypalId: 'I-TEST', id: 'local-id', planId: 'P-TEST' };
test('an approved subscription without a confirmed payment grants no access', () => {
  const state = verifiedSubscriptionState(
    { ...details, billing_info: { next_billing_time: '2026-11-01T00:00:00Z' } },
    expected,
  );
  assert.equal(hasPaidAccess(state, now), false);
});
test('provider details must match subscription, local binding and plan', () => {
  for (const change of [
    { id: 'I-OTHER' },
    { custom_id: 'other-user-subscription' },
    { plan_id: 'P-CHEAPER' },
  ])
    assert.throws(
      () => verifiedSubscriptionState({ ...details, ...change }, expected),
      /mismatch/,
    );
});
test('invalid provider dates and zero payments never unlock photos', () => {
  assert.equal(
    verifiedSubscriptionState(
      {
        ...details,
        billing_info: { ...details.billing_info, next_billing_time: 'invalid' },
      },
      expected,
    ).paidUntil,
    null,
  );
  assert.equal(
    verifiedSubscriptionState(
      {
        ...details,
        billing_info: {
          ...details.billing_info,
          last_payment: {
            time: '2026-10-01',
            amount: { value: '0', currency_code: 'USD' },
          },
        },
      },
      expected,
    ).paidUntil,
    null,
  );
});
test('a confirmed paid sandbox subscription unlocks content until its billing boundary', () => {
  const state = verifiedSubscriptionState(details, expected);
  assert.equal(hasPaidAccess(state, now), true);
  assert.equal(hasPaidAccess(state, new Date('2026-11-01T00:00:00Z')), false);
});
