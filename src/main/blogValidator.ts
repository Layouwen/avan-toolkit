import type { Dirent } from 'node:fs';
import type { AppConfig } from './configManager';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export type BlogValidationSeverity = 'error' | 'warn';
export type BlogValidationSource = 'obsidian' | 'hexo';

export interface BlogValidationIssue {
  id: string;
  source: BlogValidationSource;
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
  obsidianCheckedFiles: number;
  hexoCheckedFiles: number;
  errorCount: number;
  warningCount: number;
}

interface MarkdownFileInfo {
  source: BlogValidationSource;
  section: string;
  absolutePath: string;
  relativePath: string;
  uuid: string;
  title: string;
  body: string;
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
  source: BlogValidationSource,
  absolutePath: string,
  root: string,
  field: string,
  message: string,
  severity: BlogValidationSeverity = 'error',
): void {
  const relativePath = path.relative(root, absolutePath);
  issues.push({
    id: `${source}:${relativePath}:${field}:${issues.length}`,
    source,
    relativePath,
    absolutePath,
    field,
    message,
    severity,
  });
}

function normalizeComparableBody(content: string): string {
  return content.replace(/\s+$/g, '');
}

function normalizeSyncedRelativePath(relativePath: string): string {
  const dir = path.dirname(relativePath);
  const fileName = path.basename(relativePath).replace(/^\d+-/, '');
  return dir === '.' ? fileName : path.join(dir, fileName);
}

function validateFileFields(absolutePath: string, root: string, data: Record<string, unknown>): BlogValidationIssue[] {
  const issues: BlogValidationIssue[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      pushIssue(issues, 'obsidian', absolutePath, root, field, `缺少 ${field} 字段`);
    }
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if ('title' in data && !title) {
    pushIssue(issues, 'obsidian', absolutePath, root, 'title', 'title 不能为空');
  }
  if (title && UNTITLED_RE.test(title)) {
    pushIssue(issues, 'obsidian', absolutePath, root, 'title', `title 不能使用占位名称: ${title}`);
  }

  if ('uuid' in data) {
    const uuid = typeof data.uuid === 'string' ? data.uuid.trim() : '';
    if (!uuid) {
      pushIssue(issues, 'obsidian', absolutePath, root, 'uuid', 'uuid 不能为空');
    }
    else if (!UUID_RE.test(uuid)) {
      pushIssue(issues, 'obsidian', absolutePath, root, 'uuid', 'uuid 必须是有效的 UUID');
    }
  }

  if ('date' in data && !isValidDateValue(data.date)) {
    pushIssue(issues, 'obsidian', absolutePath, root, 'date', 'date 必须是有效日期');
  }

  for (const field of ['tags', 'categories'] as const) {
    if (field in data && normalizeStringArray(data[field]).length === 0) {
      pushIssue(issues, 'obsidian', absolutePath, root, field, `${field} 至少需要填写一项`);
    }
  }

  return issues;
}

function validateHexoUuidField(absolutePath: string, root: string, data: Record<string, unknown>): BlogValidationIssue[] {
  const issues: BlogValidationIssue[] = [];
  const uuid = typeof data.uuid === 'string' ? data.uuid.trim() : '';
  if (!uuid) {
    pushIssue(
      issues,
      'hexo',
      absolutePath,
      root,
      'uuid',
      'Hexo 文件缺少 uuid，无法和 Obsidian 对账',
      'warn',
    );
  }
  else if (!UUID_RE.test(uuid)) {
    pushIssue(
      issues,
      'hexo',
      absolutePath,
      root,
      'uuid',
      'Hexo 文件 uuid 无效，无法和 Obsidian 对账',
      'warn',
    );
  }
  return issues;
}

