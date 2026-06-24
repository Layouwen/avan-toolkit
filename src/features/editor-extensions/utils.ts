import type {
  AppConfig,
  EditorExtensionRecord,
  EditorExtensionScope,
  EditorExtensionWithStatus,
  EditorKind,
} from '../../electron-api.d';
import type {
  EditorExtensionCommandAction,
  EditorExtensionFilterScope,
  EditorExtensionSortDirection,
  EditorExtensionSortField,
  EditorExtensionStats,
  EditorExtensionStatusVariant,
} from '@/features/editor-extensions/types';

type Translate = (key: string) => string;

export function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export function statusRank(value: boolean | null): number {
  if (value === true) {
    return 2;
  }
  if (value === false) {
    return 1;
  }
  return 0;
}

export function compareRecords(
  a: EditorExtensionWithStatus,
  b: EditorExtensionWithStatus,
  field: EditorExtensionSortField,
): number {
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

export function buildEditorExtensionStats(records: EditorExtensionWithStatus[]): EditorExtensionStats {
  return {
    total: records.length,
    common: records.filter(record => record.scope === 'common').length,
    vscode: records.filter(record => record.scope === 'vscode').length,
    cursor: records.filter(record => record.scope === 'cursor').length,
  };
}

export function filterAndSortEditorExtensionRecords(
  records: EditorExtensionWithStatus[],
  filterScope: EditorExtensionFilterScope,
  keyword: string,
  sortField: EditorExtensionSortField,
  sortDirection: EditorExtensionSortDirection,
): EditorExtensionWithStatus[] {
  const keywordText = keyword.trim().toLowerCase();
  const filtered = records.filter((record) => {
    if (filterScope !== 'all' && record.scope !== filterScope) {
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
    const primary = compareRecords(a, b, sortField);
    const fallback = compareText(a.name, b.name) || compareText(a.extensionId, b.extensionId);
    const result = primary || fallback;
    return sortDirection === 'desc' ? -result : result;
  });
}

export function createDefaultEditorExtensionForm(): Partial<EditorExtensionRecord> {
  return {
    id: '',
    extensionId: '',
    name: '',
    vscodeName: '',
    cursorName: '',
    note: '',
    scope: 'common',
  };
}

export function resetEditorExtensionForm(form: Partial<EditorExtensionRecord>): void {
  Object.assign(form, createDefaultEditorExtensionForm());
}

export function applyEditorExtensionRecordToForm(
  form: Partial<EditorExtensionRecord>,
  record: EditorExtensionRecord,
): void {
  form.id = record.id;
  form.extensionId = record.extensionId;
  form.name = record.name;
  form.vscodeName = record.vscodeName;
  form.cursorName = record.cursorName;
  form.note = record.note;
  form.scope = record.scope;
}

export function createEditorExtensionUnknownStatusRecord(
  record: EditorExtensionRecord,
): EditorExtensionWithStatus {
  return {
    ...record,
    status: {
      vscode: null,
      cursor: null,
    },
    localVsix: {
      exists: false,
      filePath: '',
      bytes: 0,
    },
  };
}

export function withEditorExtensionConfig(
  config: AppConfig,
  nextConfig: AppConfig['editorExtensions'],
): AppConfig {
  return {
    ...config,
    editorExtensions: {
      ...config.editorExtensions,
      ...nextConfig,
    },
  };
}

export function statusVariant(value: boolean | null): EditorExtensionStatusVariant {
  if (value === true) {
    return 'default';
  }
  if (value === false) {
    return 'destructive';
  }
  return 'outline';
}

export function statusLabel(value: boolean | null, t: Translate): string {
  if (value === true) {
    return t('editorExtensions.installed');
  }
  if (value === false) {
    return t('editorExtensions.notInstalled');
  }
  return t('editorExtensions.unknown');
}

export function canInstallDownloadedVsix(record: EditorExtensionWithStatus, editor: EditorKind): boolean {
  return record.localVsix.exists && record.status[editor] === false;
}

export function editorExtensionCommandActionKey(
  editor: EditorKind,
  action: EditorExtensionCommandAction,
  extensionId: string,
): string {
  return `${editor}:${action}:${extensionId}`;
}

export function editorExtensionBulkActionKey(
  editor: EditorKind,
  action: EditorExtensionCommandAction,
  target: EditorKind | 'common',
): string {
  return `${editor}:${action}:bulk:${target}`;
}

export function editorExtensionDownloadVsixActionKey(editor: EditorKind, extensionId: string): string {
  return `${editor}:downloadVsix:${extensionId}`;
}

export function editorExtensionInstallDownloadedVsixActionKey(editor: EditorKind, extensionId: string): string {
  return `${editor}:installDownloadedVsix:${extensionId}`;
}

export function isEditorExtensionScope(value: unknown): value is EditorExtensionScope {
  return value === 'common' || value === 'vscode' || value === 'cursor';
}

export function isEditorExtensionFilterScope(value: unknown): value is EditorExtensionFilterScope {
  return value === 'all' || isEditorExtensionScope(value);
}

export function isEditorExtensionSortField(value: unknown): value is EditorExtensionSortField {
  return (
    value === 'extensionId'
    || value === 'name'
    || value === 'scope'
    || value === 'vscodeStatus'
    || value === 'cursorStatus'
  );
}

export function isEditorExtensionSortDirection(value: unknown): value is EditorExtensionSortDirection {
  return value === 'asc' || value === 'desc';
}
