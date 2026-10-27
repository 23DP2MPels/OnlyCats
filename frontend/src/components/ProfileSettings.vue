<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, session } from '../api';
import { locale, t } from '../i18n';

type LoginEvent = {
  id: string;
  kind: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};
const events = ref<LoginEvent[]>([]);
const busy = ref(false);
const error = ref('');
const dateTime = (date: string) =>
  new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
function device(agent: string | null) {
  if (!agent) return t('Неизвестное устройство');
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : t('Браузер');
  const os = /Android/.test(agent)
    ? 'Android'
    : /iPhone|iPad/.test(agent)
      ? 'iOS'
      : /Windows/.test(agent)
        ? 'Windows'
        : /Macintosh/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : '';
  return [browser, os].filter(Boolean).join(' · ');
}
async function load() {
  busy.value = true;
  error.value = '';
  try {
    events.value = await api<LoginEvent[]>('/account/login-history');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>

<template>
  <section class="profile-settings" :aria-busy="busy">
    <h2>{{ t('Настройки профиля') }}</h2>
    <dl class="editor-card profile-details">
      <dt>{{ t('Имя') }}</dt>
      <dd>{{ session.user?.name }}</dd>
      <dt>{{ t('Электронная почта') }}</dt>
      <dd>{{ session.user?.email }}</dd>
    </dl>
    <div class="section-heading">
      <h3>{{ t('История входов') }}</h3>
      <button class="button" :disabled="busy" @click="load">
        {{ t('Обновить') }}
      </button>
    </div>
    <p class="muted">
      {{
        t(
          'Последние 50 успешных входов. История записывается с момента обновления приложения.',
        )
      }}
    </p>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
    <p v-if="busy" class="empty">{{ t('Загружаем историю…') }}</p>
    <p v-else-if="!events.length && !error" class="empty">
      {{ t('История входов пока пуста') }}
    </p>
    <article
      v-for="entry in events"
      :key="entry.id"
      class="manage-post login-event"
    >
      <div>
        <strong>{{ device(entry.userAgent) }}</strong>
        <p class="muted">
          {{ dateTime(entry.createdAt) }} ·
          {{
            entry.kind === 'REGISTER' ? t('Регистрация') : t('Успешный вход')
          }}
        </p>
      </div>
      <span class="muted">IP: {{ entry.ipAddress || '—' }}</span>
    </article>
  </section>
</template>

<style scoped>
.profile-details {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem 1.5rem;
}
.profile-details dt {
  color: var(--muted);
}
.profile-details dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.login-event {
  gap: 1rem;
  flex-wrap: wrap;
}
</style>
