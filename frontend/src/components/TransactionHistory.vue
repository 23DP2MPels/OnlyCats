<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';
import { locale, t } from '../i18n';

type Transaction = {
  id: string;
  amountCents: number;
  currency: string;
  direction: 'INCOME' | 'EXPENSE';
  status: string;
  paidAt: string;
  cat: { name: string };
};
const transactions = ref<Transaction[]>([]);
const busy = ref(false);
const error = ref('');
const labels: Record<string, string> = {
  COMPLETED: 'Подтверждён',
  REFUNDED: 'Возвращён',
  PARTIALLY_REFUNDED: 'Частичный возврат',
};
const money = (transaction: Transaction) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: transaction.currency,
  }).format(transaction.amountCents / 100);
const dateTime = (date: string) =>
  new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
async function load(sync = false) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    transactions.value = await api<Transaction[]>(
      sync ? '/account/transactions/sync' : '/account/transactions',
      sync ? { method: 'POST' } : {},
    );
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
onMounted(() => load());
</script>

<template>
  <section :aria-busy="busy">
    <div class="section-heading">
      <h2>{{ t('История транзакций') }}</h2>
      <button class="button" :disabled="busy" @click="load(true)">
        {{ t('Обновить транзакции') }}
      </button>
    </div>
    <p class="muted">
      {{
        t(
          'Ваши оплаты и поступления по котам. Все операции выполнены в PayPal Sandbox.',
        )
      }}
    </p>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
    <p v-if="busy" class="empty">{{ t('Загружаем историю…') }}</p>
    <p v-else-if="!transactions.length && !error" class="empty">
      {{
        t(
          'Транзакций пока нет. Нажмите «Обновить транзакции», чтобы загрузить прежние оплаты.',
        )
      }}
    </p>
    <article
      v-for="transaction in transactions"
      :key="transaction.id"
      class="manage-post transaction-row"
    >
      <div>
        <strong>{{ transaction.cat.name }}</strong>
        <p class="muted">
          {{ dateTime(transaction.paidAt) }} ·
          {{ t(labels[transaction.status]) }}
        </p>
      </div>
      <div class="transaction-amount">
        <strong
          >{{ transaction.direction === 'INCOME' ? '+' : '−'
          }}{{ money(transaction) }}</strong
        >
        <p class="muted">
          {{
            transaction.direction === 'INCOME'
              ? t('Поступление')
              : t('Оплата подписки')
          }}
        </p>
      </div>
    </article>
    <p v-if="transactions.length" class="muted">
      {{
        t(
          'Показаны последние 100 транзакций. Суммы поступлений указаны до комиссий PayPal.',
        )
      }}
    </p>
  </section>
</template>

<style scoped>
.transaction-row {
  gap: 1rem;
  flex-wrap: wrap;
}
.transaction-amount {
  text-align: end;
}
</style>
