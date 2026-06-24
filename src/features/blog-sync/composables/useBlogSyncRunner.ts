import type { AppConfig, BlogValidationResult } from '../../../electron-api.d';
import type { LogLine } from '@/features/blog-sync/types';
import { shallowRef } from 'vue';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
type Translate = (key: string, params?: Record<string, string | number>) => string;

interface LogInput {
  text: string;
  level: LogLine['level'];
}

interface UseBlogSyncRunnerOptions {
  plainConfig: () => AppConfig;
  loadValidation: () => Promise<BlogValidationResult>;
  appendLog: (text: string, level: LogLine['level']) => void;
  setLogs: (logs: LogInput[]) => void;
  t: Translate;
}

export function useBlogSyncRunner(options: UseBlogSyncRunnerOptions) {
  const syncing = shallowRef(false);
  const pullingBlog = shallowRef(false);
  const status = shallowRef<SyncStatus>('idle');

  async function startSync() {
    if (syncing.value || pullingBlog.value) {
      return;
    }

    await window.electronAPI.setConfig(options.plainConfig());
    const validation = await options.loadValidation();
    if (validation.errorCount > 0) {
      status.value = 'error';
      options.setLogs([
        {
          text: options.t('blogSync.validation.syncBlocked', { count: validation.errorCount }),
          level: 'error',
        },
      ]);
      return;
    }

    syncing.value = true;
    status.value = 'syncing';
    options.setLogs([]);

    window.electronAPI.onSyncDone((success, error) => {
      syncing.value = false;
      status.value = success ? 'success' : 'error';
      void options.loadValidation();
      if (error) {
        options.appendLog(options.t('blogSync.logs.failed', { error }), 'error');
      }
      else {
        options.appendLog(options.t('blogSync.logs.done'), 'success');
      }
    });

    await window.electronAPI.startSync();
  }

  async function pullBlog() {
    if (syncing.value || pullingBlog.value) {
      return;
    }

    await window.electronAPI.setConfig(options.plainConfig());
    pullingBlog.value = true;
    status.value = 'syncing';
    options.setLogs([
      {
        text: options.t('blogSync.logs.pullStart'),
        level: 'info',
      },
    ]);

    window.electronAPI.onSyncDone((success, error) => {
      pullingBlog.value = false;
      status.value = success ? 'success' : 'error';
      if (error) {
        options.appendLog(options.t('blogSync.logs.pullFailed', { error }), 'error');
      }
      else {
        options.appendLog(options.t('blogSync.logs.pullDone'), 'success');
      }
    });

    await window.electronAPI.pullBlog();
  }

  return {
    syncing,
    pullingBlog,
    status,
    startSync,
    pullBlog,
  };
}
