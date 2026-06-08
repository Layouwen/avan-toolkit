/// <reference types="vite/client" />

export interface ScreensaverConfig {
  enabled: boolean;
  triggerIntervalMinutes: number;
  countdownSeconds: number;
  backgroundType: 'color' | 'image';
  backgroundColor: string;
  backgroundImagePath: string;
}

export interface ScreensaverStatus {
  enabled: boolean;
  intervalSeconds: number;
  nextTriggerAt: number | null;
  remainingSeconds: number;
}

export interface AppConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
  hexoEditorCommand: 'cursor' | 'code';
  locale: string;
  agent: AgentConfig;
  qzone: QzoneConfig;
  screensaver: ScreensaverConfig;
}

export interface AgentConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export interface AgentResult {
  answer: string;
  model: string;
  baseURL: string;
  trace: string[];
}

export type LogModule = 'blogSync' | 'qzone' | 'agent';
export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface AppLogEntry {
  id: string;
  module: LogModule;
  scope: string;
  runId: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  sensitive?: boolean;
}

export interface LogFilters {
  module?: LogModule;
  level?: LogLevel;
  runId?: string;
  sensitive?: boolean;
  limit?: number;
}

export interface QzoneConfig {
  loginMode: 'credentials' | 'qr';
  qqNumber: string;
  qqPassword: string;
  playwrightProfileDir: string;
}

export interface QzoneAutomationResult {
  success: boolean;
  message: string;
  steps: string[];
}

export interface QzoneListItem {
  id: string;
  text: string;
  source: string;
  images: string[];
}

export interface QzoneListResult extends QzoneAutomationResult {
  items: QzoneListItem[];
  hasMore: boolean;
}

export interface ObsidianBlog {
  id: string;
  title: string;
  fileName: string;
  directory: string;
  relativePath: string;
  absolutePath: string;
  updatedAt: string;
  tags: string[];
  categories: string[];
}

export type BlogValidationSeverity = 'error' | 'warn';
export type BlogValidationSource = 'obsidian' | 'hexo';

export interface BlogValidationIssue {
  id: string;
  source: BlogValidationSource;
  relativePath: string;
  absolutePath: string;
  field: string;
  message: string;
  severity: BlogValidationSeverity;
}

export interface BlogValidationResult {
  ok: boolean;
  issues: BlogValidationIssue[];
  checkedFiles: number;
  obsidianCheckedFiles: number;
  hexoCheckedFiles: number;
  errorCount: number;
  warningCount: number;
}

export interface CreateObsidianBlogPayload {
  title: string;
  directory?: string;
  tags?: string[];
  categories?: string[];
}

export interface ElectronAPI {
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
  renameObsidianBlogTitle: (relativePath: string, title: string) => Promise<ObsidianBlog>;
  renameObsidianBlogFileName: (relativePath: string, fileName: string) => Promise<ObsidianBlog>;
  selectDirectory: () => Promise<string | null>;
  selectImageFile: () => Promise<string | null>;
  startSync: () => Promise<void>;
  onSyncLog: (cb: (message: string, level: LogLevel) => void) => void;
  offSyncLog: () => void;
  onSyncDone: (cb: (success: boolean, error?: string) => void) => void;
  listLogs: (filters?: LogFilters) => Promise<AppLogEntry[]>;
  clearLogs: (filters?: LogFilters) => Promise<void>;
  openLogFile: () => Promise<void>;
  onLogEvent: (cb: (entry: AppLogEntry) => void) => void;
  offLogEvent: () => void;
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
