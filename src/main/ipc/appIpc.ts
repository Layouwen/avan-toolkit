import type { AppConfig } from '../configManager';
import type { IpcRegistrationContext } from './types';
import { dialog, ipcMain, shell } from 'electron';
import { getConfig, setConfig } from '../configManager';
import { getUpdateInfo, openUpdateDownload } from '../manualUpdateManager';
import { updateScreensaverConfig } from '../screensaverManager';

export function registerAppIpcHandlers(context: IpcRegistrationContext): void {
  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url));

  ipcMain.handle('updates:getInfo', () => getUpdateInfo());

  ipcMain.handle('updates:openDownload', (_event, url: string) => openUpdateDownload(url));

  ipcMain.handle('config:get', () => getConfig());

  ipcMain.handle('config:set', async (_event, config: AppConfig) => {
    await setConfig(config);
    updateScreensaverConfig();
  });

  ipcMain.handle('dialog:selectDir', async () => {
    const mainWindow = context.getMainWindow();
    if (!mainWindow)
      return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:selectImage', async () => {
    const mainWindow = context.getMainWindow();
    if (!mainWindow)
      return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
