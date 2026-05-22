// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: { obsidianBlogDir: string; hexoBlogDir: string }) => {
    ipcRenderer.invoke('config:set', config)
  },
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
});
