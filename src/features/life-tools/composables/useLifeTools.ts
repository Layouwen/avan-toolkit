import type { LifeToolsRuntime } from '../runtime';
import type {
  CountdownEvent,
  CountdownRecurrence,
  CountdownSummary,
  FocusPreset,
  FocusSession,
  FocusSessionStatus,
  LifeToolsData,
} from '../types';
import { computed, onUnmounted, readonly, ref, shallowRef } from 'vue';
import {
  completeActiveFocusSession as completeActiveFocusSessionData,
  createDefaultLifeToolsData,
  normalizeLifeToolsData,
  removeCountdownEvent,
  setActiveFocusSession,
  upsertCountdownEvent,
} from '../data';
import { createLifeToolsRuntime } from '../runtime';
import {
  createFocusSession,
  getCountdownSummary,
  getFocusRemainingSeconds,
  getFocusSessionStatus,
  sortCountdownEvents,
} from '../utils';

export interface CountdownEventDraft {
  id?: string;
  title: string;
  date: string;
  recurrence: CountdownRecurrence;
  pinned?: boolean;
  category?: string;
  reminderDaysBefore?: number | null;
  notes?: string;
}

export interface CountdownEventViewModel {
  event: CountdownEvent;
  summary: CountdownSummary;
}

interface UseLifeToolsOptions {
  createId?: () => string;
  now?: () => Date;
  runtime?: LifeToolsRuntime;
  tickMs?: number;
  setInterval?: (callback: () => void, delay: number) => ReturnType<typeof globalThis.setInterval>;
  clearInterval?: (handle: ReturnType<typeof globalThis.setInterval>) => void;
}

const DEFAULT_TICK_MS = 1000;

