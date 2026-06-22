<script setup lang="ts">
import type {
  AppConfig,
  EditorExtensionInitializeSource,
  EditorExtensionRecord,
  EditorExtensionScope,
  EditorExtensionWithStatus,
  EditorKind,
} from '../electron-api.d';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  useMessage,
} from 'naive-ui';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const message = useMessage();

const records = ref<EditorExtensionWithStatus[]>([]);
const loading = ref(false);
const actionKey = ref('');
const initializingSource = ref<EditorExtensionInitializeSource | ''>('');
const showFormModal = ref(false);
const filterScope = ref<EditorExtensionScope | 'all'>('all');
const keyword = ref('');
const sortField = ref<'extensionId' | 'name' | 'scope' | 'vscodeStatus' | 'cursorStatus'>('name');
const sortDirection = ref<'asc' | 'desc'>('asc');
const importMarkdown = ref('');
const importScope = ref<EditorExtensionScope>('common');
const vsixDownloadDir = ref('');
const lastOutput = ref('');
const markdownPlaceholder = [
  '|序号|插件 id|插件名|插件备注|',
  '|----|----|----|----|',
  '|1|publisher.extension|插件名|备注|',
].join('\n');

const form = reactive<Partial<EditorExtensionRecord>>({
  id: '',
  extensionId: '',
  name: '',
  vscodeName: '',
  cursorName: '',
  note: '',
  scope: 'common',
});

const scopeOptions = computed(() => [
  { label: t('editorExtensions.scopes.common'), value: 'common' },
  { label: t('editorExtensions.scopes.vscode'), value: 'vscode' },
  { label: t('editorExtensions.scopes.cursor'), value: 'cursor' },
]);

const filterScopeOptions = computed(() => [
  { label: t('editorExtensions.scopes.all'), value: 'all' },
  ...scopeOptions.value,
]);

const sortFieldOptions = computed(() => [
  { label: t('editorExtensions.sortFields.extensionId'), value: 'extensionId' },
  { label: t('editorExtensions.sortFields.name'), value: 'name' },
  { label: t('editorExtensions.sortFields.scope'), value: 'scope' },
  { label: t('editorExtensions.sortFields.vscodeStatus'), value: 'vscodeStatus' },
  { label: t('editorExtensions.sortFields.cursorStatus'), value: 'cursorStatus' },
]);

const sortDirectionOptions = computed(() => [
  { label: t('editorExtensions.sortDirections.desc'), value: 'desc' },
  { label: t('editorExtensions.sortDirections.asc'), value: 'asc' },
]);

const exportOptions = computed(() => [
  { label: t('editorExtensions.exportCommon'), value: 'common' },
  { label: t('editorExtensions.exportVscode'), value: 'vscode' },
  { label: t('editorExtensions.exportCursor'), value: 'cursor' },
]);

const initializeOptions = computed(() => [
  { label: t('editorExtensions.initializeVscode'), value: 'vscode' },
  { label: t('editorExtensions.initializeCursor'), value: 'cursor' },
  { label: t('editorExtensions.initializeBoth'), value: 'both' },
]);

const stats = computed(() => ({
  total: records.value.length,
  common: records.value.filter(record => record.scope === 'common').length,
  vscode: records.value.filter(record => record.scope === 'vscode').length,
  cursor: records.value.filter(record => record.scope === 'cursor').length,
}));

const filteredRecords = computed(() => {
  const keywordText = keyword.value.trim().toLowerCase();
  const filtered = records.value.filter((record) => {
    if (filterScope.value !== 'all' && record.scope !== filterScope.value) {
      return false;
    }
    if (!keywordText) {
      return true;
    }
    return [
      record.extensionId,
      record.name,
      record.vscodeName,
      record.cursorName,
      record.note,
    ].some(value => value.toLowerCase().includes(keywordText));
  });

  return [...filtered].sort((a, b) => {
    const primary = compareRecords(a, b, sortField.value);
    const fallback = compareText(a.name, b.name) || compareText(a.extensionId, b.extensionId);
    const result = primary || fallback;
    return sortDirection.value === 'desc' ? -result : result;
  });
});

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

