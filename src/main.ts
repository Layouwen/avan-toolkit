import type { CreateObsidianBlogPayload } from './main/blogManager';
import { spawn } from 'node:child_process';
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
import { validateObsidianBlogs } from './main/blogValidator';
import { getConfig, setConfig } from './main/configManager';
import {
  clearLogs,
  createModuleLogger,
  getLogFilePath,
  listLogs,
  subscribeLogs,
} from './main/logger';
import { closeQzoneSession, listQzoneShuoshuo, loadMoreQzoneShuoshuo, publishQzoneShuoshuo, testQzoneLogin } from './main/qzoneAutomation';
import { runSyncPipeline } from './main/syncPipeline';

interface AgentInvokeConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertInside(parent: string, target: string): void {
  const relative = path.relative(parent, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path is outside the Obsidian blog directory.');
  }
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function openMarkdownInEditor(absolutePath: string): Promise<void> {
  try {
    await shell.openExternal(`obsidian://open?path=${encodeURIComponent(absolutePath)}`);
    return;
  }
  catch {
    // Continue with Cursor fallback below.
  }

  try {
    await shell.openExternal(encodeURI(`cursor://file${absolutePath}`));
    return;
  }
  catch {
    // Continue with Cursor CLI fallback below.
  }

  try {
    await spawnDetached('cursor', [absolutePath]);
  }
  catch {
    const error = await shell.openPath(absolutePath);
    if (error) {
      throw new Error(error);
    }
  }
}

async function openMarkdownWithCommand(absolutePath: string, command: 'cursor' | 'code'): Promise<void> {
  try {
    await spawnDetached(command, [absolutePath]);
  }
  catch {
    const error = await shell.openPath(absolutePath);
    if (error) {
      throw new Error(`${command} 打开失败: ${error}`);
    }
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
const logSubscriptions = new Map<number, () => void>();

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

app.on('before-quit', () => {
  void closeQzoneSession();
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

ipcMain.handle('blogs:validate', async () => {
  const config = await getConfig();
  return validateObsidianBlogs(config);
});

ipcMain.handle('blogs:openInEditor', async (_event, relativePath: string) => {
  const config = await getConfig();
  const root = config.obsidianBlogDir.trim();
  if (!root) {
    throw new Error('Obsidian Blog directory is not configured.');
  }
  if (!relativePath || !relativePath.endsWith('.md')) {
    throw new Error('Only markdown blog files can be opened.');
  }

  const absolutePath = path.resolve(root, relativePath);
  assertInside(root, absolutePath);
  await openMarkdownInEditor(absolutePath);
});

ipcMain.handle('blogs:openValidationIssue', async (_event, source: 'obsidian' | 'hexo', absolutePath: string) => {
  const config = await getConfig();
  const obsidianRoot = config.obsidianBlogDir.trim();
  const hexoRoot = config.hexoBlogDir.trim();
  const resolvedPath = path.resolve(absolutePath);
  if (source !== 'obsidian' && source !== 'hexo') {
    throw new Error('Unknown blog validation issue source.');
  }
  if (!resolvedPath.endsWith('.md')) {
    throw new Error('Only markdown blog files can be opened.');
  }

  if (source === 'obsidian') {
    if (!obsidianRoot) {
      throw new Error('Obsidian Blog directory is not configured.');
    }
    assertInside(obsidianRoot, resolvedPath);
    await openMarkdownInEditor(resolvedPath);
    return;
  }

  if (!hexoRoot) {
    throw new Error('Hexo Blog directory is not configured.');
  }
  assertInside(hexoRoot, resolvedPath);
  await openMarkdownWithCommand(resolvedPath, config.hexoEditorCommand);
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
  const logger = createModuleLogger({
    module: 'blogSync',
    scope: 'sync',
    onLog: entry => mainWindow?.webContents.send('sync:log', entry.message, entry.level),
  });
  try {
    await runSyncPipeline(config, (message, level) => logger.log(level, message));
    logger.success('同步流程结束。');
    mainWindow?.webContents.send('sync:done', true);
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`错误: ${message}`);
    mainWindow?.webContents.send('sync:done', false, message);
  }
});

ipcMain.handle('logs:list', (_event, filters) => listLogs(filters));

ipcMain.handle('logs:clear', (_event, filters) => {
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

ipcMain.handle('agent:recommendActivity', async (_event, userInput: string, config: AgentInvokeConfig) => {
  const text = userInput.trim();
  if (!text) {
    throw new Error('Prompt cannot be empty.');
  }
  if (!config || !config.baseURL || !config.model || !config.apiKey) {
    throw new Error('Agent config baseURL/model/apiKey is required.');
  }

  const logger = createModuleLogger({ module: 'agent', scope: 'recommendActivity' });
  return runAgentRecommendation(text, config, logger);
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
  try {
    const config = await getConfig();
    return await listQzoneShuoshuo(config.qzone);
  }
  catch (error) {
    return {
      success: false,
      message: toErrorMessage(error),
      steps: [`执行失败: ${toErrorMessage(error)}`],
      items: [],
      hasMore: false,
    };
  }
});

ipcMain.handle('qzone:loadMoreShuoshuo', async () => {
  try {
    return await loadMoreQzoneShuoshuo();
  }
  catch (error) {
    return {
      success: false,
      message: toErrorMessage(error),
      steps: [`执行失败: ${toErrorMessage(error)}`],
      items: [],
      hasMore: false,
    };
  }
});
