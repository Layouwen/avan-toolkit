import type { CreateObsidianBlogPayload } from './main/blogManager';
import path from 'node:path';
import process from 'node:process';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import started from 'electron-squirrel-startup';
import { runAgentRecommendation } from './main/agentDemo';
import {
  createObsidianBlog,
  deleteObsidianBlog,
  listObsidianBlogs,
  renameObsidianBlogFileName,
  renameObsidianBlogTitle,
} from './main/blogManager';
import { getConfig, setConfig } from './main/configManager';
import { listQzoneShuoshuo, publishQzoneShuoshuo, testQzoneLogin } from './main/qzoneAutomation';
import { runSyncPipeline } from './main/syncPipeline';

interface AgentInvokeConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

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
ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url));

ipcMain.handle('config:get', () => getConfig());

ipcMain.handle('config:set', (_event, config) => setConfig(config));

ipcMain.handle('blogs:list', async () => {
  const config = await getConfig();
  return listObsidianBlogs(config);
});

ipcMain.handle('blogs:create', async (_event, payload: CreateObsidianBlogPayload) => {
  const config = await getConfig();
  return createObsidianBlog(config, payload);
});

ipcMain.handle('blogs:delete', async (_event, relativePath: string) => {
  const config = await getConfig();
  await deleteObsidianBlog(config, relativePath);
});

ipcMain.handle('blogs:renameTitle', async (_event, relativePath: string, title: string) => {
  const config = await getConfig();
  return renameObsidianBlogTitle(config, relativePath, title);
});

ipcMain.handle('blogs:renameFileName', async (_event, relativePath: string, fileName: string) => {
  const config = await getConfig();
  return renameObsidianBlogFileName(config, relativePath, fileName);
});

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

ipcMain.handle('agent:recommendActivity', async (_event, userInput: string, config: AgentInvokeConfig) => {
  const text = userInput.trim();
  if (!text) {
    throw new Error('Prompt cannot be empty.');
  }
  if (!config || !config.baseURL || !config.model || !config.apiKey) {
    throw new Error('Agent config baseURL/model/apiKey is required.');
  }

  return runAgentRecommendation(text, config);
});

ipcMain.handle('qzone:testLogin', async () => {
  const config = await getConfig();
  return testQzoneLogin(config.qzone);
});

ipcMain.handle('qzone:publishShuoshuo', async (_event, content: string) => {
  const config = await getConfig();
  return publishQzoneShuoshuo(config.qzone, content);
});

ipcMain.handle('qzone:listShuoshuo', async () => {
  const config = await getConfig();
  return listQzoneShuoshuo(config.qzone);
});
