<script setup lang="ts">
import type { AppConfig, QzoneAutomationResult, QzoneListItem } from '../electron-api.d';
import {
  NAlert,
  NButton,
  NCard,
  NForm,
  NFormItem,
  NImage,
  NImageGroup,
  NInput,
  NList,
  NListItem,
  NRadio,
  NRadioGroup,
  NSpace,
  NTag,
  NThing,
} from 'naive-ui';
import { computed, nextTick, onMounted, ref, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const config = ref<AppConfig>({
  obsidianBlogDir: '',
  hexoBlogDir: '',
  hexoEditorCommand: 'cursor',
  locale: '',
  agent: {
    baseURL: '',
    model: '',
    apiKey: '',
  },
  qzone: {
    loginMode: 'qr',
    qqNumber: '',
    qqPassword: '',
    playwrightProfileDir: '',
  },
  screensaver: {
    enabled: true,
    triggerIntervalMinutes: 45,
    countdownSeconds: 30,
    backgroundType: 'color',
    backgroundColor: '#1a3a2a',
    backgroundImagePath: '',
  },
});
const content = ref('');
const running = ref(false);
const testingLogin = ref(false);
const loadingList = ref(false);
const loadingMore = ref(false);
const result = ref<QzoneAutomationResult | null>(null);
const listItems = ref<QzoneListItem[]>([]);
const hasMoreList = ref(false);
const logContainer = ref<HTMLElement | null>(null);

const statusType = computed(() => {
  if (!result.value) {
    return 'default';
  }
  return result.value.success ? 'success' : 'error';
});

function qzoneTextLines(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.includes('\n')) {
    return normalized
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  }

  return normalized
    .replace(/\s+(时间：)/g, '\n$1')
    .replace(/\s+(正文：)/g, '\n$1')
    .replace(/\s+(图片\d+张)/g, '\n$1')
    .replace(/\s+(来自\s+)/g, '\n$1')
    .replace(/\s+(浏览\d+次)/g, '\n$1')
    .replace(/\s+(\d+人觉得很赞)/g, '\n$1')
    .replace(/\s+(评论\d+条)/g, '\n$1')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function plainConfig(): AppConfig {
  const current = toRaw(config.value);
  return {
    ...current,
    agent: {
      ...toRaw(current.agent),
    },
    qzone: {
      ...toRaw(current.qzone),
    },
  };
}

async function saveConfig() {
  await window.electronAPI.setConfig(plainConfig());
}

async function loadConfig() {
  config.value = await window.electronAPI.getConfig();
}

async function scrollLogsToBottom() {
  await nextTick();
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
}

async function runTestLogin() {
  if (testingLogin.value || running.value || loadingList.value || loadingMore.value) {
    return;
  }

  testingLogin.value = true;
  result.value = null;
  try {
    await saveConfig();
    result.value = await window.electronAPI.testQzoneLogin();
  }
  catch (error) {
    result.value = {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      steps: [],
    };
  }
  finally {
    testingLogin.value = false;
    await scrollLogsToBottom();
  }
}

async function publish() {
  const text = content.value.trim();
  if (!text || running.value || testingLogin.value || loadingList.value || loadingMore.value) {
    return;
  }

  running.value = true;
  result.value = null;
  try {
    await saveConfig();
    result.value = await window.electronAPI.publishQzoneShuoshuo(text);
  }
  catch (error) {
    result.value = {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      steps: [],
    };
  }
  finally {
    running.value = false;
    await scrollLogsToBottom();
  }
}

async function loadList() {
  if (loadingList.value || loadingMore.value || running.value || testingLogin.value) {
    return;
  }

  loadingList.value = true;
  result.value = null;
  hasMoreList.value = false;
  try {
    await saveConfig();
    const listResult = await window.electronAPI.listQzoneShuoshuo();
    result.value = listResult;
    listItems.value = listResult.items;
    hasMoreList.value = listResult.hasMore;
  }
  catch (error) {
    listItems.value = [];
    hasMoreList.value = false;
    result.value = {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      steps: [],
    };
  }
  finally {
    loadingList.value = false;
    await scrollLogsToBottom();
  }
}

async function loadMoreList() {
  if (loadingMore.value || loadingList.value || running.value || testingLogin.value || !hasMoreList.value) {
    return;
  }

  loadingMore.value = true;
  result.value = null;
  try {
    const listResult = await window.electronAPI.loadMoreQzoneShuoshuo();
    result.value = listResult;
    listItems.value = [...listItems.value, ...listResult.items];
    hasMoreList.value = listResult.hasMore;
  }
  catch (error) {
    hasMoreList.value = false;
    result.value = {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      steps: [],
    };
  }
  finally {
    loadingMore.value = false;
    await scrollLogsToBottom();
  }
}

onMounted(loadConfig);
</script>

<template>
  <main class="qzone-page min-h-full p-6">
    <NSpace vertical :size="16" class="mx-auto max-w-4xl">
      <NCard :title="t('qzonePage.title')" embedded>
        <NSpace vertical :size="16">
          <NAlert type="warning">
            {{ t('qzonePage.passwordWarning') }}
          </NAlert>

          <NForm label-placement="top">
            <NFormItem :label="t('qzonePage.loginModeLabel')">
              <NRadioGroup v-model:value="config.qzone.loginMode" @update:value="saveConfig">
                <NSpace>
                  <NRadio value="qr">
                    {{ t('qzonePage.loginModeQr') }}
                  </NRadio>
                  <NRadio value="credentials">
                    {{ t('qzonePage.loginModeCredentials') }}
                  </NRadio>
                </NSpace>
              </NRadioGroup>
            </NFormItem>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NFormItem :label="t('qzonePage.qqNumberLabel')">
                <NInput
                  v-model:value="config.qzone.qqNumber"
                  :placeholder="t('qzonePage.qqNumberPlaceholder')"
                  @blur="saveConfig"
                />
              </NFormItem>

              <NFormItem :label="t('qzonePage.qqPasswordLabel')">
                <NInput
                  v-model:value="config.qzone.qqPassword"
                  type="password"
                  show-password-on="click"
                  :placeholder="t('qzonePage.qqPasswordPlaceholder')"
                  @blur="saveConfig"
                />
              </NFormItem>
            </div>

            <NFormItem :label="t('qzonePage.profileDirLabel')">
              <NInput
                v-model:value="config.qzone.playwrightProfileDir"
                :placeholder="t('qzonePage.profileDirPlaceholder')"
                @blur="saveConfig"
              />
            </NFormItem>

            <NFormItem :label="t('qzonePage.contentLabel')">
              <NInput
                v-model:value="content"
                type="textarea"
                :rows="7"
                :placeholder="t('qzonePage.contentPlaceholder')"
              />
            </NFormItem>
          </NForm>

          <NSpace align="center" justify="space-between">
            <NSpace align="center">
              <NButton
                type="primary"
                :loading="running"
                :disabled="!content.trim() || running || testingLogin || loadingList || loadingMore"
                @click="publish"
              >
                {{ running ? t('qzonePage.publishing') : t('qzonePage.publish') }}
              </NButton>
              <NButton
                secondary
                :loading="testingLogin"
                :disabled="running || testingLogin || loadingList || loadingMore"
                @click="runTestLogin"
              >
                {{ testingLogin ? t('qzonePage.testingLogin') : t('qzonePage.testLogin') }}
              </NButton>
              <NButton
                secondary
                :loading="loadingList"
                :disabled="running || testingLogin || loadingList || loadingMore"
                @click="loadList"
              >
                {{ loadingList ? t('qzonePage.loadingList') : t('qzonePage.loadList') }}
              </NButton>
            </NSpace>

            <NTag :type="statusType" round>
              {{ result ? result.message : t('qzonePage.statusIdle') }}
            </NTag>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard :title="t('qzonePage.listTitle')" embedded>
        <NSpace vertical :size="12">
          <NList v-if="listItems.length > 0" bordered>
            <NListItem v-for="item in listItems" :key="item.id">
              <NThing>
                <template #description>
                  {{ item.source }}
                </template>
                <div class="text-[#d8dee9] leading-6">
                  <div
                    v-for="line in qzoneTextLines(item.text)"
                    :key="line"
                    class="break-all"
                  >
                    {{ line }}
                  </div>
                </div>
                <NImageGroup v-if="item.images.length > 0">
                  <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <NImage
                      v-for="image in item.images"
                      :key="image"
                      :src="image"
                      :preview-src="image"
                      object-fit="cover"
                      class="qzone-feed-image"
                      lazy
                    />
                  </div>
                </NImageGroup>
              </NThing>
            </NListItem>
          </NList>
          <div v-else class="text-[#94a3b8]">
            {{ t('qzonePage.listEmpty') }}
          </div>
          <NSpace v-if="listItems.length > 0" justify="center">
            <NButton
              secondary
              :loading="loadingMore"
              :disabled="loadingMore || loadingList || running || testingLogin || !hasMoreList"
              @click="loadMoreList"
            >
              {{ loadingMore ? t('qzonePage.loadingMore') : (hasMoreList ? t('qzonePage.loadMore') : t('qzonePage.noMore')) }}
            </NButton>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard :title="t('qzonePage.logsTitle')" embedded>
        <div
          ref="logContainer"
          class="h-[320px] overflow-y-auto rounded-md border border-[#2e3440] bg-[#141414] p-3 font-mono text-[12.5px] leading-relaxed"
        >
          <NThing
            v-for="step in result?.steps || []"
            :key="step"
            class="text-[#c9d1d9] whitespace-pre-wrap break-all"
          >
            {{ step }}
          </NThing>
          <div v-if="!result || result.steps.length === 0" class="text-[#555] italic text-center mt-5">
            {{ t('qzonePage.logsEmpty') }}
          </div>
        </div>
      </NCard>
    </NSpace>
  </main>
</template>

<style scoped>
.qzone-page {
  background:
    radial-gradient(1000px 480px at 85% -20%, rgba(64, 192, 116, 0.16), transparent 60%),
    radial-gradient(820px 420px at -10% 110%, rgba(72, 144, 255, 0.14), transparent 60%),
    linear-gradient(180deg, #121720 0%, #0f141d 100%);
}

.qzone-feed-image {
  height: 128px;
  width: 100%;
  overflow: hidden;
  border-radius: 4px;
  cursor: zoom-in;
}

.qzone-feed-image :deep(img) {
  height: 128px;
  width: 100%;
  object-fit: cover;
  display: block;
}
</style>
