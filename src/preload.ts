// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

interface PreloadConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
  hexoEditorCommand: 'cursor' | 'code';
  locale: string;
  agent: {
    baseURL: string;
    model: string;
    apiKey: string;
  };
  qzone: {
    loginMode: 'credentials' | 'qr';
    qqNumber: string;
    qqPassword: string;
    playwrightProfileDir: string;
  };
  screensaver: {
    enabled: boolean;
    triggerIntervalMinutes: number;
    countdownSeconds: number;
    backgroundType: 'color' | 'image';
    backgroundColor: string;
    backgroundImagePath: string;
  };
}

interface CreateObsidianBlogPayload {
  title: string;
  directory?: string;
  tags?: string[];
  categories?: string[];
}

interface AppLogEntry {
  id: string;
  module: 'blogSync' | 'qzone' | 'agent';
  scope: string;
  runId: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  timestamp: string;
  sensitive?: boolean;
}

interface ScreensaverStatus {
  enabled: boolean;
  intervalSeconds: number;
  nextTriggerAt: number | null;
  remainingSeconds: number;
}

interface LogFilters {
  module?: AppLogEntry['module'];
  level?: AppLogEntry['level'];
  runId?: string;
  sensitive?: boolean;
  limit?: number;
}

interface BlogValidationIssue {
  id: string;
  source: 'obsidian' | 'hexo';
  relativePath: string;
  absolutePath: string;
  field: string;
  message: string;
  severity: 'error' | 'warn';
}

interface BlogValidationResult {
  ok: boolean;
  issues: BlogValidationIssue[];
  checkedFiles: number;
  obsidianCheckedFiles: number;
  hexoCheckedFiles: number;
  errorCount: number;
  warningCount: number;
}

type EditorKind = 'vscode' | 'cursor';
type EditorExtensionScope = 'common' | 'vscode' | 'cursor';
type EditorExtensionInitializeSource = EditorKind | 'both';

interface EditorExtensionRecord {
  id: string;
  extensionId: string;
  name: string;
  vscodeName: string;
  cursorName: string;
  note: string;
  scope: EditorExtensionScope;
  createdAt: string;
  updatedAt: string;
}

interface EditorExtensionWithStatus extends EditorExtensionRecord {
  status: {
    vscode: boolean | null;
    cursor: boolean | null;
  };
}

interface EditorExtensionImportResult {
  added: number;
  updated: number;
  skipped: number;
  records: EditorExtensionRecord[];
}

interface EditorExtensionCommandResult {
  success: boolean;
  message: string;
}

