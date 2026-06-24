import type {
  CountdownEvent,
  CountdownSummary,
  FocusPreset,
  FocusSession,
  FocusSessionPhase,
  FocusSessionStatus,
  ISODateString,
} from './types';

type DateInput = Date | string;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getCountdownOccurrence(event: CountdownEvent, now: DateInput): ISODateString {
  const eventDate = parseDateOnly(event.date);
  if (event.recurrence !== 'yearly') {
    return formatDateOnly(eventDate);
  }

  const today = getLocalDateParts(now);
  let occurrence = getYearlyOccurrenceForYear(eventDate, today.year);
  if (compareDateParts(occurrence, today) < 0) {
    occurrence = getYearlyOccurrenceForYear(eventDate, today.year + 1);
  }
  return formatDateOnly(occurrence);
}

export function getCountdownSummary(event: CountdownEvent, now: DateInput): CountdownSummary {
  const occurrenceDate = getCountdownOccurrence(event, now);
  const daysRemaining = diffLocalDateDays(getLocalDateParts(now), parseDateOnly(occurrenceDate));
  const state = daysRemaining === 0 ? 'today' : daysRemaining > 0 ? 'future' : 'past';

  return {
    occurrenceDate,
    daysRemaining,
    state,
  };
}

export function sortCountdownEvents(events: CountdownEvent[], now: DateInput): CountdownEvent[] {
  return [...events].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }

    const daysDiff = getCountdownSummary(a, now).daysRemaining - getCountdownSummary(b, now).daysRemaining;
    if (daysDiff !== 0) {
      return daysDiff;
    }

    return a.title.localeCompare(b.title);
  });
}

export function getFocusPhaseMinutes(preset: FocusPreset, phase: FocusSessionPhase): number {
  if (phase === 'shortBreak') {
    return preset.shortBreakMinutes ?? 0;
  }
  if (phase === 'longBreak') {
    return preset.longBreakMinutes ?? 0;
  }
  return preset.focusMinutes;
}

export function createFocusSession(
  preset: FocusPreset,
  now: DateInput,
  phase: FocusSessionPhase = 'focus',
): FocusSession {
  const startedAt = toValidDate(now);
  const durationMs = Math.max(0, Math.round(getFocusPhaseMinutes(preset, phase) * 60 * 1000));
  const endsAt = new Date(startedAt.getTime() + durationMs);

  return {
    id: `${preset.id}-${startedAt.getTime()}`,
    presetId: preset.id,
    presetTitle: preset.title,
    focusMinutes: preset.focusMinutes,
    phase,
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

export function getFocusSessionStatus(
  session: FocusSession | null | undefined,
  now: DateInput,
): FocusSessionStatus {
  if (!session) {
    return 'idle';
  }
  if (session.completedAt) {
    return 'complete';
  }
  if (session.pausedAt) {
    return 'paused';
  }

  return toValidDate(now).getTime() >= toValidDate(session.endsAt).getTime() ? 'complete' : 'running';
}

export function getFocusRemainingSeconds(session: FocusSession | null | undefined, now: DateInput): number {
  if (!session) {
    return 0;
  }
  if (session.completedAt) {
    return 0;
  }

  const effectiveNow = session.pausedAt ? toValidDate(session.pausedAt) : toValidDate(now);
  const remainingMs = toValidDate(session.endsAt).getTime() - effectiveNow.getTime();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function parseDateOnly(value: string): DateParts {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Expected ISO date string in YYYY-MM-DD format: ${value}`);
  }

  const [, year, month, day] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) {
    throw new RangeError(`Invalid ISO date string: ${value}`);
  }

  return parts;
}

function getLocalDateParts(value: DateInput): DateParts {
  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    return parseDateOnly(value);
  }

  const date = toValidDate(value);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function getYearlyOccurrenceForYear(eventDate: DateParts, year: number): DateParts {
  if (eventDate.month === 2 && eventDate.day === 29 && !isLeapYear(year)) {
    return {
      year,
      month: 2,
      day: 28,
    };
  }

  return {
    year,
    month: eventDate.month,
    day: eventDate.day,
  };
}

function formatDateOnly(parts: DateParts): ISODateString {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function diffLocalDateDays(from: DateParts, to: DateParts): number {
  return Math.round((localMidnightMs(to) - localMidnightMs(from)) / DAY_MS);
}

function localMidnightMs(parts: DateParts): number {
  return new Date(parts.year, parts.month - 1, parts.day).getTime();
}

function compareDateParts(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.month !== b.month) {
    return a.month - b.month;
  }
  return a.day - b.day;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toValidDate(value: DateInput): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid date: ${String(value)}`);
  }
  return date;
}
