<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api, type Cat } from '../api';
import CatCard from '../components/CatCard.vue';
import { t } from '../i18n';
const route = useRoute();
const user = ref<{ id: string; name: string; cats: Cat[] } | null>(null);
const error = ref('');
let version = 0;
watch(
  () => route.params.id,
  async (id) => {
    const current = ++version;
    user.value = null;
    error.value = '';
    try {
      const data = await api<typeof user.value>('/users/' + id);
      if (current === version) user.value = data;
    } catch (e) {
      if (current === version) error.value = (e as Error).message;
    }
  },
  { immediate: true },
);
</script>
<template>
  <section class="wrap page-section">
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
    <template v-if="user"
      ><h1>{{ user.name }}</h1>
      <h2>{{ t('Коты') }}</h2>
      <div class="cat-grid">
        <CatCard v-for="cat in user.cats" :key="cat.id" :cat="cat" />
      </div>
      <p v-if="!user.cats.length" class="empty">
        {{ t('Здесь пока тихо') }}
      </p></template
    >
  </section>
</template>
