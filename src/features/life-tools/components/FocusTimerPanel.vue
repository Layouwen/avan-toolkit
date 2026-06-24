<script setup lang="ts">
import type { FocusPreset, FocusSession, FocusSessionStatus } from '../types';
import { CheckCircle2Icon, Clock3Icon, HistoryIcon, PlayIcon, SquareIcon, TimerResetIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const props = defineProps<{
  presets: FocusPreset[];
  selectedPresetId: string | null;
  activeSession: FocusSession | null;
  status: FocusSessionStatus;
  remainingSeconds: number;
  progressPercent: number;
  history: FocusSession[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  (event: 'selectPreset', presetId: string): void;
  (event: 'start'): void;
  (event: 'complete'): void;
  (event: 'cancel'): void;
}>();

const { t } = useI18n();

const selectedPreset = computed(() =>
  props.presets.find(preset => preset.id === props.selectedPresetId) ?? props.presets[0] ?? null,
);

const hasActiveSession = computed(() => Boolean(props.activeSession));
const remainingLabel = computed(() => formatSeconds(props.remainingSeconds));
const statusLabel = computed(() => t(`lifeToolsPage.focus.status.${props.status}`));
const canStart = computed(() => Boolean(selectedPreset.value) && !hasActiveSession.value && !props.saving);
const historyRows = computed(() =>
  props.history.slice(0, 5).map(session => ({
    id: session.id,
    title: session.presetTitle,
    phaseLabel: t(`lifeToolsPage.focus.phases.${session.phase}`),
    completedAt: session.completedAt ? formatDateTime(session.completedAt) : t('lifeToolsPage.focus.notCompleted'),
    durationLabel: t('lifeToolsPage.focus.minutes', { count: session.focusMinutes }),
  })),
);

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}
</script>

<template>
  <Card class="rounded-lg py-5">
    <CardHeader class="gap-3 px-5">
      <div class="flex min-w-0 items-center justify-between gap-3">
        <div class="min-w-0">
          <CardTitle class="flex items-center gap-2 text-base">
            <Clock3Icon class="size-4 text-primary" />
            <span class="truncate">{{ t('lifeToolsPage.focus.title') }}</span>
          </CardTitle>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">
            {{ t('lifeToolsPage.focus.description') }}
          </p>
        </div>
        <Badge variant="secondary" class="shrink-0">
          {{ statusLabel }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="flex flex-col gap-5 px-5">
      <section class="flex flex-col gap-2">
        <div class="text-sm font-medium text-card-foreground">
          {{ t('lifeToolsPage.focus.presetsTitle') }}
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            v-for="preset in presets"
            :key="preset.id"
            type="button"
            :variant="preset.id === selectedPresetId ? 'secondary' : 'outline'"
            class="h-auto min-h-12 justify-start whitespace-normal text-left"
            :disabled="hasActiveSession"
            @click="emit('selectPreset', preset.id)"
          >
            <TimerResetIcon data-icon="inline-start" />
            <span class="min-w-0">
              <span class="block truncate">{{ preset.title }}</span>
              <span class="block text-xs text-muted-foreground">
                {{ t('lifeToolsPage.focus.presetMinutes', {
                  focus: preset.focusMinutes,
                  short: preset.shortBreakMinutes ?? 0,
                  long: preset.longBreakMinutes ?? 0,
                }) }}
              </span>
            </span>
          </Button>
        </div>
      </section>

      <section class="rounded-lg border bg-background/50 p-4">
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div class="min-w-0">
              <div class="text-sm text-muted-foreground">
                {{ activeSession ? activeSession.presetTitle : selectedPreset?.title ?? t('lifeToolsPage.focus.noPreset') }}
              </div>
              <div class="mt-1 font-mono text-5xl font-semibold tracking-normal text-foreground">
                {{ remainingLabel }}
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button :disabled="!canStart" @click="emit('start')">
                <PlayIcon data-icon="inline-start" />
                {{ t('lifeToolsPage.focus.startFocus') }}
              </Button>
              <Button v-if="activeSession" variant="secondary" :disabled="saving" @click="emit('complete')">
                <CheckCircle2Icon data-icon="inline-start" />
                {{ t('lifeToolsPage.focus.completeSession') }}
              </Button>
              <Button v-if="activeSession" variant="outline" :disabled="saving" @click="emit('cancel')">
                <SquareIcon data-icon="inline-start" />
                {{ t('lifeToolsPage.focus.cancelSession') }}
              </Button>
            </div>
          </div>

          <Progress :model-value="progressPercent" />
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <div class="flex items-center gap-2 text-sm font-medium text-card-foreground">
          <HistoryIcon class="size-4 text-muted-foreground" />
          {{ t('lifeToolsPage.focus.historyTitle') }}
        </div>
        <div v-if="historyRows.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {{ t('lifeToolsPage.focus.historyEmpty') }}
        </div>
        <div v-else class="divide-y overflow-hidden rounded-lg border">
          <div v-for="session in historyRows" :key="session.id" class="grid grid-cols-1 gap-1 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
            <div class="min-w-0">
              <div class="truncate text-card-foreground">
                {{ session.title }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ session.phaseLabel }} · {{ session.durationLabel }}
              </div>
            </div>
            <div class="text-xs text-muted-foreground sm:text-right">
              {{ session.completedAt }}
            </div>
          </div>
        </div>
      </section>
    </CardContent>
  </Card>
</template>
