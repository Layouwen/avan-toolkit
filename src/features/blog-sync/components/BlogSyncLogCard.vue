<script setup lang="ts">
import type { LogLine } from '@/features/blog-sync/types';
import { nextTick, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const props = defineProps<{
  logs: ReadonlyArray<LogLine>;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const { t } = useI18n();
const logContainer = useTemplateRef<HTMLElement>('logContainer');

watch(
  () => props.logs.length,
  async () => {
    await nextTick();
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  },
);

function logLineClass(level: LogLine['level']) {
  return {
    info: 'text-muted-foreground',
    success: 'text-foreground',
    warn: 'text-foreground',
    error: 'text-destructive',
  }[level];
}
</script>

<template>
  <Card class="min-h-0 flex-1">
    <CardHeader class="flex flex-row items-center justify-between">
      <CardTitle class="text-base">
        {{ t('blogSync.logs.title') }}
      </CardTitle>
      <Button variant="ghost" size="sm" @click="emit('clear')">
        {{ t('blogSync.logs.clear') }}
      </Button>
    </CardHeader>
    <CardContent>
      <div
        ref="logContainer"
        class="h-[360px] overflow-y-auto rounded-md border bg-background p-3 font-mono text-[12.5px] leading-relaxed"
      >
        <div
          v-for="line in logs"
          :key="line.id"
          class="whitespace-pre-wrap break-all"
          :class="logLineClass(line.level)"
        >
          {{ line.text }}
        </div>

        <div v-if="logs.length === 0" class="mt-5 text-center text-muted-foreground italic">
          {{ t('blogSync.logs.empty') }}
        </div>
      </div>
    </CardContent>
  </Card>
</template>
