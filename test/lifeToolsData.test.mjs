import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const require = createRequire(import.meta.url);

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function loadLifeToolsData() {
  const source = readProjectFile('src/features/life-tools/data.ts');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };

  // eslint-disable-next-line no-new-func
  const factory = new Function('require', 'exports', 'module', compiled);
  factory(require, module.exports, module);
  return module.exports;
}

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

function countdownEvent(overrides = {}) {
  return {
    id: overrides.id ?? 'event-1',
    title: overrides.title ?? 'Launch',
    date: overrides.date ?? '2026-07-01',
    recurrence: overrides.recurrence ?? 'none',
    pinned: overrides.pinned ?? false,
    notes: overrides.notes ?? 'Bring the checklist',
    category: overrides.category ?? 'work',
    reminderDaysBefore: Object.hasOwn(overrides, 'reminderDaysBefore')
      ? overrides.reminderDaysBefore
      : 3,
    createdAt: overrides.createdAt ?? '2026-06-24T01:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-24T01:00:00.000Z',
  };
}

function focusPreset(overrides = {}) {
  return {
    id: overrides.id ?? 'preset-1',
    title: overrides.title ?? 'Deep Work',
    focusMinutes: overrides.focusMinutes ?? 50,
    shortBreakMinutes: overrides.shortBreakMinutes ?? 10,
    longBreakMinutes: overrides.longBreakMinutes ?? 20,
    color: overrides.color ?? '#2f80ed',
    pinned: overrides.pinned ?? false,
    createdAt: overrides.createdAt ?? '2026-06-24T01:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-24T01:00:00.000Z',
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
    endsAt: overrides.endsAt ?? '2026-06-24T01:50:00.000Z',
    pausedAt: overrides.pausedAt,
    completedAt: overrides.completedAt,
  };
}

function assertDefaultPreset(preset) {
  assert.equal(preset.focusMinutes, 25);
  assert.equal(preset.shortBreakMinutes, 5);
  assert.equal(preset.longBreakMinutes, 15);
}

function formatDiagnostic(diagnostic) {
  const filePath = diagnostic.file ? path.relative(root, diagnostic.file.fileName) : 'unknown';
  const position = diagnostic.file && diagnostic.start !== undefined
    ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
    : null;
  const location = position ? `${filePath}:${position.line + 1}:${position.character + 1}` : filePath;
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  return `${location} TS${diagnostic.code}: ${message}`;
}

test('createDefaultLifeToolsData returns local-only empty data with fresh default presets', () => {
  const { createDefaultLifeToolsData } = loadLifeToolsData();

  const first = createDefaultLifeToolsData();
  const second = createDefaultLifeToolsData();

  assert.deepEqual(first.countdownEvents, []);
  assert.deepEqual(first.focusHistory, []);
  assert.equal(first.activeFocusSession, null);
  assert.equal(first.focusPresets.length >= 1, true);
  assertDefaultPreset(first.focusPresets[0]);

  assert.notStrictEqual(first.countdownEvents, second.countdownEvents);
  assert.notStrictEqual(first.focusPresets, second.focusPresets);
  assert.notStrictEqual(first.focusPresets[0], second.focusPresets[0]);

  first.focusPresets[0].title = 'Mutated';
  assert.notEqual(second.focusPresets[0].title, 'Mutated');
});

test('normalizeLifeToolsData tolerates unknown and partial older config values', () => {
  const { normalizeLifeToolsData } = loadLifeToolsData();
  const event = countdownEvent({ id: 'birthday', category: 'family', reminderDaysBefore: 7 });
  const activeSession = focusSession({ id: 'active' });
  const completedSession = focusSession({
    id: 'completed',
    completedAt: '2026-06-24T01:50:00.000Z',
  });

  assertDefaultPreset(normalizeLifeToolsData(undefined).focusPresets[0]);

  assert.deepEqual(
    normalizeLifeToolsData({
      countdownEvents: [event],
      activeFocusSession: activeSession,
      focusHistory: [completedSession],
    }),
    {
      countdownEvents: [event],
      focusPresets: normalizeLifeToolsData(undefined).focusPresets,
      activeFocusSession: activeSession,
      focusHistory: [completedSession],
    },
  );

  const normalizedInvalid = normalizeLifeToolsData({
    countdownEvents: 'old-shape',
    focusPresets: [],
    activeFocusSession: 'not-a-session',
    focusHistory: null,
  });

  assert.deepEqual(normalizedInvalid.countdownEvents, []);
  assert.deepEqual(normalizedInvalid.focusHistory, []);
  assert.equal(normalizedInvalid.activeFocusSession, null);
  assert.equal(normalizedInvalid.focusPresets.length, 1);
  assertDefaultPreset(normalizedInvalid.focusPresets[0]);
});

