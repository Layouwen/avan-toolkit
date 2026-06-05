import type { Buffer } from 'node:buffer';
import type { Dirent } from 'node:fs';
import type { AppConfig } from './configManager';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { v4 as uuidv4 } from 'uuid';
import { validateObsidianBlogs } from './blogValidator';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';
export type LogCallback = (message: string, level: LogLevel) => void;

function log(cb: LogCallback, message: string, level: LogLevel = 'info'): void {
  cb(message, level);
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  }
  catch {
    return false;
  }
}

/** 去除文件名开头的 "编号-" 前缀，例如 "001-title.md" → "title.md"，其他格式原封不动 */
function stripLeadingIndex(filename: string): string {
  return filename.replace(/^\d+-/, '');
}

async function copyMdFiles(srcDir: string, destDir: string, cb: LogCallback): Promise<number> {
  await fs.mkdir(destDir, { recursive: true });
  let entries: Dirent[];
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  }
  catch {
    log(cb, `  目录不存在，跳过: ${srcDir}`, 'info');
    return 0;
  }
  let count = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDest = path.join(destDir, entry.name);
      count += await copyMdFiles(path.join(srcDir, entry.name), subDest, cb);
    }
    else if (entry.name.endsWith('.md')) {
      const destFile = stripLeadingIndex(entry.name);
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, destFile);

      const raw = await fs.readFile(srcPath, 'utf8');
      let finalContent = raw;

      const parsed = matter(raw);
      if (!parsed.data.uuid) {
        parsed.data.uuid = uuidv4();
        finalContent = matter.stringify(parsed.content, parsed.data);
        await fs.writeFile(srcPath, finalContent, 'utf8');
        log(cb, `  已生成 uuid: ${destFile}`, 'info');
      }

      await fs.writeFile(destPath, finalContent, 'utf8');
      log(cb, `  已复制: ${destFile}`, 'info');
      count++;
    }
  }
  return count;
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
        .filter(l => l.trim())
        .forEach(line => log(cb, line, 'info'));
    });

    proc.stderr.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .filter(l => l.trim())
        .forEach(line => log(cb, line, 'info'));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      }
      else {
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
  }
  catch {
    // fallback to npx
    return { cmd: 'npx', args: ['hexo', 'generate'] };
  }
}

export async function runSyncPipeline(config: AppConfig, cb: LogCallback): Promise<void> {
  const { obsidianBlogDir, hexoBlogDir } = config;

  // Step 1: Validate paths
  log(cb, '── Step 1/9  校验目录路径', 'info');
  if (!(await directoryExists(obsidianBlogDir))) {
    throw new Error(`Obsidian 目录不存在: ${obsidianBlogDir}`);
  }
  if (!(await directoryExists(hexoBlogDir))) {
    throw new Error(`Hexo 项目目录不存在: ${hexoBlogDir}`);
  }
  log(cb, '  路径校验通过', 'success');

  log(cb, '── Step 2/9  校验博客 frontmatter', 'info');
  const validation = await validateObsidianBlogs(config);
  if (!validation.ok) {
    for (const issue of validation.issues.slice(0, 20)) {
      log(cb, `  ${issue.relativePath} [${issue.field}] ${issue.message}`, 'error');
    }
    if (validation.issues.length > 20) {
      log(cb, `  还有 ${validation.issues.length - 20} 个问题，请在底部校验结果中查看。`, 'error');
    }
    throw new Error(`博客 frontmatter 校验失败：${validation.issues.length} 个问题`);
  }
  log(cb, `  校验通过，共检查 ${validation.checkedFiles} 个文件`, 'success');

  // Step 2 & 3: Copy article and summary markdown files
  log(cb, '── Step 3/9  复制 article 文章', 'info');
  const articleCount = await copyMdFiles(
    path.join(obsidianBlogDir, 'article'),
    path.join(hexoBlogDir, 'source', '_posts', 'article'),
    cb,
  );
  log(cb, `  复制完成，共 ${articleCount} 篇`, 'success');

  log(cb, '── Step 4/9  复制 summary 文章', 'info');
  const summaryCount = await copyMdFiles(
    path.join(obsidianBlogDir, 'summary'),
    path.join(hexoBlogDir, 'source', '_posts', 'summary'),
    cb,
  );
  log(cb, `  复制完成，共 ${summaryCount} 篇`, 'success');

  // // Step 5: git add
  log(cb, '── Step 5/9  git add .', 'info');
  await runCommand('git', ['add', '.'], hexoBlogDir, cb);
  log(cb, '  git add 完成', 'success');

  // // Step 6: git commit
  const date = new Date().toISOString().slice(0, 10);
  const commitMsg = `"chore: sync update blog from Obsidian [${date}]"`;
  log(cb, `── Step 6/9  git commit ${commitMsg}`, 'info');
  await runCommand('git', ['commit', '-m', commitMsg], hexoBlogDir, cb);
  log(cb, '  git commit 完成', 'success');

  // // Step 7: git push
  log(cb, '── Step 7/9  git push', 'info');
  await runCommand('git', ['push'], hexoBlogDir, cb);
  log(cb, '  git push 完成', 'success');

  // // Step 4: hexo generate
  log(cb, '── Step 8/9  执行 hexo generate', 'info');
  const hexo = await resolveHexoCommand(hexoBlogDir);
  await runCommand(hexo.cmd, hexo.args, hexoBlogDir, cb);
  log(cb, '  hexo generate 完成', 'success');
  log(cb, '── Step 9/9  执行 hexo deploy', 'info');
  await runCommand(hexo.cmd, ['deploy'], hexoBlogDir, cb);
  log(cb, '  hexo deploy 完成', 'success');
}
