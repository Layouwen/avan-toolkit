import type { EditorExtensionScope } from '../../electron-api.d';

export type EditorExtensionFilterScope = EditorExtensionScope | 'all';
export type EditorExtensionSortField = 'extensionId' | 'name' | 'scope' | 'vscodeStatus' | 'cursorStatus';
export type EditorExtensionSortDirection = 'asc' | 'desc';
export type EditorExtensionCommandAction = 'install' | 'uninstall';
export type EditorExtensionStatusVariant = 'default' | 'destructive' | 'outline';

export interface EditorExtensionStats {
  total: number;
  common: number;
  vscode: number;
  cursor: number;
}