interface EditorExtensionInitializeResult {
  added: number;
  updated: number;
  skipped: number;
  failedEditors: EditorKind[];
  records: EditorExtensionRecord[];
}

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: PreloadConfig) => ipcRenderer.invoke('config:set', config),
  listObsidianBlogs: () => ipcRenderer.invoke('blogs:list'),
  validateObsidianBlogs: (): Promise<BlogValidationResult> => ipcRenderer.invoke('blogs:validate'),
  openObsidianBlog: (relativePath: string) => ipcRenderer.invoke('blogs:openInEditor', relativePath),
  openBlogValidationIssue: (source: 'obsidian' | 'hexo', absolutePath: string) =>
    ipcRenderer.invoke('blogs:openValidationIssue', source, absolutePath),
  openConfiguredBlogDir: (kind: 'obsidian' | 'hexo') => ipcRenderer.invoke('blogs:openConfiguredDir', kind),
  openObsidianPage: () => ipcRenderer.invoke('blogs:openObsidianPage'),
  openHexoProjectInEditor: () => ipcRenderer.invoke('blogs:openHexoProjectInEditor'),
  createObsidianBlog: (payload: CreateObsidianBlogPayload) => ipcRenderer.invoke('blogs:create', payload),
  deleteObsidianBlog: (relativePath: string) => ipcRenderer.invoke('blogs:delete', relativePath),
  deleteHexoOrphanBlog: (relativePath: string) => ipcRenderer.invoke('blogs:deleteHexoOrphan', relativePath),
  renameObsidianBlogTitle: (relativePath: string, title: string) =>
    ipcRenderer.invoke('blogs:renameTitle', relativePath, title),
  renameObsidianBlogFileName: (relativePath: string, fileName: string) =>
    ipcRenderer.invoke('blogs:renameFileName', relativePath, fileName),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDir'),
  startSync: () => ipcRenderer.invoke('sync:start'),
  pullBlog: () => ipcRenderer.invoke('sync:pullBlog'),
  onSyncLog: (cb: (message: string, level: string) => void) => {
    ipcRenderer.on('sync:log', (_event, message, level) => cb(message, level));
  },
  offSyncLog: () => {
    ipcRenderer.removeAllListeners('sync:log');
  },
  onSyncDone: (cb: (success: boolean, error?: string) => void) => {
    ipcRenderer.once('sync:done', (_event, success, error) => cb(success, error));
  },
  listLogs: (filters?: LogFilters) => ipcRenderer.invoke('logs:list', filters),
  clearLogs: (filters?: LogFilters) => ipcRenderer.invoke('logs:clear', filters),
  openLogFile: () => ipcRenderer.invoke('logs:openFile'),
  onLogEvent: (cb: (entry: AppLogEntry) => void) => {
    ipcRenderer.invoke('logs:subscribe');
    ipcRenderer.on('logs:event', (_event, entry) => cb(entry));
  },
  offLogEvent: () => {
    ipcRenderer.removeAllListeners('logs:event');
    ipcRenderer.invoke('logs:unsubscribe');
  },
  listEditorExtensions: (): Promise<EditorExtensionRecord[]> => ipcRenderer.invoke('editorExtensions:list'),
  listEditorExtensionsWithStatus: (): Promise<EditorExtensionWithStatus[]> => ipcRenderer.invoke('editorExtensions:listWithStatus'),
  saveEditorExtension: (payload: Partial<EditorExtensionRecord>): Promise<EditorExtensionRecord> =>
    ipcRenderer.invoke('editorExtensions:save', payload),
  deleteEditorExtension: (recordId: string): Promise<void> => ipcRenderer.invoke('editorExtensions:delete', recordId),
  exportEditorExtensionsMarkdown: (target: EditorKind | 'common'): Promise<string> =>
    ipcRenderer.invoke('editorExtensions:exportMarkdown', target),
  importEditorExtensionsMarkdown: (markdown: string, scope: EditorExtensionScope): Promise<EditorExtensionImportResult> =>
    ipcRenderer.invoke('editorExtensions:importMarkdown', markdown, scope),
  initializeEditorExtensions: (source: EditorExtensionInitializeSource): Promise<EditorExtensionInitializeResult> =>
    ipcRenderer.invoke('editorExtensions:initialize', source),
  readClipboardText: (): Promise<string> => ipcRenderer.invoke('editorExtensions:readClipboard'),
  runEditorExtensionCommand: (editor: EditorKind, action: 'install' | 'uninstall', extensionId: string): Promise<EditorExtensionCommandResult> =>
    ipcRenderer.invoke('editorExtensions:runCommand', editor, action, extensionId),
  runEditorExtensionBulkCommand: (editor: EditorKind, action: 'install' | 'uninstall', target: EditorKind | 'common'): Promise<EditorExtensionCommandResult[]> =>
    ipcRenderer.invoke('editorExtensions:runBulkCommand', editor, action, target),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  recommendActivity: (prompt: string, config: PreloadConfig['agent']) => ipcRenderer.invoke('agent:recommendActivity', prompt, config),
  testQzoneLogin: () => ipcRenderer.invoke('qzone:testLogin'),
  publishQzoneShuoshuo: (content: string) => ipcRenderer.invoke('qzone:publishShuoshuo', content),
  listQzoneShuoshuo: () => ipcRenderer.invoke('qzone:listShuoshuo'),
  loadMoreQzoneShuoshuo: () => ipcRenderer.invoke('qzone:loadMoreShuoshuo'),
  triggerScreensaver: () => ipcRenderer.invoke('screensaver:trigger'),
  closeScreensaver: () => ipcRenderer.invoke('screensaver:close'),
  getScreensaverConfig: () => ipcRenderer.invoke('screensaver:getConfig'),
  getScreensaverStatus: (): Promise<ScreensaverStatus> => ipcRenderer.invoke('screensaver:getStatus'),
  onScreensaverConfig: (cb: (config: PreloadConfig['screensaver']) => void) => {
    ipcRenderer.on('screensaver:config', (_event, config) => cb(config));
  },
  offScreensaverConfig: () => {
    ipcRenderer.removeAllListeners('screensaver:config');
  },
  selectImageFile: () => ipcRenderer.invoke('dialog:selectImage'),
});