test('normalizeLifeToolsData filters invalid countdown events and keeps only valid optional fields', () => {
  const { normalizeLifeToolsData } = loadLifeToolsData();
  const validEvent = countdownEvent({
    id: 'launch',
    reminderDaysBefore: null,
  });
  const invalidOptionalEvent = {
    id: 'optionals',
    title: 'Bad optional fields',
    date: '2026-07-02',
    recurrence: 'yearly',
    pinned: 'yes',
    notes: 123,
    category: false,
    reminderDaysBefore: '7',
    createdAt: 123,
    updatedAt: false,
  };

  assert.equal(validEvent.reminderDaysBefore, null);

  const normalized = normalizeLifeToolsData({
    countdownEvents: [
      validEvent,
      { id: 'missing-required', title: 'Missing date', recurrence: 'none' },
      { id: 'bad-recurrence', title: 'Bad recurrence', date: '2026-07-01', recurrence: 'monthly' },
      invalidOptionalEvent,
    ],
  });

  assert.deepEqual(normalized.countdownEvents, [
    validEvent,
    {
      id: 'optionals',
      title: 'Bad optional fields',
      date: '2026-07-02',
      recurrence: 'yearly',
    },
  ]);
});

test('normalizeLifeToolsData filters invalid focus presets and restores the default when none remain', () => {
  const { normalizeLifeToolsData } = loadLifeToolsData();
  const validPreset = focusPreset({ id: 'valid' });
  const invalidOptionalPreset = {
    id: 'optionals',
    title: 'Bad optional fields',
    focusMinutes: 45,
    shortBreakMinutes: '5',
    longBreakMinutes: null,
    pinned: 'yes',
    color: 123,
    createdAt: false,
    updatedAt: 123,
  };

  const normalized = normalizeLifeToolsData({
    focusPresets: [
      validPreset,
      { id: 'missing-focus', title: 'Missing focus minutes' },
      { id: 'bad-focus', title: 'Bad focus minutes', focusMinutes: '25' },
      invalidOptionalPreset,
    ],
  });

  assert.deepEqual(normalized.focusPresets, [
    validPreset,
    {
      id: 'optionals',
      title: 'Bad optional fields',
      focusMinutes: 45,
    },
  ]);

  const fallback = normalizeLifeToolsData({
    focusPresets: [
      { id: 'missing-focus', title: 'Missing focus minutes' },
      { id: 'bad-focus', title: 'Bad focus minutes', focusMinutes: '25' },
    ],
  });

  assert.equal(fallback.focusPresets.length, 1);
  assertDefaultPreset(fallback.focusPresets[0]);
});

test('upsertCountdownEvent and removeCountdownEvent insert, update, and delete immutably', () => {
  const { createDefaultLifeToolsData, removeCountdownEvent, upsertCountdownEvent } = loadLifeToolsData();
  const data = createDefaultLifeToolsData();
  const launch = countdownEvent({ id: 'launch' });

  const inserted = upsertCountdownEvent(data, launch);

  assert.notStrictEqual(inserted, data);
  assert.notStrictEqual(inserted.countdownEvents, data.countdownEvents);
  assert.deepEqual(inserted.countdownEvents, [launch]);
  assert.deepEqual(data.countdownEvents, []);

  const updatedLaunch = countdownEvent({
    id: 'launch',
    title: 'Launch day',
    reminderDaysBefore: null,
  });
  assert.equal(updatedLaunch.reminderDaysBefore, null);
  const updated = upsertCountdownEvent(inserted, updatedLaunch);

  assert.deepEqual(updated.countdownEvents, [updatedLaunch]);
  assert.deepEqual(inserted.countdownEvents, [launch]);

  const removed = removeCountdownEvent(updated, 'launch');

  assert.notStrictEqual(removed.countdownEvents, updated.countdownEvents);
  assert.deepEqual(removed.countdownEvents, []);
  assert.deepEqual(updated.countdownEvents, [updatedLaunch]);
});

