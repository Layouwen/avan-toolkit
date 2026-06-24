import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadProjectTsModule(relativePath, cache = new Map()) {
  if (cache.has(relativePath)) {
    return cache.get(relativePath).exports;
  }

  const absolutePath = path.join(root, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  cache.set(relativePath, module);

  function localRequire(specifier) {
    if (!specifier.startsWith('.')) {
      return require(specifier);
    }

    return loadProjectTsModule(resolveProjectTsModule(relativePath, specifier), cache);
  }

  // eslint-disable-next-line no-new-func
  const factory = new Function('require', 'exports', 'module', compiled);
  factory(localRequire, module.exports, module);
  return module.exports;
}

function loadLifeToolsRuntime() {
  return loadProjectTsModule('src/features/life-tools/runtime.ts');
}

function resolveProjectTsModule(fromRelativePath, specifier) {
  const fromDir = path.dirname(path.join(root, fromRelativePath));
  const resolvedBase = path.resolve(fromDir, specifier);
  const candidates = [
    resolvedBase,
    `${resolvedBase}.ts`,
    `${resolvedBase}.mts`,
    `${resolvedBase}.js`,
    `${resolvedBase}.mjs`,
    path.join(resolvedBase, 'index.ts'),
  ];
  const match = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!match) {
    throw new Error(`Unable to resolve ${specifier} from ${fromRelativePath}`);
  }
  return path.relative(root, match);
}

function appConfig(overrides = {}) {
  return {
    obsidianBlogDir: '/obsidian',
    hexoBlogDir: '/hexo',
    hexoEditorCommand: 'cursor',
    locale: 'zh-CN',
    agent: {
      baseURL: 'http://localhost:11434/v1',
      model: 'qwen2.5:1.5b',
      apiKey: 'ollama',
    },
    qzone: {
      loginMode: 'qr',
      qqNumber: '',
      qqPassword: '',
      playwrightProfileDir: '/profile',
    },
    screensaver: {
      enabled: true,
      triggerIntervalMinutes: 45,
      countdownSeconds: 30,
      backgroundType: 'color',
      backgroundColor: '#1a3a2a',
      backgroundImagePath: '',
    },
    editorExtensions: {
      vsixDownloadDir: '',
    },
    lifeTools: undefined,
    customTopLevel: {
      keep: true,
    },
    ...overrides,
  };
}

function countdownEvent(overrides = {}) {
  return {
    id: overrides.id ?? 'event-1',
    title: overrides.title ?? 'Launch',
    date: overrides.date ?? '2026-07-01',
    recurrence: overrides.recurrence ?? 'none',
  };
}

function focusPreset(overrides = {}) {
  return {
    id: overrides.id ?? 'preset-1',
    title: overrides.title ?? 'Deep Work',
    focusMinutes: overrides.focusMinutes ?? 50,
    shortBreakMinutes: overrides.shortBreakMinutes ?? 10,
    longBreakMinutes: overrides.longBreakMinutes ?? 20,
  };
}

function focusSession(overrides = {}) {
  return {
    id: overrides.id ?? 'session-1',
    presetId: overrides.presetId ?? 'preset-1',
    presetTitle: overrides.presetTitle ?? 'Deep Work',
    focusMinutes: overrides.focusMinutes ?? 50,
    phase: overrides.phase ?? 'focus',
    startedAt: overrides.startedAt ?? '2026-06-24T01:00:00.000Z',
    endsAt: overrides.endsAt ?? '2026-06-24T01:05:00.000Z',
  };
}

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createElectronAPI(initialConfig) {
  const calls = {
    getConfig: 0,
    setConfig: [],
  };
  let config = initialConfig;

  return {
    calls,
    async getConfig() {
      calls.getConfig += 1;
      return config;
    },
    async setConfig(nextConfig) {
      calls.setConfig.push(nextConfig);
      config = nextConfig;
    },
  };
}

function createTimerHarness() {
  let nextId = 1;
  const scheduled = new Map();
  const cleared = [];

  return {
    scheduled,
    cleared,
    setTimeout(callback, delay) {
      const id = nextId;
      nextId += 1;
      scheduled.set(id, {
        callback() {
          scheduled.delete(id);
          callback();
        },
        delay,
      });
      return id;
    },
    clearTimeout(id) {
      cleared.push(id);
      scheduled.delete(id);
    },
  };
}

function createNotificationHarness({
  permission = 'default',
  requestResult = 'granted',
} = {}) {
  const notifications = [];

  class FakeNotification {
    static permission = permission;
    static requestPermissionCalls = 0;

    static async requestPermission() {
      FakeNotification.requestPermissionCalls += 1;
      FakeNotification.permission = requestResult;
      return requestResult;
    }

    constructor(title, options) {
      notifications.push({ title, options });
    }
  }

  return {
    Notification: FakeNotification,
    notifications,
  };
}

