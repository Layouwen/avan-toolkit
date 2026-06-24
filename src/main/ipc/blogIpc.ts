import type { CreateObsidianBlogPayload } from '../blogManager';
import type { IpcRegistrationContext } from './types';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ipcMain, shell } from 'electron';
import {
  createObsidianBlog,
  deleteObsidianBlog,
  listObsidianBlogs,
  renameObsidianBlogFileName,
  renameObsidianBlogTitle,
  resolveHexoOrphanBlogPath,
} from '../blogManager';
import { validateObsidianBlogs } from '../blogValidator';
import { getConfig } from '../configManager';
import { createModuleLogger } from '../logger';
import { runBlogPull, runSyncPipeline } from '../syncPipeline';

function assertInside(parent: string, target: string): void {
  const relative = path.relative(parent, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path is outside the Obsidian blog directory.');
  }
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function openMarkdownInEditor(absolutePath: string): Promise<void> {
  try {
    await shell.openExternal(`obsidian://open?path=${encodeURIComponent(absolutePath)}`);
    return;
  }
  catch {
    // Continue with Cursor fallback below.
  }

  try {
    await shell.openExternal(encodeURI(`cursor://file${absolutePath}`));
    return;
  }
  catch {
    // Continue with Cursor CLI fallback below.
  }

  try {
    await spawnDetached('cursor', [absolutePath]);
  }
  catch {
    const error = await shell.openPath(absolutePath);
    if (error) {
      throw new Error(error);
    }
  }
}

async function openMarkdownWithCommand(absolutePath: string, command: 'cursor' | 'code'): Promise<void> {
  try {
    await spawnDetached(command, [absolutePath]);
  }
  catch {
    const error = await shell.openPath(absolutePath);
    if (error) {
      throw new Error(`${command} 打开失败: ${error}`);
    }
  }
}

async function openDirectoryInSystem(dirPath: string): Promise<void> {
  const error = await shell.openPath(dirPath);
  if (error) {
    throw new Error(error);
  }
}

export function registerBlogIpcHandlers(context: IpcRegistrationContext): void {
  ipcMain.handle('blogs:list', async () => {
    const config = await getConfig();
    return listObsidianBlogs(config);
  });

  ipcMain.handle('blogs:validate', async () => {
    const config = await getConfig();
    return validateObsidianBlogs(config);
  });

  ipcMain.handle('blogs:openInEditor', async (_event, relativePath: string) => {
    const config = await getConfig();
    const root = config.obsidianBlogDir.trim();
    if (!root) {
      throw new Error('Obsidian Blog directory is not configured.');
    }
    if (!relativePath || !relativePath.endsWith('.md')) {
      throw new Error('Only markdown blog files can be opened.');
    }

    const absolutePath = path.resolve(root, relativePath);
    assertInside(root, absolutePath);
    await openMarkdownInEditor(absolutePath);
  });

  ipcMain.handle('blogs:openValidationIssue', async (_event, source: 'obsidian' | 'hexo', absolutePath: string) => {
    const config = await getConfig();
    const obsidianRoot = config.obsidianBlogDir.trim();
    const hexoRoot = config.hexoBlogDir.trim();
    const resolvedPath = path.resolve(absolutePath);
    if (source !== 'obsidian' && source !== 'hexo') {
      throw new Error('Unknown blog validation issue source.');
    }
    if (!resolvedPath.endsWith('.md')) {
      throw new Error('Only markdown blog files can be opened.');
    }

    if (source === 'obsidian') {
      if (!obsidianRoot) {
        throw new Error('Obsidian Blog directory is not configured.');
      }
      assertInside(obsidianRoot, resolvedPath);
      await openMarkdownInEditor(resolvedPath);
      return;
    }

    if (!hexoRoot) {
      throw new Error('Hexo Blog directory is not configured.');
    }
    assertInside(hexoRoot, resolvedPath);
    await openMarkdownWithCommand(resolvedPath, config.hexoEditorCommand);
  });

  ipcMain.handle('blogs:openConfiguredDir', async (_event, kind: 'obsidian' | 'hexo') => {
    const config = await getConfig();
    if (kind !== 'obsidian' && kind !== 'hexo') {
      throw new Error('Unknown blog directory kind.');
    }

    const dirPath = kind === 'obsidian' ? config.obsidianBlogDir.trim() : config.hexoBlogDir.trim();
    if (!dirPath) {
      throw new Error(`${kind === 'obsidian' ? 'Obsidian Blog' : 'Hexo Blog'} directory is not configured.`);
    }

    await openDirectoryInSystem(path.resolve(dirPath));
  });

  ipcMain.handle('blogs:openObsidianPage', async () => {
    const config = await getConfig();
    const obsidianRoot = config.obsidianBlogDir.trim();
    if (!obsidianRoot) {
      throw new Error('Obsidian Blog directory is not configured.');
    }

    await shell.openExternal('obsidian://open');
  });

  ipcMain.handle('blogs:openHexoProjectInEditor', async () => {
    const config = await getConfig();
    const hexoRoot = config.hexoBlogDir.trim();
    if (!hexoRoot) {
      throw new Error('Hexo Blog directory is not configured.');
    }

    await openMarkdownWithCommand(path.resolve(hexoRoot), config.hexoEditorCommand);
  });

  ipcMain.handle('blogs:create', async (_event, payload: CreateObsidianBlogPayload) => {
    const config = await getConfig();
    return createObsidianBlog(config, payload);
  });

  ipcMain.handle('blogs:delete', async (_event, relativePath: string) => {
    const config = await getConfig();
    await deleteObsidianBlog(config, relativePath);
  });

  ipcMain.handle('blogs:deleteHexoOrphan', async (_event, relativePath: string) => {
    const config = await getConfig();
    const validation = await validateObsidianBlogs(config);
    const orphanIssue = validation.issues.some(issue =>
      issue.source === 'hexo'
      && issue.field === 'sync:missingObsidian'
      && issue.relativePath === relativePath,
    );
    if (!orphanIssue) {
      throw new Error('Only Hexo files missing from Obsidian can be removed from this action.');
    }

    const filePath = await resolveHexoOrphanBlogPath(config, relativePath);
    await shell.trashItem(filePath);
  });

  ipcMain.handle('blogs:renameTitle', async (_event, relativePath: string, title: string) => {
    const config = await getConfig();
    return renameObsidianBlogTitle(config, relativePath, title);
  });

  ipcMain.handle('blogs:renameFileName', async (_event, relativePath: string, fileName: string) => {
    const config = await getConfig();
    return renameObsidianBlogFileName(config, relativePath, fileName);
  });

  ipcMain.handle('sync:start', async () => {
    const config = await getConfig();
    const logger = createModuleLogger({
      module: 'blogSync',
      scope: 'sync',
      onLog: entry => context.getMainWindow()?.webContents.send('sync:log', entry.message, entry.level),
    });
    try {
      await runSyncPipeline(config, (message, level) => logger.log(level, message));
      logger.success('同步流程结束。');
      context.getMainWindow()?.webContents.send('sync:done', true);
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`错误: ${message}`);
      context.getMainWindow()?.webContents.send('sync:done', false, message);
    }
  });

  ipcMain.handle('sync:pullBlog', async () => {
    const config = await getConfig();
    const logger = createModuleLogger({
      module: 'blogSync',
      scope: 'pull',
      onLog: entry => context.getMainWindow()?.webContents.send('sync:log', entry.message, entry.level),
    });
    try {
      await runBlogPull(config, (message, level) => logger.log(level, message));
      logger.success('Blog Pull 完成。');
      context.getMainWindow()?.webContents.send('sync:done', true);
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Blog Pull 失败: ${message}`);
      context.getMainWindow()?.webContents.send('sync:done', false, message);
    }
  });
}
