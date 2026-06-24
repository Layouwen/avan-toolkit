import type { BlogValidationResult, ObsidianBlog } from '../../electron-api.d';
import type { BlogTreeNode } from './types';

export type BlogSortBy = 'fileName' | 'title' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

interface BlogDefaults {
  directory: string;
  tags: string[];
  categories: string;
}

export function parseCategoryPath(value: string): string[] {
  return value
    .split('/')
    .map(category => category.trim())
    .filter(Boolean);
}

export function normalizeTreeDirectory(directory: string): string {
  return directory.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function uniqueTags(tags: string[]): string[] {
  const nextTags: string[] = [];
  for (const tag of tags.map(item => item.trim()).filter(Boolean)) {
    if (!nextTags.includes(tag)) {
      nextTags.push(tag);
    }
  }
  return nextTags;
}

export function inferBlogDefaults(directory: string): BlogDefaults {
  const normalized = normalizeTreeDirectory(directory);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) {
    return {
      directory: '',
      tags: [],
      categories: '',
    };
  }

  const [root, ...children] = parts;
  const lastPart = children[children.length - 1] || root;

  if (root === 'summary') {
    return {
      directory: normalized,
      tags: uniqueTags(['汇总', ...(children.length > 0 ? [lastPart] : [])]),
      categories: ['汇总', ...children].join('/'),
    };
  }

  if (root === 'article') {
    return {
      directory: normalized,
      tags: uniqueTags(['博客', ...(children.length > 0 ? [lastPart] : [])]),
      categories: ['博客', ...children].join('/'),
    };
  }

  return {
    directory: normalized,
    tags: uniqueTags([lastPart]),
    categories: parts.join('/'),
  };
}

export function emptyValidationResult(): BlogValidationResult {
  return {
    ok: true,
    issues: [],
    checkedFiles: 0,
    obsidianCheckedFiles: 0,
    hexoCheckedFiles: 0,
    errorCount: 0,
    warningCount: 0,
  };
}

export function filterBlogsBySelectedTags(blogs: ObsidianBlog[], selectedTags: string[]): ObsidianBlog[] {
  if (selectedTags.length === 0) {
    return blogs;
  }

  return blogs.filter(blog =>
    selectedTags.every(tag => blog.tags.includes(tag)),
  );
}

export function sortBlogs(blogs: ObsidianBlog[], sortBy: BlogSortBy, sortOrder: SortOrder): ObsidianBlog[] {
  const direction = sortOrder === 'asc' ? 1 : -1;
  return [...blogs].sort((a, b) => direction * compareBlogs(a, b, sortBy));
}

export function buildBlogTree(blogs: ObsidianBlog[], sortBy: BlogSortBy, sortOrder: SortOrder): BlogTreeNode[] {
  const roots: BlogTreeNode[] = [];
  const folderMap = new Map<string, BlogTreeNode>();

  function getFolder(pathParts: string[]): BlogTreeNode[] {
    let siblings = roots;
    let currentPath = '';

    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let folder = folderMap.get(currentPath);
      if (!folder) {
        folder = {
          key: `dir:${currentPath}`,
          label: part,
          kind: 'folder',
          directoryPath: currentPath,
          children: [],
        };
        folderMap.set(currentPath, folder);
        siblings.push(folder);
      }
      siblings = folder.children || [];
    }

    return siblings;
  }

  for (const blog of blogs) {
    const directoryParts = blog.directory ? blog.directory.split('/').filter(Boolean) : [];
    const siblings = getFolder(directoryParts);
    siblings.push({
      key: `blog:${blog.relativePath}`,
      label: blog.title,
      kind: 'blog',
      blog,
    });
  }

  sortTreeNodes(roots, sortBy, sortOrder);
  return roots;
}

export function collectBlogTreeFolderKeys(nodes: BlogTreeNode[]): string[] {
  const keys: string[] = [];

  function collect(currentNodes: BlogTreeNode[]) {
    for (const node of currentNodes) {
      if (node.kind === 'folder') {
        keys.push(node.key);
      }
      if (node.children) {
        collect(node.children);
      }
    }
  }

  collect(nodes);
  return keys;
}

function sortTreeNodes(nodes: BlogTreeNode[], sortBy: BlogSortBy, sortOrder: SortOrder): void {
  nodes.sort((a, b) => compareTreeNodes(a, b, sortBy, sortOrder));
  for (const node of nodes) {
    if (node.children) {
      sortTreeNodes(node.children, sortBy, sortOrder);
    }
  }
}

function compareTreeNodes(
  a: BlogTreeNode,
  b: BlogTreeNode,
  sortBy: BlogSortBy,
  sortOrder: SortOrder,
): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  if (a.kind === 'blog' && b.kind === 'blog' && a.blog && b.blog) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return direction * compareBlogs(a.blog, b.blog, sortBy);
  }

  return a.label.localeCompare(b.label);
}

function compareBlogs(a: ObsidianBlog, b: ObsidianBlog, sortBy: BlogSortBy): number {
  if (sortBy === 'fileName') {
    return a.fileName.localeCompare(b.fileName);
  }
  if (sortBy === 'title') {
    return a.title.localeCompare(b.title);
  }
  return a.updatedAt.localeCompare(b.updatedAt);
}
