import type { AppConfig, ObsidianBlog } from '../../electron-api.d';

export type HexoEditorCommand = AppConfig['hexoEditorCommand'];

export interface LogLine {
  id: number;
  text: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

export interface BlogTreeNode {
  key: string;
  label: string;
  kind: 'folder' | 'blog';
  directoryPath?: string;
  blog?: ObsidianBlog;
  children?: BlogTreeNode[];
}
