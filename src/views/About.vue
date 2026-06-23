<script setup lang="ts">
import type { AppUpdateInfo } from '../electron-api';
import {
  NAlert,
  NButton,
  NCard,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import packageJson from '../../package.json';

const { t, locale } = useI18n();
const message = useMessage();
const updateInfo = ref<AppUpdateInfo | null>(null);
const checkingUpdate = ref(false);
const updateError = ref('');
const currentVersion = computed(() => updateInfo.value?.currentVersion ?? packageJson.version);

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

const updateStatus = computed(() => {
  if (updateError.value) {
    return 'error';
  }
  if (checkingUpdate.value) {
    return 'checking';
  }
  if (!updateInfo.value) {
    return 'idle';
  }
  return updateInfo.value.hasUpdate ? 'available' : 'latest';
});

const updateTagType = computed(() => {
  switch (updateStatus.value) {
    case 'available':
      return 'success';
    case 'error':
      return 'error';
    case 'checking':
      return 'info';
    default:
      return 'default';
  }
});

const releaseNotesPreview = computed(() => {
  const notes = updateInfo.value?.releaseNotes.trim() ?? '';
  if (!notes) {
    return '';
  }
  return notes.length > 280 ? `${notes.slice(0, 280)}...` : notes;
});

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

async function checkUpdates() {
  checkingUpdate.value = true;
  updateError.value = '';
  try {
    updateInfo.value = await window.electronAPI.getUpdateInfo();
  }
  catch (error) {
    updateError.value = error instanceof Error ? error.message : String(error);
  }
  finally {
    checkingUpdate.value = false;
  }
}

async function openUpdateTarget() {
  const target = updateInfo.value?.downloadUrl || updateInfo.value?.releaseUrl;
  if (!target) {
    return;
  }

  try {
    await window.electronAPI.openUpdateDownload(target);
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
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
        <NCard size="small" embedded>
          <NSpace vertical :size="10">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <NText depth="2">
                  {{ t('about.update.currentVersion') }}
                </NText>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <NText strong>
                    v{{ currentVersion }}
                  </NText>
                  <NTag size="small" :type="updateTagType">
                    {{ t(`about.update.status.${updateStatus}`) }}
                  </NTag>
                </div>
              </div>

              <NSpace :size="8">
                <NButton size="small" secondary :loading="checkingUpdate" @click="checkUpdates">
                  {{ t('about.update.check') }}
                </NButton>
                <NButton
                  v-if="updateInfo?.hasUpdate"
                  size="small"
                  type="primary"
                  @click="openUpdateTarget"
                >
                  {{ updateInfo.downloadUrl ? t('about.update.download') : t('about.update.openRelease') }}
                </NButton>
              </NSpace>
            </div>

            <NAlert
              v-if="updateStatus !== 'idle'"
              :type="updateStatus === 'error' ? 'error' : (updateStatus === 'available' ? 'success' : 'info')"
              :show-icon="false"
            >
              <div class="space-y-2">
                <div v-if="updateError">
                  {{ t('about.update.errorPrefix') }}{{ updateError }}
                </div>
                <div v-else-if="updateInfo?.hasUpdate">
                  {{ t('about.update.available', { version: updateInfo.latestVersion }) }}
                </div>
                <div v-else-if="updateInfo">
                  {{ t('about.update.latest') }}
                </div>
                <div v-else>
                  {{ t('about.update.checking') }}
                </div>

                <div v-if="updateInfo?.hasUpdate" class="space-y-1">
                  <NText depth="3" class="block text-xs">
                    {{ updateInfo.downloadAssetName ? t('about.update.asset', { name: updateInfo.downloadAssetName }) : t('about.update.noAsset') }}
                  </NText>
                  <NText v-if="releaseNotesPreview" depth="3" class="block whitespace-pre-line text-xs">
                    {{ releaseNotesPreview }}
                  </NText>
                </div>
              </div>
            </NAlert>
          </NSpace>
        </NCard>

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
