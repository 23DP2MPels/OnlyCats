import { ref, watchEffect } from 'vue';
import ru from './locales/ru.json';
import lv from './locales/lv.json';
import en from './locales/en.json';

export type Locale = 'lv' | 'ru' | 'en';
export const languages: { code: Locale; name: string }[] = [
  { code: 'lv', name: 'Latviešu' },
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
];
function saved(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private browser mode can disable storage. */
  }
}
const preferred = saved('onlycats-language');
export const locale = ref<Locale>(
  preferred === 'ru' || preferred === 'en' ? preferred : 'lv',
);
const palettes = saved('onlycats-theme');
export const theme = ref<'light' | 'dark'>(
  palettes === 'dark' ||
    (palettes !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? 'dark'
    : 'light',
);
const catalogs: Record<Locale, Record<string, string>> = { ru, lv, en };

export function t(key: string): string {
  if (!key) return '';
  if (catalogs[locale.value][key] !== undefined)
    return catalogs[locale.value][key];
  if (
    /must be|must contain|should not|must match|must not|longer than|shorter than/.test(
      key,
    )
  )
    return ui('validation');
  const generic: Record<string, string> = {
    'Failed to fetch': 'network',
    'NetworkError when attempting to fetch resource.': 'network',
    'Internal server error': 'server',
    Forbidden: 'forbidden',
    'Forbidden resource': 'forbidden',
    Unauthorized: 'unauthorized',
    'Not Found': 'notFound',
    'File too large': 'fileTooLarge',
    'Invalid PayPal signature': 'invalidSignature',
    'Missing event id': 'invalidSignature',
    'PAYPAL_WEBHOOK_ID is not configured': 'paypalMissing',
  };
  if (generic[key]) return ui(generic[key]);
  return key;
}
const interfaceText: Record<string, Record<Locale, string>> = {
  language: { lv: 'Valoda', ru: 'Язык', en: 'Language' },
  dark: {
    lv: 'Ieslēgt tumšo tēmu',
    ru: 'Включить тёмную тему',
    en: 'Switch to dark theme',
  },
  light: {
    lv: 'Ieslēgt gaišo tēmu',
    ru: 'Включить светлую тему',
    en: 'Switch to light theme',
  },
  validation: {
    lv: 'Pārbaudi ievadītos laukus un to garumu.',
    ru: 'Проверьте заполнение и длину полей формы.',
    en: 'Check the form fields and their lengths.',
  },
  network: {
    lv: 'Neizdevās sasniegt serveri. Mēģini vēlreiz.',
    ru: 'Не удалось связаться с сервером. Попробуйте ещё раз.',
    en: 'Could not reach the server. Please try again.',
  },
  server: {
    lv: 'Servera kļūda. Mēģini vēlāk.',
    ru: 'Ошибка сервера. Попробуйте позже.',
    en: 'Server error. Please try again later.',
  },
  forbidden: {
    lv: 'Tev nav piekļuves šai darbībai.',
    ru: 'У вас нет доступа к этому действию.',
    en: 'You do not have permission for this action.',
  },
  unauthorized: {
    lv: 'Lūdzu, pieslēdzies.',
    ru: 'Войдите в аккаунт.',
    en: 'Please sign in.',
  },
  notFound: { lv: 'Nav atrasts.', ru: 'Не найдено.', en: 'Not found.' },
  fileTooLarge: {
    lv: 'Attēls nedrīkst pārsniegt 8 MB.',
    ru: 'Фотография должна быть не больше 8 МБ.',
    en: 'The photo must be no larger than 8 MB.',
  },
  invalidSignature: {
    lv: 'Neizdevās pārbaudīt PayPal paziņojumu.',
    ru: 'Не удалось проверить уведомление PayPal.',
    en: 'Could not verify the PayPal notification.',
  },
  paypalMissing: {
    lv: 'PayPal Sandbox vēl nav konfigurēts.',
    ru: 'PayPal Sandbox ещё не настроен.',
    en: 'PayPal Sandbox is not configured yet.',
  },
  title: {
    lv: 'OnlyCats — katram kaķim savs stāsts',
    ru: 'OnlyCats — у каждого кота своя история',
    en: 'OnlyCats — every cat has a story',
  },
};
export function ui(key: string) {
  return interfaceText[key]?.[locale.value] || key;
}
export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
}
watchEffect(() => {
  document.documentElement.lang = locale.value;
  document.documentElement.dataset.theme = theme.value;
  document.title = ui('title');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.value === 'dark' ? '#191c21' : '#faf8f5');
  persist('onlycats-language', locale.value);
  persist('onlycats-theme', theme.value);
});
