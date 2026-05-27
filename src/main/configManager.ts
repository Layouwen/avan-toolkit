import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export interface AppConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
  locale: string;
  agent: {
    baseURL: string;
    model: string;
    apiKey: string;
  };
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  obsidianBlogDir: '',
  hexoBlogDir: '',
  locale: 'zh-CN',
  agent: {
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen2.5:1.5b',
    // model: 'qwen3.5:27b', // 消耗 20g 内存
    apiKey: 'ollama',
  },
};

export async function getConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  }
  catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function setConfig(config: AppConfig): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}
