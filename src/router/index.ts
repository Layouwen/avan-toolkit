import { createRouter, createMemoryHistory } from 'vue-router';

import BlogSync from '../views/BlogSync.vue';

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      redirect: '/sync',
    },
    {
      path: '/sync',
      component: BlogSync,
    },
  ],
});

export default router;
