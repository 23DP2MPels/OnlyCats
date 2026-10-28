<script setup lang="ts">
import GiftSubscription from '../components/GiftSubscription.vue';
import { t } from '../i18n';
import CreatorEarnings from '../components/CreatorEarnings.vue';
import ProfileSettings from '../components/ProfileSettings.vue';
import TransactionHistory from '../components/TransactionHistory.vue';
import { onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useRoute } from 'vue-router';
import {
  api,
  session,
  formatDate,
  statusLabel,
  type Cat,
  type Post,
  type Subscription,
  type User,
} from '../api';
const data = ref<{
  user: User;
  cats: Cat[];
  subscriptions: Subscription[];
} | null>(null);
const error = ref('');
const notice = ref('');
const loading = ref(true);
const busy = ref(false);
const route = useRoute();
const tab = ref(
  ['posts', 'subscriptions', 'earnings', 'transactions', 'settings'].includes(
    String(route.query.tab),
  )
    ? String(route.query.tab)
    : 'cats',
);
const catPhoto = ref<File | null>(null);
const catFormOpen = ref(false);
const editingCat = ref<string | null>(null);
const selectedCat = ref('');
const editingPost = ref<string | null>(null);
const managedPosts = ref<Post[]>([]);
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const catForm = reactive({
  name: '',
  breed: '',
  bio: '',
  avatar: '/cats/marmalade.svg',
});
const postForm = reactive({ title: '', body: '', isPrivate: true });
const avatars = [
  '/cats/marmalade.jpg',
  '/cats/luna.jpg',
  '/cats/marmalade.svg',
  '/cats/luna.svg',
  '/cats/oliver.svg',
  '/cats/mochi.svg',
];
async function load() {
  error.value = '';
  try {
    data.value = await api('/account');
    session.user = data.value!.user;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
function editCat(cat?: Cat) {
  editingCat.value = cat?.id || null;
  Object.assign(
    catForm,
    cat
      ? { name: cat.name, breed: cat.breed, bio: cat.bio, avatar: cat.avatar }
      : { name: '', breed: '', bio: '', avatar: avatars[0] },
  );
  catPhoto.value = null;
  catFormOpen.value = true;
}
async function action(fn: () => Promise<void>) {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function saveCat() {
  await action(async () => {
    const cat = await api<Cat>(
      editingCat.value ? `/cats/${editingCat.value}` : '/cats',
      {
        method: editingCat.value ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...catForm,
          avatar: catForm.avatar.startsWith('/cats/')
            ? catForm.avatar
            : undefined,
        }),
      },
    );
    editingCat.value = cat.id;
    if (catPhoto.value) {
      const form = new FormData();
      form.append('file', catPhoto.value);
      await api(`/cats/${cat.id}/avatar`, { method: 'POST', body: form });
    }
    catPhoto.value = null;
    catFormOpen.value = false;
    notice.value = 'Страница кота сохранена';
    await load();
  });
}
async function selectCat() {
  if (!selectedCat.value) {
    managedPosts.value = [];
    return;
  }
  await action(async () => {
    managedPosts.value = await api<Post[]>(`/cats/${selectedCat.value}/posts`);
  });
}
function clearPost() {
  editingPost.value = null;
  Object.assign(postForm, { title: '', body: '', isPrivate: true });
  file.value = null;
  if (fileInput.value) fileInput.value.value = '';
}
function editPost(post: Post) {
  editingPost.value = post.id;
  Object.assign(postForm, {
    title: post.title,
    body: post.body || '',
    isPrivate: post.isPrivate,
  });
}
async function savePost() {
  await action(async () => {
    const post = await api<Post>(
      editingPost.value
        ? `/posts/${editingPost.value}`
        : `/cats/${selectedCat.value}/posts`,
      {
        method: editingPost.value ? 'PATCH' : 'POST',
        body: JSON.stringify(postForm),
      },
    );
    editingPost.value = post.id; // Retain the created post if uploading fails so retry cannot duplicate it.
    if (file.value) {
      const form = new FormData();
      form.append('file', file.value);
      await api(`/posts/${post.id}/image`, { method: 'POST', body: form });
    }
    clearPost();
    managedPosts.value = await api<Post[]>(`/cats/${selectedCat.value}/posts`);
    await load();
    notice.value = 'История опубликована';
  });
}
async function removePost(id: string) {
  if (!window.confirm(t('Удалить эту историю?'))) return;
  await action(async () => {
    await api(`/posts/${id}`, { method: 'DELETE' });
    managedPosts.value = await api(`/cats/${selectedCat.value}/posts`);
    await load();
  });
}
async function cancel(sub: Subscription) {
  if (
    !window.confirm(t('Отключить продление? Доступ останется до конца срока.'))
  )
    return;
  await action(async () => {
    await api(`/subscriptions/${sub.id}`, { method: 'DELETE' });
    await load();
    notice.value = 'Подписка отменена';
  });
}
async function sync(id: string) {
  await action(async () => {
    await api(`/subscriptions/${id}/sync`, { method: 'POST' });
    await load();
    notice.value = 'Статус обновлён';
  });
}
onMounted(load);
</script>
<template>
  <section class="account-page wrap">
    <span class="eyebrow">{{ t('ВАШ ЛИЧНЫЙ КОШАЧИЙ УГОЛОК') }}</span>
    <h1>
      {{ t('Привет') }}{{ data ? `, ${data.user.name}` : ''
      }}<span class="serif">.</span>
    </h1>
    <p class="muted">
      {{ t('Здесь живут ваши любимчики и их маленькие истории.') }}
    </p>
    <p v-if="data?.user.isAdmin" style="margin-top: 1rem">
      <RouterLink to="/admin" class="button small">{{
        t('Админка')
      }}</RouterLink>
    </p>
    <p v-if="loading" class="empty">{{ t('Загружаем кабинет…') }}</p>
    <p v-if="t(error)" class="error" role="alert">
      {{ t(error) }}
      <RouterLink v-if="!data" to="/login">{{
        t('Войти в аккаунт →')
      }}</RouterLink>
    </p>
    <p v-if="t(notice)" class="success" role="status">{{ t(notice) }}</p>
    <template v-if="data"
      ><div class="account-tabs">
        <button
          v-for="(label, key) in {
            cats: t('Мои коты'),
            posts: t('Истории'),
            subscriptions: t('Подписки'),
            earnings: t('Доходы'),
            transactions: t('Транзакции'),
            settings: t('Настройки'),
          }"
          :key="key"
          :class="{ active: tab === key }"
          @click="tab = key"
        >
          {{ label }}
        </button>
      </div>
      <section v-if="tab === 'cats'">
        <div class="section-heading">
          <h2>
            {{ t('Ваши') }} <span class="serif">{{ t('звёзды.') }}</span>
          </h2>
          <button class="button primary" @click="editCat()">
            {{ t('+ Добавить кота') }}
          </button>
        </div>
        <GiftSubscription :cats="data.cats" />
        <form v-if="catFormOpen" class="editor-card" @submit.prevent="saveCat">
          <h3>
            {{
              editingCat
                ? t('Редактировать страницу')
                : t('Познакомьте нас с котом')
            }}
          </h3>
          <div class="form-row">
            <label
              >{{ t('Имя')
              }}<input
                v-model="catForm.name"
                required
                minlength="2"
                maxlength="60" /></label
            ><label
              >{{ t('Порода')
              }}<input
                v-model="catForm.breed"
                required
                minlength="2"
                maxlength="80"
            /></label>
          </div>
          <label
            >{{ t('О коте')
            }}<textarea
              v-model="catForm.bio"
              required
              minlength="10"
              maxlength="1000"
              rows="3"
            ></textarea>
          </label>
          <label
            >{{ t('Своя фотография кота') }}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="
                catPhoto =
                  ($event.target as HTMLInputElement).files?.[0] || null
              "
            />
            <small>{{ t('JPEG, PNG или WebP, до 8 МБ') }}</small>
          </label>
          <div class="avatar-picker">
            <button
              v-for="avatar in avatars"
              :key="avatar"
              type="button"
              :class="{ selected: catForm.avatar === avatar }"
              :aria-pressed="catForm.avatar === avatar"
              :aria-label="t('Выбрать аватар')"
              @click="
                catForm.avatar = avatar;
                catPhoto = null;
              "
            >
              <img :src="avatar" :alt="t('Аватар кота')" />
            </button>
          </div>
          <div class="button-row">
            <button class="button primary" :disabled="busy">
              {{ t('Сохранить') }}</button
            ><button class="button" type="button" @click="catFormOpen = false">
              {{ t('Закрыть') }}
            </button>
          </div>
        </form>
        <div v-if="!data.cats.length" class="empty">
          {{ t('Пока ни одного кота. Исправим?') }}
        </div>
        <div class="owned-grid">
          <article v-for="cat in data.cats" :key="cat.id" class="owned-card">
            <img :src="cat.avatar" :alt="cat.name" />
            <div>
              <h3>{{ cat.name }}</h3>
              <p>
                {{ cat.breed }} · {{ cat._count?.posts || 0 }}
                {{ t('историй') }}
              </p>
              <div class="button-row">
                <RouterLink class="text-button" :to="`/cats/${cat.id}`">{{
                  t('Открыть ↗')
                }}</RouterLink
                ><button class="text-button" @click="editCat(cat)">
                  {{ t('Редактировать') }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
      <section v-else-if="tab === 'posts'">
        <h2>
          {{ t('Новая') }} <span class="serif">{{ t('история.') }}</span>
        </h2>
        <label class="cat-select"
          >{{ t('Чья сегодня история?')
          }}<select
            v-model="selectedCat"
            @change="
              clearPost();
              selectCat();
            "
          >
            <option value="">{{ t('Выберите кота') }}</option>
            <option v-for="cat in data.cats" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select></label
        >
        <p v-if="!data.cats.length" class="empty">
          {{ t('Сначала добавьте кота во вкладке «Мои коты».') }}
        </p>
        <template v-if="selectedCat"
          ><form class="editor-card" @submit.prevent="savePost">
            <h3>
              {{ editingPost ? t('Редактирование истории') : t('Что нового?') }}
            </h3>
            <label
              >{{ t('Заголовок')
              }}<input
                v-model="postForm.title"
                required
                minlength="2"
                maxlength="120" /></label
            ><label
              >{{ t('История')
              }}<textarea
                v-model="postForm.body"
                required
                maxlength="5000"
                rows="4"
              ></textarea></label
            ><label
              >{{ t('Фотография · JPEG, PNG, WebP до 8 МБ')
              }}<input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="
                  file = ($event.target as HTMLInputElement).files?.[0] || null
                " /></label
            ><label class="checkbox"
              ><input v-model="postForm.isPrivate" type="checkbox" />{{
                t('Только для подписчиков')
              }}</label
            >
            <div class="button-row">
              <button class="button primary" :disabled="busy">
                {{
                  busy
                    ? t('Сохраняем…')
                    : editingPost
                      ? t('Сохранить изменения')
                      : t('Опубликовать ↗')
                }}</button
              ><button
                v-if="editingPost"
                class="button"
                type="button"
                @click="clearPost"
              >
                {{ t('Отмена') }}
              </button>
            </div>
          </form>
          <article
            v-for="post in managedPosts"
            :key="post.id"
            class="manage-post"
          >
            <div>
              <h3>{{ post.title }}</h3>
              <span class="muted"
                >{{ post.isPrivate ? t('Для подписчиков') : t('Открытая') }} ·
                {{ formatDate(post.createdAt) }}</span
              >
            </div>
            <div class="button-row">
              <button class="text-button" @click="editPost(post)">
                {{ t('Изменить') }}</button
              ><button
                class="text-button danger"
                :disabled="busy"
                @click="removePost(post.id)"
              >
                {{ t('Удалить') }}
              </button>
            </div>
          </article></template
        >
      </section>
      <CreatorEarnings v-else-if="tab === 'earnings'" />
      <TransactionHistory v-else-if="tab === 'transactions'" />
      <ProfileSettings v-else-if="tab === 'settings'" />
      <section v-else>
        <h2>
          {{ t('Ваш маленький') }} <span class="serif">{{ t('клуб.') }}</span>
        </h2>
        <p v-if="!data.subscriptions.length" class="empty">
          {{ t('Вы ещё ни на кого не подписаны.')
          }}<RouterLink to="/">{{ t('Найти любимчика →') }}</RouterLink>
        </p>
        <article
          v-for="sub in data.subscriptions"
          :key="sub.id"
          class="subscription-row"
        >
          <img :src="sub.cat.avatar" :alt="sub.cat.name" />
          <div>
            <RouterLink :to="`/cats/${sub.cat.id}`"
              ><h3>{{ sub.cat.name }}</h3></RouterLink
            >
            <p>
              {{
                sub.giftUntil && new Date(sub.giftUntil) > new Date()
                  ? t('Подарочная подписка')
                  : t(statusLabel[sub.status])
              }}<span
                v-if="sub.giftUntil && new Date(sub.giftUntil) > new Date()"
                >{{ t('· до') }}{{ formatDate(sub.giftUntil) }}</span
              ><span v-else-if="sub.paidUntil"
                >{{ t('· до') }}{{ formatDate(sub.paidUntil) }}</span
              >
            </p>
          </div>
          <div class="button-row">
            <button
              v-if="sub.paypalId"
              class="button small"
              :disabled="busy"
              @click="sync(sub.id)"
            >
              {{ t('Обновить статус') }}</button
            ><button
              v-if="
                !['CANCELLED', 'EXPIRED'].includes(sub.status) ||
                (sub.giftUntil && new Date(sub.giftUntil) > new Date())
              "
              class="text-button danger"
              :disabled="busy"
              @click="cancel(sub)"
            >
              {{ t('Отменить') }}
            </button>
          </div>
        </article>
        <p class="muted">
          {{
            t(
              'Все платежи тестовые. После отмены доступ сохраняется до конца срока.',
            )
          }}
        </p>
      </section></template
    >
  </section>
</template>
