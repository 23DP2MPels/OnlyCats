<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { api, type Cat } from '../api';
import { t } from '../i18n';
import CatCard from './CatCard.vue';
const props = defineProps<{ accountsOnly?: boolean }>();
const emit = defineEmits<{ select: [user: { id: string; name: string }] }>();
const query = ref('');
const result = ref<{
  users: { id: string; name: string; _count: { cats: number } }[];
  cats: Cat[];
}>({ users: [], cats: [] });
const loading = ref(false);
const error = ref('');
let version = 0;
let timer: ReturnType<typeof setTimeout>;
watch(query, () => {
  const current = ++version;
  clearTimeout(timer);
  error.value = '';
  result.value = { users: [], cats: [] };
  loading.value = false;
  if (query.value.trim().length < 2) return;
  loading.value = true;
  timer = setTimeout(async () => {
    try {
      const data = await api<typeof result.value>(
        '/search?q=' + encodeURIComponent(query.value.trim()),
      );
      if (current === version) result.value = data;
    } catch (e) {
      if (current === version) error.value = (e as Error).message;
    } finally {
      if (current === version) loading.value = false;
    }
  }, 250);
});
onUnmounted(() => {
  clearTimeout(timer);
  version++;
});
</script>
<template>
  <section class="universal-search">
    <label class="search"
      ><span aria-hidden="true">⌕</span
      ><input
        v-model="query"
        type="search"
        maxlength="100"
        :placeholder="t('Поиск аккаунтов и котов')"
        :aria-label="t('Поиск аккаунтов и котов')"
    /></label>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
    <p v-else-if="loading" class="muted" role="status">{{ t('Ищем…') }}</p>
    <p v-else-if="query.trim().length < 2" class="muted">
      {{ t('Введите хотя бы 2 символа') }}
    </p>
    <template v-else>
      <h3 v-if="result.users.length">{{ t('Аккаунты') }}</h3>
      <article v-for="user in result.users" :key="user.id" class="manage-post">
        <RouterLink :to="'/users/' + user.id">{{ user.name }}</RouterLink>
        <button
          v-if="accountsOnly"
          type="button"
          class="button small"
          @click="emit('select', user)"
        >
          {{ t('Выбрать') }}
        </button>
      </article>
      <template v-if="!props.accountsOnly && result.cats.length"
        ><h3>{{ t('Коты') }}</h3>
        <div class="cat-grid">
          <CatCard v-for="cat in result.cats" :key="cat.id" :cat="cat" /></div
      ></template>
      <p
        v-if="
          !result.users.length && (props.accountsOnly || !result.cats.length)
        "
        class="empty"
      >
        {{ t('Ничего не найдено') }}
      </p>
    </template>
  </section>
</template>
