import type { WebContents } from 'electron';
import electronLog from 'electron-log';

export type LogModule = 'blogSync' | 'qzone' | 'agent';
export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface AppLogEntry {
  id: string;
  module: LogModule;
  scope: string;
  runId: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  sensitive?: boolean;
}

export interface LogFilters {
  module?: LogModule;
  level?: LogLevel;
  runId?: string;
  sensitive?: boolean;
  limit?: number;
}

export interface ModuleLogger {
  runId: string;
  info: (message: string, options?: LogWriteOptions) => AppLogEntry;
  success: (message: string, options?: LogWriteOptions) => AppLogEntry;
  warn: (message: string, options?: LogWriteOptions) => AppLogEntry;
  error: (message: string, options?: LogWriteOptions) => AppLogEntry;
  log: (level: LogLevel, message: string, options?: LogWriteOptions) => AppLogEntry;
}

export interface LogWriteOptions {
  sensitive?: boolean;
}

type LogSubscriber = (entry: AppLogEntry) => void;

const MAX_MEMORY_LOGS = 5_000;
const logs: AppLogEntry[] = [];
const subscribers = new Set<LogSubscriber>();

electronLog.transports.file.level = 'info';
electronLog.transports.console.level = 'debug';
electronLog.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} {text}';
electronLog.transports.console.format = '{h}:{i}:{s} {text}';

function createRunId(module: LogModule, scope: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 17);
  const random = Math.random().toString(36).slice(2, 8);
  return `${module}-${scope}-${stamp}-${random}`;
}

function createLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function writeToFile(entry: AppLogEntry): void {
  const serialized = JSON.stringify(entry);
  if (entry.level === 'error') {
    electronLog.error(serialized);
    return;
  }
  if (entry.level === 'warn') {
    electronLog.warn(serialized);
    return;
  }
  electronLog.info(serialized);
}

function appendLog(entry: AppLogEntry): AppLogEntry {
  logs.push(entry);
  if (logs.length > MAX_MEMORY_LOGS) {
    logs.splice(0, logs.length - MAX_MEMORY_LOGS);
  }
  writeToFile(entry);
  for (const subscriber of subscribers) {
    subscriber(entry);
  }
  return entry;
}

export function encryptSensitiveLog(message: string): string {
  return message;
}

export function decryptSensitiveLog(message: string): string {
  return message;
}

export function createModuleLogger(options: {
  module: LogModule;
  scope: string;
  runId?: string;
  onLog?: (entry: AppLogEntry) => void;
}): ModuleLogger {
  const runId = options.runId ?? createRunId(options.module, options.scope);

  function log(level: LogLevel, message: string, writeOptions: LogWriteOptions = {}): AppLogEntry {
    const entry: AppLogEntry = {
      id: createLogId(),
      module: options.module,
      scope: options.scope,
      runId,
      level,
      message: writeOptions.sensitive ? encryptSensitiveLog(message) : message,
      timestamp: new Date().toISOString(),
      sensitive: writeOptions.sensitive || undefined,
    };
    appendLog(entry);
    options.onLog?.(entry);
    return entry;
  }

  return {
    runId,
    info: (message, writeOptions) => log('info', message, writeOptions),
    success: (message, writeOptions) => log('success', message, writeOptions),
    warn: (message, writeOptions) => log('warn', message, writeOptions),
    error: (message, writeOptions) => log('error', message, writeOptions),
    log,
  };
}

export function listLogs(filters: LogFilters = {}): AppLogEntry[] {
  const limit = filters.limit ?? 500;
  return logs
    .filter((entry) => {
      if (filters.module && entry.module !== filters.module) {
        return false;
      }
      if (filters.level && entry.level !== filters.level) {
        return false;
      }
      if (filters.runId && entry.runId !== filters.runId) {
        return false;
      }
      if (typeof filters.sensitive === 'boolean' && Boolean(entry.sensitive) !== filters.sensitive) {
        return false;
      }
      return true;
    })
    .slice(-limit)
    .reverse();
}

export function clearLogs(filters: LogFilters = {}): void {
  if (!filters.module && !filters.level && !filters.runId && typeof filters.sensitive !== 'boolean') {
    logs.length = 0;
    return;
  }

  for (let index = logs.length - 1; index >= 0; index--) {
    const entry = logs[index];
    const matchesModule = !filters.module || entry.module === filters.module;
    const matchesLevel = !filters.level || entry.level === filters.level;
    const matchesRunId = !filters.runId || entry.runId === filters.runId;
    const matchesSensitive = typeof filters.sensitive !== 'boolean' || Boolean(entry.sensitive) === filters.sensitive;
    if (matchesModule && matchesLevel && matchesRunId && matchesSensitive) {
      logs.splice(index, 1);
    }
  }
}

export function subscribeLogs(webContents: WebContents): () => void {
  const subscriber = (entry: AppLogEntry) => {
    if (!webContents.isDestroyed()) {
      webContents.send('logs:event', entry);
    }
  };
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function getLogFilePath(): string {
  return electronLog.transports.file.getFile().path;
}
