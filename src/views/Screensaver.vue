<script setup lang="ts">
import type { AppConfig } from '../electron-api';
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
} from 'naive-ui';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const loading = ref(false);
const testing = ref(false);

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

onMounted(() => {
  void loadConfig();
});
</script>

<template>
  <main class="min-h-full p-6">
    <NSpace vertical :size="24">
      <NPageHeader>
        <template #title>
          {{ t('screensaverPage.title') }}
        </template>
      </NPageHeader>

      <NCard>
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
      </NCard>
    </NSpace>
  </main>
</template>
