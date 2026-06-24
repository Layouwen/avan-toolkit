<script setup lang="ts">
import type { EditorKind } from '../../../electron-api.d';
import { DownloadIcon, Loader2Icon, PlusIcon, RefreshCwIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';

interface ExportOption {
  label: string;
  value: EditorKind | 'common';
}

defineProps<{
  loading: boolean;
  exportOptions: ExportOption[];
}>();

const emit = defineEmits<{
  openCreate: [];
  refresh: [];
  exportMarkdown: [target: EditorKind | 'common'];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <h1 class="text-xl font-semibold text-foreground">
        {{ t('editorExtensions.title') }}
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t('editorExtensions.subtitle') }}
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button @click="emit('openCreate')">
        <PlusIcon data-icon="inline-start" />
        {{ t('editorExtensions.addTitle') }}
      </Button>
      <Button variant="secondary" :disabled="loading" @click="emit('refresh')">
        <Loader2Icon v-if="loading" data-icon="inline-start" class="animate-spin" />
        <RefreshCwIcon v-else data-icon="inline-start" />
        {{ t('editorExtensions.refreshStatus') }}
      </Button>
      <Button
        v-for="option in exportOptions"
        :key="option.value"
        variant="secondary"
        @click="emit('exportMarkdown', option.value)"
      >
        <DownloadIcon data-icon="inline-start" />
        {{ option.label }}
      </Button>
    </div>
  </div>
</template>
