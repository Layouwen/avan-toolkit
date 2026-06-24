<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import appLogoUrl from '../assets/icons/AvanToolkit.png';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

const isScreensaverWindow = computed(() => route.path === '/screensaver-window');

const menuOptions = computed(() => [
  { label: t('nav.home'), key: '/' },
  { label: t('nav.blogSync'), key: '/sync' },
  { label: t('nav.qzone'), key: '/qzone' },
  { label: t('nav.agent'), key: '/agent' },
  { label: t('nav.editorExtensions'), key: '/editor-extensions' },
  { label: t('nav.lifeTools'), key: '/life-tools' },
  { label: t('nav.screensaver'), key: '/screensaver' },
  { label: t('nav.logs'), key: '/logs' },
  { label: t('nav.about'), key: '/about' },
]);

const activeMenuKey = computed(() => route.path);

function handleNavigate(key: string) {
  if (key !== route.path) {
    router.push(key);
  }
}

onMounted(async () => {
  const config = await window.electronAPI.getConfig();
  if (config.locale) {
    locale.value = config.locale;
  }
});
</script>

<template>
  <Toaster rich-colors position="top-right" />

  <!-- 屏保窗口 - 不显示导航 -->
  <div v-if="isScreensaverWindow" class="h-screen w-screen overflow-hidden">
    <router-view />
  </div>

  <!-- 正常应用窗口 -->
  <div v-else class="flex h-screen flex-col bg-background text-foreground">
    <header class="shrink-0 border-b border-border bg-card/95">
      <div class="flex items-center justify-between gap-4 px-4 py-2">
        <div class="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
          <img class="size-7 rounded-md" :src="appLogoUrl" alt="Avan Toolkit logo">
          Avan Toolkit
        </div>

        <nav class="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto">
          <Button
            v-for="item in menuOptions"
            :key="item.key"
            size="sm"
            :variant="activeMenuKey === item.key ? 'secondary' : 'ghost'"
            :class="cn('shrink-0', activeMenuKey === item.key && 'bg-accent text-accent-foreground')"
            @click="handleNavigate(item.key)"
          >
            {{ item.label }}
          </Button>
        </nav>
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-auto bg-background">
      <div class="h-full min-h-full">
        <router-view />
      </div>
    </main>
  </div>
</template>
