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
    {
      path: '/agent',
      component: () => import('../views/Agent.vue'),
    },
    {
      path: '/qzone',
      component: () => import('../views/QzonePublisher.vue'),
    },
    {
      path: '/logs',
      component: () => import('../views/Logs.vue'),
    },
    {
      path: '/screensaver',
      component: () => import('../views/Screensaver.vue'),
    },
    {
      path: '/screensaver-window',
      component: () => import('../views/ScreensaverWindow.vue'),
    },
  ],
});

export default router;
