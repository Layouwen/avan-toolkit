import type { ElectronAPI } from '../../electron-api';
import type { CountdownEvent, FocusSession, LifeToolsData } from './types';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { createDefaultLifeToolsData, normalizeLifeToolsData } from './data';
import { getCountdownOccurrence } from './utils';

export interface LifeToolsPersistence {
  load: () => Promise<LifeToolsData>;
  save: (data: LifeToolsData) => Promise<void>;
}

export interface LifeToolsReminderScheduler {
  requestPermission: () => Promise<boolean>;
  scheduleCountdownReminder: (event: CountdownEvent, now?: Date) => Promise<void>;
  cancelCountdownReminder: (eventId: string) => Promise<void>;
  scheduleFocusEnd: (session: FocusSession) => Promise<void>;
  cancelFocusEnd: (sessionId: string) => Promise<void>;
}

export interface LifeToolsRuntime {
  persistence: LifeToolsPersistence;
  reminders: LifeToolsReminderScheduler;
}

export const LIFE_TOOLS_LOCAL_STORAGE_KEY = 'avan-toolkit:life-tools';

type ElectronConfigAPI = Pick<ElectronAPI, 'getConfig' | 'setConfig'>;
type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface RuntimeWindow {
  electronAPI?: ElectronConfigAPI;
  localStorage?: StorageLike;
  Notification?: NotificationConstructorLike;
}

interface NotificationConstructorLike {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
  new(title: string, options?: NotificationOptions): unknown;
}

interface WebNotificationReminderSchedulerOptions {
  Notification?: NotificationConstructorLike;
  clearTimeout?: (handle: TimerHandle) => void;
  now?: () => number;
  setTimeout?: (callback: () => void, delay: number) => TimerHandle;
}

interface PreferencesLike {
  get: (options: { key: string }) => Promise<{ value: string | null }>;
  set: (options: { key: string; value: string }) => Promise<void>;
}

interface LocalNotificationsLike {
  cancel: (options: { notifications: Array<{ id: number }> }) => Promise<void>;
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (options: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: {
        at: Date;
        allowWhileIdle?: boolean;
      };
    }>;
  }) => Promise<unknown>;
}

interface LifeToolsRuntimeOptions extends WebNotificationReminderSchedulerOptions {
  localStorage?: StorageLike;
  window?: RuntimeWindow;
}

export function createElectronConfigLifeToolsPersistence(
  electronAPI: ElectronConfigAPI,
): LifeToolsPersistence {
  return {
    async load() {
      const config = await electronAPI.getConfig();
      return normalizeLifeToolsData(config.lifeTools);
    },
    async save(data) {
      const config = await electronAPI.getConfig();
      await electronAPI.setConfig({
        ...config,
        lifeTools: normalizeLifeToolsData(data),
      });
    },
  };
}

export function createLocalStorageLifeToolsPersistence(
  storage: StorageLike | null | undefined = getGlobalLocalStorage(),
  key = LIFE_TOOLS_LOCAL_STORAGE_KEY,
): LifeToolsPersistence {
  return {
    async load() {
      if (!storage) {
        return createDefaultLifeToolsData();
      }

      const raw = storage.getItem(key);
      if (!raw) {
        return createDefaultLifeToolsData();
      }

      try {
        return normalizeLifeToolsData(JSON.parse(raw));
      }
      catch {
        return createDefaultLifeToolsData();
      }
    },
    async save(data) {
      if (!storage) {
        return;
      }

      storage.setItem(key, JSON.stringify(normalizeLifeToolsData(data)));
    },
  };
}

export function createCapacitorLifeToolsPersistence(
  preferences: PreferencesLike = Preferences,
  key = LIFE_TOOLS_LOCAL_STORAGE_KEY,
): LifeToolsPersistence {
  return {
    async load() {
      const { value } = await preferences.get({ key });
      if (!value) {
        return createDefaultLifeToolsData();
      }

      try {
        return normalizeLifeToolsData(JSON.parse(value));
      }
      catch {
        return createDefaultLifeToolsData();
      }
    },
    async save(data) {
      await preferences.set({
        key,
        value: JSON.stringify(normalizeLifeToolsData(data)),
      });
    },
  };
}

