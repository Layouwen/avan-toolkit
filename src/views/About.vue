<script setup lang="ts">
import type { AppUpdateInfo } from '../electron-api';
import type { BadgeVariants } from '@/components/ui/badge';
import { Loader2Icon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import packageJson from '../../package.json';

const { t, locale } = useI18n();
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

const updateBadgeVariant = computed<BadgeVariants['variant']>(() => {
  switch (updateStatus.value) {
    case 'available':
      return 'default';
    case 'error':
      return 'destructive';
    case 'checking':
      return 'secondary';
    default:
      return 'outline';
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
    toast.success(`${link.label ?? ''}${link.label ? ' ' : ''}已复制`);
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
    toast.error(error instanceof Error ? error.message : String(error));
  }
}
</script>

<template>
  <main class="min-h-full p-6">
    <Card>
      <CardHeader>
        <CardTitle>{{ t('about.title') }}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" @click="toggleLocale">
            {{ t('about.language') }}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div class="flex max-w-xl flex-col gap-3">
          <Card>
            <CardContent class="flex flex-col gap-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span class="text-sm text-muted-foreground">
                    {{ t('about.update.currentVersion') }}
                  </span>
                  <div class="mt-1 flex flex-wrap items-center gap-2">
                    <strong>
                      v{{ currentVersion }}
                    </strong>
                    <Badge :variant="updateBadgeVariant">
                      {{ t(`about.update.status.${updateStatus}`) }}
                    </Badge>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" :disabled="checkingUpdate" @click="checkUpdates">
                    <Loader2Icon v-if="checkingUpdate" data-icon="inline-start" class="animate-spin" />
                    {{ t('about.update.check') }}
                  </Button>
                  <Button
                    v-if="updateInfo?.hasUpdate"
                    size="sm"
                    @click="openUpdateTarget"
                  >
                    {{ updateInfo.downloadUrl ? t('about.update.download') : t('about.update.openRelease') }}
                  </Button>
                </div>
              </div>

              <Alert
                v-if="updateStatus !== 'idle'"
                :variant="updateStatus === 'error' ? 'destructive' : 'default'"
              >
                <AlertDescription>
                  <div class="flex flex-col gap-2">
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
                      <span class="block text-xs text-muted-foreground">
                        {{ updateInfo.downloadAssetName ? t('about.update.asset', { name: updateInfo.downloadAssetName }) : t('about.update.noAsset') }}
                      </span>
                      <span v-if="releaseNotesPreview" class="block whitespace-pre-line text-xs text-muted-foreground">
                        {{ releaseNotesPreview }}
                      </span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card
            v-for="link in links"
            :key="link.url"
            class="cursor-pointer transition-colors hover:bg-accent/40"
            @click="handleLinkClick(link)"
          >
            <CardContent>
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm text-muted-foreground">
                  {{ link.label }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ link.display }}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  </main>
</template>
