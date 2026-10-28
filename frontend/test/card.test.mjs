import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(
  new URL('../src/card.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { validCardNumber } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
);
test('Luhn validates standard test numbers and formatted input', () => {
  for (const value of [
    '4111111111111111',
    '4111 1111 1111 1111',
    '5555-5555-5555-4444',
    '378282246310005',
  ])
    assert.equal(validCardNumber(value), true, value);
});
test('Luhn rejects invalid checksum, invalid format and length', () => {
  for (const value of [
    '',
    '0'.repeat(16),
    '4111111111111112',
    '4111x111111111111',
    '41111111111',
    '41111111111111111111',
  ])
    assert.equal(validCardNumber(value), false, value);
});
test('withdrawal payload excludes card number', async () => {
  const view = await readFile(
    new URL('../src/components/CreatorEarnings.vue', import.meta.url),
    'utf8',
  );
  const payload = view.match(/body: JSON.stringify\(\{([\s\S]*?)\}\)/)?.[1];
  assert.ok(payload);
  assert.doesNotMatch(payload, /card/i);
});
