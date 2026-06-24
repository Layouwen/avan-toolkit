import type {
  EditorExtensionInitializeSource,
  EditorExtensionRecord,
  EditorExtensionScope,
  EditorExtensionWithStatus,
  EditorKind,
} from '../../../electron-api.d';
import type {
  EditorExtensionCommandAction,
  EditorExtensionFilterScope,
  EditorExtensionSortDirection,
  EditorExtensionSortField,
} from '@/features/editor-extensions/types';
import { computed, reactive, ref, shallowRef } from 'vue';
import { toast } from 'vue-sonner';
import {
  applyEditorExtensionRecordToForm,
  buildEditorExtensionStats,
  canInstallDownloadedVsix as canInstallDownloadedVsixRecord,
  createDefaultEditorExtensionForm,
  createEditorExtensionUnknownStatusRecord,
  editorExtensionBulkActionKey,
  editorExtensionCommandActionKey,
  editorExtensionDownloadVsixActionKey,
  editorExtensionInstallDownloadedVsixActionKey,
  filterAndSortEditorExtensionRecords,
  isEditorExtensionFilterScope,
  isEditorExtensionScope,
  isEditorExtensionSortDirection,
  isEditorExtensionSortField,
  resetEditorExtensionForm,
  statusLabel as resolveStatusLabel,
  statusVariant,
  withEditorExtensionConfig,
} from '@/features/editor-extensions/utils';

type Translate = (key: string, values?: Record<string, unknown>) => string;

interface UseEditorExtensionsOptions {
  t: Translate;
}