test('Electron persistence loads normalized config data and saves without dropping unrelated config fields', async () => {
  const { createElectronConfigLifeToolsPersistence } = loadLifeToolsRuntime();
  const missingLifeToolsAPI = createElectronAPI(appConfig());
  const missingLifeToolsPersistence = createElectronConfigLifeToolsPersistence(missingLifeToolsAPI);
  const electronAPI = createElectronAPI(appConfig({
    locale: 'en',
    lifeTools: {
      countdownEvents: [countdownEvent({ id: 'launch' }), { title: 'missing id' }],
      focusPresets: [],
      activeFocusSession: 'bad-session',
      focusHistory: 'bad-history',
    },
  }));
  const persistence = createElectronConfigLifeToolsPersistence(electronAPI);

  const missingLoaded = await missingLifeToolsPersistence.load();
  const loaded = await persistence.load();

  assert.deepEqual(missingLoaded.countdownEvents, []);
  assert.equal(missingLoaded.focusPresets[0].focusMinutes, 25);
  assert.deepEqual(loaded.countdownEvents, [countdownEvent({ id: 'launch' })]);
  assert.equal(loaded.focusPresets.length, 1);
  assert.equal(loaded.focusPresets[0].focusMinutes, 25);
  assert.equal(loaded.activeFocusSession, null);
  assert.deepEqual(loaded.focusHistory, []);

  await persistence.save({
    countdownEvents: [countdownEvent({ id: 'saved' })],
    focusPresets: [],
    activeFocusSession: null,
    focusHistory: [],
  });

  assert.equal(electronAPI.calls.getConfig, 2);
  assert.equal(electronAPI.calls.setConfig.length, 1);
  assert.equal(electronAPI.calls.setConfig[0].locale, 'en');
  assert.deepEqual(electronAPI.calls.setConfig[0].customTopLevel, { keep: true });
  assert.deepEqual(electronAPI.calls.setConfig[0].lifeTools.countdownEvents, [countdownEvent({ id: 'saved' })]);
  assert.equal(electronAPI.calls.setConfig[0].lifeTools.focusPresets[0].focusMinutes, 25);
});

test('localStorage persistence returns defaults for missing or invalid JSON and saves normalized data', async () => {
  const { LIFE_TOOLS_LOCAL_STORAGE_KEY, createLocalStorageLifeToolsPersistence } = loadLifeToolsRuntime();
  const storage = createMemoryStorage();
  const persistence = createLocalStorageLifeToolsPersistence(storage);

  const missing = await persistence.load();

  assert.deepEqual(missing.countdownEvents, []);
  assert.equal(missing.focusPresets[0].focusMinutes, 25);

  storage.setItem(LIFE_TOOLS_LOCAL_STORAGE_KEY, '{bad json');
  const invalidJson = await persistence.load();

  assert.deepEqual(invalidJson.countdownEvents, []);
  assert.equal(invalidJson.focusPresets[0].focusMinutes, 25);

  await persistence.save({
    countdownEvents: [countdownEvent({ id: 'stored' }), { title: 'bad' }],
    focusPresets: [],
    activeFocusSession: focusSession({ id: 'active' }),
    focusHistory: [],
  });

  const saved = JSON.parse(storage.getItem(LIFE_TOOLS_LOCAL_STORAGE_KEY));
  assert.deepEqual(saved.countdownEvents, [countdownEvent({ id: 'stored' })]);
  assert.equal(saved.focusPresets[0].focusMinutes, 25);
  assert.deepEqual(saved.activeFocusSession, focusSession({ id: 'active' }));
});

test('web notification scheduler requests permission only when needed', async () => {
  const { createWebNotificationReminderScheduler } = loadLifeToolsRuntime();
  const granted = createNotificationHarness({ permission: 'granted' });
  const defaultPermission = createNotificationHarness({ permission: 'default', requestResult: 'granted' });
  const denied = createNotificationHarness({ permission: 'denied' });

  assert.equal(await createWebNotificationReminderScheduler({ Notification: granted.Notification }).requestPermission(), true);
  assert.equal(granted.Notification.requestPermissionCalls, 0);

  assert.equal(
    await createWebNotificationReminderScheduler({ Notification: defaultPermission.Notification }).requestPermission(),
    true,
  );
  assert.equal(defaultPermission.Notification.requestPermissionCalls, 1);

  assert.equal(await createWebNotificationReminderScheduler({ Notification: denied.Notification }).requestPermission(), false);
  assert.equal(denied.Notification.requestPermissionCalls, 0);
});

