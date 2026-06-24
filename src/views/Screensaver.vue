<script setup lang="ts">
import type { AppConfig, ScreensaverStatus } from '../electron-api';
import { ImageIcon, Loader2Icon, PlayIcon } from '@lucide/vue';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    await saveConfig();
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
    <div class="flex h-full flex-col gap-6">
      <div>
        <h1 class="text-2xl font-semibold text-foreground">
          {{ t('screensaverPage.title') }}
        </h1>
      </div>

      <Card class="screensaver-settings-card min-h-0">
        <CardContent>
          <Tabs default-value="settings" class="screensaver-tabs">
            <TabsList>
              <TabsTrigger value="settings">
                {{ t('screensaverPage.settingsTab') }}
              </TabsTrigger>
              <TabsTrigger value="next-trigger">
                {{ t('screensaverPage.nextTriggerTab') }}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings">
              <FieldGroup class="max-w-2xl">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{{ t('screensaverPage.enabled') }}</FieldTitle>
                  </FieldContent>
                  <Switch v-model="config.enabled" @update:model-value="saveConfig" />
                </Field>

                <Field>
                  <FieldLabel for="screensaver-trigger-interval">
                    {{ t('screensaverPage.triggerInterval') }}
                  </FieldLabel>
                  <Input
                    id="screensaver-trigger-interval"
                    v-model.number="config.triggerIntervalMinutes"
                    type="number"
                    :min="1"
                    :max="480"
                    class="max-w-[200px]"
                    @change="saveConfig"
                  />
                </Field>

                <Field>
                  <FieldLabel for="screensaver-countdown">
                    {{ t('screensaverPage.countdownDuration') }}
                  </FieldLabel>
                  <Input
                    id="screensaver-countdown"
                    v-model.number="config.countdownSeconds"
                    type="number"
                    :min="5"
                    :max="300"
                    class="max-w-[200px]"
                    @change="saveConfig"
                  />
                </Field>

                <Field>
                  <FieldLabel>{{ t('screensaverPage.backgroundType') }}</FieldLabel>
                  <NativeSelect v-model="config.backgroundType" class="max-w-[200px]" @update:model-value="saveConfig">
                    <NativeSelectOption value="color">
                      {{ t('screensaverPage.backgroundTypeColor') }}
                    </NativeSelectOption>
                    <NativeSelectOption value="image">
                      {{ t('screensaverPage.backgroundTypeImage') }}
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>

                <Field v-if="config.backgroundType === 'color'">
                  <FieldLabel for="screensaver-background-color">
                    {{ t('screensaverPage.backgroundColor') }}
                  </FieldLabel>
                  <Input
                    id="screensaver-background-color"
                    v-model="config.backgroundColor"
                    type="color"
                    class="h-10 max-w-[200px] p-1"
                    @change="saveConfig"
                  />
                </Field>

                <Field v-if="config.backgroundType === 'image'">
                  <FieldLabel for="screensaver-background-image">
                    {{ t('screensaverPage.backgroundImage') }}
                  </FieldLabel>
                  <div class="flex gap-3 items-center">
                    <Input
                      id="screensaver-background-image"
                      v-model="config.backgroundImagePath"
                      readonly
                      class="max-w-[400px] flex-1"
                      placeholder="未选择图片"
                    />
                    <Button variant="secondary" @click="handleSelectImage">
                      <ImageIcon data-icon="inline-start" />
                      {{ t('screensaverPage.browse') }}
                    </Button>
                  </div>
                </Field>

                <Field>
                  <Button :disabled="testing" @click="handleTest">
                    <Loader2Icon v-if="testing" data-icon="inline-start" class="animate-spin" />
                    <PlayIcon v-else data-icon="inline-start" />
                    {{ testing ? t('screensaverPage.testing') : t('screensaverPage.testNow') }}
                  </Button>
                </Field>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="next-trigger">
              <section class="next-trigger-pane">
                <div class="space-y-2">
                  <div class="text-sm text-muted-foreground">
                    {{ t('screensaverPage.nextTriggerLabel') }}
                  </div>
                  <div class="text-lg text-foreground">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  </main>
</template>

<style scoped>
.screensaver-settings-page {
  min-height: 0;
}

.screensaver-settings-card {
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
