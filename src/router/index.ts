import { createRouter, createMemoryHistory } from 'vue-router';

import HomeView from '../views/HomeView.vue';
import User from '../views/User.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      component: HomeView,
    },
    {
      path: '/user',
      component: User
    }
  ],
});

export default router;
