import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export interface AppConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
  hexoEditorCommand: 'cursor' | 'code';
  locale: string;
  agent: {
    baseURL: string;
    model: string;
    apiKey: string;
  };
  qzone: {
    loginMode: 'credentials' | 'qr';
    qqNumber: string;
    qqPassword: string;
    playwrightProfileDir: string;
  };
  screensaver: {
    enabled: boolean;
    triggerIntervalMinutes: number;
    countdownSeconds: number;
    backgroundType: 'color' | 'image';
    backgroundColor: string;
    backgroundImagePath: string;
  };
  editorExtensions: {
    vsixDownloadDir: string;
  };
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const DEFAULT_QZONE_PROFILE_DIR = path.join(app.getPath('userData'), 'qzone-playwright-profile');

const DEFAULT_CONFIG: AppConfig = {
  obsidianBlogDir: '',
  hexoBlogDir: '',
  hexoEditorCommand: 'cursor',
  locale: 'zh-CN',
  agent: {
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen2.5:1.5b',
    // model: 'qwen3.5:27b', // 消耗 20g 内存
    apiKey: 'ollama',
  },
  qzone: {
    loginMode: 'qr',
    qqNumber: '',
    qqPassword: '',
    playwrightProfileDir: DEFAULT_QZONE_PROFILE_DIR,
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

export async function getConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      agent: {
        ...DEFAULT_CONFIG.agent,
        ...parsed.agent,
      },
      qzone: {
        ...DEFAULT_CONFIG.qzone,
        ...parsed.qzone,
      },
      screensaver: {
        ...DEFAULT_CONFIG.screensaver,
        ...parsed.screensaver,
      },
      editorExtensions: {
        ...DEFAULT_CONFIG.editorExtensions,
        ...parsed.editorExtensions,
      },
    };
  }
  catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function setConfig(config: AppConfig): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}
