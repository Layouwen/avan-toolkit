import type {
  EditorExtensionInitializeSource,
  EditorExtensionRecord,
  EditorExtensionScope,
  EditorKind,
} from '../editorExtensionManager';
import { clipboard, ipcMain } from 'electron';
import {
  deleteEditorExtension,
  downloadEditorExtensionVsix,
  exportEditorExtensionsMarkdown,
  importEditorExtensionsMarkdown,
  initializeEditorExtensions,
  installDownloadedEditorExtensionVsix,
  listEditorExtensions,
  listEditorExtensionsWithStatus,
  runEditorExtensionBulkCommand,
  runEditorExtensionCommand,
  upsertEditorExtension,
} from '../editorExtensionManager';

export function registerEditorExtensionsIpcHandlers(): void {
  ipcMain.handle('editorExtensions:list', () => listEditorExtensions());

  ipcMain.handle('editorExtensions:listWithStatus', () => listEditorExtensionsWithStatus());

  ipcMain.handle('editorExtensions:save', (_event, payload: Partial<EditorExtensionRecord>) => upsertEditorExtension(payload));

  ipcMain.handle('editorExtensions:delete', (_event, recordId: string) => deleteEditorExtension(recordId));

  ipcMain.handle('editorExtensions:exportMarkdown', async (_event, target: EditorKind | 'common') => {
    const records = await listEditorExtensions();
    const markdown = exportEditorExtensionsMarkdown(records, target);
    clipboard.writeText(markdown);
    return markdown;
  });

  ipcMain.handle('editorExtensions:importMarkdown', (_event, markdown: string, scope: EditorExtensionScope) =>
    importEditorExtensionsMarkdown(markdown, scope));

  ipcMain.handle('editorExtensions:initialize', (_event, source: EditorExtensionInitializeSource) =>
    initializeEditorExtensions(source));

  ipcMain.handle('editorExtensions:readClipboard', () => clipboard.readText());

  ipcMain.handle('editorExtensions:copyExtensionId', (_event, extensionId: string) => {
    if (!/^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i.test(extensionId)) {
      throw new Error('Invalid extension id.');
    }
    clipboard.writeText(extensionId.trim().toLowerCase());
  });

  ipcMain.handle('editorExtensions:runCommand', (_event, editor: EditorKind, action: 'install' | 'uninstall', extensionId: string) =>
    runEditorExtensionCommand(editor, action, extensionId));

  ipcMain.handle('editorExtensions:runBulkCommand', (_event, editor: EditorKind, action: 'install' | 'uninstall', target: EditorKind | 'common') =>
    runEditorExtensionBulkCommand(editor, action, target));

  ipcMain.handle('editorExtensions:downloadVsix', (_event, extensionId: string) =>
    downloadEditorExtensionVsix(extensionId));

  ipcMain.handle('editorExtensions:installDownloadedVsix', (_event, editor: EditorKind, extensionId: string) =>
    installDownloadedEditorExtensionVsix(editor, extensionId));
}
