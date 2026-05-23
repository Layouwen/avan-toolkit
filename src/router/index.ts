import { createMemoryHistory, createRouter } from 'vue-router';

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/about',
      component: () => import('../views/About.vue'),
    },
    {
      path: '/sync',
      component: () => import('../views/BlogSync.vue'),
    },
  ],
});

export default router;
