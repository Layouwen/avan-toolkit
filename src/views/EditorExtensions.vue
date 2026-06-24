<script setup lang="ts">
import type {
  AppConfig,
  EditorExtensionInitializeSource,
  EditorExtensionRecord,
  EditorExtensionScope,
  EditorExtensionWithStatus,
  EditorKind,
} from '../electron-api.d';
import type { BadgeVariants } from '@/components/ui/badge';
import { ClipboardIcon, CopyIcon, DownloadIcon, FolderOpenIcon, Loader2Icon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon, UploadIcon } from '@lucide/vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import ConfirmButton from '@/components/ConfirmButton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const { t } = useI18n();

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
  toast.success(t('editorExtensions.vsixDownloadDirSaved'));
}

async function saveRecord() {
  if (!form.extensionId?.trim()) {
    toast.warning(t('editorExtensions.extensionIdRequired'));
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
    toast.success(t('editorExtensions.saved'));
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function deleteRecord(recordId: string) {
  await window.electronAPI.deleteEditorExtension(recordId);
  await loadRecords();
  toast.success(t('editorExtensions.deleted'));
}

async function exportMarkdown(target: EditorKind | 'common') {
  const markdown = await window.electronAPI.exportEditorExtensionsMarkdown(target);
  lastOutput.value = markdown;
  toast.success(t('editorExtensions.copied'));
}

async function readClipboard() {
  importMarkdown.value = await window.electronAPI.readClipboardText();
}

async function copyExtensionId(extensionId: string) {
  try {
    await window.electronAPI.copyEditorExtensionId(extensionId);
    toast.success(t('editorExtensions.extensionIdCopied'));
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function importFromMarkdown() {
  if (!importMarkdown.value.trim()) {
    toast.warning(t('editorExtensions.importRequired'));
    return;
  }

  try {
    const result = await window.electronAPI.importEditorExtensionsMarkdown(importMarkdown.value, importScope.value);
    await loadRecords();
    toast.success(t('editorExtensions.imported', { ...result }));
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function initializeFromInstalled(source: EditorExtensionInitializeSource) {
  initializingSource.value = source;
  try {
    const result = await window.electronAPI.initializeEditorExtensions(source);
    await loadRecords();
    const summary = t('editorExtensions.initialized', { ...result });
    const failed = result.failedEditors.length > 0
      ? t('editorExtensions.initializeFailedEditors', { editors: result.failedEditors.join(', ') })
      : '';
    lastOutput.value = [summary, failed].filter(Boolean).join('\n');
    if (failed) {
      toast.warning(lastOutput.value);
    }
    else {
      toast.success(summary);
    }
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
  finally {
    initializingSource.value = '';
  }
}

function statusVariant(value: boolean | null): BadgeVariants['variant'] {
  if (value === true) {
    return 'default';
  }
  if (value === false) {
    return 'destructive';
  }
  return 'outline';
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
    toast.success(lastOutput.value);
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
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
      toast.success(t('editorExtensions.installDone'));
      await loadRecords();
    }
    else {
      toast.error(result.message || t('editorExtensions.downloadedVsixMissing'));
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
      toast.success(t(`editorExtensions.${action}Done`));
      await loadRecords();
    }
    else {
      toast.error(result.message);
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
      toast.error(t('editorExtensions.bulkFailed', { failed: failed.length, total: results.length }));
    }
    else {
      toast.success(t('editorExtensions.bulkDone', { total: results.length }));
    }
    await loadRecords();
  }
  finally {
    actionKey.value = '';
  }
}

function updateImportScope(value: unknown) {
  if (value === 'common' || value === 'vscode' || value === 'cursor') {
    importScope.value = value;
  }
}

function updateFilterScope(value: unknown) {
  if (value === 'all' || value === 'common' || value === 'vscode' || value === 'cursor') {
    filterScope.value = value;
  }
}

function updateSortField(value: unknown) {
  if (
    value === 'extensionId'
    || value === 'name'
    || value === 'scope'
    || value === 'vscodeStatus'
    || value === 'cursorStatus'
  ) {
    sortField.value = value;
  }
}

function updateSortDirection(value: unknown) {
  if (value === 'asc' || value === 'desc') {
    sortDirection.value = value;
  }
}

function updateFormScope(value: unknown) {
  if (value === 'common' || value === 'vscode' || value === 'cursor') {
    form.scope = value;
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
          <h1 class="text-xl font-semibold text-foreground">
            {{ t('editorExtensions.title') }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ t('editorExtensions.subtitle') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button @click="openCreateModal">
            <PlusIcon data-icon="inline-start" />
            {{ t('editorExtensions.addTitle') }}
          </Button>
          <Button variant="secondary" :disabled="loading" @click="loadRecords()">
            <Loader2Icon v-if="loading" data-icon="inline-start" class="animate-spin" />
            <RefreshCwIcon v-else data-icon="inline-start" />
            {{ t('editorExtensions.refreshStatus') }}
          </Button>
          <Button
            v-for="option in exportOptions"
            :key="option.value"
            variant="secondary"
            @click="exportMarkdown(option.value as EditorKind | 'common')"
          >
            <DownloadIcon data-icon="inline-start" />
            {{ option.label }}
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div class="flex flex-col gap-4">
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
                  @click="initializeFromInstalled(option.value as EditorExtensionInitializeSource)"
                >
                  <Loader2Icon v-if="initializingSource === option.value" data-icon="inline-start" class="animate-spin" />
                  <UploadIcon v-else data-icon="inline-start" />
                  {{ option.label }}
                </Button>
              </div>
            </CardContent>
          </Card>

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
                <Button variant="secondary" @click="selectVsixDownloadDir">
                  <FolderOpenIcon data-icon="inline-start" />
                  {{ t('editorExtensions.selectVsixDownloadDir') }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle class="text-base">
                {{ t('editorExtensions.importTitle') }}
              </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-3">
              <Select :model-value="importScope" @update:model-value="updateImportScope">
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
                v-model="importMarkdown"
                :rows="7"
                :placeholder="markdownPlaceholder"
              />
              <div class="flex justify-end gap-2">
                <Button variant="secondary" @click="readClipboard">
                  <ClipboardIcon data-icon="inline-start" />
                  {{ t('editorExtensions.readClipboard') }}
                </Button>
                <Button @click="importFromMarkdown">
                  <UploadIcon data-icon="inline-start" />
                  {{ t('editorExtensions.import') }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle class="text-base">
                {{ t('editorExtensions.bulkTitle') }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-1 gap-2">
                <Button
                  v-for="target in ['common', 'vscode']"
                  :key="`vscode-install-${target}`"
                  variant="secondary"
                  :disabled="Boolean(actionKey)"
                  @click="runBulk('vscode', 'install', target as EditorKind | 'common')"
                >
                  <Loader2Icon v-if="actionKey === `vscode:install:bulk:${target}`" data-icon="inline-start" class="animate-spin" />
                  {{ t('editorExtensions.bulkInstallVscode', { target: t(`editorExtensions.scopes.${target}`) }) }}
                </Button>
                <Button
                  v-for="target in ['common', 'cursor']"
                  :key="`cursor-install-${target}`"
                  variant="secondary"
                  :disabled="Boolean(actionKey)"
                  @click="runBulk('cursor', 'install', target as EditorKind | 'common')"
                >
                  <Loader2Icon v-if="actionKey === `cursor:install:bulk:${target}`" data-icon="inline-start" class="animate-spin" />
                  {{ t('editorExtensions.bulkInstallCursor', { target: t(`editorExtensions.scopes.${target}`) }) }}
                </Button>
                <ConfirmButton
                  v-for="target in ['common', 'vscode']"
                  :key="`vscode-uninstall-${target}`"
                  :title="t('editorExtensions.uninstall')"
                  :description="t('editorExtensions.bulkUninstallConfirm')"
                  :confirm-text="t('editorExtensions.uninstall')"
                  :cancel-text="t('editorExtensions.cancel')"
                  variant="destructive"
                  :disabled="Boolean(actionKey)"
                  @confirm="runBulk('vscode', 'uninstall', target as EditorKind | 'common')"
                >
                  <Loader2Icon v-if="actionKey === `vscode:uninstall:bulk:${target}`" data-icon="inline-start" class="animate-spin" />
                  {{ t('editorExtensions.bulkUninstallVscode', { target: t(`editorExtensions.scopes.${target}`) }) }}
                </ConfirmButton>
                <ConfirmButton
                  v-for="target in ['common', 'cursor']"
                  :key="`cursor-uninstall-${target}`"
                  :title="t('editorExtensions.uninstall')"
                  :description="t('editorExtensions.bulkUninstallConfirm')"
                  :confirm-text="t('editorExtensions.uninstall')"
                  :cancel-text="t('editorExtensions.cancel')"
                  variant="destructive"
                  :disabled="Boolean(actionKey)"
                  @confirm="runBulk('cursor', 'uninstall', target as EditorKind | 'common')"
                >
                  <Loader2Icon v-if="actionKey === `cursor:uninstall:bulk:${target}`" data-icon="inline-start" class="animate-spin" />
                  {{ t('editorExtensions.bulkUninstallCursor', { target: t(`editorExtensions.scopes.${target}`) }) }}
                </ConfirmButton>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card class="min-w-0">
          <CardHeader>
            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle class="text-base">
                  {{ t('editorExtensions.listTitle') }}
                </CardTitle>
                <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div class="rounded border bg-background px-3 py-2">
                    <div class="text-muted-foreground">
                      {{ t('editorExtensions.stats.total') }}
                    </div>
                    <div class="text-base font-semibold text-foreground">
                      {{ stats.total }}
                    </div>
                  </div>
                  <div class="rounded border bg-background px-3 py-2">
                    <div class="text-muted-foreground">
                      {{ t('editorExtensions.stats.common') }}
                    </div>
                    <div class="text-base font-semibold text-foreground">
                      {{ stats.common }}
                    </div>
                  </div>
                  <div class="rounded border bg-background px-3 py-2">
                    <div class="text-muted-foreground">
                      {{ t('editorExtensions.stats.vscode') }}
                    </div>
                    <div class="text-base font-semibold text-foreground">
                      {{ stats.vscode }}
                    </div>
                  </div>
                  <div class="rounded border bg-background px-3 py-2">
                    <div class="text-muted-foreground">
                      {{ t('editorExtensions.stats.cursor') }}
                    </div>
                    <div class="text-base font-semibold text-foreground">
                      {{ stats.cursor }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1fr)_160px_160px_120px]">
                <Input
                  v-model="keyword"
                  :placeholder="t('editorExtensions.searchPlaceholder')"
                />
                <Select :model-value="filterScope" @update:model-value="updateFilterScope">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem v-for="option in filterScopeOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select :model-value="sortField" @update:model-value="updateSortField">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem v-for="option in sortFieldOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select :model-value="sortDirection" @update:model-value="updateSortDirection">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem v-for="option in sortDirectionOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('editorExtensions.filteredCount', { count: filteredRecords.length }) }}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div class="overflow-x-auto">
              <Table class="min-w-[1120px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[5%]">
                      {{ t('editorExtensions.index') }}
                    </TableHead>
                    <TableHead class="w-[17%]">
                      {{ t('editorExtensions.extensionId') }}
                    </TableHead>
                    <TableHead class="w-[16%]">
                      {{ t('editorExtensions.extensionName') }}
                    </TableHead>
                    <TableHead class="w-[17%]">
                      {{ t('editorExtensions.note') }}
                    </TableHead>
                    <TableHead class="w-[8%]">
                      {{ t('editorExtensions.scope') }}
                    </TableHead>
                    <TableHead class="w-[14%]">
                      VS Code
                    </TableHead>
                    <TableHead class="w-[14%]">
                      Cursor
                    </TableHead>
                    <TableHead class="w-[11%]">
                      {{ t('editorExtensions.actions') }}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="filteredRecords.length === 0">
                    <TableCell colspan="8" class="py-10 text-center text-muted-foreground">
                      {{ t('editorExtensions.empty') }}
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="(record, index) in filteredRecords"
                    :key="record.id"
                  >
                    <TableCell class="align-top text-muted-foreground">
                      {{ index + 1 }}
                    </TableCell>
                    <TableCell class="align-top">
                      <button
                        class="cursor-pointer break-all text-left font-mono text-foreground transition hover:text-primary"
                        type="button"
                        @click="copyExtensionId(record.extensionId)"
                      >
                        <CopyIcon class="mr-1 inline size-3" />
                        {{ record.extensionId }}
                      </button>
                    </TableCell>
                    <TableCell class="break-words align-top text-foreground">
                      {{ record.name }}
                    </TableCell>
                    <TableCell class="break-words align-top text-muted-foreground">
                      {{ record.note }}
                    </TableCell>
                    <TableCell class="align-top">
                      <Badge variant="secondary">
                        {{ t(`editorExtensions.scopes.${record.scope}`) }}
                      </Badge>
                    </TableCell>
                    <TableCell class="align-top">
                      <div class="flex flex-col gap-2">
                        <div v-if="record.vscodeName" class="break-words text-xs text-muted-foreground">
                          {{ record.vscodeName }}
                        </div>
                        <Badge :variant="statusVariant(record.status.vscode)">
                          {{ statusLabel(record.status.vscode) }}
                        </Badge>
                        <div class="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            :disabled="Boolean(actionKey)"
                            @click="runCommand('vscode', 'install', record.extensionId)"
                          >
                            <Loader2Icon v-if="actionKey === `vscode:install:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                            {{ t('editorExtensions.install') }}
                          </Button>
                          <Button
                            v-if="canInstallDownloadedVsix(record, 'vscode')"
                            size="sm"
                            :disabled="Boolean(actionKey)"
                            @click="installDownloadedVsix('vscode', record.extensionId)"
                          >
                            <Loader2Icon v-if="actionKey === `vscode:installDownloadedVsix:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                            {{ t('editorExtensions.installDownloadedVsix') }}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            :disabled="Boolean(actionKey)"
                            @click="downloadVsix('vscode', record.extensionId)"
                          >
                            <Loader2Icon v-if="actionKey === `vscode:downloadVsix:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                            {{ t('editorExtensions.downloadVsix') }}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            :disabled="Boolean(actionKey)"
                            @click="runCommand('vscode', 'uninstall', record.extensionId)"
                          >
                            <Loader2Icon v-if="actionKey === `vscode:uninstall:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                            {{ t('editorExtensions.uninstall') }}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell class="align-top">
                      <div class="flex flex-col gap-2">
                        <div v-if="record.cursorName" class="break-words text-xs text-muted-foreground">
                          {{ record.cursorName }}
                        </div>
                        <Badge :variant="statusVariant(record.status.cursor)">
                          {{ statusLabel(record.status.cursor) }}
                        </Badge>
                        <div class="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            :disabled="Boolean(actionKey)"
                            @click="runCommand('cursor', 'install', record.extensionId)"
                          >
                            <Loader2Icon v-if="actionKey === `cursor:install:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                            {{ t('editorExtensions.install') }}
                          </Button>
                          <Button
                            v-if="canInstallDownloadedVsix(record, 'cursor')"
                            size="sm"
                            :disabled="Boolean(actionKey)"
                            @click="installDownloadedVsix('cursor', record.extensionId)"
                          >
                            <Loader2Icon v-if="actionKey === `cursor:installDownloadedVsix:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                            {{ t('editorExtensions.installDownloadedVsix') }}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            :disabled="Boolean(actionKey)"
                            @click="downloadVsix('cursor', record.extensionId)"
                          >
                            <Loader2Icon v-if="actionKey === `cursor:downloadVsix:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                            {{ t('editorExtensions.downloadVsix') }}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            :disabled="Boolean(actionKey)"
                            @click="runCommand('cursor', 'uninstall', record.extensionId)"
                          >
                            <Loader2Icon v-if="actionKey === `cursor:uninstall:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                            {{ t('editorExtensions.uninstall') }}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell class="align-top">
                      <div class="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" @click="editRecord(record)">
                          <PencilIcon data-icon="inline-start" />
                          {{ t('editorExtensions.edit') }}
                        </Button>
                        <ConfirmButton
                          :title="t('editorExtensions.delete')"
                          :description="t('editorExtensions.deleteConfirm')"
                          :confirm-text="t('editorExtensions.delete')"
                          :cancel-text="t('editorExtensions.cancel')"
                          variant="destructive"
                          size="sm"
                          @confirm="deleteRecord(record.id)"
                        >
                          <Trash2Icon data-icon="inline-start" />
                          {{ t('editorExtensions.delete') }}
                        </ConfirmButton>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

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

      <Dialog v-model:open="showFormModal">
        <DialogContent class="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{{ form.id ? t('editorExtensions.editTitle') : t('editorExtensions.addTitle') }}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel for="extension-id">
                {{ t('editorExtensions.extensionId') }}
              </FieldLabel>
              <Input id="extension-id" v-model="form.extensionId" placeholder="publisher.extension" />
            </Field>
            <Field>
              <FieldLabel for="extension-name">
                {{ t('editorExtensions.extensionName') }}
              </FieldLabel>
              <Input id="extension-name" v-model="form.name" :placeholder="t('editorExtensions.namePlaceholder')" />
            </Field>
            <Field>
              <FieldLabel for="extension-note">
                {{ t('editorExtensions.note') }}
              </FieldLabel>
              <Input id="extension-note" v-model="form.note" :placeholder="t('editorExtensions.notePlaceholder')" />
            </Field>
            <Field>
              <FieldLabel>{{ t('editorExtensions.scope') }}</FieldLabel>
              <Select :model-value="form.scope" @update:model-value="updateFormScope">
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
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="secondary" @click="showFormModal = false">
              {{ t('editorExtensions.cancel') }}
            </Button>
            <Button @click="saveRecord">
              {{ t('editorExtensions.save') }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