test('web notification scheduler uses absolute endsAt timers, fires notifications, and cancels by session id', async () => {
  const { createWebNotificationReminderScheduler } = loadLifeToolsRuntime();
  const timers = createTimerHarness();
  const notification = createNotificationHarness({ permission: 'granted' });
  const scheduler = createWebNotificationReminderScheduler({
    Notification: notification.Notification,
    clearTimeout: timers.clearTimeout,
    now: () => Date.parse('2026-06-24T01:00:00.000Z'),
    setTimeout: timers.setTimeout,
  });

  await scheduler.scheduleFocusEnd(focusSession({
    id: 'focus-1',
    presetTitle: 'Deep Work',
    endsAt: '2026-06-24T01:05:00.000Z',
  }));

  assert.equal(timers.scheduled.size, 1);
  const firstTimer = [...timers.scheduled.entries()][0];
  assert.equal(firstTimer[1].delay, 5 * 60 * 1000);

  await scheduler.scheduleFocusEnd(focusSession({
    id: 'focus-1',
    presetTitle: 'Deep Work',
    endsAt: '2026-06-24T01:10:00.000Z',
  }));

  assert.deepEqual(timers.cleared, [firstTimer[0]]);
  assert.equal(timers.scheduled.size, 1);
  const secondTimer = [...timers.scheduled.entries()][0];
  assert.equal(secondTimer[1].delay, 10 * 60 * 1000);

  secondTimer[1].callback();

  assert.equal(notification.notifications.length, 1);
  assert.equal(notification.notifications[0].title, 'Focus session complete');
  assert.match(notification.notifications[0].options.body, /Deep Work/);
  assert.equal(timers.scheduled.size, 0);

  await scheduler.scheduleFocusEnd(focusSession({
    id: 'focus-2',
    presetTitle: 'Writing',
    endsAt: '2026-06-24T01:03:00.000Z',
  }));
  const thirdTimer = [...timers.scheduled.entries()][0];

  await scheduler.cancelFocusEnd('focus-2');

  assert.deepEqual(timers.cleared, [firstTimer[0], thirdTimer[0]]);
  assert.equal(timers.scheduled.size, 0);
});

test('web notification scheduler is a no-op when browser notifications are unavailable or denied', async () => {
  const { createWebNotificationReminderScheduler } = loadLifeToolsRuntime();
  const unavailableTimers = createTimerHarness();
  const deniedTimers = createTimerHarness();
  const denied = createNotificationHarness({ permission: 'denied' });

  const unavailableScheduler = createWebNotificationReminderScheduler({
    Notification: undefined,
    clearTimeout: unavailableTimers.clearTimeout,
    setTimeout: unavailableTimers.setTimeout,
  });
  const deniedScheduler = createWebNotificationReminderScheduler({
    Notification: denied.Notification,
    clearTimeout: deniedTimers.clearTimeout,
    setTimeout: deniedTimers.setTimeout,
  });

  assert.equal(await unavailableScheduler.requestPermission(), false);

  await unavailableScheduler.scheduleFocusEnd(focusSession());
  await deniedScheduler.scheduleFocusEnd(focusSession());

  assert.equal(unavailableTimers.scheduled.size, 0);
  assert.equal(deniedTimers.scheduled.size, 0);
});

test('runtime factory chooses Electron persistence when electronAPI exists and fallback persistence otherwise', async () => {
  const { LIFE_TOOLS_LOCAL_STORAGE_KEY, createLifeToolsRuntime } = loadLifeToolsRuntime();
  const electronAPI = createElectronAPI(appConfig({
    lifeTools: {
      countdownEvents: [countdownEvent({ id: 'electron' })],
      focusPresets: [focusPreset()],
      activeFocusSession: null,
      focusHistory: [],
    },
  }));
  const electronRuntime = createLifeToolsRuntime({
    Notification: undefined,
    window: { electronAPI },
  });

  assert.deepEqual((await electronRuntime.persistence.load()).countdownEvents, [countdownEvent({ id: 'electron' })]);
  assert.equal(electronAPI.calls.getConfig, 1);

  const storage = createMemoryStorage({
    [LIFE_TOOLS_LOCAL_STORAGE_KEY]: JSON.stringify({
      countdownEvents: [countdownEvent({ id: 'fallback' })],
      focusPresets: [focusPreset()],
      activeFocusSession: null,
      focusHistory: [],
    }),
  });
  const fallbackRuntime = createLifeToolsRuntime({
    Notification: undefined,
    localStorage: storage,
    window: {},
  });

  assert.deepEqual((await fallbackRuntime.persistence.load()).countdownEvents, [countdownEvent({ id: 'fallback' })]);
});
