import type { AppConfig } from './configManager';
import path from 'node:path';
import { BrowserWindow, ipcMain, screen } from 'electron';
import { getConfig } from './configManager';

let screensaverWindow: BrowserWindow | null = null;
let triggerTimer: NodeJS.Timeout | null = null;
let nextTriggerAt: number | null = null;
let screensaverOpening = false;

export interface ScreensaverStatus {
  enabled: boolean;
  intervalSeconds: number;
  nextTriggerAt: number | null;
  remainingSeconds: number;
}

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
    scheduleTriggerAfterScreensaverClosed();
  });
}

function scheduleNextTrigger(config: AppConfig) {
  stopTriggerTimer();

  if (config.screensaver.enabled && config.screensaver.triggerIntervalMinutes > 0) {
    const intervalMs = config.screensaver.triggerIntervalMinutes * 60 * 1000;
    nextTriggerAt = Date.now() + intervalMs;
    triggerTimer = setTimeout(() => {
      triggerTimer = null;
      nextTriggerAt = null;
      triggerScreensaver();
    }, intervalMs);
  }
}

function startTriggerTimer() {
  void getConfig().then((config) => {
    if (screensaverWindow || screensaverOpening) {
      stopTriggerTimer();
      return;
    }
    scheduleNextTrigger(config);
  });
}

function stopTriggerTimer() {
  if (triggerTimer) {
    clearTimeout(triggerTimer);
    triggerTimer = null;
  }
  nextTriggerAt = null;
}

function scheduleTriggerAfterScreensaverClosed() {
  void getConfig().then((config) => {
    if (screensaverWindow || screensaverOpening) {
      return;
    }
    scheduleNextTrigger(config);
  });
}

export function triggerScreensaver() {
  if (screensaverWindow || screensaverOpening) {
    return;
  }
  screensaverOpening = true;
  stopTriggerTimer();
  void getConfig().then((config) => {
    createScreensaverWindow(config.screensaver);
  }).finally(() => {
    screensaverOpening = false;
  });
}

export function closeScreensaver() {
  if (screensaverWindow) {
    screensaverWindow.close();
  }
}

export function updateScreensaverConfig() {
  startTriggerTimer();
}

export async function getScreensaverStatus(): Promise<ScreensaverStatus> {
  const config = await getConfig();
  const enabled = config.screensaver.enabled && config.screensaver.triggerIntervalMinutes > 0;
  const intervalSeconds = config.screensaver.triggerIntervalMinutes * 60;

  if (enabled && !triggerTimer) {
    if (screensaverWindow || screensaverOpening) {
      return {
        enabled,
        intervalSeconds,
        nextTriggerAt: null,
        remainingSeconds: 0,
      };
    }
    scheduleNextTrigger(config);
  }

  const remainingSeconds = enabled && nextTriggerAt
    ? Math.max(0, Math.ceil((nextTriggerAt - Date.now()) / 1000))
    : 0;

  return {
    enabled,
    intervalSeconds,
    nextTriggerAt: enabled ? nextTriggerAt : null,
    remainingSeconds,
  };
}

export function initializeScreensaver() {
  startTriggerTimer();

  ipcMain.on('screensaver:request-close', () => {
    closeScreensaver();
  });
  ipcMain.handle('screensaver:trigger', () => triggerScreensaver());
  ipcMain.handle('screensaver:close', () => closeScreensaver());
  ipcMain.handle('screensaver:getConfig', () => getConfig().then(c => c.screensaver));
  ipcMain.handle('screensaver:getStatus', () => getScreensaverStatus());
}