test('upsertFocusPreset and removeFocusPreset preserve at least one preset', () => {
  const { createDefaultLifeToolsData, removeFocusPreset, upsertFocusPreset } = loadLifeToolsData();
  const data = createDefaultLifeToolsData();
  const custom = focusPreset({ id: 'custom', title: 'Long Focus' });

  const inserted = upsertFocusPreset(data, custom);

  assert.notStrictEqual(inserted, data);
  assert.deepEqual(inserted.focusPresets.at(-1), custom);
  assert.equal(data.focusPresets.some(preset => preset.id === 'custom'), false);

  const updatedCustom = focusPreset({
    id: 'custom',
    title: 'Long Focus Updated',
    focusMinutes: 55,
  });
  const updated = upsertFocusPreset(inserted, updatedCustom);

  assert.deepEqual(updated.focusPresets.find(preset => preset.id === 'custom'), updatedCustom);
  assert.deepEqual(inserted.focusPresets.find(preset => preset.id === 'custom'), custom);

  const removedCustom = removeFocusPreset(updated, 'custom');
  assert.equal(removedCustom.focusPresets.some(preset => preset.id === 'custom'), false);
  assert.equal(removedCustom.focusPresets.length >= 1, true);

  const fallback = removeFocusPreset(
    {
      ...data,
      focusPresets: [custom],
    },
    'custom',
  );

  assert.equal(fallback.focusPresets.length, 1);
  assert.notEqual(fallback.focusPresets[0].id, 'custom');
  assertDefaultPreset(fallback.focusPresets[0]);
});

test('setActiveFocusSession and completeActiveFocusSession update active session and history immutably', () => {
  const {
    completeActiveFocusSession,
    createDefaultLifeToolsData,
    setActiveFocusSession,
  } = loadLifeToolsData();
  const data = createDefaultLifeToolsData();
  const activeSession = focusSession({ id: 'active' });

  const withActive = setActiveFocusSession(data, activeSession);

  assert.notStrictEqual(withActive, data);
  assert.deepEqual(withActive.activeFocusSession, activeSession);
  assert.equal(data.activeFocusSession, null);

  const previousHistory = focusSession({
    id: 'previous',
    completedAt: '2026-06-23T01:50:00.000Z',
  });
  const completed = completeActiveFocusSession(
    {
      ...withActive,
      focusHistory: [previousHistory],
    },
    '2026-06-24T01:50:00.000Z',
  );

  assert.equal(completed.activeFocusSession, null);
  assert.deepEqual(completed.focusHistory.map(session => session.id), ['previous', 'active']);
  assert.equal(completed.focusHistory[1].completedAt, '2026-06-24T01:50:00.000Z');
  assert.equal(withActive.activeFocusSession.completedAt, undefined);

  const cleared = setActiveFocusSession(withActive, null);
  assert.equal(cleared.activeFocusSession, null);
  assert.deepEqual(withActive.activeFocusSession, activeSession);

  assert.strictEqual(completeActiveFocusSession(data, '2026-06-24T01:50:00.000Z'), data);
});

test('Life Tools data shape is wired into shared types and Electron config schema', () => {
  const lifeToolsTypes = readProjectFile('src/features/life-tools/types.ts');
  const configManager = readProjectFile('src/main/configManager.ts');
  const sharedTypes = readProjectFile('src/shared/electronApiTypes.ts');

  assert.match(lifeToolsTypes, /category\?:\s*string;/);
  assert.match(lifeToolsTypes, /reminderDaysBefore\?:\s*number\s*\|\s*null;/);
  assert.match(lifeToolsTypes, /export\s+interface\s+LifeToolsData\b/);
  assert.match(lifeToolsTypes, /countdownEvents:\s*CountdownEvent\[\];/);
  assert.match(lifeToolsTypes, /focusPresets:\s*FocusPreset\[\];/);
  assert.match(lifeToolsTypes, /activeFocusSession:\s*FocusSession\s*\|\s*null;/);
  assert.match(lifeToolsTypes, /focusHistory:\s*FocusSession\[\];/);

  assert.match(sharedTypes, /export\s+type\s+LifeToolsData\s*=/);
  assert.match(sharedTypes, /lifeTools:\s*LifeToolsData;/);
  assert.match(configManager, /lifeTools:\s*LifeToolsData;/);
  assert.match(configManager, /lifeTools:\s*createDefaultLifeToolsData\(\)/);
  assert.match(configManager, /lifeTools:\s*normalizeLifeToolsData\(parsed\.lifeTools\)/);
});

