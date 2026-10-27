import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usdCents } from '../src/money';

test('USD amounts preserve cents exactly', () => {
  assert.equal(usdCents('0.01'), 1);
  assert.equal(usdCents('0.29'), 29);
  assert.equal(usdCents('5'), 500);
  assert.equal(usdCents('1.2'), 120);
});

test('USD amounts reject zero, fractions of cents and non-decimal representations', () => {
  for (const value of [
    '0',
    '0.00',
    '-1',
    '1.001',
    '1e2',
    'NaN',
    'Infinity',
    '5,00',
    ' 5',
    '01',
    '99999999',
  ])
    assert.throws(() => usdCents(value));
});
