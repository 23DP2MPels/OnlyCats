<script setup lang="ts">
import UniversalSearch from '../components/UniversalSearch.vue';
import { t } from '../i18n';
</script>
<template>
  <section class="wrap page-section">
    <h1>{{ t('Поиск') }}</h1>
    <UniversalSearch />
  </section>
</template>
