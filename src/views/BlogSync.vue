<script setup lang="ts">
import type { AppConfig } from '../electron-api.d';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSpace,
  NTag,
  NThing,
} from 'naive-ui';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface LogLine {
  id: number;
  text: string;
  level: 'info' | 'success' | 'error';
}

const config = ref<AppConfig>({
  obsidianBlogDir: '',
  hexoBlogDir: '',
  locale: '',
  agent: {
    baseURL: '',
    model: '',
    apiKey: '',
  },
});
const logs = ref<LogLine[]>([]);
const syncing = ref(false);
const status = ref<'idle' | 'syncing' | 'success' | 'error'>('idle');
const logContainer = ref<HTMLElement | null>(null);
let logIdCounter = 0;

onMounted(async () => {
  config.value = await window.electronAPI.getConfig();
  window.electronAPI.onSyncLog((message, level) => {
    logs.value.push({ id: logIdCounter++, text: message, level: level as LogLine['level'] });
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  });
});

onUnmounted(() => {
  window.electronAPI.offSyncLog();
});

type BlogPathField = 'obsidianBlogDir' | 'hexoBlogDir';

async function browseDir(field: BlogPathField) {
  const dir = await window.electronAPI.selectDirectory();
  if (dir) {
    config.value[field] = dir;
    await window.electronAPI.setConfig({ ...config.value });
  }
}

async function saveConfig() {
  await window.electronAPI.setConfig({ ...config.value });
}

async function startSync() {
  if (syncing.value)
    return;
  syncing.value = true;
  status.value = 'syncing';
  logs.value = [];

  await window.electronAPI.setConfig({ ...config.value });

  window.electronAPI.onSyncDone((success, error) => {
    syncing.value = false;
    status.value = success ? 'success' : 'error';
    if (error) {
      logs.value.push({ id: logIdCounter++, text: t('blogSync.logs.failed', { error }), level: 'error' });
    }
    else {
      logs.value.push({ id: logIdCounter++, text: t('blogSync.logs.done'), level: 'success' });
    }
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  });

  await window.electronAPI.startSync();
}

function clearLogs() {
  logs.value = [];
}
</script>

<template>
  <main class="flex flex-col gap-5 p-6 min-h-full">
    <NCard :title="t('blogSync.config.title')" embedded>
      <NForm label-placement="top">
        <NFormItem :label="t('blogSync.config.obsidianBlogDir')">
          <NSpace class="w-full" :wrap="false">
            <NInput
              v-model:value="config.obsidianBlogDir"
              :placeholder="t('blogSync.config.obsidianPlaceholder')"
              @blur="saveConfig"
            />
            <NButton @click="browseDir('obsidianBlogDir')">
              {{ t('blogSync.config.browse') }}
            </NButton>
          </NSpace>
        </NFormItem>

        <NFormItem :label="t('blogSync.config.hexoBlogDir')">
          <NSpace class="w-full" :wrap="false">
            <NInput
              v-model:value="config.hexoBlogDir"
              :placeholder="t('blogSync.config.hexoPlaceholder')"
              @blur="saveConfig"
            />
            <NButton @click="browseDir('hexoBlogDir')">
              {{ t('blogSync.config.browse') }}
            </NButton>
          </NSpace>
        </NFormItem>
      </NForm>
    </NCard>

    <NCard embedded>
      <NSpace align="center" justify="space-between">
        <NSpace align="center">
          <NButton
            type="primary"
            :loading="syncing"
            :disabled="syncing || !config.obsidianBlogDir || !config.hexoBlogDir"
            @click="startSync"
          >
            {{ syncing ? t('blogSync.action.syncing') : t('blogSync.action.sync') }}
          </NButton>
          <NTag
            :type="status === 'success' ? 'success' : status === 'error' ? 'error' : status === 'syncing' ? 'warning' : 'default'"
            round
          >
            {{ t(`blogSync.status.${status}`) }}
          </NTag>
        </NSpace>
      </NSpace>
    </NCard>

    <NCard class="flex-1 min-h-0" embedded>
      <template #header>
        {{ t('blogSync.logs.title') }}
      </template>
      <template #header-extra>
        <NButton tertiary size="small" @click="clearLogs">
          {{ t('blogSync.logs.clear') }}
        </NButton>
      </template>

      <div
        ref="logContainer"
        class="h-full overflow-y-auto rounded-md border border-[#2e3440] bg-[#141414] p-3 font-mono text-[12.5px] leading-relaxed"
      >
        <NThing
          v-for="line in logs"
          :key="line.id"
          class="whitespace-pre-wrap break-all"
          :class="{
            'text-[#c9d1d9]': line.level === 'info',
            'text-[#40c074]': line.level === 'success',
            'text-[#e05252]': line.level === 'error',
          }"
        >
          {{ line.text }}
        </NThing>

        <div v-if="logs.length === 0" class="text-[#555] italic text-center mt-5">
          {{ t('blogSync.logs.empty') }}
        </div>
      </div>
    </NCard>
  </main>
</template>
