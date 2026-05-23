/// <reference types="vite/client" />

export interface AppConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
}

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  startSync: () => Promise<void>;
  onSyncLog: (cb: (message: string, level: 'info' | 'success' | 'error') => void) => void;
  offSyncLog: () => void;
  onSyncDone: (cb: (success: boolean, error?: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
