<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, session, formatDate, type Cat, type Post } from '../api';
import { t } from '../i18n';
import UiIcon from './UiIcon.vue';
export interface FeedPost extends Post {
  cat: Cat;
  likes: number;
  comments: number;
  liked: boolean;
}
const props = defineProps<{
  post: FeedPost;
  inProfile?: boolean;
  subscriptionBusy?: boolean;
}>();
const emit = defineEmits<{
  changed: [patch: Partial<FeedPost>];
  subscribe: [];
}>();
const router = useRouter();
const busy = ref(false);
const error = ref('');
const expanded = ref(false);
const message = ref('');
const comments = ref<
  {
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string };
  }[]
>([]);
async function requireLogin() {
  if (session.user) return true;
  await router.push({
    path: '/login',
    query: { next: router.currentRoute.value.fullPath },
  });
  return false;
}
async function like() {
  if (!(await requireLogin()) || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await api<{ liked: boolean; likes: number }>(
      `/posts/${props.post.id}/like`,
      { method: props.post.liked ? 'DELETE' : 'PUT' },
    );
    emit('changed', result);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function toggleComments() {
  if (busy.value) return;
  if (expanded.value) {
    expanded.value = false;
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    comments.value = await api(`/posts/${props.post.id}/comments`);
    expanded.value = true;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function send() {
  if (!(await requireLogin()) || !message.value.trim() || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const comment = await api<(typeof comments.value)[number]>(
      `/posts/${props.post.id}/comments`,
      { method: 'POST', body: JSON.stringify({ body: message.value.trim() }) },
    );
    comments.value.unshift(comment);
    message.value = '';
    emit('changed', { comments: props.post.comments + 1 });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <article class="social-post">
    <header class="social-post-header">
      <RouterLink :to="`/cats/${post.catId}`" class="post-author"
        ><img :src="post.cat.avatar" :alt="post.cat.name" />
        <div>
          <strong
            >{{ post.cat.name }} <span class="verified-cat">✦</span></strong
          ><small
            >{{ post.cat.breed }} · {{ formatDate(post.createdAt) }}</small
          >
        </div></RouterLink
      ><span class="visibility-badge" :class="{ private: post.isPrivate }">{{
        post.isPrivate ? t('♡ Для подписчиков') : t('◌ Открытая история')
      }}</span>
    </header>
    <div class="social-post-text">
      <h2>{{ post.title }}</h2>
      <p v-if="!post.locked">{{ post.body }}</p>
    </div>
    <div v-if="post.locked" class="social-paywall">
      <div class="paywall-icon"><UiIcon name="lock" :size="34" /></div>
      <h3>{{ t('Только для своих') }}</h3>
      <p>{{ t('Оформите подписку, чтобы увидеть эту историю.') }}</p>
      <button
        v-if="inProfile"
        class="button primary"
        :disabled="subscriptionBusy"
        @click="emit('subscribe')"
      >
        {{ t('Открыть с подпиской ↗') }}
      </button>
      <RouterLink v-else class="button primary" :to="`/cats/${post.catId}`">{{
        t('Открыть с подпиской ↗')
      }}</RouterLink
      ><small>{{ t('Только PayPal Sandbox · тестовые платежи') }}</small>
    </div>
    <img
      v-else-if="post.imageUrl"
      class="social-photo"
      :src="post.imageUrl"
      :alt="post.title"
      loading="lazy"
    />
    <div class="social-post-actions">
      <button
        :class="{ liked: post.liked }"
        :disabled="busy || post.locked"
        :aria-pressed="post.liked"
        :aria-label="post.liked ? t('Убрать лайк') : t('Нравится')"
        @click="like"
      >
        <UiIcon name="heart" :filled="post.liked" />{{ post.likes }}</button
      ><button
        :disabled="busy || post.locked"
        :aria-expanded="expanded"
        :aria-label="t('Комментарии')"
        @click="toggleComments"
      >
        <UiIcon name="message" />{{ post.comments }}</button
      ><RouterLink :to="`/cats/${post.catId}`" class="post-profile-link"
        >{{ t('К профилю') }} ↗</RouterLink
      >
    </div>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
    <section v-if="expanded" class="social-comments">
      <h3>{{ t('Комментарии') }}</h3>
      <p v-if="!comments.length" class="muted">
        {{ t('Начните разговор первым.') }}
      </p>
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="social-comment"
      >
        <span class="comment-avatar">{{
          comment.user.name.slice(0, 1).toUpperCase()
        }}</span>
        <div>
          <strong>{{ comment.user.name }}</strong>
          <p>{{ comment.body }}</p>
          <small>{{ formatDate(comment.createdAt) }}</small>
        </div>
      </article>
      <form v-if="session.user" @submit.prevent="send">
        <label class="sr-only" :for="`comment-${post.id}`">{{
          t('Ваш комментарий')
        }}</label
        ><input
          :id="`comment-${post.id}`"
          v-model="message"
          :placeholder="t('Напишите что-нибудь доброе…')"
          required
          maxlength="1000"
        /><button
          class="button small primary"
          :disabled="busy || !message.trim()"
        >
          {{ t('Отправить') }}
        </button>
      </form>
      <RouterLink v-else class="text-button" to="/login">{{
        t('Войдите, чтобы оставить комментарий')
      }}</RouterLink>
    </section>
  </article>
</template>