function statusRank(value: boolean | null) {
  if (value === true) {
    return 2;
  }
  if (value === false) {
    return 1;
  }
  return 0;
}

function compareRecords(
  a: EditorExtensionWithStatus,
  b: EditorExtensionWithStatus,
  field: typeof sortField.value,
) {
  if (field === 'name') {
    return compareText(a.name, b.name);
  }
  if (field === 'scope') {
    return compareText(a.scope, b.scope);
  }
  if (field === 'vscodeStatus') {
    return statusRank(a.status.vscode) - statusRank(b.status.vscode);
  }
  if (field === 'cursorStatus') {
    return statusRank(a.status.cursor) - statusRank(b.status.cursor);
  }
  return compareText(a.extensionId, b.extensionId);
}

function resetForm() {
  form.id = '';
  form.extensionId = '';
  form.name = '';
  form.vscodeName = '';
  form.cursorName = '';
  form.note = '';
  form.scope = 'common';
}

function openCreateModal() {
  resetForm();
  showFormModal.value = true;
}

function editRecord(record: EditorExtensionRecord) {
  form.id = record.id;
  form.extensionId = record.extensionId;
  form.name = record.name;
  form.vscodeName = record.vscodeName;
  form.cursorName = record.cursorName;
  form.note = record.note;
  form.scope = record.scope;
  showFormModal.value = true;
}

async function loadRecords(withStatus = true) {
  loading.value = true;
  try {
    records.value = withStatus
      ? await window.electronAPI.listEditorExtensionsWithStatus()
      : (await window.electronAPI.listEditorExtensions()).map(record => ({
          ...record,
          status: { vscode: null, cursor: null },
          localVsix: { exists: false, filePath: '', bytes: 0 },
        }));
  }
  finally {
    loading.value = false;
  }
}

async function loadEditorExtensionConfig() {
  const config = await window.electronAPI.getConfig();
  vsixDownloadDir.value = config.editorExtensions.vsixDownloadDir;
}

function withEditorExtensionConfig(config: AppConfig, nextConfig: AppConfig['editorExtensions']): AppConfig {
  return {
    ...config,
    editorExtensions: {
      ...config.editorExtensions,
      ...nextConfig,
    },
  };
}

async function selectVsixDownloadDir() {
  const dir = await window.electronAPI.selectDirectory();
  if (!dir) {
    return;
  }

  const config = await window.electronAPI.getConfig();
  await window.electronAPI.setConfig(withEditorExtensionConfig(config, {
    vsixDownloadDir: dir,
  }));
  vsixDownloadDir.value = dir;
  message.success(t('editorExtensions.vsixDownloadDirSaved'));
}

