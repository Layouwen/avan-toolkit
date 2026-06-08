<script setup lang="ts">
import type { AppConfig, ScreensaverStatus } from '../electron-api';
import {
  NButton,
  NCard,
  NColorPicker,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NPageHeader,
  NSelect,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
} from 'naive-ui';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import FlipCountdown from '../components/FlipCountdown.vue';

const { t } = useI18n();

const loading = ref(false);
const testing = ref(false);
const screensaverStatus = ref<ScreensaverStatus>({
  enabled: false,
  intervalSeconds: 0,
  nextTriggerAt: null,
  remainingSeconds: 0,
});
const remainingToOpenSeconds = ref(0);

let statusRefreshInterval: number | null = null;
let countdownInterval: number | null = null;

const config = reactive<AppConfig['screensaver']>({
  enabled: true,
  triggerIntervalMinutes: 45,
  countdownSeconds: 30,
  backgroundType: 'color',
  backgroundColor: '#1a3a2a',
  backgroundImagePath: '',
});

async function loadConfig() {
  loading.value = true;
  try {
    const fullConfig = await window.electronAPI.getConfig();
    Object.assign(config, fullConfig.screensaver);
  }
  finally {
    loading.value = false;
  }
}

async function saveConfig() {
  loading.value = true;
  try {
    const fullConfig = await window.electronAPI.getConfig();
    fullConfig.screensaver = { ...config };
    await window.electronAPI.setConfig(fullConfig);
    await refreshScreensaverStatus();
  }
  finally {
    loading.value = false;
  }
}

async function handleSelectImage() {
  const path = await window.electronAPI.selectImageFile();
  if (path) {
    config.backgroundImagePath = path;
  }
}

async function handleTest() {
  testing.value = true;
  try {
    await window.electronAPI.triggerScreensaver();
  }
  finally {
    testing.value = false;
  }
}

async function refreshScreensaverStatus() {
  screensaverStatus.value = await window.electronAPI.getScreensaverStatus();
  updateRemainingToOpenSeconds();
}

function updateRemainingToOpenSeconds() {
  if (!screensaverStatus.value.enabled || !screensaverStatus.value.nextTriggerAt) {
    remainingToOpenSeconds.value = 0;
    return;
  }

  remainingToOpenSeconds.value = Math.max(
    0,
    Math.ceil((screensaverStatus.value.nextTriggerAt - Date.now()) / 1000),
  );
}

function startStatusPolling() {
  if (statusRefreshInterval) {
    clearInterval(statusRefreshInterval);
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  void refreshScreensaverStatus();
  statusRefreshInterval = window.setInterval(() => {
    void refreshScreensaverStatus();
  }, 5000);
  countdownInterval = window.setInterval(updateRemainingToOpenSeconds, 1000);
}

const nextTriggerTime = computed(() => {
  if (!screensaverStatus.value.nextTriggerAt) {
    return '--';
  }

  return new Date(screensaverStatus.value.nextTriggerAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

onMounted(() => {
  void loadConfig();
  startStatusPolling();
});

onUnmounted(() => {
  if (statusRefreshInterval) {
    clearInterval(statusRefreshInterval);
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});
</script>

<template>
  <main class="screensaver-settings-page h-full p-6">
    <NSpace vertical :size="24" class="h-full">
      <NPageHeader>
        <template #title>
          {{ t('screensaverPage.title') }}
        </template>
      </NPageHeader>

      <NCard class="screensaver-settings-card">
        <NTabs type="line" animated class="screensaver-tabs">
          <NTabPane name="settings" :tab="t('screensaverPage.settingsTab')">
            <NForm :model="config" label-placement="left" label-width="180">
              <NFormItem :label="t('screensaverPage.enabled')">
                <NSwitch v-model:value="config.enabled" @update:value="saveConfig" />
              </NFormItem>

              <NFormItem :label="t('screensaverPage.triggerInterval')">
                <NInputNumber
                  v-model:value="config.triggerIntervalMinutes"
                  :min="1"
                  :max="480"
                  style="width: 200px"
                  @update:value="saveConfig"
                />
              </NFormItem>

              <NFormItem :label="t('screensaverPage.countdownDuration')">
                <NInputNumber
                  v-model:value="config.countdownSeconds"
                  :min="5"
                  :max="300"
                  style="width: 200px"
                  @update:value="saveConfig"
                />
              </NFormItem>

              <NFormItem :label="t('screensaverPage.backgroundType')">
                <NSelect
                  v-model:value="config.backgroundType"
                  style="width: 200px"
                  :options="[
                    { label: t('screensaverPage.backgroundTypeColor'), value: 'color' },
                    { label: t('screensaverPage.backgroundTypeImage'), value: 'image' },
                  ]"
                  @update:value="saveConfig"
                />
              </NFormItem>

              <NFormItem v-if="config.backgroundType === 'color'" :label="t('screensaverPage.backgroundColor')">
                <NColorPicker v-model:value="config.backgroundColor" @update:value="saveConfig" />
              </NFormItem>

              <NFormItem v-if="config.backgroundType === 'image'" :label="t('screensaverPage.backgroundImage')">
                <div class="flex gap-3 items-center">
                  <NInput
                    v-model:value="config.backgroundImagePath"
                    readonly
                    style="flex: 1; max-width: 400px"
                    placeholder="未选择图片"
                  />
                  <NButton @click="handleSelectImage">
                    {{ t('screensaverPage.browse') }}
                  </NButton>
                </div>
              </NFormItem>

              <NFormItem>
                <NButton type="primary" :loading="testing" @click="handleTest">
                  {{ testing ? t('screensaverPage.testing') : t('screensaverPage.testNow') }}
                </NButton>
              </NFormItem>
            </NForm>
          </NTabPane>

          <NTabPane name="next-trigger" :tab="t('screensaverPage.nextTriggerTab')">
            <section class="next-trigger-pane">
              <div class="space-y-2">
                <div class="text-sm text-[#9ca3af]">
                  {{ t('screensaverPage.nextTriggerLabel') }}
                </div>
                <div class="text-lg text-[#e5e7eb]">
                  {{ screensaverStatus.enabled ? t('screensaverPage.nextTriggerAt', { time: nextTriggerTime }) : t('screensaverPage.disabledStatus') }}
                </div>
              </div>

              <div class="countdown-fill-stage">
                <FlipCountdown
                  :seconds="remainingToOpenSeconds"
                  :finished="!screensaverStatus.enabled || remainingToOpenSeconds <= 0"
                  fill
                />
              </div>
            </section>
          </NTabPane>
        </NTabs>
      </NCard>
    </NSpace>
  </main>
</template>

<style scoped>
.screensaver-settings-page {
  min-height: 0;
}

.screensaver-settings-card {
  min-height: 0;
}

.screensaver-settings-card :deep(.n-card__content) {
  min-height: 0;
}

.next-trigger-pane {
  height: calc(100vh - 252px);
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 32px 0 12px;
  text-align: center;
}

.countdown-fill-stage {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
