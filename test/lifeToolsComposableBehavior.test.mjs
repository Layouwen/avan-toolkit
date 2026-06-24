import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadProjectTsModule(relativePath, options = {}) {
  const cache = options.cache ?? new Map();
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
    if (specifier === 'vue') {
      return options.vueMock ?? createVueMock();
    }
    if (specifier.startsWith('@/')) {
      return loadProjectTsModule(`src/${specifier.slice(2)}`, { ...options, cache });
    }
    if (specifier.startsWith('.')) {
      return loadProjectTsModule(resolveProjectTsModule(relativePath, specifier), { ...options, cache });
    }

    return require(specifier);
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

function createVueMock() {
  const unmountCallbacks = [];
  const ref = value => ({ value });

  return {
    unmountCallbacks,
    ref,
    shallowRef: ref,
    computed: getter => ({
      get value() {
        return getter();
      },
    }),
    readonly: value => value,
    onUnmounted(callback) {
      unmountCallbacks.push(callback);
    },
  };
}

function loadUseLifeTools(vueMock = createVueMock()) {
  return {
    vueMock,
    ...loadProjectTsModule('src/features/life-tools/composables/useLifeTools.ts', { vueMock }),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function countdownEvent(overrides = {}) {
  return {
    id: overrides.id ?? 'event-1',
    title: overrides.title ?? 'Launch',
    date: overrides.date ?? '2026-07-01',
    recurrence: overrides.recurrence ?? 'none',
    pinned: overrides.pinned ?? false,
    category: overrides.category,
    reminderDaysBefore: overrides.reminderDaysBefore,
    notes: overrides.notes,
    createdAt: overrides.createdAt ?? '2026-06-24T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-24T00:00:00.000Z',
  };
}

function focusPreset(overrides = {}) {
  return {
    id: overrides.id ?? 'deep-work',
    title: overrides.title ?? 'Deep Work',
    focusMinutes: overrides.focusMinutes ?? 1,
    shortBreakMinutes: overrides.shortBreakMinutes ?? 5,
    longBreakMinutes: overrides.longBreakMinutes ?? 15,
    pinned: overrides.pinned ?? false,
  };
}

function createRuntime(initialData) {
  let storedData = clone(initialData);
  const calls = [];

  return {
    calls,
    get storedData() {
      return storedData;
    },
    runtime: {
      persistence: {
        async load() {
          calls.push(['load']);
          return clone(storedData);
        },
        async save(data) {
          calls.push(['save', clone(data)]);
          storedData = clone(data);
        },
      },
      reminders: {
        async requestPermission() {
          calls.push(['requestPermission']);
          return true;
        },
        async scheduleFocusEnd(session) {
          calls.push(['scheduleFocusEnd', session.id]);
        },
        async cancelFocusEnd(sessionId) {
          calls.push(['cancelFocusEnd', sessionId]);
        },
      },
    },
  };
}

function createRuntimeWithFailingReminders(initialData, failingMethods) {
  const harness = createRuntime(initialData);
  const failing = new Set(failingMethods);

  for (const method of ['requestPermission', 'scheduleFocusEnd', 'cancelFocusEnd']) {
    const original = harness.runtime.reminders[method];
    harness.runtime.reminders[method] = async (...args) => {
      harness.calls.push([`${method}:attempt`, ...args.map(arg => (typeof arg === 'object' && arg ? arg.id : arg))]);
      if (failing.has(method)) {
        throw new Error(`${method} failed`);
      }
      return original(...args);
    };
  }

  return harness;
}

function callNames(harness) {
  return harness.calls.map(call => call[0]);
}

test('useLifeTools loads data, derives sorted countdown view models, and persists countdown edits', async () => {
  const { useLifeTools } = loadUseLifeTools();
  const runtimeHarness = createRuntime({
    countdownEvents: [
      countdownEvent({ id: 'later', title: 'Later', date: '2026-07-10' }),
      countdownEvent({ id: 'pinned', title: 'Pinned', date: '2026-08-01', pinned: true }),
      countdownEvent({ id: 'sooner', title: 'Sooner', date: '2026-06-25', category: 'Work' }),
    ],
    focusPresets: [focusPreset()],
    activeFocusSession: null,
    focusHistory: [],
  });

  const state = useLifeTools({
    runtime: runtimeHarness.runtime,
    now: () => new Date(2026, 5, 24, 12, 0, 0, 0),
    createId: () => 'event-new',
    tickMs: 0,
  });

  await state.loadLifeTools();

  assert.deepEqual(state.sortedCountdownEvents.value.map(item => item.event.id), ['pinned', 'sooner', 'later']);
  assert.deepEqual(state.sortedCountdownEvents.value[1].summary, {
    occurrenceDate: '2026-06-25',
    daysRemaining: 1,
    state: 'future',
  });

  await state.saveCountdownEvent({
    title: 'Mom Birthday',
    date: '2020-06-24',
    recurrence: 'yearly',
    category: 'Family',
    pinned: true,
    reminderDaysBefore: 7,
    notes: 'Call in the morning',
  });
  await state.saveCountdownEvent({
    id: 'sooner',
    title: 'Updated Soon',
    date: '2026-06-26',
    recurrence: 'none',
    category: '',
    pinned: false,
    reminderDaysBefore: null,
    notes: '',
  });
  await state.deleteCountdownEvent('later');

  assert.deepEqual(callNames(runtimeHarness), ['load', 'save', 'save', 'save']);
  assert.equal(runtimeHarness.storedData.countdownEvents.some(event => event.id === 'later'), false);
  assert.deepEqual(
    runtimeHarness.storedData.countdownEvents.find(event => event.id === 'event-new'),
    {
      id: 'event-new',
      title: 'Mom Birthday',
      date: '2020-06-24',
      recurrence: 'yearly',
      pinned: true,
      category: 'Family',
      reminderDaysBefore: 7,
      notes: 'Call in the morning',
      createdAt: '2026-06-24T04:00:00.000Z',
      updatedAt: '2026-06-24T04:00:00.000Z',
    },
  );
  assert.equal(runtimeHarness.storedData.countdownEvents.find(event => event.id === 'sooner').title, 'Updated Soon');
});

test('useLifeTools starts, schedules, completes, and cancels focus sessions from absolute timestamps', async () => {
  const { useLifeTools } = loadUseLifeTools();
  let now = new Date('2026-06-24T01:00:00.000Z');
  const runtimeHarness = createRuntime({
    countdownEvents: [],
    focusPresets: [focusPreset({ id: 'deep-work', focusMinutes: 1, pinned: true })],
    activeFocusSession: null,
    focusHistory: [],
  });

  const state = useLifeTools({
    runtime: runtimeHarness.runtime,
    now: () => now,
    tickMs: 0,
  });

  await state.loadLifeTools();
  state.selectFocusPreset('deep-work');
  await state.startFocusSession();

  const activeSessionId = state.activeFocusSession.value.id;
  assert.deepEqual(callNames(runtimeHarness), ['load', 'requestPermission', 'save', 'scheduleFocusEnd']);
  assert.equal(state.activeFocusSession.value.presetId, 'deep-work');
  assert.equal(state.focusStatus.value, 'running');
  assert.equal(state.focusRemainingSeconds.value, 60);

  now = new Date('2026-06-24T01:01:01.000Z');
  state.refreshNow();
  assert.equal(state.focusStatus.value, 'complete');
  assert.equal(state.focusRemainingSeconds.value, 0);

  await state.completeFocusSession();

  assert.equal(state.activeFocusSession.value, null);
  assert.equal(runtimeHarness.storedData.focusHistory.length, 1);
  assert.equal(runtimeHarness.storedData.focusHistory[0].id, activeSessionId);
  assert.equal(runtimeHarness.storedData.focusHistory[0].completedAt, '2026-06-24T01:01:01.000Z');
  assert.deepEqual(callNames(runtimeHarness), [
    'load',
    'requestPermission',
    'save',
    'scheduleFocusEnd',
    'cancelFocusEnd',
    'save',
  ]);

  now = new Date('2026-06-24T02:00:00.000Z');
  await state.startFocusSession();
  const cancelledSessionId = state.activeFocusSession.value.id;
  await state.cancelFocusSession();

  assert.equal(state.activeFocusSession.value, null);
  assert.equal(runtimeHarness.calls.some(call => call[0] === 'cancelFocusEnd' && call[1] === cancelledSessionId), true);
});

test('useLifeTools keeps focus persistence stable when reminder side effects fail', async () => {
  const { useLifeTools } = loadUseLifeTools();
  const runtimeHarness = createRuntimeWithFailingReminders({
    countdownEvents: [],
    focusPresets: [focusPreset({ id: 'deep-work', focusMinutes: 1 })],
    activeFocusSession: null,
    focusHistory: [],
  }, ['scheduleFocusEnd', 'cancelFocusEnd']);

  const state = useLifeTools({
    runtime: runtimeHarness.runtime,
    now: () => new Date('2026-06-24T01:00:00.000Z'),
    tickMs: 0,
  });

  await state.loadLifeTools();
  await state.startFocusSession();

  assert.equal(state.activeFocusSession.value?.presetId, 'deep-work');
  assert.equal(runtimeHarness.storedData.activeFocusSession?.presetId, 'deep-work');
  assert.match(state.errorMessage.value, /scheduleFocusEnd failed/);

  await state.completeFocusSession();

  assert.equal(state.activeFocusSession.value, null);
  assert.equal(runtimeHarness.storedData.activeFocusSession, null);
  assert.equal(runtimeHarness.storedData.focusHistory.length, 1);
  assert.match(state.errorMessage.value, /cancelFocusEnd failed/);
});
