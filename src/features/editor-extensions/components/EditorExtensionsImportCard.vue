<script setup lang="ts">
import type { EditorExtensionScope } from '../../../electron-api.d';
import { ClipboardIcon, UploadIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ScopeOption {
  label: string;
  value: EditorExtensionScope;
}

defineProps<{
  importScope: EditorExtensionScope;
  importMarkdown: string;
  scopeOptions: ScopeOption[];
  markdownPlaceholder: string;
}>();

const emit = defineEmits<{
  'update:importScope': [value: unknown];
  'update:importMarkdown': [value: string];
  'readClipboard': [];
  'importMarkdown': [];
}>();

const { t } = useI18n();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        {{ t('editorExtensions.importTitle') }}
      </CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <Select :model-value="importScope" @update:model-value="emit('update:importScope', $event)">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem v-for="option in scopeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Textarea
        :model-value="importMarkdown"
        :rows="7"
        :placeholder="markdownPlaceholder"
        @update:model-value="emit('update:importMarkdown', String($event ?? ''))"
      />
      <div class="flex justify-end gap-2">
        <Button variant="secondary" @click="emit('readClipboard')">
          <ClipboardIcon data-icon="inline-start" />
          {{ t('editorExtensions.readClipboard') }}
        </Button>
        <Button @click="emit('importMarkdown')">
          <UploadIcon data-icon="inline-start" />
          {{ t('editorExtensions.import') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
