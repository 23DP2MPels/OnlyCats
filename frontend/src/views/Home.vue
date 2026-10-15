<script setup lang="ts">
import { t } from '../i18n';
import { computed, onMounted, ref } from 'vue';
import { api, type Cat } from '../api';
import CatCard from '../components/CatCard.vue';
const cats = ref<Cat[]>([]);
const search = ref('');
const filter = ref('Все коты');
const loading = ref(true);
const error = ref('');
const filters = ['Все коты', 'Рыжие', 'Пушистые', 'С характером'];
const visible = computed(() =>
  cats.value
    .filter((cat) =>
      `${cat.name} ${cat.breed} ${cat.bio}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    )
    .filter(
      (cat) =>
        filter.value === 'Все коты' ||
        (filter.value === 'Рыжие'
          ? cat.avatar.includes('marmalade')
          : filter.value === 'Пушистые'
            ? /персид|рэгдолл|пушист/i.test(cat.breed + cat.bio)
            : /характер|британ/i.test(cat.breed + cat.bio)),
    ),
);
async function load() {
  loading.value = true;
  error.value = '';
  try {
    cats.value = await api<Cat[]>('/cats');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="hero wrap">
    <div class="hero-copy">
      <span class="eyebrow"
        ><span>✦</span> {{ t('ИНТЕРНЕТ СТАЛ ЧУТОЧКУ ДОБРЕЕ') }}</span
      >
      <h1>
        {{ t('У каждого кота') }}<br />{{ t('своя') }}
        <span class="serif">{{ t('история.') }}</span
        ><svg viewBox="0 0 270 18" aria-hidden="true">
          <path d="M3 12 Q130 -3 264 9 M32 17 Q150 5 241 15" />
        </svg>
      </h1>
      <p>
        {{ t('Сонные мордочки, внезапные тыгыдыки и жизнь')
        }}<br class="desktop-break" />{{
          t('без фильтров. Подпишитесь на тех, кто делает ваш день.')
        }}
      </p>
      <a class="button primary" href="#explore">{{
        t('Найти своего кота ↗')
      }}</a>
      <div class="hero-note">
        <span>♡</span> {{ t('Маленькая подписка. Большая любовь.') }}
      </div>
    </div>
    <div class="hero-art">
      <span class="doodle-star star-one">✳</span>
      <div class="hero-photo">
        <img
          src="/cats/hero.svg"
          :alt="t('Рыжий кот Мармелад отдыхает на подушке')"
        /><span class="photo-label"
          ><span class="online-dot"></span> {{ t('Мармелад') }}
          <small>{{ t('сейчас занят ничегонеделанием') }}</small></span
        ><span class="photo-heart">♡</span>
      </div>
      <div class="floating-note">
        {{ t('делает вид, что') }}<br />{{ t('не заметил вас') }} <span>↗</span>
      </div>
      <span class="doodle-star star-two">✧</span
      ><span class="art-caption">{{ t('100% кот. 0% лишних забот.') }}</span>
    </div>
  </section>
  <div class="ticker">
    <div class="wrap">
      <span>{{ t('Только коты') }}</span> ✦
      <span>{{ t('Никакой драмы') }}</span> ✦
      <span>{{ t('Свежая порция мур') }}</span> ✦
      <span>{{ t('Ваше тихое место') }}</span> ✦
      <span>{{ t('Только коты') }}</span> ✦
    </div>
  </div>
  <section id="explore" class="explore wrap">
    <div class="section-heading">
      <div>
        <span class="eyebrow">{{ t('ВАША ЕЖЕДНЕВНАЯ ДОЗА СЧАСТЬЯ') }}</span>
        <h2>
          {{ t('Приятно') }}
          <span class="serif">{{ t('познакомуриться.') }}</span>
        </h2>
      </div>
      <span class="section-caption"
        >{{ t('У каждого — свой характер.') }}<br />{{
          t('У вас точно найдётся любимчик.')
        }}</span
      >
    </div>
    <div class="catalog-tools">
      <div class="chips" :aria-label="t('Фильтр котов')">
        <button
          v-for="item in filters"
          :key="item"
          :class="{ active: filter === item }"
          @click="filter = item"
        >
          {{ t(item) }}
          <span v-if="item === 'Все коты'">{{ cats.length }}</span>
        </button>
      </div>
      <label class="search"
        ><span>⌕</span
        ><input
          v-model="search"
          type="search"
          :placeholder="t('Имя или порода')"
          :aria-label="t('Поиск котов')"
      /></label>
    </div>
    <p v-if="loading" class="empty">{{ t('Собираем котов…') }}</p>
    <div v-else-if="t(error)" class="empty" role="alert">
      <p>{{ t(error) }}</p>
      <button class="button" @click="load">{{ t('Попробовать ещё') }}</button>
    </div>
    <div v-else-if="!visible.length" class="empty">
      <h3>{{ t('Здесь пока тихо') }}</h3>
      <p>
        {{
          cats.length
            ? t('Попробуйте другой поиск или фильтр.')
            : t('Добавьте первого кота в личном кабинете.')
        }}
      </p>
    </div>
    <div v-else class="cat-grid">
      <CatCard
        v-for="(cat, index) in visible"
        :key="cat.id"
        :cat="cat"
        :index="index"
      />
    </div>
  </section>
  <section class="how wrap">
    <div>
      <span class="eyebrow">{{ t('ВСЁ ПРОЩЕ, ЧЕМ КАЖЕТСЯ') }}</span>
      <h2>
        {{ t('Три шага до') }} <span class="serif">{{ t('мур.') }}</span>
      </h2>
    </div>
    <div class="steps">
      <article>
        <span>01 /</span>
        <h3>{{ t('Встречайте') }}</h3>
        <p>{{ t('Выберите кота, который попал прямо в сердечко.') }}</p>
      </article>
      <article>
        <span>02 /</span>
        <h3>{{ t('Подписывайтесь') }}</h3>
        <p>
          {{ t('$5 в месяц через PayPal Sandbox. Здесь всё по-учебному.') }}
        </p>
      </article>
      <article>
        <span>03 /</span>
        <h3>{{ t('Улыбайтесь') }}</h3>
        <p>{{ t('Открывайте приватные фотографии и маленькие истории.') }}</p>
      </article>
    </div>
  </section>
  <section class="creator-banner wrap">
    <div>
      <span class="eyebrow">{{ t('ДОМА ЖИВЁТ ЗВЕЗДА?') }}</span>
      <h2>
        {{ t('Покажите миру') }}<br />{{ t('своего') }}
        <span class="serif">{{ t('главного героя.') }}</span>
      </h2>
    </div>
    <div>
      <p>
        {{ t('Создайте страницу кота, делитесь его приключениями') }}<br />{{
          t('и собирайте свой маленький клуб любителей лап.')
        }}
      </p>
      <RouterLink class="button primary" to="/account">{{
        t('Завести страницу кота ↗')
      }}</RouterLink>
    </div>
    <span class="banner-paw">✳</span>
  </section>
</template>
