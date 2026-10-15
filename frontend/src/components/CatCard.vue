<script setup lang="ts">
import { t } from '../i18n';
import type { Cat } from '../api';
defineProps<{ cat: Cat; index?: number }>();
</script>
<template>
  <RouterLink :to="`/cats/${cat.id}`" class="cat-card"
    ><div class="cat-card-image" :class="`tone-${(index || 0) % 4}`">
      <img :src="cat.avatar" :alt="cat.name" loading="lazy" /><span
        class="card-sticker"
        >{{
          [
            t('С характером'),
            t('Ваша новая любовь'),
            t('Мастер обнимашек'),
            t('Маленькое облачко'),
          ][(index || 0) % 4]
        }}</span
      ><span class="card-arrow">↗</span>
    </div>
    <div class="cat-card-info">
      <div>
        <h3>{{ cat.name }} <span>✦</span></h3>
        <p>{{ cat.breed }}</p>
      </div>
      <div class="card-price">
        $5<span>{{ t('/ месяц') }}</span>
      </div>
    </div>
    <p class="cat-card-bio">{{ cat.bio }}</p>
    <div class="card-meta">
      <span>◌ {{ cat._count?.posts || 0 }} {{ t('историй') }}</span
      ><span>{{ t('Познакомиться →') }}</span>
    </div></RouterLink
  >
</template>
