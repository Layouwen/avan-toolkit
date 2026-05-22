import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { AppConfig } from './configManager';

export type LogLevel = 'info' | 'success' | 'error';
export type LogCallback = (message: string, level: LogLevel) => void;

function log(cb: LogCallback, message: string, level: LogLevel = 'info'): void {
  cb(message, level);
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/** 去除文件名开头的 "编号-" 前缀，例如 "001-title.md" → "title.md"，其他格式原封不动 */
function stripLeadingIndex(filename: string): string {
  return filename.replace(/^\d+-/, '');
}

async function copyMdFiles(srcDir: string, destDir: string, cb: LogCallback): Promise<number> {
  await fs.mkdir(destDir, { recursive: true });
  let entries: string[];
  try {
    entries = await fs.readdir(srcDir);
  } catch {
    log(cb, `  目录不存在，跳过: ${srcDir}`, 'info');
    return 0;
  }
  const mdFiles = entries.filter((f) => f.endsWith('.md'));
  for (const file of mdFiles) {
    const destFile = stripLeadingIndex(file);
    
    await fs.copyFile(path.join(srcDir, file), path.join(destDir, destFile));
    log(cb, `  已复制: ${destFile}`, 'info');
  }
  return mdFiles.length;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  cb: LogCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      env: { ...process.env },
    });

    proc.stdout.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .filter((l) => l.trim())
        .forEach((line) => log(cb, line, 'info'));
    });

    proc.stderr.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .filter((l) => l.trim())
        .forEach((line) => log(cb, line, 'info'));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`命令退出码: ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function resolveHexoCommand(hexoBlogDir: string): Promise<{ cmd: string; args: string[] }> {
  // Check for both .cmd (Windows) and no-extension (Unix) variants
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const localHexo = path.join(hexoBlogDir, 'node_modules', '.bin', `hexo${ext}`);
  try {
    await fs.access(localHexo);
    return { cmd: localHexo, args: ['generate'] };
  } catch {
    // fallback to npx
    return { cmd: 'npx', args: ['hexo', 'generate'] };
  }
}

export async function runSyncPipeline(config: AppConfig, cb: LogCallback): Promise<void> {
  const { obsidianBlogDir, hexoBlogDir } = config;

  // Step 1: Validate paths
  log(cb, '── Step 1/7  校验目录路径', 'info');
  if (!(await directoryExists(obsidianBlogDir))) {
    throw new Error(`Obsidian 目录不存在: ${obsidianBlogDir}`);
  }
  if (!(await directoryExists(hexoBlogDir))) {
    throw new Error(`Hexo 项目目录不存在: ${hexoBlogDir}`);
  }
  log(cb, '  路径校验通过', 'success');

  // Step 2 & 3: Copy article and summary markdown files
  log(cb, '── Step 2/7  复制 article 文章', 'info');
  const articleCount = await copyMdFiles(
    path.join(obsidianBlogDir, 'article'),
    path.join(hexoBlogDir, 'source', '_posts', 'article'),
    cb,
  );
  log(cb, `  复制完成，共 ${articleCount} 篇`, 'success');

  log(cb, '── Step 3/7  复制 summary 文章', 'info');
  const summaryCount = await copyMdFiles(
    path.join(obsidianBlogDir, 'summary'),
    path.join(hexoBlogDir, 'source', '_posts', 'summary'),
    cb,
  );
  log(cb, `  复制完成，共 ${summaryCount} 篇`, 'success');

  // // Step 5: git add
  log(cb, '── Step 5/7  git add .', 'info');
  await runCommand('git', ['add', '.'], hexoBlogDir, cb);
  log(cb, '  git add 完成', 'success');

  // // Step 6: git commit
  const date = new Date().toISOString().slice(0, 10);
  const commitMsg = `"chore: sync update blog from Obsidian [${date}]"`;
  log(cb, `── Step 6/7  git commit ${commitMsg}`, 'info');
  await runCommand('git', ['commit', '-m', commitMsg], hexoBlogDir, cb);
  log(cb, '  git commit 完成', 'success');

  // // Step 7: git push
  log(cb, '── Step 7/7  git push', 'info');
  await runCommand('git', ['push'], hexoBlogDir, cb);
  log(cb, '  git push 完成', 'success');

  // // Step 4: hexo generate
  log(cb, '── Step 4/7  执行 hexo generate', 'info');
  const hexo = await resolveHexoCommand(hexoBlogDir);
  await runCommand(hexo.cmd, hexo.args, hexoBlogDir, cb);
  log(cb, '  hexo generate 完成', 'success');
  log(cb, '── Step 8/7  执行 hexo deploy', 'info');
  await runCommand(hexo.cmd, ['deploy'], hexoBlogDir, cb);
  log(cb, '  hexo deploy 完成', 'success');
}
