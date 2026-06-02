/// <reference types="vite/client" />

export interface AppConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
  locale: string;
  agent: AgentConfig;
  qzone: QzoneConfig;
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
  createObsidianBlog: (payload: CreateObsidianBlogPayload) => Promise<ObsidianBlog>;
  deleteObsidianBlog: (relativePath: string) => Promise<void>;
  renameObsidianBlogTitle: (relativePath: string, title: string) => Promise<ObsidianBlog>;
  renameObsidianBlogFileName: (relativePath: string, fileName: string) => Promise<ObsidianBlog>;
  selectDirectory: () => Promise<string | null>;
  startSync: () => Promise<void>;
  onSyncLog: (cb: (message: string, level: 'info' | 'success' | 'error') => void) => void;
  offSyncLog: () => void;
  onSyncDone: (cb: (success: boolean, error?: string) => void) => void;
  openExternal: (url: string) => Promise<void>;
  recommendActivity: (prompt: string, config: AgentConfig) => Promise<AgentResult>;
  testQzoneLogin: () => Promise<QzoneAutomationResult>;
  publishQzoneShuoshuo: (content: string) => Promise<QzoneAutomationResult>;
  listQzoneShuoshuo: () => Promise<QzoneListResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
