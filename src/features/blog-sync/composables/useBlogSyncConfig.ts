import type { AppConfig } from '../../../electron-api.d';
import { computed, ref, toRaw } from 'vue';

export type BlogPathField = 'obsidianBlogDir' | 'hexoBlogDir';

export function createDefaultBlogSyncConfig(): AppConfig {
  return {
    obsidianBlogDir: '',
    hexoBlogDir: '',
    hexoEditorCommand: 'cursor',
    locale: '',
    agent: {
      baseURL: '',
      model: '',
      apiKey: '',
    },
    qzone: {
      loginMode: 'qr',
      qqNumber: '',
      qqPassword: '',
      playwrightProfileDir: '',
    },
    screensaver: {
      enabled: true,
      triggerIntervalMinutes: 45,
      countdownSeconds: 30,
      backgroundType: 'color',
      backgroundColor: '#1a3a2a',
      backgroundImagePath: '',
    },
    editorExtensions: {
      vsixDownloadDir: '',
    },
  };
}

export function useBlogSyncConfig() {
  const config = ref<AppConfig>(createDefaultBlogSyncConfig());

  const hexoEditorCommandOptions = computed(() => [
    { label: 'Cursor', value: 'cursor' as const },
    { label: 'VS Code', value: 'code' as const },
  ]);

  function plainConfig(): AppConfig {
    const current = toRaw(config.value);
    return {
      ...current,
      agent: {
        ...toRaw(current.agent),
      },
      qzone: {
        ...toRaw(current.qzone),
      },
      screensaver: {
        ...toRaw(current.screensaver),
      },
      editorExtensions: {
        ...toRaw(current.editorExtensions),
      },
    };
  }

  async function loadConfig() {
    config.value = await window.electronAPI.getConfig();
  }

  async function saveConfig() {
    await window.electronAPI.setConfig(plainConfig());
  }

  async function browseDir(field: BlogPathField) {
    const dir = await window.electronAPI.selectDirectory();
    if (!dir) {
      return false;
    }

    config.value[field] = dir;
    await window.electronAPI.setConfig(plainConfig());
    return true;
  }

  async function updateHexoEditorCommand(value: unknown) {
    if (value === 'cursor' || value === 'code') {
      config.value.hexoEditorCommand = value;
      await saveConfig();
      return true;
    }
    return false;
  }

  return {
    config,
    hexoEditorCommandOptions,
    loadConfig,
    plainConfig,
    saveConfig,
    browseDir,
    updateHexoEditorCommand,
  };
}
