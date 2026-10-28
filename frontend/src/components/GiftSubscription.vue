<script setup lang="ts">
import { ref } from 'vue';
import { api, type Cat } from '../api';
import UniversalSearch from './UniversalSearch.vue';
import { t } from '../i18n';
const props = defineProps<{ cats: Cat[] }>();
const catId = ref('');
const recipient = ref<{ id: string; name: string } | null>(null);
const busy = ref(false);
const error = ref('');
const notice = ref('');
async function gift() {
  if (!recipient.value || !catId.value || busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await api('/cats/' + catId.value + '/gifts', {
      method: 'POST',
      body: JSON.stringify({ userId: recipient.value.id }),
    });
    notice.value = 'Подписка подарена на 30 дней';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section v-if="props.cats.length" class="editor-card">
    <h2>{{ t('Подарить подписку') }}</h2>
    <p class="muted">
      {{ t('Бесплатный доступ к постам вашего кота на 30 дней') }}
    </p>
    <label
      >{{ t('Кот')
      }}<select v-model="catId" required>
        <option disabled value="">{{ t('Выбрать') }}</option>
        <option v-for="cat in cats" :key="cat.id" :value="cat.id">
          {{ cat.name }}
        </option>
      </select></label
    ><UniversalSearch accounts-only @select="recipient = $event" />
    <p v-if="recipient">{{ t('Получатель') }}: {{ recipient.name }}</p>
    <button
      type="button"
      class="button primary"
      :disabled="busy || !recipient || !catId"
      @click="gift"
    >
      {{ t('Подарить подписку') }}
    </button>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
    <p v-if="notice" class="success" role="status">{{ t(notice) }}</p>
  </section>
</template>
