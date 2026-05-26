<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

onMounted(async () => {
  const config = await window.electronAPI.getConfig();
  if (config.locale) {
    locale.value = config.locale;
  }
});
</script>

<template>
  <nav class="flex items-center gap-3 px-4 py-2 bg-[#1e1e1e] border-b border-[#333] text-sm">
    <router-link to="/" class="text-[#aaa] hover:text-[#e0e0e0] transition-colors">
      {{ t('nav.home') }}
    </router-link>
    <span class="text-[#444]">|</span>
    <router-link to="/sync" class="text-[#aaa] hover:text-[#e0e0e0] transition-colors">
      {{ t('nav.blogSync') }}
    </router-link>
    <span class="text-[#444]">|</span>
    <router-link to="/agent" class="text-[#aaa] hover:text-[#e0e0e0] transition-colors">
      {{ t('nav.agent') }}
    </router-link>
    <span class="text-[#444]">|</span>
    <router-link to="/about" class="text-[#aaa] hover:text-[#e0e0e0] transition-colors">
      {{ t('nav.about') }}
    </router-link>
  </nav>
  <div class="h-full">
    <router-view />
  </div>
</template>
