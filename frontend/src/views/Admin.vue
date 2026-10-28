<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api, session, type User, formatDate } from '../api';
import { t } from '../i18n';
type AdminUser = User & { createdAt: string };
type AdminPost = {
  id: string;
  title: string;
  body: string;
  isPrivate: boolean;
  createdAt: string;
  cat: { id: string; name: string; owner: { name: string } };
};
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
const tab = ref<'users' | 'posts'>('users');
const search = ref('');
const page = ref(1);
const users = ref<AdminUser[]>([]);
const posts = ref<AdminPost[]>([]);
const total = ref(0);
const pages = computed(() => Math.max(1, Math.ceil(total.value / 20)));
const busy = ref(false);
const error = ref('');
const notice = ref('');
const editing = ref<User | null>(null);
async function load() {
  if (!session.user?.isAdmin || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const query = new URLSearchParams({
      search: search.value,
      page: String(page.value),
    });
    if (tab.value === 'users') {
      const result = await api<Page<AdminUser>>(`/admin/users?${query}`);
      users.value = result.items;
      total.value = result.total;
    } else {
      const result = await api<Page<AdminPost>>(`/admin/posts?${query}`);
      posts.value = result.items;
      total.value = result.total;
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
function switchTab(value: 'users' | 'posts') {
  tab.value = value;
  search.value = '';
  editing.value = null;
  notice.value = '';
  page.value = 1;
  void load();
}
function find() {
  page.value = 1;
  editing.value = null;
  void load();
}
function turn(delta: number) {
  page.value += delta;
  void load();
}
async function save() {
  if (!editing.value || busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const user = await api<User>(`/admin/users/${editing.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editing.value.name,
        email: editing.value.email,
        isAdmin: editing.value.isAdmin,
      }),
    });
    if (user.id === session.user?.id) session.user = user;
    editing.value = null;
    notice.value = 'Пользователь сохранён';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
  if (!editing.value) await load();
}
async function remove(post: AdminPost) {
  if (
    busy.value ||
    !window.confirm(`${t('Удалить публикацию безвозвратно?')}\n${post.title}`)
  )
    return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await api(`/posts/${post.id}`, { method: 'DELETE' });
    if (posts.value.length === 1 && page.value > 1) page.value--;
    notice.value = 'Публикация удалена';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
  await load();
}
watch(
  () => session.user?.isAdmin,
  () => {
    users.value = [];
    posts.value = [];
    editing.value = null;
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <section class="wrap page-section admin-page">
    <h1>{{ t('Админка') }}</h1>
    <p v-if="!session.loaded">{{ t('Загрузка…') }}</p>
    <div v-else-if="!session.user?.isAdmin" class="empty">
      <p>{{ t('Доступ только для администратора') }}</p>
      <RouterLink v-if="!session.user" to="/login" class="button">{{
        t('Войти ↗')
      }}</RouterLink>
    </div>
    <template v-else>
      <div class="feed-tabs">
        <button
          :class="{ active: tab === 'users' }"
          :disabled="busy"
          @click="switchTab('users')"
        >
          {{ t('Пользователи') }}
        </button>
        <button
          :class="{ active: tab === 'posts' }"
          :disabled="busy"
          @click="switchTab('posts')"
        >
          {{ t('Публикации') }}
        </button>
      </div>
      <form class="admin-search" @submit.prevent="find">
        <label for="admin-search">{{
          tab === 'users'
            ? t('Имя или email')
            : t('Название публикации или кота')
        }}</label>
        <div>
          <input
            id="admin-search"
            v-model="search"
            type="search"
            maxlength="100"
            :disabled="busy"
          /><button class="button" :disabled="busy">{{ t('Найти') }}</button>
        </div>
      </form>
      <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
      <p v-if="notice" class="success" role="status">{{ t(notice) }}</p>
      <form v-if="editing" class="admin-editor" @submit.prevent="save">
        <h2>{{ t('Изменить пользователя') }}</h2>
        <label
          >{{ t('Имя')
          }}<input
            v-model="editing.name"
            required
            minlength="2"
            maxlength="60"
            :disabled="busy"
        /></label>
        <label
          >Email<input
            v-model="editing.email"
            type="email"
            required
            maxlength="254"
            :disabled="busy"
        /></label>
        <label class="admin-checkbox"
          ><input
            v-model="editing.isAdmin"
            type="checkbox"
            :disabled="busy || editing.id === session.user?.id"
          />{{ t('Администратор') }}</label
        >
        <p v-if="editing.id === session.user?.id" class="muted">
          {{ t('Нельзя снять права администратора у себя') }}
        </p>
        <div class="admin-actions">
          <button class="button" :disabled="busy">{{ t('Сохранить') }}</button
          ><button
            type="button"
            class="text-button"
            :disabled="busy"
            @click="editing = null"
          >
            {{ t('Отмена') }}
          </button>
        </div>
      </form>
      <div :aria-busy="busy">
        <p v-if="busy" role="status">{{ t('Загрузка…') }}</p>
        <p v-else-if="!total && !error" class="empty">
          {{ t('Ничего не найдено') }}
        </p>
        <template v-if="tab === 'users'">
          <article v-for="user in users" :key="user.id" class="admin-row">
            <div>
              <strong>{{ user.name }}</strong>
              <p>{{ user.email }}</p>
              <p class="muted">
                {{ user.isAdmin ? t('Администратор') : t('Пользователь') }} ·
                {{ formatDate(user.createdAt) }}
              </p>
            </div>
            <button
              class="button small"
              :disabled="busy"
              @click="
                editing = { ...user };
                notice = '';
              "
            >
              {{ t('Изменить') }}
            </button>
          </article>
        </template>
        <template v-else>
          <article v-for="post in posts" :key="post.id" class="admin-row">
            <div>
              <h2>{{ post.title }}</h2>
              <p class="muted">
                {{ post.cat.name }} · {{ post.cat.owner.name }} ·
                {{ formatDate(post.createdAt) }} ·
                {{
                  post.isPrivate
                    ? t('Только подписчикам')
                    : t('Публичная публикация')
                }}
              </p>
              <p class="admin-body">{{ post.body }}</p>
              <RouterLink :to="`/cats/${post.cat.id}`">{{
                t('Открыть кота')
              }}</RouterLink>
            </div>
            <button
              class="text-button danger"
              :disabled="busy"
              @click="remove(post)"
            >
              {{ t('Удалить') }}
            </button>
          </article>
        </template>
      </div>
      <div class="admin-pagination">
        <button
          class="button small"
          :disabled="busy || page <= 1"
          @click="turn(-1)"
        >
          {{ t('Назад') }}
        </button>
        <span>{{ page }} / {{ pages }} · {{ t('Всего') }}: {{ total }}</span>
        <button
          class="button small"
          :disabled="busy || page >= pages"
          @click="turn(1)"
        >
          {{ t('Далее') }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.admin-page {
  max-width: 1000px;
}
.admin-search {
  margin-block: 1.5rem;
}
.admin-search > div,
.admin-actions,
.admin-pagination {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.admin-search input {
  flex: 1;
  min-width: 0;
}
.admin-editor {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
}
.admin-editor > label {
  display: block;
  margin-block: 1rem;
}
.admin-editor input:not([type='checkbox']) {
  display: block;
  width: 100%;
}
.admin-editor .admin-checkbox {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}
.admin-checkbox input {
  width: auto;
  margin: 0;
}
.admin-row {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
  padding-block: 1.25rem;
  border-bottom: 1px solid var(--line);
}
.admin-row > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.admin-row > button {
  flex-shrink: 0;
}
.admin-row h2 {
  font-size: 1.15rem;
  font-weight: 650;
  letter-spacing: normal;
}
.admin-body {
  white-space: pre-wrap;
  max-height: 9rem;
  overflow-y: auto;
  margin-block: 0.75rem;
}
.admin-pagination {
  justify-content: space-between;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}
@media (max-width: 600px) {
  .admin-row {
    flex-direction: column;
  }
  .admin-search > div {
    flex-wrap: wrap;
  }
}
</style>