export function createCapacitorReminderScheduler(
  localNotifications: LocalNotificationsLike = LocalNotifications,
): LifeToolsReminderScheduler {
  return {
    async requestPermission() {
      const status = await localNotifications.requestPermissions();
      return status.display === 'granted';
    },
    async scheduleFocusEnd(session) {
      const endsAt = new Date(session.endsAt);
      if (Number.isNaN(endsAt.getTime())) {
        return;
      }

      await localNotifications.cancel({
        notifications: [{ id: getNotificationId('focus', session.id) }],
      });
      await localNotifications.schedule({
        notifications: [
          {
            id: getNotificationId('focus', session.id),
            title: 'Focus session complete',
            body: `${session.presetTitle} is done.`,
            schedule: {
              at: endsAt,
              allowWhileIdle: true,
            },
          },
        ],
      });
    },
    async scheduleCountdownReminder(event, now = new Date()) {
      await localNotifications.cancel({
        notifications: [{ id: getNotificationId('countdown', event.id) }],
      });

      const reminderAt = getCountdownReminderDate(event, now);
      if (!reminderAt) {
        return;
      }

      await localNotifications.schedule({
        notifications: [
          {
            id: getNotificationId('countdown', event.id),
            title: event.title,
            body: getCountdownReminderBody(event),
            schedule: {
              at: reminderAt,
              allowWhileIdle: true,
            },
          },
        ],
      });
    },
    async cancelCountdownReminder(eventId) {
      await localNotifications.cancel({
        notifications: [{ id: getNotificationId('countdown', eventId) }],
      });
    },
    async cancelFocusEnd(sessionId) {
      await localNotifications.cancel({
        notifications: [{ id: getNotificationId('focus', sessionId) }],
      });
    },
  };
}

export function createWebNotificationReminderScheduler(
  options: WebNotificationReminderSchedulerOptions = {},
): LifeToolsReminderScheduler {
  const timers = new Map<string, TimerHandle>();
  const countdownTimers = new Map<string, TimerHandle>();
  const Notification = options.Notification ?? getGlobalNotification();
  const setReminderTimeout = options.setTimeout ?? globalThis.setTimeout.bind(globalThis);
  const clearReminderTimeout = options.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
  const getNow = options.now ?? Date.now;

  async function cancelFocusEnd(sessionId: string): Promise<void> {
    const timer = timers.get(sessionId);
    if (timer === undefined) {
      return;
    }

    clearReminderTimeout(timer);
    timers.delete(sessionId);
  }

  async function cancelCountdownReminder(eventId: string): Promise<void> {
    const timer = countdownTimers.get(eventId);
    if (timer === undefined) {
      return;
    }

    clearReminderTimeout(timer);
    countdownTimers.delete(eventId);
  }

  return {
    requestPermission: () => requestNotificationPermission(Notification),
    async scheduleCountdownReminder(event, now = new Date(getNow())) {
      await cancelCountdownReminder(event.id);

      if (!canShowNotification(Notification)) {
        return;
      }

      const reminderAt = getCountdownReminderDate(event, now);
      if (!reminderAt) {
        return;
      }

      const delay = reminderAt.getTime() - getNow();
      if (delay < 0) {
        return;
      }

      const timer = setReminderTimeout(() => {
        countdownTimers.delete(event.id);
        if (canShowNotification(Notification)) {
          void showCountdownNotification(Notification, event);
        }
      }, delay);

      countdownTimers.set(event.id, timer);
    },
    cancelCountdownReminder,
    async scheduleFocusEnd(session) {
      await cancelFocusEnd(session.id);

      if (!canShowNotification(Notification)) {
        return;
      }

      const endsAtMs = Date.parse(session.endsAt);
      if (Number.isNaN(endsAtMs)) {
        return;
      }

      const delay = Math.max(0, endsAtMs - getNow());
      const timer = setReminderTimeout(() => {
        timers.delete(session.id);
        if (canShowNotification(Notification)) {
          void showFocusEndNotification(Notification, session);
        }
      }, delay);

      timers.set(session.id, timer);
    },
    cancelFocusEnd,
  };
}

