import path from 'node:path';
import process from 'node:process';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import { getConfig, setConfig } from './main/configManager';
import { runSyncPipeline } from './main/syncPipeline';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }
  else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// IPC Handlers
ipcMain.handle('config:get', () => getConfig());

ipcMain.handle('config:set', (_event, config) => setConfig(config));

ipcMain.handle('dialog:selectDir', async () => {
  if (!mainWindow)
    return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('sync:start', async () => {
  const config = await getConfig();
  try {
    await runSyncPipeline(config, (message, level) => {
      mainWindow?.webContents.send('sync:log', message, level);
    });
    mainWindow?.webContents.send('sync:done', true);
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    mainWindow?.webContents.send('sync:log', `错误: ${message}`, 'error');
    mainWindow?.webContents.send('sync:done', false, message);
  }
});
