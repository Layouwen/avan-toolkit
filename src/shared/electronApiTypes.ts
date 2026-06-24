import type { LifeToolsData as LifeToolsDataModel } from '../features/life-tools/types';

export type LifeToolsData = LifeToolsDataModel;

export interface ScreensaverConfig {
  enabled: boolean;
  triggerIntervalMinutes: number;
  countdownSeconds: number;
  backgroundType: 'color' | 'image';
  backgroundColor: string;
  backgroundImagePath: string;
}

export interface EditorExtensionsConfig {
  vsixDownloadDir: string;
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
  editorExtensions: EditorExtensionsConfig;
  lifeTools: LifeToolsData;
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

export type EditorKind = 'vscode' | 'cursor';
export type EditorExtensionScope = 'common' | 'vscode' | 'cursor';
export type EditorExtensionInitializeSource = EditorKind | 'both';

export interface EditorExtensionRecord {
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

export interface EditorExtensionStatus {
  vscode: boolean | null;
  cursor: boolean | null;
}

export interface EditorExtensionLocalVsixStatus {
  exists: boolean;
  filePath: string;
  bytes: number;
}

export interface EditorExtensionWithStatus extends EditorExtensionRecord {
  status: EditorExtensionStatus;
  localVsix: EditorExtensionLocalVsixStatus;
}

export interface EditorExtensionImportResult {
  added: number;
  updated: number;
  skipped: number;
  records: EditorExtensionRecord[];
}

export interface EditorExtensionCommandResult {
  success: boolean;
  message: string;
}

export interface EditorExtensionInitializeResult {
  added: number;
  updated: number;
  skipped: number;
  failedEditors: EditorKind[];
  records: EditorExtensionRecord[];
}

export interface EditorExtensionVsixDownloadResult {
  canceled: boolean;
  filePath: string;
  bytes: number;
}

export interface CreateObsidianBlogPayload {
  title: string;
  directory?: string;
  tags?: string[];
  categories?: string[];
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  downloadUrl: string;
  downloadAssetName: string;
}
