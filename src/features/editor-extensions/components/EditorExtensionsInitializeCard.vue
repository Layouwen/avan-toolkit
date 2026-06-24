<script setup lang="ts">
import type { EditorExtensionInitializeSource } from '../../../electron-api.d';
import { Loader2Icon, UploadIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InitializeOption {
  label: string;
  value: EditorExtensionInitializeSource;
}

defineProps<{
  initializeOptions: InitializeOption[];
  initializingSource: EditorExtensionInitializeSource | '';
}>();

const emit = defineEmits<{
  initialize: [source: EditorExtensionInitializeSource];
}>();

const { t } = useI18n();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        {{ t('editorExtensions.initializeTitle') }}
      </CardTitle>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <p class="m-0 text-sm leading-6 text-muted-foreground">
        {{ t('editorExtensions.initializeDescription') }}
      </p>
      <div class="grid grid-cols-1 gap-2">
        <Button
          v-for="option in initializeOptions"
          :key="option.value"
          variant="secondary"
          :disabled="Boolean(initializingSource)"
          @click="emit('initialize', option.value)"
        >
          <Loader2Icon v-if="initializingSource === option.value" data-icon="inline-start" class="animate-spin" />
          <UploadIcon v-else data-icon="inline-start" />
          {{ option.label }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
