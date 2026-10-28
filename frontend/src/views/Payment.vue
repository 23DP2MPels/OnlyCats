<script setup lang="ts">
import { t } from '../i18n';
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api, type Subscription } from '../api';
const route = useRoute();
const busy = ref(true);
const error = ref('');
const subscription = ref<Subscription | null>(null);
async function confirm() {
  busy.value = true;
  error.value = '';
  try {
    const id = route.query.subscription_id;
    if (typeof id !== 'string')
      throw new Error('PayPal не передал ID подписки');
    subscription.value = await api(
      `/subscriptions/confirm/${encodeURIComponent(id)}`,
      { method: 'POST' },
    );
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
onMounted(confirm);
</script>
<template>
  <section class="payment-page wrap">
    <span class="payment-icon">♡</span
    ><span class="eyebrow">PAYPAL SANDBOX</span>
    <h1>
      {{
        busy
          ? t('Проверяем подписку…')
          : subscription?.status === 'ACTIVE' && subscription?.paidUntil
            ? t('Добро пожаловать в клуб!')
            : t('Ещё немного терпения.')
      }}
    </h1>
    <p v-if="t(error)" class="error" role="alert">{{ t(error) }}</p>
    <p v-else-if="!busy">
      {{
        subscription?.paidUntil
          ? t('Сервер подтвердил платёж. Приватные истории теперь доступны.')
          : t(
              'Подтверждение платежа ещё не получено. Обновите статус через несколько секунд.',
            )
      }}
    </p>
    <div class="button-row">
      <button class="button" :disabled="busy" @click="confirm">
        {{ t('Проверить ещё раз') }}</button
      ><RouterLink
        v-if="subscription"
        class="button primary"
        :to="`/cats/${subscription.cat.id}`"
        >{{ t('К любимому коту ↗') }}</RouterLink
      ><RouterLink v-else class="button primary" to="/account">{{
        t('В личный кабинет ↗')
      }}</RouterLink>
    </div>
  </section>
</template>
