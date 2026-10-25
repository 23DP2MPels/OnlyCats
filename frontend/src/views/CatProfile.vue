<script setup lang="ts">
import { t } from '../i18n';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, session, type Cat } from '../api';
import SocialPost, { type FeedPost } from '../components/SocialPost.vue';
const route = useRoute();
const router = useRouter();
const cat = ref<Cat | null>(null);
const posts = ref<FeedPost[]>([]);
const error = ref('');
const loading = ref(true);
const busy = ref(false);
async function load() {
  loading.value = true;
  try {
    const id = route.params.id;
    [cat.value, posts.value] = await Promise.all([
      api<Cat>(`/cats/${id}`),
      api<FeedPost[]>(`/cats/${id}/posts`),
    ]);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
async function subscribe() {
  if (!session.user) {
    await router.push({ path: '/login', query: { next: route.fullPath } });
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const result = await api<{ approvalUrl?: string; activated?: boolean }>(
      '/subscriptions',
      { method: 'POST', body: JSON.stringify({ catId: cat.value?.id }) },
    );
    if (result.approvalUrl) {
      const target = new URL(result.approvalUrl);
      if (
        target.protocol !== 'https:' ||
        target.hostname !== 'www.sandbox.paypal.com'
      )
        throw new Error('Некорректный адрес оплаты');
      window.location.assign(target.href);
    } else {
      await load();
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="profile-page wrap">
    <RouterLink class="back-link" to="/">{{ t('← Все коты') }}</RouterLink>
    <p v-if="loading" class="empty">{{ t('Кот уже идёт…') }}</p>
    <p v-if="t(error)" class="error" role="alert">{{ t(error) }}</p>
    <template v-if="cat"
      ><div class="profile-heading">
        <div class="profile-avatar">
          <img :src="cat.avatar" :alt="cat.name" />
        </div>
        <div class="profile-copy">
          <span class="eyebrow">{{ cat.breed }} · {{ cat.owner?.name }}</span>
          <h1>{{ cat.name }}<span class="coral"> ✦</span></h1>
          <p>{{ cat.bio }}</p>
          <span class="muted"
            >{{ cat._count?.posts || 0 }}
            {{ t('историй · маленький мир одного кота') }}</span
          >
        </div>
        <aside class="subscribe-card">
          <span class="eyebrow">{{ t('КЛУБ ЛЮБИТЕЛЕЙ ЛАП') }}</span>
          <h3 v-if="cat.isOwner">{{ t('Это ваш герой ♡') }}</h3>
          <h3 v-else-if="cat.subscribed">{{ t('Вы в клубе ♡') }}</h3>
          <h3 v-else>
            $5 <small>{{ t('/ месяц') }}</small>
          </h3>
          <p>
            {{ t('Приватные фото и истории.') }}<br />{{
              t('Безграничная порция умиления.')
            }}
          </p>
          <RouterLink
            v-if="cat.isOwner"
            class="button primary full"
            to="/account"
            >{{ t('Управлять страницей ↗') }}</RouterLink
          ><RouterLink
            v-else-if="cat.subscribed"
            class="button full"
            to="/account"
            >{{ t('Моя подписка ↗') }}</RouterLink
          ><button
            v-else
            class="button primary full"
            :disabled="busy"
            @click="subscribe"
          >
            {{ busy ? t('Открываем PayPal…') : t('Вступить в клуб ↗') }}</button
          ><small>{{ t('Только PayPal Sandbox · тестовые платежи') }}</small>
        </aside>
      </div>
      <div class="section-heading">
        <h2>
          {{ t('Из жизни') }} <span class="serif">{{ t('кота.') }}</span>
        </h2>
        <span class="muted">{{
          t('Самое важное обычно случается между снами.')
        }}</span>
      </div>
      <div v-if="!posts.length" class="empty">
        {{ t('Первая история ещё впереди.') }}
      </div>
      <div class="mx-auto max-w-[760px]">
        <SocialPost
          v-for="post in posts"
          :key="post.id"
          :post="post"
          in-profile
          :subscription-busy="busy"
          @subscribe="subscribe"
          @changed="Object.assign(post, $event)"
        /></div
    ></template>
  </section>
</template>