async function collectMarkdownInfo(
  source: BlogValidationSource,
  root: string,
  section: string,
  absolutePath: string,
): Promise<MarkdownFileInfo | null> {
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = matter(raw);
  const uuid = typeof parsed.data.uuid === 'string' ? parsed.data.uuid.trim() : '';
  if (!UUID_RE.test(uuid)) {
    return null;
  }

  return {
    source,
    section,
    absolutePath,
    relativePath: path.relative(root, absolutePath),
    uuid,
    title: typeof parsed.data.title === 'string' ? parsed.data.title.trim() : '',
    body: normalizeComparableBody(parsed.content),
  };
}

function addFileByUuid(filesByKey: Map<string, MarkdownFileInfo[]>, file: MarkdownFileInfo): void {
  const key = `${file.section}:${file.uuid}`;
  filesByKey.set(key, [...(filesByKey.get(key) || []), file]);
}

function addDuplicateUuidIssues(
  issues: BlogValidationIssue[],
  source: BlogValidationSource,
  root: string,
  filesByKey: Map<string, MarkdownFileInfo[]>,
): void {
  for (const [key, files] of filesByKey) {
    if (files.length <= 1) {
      continue;
    }

    const [, uuid] = key.split(':');
    for (const file of files) {
      pushIssue(
        issues,
        source,
        file.absolutePath,
        root,
        'uuid:duplicate',
        `同一目录类型内存在重复 uuid: ${uuid}`,
      );
    }
  }
}

function firstByKey(filesByKey: Map<string, MarkdownFileInfo[]>): Map<string, MarkdownFileInfo> {
  const result = new Map<string, MarkdownFileInfo>();
  for (const [key, files] of filesByKey) {
    if (files.length === 1) {
      result.set(key, files[0]);
    }
  }
  return result;
}

function compareBlogSides(
  issues: BlogValidationIssue[],
  obsidianRoot: string,
  hexoPostsRoot: string,
  obsidianFilesByKey: Map<string, MarkdownFileInfo[]>,
  hexoFilesByKey: Map<string, MarkdownFileInfo[]>,
): void {
  const obsidianByKey = firstByKey(obsidianFilesByKey);
  const hexoByKey = firstByKey(hexoFilesByKey);

  for (const [key, obsidianFile] of obsidianByKey) {
    const hexoFile = hexoByKey.get(key);
    if (!hexoFile) {
      pushIssue(
        issues,
        'obsidian',
        obsidianFile.absolutePath,
        obsidianRoot,
        'sync:missingHexo',
        `Hexo 中缺少相同 uuid 的文章: ${obsidianFile.uuid}`,
        'warn',
      );
      continue;
    }

    if (normalizeSyncedRelativePath(obsidianFile.relativePath) !== normalizeSyncedRelativePath(hexoFile.relativePath)) {
      pushIssue(
        issues,
        'obsidian',
        obsidianFile.absolutePath,
        obsidianRoot,
        'sync:pathDiff',
        `同 uuid 的 Hexo 文件路径不同: ${hexoFile.relativePath}`,
        'warn',
      );
    }

    if (obsidianFile.title !== hexoFile.title) {
      pushIssue(
        issues,
        'obsidian',
        obsidianFile.absolutePath,
        obsidianRoot,
        'sync:titleDiff',
        `同 uuid 的 Hexo 标题不同: ${hexoFile.title || '(空)'}`,
        'warn',
      );
    }

    if (obsidianFile.body !== hexoFile.body) {
      pushIssue(
        issues,
        'obsidian',
        obsidianFile.absolutePath,
        obsidianRoot,
        'sync:contentDiff',
        '同 uuid 的 Hexo 正文内容不同',
        'warn',
      );
    }
  }

  for (const [key, hexoFile] of hexoByKey) {
    if (obsidianByKey.has(key)) {
      continue;
    }

    pushIssue(
      issues,
      'hexo',
      hexoFile.absolutePath,
      hexoPostsRoot,
      'sync:missingObsidian',
      `Obsidian 中缺少相同 uuid 的文章: ${hexoFile.uuid}`,
      'warn',
    );
  }
}

