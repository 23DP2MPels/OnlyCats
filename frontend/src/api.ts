import { reactive } from 'vue';
import { locale } from './i18n';
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
}
export interface Cat {
  id: string;
  name: string;
  breed: string;
  bio: string;
  avatar: string;
  ownerId: string;
  owner?: { name: string };
  _count?: { posts: number };
  isOwner?: boolean;
  subscribed?: boolean;
}
export interface Post {
  id: string;
  catId: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  locked: boolean;
  isPrivate: boolean;
  createdAt: string;
}
export interface Subscription {
  id: string;
  cat: Cat;
  status: string;
  paidUntil: string | null;
  paypalId: string | null;
}
export const session = reactive<{ user: User | null; loaded: boolean }>({
  user: null,
  loaded: false,
});
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join('. ')
        : data?.message || 'Не удалось выполнить запрос',
    );
  return data as T;
}
export async function loadSession() {
  try {
    session.user = await api<User | null>('/auth/me');
  } finally {
    session.loaded = true;
  }
}
export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  session.user = null;
}
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'long',
  }).format(new Date(value));
export const statusLabel: Record<string, string> = {
  PENDING: 'Ожидает подтверждения',
  ACTIVE: 'Активна',
  CANCELLED: 'Отменена',
  SUSPENDED: 'Приостановлена',
  EXPIRED: 'Истекла',
};
