<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { validCardNumber } from '../card';
import { api, formatDate } from '../api';
import { locale, t } from '../i18n';

type Earnings = {
  receivedCents: number;
  reservedCents: number;
  availableCents: number;
  payments: {
    id: string;
    amountCents: number;
    status: string;
    paidAt: string;
    cat: { name: string };
  }[];
  withdrawals: {
    id: string;
    amountCents: number;
    status: 'PENDING' | 'CANCELLED';
    createdAt: string;
  }[];
};
const earnings = ref<Earnings | null>(null);
const error = ref('');
const notice = ref('');
const busy = ref(false);
const amount = ref('');
const cardNumber = ref('');
const requestId = ref(crypto.randomUUID());
function changeAmount() {
  requestId.value = crypto.randomUUID();
}
const money = (cents: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
const labels: Record<string, string> = {
  COMPLETED: 'Подтверждён',
  REFUNDED: 'Возвращён',
  PARTIALLY_REFUNDED: 'Частичный возврат',
  PENDING: 'Ожидает рассмотрения',
  CANCELLED: 'Заявка отменена',
};
async function load() {
  earnings.value = await api<Earnings>('/creator/earnings');
}
async function action(fn: () => Promise<void>) {
  if (busy.value) return;
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
async function refresh() {
  await action(async () => {
    earnings.value = await api<Earnings>('/creator/earnings/sync', {
      method: 'POST',
    });
    notice.value = 'Поступления обновлены';
  });
}
async function request() {
  await action(async () => {
    if (!validCardNumber(cardNumber.value))
      throw new Error('Проверьте номер карты: неверная контрольная сумма Луна');
    await api('/creator/withdrawals', {
      method: 'POST',
      body: JSON.stringify({
        amount: String(amount.value).trim().replace(',', '.'),
        requestId: requestId.value,
      }),
    });
    amount.value = '';
    cardNumber.value = '';
    requestId.value = crypto.randomUUID();
    notice.value = 'Заявка сохранена. Перевод денег не выполняется.';
    await load();
  });
}
async function cancel(id: string) {
  await action(async () => {
    await api(`/creator/withdrawals/${id}`, { method: 'DELETE' });
    notice.value = 'Заявка отменена';
    await load();
  });
}
onMounted(() => action(load));
</script>

<template>
  <section class="creator-earnings" :aria-busy="busy">
    <div class="section-heading">
      <h2>{{ t('Доходы от ваших котов') }}</h2>
      <button class="button" :disabled="busy" @click="refresh">
        {{ t('Обновить поступления') }}
      </button>
    </div>
    <p class="muted">
      {{
        t('PayPal Sandbox: все суммы тестовые. Реальные выплаты недоступны.')
      }}
    </p>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
    <p v-if="notice" class="success" role="status">{{ t(notice) }}</p>
    <p v-if="!earnings && busy" class="empty">{{ t('Загружаем доходы…') }}</p>
    <template v-if="earnings">
      <div class="earnings-totals">
        <article class="editor-card">
          <span>{{ t('Подтверждённые поступления') }}</span
          ><strong>{{ money(earnings.receivedCents) }}</strong>
        </article>
        <article class="editor-card">
          <span>{{ t('В заявках') }}</span
          ><strong>{{ money(earnings.reservedCents) }}</strong>
        </article>
        <article class="editor-card">
          <span>{{ t('Доступно для заявки') }}</span
          ><strong>{{ money(earnings.availableCents) }}</strong>
        </article>
      </div>
      <p class="muted">
        {{
          t(
            'Суммы до комиссий PayPal. Показаны подтверждённые платежи; возвраты исключены. Для загрузки прежних платежей обновите поступления.',
          )
        }}
      </p>
      <form class="editor-card" @submit.prevent="request">
        <h3>{{ t('Запрос на вывод') }}</h3>
        <p class="muted">
          {{
            t(
              'Заявка только сохраняется и резервирует сумму. Деньги не отправляются.',
            )
          }}
        </p>
        <label
          >{{ t('Сумма в USD') }}
          <input
            v-model="amount"
            type="text"
            inputmode="decimal"
            pattern="[0-9]+([.,][0-9]{1,2})?"
            required
            :disabled="busy || !earnings.availableCents"
            @input="changeAmount"
          />
        </label>
        <label
          >{{ t('Номер тестовой карты') }}
          <input
            v-model="cardNumber"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            maxlength="26"
            required
            :disabled="busy || !earnings.availableCents"
            :aria-invalid="
              cardNumber.length > 0 && !validCardNumber(cardNumber)
            "
          />
        </label>
        <p class="muted">
          {{
            t(
              'Только проверка Луна. Номер не сохраняется и не отправляется. Используйте тестовую карту.',
            )
          }}
        </p>
        <button
          class="button primary"
          :disabled="busy || !earnings.availableCents"
        >
          {{ t('Отправить заявку') }}
        </button>
      </form>
      <h3>{{ t('История заявок') }}</h3>
      <p v-if="!earnings.withdrawals.length" class="empty">
        {{ t('Заявок пока нет') }}
      </p>
      <article
        v-for="withdrawal in earnings.withdrawals"
        :key="withdrawal.id"
        class="manage-post"
      >
        <div>
          <strong>{{ money(withdrawal.amountCents) }}</strong>
          <p class="muted">
            {{ formatDate(withdrawal.createdAt) }} ·
            {{ t(labels[withdrawal.status]) }}
          </p>
        </div>
        <button
          v-if="withdrawal.status === 'PENDING'"
          class="text-button danger"
          :disabled="busy"
          @click="cancel(withdrawal.id)"
        >
          {{ t('Отменить заявку') }}
        </button>
      </article>
      <h3>{{ t('Последние поступления') }}</h3>
      <p v-if="!earnings.payments.length" class="empty">
        {{ t('Подтверждённых платежей пока нет') }}
      </p>
      <article
        v-for="payment in earnings.payments"
        :key="payment.id"
        class="manage-post"
      >
        <div>
          <strong>{{ payment.cat.name }}</strong>
          <p class="muted">
            {{ formatDate(payment.paidAt) }} · {{ t(labels[payment.status]) }}
          </p>
        </div>
        <span>{{ money(payment.amountCents) }}</span>
      </article>
      <p class="muted">
        {{
          t(
            'В истории отображаются последние 50 записей. Итоги учитывают всю историю.',
          )
        }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.earnings-totals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}
.earnings-totals .editor-card {
  margin: 0;
}
.earnings-totals strong {
  display: block;
  font-size: 1.6rem;
  margin-top: 0.75rem;
}
.creator-earnings h3 {
  margin-top: 1.5rem;
}
@media (max-width: 680px) {
  .earnings-totals {
    grid-template-columns: 1fr;
  }
}
</style>
