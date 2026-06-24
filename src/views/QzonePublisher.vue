<script setup lang="ts">
import type { AppConfig, QzoneAutomationResult, QzoneListItem } from '../electron-api.d';
import type { BadgeVariants } from '@/components/ui/badge';
import { Loader2Icon, SendIcon } from '@lucide/vue';
import { computed, nextTick, onMounted, ref, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { createDefaultLifeToolsData, normalizeLifeToolsData } from '../features/life-tools/data';

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
  editorExtensions: {
    vsixDownloadDir: '',
  },
  lifeTools: createDefaultLifeToolsData(),
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

const statusVariant = computed<BadgeVariants['variant']>(() => {
  if (!result.value) {
    return 'outline';
  }
  return result.value.success ? 'default' : 'destructive';
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
    lifeTools: normalizeLifeToolsData(toRaw(current.lifeTools)),
  };
}

async function saveConfig() {
  await window.electronAPI.setConfig(plainConfig());
}

function handleLoginModeUpdate(value: unknown) {
  if (value === 'qr' || value === 'credentials') {
    config.value.qzone.loginMode = value;
    void saveConfig();
  }
}

function openFeedImage(image: string) {
  void window.electronAPI.openExternal(image);
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
    <div class="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('qzonePage.title') }}</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Alert>
            <AlertDescription>
              {{ t('qzonePage.passwordWarning') }}
            </AlertDescription>
          </Alert>

          <FieldGroup>
            <Field>
              <FieldLabel>{{ t('qzonePage.loginModeLabel') }}</FieldLabel>
              <ToggleGroup
                type="single"
                :model-value="config.qzone.loginMode"
                @update:model-value="handleLoginModeUpdate"
              >
                <ToggleGroupItem value="qr">
                  {{ t('qzonePage.loginModeQr') }}
                </ToggleGroupItem>
                <ToggleGroupItem value="credentials">
                  {{ t('qzonePage.loginModeCredentials') }}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel for="qzone-qq-number">
                  {{ t('qzonePage.qqNumberLabel') }}
                </FieldLabel>
                <Input
                  id="qzone-qq-number"
                  v-model="config.qzone.qqNumber"
                  :placeholder="t('qzonePage.qqNumberPlaceholder')"
                  @blur="saveConfig"
                />
              </Field>

              <Field>
                <FieldLabel for="qzone-qq-password">
                  {{ t('qzonePage.qqPasswordLabel') }}
                </FieldLabel>
                <Input
                  id="qzone-qq-password"
                  v-model="config.qzone.qqPassword"
                  type="password"
                  :placeholder="t('qzonePage.qqPasswordPlaceholder')"
                  @blur="saveConfig"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel for="qzone-profile-dir">
                {{ t('qzonePage.profileDirLabel') }}
              </FieldLabel>
              <Input
                id="qzone-profile-dir"
                v-model="config.qzone.playwrightProfileDir"
                :placeholder="t('qzonePage.profileDirPlaceholder')"
                @blur="saveConfig"
              />
            </Field>

            <Field>
              <FieldLabel for="qzone-content">
                {{ t('qzonePage.contentLabel') }}
              </FieldLabel>
              <Textarea
                id="qzone-content"
                v-model="content"
                :rows="7"
                :placeholder="t('qzonePage.contentPlaceholder')"
              />
            </Field>
          </FieldGroup>

          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="flex flex-wrap items-center gap-2">
              <Button
                :disabled="!content.trim() || running || testingLogin || loadingList || loadingMore"
                @click="publish"
              >
                <Loader2Icon v-if="running" data-icon="inline-start" class="animate-spin" />
                <SendIcon v-else data-icon="inline-start" />
                {{ running ? t('qzonePage.publishing') : t('qzonePage.publish') }}
              </Button>
              <Button
                variant="secondary"
                :disabled="running || testingLogin || loadingList || loadingMore"
                @click="runTestLogin"
              >
                <Loader2Icon v-if="testingLogin" data-icon="inline-start" class="animate-spin" />
                {{ testingLogin ? t('qzonePage.testingLogin') : t('qzonePage.testLogin') }}
              </Button>
              <Button
                variant="secondary"
                :disabled="running || testingLogin || loadingList || loadingMore"
                @click="loadList"
              >
                <Loader2Icon v-if="loadingList" data-icon="inline-start" class="animate-spin" />
                {{ loadingList ? t('qzonePage.loadingList') : t('qzonePage.loadList') }}
              </Button>
            </div>

            <Badge :variant="statusVariant">
              {{ result ? result.message : t('qzonePage.statusIdle') }}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('qzonePage.listTitle') }}</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
          <div v-if="listItems.length > 0" class="overflow-hidden rounded-md border">
            <article v-for="item in listItems" :key="item.id" class="border-b p-4 last:border-b-0">
              <div class="mb-3 text-xs text-muted-foreground">
                {{ item.source }}
              </div>
              <div class="leading-6 text-foreground">
                <div
                  v-for="line in qzoneTextLines(item.text)"
                  :key="line"
                  class="break-all"
                >
                  {{ line }}
                </div>
              </div>
              <div v-if="item.images.length > 0" class="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  v-for="image in item.images"
                  :key="image"
                  type="button"
                  class="qzone-feed-image"
                  @click="openFeedImage(image)"
                >
                  <img :src="image" alt="" loading="lazy">
                </button>
              </div>
            </article>
          </div>
          <div v-else class="text-muted-foreground">
            {{ t('qzonePage.listEmpty') }}
          </div>
          <div v-if="listItems.length > 0" class="flex justify-center">
            <Button
              variant="secondary"
              :disabled="loadingMore || loadingList || running || testingLogin || !hasMoreList"
              @click="loadMoreList"
            >
              <Loader2Icon v-if="loadingMore" data-icon="inline-start" class="animate-spin" />
              {{ loadingMore ? t('qzonePage.loadingMore') : (hasMoreList ? t('qzonePage.loadMore') : t('qzonePage.noMore')) }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('qzonePage.logsTitle') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref="logContainer"
            class="h-[320px] overflow-y-auto rounded-md border bg-background p-3 font-mono text-[12.5px] leading-relaxed"
          >
            <div
              v-for="step in result?.steps || []"
              :key="step"
              class="whitespace-pre-wrap break-all text-foreground"
            >
              {{ step }}
            </div>
            <div v-if="!result || result.steps.length === 0" class="mt-5 text-center text-muted-foreground italic">
              {{ t('qzonePage.logsEmpty') }}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
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
  border: 0;
  padding: 0;
  background: transparent;
}

.qzone-feed-image img {
  height: 128px;
  width: 100%;
  object-fit: cover;
  display: block;
}
</style>
