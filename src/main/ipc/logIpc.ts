import type { LogFilters } from '../logger';
import path from 'node:path';
import { ipcMain, shell } from 'electron';
import {
  clearLogs,
  getLogFilePath,
  listLogs,
  subscribeLogs,
} from '../logger';

const logSubscriptions = new Map<number, () => void>();

export function registerLogIpcHandlers(): void {
  ipcMain.handle('logs:list', (_event, filters: LogFilters) => listLogs(filters));

  ipcMain.handle('logs:clear', (_event, filters: LogFilters) => {
    clearLogs(filters);
  });

  ipcMain.handle('logs:openFile', () => shell.openPath(path.dirname(getLogFilePath())));

  ipcMain.handle('logs:subscribe', (event) => {
    if (!logSubscriptions.has(event.sender.id)) {
      logSubscriptions.set(event.sender.id, subscribeLogs(event.sender));
    }
  });

  ipcMain.handle('logs:unsubscribe', (event) => {
    logSubscriptions.get(event.sender.id)?.();
    logSubscriptions.delete(event.sender.id);
  });
}
