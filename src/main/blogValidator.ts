import type { Dirent } from 'node:fs';
import type { AppConfig } from './configManager';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export type BlogValidationSeverity = 'error' | 'warn';

export interface BlogValidationIssue {
  id: string;
  relativePath: string;
  absolutePath: string;
  field: string;
  message: string;
  severity: BlogValidationSeverity;
}

export interface BlogValidationResult {
  ok: boolean;
  issues: BlogValidationIssue[];
  checkedFiles: number;
}

const SYNCED_BLOG_DIRS = ['article', 'summary'];
const REQUIRED_FIELDS = ['title', 'uuid', 'date', 'tags', 'categories'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNTITLED_RE = /^(?:untitled|未命名|无标题)(?:\s*(?:blog|博客|文章|笔记)?|\s*\d*)$/i;

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  }
  catch {
    return false;
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[,\s，]+/).map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function isValidDateValue(value: unknown): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}

async function walkMarkdownFiles(root: string, dir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  }
  catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkMarkdownFiles(root, absolutePath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files.sort((a, b) => path.relative(root, a).localeCompare(path.relative(root, b)));
}

function pushIssue(
  issues: BlogValidationIssue[],
  absolutePath: string,
  root: string,
  field: string,
  message: string,
  severity: BlogValidationSeverity = 'error',
): void {
  const relativePath = path.relative(root, absolutePath);
  issues.push({
    id: `${relativePath}:${field}:${issues.length}`,
    relativePath,
    absolutePath,
    field,
    message,
    severity,
  });
}

function validateFileFields(absolutePath: string, root: string, data: Record<string, unknown>): BlogValidationIssue[] {
  const issues: BlogValidationIssue[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      pushIssue(issues, absolutePath, root, field, `缺少 ${field} 字段`);
    }
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if ('title' in data && !title) {
    pushIssue(issues, absolutePath, root, 'title', 'title 不能为空');
  }
  if (title && UNTITLED_RE.test(title)) {
    pushIssue(issues, absolutePath, root, 'title', `title 不能使用占位名称: ${title}`);
  }

  if ('uuid' in data) {
    const uuid = typeof data.uuid === 'string' ? data.uuid.trim() : '';
    if (!uuid) {
      pushIssue(issues, absolutePath, root, 'uuid', 'uuid 不能为空');
    }
    else if (!UUID_RE.test(uuid)) {
      pushIssue(issues, absolutePath, root, 'uuid', 'uuid 必须是有效的 UUID');
    }
  }

  if ('date' in data && !isValidDateValue(data.date)) {
    pushIssue(issues, absolutePath, root, 'date', 'date 必须是有效日期');
  }

  for (const field of ['tags', 'categories'] as const) {
    if (field in data && normalizeStringArray(data[field]).length === 0) {
      pushIssue(issues, absolutePath, root, field, `${field} 至少需要填写一项`);
    }
  }

  return issues;
}

export async function validateObsidianBlogs(config: AppConfig): Promise<BlogValidationResult> {
  const root = config.obsidianBlogDir.trim();
  if (!root) {
    throw new Error('Obsidian Blog directory is not configured.');
  }
  if (!(await directoryExists(root))) {
    throw new Error(`Obsidian Blog directory does not exist: ${root}`);
  }

  const markdownFiles: string[] = [];
  for (const dirName of SYNCED_BLOG_DIRS) {
    markdownFiles.push(...await walkMarkdownFiles(root, path.join(root, dirName)));
  }

  const issues: BlogValidationIssue[] = [];
  for (const absolutePath of markdownFiles) {
    try {
      const raw = await fs.readFile(absolutePath, 'utf8');
      const parsed = matter(raw);
      issues.push(...validateFileFields(absolutePath, root, parsed.data));
    }
    catch (error) {
      pushIssue(
        issues,
        absolutePath,
        root,
        'frontmatter',
        `无法读取或解析 frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    checkedFiles: markdownFiles.length,
  };
}
