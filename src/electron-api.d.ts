/// <reference types="vite/client" />

export interface AppConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
  locale: string;
  agent: AgentConfig;
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

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  startSync: () => Promise<void>;
  onSyncLog: (cb: (message: string, level: 'info' | 'success' | 'error') => void) => void;
  offSyncLog: () => void;
  onSyncDone: (cb: (success: boolean, error?: string) => void) => void;
  openExternal: (url: string) => Promise<void>;
  recommendActivity: (prompt: string, config: AgentConfig) => Promise<AgentResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
