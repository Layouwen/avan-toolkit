<script setup lang="ts">
import {
  darkTheme,
  NButton,
  NCard,
  NConfigProvider,
  NPageHeader,
  NSpace,
  NTag,
} from 'naive-ui';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

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
  <NConfigProvider :theme="darkTheme">
    <main class="p-6">
      <NSpace vertical :size="18">
        <NPageHeader>
          <template #title>
            {{ t('home.title') }}
          </template>
          <template #subtitle>
            Toolkit
          </template>
          <template #extra>
            <NTag type="success" size="small" round>
              Naive UI
            </NTag>
          </template>
        </NPageHeader>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NCard
            v-for="tool in tools"
            :key="tool.path"
            embedded
            hoverable
            class="tool-card"
            @click="router.push(tool.path)"
          >
            <NSpace vertical :size="12">
              <div>
                <h2 class="text-base font-medium text-[#f2f2f2] mb-1">
                  {{ tool.title }}
                </h2>
                <p class="text-sm text-[#a8a8a8] leading-6">
                  {{ tool.description }}
                </p>
              </div>

              <NButton type="primary" secondary size="small">
                Open
              </NButton>
            </NSpace>
          </NCard>
        </div>
      </NSpace>
    </main>
  </NConfigProvider>
</template>

<style scoped>
.tool-card {
  cursor: pointer;
}
</style>