export function useEditorExtensions(options: UseEditorExtensionsOptions) {
  const records = ref<EditorExtensionWithStatus[]>([]);
  const loading = shallowRef(false);
  const actionKey = shallowRef('');
  const initializingSource = shallowRef<EditorExtensionInitializeSource | ''>('');
  const showFormModal = shallowRef(false);
  const filterScope = shallowRef<EditorExtensionFilterScope>('all');
  const keyword = shallowRef('');
  const sortField = shallowRef<EditorExtensionSortField>('name');
  const sortDirection = shallowRef<EditorExtensionSortDirection>('asc');
  const importMarkdown = shallowRef('');
  const importScope = shallowRef<EditorExtensionScope>('common');
  const vsixDownloadDir = shallowRef('');
  const lastOutput = shallowRef('');
  const markdownPlaceholder = [
    '|序号|插件 id|插件名|插件备注|',
    '|----|----|----|----|',
    '|1|publisher.extension|插件名|备注|',
  ].join('\n');

  const form = reactive<Partial<EditorExtensionRecord>>(createDefaultEditorExtensionForm());

  const scopeOptions = computed(() => [
    { label: options.t('editorExtensions.scopes.common'), value: 'common' as const },
    { label: options.t('editorExtensions.scopes.vscode'), value: 'vscode' as const },
    { label: options.t('editorExtensions.scopes.cursor'), value: 'cursor' as const },
  ]);

  const filterScopeOptions = computed(() => [
    { label: options.t('editorExtensions.scopes.all'), value: 'all' as const },
    ...scopeOptions.value,
  ]);

  const sortFieldOptions = computed(() => [
    { label: options.t('editorExtensions.sortFields.extensionId'), value: 'extensionId' as const },
    { label: options.t('editorExtensions.sortFields.name'), value: 'name' as const },
    { label: options.t('editorExtensions.sortFields.scope'), value: 'scope' as const },
    { label: options.t('editorExtensions.sortFields.vscodeStatus'), value: 'vscodeStatus' as const },
    { label: options.t('editorExtensions.sortFields.cursorStatus'), value: 'cursorStatus' as const },
  ]);

  const sortDirectionOptions = computed(() => [
    { label: options.t('editorExtensions.sortDirections.desc'), value: 'desc' as const },
    { label: options.t('editorExtensions.sortDirections.asc'), value: 'asc' as const },
  ]);

  const exportOptions = computed(() => [
    { label: options.t('editorExtensions.exportCommon'), value: 'common' as const },
    { label: options.t('editorExtensions.exportVscode'), value: 'vscode' as const },
    { label: options.t('editorExtensions.exportCursor'), value: 'cursor' as const },
  ]);

  const initializeOptions = computed(() => [
    { label: options.t('editorExtensions.initializeVscode'), value: 'vscode' as const },
    { label: options.t('editorExtensions.initializeCursor'), value: 'cursor' as const },
    { label: options.t('editorExtensions.initializeBoth'), value: 'both' as const },
  ]);

  const stats = computed(() => buildEditorExtensionStats(records.value));

  const filteredRecords = computed(() => filterAndSortEditorExtensionRecords(
    records.value,
    filterScope.value,
    keyword.value,
    sortField.value,
    sortDirection.value,
  ));

  function resetForm(): void {
    resetEditorExtensionForm(form);
  }

  function openCreateModal(): void {
    resetForm();
    showFormModal.value = true;
  }

  function editRecord(record: EditorExtensionRecord): void {
    applyEditorExtensionRecordToForm(form, record);
    showFormModal.value = true;
  }

  async function loadRecords(withStatus = true): Promise<void> {
    loading.value = true;
    try {
      records.value = withStatus
        ? await window.electronAPI.listEditorExtensionsWithStatus()
        : (await window.electronAPI.listEditorExtensions()).map(createEditorExtensionUnknownStatusRecord);
    }
    finally {
      loading.value = false;
    }
  }

  async function loadEditorExtensionConfig(): Promise<void> {
    const config = await window.electronAPI.getConfig();
    vsixDownloadDir.value = config.editorExtensions.vsixDownloadDir;
  }

  async function selectVsixDownloadDir(): Promise<void> {
    const dir = await window.electronAPI.selectDirectory();
    if (!dir) {
      return;
    }

    const config = await window.electronAPI.getConfig();
    await window.electronAPI.setConfig(withEditorExtensionConfig(config, {
      vsixDownloadDir: dir,
    }));
    vsixDownloadDir.value = dir;
    toast.success(options.t('editorExtensions.vsixDownloadDirSaved'));
  }

  async function saveRecord(): Promise<void> {
    if (!form.extensionId?.trim()) {
      toast.warning(options.t('editorExtensions.extensionIdRequired'));
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
      toast.success(options.t('editorExtensions.saved'));
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteRecord(recordId: string): Promise<void> {
    await window.electronAPI.deleteEditorExtension(recordId);
    await loadRecords();
    toast.success(options.t('editorExtensions.deleted'));
  }

  async function exportMarkdown(target: EditorKind | 'common'): Promise<void> {
    const markdown = await window.electronAPI.exportEditorExtensionsMarkdown(target);
    lastOutput.value = markdown;
    toast.success(options.t('editorExtensions.copied'));
  }

  async function readClipboard(): Promise<void> {
    importMarkdown.value = await window.electronAPI.readClipboardText();
  }

  async function copyExtensionId(extensionId: string): Promise<void> {
    try {
      await window.electronAPI.copyEditorExtensionId(extensionId);
      toast.success(options.t('editorExtensions.extensionIdCopied'));
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function importFromMarkdown(): Promise<void> {
    if (!importMarkdown.value.trim()) {
      toast.warning(options.t('editorExtensions.importRequired'));
      return;
    }

    try {
      const result = await window.electronAPI.importEditorExtensionsMarkdown(importMarkdown.value, importScope.value);
      await loadRecords();
      toast.success(options.t('editorExtensions.imported', { ...result }));
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function initializeFromInstalled(source: EditorExtensionInitializeSource): Promise<void> {
    initializingSource.value = source;
    try {
      const result = await window.electronAPI.initializeEditorExtensions(source);
      await loadRecords();
      const summary = options.t('editorExtensions.initialized', { ...result });
      const failed = result.failedEditors.length > 0
        ? options.t('editorExtensions.initializeFailedEditors', { editors: result.failedEditors.join(', ') })
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

  function statusLabel(value: boolean | null): string {
    return resolveStatusLabel(value, options.t);
  }

  async function downloadVsix(editor: EditorKind, extensionId: string): Promise<void> {
    const key = editorExtensionDownloadVsixActionKey(editor, extensionId);
    actionKey.value = key;
    try {
      const result = await window.electronAPI.downloadEditorExtensionVsix(extensionId);
      lastOutput.value = options.t('editorExtensions.vsixDownloaded', {
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

  function canInstallDownloadedVsix(record: EditorExtensionWithStatus, editor: EditorKind): boolean {
    return canInstallDownloadedVsixRecord(record, editor);
  }

  async function installDownloadedVsix(editor: EditorKind, extensionId: string): Promise<void> {
    const key = editorExtensionInstallDownloadedVsixActionKey(editor, extensionId);
    actionKey.value = key;
    try {
      const result = await window.electronAPI.installDownloadedEditorExtensionVsix(editor, extensionId);
      lastOutput.value = result.message;
      if (result.success) {
        toast.success(options.t('editorExtensions.installDone'));
        await loadRecords();
      }
      else {
        toast.error(result.message || options.t('editorExtensions.downloadedVsixMissing'));
      }
    }
    finally {
      actionKey.value = '';
    }
  }

  async function runCommand(
    editor: EditorKind,
    action: EditorExtensionCommandAction,
    extensionId: string,
  ): Promise<void> {
    const key = editorExtensionCommandActionKey(editor, action, extensionId);
    actionKey.value = key;
    try {
      const result = await window.electronAPI.runEditorExtensionCommand(editor, action, extensionId);
      lastOutput.value = result.message;
      if (result.success) {
        toast.success(options.t(`editorExtensions.${action}Done`));
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

  async function runBulk(
    editor: EditorKind,
    action: EditorExtensionCommandAction,
    target: EditorKind | 'common',
  ): Promise<void> {
    const key = editorExtensionBulkActionKey(editor, action, target);
    actionKey.value = key;
    try {
      const results = await window.electronAPI.runEditorExtensionBulkCommand(editor, action, target);
      const failed = results.filter(result => !result.success);
      lastOutput.value = results.map(result => result.message).join('\n\n');
      if (failed.length > 0) {
        toast.error(options.t('editorExtensions.bulkFailed', { failed: failed.length, total: results.length }));
      }
      else {
        toast.success(options.t('editorExtensions.bulkDone', { total: results.length }));
      }
      await loadRecords();
    }
    finally {
      actionKey.value = '';
    }
  }

  function updateImportScope(value: unknown): void {
    if (isEditorExtensionScope(value)) {
      importScope.value = value;
    }
  }

  function updateFilterScope(value: unknown): void {
    if (isEditorExtensionFilterScope(value)) {
      filterScope.value = value;
    }
  }

  function updateSortField(value: unknown): void {
    if (isEditorExtensionSortField(value)) {
      sortField.value = value;
    }
  }

  function updateSortDirection(value: unknown): void {
    if (isEditorExtensionSortDirection(value)) {
      sortDirection.value = value;
    }
  }

  function updateFormScope(value: unknown): void {
    if (isEditorExtensionScope(value)) {
      form.scope = value;
    }
  }

  return {
    records,
    loading,
    actionKey,
    initializingSource,
    showFormModal,
    filterScope,
    keyword,
    sortField,
    sortDirection,
    importMarkdown,
    importScope,
    vsixDownloadDir,
    lastOutput,
    markdownPlaceholder,
    form,
    scopeOptions,
    filterScopeOptions,
    sortFieldOptions,
    sortDirectionOptions,
    exportOptions,
    initializeOptions,
    stats,
    filteredRecords,
    resetForm,
    openCreateModal,
    editRecord,
    loadRecords,
    loadEditorExtensionConfig,
    selectVsixDownloadDir,
    saveRecord,
    deleteRecord,
    exportMarkdown,
    readClipboard,
    copyExtensionId,
    importFromMarkdown,
    initializeFromInstalled,
    statusVariant,
    statusLabel,
    downloadVsix,
    canInstallDownloadedVsix,
    installDownloadedVsix,
    runCommand,
    runBulk,
    updateImportScope,
    updateFilterScope,
    updateSortField,
    updateSortDirection,
    updateFormScope,
  };
}
