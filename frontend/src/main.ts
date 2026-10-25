import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Home from './views/Home.vue';
import SocialFeed from './views/SocialFeed.vue';
import CatProfile from './views/CatProfile.vue';
import Login from './views/Login.vue';
import Account from './views/Account.vue';
import Payment from './views/Payment.vue';
import NotFound from './views/NotFound.vue';
import './style.css';
const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: SocialFeed },
    { path: '/explore', component: Home },
    { path: '/cats/:id', component: CatProfile },
    { path: '/login', component: Login },
    { path: '/account', component: Account },
    { path: '/payment/return', component: Payment },
    { path: '/:pathMatch(.*)*', component: NotFound },
  ],
});
createApp(App).use(router).mount('#app');
