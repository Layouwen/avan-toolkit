import type { Dirent } from 'node:fs';
import type { AppConfig } from './configManager';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { v4 as uuidv4 } from 'uuid';

export interface ObsidianBlog {
  id: string;
  title: string;
  fileName: string;
  directory: string;
  relativePath: string;
  absolutePath: string;
  updatedAt: string;
  tags: string[];
  categories: string[];
}

export interface CreateObsidianBlogPayload {
  title: string;
  directory?: string;
  tags?: string[];
  categories?: string[];
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

function assertConfigured(config: AppConfig): string {
  const root = config.obsidianBlogDir.trim();
  if (!root) {
    throw new Error('Obsidian Blog directory is not configured.');
  }
  return root;
}

function assertInside(parent: string, target: string): void {
  const relative = path.relative(parent, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path is outside the Obsidian blog directory.');
  }
}

function titleFromFileName(fileName: string): string {
  return path.basename(fileName, '.md').replace(/^\d+-/, '').replace(/[-_]+/g, ' ');
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

function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|#^[\]{}]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || `blog-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
}

function normalizeDirectory(directory: string | undefined): string {
  const normalized = path.normalize((directory || '').trim());
  if (!normalized || normalized === '.') {
    return '';
  }
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error('Blog directory must be inside the Obsidian blog directory.');
  }
  return normalized;
}

async function uniqueFilePath(dir: string, slug: string): Promise<string> {
  let index = 0;
  while (true) {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    const candidate = path.join(dir, `${slug}${suffix}.md`);
    try {
      await fs.access(candidate);
      index++;
    }
    catch {
      return candidate;
    }
  }
}

async function walkMarkdownFiles(root: string, dir: string): Promise<ObsidianBlog[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  }
  catch {
    return [];
  }

  const blogs: ObsidianBlog[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      blogs.push(...await walkMarkdownFiles(root, absolutePath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    blogs.push(await readBlogFile(root, absolutePath));
  }
  return blogs;
}

async function readBlogFile(root: string, absolutePath: string): Promise<ObsidianBlog> {
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = matter(raw);
  const stat = await fs.stat(absolutePath);
  const relativePath = path.relative(root, absolutePath);
  const fileName = path.basename(absolutePath);
  const directory = path.dirname(relativePath);

  return {
    id: relativePath,
    title: typeof parsed.data.title === 'string' && parsed.data.title.trim()
      ? parsed.data.title.trim()
      : titleFromFileName(fileName),
    fileName,
    directory: directory === '.' ? '' : directory,
    relativePath,
    absolutePath,
    updatedAt: stat.mtime.toISOString(),
    tags: normalizeStringArray(parsed.data.tags),
    categories: normalizeStringArray(parsed.data.categories),
  };
}

export async function listObsidianBlogs(config: AppConfig): Promise<ObsidianBlog[]> {
  const root = assertConfigured(config);
  if (!(await directoryExists(root))) {
    throw new Error(`Obsidian Blog directory does not exist: ${root}`);
  }

  const blogs = await walkMarkdownFiles(root, root);

  return blogs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createObsidianBlog(
  config: AppConfig,
  payload: CreateObsidianBlogPayload,
): Promise<ObsidianBlog> {
  const root = assertConfigured(config);
  const title = payload.title.trim();
  if (!title) {
    throw new Error('Blog title is required.');
  }

  const targetDir = path.resolve(root, normalizeDirectory(payload.directory));
  assertInside(root, targetDir);
  await fs.mkdir(targetDir, { recursive: true });

  const filePath = await uniqueFilePath(targetDir, slugifyTitle(title));
  const now = new Date().toISOString();
  const content = matter.stringify('', {
    title,
    uuid: uuidv4(),
    date: now.slice(0, 10),
    tags: payload.tags || [],
    categories: payload.categories || [],
  });
  await fs.writeFile(filePath, `${content.trim()}\n\n`, 'utf8');

  return readBlogFile(root, filePath);
}

export async function deleteObsidianBlog(
  config: AppConfig,
  relativePath: string,
): Promise<void> {
  const root = assertConfigured(config);
  if (!relativePath || !relativePath.endsWith('.md')) {
    throw new Error('Only markdown blog files can be removed.');
  }

  const filePath = path.resolve(root, relativePath);
  assertInside(root, filePath);
  await fs.unlink(filePath);
}

function resolveBlogFilePath(root: string, relativePath: string): string {
  if (!relativePath || !relativePath.endsWith('.md')) {
    throw new Error('Only markdown blog files can be updated.');
  }

  const filePath = path.resolve(root, relativePath);
  assertInside(root, filePath);
  return filePath;
}

function normalizeFileName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('File name is required.');
  }

  const name = trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`;
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Invalid file name.');
  }
  if (/[\\/:*?"<>|]/.test(name.slice(0, -3))) {
    throw new Error('File name contains invalid characters.');
  }

  return name;
}

export async function renameObsidianBlogTitle(
  config: AppConfig,
  relativePath: string,
  title: string,
): Promise<ObsidianBlog> {
  const root = assertConfigured(config);
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error('Blog title is required.');
  }

  const filePath = resolveBlogFilePath(root, relativePath);
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = matter(raw);
  const content = matter.stringify(parsed.content, {
    ...parsed.data,
    title: trimmed,
  });
  await fs.writeFile(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');

  return readBlogFile(root, filePath);
}

export async function renameObsidianBlogFileName(
  config: AppConfig,
  relativePath: string,
  fileName: string,
): Promise<ObsidianBlog> {
  const root = assertConfigured(config);
  const oldPath = resolveBlogFilePath(root, relativePath);
  const newFileName = normalizeFileName(fileName);
  const newPath = path.join(path.dirname(oldPath), newFileName);

  assertInside(root, newPath);

  if (oldPath === newPath) {
    return readBlogFile(root, oldPath);
  }

  try {
    await fs.access(newPath);
    throw new Error('A file with that name already exists.');
  }
  catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.rename(oldPath, newPath);
  return readBlogFile(root, newPath);
}
