import type { LogLevel } from '../../../electron-api.d';
import type { LogLine } from '@/features/blog-sync/types';
import { ref } from 'vue';

interface LogInput {
  text: string;
  level: LogLine['level'];
}

export function useBlogSyncLogs() {
  const logs = ref<LogLine[]>([]);
  let logIdCounter = 0;

  function createLogLine(input: LogInput): LogLine {
    return {
      id: logIdCounter++,
      text: input.text,
      level: input.level,
    };
  }

  function appendLog(text: string, level: LogLine['level']) {
    logs.value.push(createLogLine({ text, level }));
  }

  function setLogs(nextLogs: LogInput[]) {
    logs.value = nextLogs.map(createLogLine);
  }

  function clearLogs() {
    logs.value = [];
  }

  function subscribeSyncLogs() {
    window.electronAPI.onSyncLog((message: string, level: LogLevel) => {
      appendLog(message, level);
    });
  }

  function unsubscribeSyncLogs() {
    window.electronAPI.offSyncLog();
  }

  return {
    logs,
    appendLog,
    setLogs,
    clearLogs,
    subscribeSyncLogs,
    unsubscribeSyncLogs,
  };
}
