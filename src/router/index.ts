import { createMemoryHistory, createRouter } from 'vue-router';

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/user',
      component: () => import('../views/User.vue'),
    },
    {
      path: '/sync',
      component: () => import('../views/BlogSync.vue'),
    },
  ],
});

export default router;
