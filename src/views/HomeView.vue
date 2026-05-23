<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const { t } = useI18n();

const tools = computed(() => [
  {
    title: t('home.tools.blogSync.title'),
    description: t('home.tools.blogSync.description'),
    path: '/sync',
  },
]);
</script>

<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold text-[#e0e0e0] mb-6">
      {{ t('home.title') }}
    </h1>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="tool in tools"
        :key="tool.path"
        class="bg-[#252526] border border-[#333] rounded-lg p-5 cursor-pointer hover:border-[#555] transition-colors"
        @click="router.push(tool.path)"
      >
        <h2 class="text-[#e0e0e0] font-medium mb-1">
          {{ tool.title }}
        </h2>
        <p class="text-[#888] text-sm">
          {{ tool.description }}
        </p>
      </div>
    </div>
  </div>
</template>