test('main TypeScript project includes Life Tools pure data dependencies used by config manager', () => {
  const tsconfig = JSON.parse(readProjectFile('tsconfig.main.json'));
  const include = tsconfig.include ?? [];

  assert.equal(
    include.includes('src/features/life-tools/data.ts') || include.includes('src/features/life-tools/**/*.ts'),
    true,
  );
  assert.equal(
    include.includes('src/features/life-tools/types.ts') || include.includes('src/features/life-tools/**/*.ts'),
    true,
  );
});

test('normalizeLifeToolsData avoids direct Record-to-FocusSession casts', () => {
  const lifeToolsData = readProjectFile('src/features/life-tools/data.ts');

  assert.doesNotMatch(lifeToolsData, /activeFocusSession\s+as\s+FocusSession/);
});

test('Life Tools data helpers type-check as a focused TypeScript program', () => {
  const configPath = path.join(root, 'tsconfig.main.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
  const program = ts.createProgram(parsedConfig.fileNames, {
    ...parsedConfig.options,
    noEmit: true,
  });
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter(diagnostic => diagnostic.file?.fileName.includes('/src/features/life-tools/'));

  assert.deepEqual(diagnostics.map(formatDiagnostic), []);
});

test('blog sync config defaults and plainConfig preserve cloned Life Tools data', () => {
  const { createDefaultBlogSyncConfig, useBlogSyncConfig } = loadProjectTsModule(
    'src/features/blog-sync/composables/useBlogSyncConfig.ts',
  );

  const defaultConfig = createDefaultBlogSyncConfig();

  assert.equal(defaultConfig.lifeTools.countdownEvents.length, 0);
  assert.equal(defaultConfig.lifeTools.activeFocusSession, null);
  assertDefaultPreset(defaultConfig.lifeTools.focusPresets[0]);

  const { config, plainConfig } = useBlogSyncConfig();
  const lifeTools = {
    countdownEvents: [countdownEvent({ id: 'launch' })],
    focusPresets: [focusPreset({ id: 'custom' })],
    activeFocusSession: focusSession({ id: 'active' }),
    focusHistory: [
      focusSession({
        id: 'completed',
        completedAt: '2026-06-24T01:50:00.000Z',
      }),
    ],
  };
  config.value.lifeTools = lifeTools;

  const plain = plainConfig();

  assert.deepEqual(plain.lifeTools, lifeTools);
  assert.notStrictEqual(plain.lifeTools, lifeTools);
  assert.notStrictEqual(plain.lifeTools.countdownEvents, lifeTools.countdownEvents);
  assert.notStrictEqual(plain.lifeTools.focusPresets, lifeTools.focusPresets);
  assert.notStrictEqual(plain.lifeTools.activeFocusSession, lifeTools.activeFocusSession);
  assert.notStrictEqual(plain.lifeTools.focusHistory, lifeTools.focusHistory);
});

test('Qzone publisher default config and plainConfig preserve cloned Life Tools data', () => {
  const qzonePublisher = readProjectFile('src/views/QzonePublisher.vue');

  assert.match(qzonePublisher, /import\s+\{\s*createDefaultLifeToolsData,\s*normalizeLifeToolsData\s*\}\s+from\s+['"]\.\.\/features\/life-tools\/data['"]/);
  assert.match(qzonePublisher, /lifeTools:\s*createDefaultLifeToolsData\(\)/);
  assert.match(qzonePublisher, /lifeTools:\s*normalizeLifeToolsData\(toRaw\(current\.lifeTools\)\)/);
});
