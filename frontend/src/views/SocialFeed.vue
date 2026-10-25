<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, session, type Cat } from '../api';
import { t } from '../i18n';
import SocialPost, { type FeedPost } from '../components/SocialPost.vue';
import UiIcon from '../components/UiIcon.vue';
const route = useRoute();
const router = useRouter();
const scope = computed(() =>
  route.query.tab === 'subscriptions' ? 'subscriptions' : 'all',
);
const posts = ref<FeedPost[]>([]);
const cats = ref<Cat[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const moreLoading = ref(false);
const error = ref('');
let requestVersion = 0;
async function load(append = false) {
  const version = ++requestVersion;
  if (append) moreLoading.value = true;
  else loading.value = true;
  error.value = '';
  try {
    const result = await api<{ items: FeedPost[]; nextCursor: string | null }>(
      `/feed?scope=${scope.value}${append && nextCursor.value ? `&cursor=${nextCursor.value}` : ''}`,
    );
    if (version !== requestVersion) return;
    posts.value = append ? [...posts.value, ...result.items] : result.items;
    nextCursor.value = result.nextCursor;
  } catch (e) {
    if (version === requestVersion) error.value = (e as Error).message;
  } finally {
    if (version === requestVersion) {
      loading.value = false;
      moreLoading.value = false;
    }
  }
}
function setScope(tab: string) {
  router.push({ path: '/', query: tab === 'subscriptions' ? { tab } : {} });
}
onMounted(() => {
  load();
  api<Cat[]>('/cats')
    .then((result) => (cats.value = result))
    .catch(() => {});
});
watch(scope, () => load());
watch(
  () => session.user?.id,
  () => load(),
);
function patch(id: string, changes: Partial<FeedPost>) {
  const post = posts.value.find((item) => item.id === id);
  if (post) Object.assign(post, changes);
}
</script>
<template>
  <div class="social-layout wrap">
    <aside class="social-sidebar">
      <nav :aria-label="t('Разделы соцсети')">
        <RouterLink to="/" :class="{ selected: scope === 'all' }"
          ><UiIcon name="home" />{{ t('Лента') }}</RouterLink
        ><RouterLink
          to="/?tab=subscriptions"
          :class="{ selected: scope === 'subscriptions' }"
          ><UiIcon name="heart" />{{ t('Мои подписки') }}</RouterLink
        ><RouterLink to="/explore"
          ><UiIcon name="search" />{{ t('Найти кота') }}</RouterLink
        ><RouterLink to="/account"
          ><UiIcon name="user" />{{ t('Мой профиль') }}</RouterLink
        >
      </nav>
      <RouterLink
        class="button primary full create-story"
        to="/account?tab=posts"
        ><UiIcon name="plus" :size="18" />
        {{ t('Создать историю') }}</RouterLink
      >
      <div class="sidebar-footnote">
        <span>✦</span>
        <p>{{ t('Больше котов. Ближе друг к другу.') }}</p>
      </div>
    </aside>
    <section class="social-main">
      <header class="feed-heading">
        <div>
          <span class="eyebrow">{{ t('ВАША ЕЖЕДНЕВНАЯ ДОЗА СЧАСТЬЯ') }}</span>
          <h1>{{ t('Лента') }}<span class="serif">.</span></h1>
        </div>
        <span class="feed-live"><span></span>{{ t('Всё самое мур') }}</span>
      </header>
      <div class="feed-tabs" role="group" :aria-label="t('Фильтр ленты')">
        <button
          :class="{ active: scope === 'all' }"
          :aria-pressed="scope === 'all'"
          @click="setScope('all')"
        >
          <UiIcon name="home" :size="20" />{{ t('Для вас') }}</button
        ><button
          :class="{ active: scope === 'subscriptions' }"
          :aria-pressed="scope === 'subscriptions'"
          @click="setScope('subscriptions')"
        >
          <UiIcon name="heart" :size="20" />{{ t('Мои подписки') }}
        </button>
      </div>
      <div class="feed-stories">
        <RouterLink v-for="cat in cats" :key="cat.id" :to="`/cats/${cat.id}`"
          ><span><img :src="cat.avatar" :alt="cat.name" /></span
          ><strong>{{ cat.name }}</strong></RouterLink
        ><RouterLink class="add-story-link" to="/account?tab=posts"
          ><span><UiIcon name="plus" :size="24" /></span
          ><strong>{{ t('Ваша история') }}</strong></RouterLink
        >
      </div>
      <RouterLink class="feed-composer" to="/account?tab=posts"
        ><span class="composer-avatar"><img src="/cat-logo.svg" alt="" /></span
        ><span
          >{{ t('Что сегодня натворил ваш кот?')
          }}<small>{{
            t('Поделитесь фотографией или маленькой историей')
          }}</small></span
        ><span class="composer-plus"><UiIcon name="plus" :size="22" /></span
      ></RouterLink>
      <p v-if="loading" class="empty">{{ t('Собираем котов…') }}</p>
      <div v-else-if="error" class="empty" role="alert">
        <p>{{ t(error) }}</p>
        <RouterLink
          v-if="!session.user && scope === 'subscriptions'"
          class="button primary"
          to="/login?next=/%3Ftab%3Dsubscriptions"
          >{{ t('Войти ↗') }}</RouterLink
        ><button v-else class="button" @click="load()">
          {{ t('Попробовать ещё') }}
        </button>
      </div>
      <div v-else-if="!posts.length" class="feed-empty">
        <span>♡</span>
        <h2>{{ t('Здесь пока тихо') }}</h2>
        <p>
          {{ t('Подпишитесь на любимых котов — их истории появятся здесь.') }}
        </p>
        <RouterLink class="button primary" to="/explore">{{
          t('Найти своего кота ↗')
        }}</RouterLink>
      </div>
      <template v-else
        ><SocialPost
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @changed="patch(post.id, $event)"
        /><button
          v-if="nextCursor"
          class="button load-more"
          :disabled="moreLoading"
          @click="load(true)"
        >
          {{ moreLoading ? t('Подождите…') : t('Показать ещё') }}
        </button>
        <p v-else class="feed-end">
          ✦ {{ t('Вы всё посмотрели. Самое время погладить кота.') }}
        </p></template
      >
    </section>
    <aside class="social-discover">
      <section class="discover-panel">
        <div class="discover-heading">
          <h2>{{ t('Кого читать') }}</h2>
          <RouterLink to="/explore">{{ t('Все коты') }} ↗</RouterLink>
        </div>
        <RouterLink
          v-for="cat in cats.slice(0, 4)"
          :key="cat.id"
          class="suggested-cat"
          :to="`/cats/${cat.id}`"
          ><img :src="cat.avatar" :alt="cat.name" />
          <div>
            <strong>{{ cat.name }} <span>✦</span></strong
            ><small>{{ cat.breed }}</small>
          </div>
          <span class="suggested-plus"><UiIcon name="plus" :size="20" /></span
        ></RouterLink>
      </section>
      <section class="social-welcome">
        <span class="eyebrow">ONLY CATS. ONLY LOVE.</span
        ><img src="/cats/marmalade.jpg" :alt="t('Мармелад')" />
        <h2>
          {{ t('У каждого кота') }}
          <span class="serif">{{ t('история.') }}</span>
        </h2>
        <p>
          {{ t('Открытые истории для всех. Самое личное — для своего клуба.') }}
        </p>
        <RouterLink class="text-button" to="/explore">{{
          t('Найти своего кота ↗')
        }}</RouterLink>
      </section>
    </aside>
  </div>
</template>
