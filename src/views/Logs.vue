<script setup lang="ts">
import type { AppLogEntry, LogFilters, LogLevel, LogModule } from '../electron-api.d';
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NSelect,
  NSpace,
  NTag,
} from 'naive-ui';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

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

function levelTagType(level: LogLevel) {
  if (level === 'success') {
    return 'success';
  }
  if (level === 'warn') {
    return 'warning';
  }
  if (level === 'error') {
    return 'error';
  }
  return 'info';
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
        <h1 class="text-xl font-semibold text-[#e5e7eb]">
          {{ t('logsPage.title') }}
        </h1>
        <NSpace>
          <NButton secondary @click="loadLogs">
            {{ t('logsPage.refresh') }}
          </NButton>
          <NButton secondary @click="openLogFile">
            {{ t('logsPage.openFile') }}
          </NButton>
          <NButton type="error" secondary @click="clearCurrentLogs">
            {{ t('logsPage.clear') }}
          </NButton>
        </NSpace>
      </div>

      <NCard :title="t('logsPage.filters')" embedded>
        <NForm label-placement="top">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <NFormItem :label="t('logsPage.module')" class="mb-0!">
              <NSelect
                :value="moduleFilter || 'all'"
                :options="moduleOptions"
                @update:value="handleModuleUpdate"
              />
            </NFormItem>
            <NFormItem :label="t('logsPage.level')" class="mb-0!">
              <NSelect
                :value="levelFilter || 'all'"
                :options="levelOptions"
                @update:value="handleLevelUpdate"
              />
            </NFormItem>
            <NFormItem :label="t('logsPage.sensitive')" class="mb-0!">
              <NSelect
                :value="sensitiveFilter"
                :options="sensitiveOptions"
                @update:value="handleSensitiveUpdate"
              />
            </NFormItem>
          </div>
        </NForm>
      </NCard>

      <div v-if="filteredRunGroups.length === 0" class="rounded-md border border-[#2e3440] bg-[#141414] p-8 text-center text-[#94a3b8]">
        {{ t('logsPage.empty') }}
      </div>

      <NCollapse v-else accordion>
        <NCollapseItem
          v-for="group in filteredRunGroups"
          :key="group.runId"
          :name="group.runId"
        >
          <template #header>
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <NTag v-if="group.module" type="info" size="small">
                {{ moduleLabel(group.module) }}
              </NTag>
              <span class="text-[#e5e7eb]">{{ group.scope }}</span>
              <span class="text-xs text-[#94a3b8]">{{ group.runId }}</span>
              <span v-if="group.latest" class="text-xs text-[#94a3b8]">{{ formatTime(group.latest) }}</span>
            </div>
          </template>

          <div class="overflow-hidden rounded-md border border-[#2e3440] bg-[#141414]">
            <div
              v-for="entry in group.entries"
              :key="entry.id"
              class="grid grid-cols-1 gap-2 border-b border-[#242b36] p-3 last:border-b-0 md:grid-cols-[110px_86px_minmax(0,1fr)]"
            >
              <div class="text-xs text-[#94a3b8]">
                {{ formatTime(entry.timestamp) }}
              </div>
              <div class="flex items-start gap-1">
                <NTag :type="levelTagType(entry.level)" size="small">
                  {{ levelLabel(entry.level) }}
                </NTag>
                <NTag v-if="entry.sensitive" type="warning" size="small">
                  {{ t('logsPage.sensitiveTag') }}
                </NTag>
              </div>
              <pre class="m-0 whitespace-pre-wrap break-all font-mono text-[12.5px] leading-relaxed text-[#c9d1d9]">{{ entry.message }}</pre>
            </div>
          </div>
        </NCollapseItem>
      </NCollapse>
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