async function saveRecord() {
  if (!form.extensionId?.trim()) {
    message.warning(t('editorExtensions.extensionIdRequired'));
    return;
  }

  try {
    await window.electronAPI.saveEditorExtension({
      id: form.id || undefined,
      extensionId: form.extensionId,
      name: form.name,
      vscodeName: form.vscodeName,
      cursorName: form.cursorName,
      note: form.note,
      scope: form.scope,
    });
    resetForm();
    showFormModal.value = false;
    await loadRecords();
    message.success(t('editorExtensions.saved'));
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
}

async function deleteRecord(recordId: string) {
  await window.electronAPI.deleteEditorExtension(recordId);
  await loadRecords();
  message.success(t('editorExtensions.deleted'));
}

async function exportMarkdown(target: EditorKind | 'common') {
  const markdown = await window.electronAPI.exportEditorExtensionsMarkdown(target);
  lastOutput.value = markdown;
  message.success(t('editorExtensions.copied'));
}

async function readClipboard() {
  importMarkdown.value = await window.electronAPI.readClipboardText();
}

async function copyExtensionId(extensionId: string) {
  try {
    await window.electronAPI.copyEditorExtensionId(extensionId);
    message.success(t('editorExtensions.extensionIdCopied'));
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
}

async function importFromMarkdown() {
  if (!importMarkdown.value.trim()) {
    message.warning(t('editorExtensions.importRequired'));
    return;
  }

  try {
    const result = await window.electronAPI.importEditorExtensionsMarkdown(importMarkdown.value, importScope.value);
    await loadRecords();
    message.success(t('editorExtensions.imported', result));
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
}

async function initializeFromInstalled(source: EditorExtensionInitializeSource) {
  initializingSource.value = source;
  try {
    const result = await window.electronAPI.initializeEditorExtensions(source);
    await loadRecords();
    const summary = t('editorExtensions.initialized', result);
    const failed = result.failedEditors.length > 0
      ? t('editorExtensions.initializeFailedEditors', { editors: result.failedEditors.join(', ') })
      : '';
    lastOutput.value = [summary, failed].filter(Boolean).join('\n');
    if (failed) {
      message.warning(lastOutput.value);
    }
    else {
      message.success(summary);
    }
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
  finally {
    initializingSource.value = '';
  }
}

function statusType(value: boolean | null) {
  if (value === true) {
    return 'success';
  }
  if (value === false) {
    return 'warning';
  }
  return 'default';
}

function statusLabel(value: boolean | null) {
  if (value === true) {
    return t('editorExtensions.installed');
  }
  if (value === false) {
    return t('editorExtensions.notInstalled');
  }
  return t('editorExtensions.unknown');
}

async function downloadVsix(editor: EditorKind, extensionId: string) {
  const key = `${editor}:downloadVsix:${extensionId}`;
  actionKey.value = key;
  try {
    const result = await window.electronAPI.downloadEditorExtensionVsix(extensionId);
    lastOutput.value = t('editorExtensions.vsixDownloaded', {
      path: result.filePath,
      bytes: result.bytes,
    });
    message.success(lastOutput.value);
  }
  catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  }
  finally {
    actionKey.value = '';
  }
}

function canInstallDownloadedVsix(record: EditorExtensionWithStatus, editor: EditorKind) {
  return record.localVsix.exists && record.status[editor] === false;
}

async function installDownloadedVsix(editor: EditorKind, extensionId: string) {
  const key = `${editor}:installDownloadedVsix:${extensionId}`;
  actionKey.value = key;
  try {
    const result = await window.electronAPI.installDownloadedEditorExtensionVsix(editor, extensionId);
    lastOutput.value = result.message;
    if (result.success) {
      message.success(t('editorExtensions.installDone'));
      await loadRecords();
    }
    else {
      message.error(result.message || t('editorExtensions.downloadedVsixMissing'));
    }
  }
  finally {
    actionKey.value = '';
  }
}

async function runCommand(editor: EditorKind, action: 'install' | 'uninstall', extensionId: string) {
  const key = `${editor}:${action}:${extensionId}`;
  actionKey.value = key;
  try {
    const result = await window.electronAPI.runEditorExtensionCommand(editor, action, extensionId);
    lastOutput.value = result.message;
    if (result.success) {
      message.success(t(`editorExtensions.${action}Done`));
      await loadRecords();
    }
    else {
      message.error(result.message);
    }
  }
  finally {
    actionKey.value = '';
  }
}

async function runBulk(editor: EditorKind, action: 'install' | 'uninstall', target: EditorKind | 'common') {
  const key = `${editor}:${action}:bulk:${target}`;
  actionKey.value = key;
  try {
    const results = await window.electronAPI.runEditorExtensionBulkCommand(editor, action, target);
    const failed = results.filter(result => !result.success);
    lastOutput.value = results.map(result => result.message).join('\n\n');
    if (failed.length > 0) {
      message.error(t('editorExtensions.bulkFailed', { failed: failed.length, total: results.length }));
    }
    else {
      message.success(t('editorExtensions.bulkDone', { total: results.length }));
    }
    await loadRecords();
  }
  finally {
    actionKey.value = '';
  }
}

onMounted(() => {
  void loadRecords();
  void loadEditorExtensionConfig();
});
</script>

<template>
  <main class="editor-extensions-page min-h-full p-4 lg:p-6">
    <div class="flex w-full max-w-none flex-col gap-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-xl font-semibold text-[#e5e7eb]">
            {{ t('editorExtensions.title') }}
          </h1>
          <p class="mt-1 text-sm text-[#94a3b8]">
            {{ t('editorExtensions.subtitle') }}
          </p>
        </div>
        <NSpace>
          <NButton type="primary" @click="openCreateModal">
            {{ t('editorExtensions.addTitle') }}
          </NButton>
          <NButton secondary :loading="loading" @click="loadRecords()">
            {{ t('editorExtensions.refreshStatus') }}
          </NButton>
          <NButton
            v-for="option in exportOptions"
            :key="option.value"
            secondary
            @click="exportMarkdown(option.value as EditorKind | 'common')"
          >
            {{ option.label }}
          </NButton>
        </NSpace>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div class="flex flex-col gap-4">
          <NCard :title="t('editorExtensions.initializeTitle')" embedded>
            <NSpace vertical>
              <p class="m-0 text-sm leading-6 text-[#94a3b8]">
                {{ t('editorExtensions.initializeDescription') }}
              </p>
              <div class="grid grid-cols-1 gap-2">
                <NButton
                  v-for="option in initializeOptions"
                  :key="option.value"
                  secondary
                  block
                  :loading="initializingSource === option.value"
                  :disabled="Boolean(initializingSource)"
                  @click="initializeFromInstalled(option.value as EditorExtensionInitializeSource)"
                >
                  {{ option.label }}
                </NButton>
              </div>
            </NSpace>
          </NCard>

          <NCard :title="t('editorExtensions.downloadSettingsTitle')" embedded>
            <NSpace vertical>
              <p class="m-0 text-sm leading-6 text-[#94a3b8]">
                {{ t('editorExtensions.downloadSettingsDescription') }}
              </p>
              <NInput
                :value="vsixDownloadDir || t('editorExtensions.systemDownloads')"
                readonly
                :placeholder="t('editorExtensions.vsixDownloadDirPlaceholder')"
              />
              <NSpace justify="end">
                <NButton secondary @click="selectVsixDownloadDir">
                  {{ t('editorExtensions.selectVsixDownloadDir') }}
                </NButton>
              </NSpace>
            </NSpace>
          </NCard>

          <NCard :title="t('editorExtensions.importTitle')" embedded>
            <NSpace vertical>
              <NSelect v-model:value="importScope" :options="scopeOptions" />
              <NInput
                v-model:value="importMarkdown"
                type="textarea"
                :rows="7"
                :placeholder="markdownPlaceholder"
              />
              <NSpace justify="end">
                <NButton secondary @click="readClipboard">
                  {{ t('editorExtensions.readClipboard') }}
                </NButton>
                <NButton type="primary" @click="importFromMarkdown">
                  {{ t('editorExtensions.import') }}
                </NButton>
              </NSpace>
            </NSpace>
          </NCard>

          <NCard :title="t('editorExtensions.bulkTitle')" embedded>
            <div class="grid grid-cols-1 gap-2">
              <NButton
                v-for="target in ['common', 'vscode']"
                :key="`vscode-install-${target}`"
                secondary
                block
                :loading="actionKey === `vscode:install:bulk:${target}`"
                @click="runBulk('vscode', 'install', target as EditorKind | 'common')"
              >
                {{ t('editorExtensions.bulkInstallVscode', { target: t(`editorExtensions.scopes.${target}`) }) }}
              </NButton>
              <NButton
                v-for="target in ['common', 'cursor']"
                :key="`cursor-install-${target}`"
                secondary
                block
                :loading="actionKey === `cursor:install:bulk:${target}`"
                @click="runBulk('cursor', 'install', target as EditorKind | 'common')"
              >
                {{ t('editorExtensions.bulkInstallCursor', { target: t(`editorExtensions.scopes.${target}`) }) }}
              </NButton>
              <NPopconfirm
                v-for="target in ['common', 'vscode']"
                :key="`vscode-uninstall-${target}`"
                @positive-click="runBulk('vscode', 'uninstall', target as EditorKind | 'common')"
              >
                <template #trigger>
                  <NButton
                    secondary
                    type="error"
                    block
                    :loading="actionKey === `vscode:uninstall:bulk:${target}`"
                  >
                    {{ t('editorExtensions.bulkUninstallVscode', { target: t(`editorExtensions.scopes.${target}`) }) }}
                  </NButton>
                </template>
                {{ t('editorExtensions.bulkUninstallConfirm') }}
              </NPopconfirm>
              <NPopconfirm
                v-for="target in ['common', 'cursor']"
                :key="`cursor-uninstall-${target}`"
                @positive-click="runBulk('cursor', 'uninstall', target as EditorKind | 'common')"
              >
                <template #trigger>
                  <NButton
                    secondary
                    type="error"
                    block
                    :loading="actionKey === `cursor:uninstall:bulk:${target}`"
                  >
                    {{ t('editorExtensions.bulkUninstallCursor', { target: t(`editorExtensions.scopes.${target}`) }) }}
                  </NButton>
                </template>
                {{ t('editorExtensions.bulkUninstallConfirm') }}
              </NPopconfirm>
            </div>
          </NCard>
        </div>

        <NCard embedded class="min-w-0">
          <template #header>
            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <span>{{ t('editorExtensions.listTitle') }}</span>
                <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div class="rounded border border-[#2e3440] bg-[#101827] px-3 py-2">
                    <div class="text-[#94a3b8]">
                      {{ t('editorExtensions.stats.total') }}
                    </div>
                    <div class="text-base font-semibold text-[#e5e7eb]">
                      {{ stats.total }}
                    </div>
                  </div>
                  <div class="rounded border border-[#2e3440] bg-[#101827] px-3 py-2">
                    <div class="text-[#94a3b8]">
                      {{ t('editorExtensions.stats.common') }}
                    </div>
                    <div class="text-base font-semibold text-[#e5e7eb]">
                      {{ stats.common }}
                    </div>
                  </div>
                  <div class="rounded border border-[#2e3440] bg-[#101827] px-3 py-2">
                    <div class="text-[#94a3b8]">
                      {{ t('editorExtensions.stats.vscode') }}
                    </div>
                    <div class="text-base font-semibold text-[#e5e7eb]">
                      {{ stats.vscode }}
                    </div>
                  </div>
                  <div class="rounded border border-[#2e3440] bg-[#101827] px-3 py-2">
                    <div class="text-[#94a3b8]">
                      {{ t('editorExtensions.stats.cursor') }}
                    </div>
                    <div class="text-base font-semibold text-[#e5e7eb]">
                      {{ stats.cursor }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1fr)_160px_160px_120px]">
                <NInput
                  v-model:value="keyword"
                  clearable
                  :placeholder="t('editorExtensions.searchPlaceholder')"
                />
                <NSelect v-model:value="filterScope" :options="filterScopeOptions" />
                <NSelect v-model:value="sortField" :options="sortFieldOptions" />
                <NSelect v-model:value="sortDirection" :options="sortDirectionOptions" />
              </div>
              <div class="text-xs text-[#94a3b8]">
                {{ t('editorExtensions.filteredCount', { count: filteredRecords.length }) }}
              </div>
            </div>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[1120px] table-fixed border-collapse text-sm">
              <thead>
                <tr class="border-b border-[#2e3440] text-left text-[#94a3b8]">
                  <th class="w-[5%] whitespace-nowrap px-3 py-2">
                    {{ t('editorExtensions.index') }}
                  </th>
                  <th class="w-[17%] whitespace-nowrap px-3 py-2">
                    {{ t('editorExtensions.extensionId') }}
                  </th>
                  <th class="w-[16%] whitespace-nowrap px-3 py-2">
                    {{ t('editorExtensions.extensionName') }}
                  </th>
                  <th class="w-[17%] whitespace-nowrap px-3 py-2">
                    {{ t('editorExtensions.note') }}
                  </th>
                  <th class="w-[8%] whitespace-nowrap px-3 py-2">
                    {{ t('editorExtensions.scope') }}
                  </th>
                  <th class="w-[14%] whitespace-nowrap px-3 py-2">
                    VS Code
                  </th>
                  <th class="w-[14%] whitespace-nowrap px-3 py-2">
                    Cursor
                  </th>
                  <th class="w-[11%] whitespace-nowrap px-3 py-2">
                    {{ t('editorExtensions.actions') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredRecords.length === 0">
                  <td colspan="8" class="px-3 py-10 text-center text-[#94a3b8]">
                    {{ t('editorExtensions.empty') }}
                  </td>
                </tr>
                <tr
                  v-for="(record, index) in filteredRecords"
                  :key="record.id"
                  class="border-b border-[#202733] align-top"
                >
                  <td class="px-3 py-3 text-[#94a3b8]">
                    {{ index + 1 }}
                  </td>
                  <td class="px-3 py-3">
                    <button
                      class="cursor-pointer break-all text-left font-mono text-[#d7dde8] transition hover:text-[#63e2b7]"
                      type="button"
                      @click="copyExtensionId(record.extensionId)"
                    >
                      {{ record.extensionId }}
                    </button>
                  </td>
                  <td class="break-words px-3 py-3 text-[#e5e7eb]">
                    {{ record.name }}
                  </td>
                  <td class="break-words px-3 py-3 text-[#cbd5e1]">
                    {{ record.note }}
                  </td>
                  <td class="px-3 py-3">
                    <NTag size="small" type="info">
                      {{ t(`editorExtensions.scopes.${record.scope}`) }}
                    </NTag>
                  </td>
                  <td class="px-3 py-3">
                    <NSpace vertical :size="8">
                      <div v-if="record.vscodeName" class="break-words text-xs text-[#cbd5e1]">
                        {{ record.vscodeName }}
                      </div>
                      <NTag size="small" :type="statusType(record.status.vscode)">
                        {{ statusLabel(record.status.vscode) }}
                      </NTag>
                      <NSpace :size="6">
                        <NButton
                          size="tiny"
                          secondary
                          :loading="actionKey === `vscode:install:${record.extensionId}`"
                          @click="runCommand('vscode', 'install', record.extensionId)"
                        >
                          {{ t('editorExtensions.install') }}
                        </NButton>
                        <NButton
                          v-if="canInstallDownloadedVsix(record, 'vscode')"
                          size="tiny"
                          secondary
                          type="primary"
                          :loading="actionKey === `vscode:installDownloadedVsix:${record.extensionId}`"
                          @click="installDownloadedVsix('vscode', record.extensionId)"
                        >
                          {{ t('editorExtensions.installDownloadedVsix') }}
                        </NButton>
                        <NButton
                          size="tiny"
                          secondary
                          :loading="actionKey === `vscode:downloadVsix:${record.extensionId}`"
                          @click="downloadVsix('vscode', record.extensionId)"
                        >
                          {{ t('editorExtensions.downloadVsix') }}
                        </NButton>
                        <NButton
                          size="tiny"
                          secondary
                          type="error"
                          :loading="actionKey === `vscode:uninstall:${record.extensionId}`"
                          @click="runCommand('vscode', 'uninstall', record.extensionId)"
                        >
                          {{ t('editorExtensions.uninstall') }}
                        </NButton>
                      </NSpace>
                    </NSpace>
                  </td>
                  <td class="px-3 py-3">
                    <NSpace vertical :size="8">
                      <div v-if="record.cursorName" class="break-words text-xs text-[#cbd5e1]">
                        {{ record.cursorName }}
                      </div>
                      <NTag size="small" :type="statusType(record.status.cursor)">
                        {{ statusLabel(record.status.cursor) }}
                      </NTag>
                      <NSpace :size="6">
                        <NButton
                          size="tiny"
                          secondary
                          :loading="actionKey === `cursor:install:${record.extensionId}`"
                          @click="runCommand('cursor', 'install', record.extensionId)"
                        >
                          {{ t('editorExtensions.install') }}
                        </NButton>
                        <NButton
                          v-if="canInstallDownloadedVsix(record, 'cursor')"
                          size="tiny"
                          secondary
                          type="primary"
                          :loading="actionKey === `cursor:installDownloadedVsix:${record.extensionId}`"
                          @click="installDownloadedVsix('cursor', record.extensionId)"
                        >
                          {{ t('editorExtensions.installDownloadedVsix') }}
                        </NButton>
                        <NButton
                          size="tiny"
                          secondary
                          :loading="actionKey === `cursor:downloadVsix:${record.extensionId}`"
                          @click="downloadVsix('cursor', record.extensionId)"
                        >
                          {{ t('editorExtensions.downloadVsix') }}
                        </NButton>
                        <NButton
                          size="tiny"
                          secondary
                          type="error"
                          :loading="actionKey === `cursor:uninstall:${record.extensionId}`"
                          @click="runCommand('cursor', 'uninstall', record.extensionId)"
                        >
                          {{ t('editorExtensions.uninstall') }}
                        </NButton>
                      </NSpace>
                    </NSpace>
                  </td>
                  <td class="px-3 py-3">
                    <NSpace :size="6">
                      <NButton size="tiny" secondary @click="editRecord(record)">
                        {{ t('editorExtensions.edit') }}
                      </NButton>
                      <NPopconfirm @positive-click="deleteRecord(record.id)">
                        <template #trigger>
                          <NButton size="tiny" secondary type="error">
                            {{ t('editorExtensions.delete') }}
                          </NButton>
                        </template>
                        {{ t('editorExtensions.deleteConfirm') }}
                      </NPopconfirm>
                    </NSpace>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </NCard>
      </div>

      <NCard v-if="lastOutput" :title="t('editorExtensions.outputTitle')" embedded>
        <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-[#cbd5e1]">{{ lastOutput }}</pre>
      </NCard>

      <NModal v-model:show="showFormModal" preset="card" :title="form.id ? t('editorExtensions.editTitle') : t('editorExtensions.addTitle')" class="max-w-[560px]">
        <NForm label-placement="top">
          <NFormItem :label="t('editorExtensions.extensionId')">
            <NInput v-model:value="form.extensionId" placeholder="publisher.extension" />
          </NFormItem>
          <NFormItem :label="t('editorExtensions.extensionName')">
            <NInput v-model:value="form.name" :placeholder="t('editorExtensions.namePlaceholder')" />
          </NFormItem>
          <NFormItem :label="t('editorExtensions.note')">
            <NInput v-model:value="form.note" :placeholder="t('editorExtensions.notePlaceholder')" />
          </NFormItem>
          <NFormItem :label="t('editorExtensions.scope')" class="mb-0!">
            <NSelect v-model:value="form.scope" :options="scopeOptions" />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton secondary @click="showFormModal = false">
              {{ t('editorExtensions.cancel') }}
            </NButton>
            <NButton type="primary" @click="saveRecord">
              {{ t('editorExtensions.save') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </div>
  </main>
</template>

<style scoped>
.editor-extensions-page {
  background:
    radial-gradient(900px 420px at 90% -10%, rgba(20, 184, 166, 0.14), transparent 60%),
    linear-gradient(180deg, #111827 0%, #0f141d 100%);
}
</style>
