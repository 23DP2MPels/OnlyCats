<script setup lang="ts">
import { t } from '../i18n';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, session, type User } from '../api';
const route = useRoute();
const router = useRouter();
const register = ref(false);
const name = ref('');
const email = ref('');
const password = ref('');
const busy = ref(false);
const error = ref('');
async function submit() {
  busy.value = true;
  error.value = '';
  try {
    session.user = await api<User>(
      register.value ? '/auth/register' : '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          email: email.value,
          password: password.value,
          ...(register.value ? { name: name.value } : {}),
        }),
      },
    );
    const next =
      typeof route.query.next === 'string' &&
      route.query.next.startsWith('/') &&
      !route.query.next.startsWith('//')
        ? route.query.next
        : '/account';
    await router.push(next);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="auth-page wrap">
    <div class="auth-illustration">
      <img src="/cats/luna.svg" :alt="t('Кошка Луна')" />
      <h2>
        {{ t('Вас здесь') }}<br /><span class="serif">{{
          t('уже ждут.')
        }}</span>
      </h2>
      <p>{{ t('И, возможно, немного осуждают за опоздание.') }}</p>
    </div>
    <form class="form-card" @submit.prevent="submit">
      <span class="eyebrow">{{ t('ВАШЕ МЕСТО СРЕДИ КОТОВ') }}</span>
      <h1>{{ register ? t('Знакомиться?') : t('С возвращением.') }}</h1>
      <p>
        {{
          register
            ? t('Создайте аккаунт и найдите своего любимчика.')
            : t('Войдите, чтобы продолжить мурчать.')
        }}
      </p>
      <label v-if="register"
        >{{ t('Ваше имя')
        }}<input
          v-model="name"
          required
          minlength="2"
          maxlength="60"
          autocomplete="name" /></label
      ><label
        >{{ t('Email')
        }}<input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          maxlength="254" /></label
      ><label
        >{{ t('Пароль')
        }}<input
          v-model="password"
          type="password"
          required
          :minlength="register ? 10 : 1"
          maxlength="72"
          :autocomplete="register ? 'new-password' : 'current-password'"
        /><small v-if="register">{{ t('Минимум 10 символов') }}</small></label
      >
      <p v-if="t(error)" class="error" role="alert">{{ t(error) }}</p>
      <button class="button primary full" :disabled="busy">
        {{
          busy
            ? t('Подождите…')
            : register
              ? t('Создать аккаунт ↗')
              : t('Войти ↗')
        }}</button
      ><button
        class="text-button auth-toggle"
        type="button"
        @click="
          register = !register;
          error = '';
        "
      >
        {{
          register
            ? t('Уже есть аккаунт? Войти')
            : t('Впервые здесь? Зарегистрироваться')
        }}
      </button>
    </form>
  </section>
</template>
