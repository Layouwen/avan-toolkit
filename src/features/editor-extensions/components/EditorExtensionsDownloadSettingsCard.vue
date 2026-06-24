<script setup lang="ts">
import { FolderOpenIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

defineProps<{
  vsixDownloadDir: string;
}>();

const emit = defineEmits<{
  selectDir: [];
}>();

const { t } = useI18n();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        {{ t('editorExtensions.downloadSettingsTitle') }}
      </CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <p class="m-0 text-sm leading-6 text-muted-foreground">
        {{ t('editorExtensions.downloadSettingsDescription') }}
      </p>
      <Input
        :value="vsixDownloadDir || t('editorExtensions.systemDownloads')"
        readonly
        :placeholder="t('editorExtensions.vsixDownloadDirPlaceholder')"
      />
      <div class="flex justify-end">
        <Button variant="secondary" @click="emit('selectDir')">
          <FolderOpenIcon data-icon="inline-start" />
          {{ t('editorExtensions.selectVsixDownloadDir') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