export function createLifeToolsRuntime(options: LifeToolsRuntimeOptions = {}): LifeToolsRuntime {
  const runtimeWindow = options.window ?? getGlobalWindow();
  const electronAPI = runtimeWindow?.electronAPI;
  const fallbackStorage = options.localStorage ?? runtimeWindow?.localStorage ?? getGlobalLocalStorage();
  const isNative = Capacitor.isNativePlatform();
  const persistence = electronAPI
    ? createElectronConfigLifeToolsPersistence(electronAPI)
    : isNative
      ? createCapacitorLifeToolsPersistence()
      : createLocalStorageLifeToolsPersistence(fallbackStorage);

  return {
    persistence,
    reminders: isNative && !electronAPI
      ? createCapacitorReminderScheduler()
      : createWebNotificationReminderScheduler({
          Notification: options.Notification ?? runtimeWindow?.Notification,
          clearTimeout: options.clearTimeout,
          now: options.now,
          setTimeout: options.setTimeout,
        }),
  };
}

async function requestNotificationPermission(
  Notification: NotificationConstructorLike | undefined,
): Promise<boolean> {
  if (!Notification) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied' || !Notification.requestPermission) {
    return false;
  }

  return (await Notification.requestPermission()) === 'granted';
}

function canShowNotification(Notification: NotificationConstructorLike | undefined): Notification is NotificationConstructorLike {
  return Notification?.permission === 'granted';
}

function showFocusEndNotification(
  Notification: NotificationConstructorLike,
  session: FocusSession,
): unknown {
  return new Notification('Focus session complete', {
    body: `${session.presetTitle} is done.`,
  });
}

function showCountdownNotification(
  Notification: NotificationConstructorLike,
  event: CountdownEvent,
): unknown {
  return new Notification(event.title, {
    body: getCountdownReminderBody(event),
  });
}

function getCountdownReminderDate(event: CountdownEvent, now: Date): Date | null {
  if (event.reminderDaysBefore === null || event.reminderDaysBefore === undefined) {
    return null;
  }

  try {
    const occurrenceDate = getCountdownOccurrence(event, now);
    const reminderAt = getLocalDateAt(occurrenceDate, 9, 0, 0, 0);
    reminderAt.setDate(reminderAt.getDate() - Math.max(0, Math.round(event.reminderDaysBefore)));
    return reminderAt.getTime() >= now.getTime() ? reminderAt : null;
  }
  catch {
    return null;
  }
}

function getLocalDateAt(date: string, hours: number, minutes: number, seconds: number, milliseconds: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
}

function getCountdownReminderBody(event: CountdownEvent): string {
  const daysBefore = Math.max(0, Math.round(event.reminderDaysBefore ?? 0));
  if (daysBefore === 0) {
    return `${event.title} is today.`;
  }
  if (daysBefore === 1) {
    return `${event.title} is tomorrow.`;
  }
  return `${event.title} is in ${daysBefore} days.`;
}

function getNotificationId(namespace: 'countdown' | 'focus', id: string): number {
  let hash = 0;
  for (const char of `${namespace}:${id}`) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
  }
  return (Math.abs(hash) % 2147483647) || 1;
}

function getGlobalWindow(): RuntimeWindow | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window as unknown as RuntimeWindow;
}

function getGlobalLocalStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  }
  catch {
    return undefined;
  }
}

function getGlobalNotification(): NotificationConstructorLike | undefined {
  return globalThis.Notification;
}
