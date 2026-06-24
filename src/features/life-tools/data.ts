import type {
  CountdownEvent,
  FocusPreset,
  FocusSession,
  LifeToolsData,
} from './types';

const DEFAULT_FOCUS_PRESET: FocusPreset = {
  id: 'pomodoro-25-5-15',
  title: 'Pomodoro 25/5/15',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  pinned: true,
};

export function createDefaultLifeToolsData(): LifeToolsData {
  return {
    countdownEvents: [],
    focusPresets: [cloneFocusPreset(DEFAULT_FOCUS_PRESET)],
    activeFocusSession: null,
    focusHistory: [],
  };
}

export function normalizeLifeToolsData(value: unknown): LifeToolsData {
  const defaults = createDefaultLifeToolsData();
  if (!isRecord(value)) {
    return defaults;
  }

  const focusPresets = normalizeFocusPresetArray(value.focusPresets);

  return {
    countdownEvents: normalizeCountdownEventArray(value.countdownEvents),
    focusPresets: focusPresets.length > 0 ? focusPresets : defaults.focusPresets,
    activeFocusSession: normalizeFocusSession(value.activeFocusSession),
    focusHistory: normalizeFocusSessionArray(value.focusHistory),
  };
}

export function upsertCountdownEvent(data: LifeToolsData, event: CountdownEvent): LifeToolsData {
  const existingIndex = data.countdownEvents.findIndex(item => item.id === event.id);
  const nextEvent = cloneCountdownEvent(event);
  const countdownEvents = existingIndex === -1
    ? [...data.countdownEvents, nextEvent]
    : data.countdownEvents.map(item => (item.id === event.id ? nextEvent : item));

  return {
    ...data,
    countdownEvents,
  };
}

export function removeCountdownEvent(data: LifeToolsData, eventId: string): LifeToolsData {
  return {
    ...data,
    countdownEvents: data.countdownEvents.filter(event => event.id !== eventId),
  };
}

export function upsertFocusPreset(data: LifeToolsData, preset: FocusPreset): LifeToolsData {
  const existingIndex = data.focusPresets.findIndex(item => item.id === preset.id);
  const nextPreset = cloneFocusPreset(preset);
  const focusPresets = existingIndex === -1
    ? [...data.focusPresets, nextPreset]
    : data.focusPresets.map(item => (item.id === preset.id ? nextPreset : item));

  return {
    ...data,
    focusPresets,
  };
}

export function removeFocusPreset(data: LifeToolsData, presetId: string): LifeToolsData {
  const focusPresets = data.focusPresets.filter(preset => preset.id !== presetId);

  return {
    ...data,
    focusPresets: focusPresets.length > 0 ? focusPresets : createDefaultLifeToolsData().focusPresets,
  };
}

export function setActiveFocusSession(data: LifeToolsData, session: FocusSession | null): LifeToolsData {
  return {
    ...data,
    activeFocusSession: session ? cloneFocusSession(session) : null,
  };
}

export function completeActiveFocusSession(data: LifeToolsData, completedAt: string): LifeToolsData {
  if (!data.activeFocusSession) {
    return data;
  }

  return {
    ...data,
    activeFocusSession: null,
    focusHistory: [
      ...data.focusHistory,
      {
        ...data.activeFocusSession,
        completedAt,
      },
    ],
  };
}

function cloneCountdownEvent(event: CountdownEvent): CountdownEvent {
  return { ...event };
}

function cloneFocusPreset(preset: FocusPreset): FocusPreset {
  return { ...preset };
}

function cloneFocusSession(session: FocusSession): FocusSession {
  return { ...session };
}

function normalizeCountdownEvent(value: unknown): CountdownEvent | null {
  if (!isRecord(value) || !isCountdownRecurrence(value.recurrence)) {
    return null;
  }

  const {
    id,
    title,
    date,
    pinned,
    notes,
    category,
    reminderDaysBefore,
    createdAt,
    updatedAt,
  } = value;

  if (typeof id !== 'string' || typeof title !== 'string' || typeof date !== 'string') {
    return null;
  }

  const event: CountdownEvent = {
    id,
    title,
    date,
    recurrence: value.recurrence,
  };
  if (typeof pinned === 'boolean') {
    event.pinned = pinned;
  }
  if (typeof notes === 'string') {
    event.notes = notes;
  }
  if (typeof category === 'string') {
    event.category = category;
  }
  if (typeof reminderDaysBefore === 'number') {
    event.reminderDaysBefore = reminderDaysBefore;
  }
  else if (reminderDaysBefore === null) {
    event.reminderDaysBefore = null;
  }
  if (typeof createdAt === 'string') {
    event.createdAt = createdAt;
  }
  if (typeof updatedAt === 'string') {
    event.updatedAt = updatedAt;
  }

  return event;
}

function normalizeCountdownEventArray(value: unknown): CountdownEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const event = normalizeCountdownEvent(item);
    return event ? [event] : [];
  });
}

function normalizeFocusPreset(value: unknown): FocusPreset | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    id,
    title,
    focusMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    pinned,
    color,
    createdAt,
    updatedAt,
  } = value;

  if (typeof id !== 'string' || typeof title !== 'string' || typeof focusMinutes !== 'number') {
    return null;
  }

  const preset: FocusPreset = {
    id,
    title,
    focusMinutes,
  };
  if (typeof shortBreakMinutes === 'number') {
    preset.shortBreakMinutes = shortBreakMinutes;
  }
  if (typeof longBreakMinutes === 'number') {
    preset.longBreakMinutes = longBreakMinutes;
  }
  if (typeof pinned === 'boolean') {
    preset.pinned = pinned;
  }
  if (typeof color === 'string') {
    preset.color = color;
  }
  if (typeof createdAt === 'string') {
    preset.createdAt = createdAt;
  }
  if (typeof updatedAt === 'string') {
    preset.updatedAt = updatedAt;
  }

  return preset;
}

function normalizeFocusPresetArray(value: unknown): FocusPreset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const preset = normalizeFocusPreset(item);
    return preset ? [preset] : [];
  });
}

function normalizeFocusSession(value: unknown): FocusSession | null {
  if (!isRecord(value) || !isFocusSessionPhase(value.phase)) {
    return null;
  }

  const {
    id,
    presetId,
    presetTitle,
    focusMinutes,
    startedAt,
    endsAt,
    pausedAt,
    completedAt,
  } = value;

  if (
    typeof id !== 'string'
    || typeof presetId !== 'string'
    || typeof presetTitle !== 'string'
    || typeof focusMinutes !== 'number'
    || typeof startedAt !== 'string'
    || typeof endsAt !== 'string'
    || (pausedAt !== undefined && typeof pausedAt !== 'string')
    || (completedAt !== undefined && typeof completedAt !== 'string')
  ) {
    return null;
  }

  return {
    id,
    presetId,
    presetTitle,
    focusMinutes,
    phase: value.phase,
    startedAt,
    endsAt,
    pausedAt: typeof pausedAt === 'string' ? pausedAt : undefined,
    completedAt: typeof completedAt === 'string' ? completedAt : undefined,
  };
}

function normalizeFocusSessionArray(value: unknown): FocusSession[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const session = normalizeFocusSession(item);
    return session ? [session] : [];
  });
}

function isFocusSessionPhase(value: unknown): value is FocusSession['phase'] {
  return value === 'focus' || value === 'shortBreak' || value === 'longBreak';
}

function isCountdownRecurrence(value: unknown): value is CountdownEvent['recurrence'] {
  return value === 'none' || value === 'yearly';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
