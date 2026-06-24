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
      meta: { requiresElectron: true },
      component: () => import('../views/About.vue'),
    },
    {
      path: '/sync',
      meta: { requiresElectron: true },
      component: () => import('../views/BlogSync.vue'),
    },
    {
      path: '/agent',
      meta: { requiresElectron: true },
      component: () => import('../views/Agent.vue'),
    },
    {
      path: '/editor-extensions',
      meta: { requiresElectron: true },
      component: () => import('../views/EditorExtensions.vue'),
    },
    {
      path: '/life-tools',
      component: () => import('../views/LifeTools.vue'),
    },
    {
      path: '/qzone',
      meta: { requiresElectron: true },
      component: () => import('../views/QzonePublisher.vue'),
    },
    {
      path: '/logs',
      meta: { requiresElectron: true },
      component: () => import('../views/Logs.vue'),
    },
    {
      path: '/screensaver',
      meta: { requiresElectron: true },
      component: () => import('../views/Screensaver.vue'),
    },
    {
      path: '/screensaver-window',
      meta: { requiresElectron: true },
      component: () => import('../views/ScreensaverWindow.vue'),
    },
  ],
});

router.beforeEach((to) => {
  if (to.matched.some(route => route.meta.requiresElectron) && !isElectronRuntime()) {
    return '/life-tools';
  }
});

function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);
}

export default router;
