import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const directory = new URL('../src/locales/', import.meta.url);
const catalogs = Object.fromEntries(
  await Promise.all(
    ['ru', 'lv', 'en'].map(async (locale) => [
      locale,
      JSON.parse(await readFile(new URL(`${locale}.json`, directory), 'utf8')),
    ]),
  ),
);
test('Latvian and English cover every source string with nonempty translated text', () => {
  for (const locale of ['lv', 'en']) {
    assert.deepEqual(
      Object.keys(catalogs[locale]).sort(),
      Object.keys(catalogs.ru).sort(),
    );
    for (const [key, value] of Object.entries(catalogs[locale])) {
      assert.ok(typeof value === 'string' && value.trim(), `${locale}: ${key}`);
      assert.equal(
        /[А-Яа-яЁё]/.test(value),
        false,
        `${locale} has an untranslated Russian value: ${key}`,
      );
    }
  }
});
test('every literal translation used by a Vue page exists in the catalogs', async () => {
  const views = new URL('../src/views/', import.meta.url);
  const files = [
    new URL('../src/App.vue', import.meta.url),
    ...(await readdir(new URL('../src/components/', import.meta.url)))
      .filter((file) => file.endsWith('.vue'))
      .map((file) => new URL(`../src/components/${file}`, import.meta.url)),
    ...(await readdir(views)).map((file) => new URL(file, views)),
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/\bt\('([^']+)'\)/g))
      assert.ok(
        Object.hasOwn(catalogs.ru, match[1]),
        `${file.pathname}: ${match[1]}`,
      );
  }
});
