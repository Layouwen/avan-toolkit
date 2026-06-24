import type { ObsidianBlog } from '../../electron-api.d';

export interface BlogTreeNode {
  key: string;
  label: string;
  kind: 'folder' | 'blog';
  directoryPath?: string;
  blog?: ObsidianBlog;
  children?: BlogTreeNode[];
}
