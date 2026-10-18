<script setup lang="ts">
import { t } from '../i18n';
</script>
<template>
  <section class="payment-page wrap">
    <span class="eyebrow">{{ t('404 · КОТ УНЁС ЭТУ СТРАНИЦУ') }}</span>
    <h1>
      {{ t('Здесь только') }} <span class="serif">{{ t('мурчание.') }}</span>
    </h1>
    <p>{{ t('Вернёмся туда, где нас ждут?') }}</p>
    <RouterLink class="button primary" to="/">{{
      t('На главную ↗')
    }}</RouterLink>
  </section>
</template>
