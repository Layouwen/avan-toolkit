<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

const links = computed(() => [
  {
    label: t('about.links.github'),
    url: 'https://github.com/Layouwen',
    display: 'github.com/Layouwen',
  },
  {
    label: t('about.links.blog'),
    url: 'https://layouwen.com',
    display: 'layouwen.com',
  },
  {
    label: t('about.links.twitter'),
    url: 'https://x.com/Layouwen',
    display: 'x.com/Layouwen',
  },
  {
    label: t('about.links.juejin'),
    url: 'https://juejin.cn/user/Layouwen',
    display: 'juejin.cn/user/Layouwen',
  },
  {
    label: t('about.links.email'),
    url: 'mailto:me@layouwen.com',
    display: 'me@layouwen.com',
  },
]);

function openLink(url: string) {
  window.electronAPI.openExternal(url);
}

function toggleLocale() {
  locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN';
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold text-[#e0e0e0]">
        {{ t('about.title') }}
      </h1>
      <button
        class="bg-[#252526] border border-[#333] rounded-md px-3 py-1 text-xs text-[#aaa] hover:text-[#e0e0e0] hover:border-[#555] transition-colors cursor-pointer"
        @click="toggleLocale"
      >
        {{ t('about.language') }}
      </button>
    </div>
    <div class="flex flex-col gap-3 max-w-md">
      <button
        v-for="link in links"
        :key="link.url"
        class="flex items-center gap-3 bg-[#252526] border border-[#333] rounded-lg px-4 py-3 text-[#aaa] hover:text-[#e0e0e0] hover:border-[#555] transition-colors text-left cursor-pointer"
        @click="openLink(link.url)"
      >
        <span class="text-sm font-medium min-w-20">{{ link.label }}</span>
        <span class="text-xs text-[#666]">{{ link.display }}</span>
      </button>
    </div>
  </div>
</template>
