export type ISODateString = string;
export type ISODateTimeString = string;

export type CountdownRecurrence = 'none' | 'yearly';
export type CountdownState = 'today' | 'future' | 'past';

export interface CountdownEvent {
  id: string;
  title: string;
  date: ISODateString;
  recurrence: CountdownRecurrence;
  pinned?: boolean;
  notes?: string;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
}

export interface CountdownSummary {
  occurrenceDate: ISODateString;
  daysRemaining: number;
  state: CountdownState;
}

export type FocusSessionPhase = 'focus' | 'shortBreak' | 'longBreak';
export type FocusSessionStatus = 'idle' | 'running' | 'complete' | 'paused';

export interface FocusPreset {
  id: string;
  title: string;
  focusMinutes: number;
  shortBreakMinutes?: number;
  longBreakMinutes?: number;
  pinned?: boolean;
  color?: string;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
}

export interface FocusSession {
  id: string;
  presetId: string;
  presetTitle: string;
  focusMinutes: number;
  phase: FocusSessionPhase;
  startedAt: ISODateTimeString;
  endsAt: ISODateTimeString;
  pausedAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;
}