export async function validateObsidianBlogs(config: AppConfig): Promise<BlogValidationResult> {
  const obsidianRoot = config.obsidianBlogDir.trim();
  const hexoRoot = config.hexoBlogDir.trim();
  const hexoPostsRoot = hexoRoot ? path.join(hexoRoot, 'source', '_posts') : '';
  if (!obsidianRoot) {
    throw new Error('Obsidian Blog directory is not configured.');
  }
  if (!(await directoryExists(obsidianRoot))) {
    throw new Error(`Obsidian Blog directory does not exist: ${obsidianRoot}`);
  }
  if (hexoRoot && !(await directoryExists(hexoRoot))) {
    throw new Error(`Hexo Blog directory does not exist: ${hexoRoot}`);
  }

  const obsidianMarkdownFiles: string[] = [];
  const hexoMarkdownFiles: string[] = [];
  for (const dirName of SYNCED_BLOG_DIRS) {
    obsidianMarkdownFiles.push(...await walkMarkdownFiles(obsidianRoot, path.join(obsidianRoot, dirName)));
    if (hexoPostsRoot) {
      hexoMarkdownFiles.push(...await walkMarkdownFiles(hexoPostsRoot, path.join(hexoPostsRoot, dirName)));
    }
  }

  const issues: BlogValidationIssue[] = [];
  const obsidianFilesByKey = new Map<string, MarkdownFileInfo[]>();
  const hexoFilesByKey = new Map<string, MarkdownFileInfo[]>();

  for (const absolutePath of obsidianMarkdownFiles) {
    try {
      const raw = await fs.readFile(absolutePath, 'utf8');
      const parsed = matter(raw);
      issues.push(...validateFileFields(absolutePath, obsidianRoot, parsed.data));

      const section = path.relative(obsidianRoot, absolutePath).split(path.sep)[0];
      const fileInfo = await collectMarkdownInfo('obsidian', obsidianRoot, section, absolutePath);
      if (fileInfo) {
        addFileByUuid(obsidianFilesByKey, fileInfo);
      }
    }
    catch (error) {
      pushIssue(
        issues,
        'obsidian',
        absolutePath,
        obsidianRoot,
        'frontmatter',
        `无法读取或解析 frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  for (const absolutePath of hexoMarkdownFiles) {
    try {
      const raw = await fs.readFile(absolutePath, 'utf8');
      const parsed = matter(raw);
      issues.push(...validateHexoUuidField(absolutePath, hexoPostsRoot, parsed.data));

      const section = path.relative(hexoPostsRoot, absolutePath).split(path.sep)[0];
      const fileInfo = await collectMarkdownInfo('hexo', hexoPostsRoot, section, absolutePath);
      if (fileInfo) {
        addFileByUuid(hexoFilesByKey, fileInfo);
      }
    }
    catch (error) {
      pushIssue(
        issues,
        'hexo',
        absolutePath,
        hexoPostsRoot,
        'frontmatter',
        `无法读取或解析 frontmatter: ${error instanceof Error ? error.message : String(error)}`,
        'warn',
      );
    }
  }

  addDuplicateUuidIssues(issues, 'obsidian', obsidianRoot, obsidianFilesByKey);
  if (hexoPostsRoot) {
    addDuplicateUuidIssues(issues, 'hexo', hexoPostsRoot, hexoFilesByKey);
    compareBlogSides(issues, obsidianRoot, hexoPostsRoot, obsidianFilesByKey, hexoFilesByKey);
  }

  const errorCount = issues.filter(issue => issue.severity === 'error').length;
  const warningCount = issues.length - errorCount;

  return {
    ok: issues.length === 0,
    issues,
    checkedFiles: obsidianMarkdownFiles.length + hexoMarkdownFiles.length,
    obsidianCheckedFiles: obsidianMarkdownFiles.length,
    hexoCheckedFiles: hexoMarkdownFiles.length,
    errorCount,
    warningCount,
  };
}