export function useLifeTools(options: UseLifeToolsOptions = {}) {
  const runtime = options.runtime ?? createLifeToolsRuntime();
  const getNow = options.now ?? (() => new Date());
  const createId = options.createId ?? createLocalId;
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const startInterval = options.setInterval ?? globalThis.setInterval.bind(globalThis);
  const stopInterval = options.clearInterval ?? globalThis.clearInterval.bind(globalThis);

  const data = ref<LifeToolsData>(createDefaultLifeToolsData());
  const now = shallowRef(getNow());
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const errorMessage = shallowRef('');
  const selectedFocusPresetId = shallowRef<string | null>(null);

  const sortedCountdownEvents = computed<CountdownEventViewModel[]>(() =>
    sortCountdownEvents(data.value.countdownEvents, now.value).map(event => ({
      event,
      summary: getCountdownSummary(event, now.value),
    })),
  );

  const focusPresets = computed<FocusPreset[]>(() =>
    [...data.value.focusPresets].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    }),
  );

  const selectedFocusPreset = computed<FocusPreset | null>(() => {
    if (focusPresets.value.length === 0) {
      return null;
    }
    return focusPresets.value.find(preset => preset.id === selectedFocusPresetId.value) ?? focusPresets.value[0];
  });

  const activeFocusSession = computed<FocusSession | null>(() => data.value.activeFocusSession);
  const focusHistory = computed<FocusSession[]>(() => [...data.value.focusHistory].reverse());
  const focusStatus = computed<FocusSessionStatus>(() => getFocusSessionStatus(activeFocusSession.value, now.value));
  const focusRemainingSeconds = computed(() => getFocusRemainingSeconds(activeFocusSession.value, now.value));
  const focusProgressPercent = computed(() => {
    if (!activeFocusSession.value) {
      return 0;
    }

    const startedAt = Date.parse(activeFocusSession.value.startedAt);
    const endsAt = Date.parse(activeFocusSession.value.endsAt);
    if (Number.isNaN(startedAt) || Number.isNaN(endsAt) || endsAt <= startedAt) {
      return focusStatus.value === 'complete' ? 100 : 0;
    }

    const totalSeconds = Math.max(1, Math.ceil((endsAt - startedAt) / 1000));
    const elapsedSeconds = totalSeconds - focusRemainingSeconds.value;
    return Math.min(100, Math.max(0, Math.round((elapsedSeconds / totalSeconds) * 100)));
  });

  async function loadLifeTools(): Promise<void> {
    loading.value = true;
    errorMessage.value = '';
    try {
      data.value = normalizeLifeToolsData(await runtime.persistence.load());
      reconcileSelectedPreset();
      await rescheduleLoadedFocusReminder();
    }
    catch (error) {
      errorMessage.value = getErrorMessage(error);
    }
    finally {
      loading.value = false;
    }
  }

  async function saveCountdownEvent(draft: CountdownEventDraft): Promise<void> {
    const nextEvent = buildCountdownEvent(draft);
    await commitData(upsertCountdownEvent(data.value, nextEvent));
  }

  async function deleteCountdownEvent(eventId: string): Promise<void> {
    await commitData(removeCountdownEvent(data.value, eventId));
  }

  function selectFocusPreset(presetId: string): void {
    if (data.value.focusPresets.some(preset => preset.id === presetId)) {
      selectedFocusPresetId.value = presetId;
    }
  }

  async function startFocusSession(): Promise<void> {
    const preset = selectedFocusPreset.value;
    if (!preset) {
      return;
    }

    errorMessage.value = '';
    if (data.value.activeFocusSession) {
      await captureReminderError(() => runtime.reminders.cancelFocusEnd(data.value.activeFocusSession!.id));
    }

    const permissionResult = await captureReminderResult(() => runtime.reminders.requestPermission());
    const session = createFocusSession(preset, getNow());
    await commitData(setActiveFocusSession(data.value, session));
    if (permissionResult.value) {
      const scheduleError = await captureReminderError(() => runtime.reminders.scheduleFocusEnd(session));
      if (scheduleError) {
        errorMessage.value = scheduleError;
      }
    }
    else if (permissionResult.error) {
      errorMessage.value = permissionResult.error;
    }
  }

  async function completeFocusSession(): Promise<void> {
    const session = data.value.activeFocusSession;
    if (!session) {
      return;
    }

    const reminderError = await captureReminderError(() => runtime.reminders.cancelFocusEnd(session.id));
    await commitData(completeActiveFocusSessionData(data.value, getNow().toISOString()));
    if (reminderError) {
      errorMessage.value = reminderError;
    }
  }

  async function cancelFocusSession(): Promise<void> {
    const session = data.value.activeFocusSession;
    if (!session) {
      return;
    }

    const reminderError = await captureReminderError(() => runtime.reminders.cancelFocusEnd(session.id));
    await commitData(setActiveFocusSession(data.value, null));
    if (reminderError) {
      errorMessage.value = reminderError;
    }
  }

  function refreshNow(): void {
    now.value = getNow();
  }

  async function commitData(nextData: LifeToolsData): Promise<void> {
    saving.value = true;
    errorMessage.value = '';
    const normalized = normalizeLifeToolsData(nextData);
    try {
      await runtime.persistence.save(normalized);
      data.value = normalized;
      reconcileSelectedPreset();
    }
    catch (error) {
      errorMessage.value = getErrorMessage(error);
      throw error;
    }
    finally {
      saving.value = false;
    }
  }

  function buildCountdownEvent(draft: CountdownEventDraft): CountdownEvent {
    const existing = draft.id
      ? data.value.countdownEvents.find(event => event.id === draft.id)
      : undefined;
    const timestamp = getNow().toISOString();
    const event: CountdownEvent = {
      id: existing?.id ?? draft.id ?? createId(),
      title: draft.title.trim(),
      date: draft.date,
      recurrence: draft.recurrence,
      pinned: Boolean(draft.pinned),
      reminderDaysBefore: normalizeReminderDays(draft.reminderDaysBefore),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    const category = normalizeOptionalText(draft.category);
    const notes = normalizeOptionalText(draft.notes);
    if (category) {
      event.category = category;
    }
    if (notes) {
      event.notes = notes;
    }

    return event;
  }

  function reconcileSelectedPreset(): void {
    if (focusPresets.value.length === 0) {
      selectedFocusPresetId.value = null;
      return;
    }
    if (!selectedFocusPresetId.value || !focusPresets.value.some(preset => preset.id === selectedFocusPresetId.value)) {
      selectedFocusPresetId.value = focusPresets.value[0].id;
    }
  }

  async function rescheduleLoadedFocusReminder(): Promise<void> {
    const session = data.value.activeFocusSession;
    if (!session || getFocusSessionStatus(session, now.value) !== 'running') {
      return;
    }

    const reminderError = await captureReminderError(() => runtime.reminders.scheduleFocusEnd(session));
    if (reminderError) {
      errorMessage.value = reminderError;
    }
  }

  let intervalHandle: ReturnType<typeof globalThis.setInterval> | null = null;
  if (tickMs > 0) {
    intervalHandle = startInterval(refreshNow, tickMs);
  }

  onUnmounted(() => {
    if (intervalHandle) {
      stopInterval(intervalHandle);
      intervalHandle = null;
    }
  });

  return {
    activeFocusSession,
    cancelFocusSession,
    completeFocusSession,
    countdownEvents: computed(() => data.value.countdownEvents),
    deleteCountdownEvent,
    errorMessage: readonly(errorMessage),
    focusHistory,
    focusPresets,
    focusProgressPercent,
    focusRemainingSeconds,
    focusStatus,
    loadLifeTools,
    loading: readonly(loading),
    now: readonly(now),
    refreshNow,
    saveCountdownEvent,
    saving: readonly(saving),
    selectFocusPreset,
    selectedFocusPreset,
    selectedFocusPresetId: readonly(selectedFocusPresetId),
    sortedCountdownEvents,
    startFocusSession,
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeReminderDays(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.round(value));
}

function createLocalId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `life-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function captureReminderResult<T>(action: () => Promise<T>): Promise<{ value: T | null; error: string }> {
  try {
    return {
      value: await action(),
      error: '',
    };
  }
  catch (error) {
    return {
      value: null,
      error: getErrorMessage(error),
    };
  }
}

async function captureReminderError(action: () => Promise<void>): Promise<string> {
  try {
    await action();
    return '';
  }
  catch (error) {
    return getErrorMessage(error);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
