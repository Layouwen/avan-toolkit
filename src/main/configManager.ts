import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface AppConfig {
  obsidianBlogDir: string;
  hexoBlogDir: string;
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  obsidianBlogDir: '',
  hexoBlogDir: '',
};

export async function getConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function setConfig(config: AppConfig): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}
