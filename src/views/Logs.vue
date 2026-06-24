<script setup lang="ts">
import type { AppLogEntry, LogFilters, LogLevel, LogModule } from '../electron-api.d';
import type { BadgeVariants } from '@/components/ui/badge';
import { FolderOpenIcon, RefreshCwIcon, Trash2Icon } from '@lucide/vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const { t } = useI18n();

const logs = ref<AppLogEntry[]>([]);
const moduleFilter = ref<LogModule | null>(null);
const levelFilter = ref<LogLevel | null>(null);
const sensitiveFilter = ref<'all' | 'sensitive' | 'nonSensitive'>('all');

const moduleOptions = computed(() => [
  { label: t('logsPage.all'), value: 'all' },
  { label: t('logsPage.modules.blogSync'), value: 'blogSync' },
  { label: t('logsPage.modules.qzone'), value: 'qzone' },
  { label: t('logsPage.modules.agent'), value: 'agent' },
]);

const levelOptions = computed(() => [
  { label: t('logsPage.all'), value: 'all' },
  { label: t('logsPage.levels.info'), value: 'info' },
  { label: t('logsPage.levels.success'), value: 'success' },
  { label: t('logsPage.levels.warn'), value: 'warn' },
  { label: t('logsPage.levels.error'), value: 'error' },
]);

const sensitiveOptions = computed(() => [
  { label: t('logsPage.all'), value: 'all' },
  { label: t('logsPage.sensitiveOnly'), value: 'sensitive' },
  { label: t('logsPage.nonSensitiveOnly'), value: 'nonSensitive' },
]);

const filteredRunGroups = computed(() => {
  const groups = new Map<string, AppLogEntry[]>();
  for (const log of logs.value) {
    const existing = groups.get(log.runId);
    if (existing) {
      existing.push(log);
    }
    else {
      groups.set(log.runId, [log]);
    }
  }

  return [...groups.entries()].map(([runId, entries]) => ({
    runId,
    module: entries[0]?.module,
    scope: entries[0]?.scope,
    latest: entries[0]?.timestamp,
    entries,
  }));
});

function createFilters(): LogFilters {
  const filters: LogFilters = { limit: 500 };
  if (moduleFilter.value) {
    filters.module = moduleFilter.value;
  }
  if (levelFilter.value) {
    filters.level = levelFilter.value;
  }
  if (sensitiveFilter.value !== 'all') {
    filters.sensitive = sensitiveFilter.value === 'sensitive';
  }
  return filters;
}

function matchesFilters(entry: AppLogEntry): boolean {
  if (moduleFilter.value && entry.module !== moduleFilter.value) {
    return false;
  }
  if (levelFilter.value && entry.level !== levelFilter.value) {
    return false;
  }
  if (sensitiveFilter.value === 'sensitive' && !entry.sensitive) {
    return false;
  }
  if (sensitiveFilter.value === 'nonSensitive' && entry.sensitive) {
    return false;
  }
  return true;
}

async function loadLogs() {
  logs.value = await window.electronAPI.listLogs(createFilters());
}

async function clearCurrentLogs() {
  await window.electronAPI.clearLogs(createFilters());
  await loadLogs();
}

