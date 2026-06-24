/// <reference types="vite/client" />

import type {
  AgentConfig,
  AgentResult,
  AppConfig,
  AppLogEntry,
  AppUpdateInfo,
  BlogValidationResult,
  BlogValidationSource,
  CreateObsidianBlogPayload,
  EditorExtensionCommandResult,
  EditorExtensionImportResult,
  EditorExtensionInitializeResult,
  EditorExtensionInitializeSource,
  EditorExtensionRecord,
  EditorExtensionScope,
  EditorExtensionVsixDownloadResult,
  EditorExtensionWithStatus,
  EditorKind,
  LogFilters,
  LogLevel,
  ObsidianBlog,
  QzoneAutomationResult,
  QzoneListResult,
  ScreensaverConfig,
  ScreensaverStatus,
} from './shared/electronApiTypes';

export type {
  AgentConfig,
  AgentResult,
  AppConfig,
  AppLogEntry,
  AppUpdateInfo,
  BlogValidationIssue,
  BlogValidationResult,
  BlogValidationSeverity,
  BlogValidationSource,
  CreateObsidianBlogPayload,
  EditorExtensionCommandResult,
  EditorExtensionImportResult,
  EditorExtensionInitializeResult,
  EditorExtensionInitializeSource,
  EditorExtensionLocalVsixStatus,
  EditorExtensionRecord,
  EditorExtensionsConfig,
  EditorExtensionScope,
  EditorExtensionStatus,
  EditorExtensionVsixDownloadResult,
  EditorExtensionWithStatus,
  EditorKind,
  LogFilters,
  LogLevel,
  LogModule,
  ObsidianBlog,
  QzoneAutomationResult,
  QzoneConfig,
  QzoneListItem,
  QzoneListResult,
  ScreensaverConfig,
  ScreensaverStatus,
} from './shared/electronApiTypes';

export interface ElectronAPI {
  getUpdateInfo: () => Promise<AppUpdateInfo>;
  openUpdateDownload: (url: string) => Promise<void>;
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<void>;
  listObsidianBlogs: () => Promise<ObsidianBlog[]>;
  validateObsidianBlogs: () => Promise<BlogValidationResult>;
  openObsidianBlog: (relativePath: string) => Promise<void>;
  openBlogValidationIssue: (source: BlogValidationSource, absolutePath: string) => Promise<void>;
  openConfiguredBlogDir: (kind: BlogValidationSource) => Promise<void>;
  openObsidianPage: () => Promise<void>;
  openHexoProjectInEditor: () => Promise<void>;
  createObsidianBlog: (payload: CreateObsidianBlogPayload) => Promise<ObsidianBlog>;
  deleteObsidianBlog: (relativePath: string) => Promise<void>;
  deleteHexoOrphanBlog: (relativePath: string) => Promise<void>;
  renameObsidianBlogTitle: (relativePath: string, title: string) => Promise<ObsidianBlog>;
  renameObsidianBlogFileName: (relativePath: string, fileName: string) => Promise<ObsidianBlog>;
  selectDirectory: () => Promise<string | null>;
  selectImageFile: () => Promise<string | null>;
  startSync: () => Promise<void>;
  pullBlog: () => Promise<void>;
  onSyncLog: (cb: (message: string, level: LogLevel) => void) => void;
  offSyncLog: () => void;
  onSyncDone: (cb: (success: boolean, error?: string) => void) => void;
  listLogs: (filters?: LogFilters) => Promise<AppLogEntry[]>;
  clearLogs: (filters?: LogFilters) => Promise<void>;
  openLogFile: () => Promise<void>;
  onLogEvent: (cb: (entry: AppLogEntry) => void) => void;
  offLogEvent: () => void;
  listEditorExtensions: () => Promise<EditorExtensionRecord[]>;
  listEditorExtensionsWithStatus: () => Promise<EditorExtensionWithStatus[]>;
  saveEditorExtension: (payload: Partial<EditorExtensionRecord>) => Promise<EditorExtensionRecord>;
  deleteEditorExtension: (recordId: string) => Promise<void>;
  exportEditorExtensionsMarkdown: (target: EditorKind | 'common') => Promise<string>;
  importEditorExtensionsMarkdown: (markdown: string, scope: EditorExtensionScope) => Promise<EditorExtensionImportResult>;
  initializeEditorExtensions: (source: EditorExtensionInitializeSource) => Promise<EditorExtensionInitializeResult>;
  readClipboardText: () => Promise<string>;
  copyEditorExtensionId: (extensionId: string) => Promise<void>;
  runEditorExtensionCommand: (editor: EditorKind, action: 'install' | 'uninstall', extensionId: string) => Promise<EditorExtensionCommandResult>;
  runEditorExtensionBulkCommand: (editor: EditorKind, action: 'install' | 'uninstall', target: EditorKind | 'common') => Promise<EditorExtensionCommandResult[]>;
  downloadEditorExtensionVsix: (extensionId: string) => Promise<EditorExtensionVsixDownloadResult>;
  installDownloadedEditorExtensionVsix: (editor: EditorKind, extensionId: string) => Promise<EditorExtensionCommandResult>;
  openExternal: (url: string) => Promise<void>;
  recommendActivity: (prompt: string, config: AgentConfig) => Promise<AgentResult>;
  testQzoneLogin: () => Promise<QzoneAutomationResult>;
  publishQzoneShuoshuo: (content: string) => Promise<QzoneAutomationResult>;
  listQzoneShuoshuo: () => Promise<QzoneListResult>;
  loadMoreQzoneShuoshuo: () => Promise<QzoneListResult>;
  triggerScreensaver: () => Promise<void>;
  closeScreensaver: () => Promise<void>;
  getScreensaverConfig: () => Promise<ScreensaverConfig>;
  getScreensaverStatus: () => Promise<ScreensaverStatus>;
  onScreensaverConfig: (cb: (config: ScreensaverConfig) => void) => void;
  offScreensaverConfig: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
