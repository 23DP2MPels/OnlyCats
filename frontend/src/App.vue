<script setup lang="ts">
import { t, ui, locale, languages, theme, toggleTheme } from './i18n';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { session, loadSession, logout } from './api';
import UiIcon from './components/UiIcon.vue';
const router = useRouter();
const error = ref('');
onMounted(() =>
  loadSession().catch(() => {
    error.value = 'Сервер пока недоступен. Проверьте запуск backend.';
  }),
);
async function signOut() {
  try {
    await logout();
    await router.push('/');
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>
<template>
  <div class="site-shell">
    <header class="header wrap">
      <RouterLink to="/" class="logo" :aria-label="t('OnlyCats — главная')"
        ><img class="logo-mark" src="/cat-logo.svg" alt="" />only<span
          >cats</span
        ><span class="logo-dot">.</span></RouterLink
      >
      <nav :aria-label="t('Основная навигация')">
        <RouterLink to="/">{{ t('Лента') }}</RouterLink>
        <RouterLink to="/explore">{{ t('Найти своего кота') }}</RouterLink
        ><RouterLink to="/account">{{ t('Мой уголок') }}</RouterLink>
      </nav>
      <div class="header-actions">
        <label class="language-control">
          <span class="sr-only">{{ ui('language') }}</span>
          <select v-model="locale" :aria-label="ui('language')">
            <option
              v-for="language in languages"
              :key="language.code"
              :value="language.code"
            >
              {{ language.code.toUpperCase() }}
            </option>
          </select>
        </label>
        <button
          class="theme-toggle"
          :aria-label="ui(theme === 'dark' ? 'light' : 'dark')"
          :title="ui(theme === 'dark' ? 'light' : 'dark')"
          :aria-pressed="theme === 'dark'"
          @click="toggleTheme"
        >
          <UiIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="19" />
        </button>
        <template v-if="session.user"
          ><RouterLink class="button small" to="/account">{{
            session.user.name
          }}</RouterLink
          ><button class="text-button logout" @click="signOut">
            {{ t('Выйти') }}
          </button></template
        ><RouterLink v-else class="button small" to="/login">{{
          t('Войти ↗')
        }}</RouterLink>
      </div>
    </header>
    <div v-if="t(error)" class="notice wrap" role="alert">{{ t(error) }}</div>
    <main><RouterView /></main>
    <footer class="footer wrap">
      <p>{{ t('Меньше скролла. Больше мурчания.') }}</p>
    </footer>
  </div>
</template>
