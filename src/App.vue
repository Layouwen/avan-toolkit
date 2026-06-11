<script setup lang="ts">
import {
  darkTheme,
  NConfigProvider,
  NLayoutHeader,
  NMenu,
  NMessageProvider,
  NSpace,
} from 'naive-ui';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
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
  <NConfigProvider :theme="darkTheme">
    <NMessageProvider>
      <!-- 屏保窗口 - 不显示导航 -->
      <div v-if="isScreensaverWindow" class="h-screen w-screen overflow-hidden">
        <router-view />
      </div>
      <!-- 正常应用窗口 -->
      <div v-else class="h-screen flex flex-col">
        <NLayoutHeader bordered class="shrink-0">
          <NSpace class="px-4 py-2" align="center" justify="space-between">
            <div class="flex items-center gap-2 text-sm font-medium text-[#e5e7eb]">
              <img class="h-7 w-7 rounded-md" :src="appLogoUrl" alt="Avan Toolkit logo">
              Avan Toolkit
            </div>
            <NMenu
              mode="horizontal"
              responsive
              :value="activeMenuKey"
              :options="menuOptions"
              @update:value="handleNavigate"
            />
          </NSpace>
        </NLayoutHeader>

        <main class="flex-1 min-h-0 overflow-auto bg-[#111827]">
          <div class="min-h-full h-full">
            <router-view />
          </div>
        </main>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>
