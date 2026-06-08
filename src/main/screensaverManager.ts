import type { AppConfig } from './configManager';
import path from 'node:path';
import { BrowserWindow, ipcMain, screen } from 'electron';
import { getConfig } from './configManager';

let screensaverWindow: BrowserWindow | null = null;
let triggerTimer: NodeJS.Timeout | null = null;

function createScreensaverWindow(_config: AppConfig['screensaver']) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  screensaverWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 加载专门的 Vue 屏保入口
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    url.pathname = '/screensaver-vue.html';
    screensaverWindow.loadURL(url.toString());
  }
  else {
    const indexPath = path.join(__dirname, `../renderer/screensaver_window/index.html`);
    screensaverWindow.loadFile(indexPath);
  }

  // 开发模式下打开 DevTools 方便调试
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    screensaverWindow.webContents.openDevTools();
  }

  screensaverWindow.on('closed', () => {
    screensaverWindow = null;
  });

  // 监听屏保页面的关闭请求
  ipcMain.on('screensaver:request-close', () => {
    closeScreensaver();
  });
}

function startTriggerTimer() {
  stopTriggerTimer();

  void getConfig().then((config) => {
    if (config.screensaver.enabled && config.screensaver.triggerIntervalMinutes > 0) {
      const intervalMs = config.screensaver.triggerIntervalMinutes * 60 * 1000;
      triggerTimer = setInterval(() => {
        triggerScreensaver();
      }, intervalMs);
    }
  });
}

function stopTriggerTimer() {
  if (triggerTimer) {
    clearInterval(triggerTimer);
    triggerTimer = null;
  }
}

export function triggerScreensaver() {
  if (screensaverWindow) {
    return;
  }
  void getConfig().then((config) => {
    createScreensaverWindow(config.screensaver);
  });
}

export function closeScreensaver() {
  if (screensaverWindow) {
    screensaverWindow.close();
    screensaverWindow = null;
  }
}

export function updateScreensaverConfig() {
  startTriggerTimer();
}

export function initializeScreensaver() {
  startTriggerTimer();

  ipcMain.handle('screensaver:trigger', () => triggerScreensaver());
  ipcMain.handle('screensaver:close', () => closeScreensaver());
  ipcMain.handle('screensaver:getConfig', () => getConfig().then(c => c.screensaver));
}
