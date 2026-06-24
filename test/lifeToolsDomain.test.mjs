import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadLifeToolsUtils() {
  const source = fs.readFileSync(path.join(root, 'src/features/life-tools/utils.ts'), 'utf8');
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

function localNoon(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function countdownEvent(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    date: overrides.date,
    recurrence: overrides.recurrence ?? 'none',
    pinned: overrides.pinned ?? false,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

test('getCountdownOccurrence keeps one-time dates and rolls yearly dates to the next local occurrence', () => {
  const { getCountdownOccurrence } = loadLifeToolsUtils();
  const now = localNoon('2026-06-24');

  assert.equal(
    getCountdownOccurrence(countdownEvent({ id: 'launch', date: '2026-07-01' }), now),
    '2026-07-01',
  );
  assert.equal(
    getCountdownOccurrence(
      countdownEvent({ id: 'anniversary-today', date: '2020-06-24', recurrence: 'yearly' }),
      now,
    ),
    '2026-06-24',
  );
  assert.equal(
    getCountdownOccurrence(
      countdownEvent({ id: 'anniversary-future', date: '2020-07-01', recurrence: 'yearly' }),
      now,
    ),
    '2026-07-01',
  );
  assert.equal(
    getCountdownOccurrence(
      countdownEvent({ id: 'anniversary-passed', date: '2020-06-01', recurrence: 'yearly' }),
      now,
    ),
    '2027-06-01',
  );
});

test('getCountdownOccurrence maps leap-day yearly anniversaries to Feb 28 in non-leap years', () => {
  const { getCountdownOccurrence } = loadLifeToolsUtils();
  const leapDay = countdownEvent({ id: 'leap', date: '2024-02-29', recurrence: 'yearly' });

  assert.equal(getCountdownOccurrence(leapDay, localNoon('2025-02-27')), '2025-02-28');
  assert.equal(getCountdownOccurrence(leapDay, localNoon('2025-03-01')), '2026-02-28');
  assert.equal(getCountdownOccurrence(leapDay, localNoon('2028-02-28')), '2028-02-29');
});

test('getCountdownSummary reports occurrence date, whole local days remaining, and state', () => {
  const { getCountdownSummary } = loadLifeToolsUtils();
  const now = localNoon('2026-06-24');

  assert.deepEqual(getCountdownSummary(countdownEvent({ id: 'today', date: '2026-06-24' }), now), {
    occurrenceDate: '2026-06-24',
    daysRemaining: 0,
    state: 'today',
  });
  assert.deepEqual(getCountdownSummary(countdownEvent({ id: 'future', date: '2026-07-01' }), now), {
    occurrenceDate: '2026-07-01',
    daysRemaining: 7,
    state: 'future',
  });
  assert.deepEqual(getCountdownSummary(countdownEvent({ id: 'past', date: '2026-06-20' }), now), {
    occurrenceDate: '2026-06-20',
    daysRemaining: -4,
    state: 'past',
  });
  assert.deepEqual(
    getCountdownSummary(
      countdownEvent({ id: 'yearly-passed', date: '2020-06-01', recurrence: 'yearly' }),
      now,
    ),
    {
      occurrenceDate: '2027-06-01',
      daysRemaining: 342,
      state: 'future',
    },
  );
});

test('countdown helpers reject impossible ISO date-only strings', () => {
  const { getCountdownOccurrence, getCountdownSummary } = loadLifeToolsUtils();
  const impossibleDate = countdownEvent({ id: 'impossible', date: '2026-02-31' });

  assert.throws(
    () => getCountdownOccurrence(impossibleDate, localNoon('2026-01-01')),
    /Invalid ISO date string/,
  );
  assert.throws(
    () => getCountdownSummary(impossibleDate, localNoon('2026-01-01')),
    /Invalid ISO date string/,
  );
});

test('sortCountdownEvents sorts pinned items first, then days remaining, then title without mutating input', () => {
  const { sortCountdownEvents } = loadLifeToolsUtils();
  const now = localNoon('2026-06-24');
  const events = [
    countdownEvent({ id: 'later', title: 'Later', date: '2026-07-10' }),
    countdownEvent({ id: 'alpha', title: 'Alpha', date: '2026-07-01' }),
    countdownEvent({ id: 'pinned-later', title: 'Pinned Later', date: '2026-08-01', pinned: true }),
    countdownEvent({ id: 'beta', title: 'Beta', date: '2026-07-01' }),
    countdownEvent({ id: 'pinned-sooner', title: 'Pinned Sooner', date: '2026-06-25', pinned: true }),
  ];

  assert.deepEqual(sortCountdownEvents(events, now).map(event => event.id), [
    'pinned-sooner',
    'pinned-later',
    'alpha',
    'beta',
    'later',
  ]);
  assert.deepEqual(events.map(event => event.id), ['later', 'alpha', 'pinned-later', 'beta', 'pinned-sooner']);
});

test('createFocusSession stores absolute start and end timestamps based on focus minutes', () => {
  const { createFocusSession } = loadLifeToolsUtils();

  assert.deepEqual(
    createFocusSession({ id: 'deep-work', title: 'Deep Work', focusMinutes: 25 }, '2026-06-24T01:00:00.000Z'),
    {
      id: 'deep-work-1782262800000',
      presetId: 'deep-work',
      presetTitle: 'Deep Work',
      focusMinutes: 25,
      phase: 'focus',
      startedAt: '2026-06-24T01:00:00.000Z',
      endsAt: '2026-06-24T01:25:00.000Z',
    },
  );
});

test('getFocusPhaseMinutes returns configured phase durations and createFocusSession honors the phase', () => {
  const { createFocusSession, getFocusPhaseMinutes } = loadLifeToolsUtils();
  const preset = {
    id: 'deep-work',
    title: 'Deep Work',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
  };

  assert.equal(getFocusPhaseMinutes(preset, 'focus'), 25);
  assert.equal(getFocusPhaseMinutes(preset, 'shortBreak'), 5);
  assert.equal(getFocusPhaseMinutes(preset, 'longBreak'), 15);
  assert.deepEqual(createFocusSession(preset, '2026-06-24T01:00:00.000Z', 'shortBreak'), {
    id: 'deep-work-1782262800000',
    presetId: 'deep-work',
    presetTitle: 'Deep Work',
    focusMinutes: 25,
    phase: 'shortBreak',
    startedAt: '2026-06-24T01:00:00.000Z',
    endsAt: '2026-06-24T01:05:00.000Z',
  });
});

test('getFocusSessionStatus derives idle, running, complete, and paused from absolute timestamps', () => {
  const { getFocusSessionStatus } = loadLifeToolsUtils();
  const runningSession = {
    id: 'session',
    presetId: 'deep-work',
    presetTitle: 'Deep Work',
    focusMinutes: 25,
    phase: 'focus',
    startedAt: '2026-06-24T01:00:00.000Z',
    endsAt: '2026-06-24T01:25:00.000Z',
  };

  assert.equal(getFocusSessionStatus(undefined, '2026-06-24T01:05:00.000Z'), 'idle');
  assert.equal(getFocusSessionStatus(runningSession, '2026-06-24T01:24:59.000Z'), 'running');
  assert.equal(getFocusSessionStatus(runningSession, '2026-06-24T01:25:00.000Z'), 'complete');
  assert.equal(
    getFocusSessionStatus({ ...runningSession, pausedAt: '2026-06-24T01:10:00.000Z' }, '2026-06-24T02:00:00.000Z'),
    'paused',
  );
});

test('getFocusSessionStatus treats completedAt as terminal over pausedAt', () => {
  const { getFocusSessionStatus } = loadLifeToolsUtils();
  const completedPausedSession = {
    id: 'session',
    presetId: 'deep-work',
    presetTitle: 'Deep Work',
    focusMinutes: 25,
    phase: 'focus',
    startedAt: '2026-06-24T01:00:00.000Z',
    endsAt: '2026-06-24T01:25:00.000Z',
    pausedAt: '2026-06-24T01:10:00.000Z',
    completedAt: '2026-06-24T01:12:00.000Z',
  };

  assert.equal(getFocusSessionStatus(completedPausedSession, '2026-06-24T01:12:00.000Z'), 'complete');
});

test('getFocusRemainingSeconds returns paused remaining time and clamps completed sessions at zero', () => {
  const { getFocusRemainingSeconds } = loadLifeToolsUtils();
  const runningSession = {
    id: 'session',
    presetId: 'deep-work',
    presetTitle: 'Deep Work',
    focusMinutes: 25,
    phase: 'focus',
    startedAt: '2026-06-24T01:00:00.000Z',
    endsAt: '2026-06-24T01:25:00.000Z',
  };

  assert.equal(getFocusRemainingSeconds(undefined, '2026-06-24T01:05:00.000Z'), 0);
  assert.equal(getFocusRemainingSeconds(runningSession, '2026-06-24T01:10:00.000Z'), 900);
  assert.equal(
    getFocusRemainingSeconds({ ...runningSession, pausedAt: '2026-06-24T01:15:30.000Z' }, '2026-06-24T02:00:00.000Z'),
    570,
  );
  assert.equal(getFocusRemainingSeconds(runningSession, '2026-06-24T01:30:00.000Z'), 0);
});

test('getFocusRemainingSeconds returns zero for manually completed sessions before endsAt', () => {
  const { getFocusRemainingSeconds } = loadLifeToolsUtils();
  const completedSession = {
    id: 'session',
    presetId: 'deep-work',
    presetTitle: 'Deep Work',
    focusMinutes: 25,
    phase: 'focus',
    startedAt: '2026-06-24T01:00:00.000Z',
    endsAt: '2026-06-24T01:25:00.000Z',
    completedAt: '2026-06-24T01:05:00.000Z',
  };

  assert.equal(getFocusRemainingSeconds(completedSession, '2026-06-24T01:06:00.000Z'), 0);
  assert.equal(
    getFocusRemainingSeconds(
      { ...completedSession, pausedAt: '2026-06-24T01:04:00.000Z' },
      '2026-06-24T01:06:00.000Z',
    ),
    0,
  );
});
