// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

interface PreloadConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
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
}

interface CreateObsidianBlogPayload {
  title: string;
  directory?: string;
  tags?: string[];
  categories?: string[];
}

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: PreloadConfig) => ipcRenderer.invoke('config:set', config),
  listObsidianBlogs: () => ipcRenderer.invoke('blogs:list'),
  createObsidianBlog: (payload: CreateObsidianBlogPayload) => ipcRenderer.invoke('blogs:create', payload),
  deleteObsidianBlog: (relativePath: string) => ipcRenderer.invoke('blogs:delete', relativePath),
  renameObsidianBlogTitle: (relativePath: string, title: string) =>
    ipcRenderer.invoke('blogs:renameTitle', relativePath, title),
  renameObsidianBlogFileName: (relativePath: string, fileName: string) =>
    ipcRenderer.invoke('blogs:renameFileName', relativePath, fileName),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDir'),
  startSync: () => ipcRenderer.invoke('sync:start'),
  onSyncLog: (cb: (message: string, level: string) => void) => {
    ipcRenderer.on('sync:log', (_event, message, level) => cb(message, level));
  },
  offSyncLog: () => {
    ipcRenderer.removeAllListeners('sync:log');
  },
  onSyncDone: (cb: (success: boolean, error?: string) => void) => {
    ipcRenderer.once('sync:done', (_event, success, error) => cb(success, error));
  },
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  recommendActivity: (prompt: string, config: PreloadConfig['agent']) => ipcRenderer.invoke('agent:recommendActivity', prompt, config),
  testQzoneLogin: () => ipcRenderer.invoke('qzone:testLogin'),
  publishQzoneShuoshuo: (content: string) => ipcRenderer.invoke('qzone:publishShuoshuo', content),
  listQzoneShuoshuo: () => ipcRenderer.invoke('qzone:listShuoshuo'),
});
