<script setup lang="ts">
import {
  NButton,
  NCard,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
const message = useMessage();

const links = computed(() => [
  {
    label: t('about.links.github'),
    url: 'https://github.com/layouwen',
    display: 'Avan',
    action: 'open',
  },
  {
    label: t('about.links.blog'),
    url: 'https://blog.4van.top',
    display: 'Avan\'s Blog',
    action: 'open',
  },
  {
    label: t('about.links.twitter'),
    url: 'https://x.com/avancoding',
    display: 'avancoding',
    action: 'open',
  },
  {
    label: t('about.links.juejin'),
    url: 'https://juejin.cn/user/1732486058213822',
    display: 'Avan菜菜',
    action: 'open',
  },
  {
    label: t('about.links.email'),
    url: 'mailto:layouwen@gmail.com',
    display: 'layouwen@gmail.com',
    action: 'copy',
  },
]);

function openLink(url: string) {
  window.electronAPI.openExternal(url);
}

async function handleLinkClick(link: { url: string; display: string; label: string; action: string }) {
  if (link.action === 'copy') {
    await navigator.clipboard.writeText(link.display);
    message.success(`${link.label ?? ''}${link.label ? ' ' : ''}已复制`);
    return;
  }

  openLink(link.url);
}

async function toggleLocale() {
  locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN';
  const config = await window.electronAPI.getConfig();
  await window.electronAPI.setConfig({ ...config, locale: locale.value });
}
</script>

<template>
  <main class="min-h-full p-6">
    <NCard :title="t('about.title')" embedded>
      <template #header-extra>
        <NButton tertiary size="small" @click="toggleLocale">
          {{ t('about.language') }}
        </NButton>
      </template>

      <NSpace vertical :size="12" class="max-w-xl">
        <NCard
          v-for="link in links"
          :key="link.url"
          size="small"
          hoverable
          embedded
          class="link-card cursor-pointer"
          @click="handleLinkClick(link)"
        >
          <div class="flex items-center justify-between gap-3">
            <NText depth="2">
              {{ link.label }}
            </NText>
            <NText depth="3" class="text-xs">
              {{ link.display }}
            </NText>
          </div>
        </NCard>
      </NSpace>
    </NCard>
  </main>
</template>

<style scoped>
</style>