async function openLogFile() {
  await window.electronAPI.openLogFile();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function moduleLabel(module: LogModule) {
  return t(`logsPage.modules.${module}`);
}

function levelLabel(level: LogLevel) {
  return t(`logsPage.levels.${level}`);
}

function levelBadgeVariant(level: LogLevel): BadgeVariants['variant'] {
  if (level === 'success') {
    return 'default';
  }
  if (level === 'warn') {
    return 'secondary';
  }
  if (level === 'error') {
    return 'destructive';
  }
  return 'outline';
}

function handleModuleUpdate(value: string) {
  moduleFilter.value = value === 'all' ? null : value as LogModule;
  void loadLogs();
}

function handleLevelUpdate(value: string) {
  levelFilter.value = value === 'all' ? null : value as LogLevel;
  void loadLogs();
}

function handleSensitiveUpdate(value: 'all' | 'sensitive' | 'nonSensitive') {
  sensitiveFilter.value = value;
  void loadLogs();
}

onMounted(async () => {
  await loadLogs();
  window.electronAPI.onLogEvent((entry) => {
    if (!matchesFilters(entry)) {
      return;
    }
    logs.value = [entry, ...logs.value].slice(0, 500);
  });
});

onUnmounted(() => {
  window.electronAPI.offLogEvent();
});
</script>

<template>
  <main class="logs-page min-h-full p-6">
    <div class="mx-auto flex max-w-6xl flex-col gap-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 class="text-xl font-semibold text-foreground">
          {{ t('logsPage.title') }}
        </h1>
        <div class="flex flex-wrap gap-2">
          <Button variant="secondary" @click="loadLogs">
            <RefreshCwIcon data-icon="inline-start" />
            {{ t('logsPage.refresh') }}
          </Button>
          <Button variant="secondary" @click="openLogFile">
            <FolderOpenIcon data-icon="inline-start" />
            {{ t('logsPage.openFile') }}
          </Button>
          <Button variant="destructive" @click="clearCurrentLogs">
            <Trash2Icon data-icon="inline-start" />
            {{ t('logsPage.clear') }}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">
            {{ t('logsPage.filters') }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field>
                <FieldLabel>{{ t('logsPage.module') }}</FieldLabel>
                <Select :model-value="moduleFilter || 'all'" @update:model-value="value => handleModuleUpdate(String(value))">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem v-for="option in moduleOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{{ t('logsPage.level') }}</FieldLabel>
                <Select :model-value="levelFilter || 'all'" @update:model-value="value => handleLevelUpdate(String(value))">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem v-for="option in levelOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{{ t('logsPage.sensitive') }}</FieldLabel>
                <Select :model-value="sensitiveFilter" @update:model-value="value => handleSensitiveUpdate(value as 'all' | 'sensitive' | 'nonSensitive')">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem v-for="option in sensitiveOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <div v-if="filteredRunGroups.length === 0" class="rounded-md border bg-card p-8 text-center text-muted-foreground">
        {{ t('logsPage.empty') }}
      </div>

      <Accordion v-else type="single" collapsible class="flex flex-col gap-2">
        <AccordionItem
          v-for="group in filteredRunGroups"
          :key="group.runId"
          :value="group.runId"
          class="rounded-md border bg-card px-4"
        >
          <AccordionTrigger>
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <Badge v-if="group.module" variant="secondary">
                {{ moduleLabel(group.module) }}
              </Badge>
              <span class="text-foreground">{{ group.scope }}</span>
              <span class="text-xs text-muted-foreground">{{ group.runId }}</span>
              <span v-if="group.latest" class="text-xs text-muted-foreground">{{ formatTime(group.latest) }}</span>
            </div>
          </AccordionTrigger>

          <AccordionContent>
            <div class="overflow-hidden rounded-md border bg-background">
              <div
                v-for="entry in group.entries"
                :key="entry.id"
                class="grid grid-cols-1 gap-2 border-b p-3 last:border-b-0 md:grid-cols-[110px_120px_minmax(0,1fr)]"
              >
                <div class="text-xs text-muted-foreground">
                  {{ formatTime(entry.timestamp) }}
                </div>
                <div class="flex flex-wrap items-start gap-1">
                  <Badge :variant="levelBadgeVariant(entry.level)">
                    {{ levelLabel(entry.level) }}
                  </Badge>
                  <Badge v-if="entry.sensitive" variant="secondary">
                    {{ t('logsPage.sensitiveTag') }}
                  </Badge>
                </div>
                <pre class="m-0 whitespace-pre-wrap break-all font-mono text-[12.5px] leading-relaxed text-foreground">{{ entry.message }}</pre>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </main>
</template>

<style scoped>
.logs-page {
  background:
    radial-gradient(1100px 520px at 82% -20%, rgba(20, 184, 166, 0.16), transparent 60%),
    radial-gradient(860px 460px at -10% 115%, rgba(99, 102, 241, 0.16), transparent 60%),
    linear-gradient(180deg, #121720 0%, #0f141d 100%);
}
</style>
