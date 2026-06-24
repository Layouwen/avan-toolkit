<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

defineProps<{
  lastOutput: string;
}>();

const { t } = useI18n();
</script>

<template>
  <Card v-if="lastOutput">
    <CardHeader>
      <CardTitle class="text-base">
        {{ t('editorExtensions.outputTitle') }}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{{ lastOutput }}</pre>
    </CardContent>
  </Card>
</template>
