import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadScreensaverManager({ now, config }) {
  const sourcePath = path.resolve('src/main/screensaverManager.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  let nextTimerId = 1;
  const timers = new Map();
  const ipcHandlers = new Map();
  const ipcListeners = new Map();

  class FakeBrowserWindow {
    static instances = [];

    constructor() {
      this.handlers = new Map();
      this.webContents = { openDevTools() {} };
      FakeBrowserWindow.instances.push(this);
    }

    loadFile() {}

    loadURL() {}

    on(eventName, handler) {
      this.handlers.set(eventName, handler);
    }

    close() {
      const handler = this.handlers.get('closed');
      if (handler) {
        handler();
      }
    }
  }

  const fakeElectron = {
    BrowserWindow: FakeBrowserWindow,
    ipcMain: {
      handle(channel, handler) {
        ipcHandlers.set(channel, handler);
      },
      on(channel, handler) {
        ipcListeners.set(channel, handler);
      },
    },
    screen: {
      getPrimaryDisplay() {
        return { workAreaSize: { width: 1280, height: 800 } };
      },
    },
  };

  const module = { exports: {} };
  const sandbox = {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: '',
    __dirname: path.resolve('dist'),
    clearInterval(id) {
      timers.delete(id);
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    console,
    Date: class extends Date {
      static now() {
        return now();
      }
    },
    exports: module.exports,
    module,
    require(id) {
      if (id === 'electron') {
        return fakeElectron;
      }
      if (id === './configManager') {
        return {
          getConfig: async () => config,
        };
      }
      return require(id);
    },
    setInterval(callback, ms) {
      const id = nextTimerId++;
      timers.set(id, { callback, ms, type: 'interval' });
      return id;
    },
    setTimeout(callback, ms) {
      const id = nextTimerId++;
      timers.set(id, { callback, ms, type: 'timeout' });
      return id;
    },
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

  return {
    exports: module.exports,
    fireTimer(id) {
      const timer = timers.get(id);
      assert.ok(timer, `timer ${id} should exist`);
      if (timer.type === 'timeout') {
        timers.delete(id);
      }
      timer.callback();
    },
    timerCount() {
      return timers.size;
    },
    timerIds() {
      return [...timers.keys()];
    },
  };
}

test('screensaver trigger countdown restarts only after the screensaver closes', async () => {
  let currentTime = 10_000;
  const intervalMs = 1_000;
  const config = {
    screensaver: {
      enabled: true,
      triggerIntervalMinutes: intervalMs / 60_000,
      countdownSeconds: 30,
      backgroundType: 'color',
      backgroundColor: '#1a3a2a',
      backgroundImagePath: '',
    },
  };
  const manager = loadScreensaverManager({
    config,
    now: () => currentTime,
  });

  const initialStatus = await manager.exports.getScreensaverStatus();
  assert.equal(initialStatus.nextTriggerAt, currentTime + intervalMs);
  assert.equal(manager.timerCount(), 1);

  currentTime += intervalMs;
  manager.fireTimer(manager.timerIds()[0]);
  await Promise.resolve();

  const openStatus = await manager.exports.getScreensaverStatus();
  assert.equal(openStatus.nextTriggerAt, null);
  assert.equal(openStatus.remainingSeconds, 0);
  assert.equal(manager.timerCount(), 0);

  currentTime += 4_000;
  manager.exports.closeScreensaver();

  const closedStatus = await manager.exports.getScreensaverStatus();
  assert.equal(closedStatus.nextTriggerAt, currentTime + intervalMs);
  assert.equal(closedStatus.remainingSeconds, 1);
  assert.equal(manager.timerCount(), 1);
});

test('manual screensaver trigger pauses the scheduled countdown until close', async () => {
  let currentTime = 20_000;
  const intervalMs = 1_000;
  const config = {
    screensaver: {
      enabled: true,
      triggerIntervalMinutes: intervalMs / 60_000,
      countdownSeconds: 30,
      backgroundType: 'color',
      backgroundColor: '#1a3a2a',
      backgroundImagePath: '',
    },
  };
  const manager = loadScreensaverManager({
    config,
    now: () => currentTime,
  });

  await manager.exports.getScreensaverStatus();
  assert.equal(manager.timerCount(), 1);

  currentTime += 300;
  manager.exports.triggerScreensaver();
  await Promise.resolve();

  const openStatus = await manager.exports.getScreensaverStatus();
  assert.equal(openStatus.nextTriggerAt, null);
  assert.equal(openStatus.remainingSeconds, 0);
  assert.equal(manager.timerCount(), 0);

  currentTime += 2_000;
  manager.exports.closeScreensaver();

  const closedStatus = await manager.exports.getScreensaverStatus();
  assert.equal(closedStatus.nextTriggerAt, currentTime + intervalMs);
  assert.equal(closedStatus.remainingSeconds, 1);
  assert.equal(manager.timerCount(), 1);
});
