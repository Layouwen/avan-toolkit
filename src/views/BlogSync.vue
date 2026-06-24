<script setup lang="ts">
import type { AppConfig, BlogValidationIssue, BlogValidationResult, ObsidianBlog } from '../electron-api.d';
import type { BlogTreeNode } from '@/components/BlogTree.vue';
import type { BadgeVariants } from '@/components/ui/badge';
import { CheckCircle2Icon, ExternalLinkIcon, FolderOpenIcon, Loader2Icon, PlusIcon, RefreshCwIcon, RotateCcwIcon, XIcon } from '@lucide/vue';
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import BlogTree from '@/components/BlogTree.vue';
import ConfirmButton from '@/components/ConfirmButton.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const { t } = useI18n();

interface LogLine {
  id: number;
  text: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

type BlogSortBy = 'fileName' | 'title' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

const config = ref<AppConfig>({
  obsidianBlogDir: '',
  hexoBlogDir: '',
  hexoEditorCommand: 'cursor',
  locale: '',
  agent: {
    baseURL: '',
    model: '',
    apiKey: '',
  },
  qzone: {
    loginMode: 'qr',
    qqNumber: '',
    qqPassword: '',
    playwrightProfileDir: '',
  },
  screensaver: {
    enabled: true,
    triggerIntervalMinutes: 45,
    countdownSeconds: 30,
    backgroundType: 'color',
    backgroundColor: '#1a3a2a',
    backgroundImagePath: '',
  },
  editorExtensions: {
    vsixDownloadDir: '',
  },
});
const logs = ref<LogLine[]>([]);
const blogs = ref<ObsidianBlog[]>([]);
const syncing = ref(false);
const pullingBlog = ref(false);
const loadingBlogs = ref(false);
const validatingBlogs = ref(false);
const creatingBlog = ref(false);
const deletingBlogId = ref('');
const deletingHexoIssueId = ref('');
const blogError = ref('');
const validationError = ref('');
const validationResult = ref<BlogValidationResult>({
  ok: true,
  issues: [],
  checkedFiles: 0,
  obsidianCheckedFiles: 0,
  hexoCheckedFiles: 0,
  errorCount: 0,
  warningCount: 0,
});
const openingValidationIssueId = ref('');
const status = ref<'idle' | 'syncing' | 'success' | 'error'>('idle');
const logContainer = ref<HTMLElement | null>(null);
const newBlogTitle = ref('');
const newBlogDirectory = ref('');
const newBlogTags = ref<string[]>([]);
const tagInputValue = ref('');
const newBlogCategories = ref('');
const createModalShow = ref(false);
const expandedBlogKeys = ref<Array<string | number>>([]);
const blogSortBy = ref<BlogSortBy>('updatedAt');
const blogSortOrder = ref<SortOrder>('desc');
const selectedTagFilters = ref<string[]>([]);
const contextMenuShow = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuNode = ref<BlogTreeNode | null>(null);
const contextMenuBlog = ref<ObsidianBlog | null>(null);
const renameModalShow = ref(false);
const renameMode = ref<'title' | 'fileName'>('title');
const renameValue = ref('');
const renaming = ref(false);
let logIdCounter = 0;

const directoryOptions = computed(() => {
  const keyword = newBlogDirectory.value.trim().toLowerCase();
  const directories = Array.from(new Set(
    blogs.value
      .map(blog => blog.directory)
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  return directories
    .filter(directory => !keyword || directory.toLowerCase().includes(keyword))
    .map(directory => ({
      label: directory,
      value: directory,
    }));
});

const categoryOptions = computed(() => {
  const keyword = newBlogCategories.value.trim().toLowerCase();
  const categoryPaths = Array.from(new Set([
    ...blogs.value.map(blog => blog.directory).filter(Boolean),
    ...blogs.value
      .map(blog => blog.categories.join('/'))
      .filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  return categoryPaths
    .filter(category => !keyword || category.toLowerCase().includes(keyword))
    .map(category => ({
      label: category,
      value: category,
    }));
});

const sortByOptions = computed(() => [
  { label: t('blogSync.blogs.sortByTime'), value: 'updatedAt' },
  { label: t('blogSync.blogs.sortByFileName'), value: 'fileName' },
  { label: t('blogSync.blogs.sortByTitle'), value: 'title' },
]);

const sortOrderOptions = computed(() => [
  { label: t('blogSync.blogs.sortDesc'), value: 'desc' },
  { label: t('blogSync.blogs.sortAsc'), value: 'asc' },
]);

const hexoEditorCommandOptions = computed(() => [
  { label: 'Cursor', value: 'cursor' },
  { label: 'VS Code', value: 'code' },
]);

const tagFilterOptions = computed(() => Array.from(new Set(
  blogs.value.flatMap(blog => blog.tags),
))
  .sort((a, b) => a.localeCompare(b))
  .map(tag => ({
    label: tag,
    value: tag,
  })));

const blogContextMenuOptions = computed(() => {
  const node = contextMenuNode.value;
  if (node?.kind === 'folder') {
    return [
      { label: t('blogSync.blogs.createInFolder'), key: 'create' },
    ];
  }

  return [
    { label: t('blogSync.blogs.renameTitle'), key: 'title' },
    { label: t('blogSync.blogs.renameFileName'), key: 'fileName' },
  ];
});

const contextMenuStyle = computed(() => ({
  left: `${contextMenuX.value}px`,
  top: `${contextMenuY.value}px`,
}));

const filteredBlogs = computed(() => {
  if (selectedTagFilters.value.length === 0) {
    return blogs.value;
  }

  return blogs.value.filter(blog =>
    selectedTagFilters.value.every(tag => blog.tags.includes(tag)),
  );
});

const sortedBlogs = computed(() => {
  const direction = blogSortOrder.value === 'asc' ? 1 : -1;
  return [...filteredBlogs.value].sort((a, b) => {
    if (blogSortBy.value === 'fileName') {
      return direction * a.fileName.localeCompare(b.fileName);
    }
    if (blogSortBy.value === 'title') {
      return direction * a.title.localeCompare(b.title);
    }
    return direction * a.updatedAt.localeCompare(b.updatedAt);
  });
});

const blogTreeData = computed<BlogTreeNode[]>(() => {
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

  for (const blog of sortedBlogs.value) {
    const directoryParts = blog.directory ? blog.directory.split('/').filter(Boolean) : [];
    const siblings = getFolder(directoryParts);
    siblings.push({
      key: `blog:${blog.relativePath}`,
      label: blog.title,
      kind: 'blog',
      blog,
    });
  }

  function sortNodes(nodes: BlogTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1;
      }
      if (a.kind === 'blog' && b.kind === 'blog') {
        const aBlog = a.blog;
        const bBlog = b.blog;
        if (aBlog && bBlog && blogSortBy.value === 'updatedAt') {
          const direction = blogSortOrder.value === 'asc' ? 1 : -1;
          return direction * aBlog.updatedAt.localeCompare(bBlog.updatedAt);
        }
        if (aBlog && bBlog && blogSortBy.value === 'fileName') {
          const direction = blogSortOrder.value === 'asc' ? 1 : -1;
          return direction * aBlog.fileName.localeCompare(bBlog.fileName);
        }
        if (blogSortBy.value === 'title') {
          const direction = blogSortOrder.value === 'asc' ? 1 : -1;
          return direction * a.label.localeCompare(b.label);
        }
      }
      return a.label.localeCompare(b.label);
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  }

  sortNodes(roots);
  return roots;
});

const allFolderKeys = computed(() => {
  const keys: Array<string | number> = [];

  function collect(nodes: BlogTreeNode[]) {
    for (const node of nodes) {
      if (node.kind === 'folder') {
        keys.push(node.key);
      }
      if (node.children) {
        collect(node.children);
      }
    }
  }

  collect(blogTreeData.value);
  return keys;
});

function plainConfig(): AppConfig {
  const current = toRaw(config.value);
  return {
    ...current,
    agent: {
      ...toRaw(current.agent),
    },
  };
}

onMounted(async () => {
  config.value = await window.electronAPI.getConfig();
  await loadBlogs();
  window.addEventListener('click', closeBlogContextMenu);
  window.electronAPI.onSyncLog((message, level) => {
    logs.value.push({ id: logIdCounter++, text: message, level: level as LogLine['level'] });
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  });
});

onUnmounted(() => {
  window.electronAPI.offSyncLog();
  window.removeEventListener('click', closeBlogContextMenu);
});

type BlogPathField = 'obsidianBlogDir' | 'hexoBlogDir';

async function browseDir(field: BlogPathField) {
  const dir = await window.electronAPI.selectDirectory();
  if (dir) {
    config.value[field] = dir;
    await window.electronAPI.setConfig(plainConfig());
    if (field === 'obsidianBlogDir') {
      await loadBlogs();
    }
  }
}

async function saveConfig() {
  await window.electronAPI.setConfig(plainConfig());
  await loadBlogs();
}

async function loadBlogs() {
  blogError.value = '';
  if (!config.value.obsidianBlogDir.trim()) {
    blogs.value = [];
    validationResult.value = emptyValidationResult();
    return;
  }

  loadingBlogs.value = true;
  try {
    await window.electronAPI.setConfig(plainConfig());
    blogs.value = await window.electronAPI.listObsidianBlogs();
    expandedBlogKeys.value = allFolderKeys.value;
    await loadValidation();
  }
  catch (error) {
    blogs.value = [];
    blogError.value = error instanceof Error ? error.message : String(error);
  }
  finally {
    loadingBlogs.value = false;
  }
}

async function loadValidation(): Promise<BlogValidationResult> {
  validationError.value = '';
  if (!config.value.obsidianBlogDir.trim()) {
    validationResult.value = emptyValidationResult();
    return validationResult.value;
  }

  validatingBlogs.value = true;
  try {
    await window.electronAPI.setConfig(plainConfig());
    validationResult.value = await window.electronAPI.validateObsidianBlogs();
    return validationResult.value;
  }
  catch (error) {
    validationResult.value = emptyValidationResult();
    validationError.value = error instanceof Error ? error.message : String(error);
    return validationResult.value;
  }
  finally {
    validatingBlogs.value = false;
  }
}

async function addBlog() {
  const title = newBlogTitle.value.trim();
  if (!title || creatingBlog.value) {
    return false;
  }

  creatingBlog.value = true;
  blogError.value = '';
  try {
    await window.electronAPI.setConfig(plainConfig());
    await window.electronAPI.createObsidianBlog({
      title,
      directory: newBlogDirectory.value.trim(),
      tags: [...newBlogTags.value],
      categories: parseCategoryPath(newBlogCategories.value),
    });
    newBlogTitle.value = '';
    newBlogTags.value = [];
    tagInputValue.value = '';
    newBlogCategories.value = '';
    createModalShow.value = false;
    await loadBlogs();
    return true;
  }
  catch (error) {
    blogError.value = error instanceof Error ? error.message : String(error);
    return false;
  }
  finally {
    creatingBlog.value = false;
  }
}

async function removeBlog(blog: ObsidianBlog) {
  deletingBlogId.value = blog.id;
  blogError.value = '';
  try {
    await window.electronAPI.deleteObsidianBlog(blog.relativePath);
    blogs.value = blogs.value.filter(item => item.id !== blog.id);
    await loadValidation();
  }
  catch (error) {
    blogError.value = error instanceof Error ? error.message : String(error);
  }
  finally {
    deletingBlogId.value = '';
  }
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function parseCategoryPath(value: string) {
  return value
    .split('/')
    .map(category => category.trim())
    .filter(Boolean);
}

function normalizeTreeDirectory(directory: string) {
  return directory.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function uniqueTags(tags: string[]) {
  const nextTags: string[] = [];
  for (const tag of tags.map(item => item.trim()).filter(Boolean)) {
    if (!nextTags.includes(tag)) {
      nextTags.push(tag);
    }
  }
  return nextTags;
}

function inferBlogDefaults(directory: string) {
  const normalized = normalizeTreeDirectory(directory);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) {
    return {
      directory: '',
      tags: [] as string[],
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

function resetCreateBlogForm() {
  newBlogTitle.value = '';
  newBlogDirectory.value = '';
  newBlogTags.value = [];
  tagInputValue.value = '';
  newBlogCategories.value = '';
}

function openCreateBlogModal(directory = '') {
  const defaults = inferBlogDefaults(directory);
  newBlogTitle.value = '';
  newBlogDirectory.value = defaults.directory;
  newBlogTags.value = defaults.tags;
  tagInputValue.value = '';
  newBlogCategories.value = defaults.categories;
  createModalShow.value = true;
}

function expandAllBlogFolders() {
  expandedBlogKeys.value = allFolderKeys.value;
}

function collapseAllBlogFolders() {
  expandedBlogKeys.value = [];
}

function addTag(value = tagInputValue.value) {
  const tags = value
    .split(/\s+/)
    .map(tag => tag.trim())
    .filter(Boolean);
  if (tags.length === 0) {
    tagInputValue.value = '';
    return;
  }

  const nextTags = [...newBlogTags.value];
  for (const tag of tags) {
    if (!nextTags.includes(tag)) {
      nextTags.push(tag);
    }
  }
  newBlogTags.value = nextTags;
  tagInputValue.value = '';
}

function removeTag(index: number) {
  newBlogTags.value = newBlogTags.value.filter((_, tagIndex) => tagIndex !== index);
}

function handleTagInputUpdate(value: string) {
  if (/\s/.test(value)) {
    addTag(value);
    return;
  }
  tagInputValue.value = value;
}

function handleTagInputKeydown(event: KeyboardEvent) {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    addTag();
    return;
  }

  if (event.key === 'Backspace' && !tagInputValue.value && newBlogTags.value.length > 0) {
    newBlogTags.value = newBlogTags.value.slice(0, -1);
  }
}

function openBlogContextMenu(event: MouseEvent, node: BlogTreeNode) {
  event.preventDefault();
  contextMenuNode.value = node;
  contextMenuBlog.value = node.blog || null;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextMenuShow.value = true;
}

function closeBlogContextMenu() {
  contextMenuShow.value = false;
}

function handleBlogContextMenuSelect(key: string) {
  contextMenuShow.value = false;
  const node = contextMenuNode.value;
  if (key === 'create' && node?.kind === 'folder') {
    openCreateBlogModal(node.directoryPath || '');
    return;
  }

  const blog = contextMenuBlog.value;
  if (!blog) {
    return;
  }

  if (key === 'title') {
    renameMode.value = 'title';
    renameValue.value = blog.title;
  }
  else if (key === 'fileName') {
    renameMode.value = 'fileName';
    renameValue.value = blog.fileName.replace(/\.md$/i, '');
  }
  else {
    return;
  }

  renameModalShow.value = true;
}

async function confirmRename() {
  const blog = contextMenuBlog.value;
  const value = renameValue.value.trim();
  if (!blog || !value || renaming.value) {
    return false;
  }

  renaming.value = true;
  blogError.value = '';
  try {
    await window.electronAPI.setConfig(plainConfig());
    const updated = renameMode.value === 'title'
      ? await window.electronAPI.renameObsidianBlogTitle(blog.relativePath, value)
      : await window.electronAPI.renameObsidianBlogFileName(blog.relativePath, value);

    blogs.value = blogs.value.map(item =>
      item.relativePath === blog.relativePath ? updated : item,
    );
    contextMenuBlog.value = updated;
    renameModalShow.value = false;
    await loadValidation();
    return true;
  }
  catch (error) {
    blogError.value = error instanceof Error ? error.message : String(error);
    return false;
  }
  finally {
    renaming.value = false;
  }
}

async function startSync() {
  if (syncing.value || pullingBlog.value)
    return;
  await window.electronAPI.setConfig(plainConfig());
  const validation = await loadValidation();
  if (validation.errorCount > 0) {
    status.value = 'error';
    logs.value = [
      {
        id: logIdCounter++,
        text: t('blogSync.validation.syncBlocked', { count: validation.errorCount }),
        level: 'error',
      },
    ];
    return;
  }

  syncing.value = true;
  status.value = 'syncing';
  logs.value = [];

  window.electronAPI.onSyncDone((success, error) => {
    syncing.value = false;
    status.value = success ? 'success' : 'error';
    void loadValidation();
    if (error) {
      logs.value.push({ id: logIdCounter++, text: t('blogSync.logs.failed', { error }), level: 'error' });
    }
    else {
      logs.value.push({ id: logIdCounter++, text: t('blogSync.logs.done'), level: 'success' });
    }
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  });

  await window.electronAPI.startSync();
}

async function pullBlog() {
  if (syncing.value || pullingBlog.value) {
    return;
  }

  await window.electronAPI.setConfig(plainConfig());
  pullingBlog.value = true;
  status.value = 'syncing';
  logs.value = [
    {
      id: logIdCounter++,
      text: t('blogSync.logs.pullStart'),
      level: 'info',
    },
  ];

  window.electronAPI.onSyncDone((success, error) => {
    pullingBlog.value = false;
    status.value = success ? 'success' : 'error';
    if (error) {
      logs.value.push({ id: logIdCounter++, text: t('blogSync.logs.pullFailed', { error }), level: 'error' });
    }
    else {
      logs.value.push({ id: logIdCounter++, text: t('blogSync.logs.pullDone'), level: 'success' });
    }
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  });

  await window.electronAPI.pullBlog();
}

function clearLogs() {
  logs.value = [];
}

function issueBadgeVariant(issue: BlogValidationIssue): BadgeVariants['variant'] {
  return issue.severity === 'error' ? 'destructive' : 'secondary';
}

function statusBadgeVariant(): BadgeVariants['variant'] {
  if (status.value === 'success') {
    return 'default';
  }
  if (status.value === 'error') {
    return 'destructive';
  }
  if (status.value === 'syncing') {
    return 'secondary';
  }
  return 'outline';
}

function logLineClass(level: LogLine['level']) {
  return {
    info: 'text-muted-foreground',
    success: 'text-foreground',
    warn: 'text-foreground',
    error: 'text-destructive',
  }[level];
}

function updateHexoEditorCommand(value: unknown) {
  if (value === 'cursor' || value === 'code') {
    config.value.hexoEditorCommand = value;
    void saveConfig();
  }
}

function updateBlogSortBy(value: unknown) {
  if (value === 'fileName' || value === 'title' || value === 'updatedAt') {
    blogSortBy.value = value;
  }
}

function updateBlogSortOrder(value: unknown) {
  if (value === 'asc' || value === 'desc') {
    blogSortOrder.value = value;
  }
}

function updateSelectedTagFilters(value: unknown) {
  selectedTagFilters.value = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function handleCreateModalOpen(open: boolean) {
  createModalShow.value = open;
  if (!open) {
    resetCreateBlogForm();
  }
}

function canDeleteHexoOrphanIssue(issue: BlogValidationIssue) {
  return issue.source === 'hexo' && issue.field === 'sync:missingObsidian';
}

function emptyValidationResult(): BlogValidationResult {
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

async function openValidationIssue(issue: BlogValidationIssue) {
  openingValidationIssueId.value = issue.id;
  validationError.value = '';
  try {
    await window.electronAPI.openBlogValidationIssue(issue.source, issue.absolutePath);
  }
  catch (error) {
    validationError.value = error instanceof Error ? error.message : String(error);
  }
  finally {
    openingValidationIssueId.value = '';
  }
}

async function deleteHexoOrphanBlog(issue: BlogValidationIssue) {
  deletingHexoIssueId.value = issue.id;
  validationError.value = '';
  try {
    await window.electronAPI.deleteHexoOrphanBlog(issue.relativePath);
    await loadValidation();
  }
  catch (error) {
    validationError.value = error instanceof Error ? error.message : String(error);
  }
  finally {
    deletingHexoIssueId.value = '';
  }
}

async function runValidationAction(action: () => Promise<void>) {
  validationError.value = '';
  try {
    await action();
  }
  catch (error) {
    validationError.value = error instanceof Error ? error.message : String(error);
  }
}

function openConfiguredBlogDir(kind: 'obsidian' | 'hexo') {
  return runValidationAction(() => window.electronAPI.openConfiguredBlogDir(kind));
}

function openObsidianPage() {
  return runValidationAction(() => window.electronAPI.openObsidianPage());
}

function openHexoProjectInEditor() {
  return runValidationAction(() => window.electronAPI.openHexoProjectInEditor());
}
</script>

<template>
  <main class="p-6 min-h-full">
    <Tabs default-value="sync" class="gap-4">
      <TabsList>
        <TabsTrigger value="sync">
          {{ t('blogSync.tabs.sync') }}
        </TabsTrigger>
        <TabsTrigger value="blogs">
          {{ t('blogSync.tabs.blogs') }}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sync">
        <div class="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle class="text-base">
                {{ t('blogSync.config.title') }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel for="obsidian-blog-dir">
                    {{ t('blogSync.config.obsidianBlogDir') }}
                  </FieldLabel>
                  <div class="flex w-full items-center gap-2">
                    <Input
                      id="obsidian-blog-dir"
                      v-model="config.obsidianBlogDir"
                      class="min-w-0 flex-1"
                      :placeholder="t('blogSync.config.obsidianPlaceholder')"
                      @blur="saveConfig"
                    />
                    <Button variant="secondary" @click="browseDir('obsidianBlogDir')">
                      <FolderOpenIcon data-icon="inline-start" />
                      {{ t('blogSync.config.browse') }}
                    </Button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel for="hexo-blog-dir">
                    {{ t('blogSync.config.hexoBlogDir') }}
                  </FieldLabel>
                  <div class="flex w-full items-center gap-2">
                    <Input
                      id="hexo-blog-dir"
                      v-model="config.hexoBlogDir"
                      class="min-w-0 flex-1"
                      :placeholder="t('blogSync.config.hexoPlaceholder')"
                      @blur="saveConfig"
                    />
                    <Button variant="secondary" @click="browseDir('hexoBlogDir')">
                      <FolderOpenIcon data-icon="inline-start" />
                      {{ t('blogSync.config.browse') }}
                    </Button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel>{{ t('blogSync.config.hexoEditorCommand') }}</FieldLabel>
                  <Select :model-value="config.hexoEditorCommand" @update:model-value="updateHexoEditorCommand">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem v-for="option in hexoEditorCommandOptions" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div class="flex flex-wrap items-center gap-2">
                <Button
                  :disabled="syncing || pullingBlog || !config.obsidianBlogDir || !config.hexoBlogDir"
                  @click="startSync"
                >
                  <Loader2Icon v-if="syncing" data-icon="inline-start" class="animate-spin" />
                  <CheckCircle2Icon v-else data-icon="inline-start" />
                  {{ syncing ? t('blogSync.action.syncing') : t('blogSync.action.sync') }}
                </Button>
                <Button
                  variant="secondary"
                  :disabled="syncing || pullingBlog || !config.hexoBlogDir"
                  @click="pullBlog"
                >
                  <Loader2Icon v-if="pullingBlog" data-icon="inline-start" class="animate-spin" />
                  <RotateCcwIcon v-else data-icon="inline-start" />
                  {{ pullingBlog ? t('blogSync.action.pulling') : t('blogSync.action.pull') }}
                </Button>
                <Badge :variant="statusBadgeVariant()">
                  {{ t(`blogSync.status.${status}`) }}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card class="min-h-0 flex-1">
            <CardHeader class="flex flex-row items-center justify-between">
              <CardTitle class="text-base">
                {{ t('blogSync.logs.title') }}
              </CardTitle>
              <Button variant="ghost" size="sm" @click="clearLogs">
                {{ t('blogSync.logs.clear') }}
              </Button>
            </CardHeader>
            <CardContent>
              <div
                ref="logContainer"
                class="h-[360px] overflow-y-auto rounded-md border bg-background p-3 font-mono text-[12.5px] leading-relaxed"
              >
                <div
                  v-for="line in logs"
                  :key="line.id"
                  class="whitespace-pre-wrap break-all"
                  :class="logLineClass(line.level)"
                >
                  {{ line.text }}
                </div>

                <div v-if="logs.length === 0" class="mt-5 text-center text-muted-foreground italic">
                  {{ t('blogSync.logs.empty') }}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle class="text-base">
                  {{ t('blogSync.validation.title') }}
                </CardTitle>
                <div class="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="!config.obsidianBlogDir"
                    @click="openConfiguredBlogDir('obsidian')"
                  >
                    <FolderOpenIcon data-icon="inline-start" />
                    {{ t('blogSync.validation.openObsidianDir') }}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="!config.hexoBlogDir"
                    @click="openConfiguredBlogDir('hexo')"
                  >
                    <FolderOpenIcon data-icon="inline-start" />
                    {{ t('blogSync.validation.openHexoDir') }}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="!config.obsidianBlogDir"
                    @click="openObsidianPage"
                  >
                    <ExternalLinkIcon data-icon="inline-start" />
                    {{ t('blogSync.validation.openObsidianPage') }}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="!config.hexoBlogDir"
                    @click="openHexoProjectInEditor"
                  >
                    <ExternalLinkIcon data-icon="inline-start" />
                    {{ t('blogSync.validation.openProjectDir') }}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="!config.obsidianBlogDir"
                    @click="loadValidation"
                  >
                    <Loader2Icon v-if="validatingBlogs" data-icon="inline-start" class="animate-spin" />
                    <RefreshCwIcon v-else data-icon="inline-start" />
                    {{ t('blogSync.validation.refresh') }}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent class="flex flex-col gap-3">
              <Alert v-if="validationError" variant="destructive">
                <AlertDescription class="flex items-start justify-between gap-3">
                  <span>{{ validationError }}</span>
                  <Button variant="ghost" size="icon-sm" @click="validationError = ''">
                    <XIcon />
                  </Button>
                </AlertDescription>
              </Alert>

              <Alert
                v-if="validationResult.ok"
              >
                <AlertDescription>
                  {{ t('blogSync.validation.ok', {
                    count: validationResult.checkedFiles,
                    obsidian: validationResult.obsidianCheckedFiles,
                    hexo: validationResult.hexoCheckedFiles,
                  }) }}
                </AlertDescription>
              </Alert>

              <template v-else>
                <Alert :variant="validationResult.errorCount > 0 ? 'destructive' : 'default'">
                  <AlertDescription>
                    {{ t('blogSync.validation.failed', {
                      count: validationResult.issues.length,
                      errors: validationResult.errorCount,
                      warnings: validationResult.warningCount,
                    }) }}
                  </AlertDescription>
                </Alert>
                <div class="validation-list">
                  <div
                    v-for="issue in validationResult.issues"
                    :key="issue.id"
                    class="validation-row"
                  >
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <Badge :variant="issue.source === 'hexo' ? 'secondary' : 'outline'">
                          {{ issue.source }}
                        </Badge>
                        <Badge :variant="issueBadgeVariant(issue)">
                          {{ issue.field }}
                        </Badge>
                        <span class="break-all text-foreground">{{ issue.relativePath }}</span>
                      </div>
                      <div class="mt-1 text-sm text-muted-foreground">
                        {{ issue.message }}
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <ConfirmButton
                        v-if="canDeleteHexoOrphanIssue(issue)"
                        :title="t('blogSync.validation.deleteHexoOrphan')"
                        :description="t('blogSync.validation.deleteHexoOrphanPrompt', { path: issue.relativePath })"
                        :confirm-text="t('blogSync.validation.confirmDeleteHexoOrphan')"
                        :cancel-text="t('blogSync.validation.cancelDeleteHexoOrphan')"
                        variant="destructive"
                        size="sm"
                        :disabled="Boolean(deletingHexoIssueId)"
                        @confirm="deleteHexoOrphanBlog(issue)"
                      >
                        <Loader2Icon v-if="deletingHexoIssueId === issue.id" data-icon="inline-start" class="animate-spin" />
                        {{ t('blogSync.validation.deleteHexoOrphan') }}
                      </ConfirmButton>
                      <Button
                        size="sm"
                        variant="secondary"
                        :disabled="Boolean(openingValidationIssueId)"
                        @click="openValidationIssue(issue)"
                      >
                        <Loader2Icon v-if="openingValidationIssueId === issue.id" data-icon="inline-start" class="animate-spin" />
                        {{ t('blogSync.validation.open') }}
                      </Button>
                    </div>
                  </div>
                </div>
              </template>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="blogs">
        <Card>
          <CardHeader>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle class="text-base">
                {{ t('blogSync.blogs.title') }}
              </CardTitle>
              <div class="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  :disabled="!config.obsidianBlogDir || creatingBlog"
                  @click="openCreateBlogModal()"
                >
                  <PlusIcon data-icon="inline-start" />
                  {{ t('blogSync.blogs.add') }}
                </Button>
                <Button size="sm" variant="secondary" :disabled="loadingBlogs" @click="loadBlogs">
                  <Loader2Icon v-if="loadingBlogs" data-icon="inline-start" class="animate-spin" />
                  <RefreshCwIcon v-else data-icon="inline-start" />
                  {{ t('blogSync.blogs.refresh') }}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent class="flex flex-col gap-4">
            <Alert v-if="blogError" variant="destructive">
              <AlertDescription class="flex items-start justify-between gap-3">
                <span>{{ blogError }}</span>
                <Button variant="ghost" size="icon-sm" @click="blogError = ''">
                  <XIcon />
                </Button>
              </AlertDescription>
            </Alert>

            <template v-if="blogs.length > 0">
              <div class="flex flex-col gap-3">
                <div v-if="tagFilterOptions.length > 0" class="flex flex-col gap-2">
                  <div class="text-xs text-muted-foreground">
                    {{ t('blogSync.blogs.tagSearchPlaceholder') }}
                  </div>
                  <ToggleGroup
                    type="multiple"
                    :model-value="selectedTagFilters"
                    class="flex flex-wrap justify-start gap-2"
                    @update:model-value="updateSelectedTagFilters"
                  >
                    <ToggleGroupItem v-for="option in tagFilterOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <Select :model-value="blogSortBy" @update:model-value="updateBlogSortBy">
                    <SelectTrigger class="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem v-for="option in sortByOptions" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select :model-value="blogSortOrder" @update:model-value="updateBlogSortOrder">
                    <SelectTrigger class="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem v-for="option in sortOrderOptions" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="secondary" @click="expandAllBlogFolders">
                    {{ t('blogSync.blogs.expandAll') }}
                  </Button>
                  <Button size="sm" variant="secondary" @click="collapseAllBlogFolders">
                    {{ t('blogSync.blogs.collapseAll') }}
                  </Button>
                </div>
              </div>

              <div
                v-if="contextMenuShow"
                class="fixed z-50 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                :style="contextMenuStyle"
                @click.stop
              >
                <Button
                  v-for="option in blogContextMenuOptions"
                  :key="option.key"
                  variant="ghost"
                  class="w-full justify-start"
                  @click="handleBlogContextMenuSelect(option.key)"
                >
                  {{ option.label }}
                </Button>
              </div>

              <BlogTree
                v-if="sortedBlogs.length > 0"
                :nodes="blogTreeData"
                :expanded-keys="expandedBlogKeys"
                :deleting-blog-id="deletingBlogId"
                :remove-label="t('blogSync.blogs.remove')"
                :remove-title="t('blogSync.blogs.remove')"
                :remove-confirm-text="t('blogSync.blogs.confirmRemove')"
                :remove-cancel-text="t('blogSync.blogs.cancelRemove')"
                :remove-prompt="(blog: ObsidianBlog) => t('blogSync.blogs.removePrompt', { title: blog.title })"
                :format-updated-at="formatUpdatedAt"
                @update:expanded-keys="expandedBlogKeys = $event"
                @contextmenu="openBlogContextMenu"
                @remove="removeBlog"
              />
              <Empty v-else>
                <EmptyHeader>
                  <EmptyTitle>{{ t('blogSync.blogs.noTagMatches') }}</EmptyTitle>
                  <EmptyDescription>{{ t('blogSync.blogs.noTagMatches') }}</EmptyDescription>
                </EmptyHeader>
              </Empty>

              <Dialog v-model:open="renameModalShow">
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{{ renameMode === 'title' ? t('blogSync.blogs.renameTitle') : t('blogSync.blogs.renameFileName') }}</DialogTitle>
                  </DialogHeader>
                  <Input
                    v-model="renameValue"
                    :placeholder="renameMode === 'title'
                      ? t('blogSync.blogs.renameTitlePlaceholder')
                      : t('blogSync.blogs.renameFileNamePlaceholder')"
                    @keyup.enter="confirmRename"
                  />
                  <DialogFooter>
                    <Button variant="secondary" @click="renameModalShow = false">
                      {{ t('blogSync.blogs.renameCancel') }}
                    </Button>
                    <Button :disabled="!renameValue.trim() || renaming" @click="confirmRename">
                      <Loader2Icon v-if="renaming" data-icon="inline-start" class="animate-spin" />
                      {{ t('blogSync.blogs.renameConfirm') }}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <Empty v-else>
              <EmptyHeader>
                <EmptyTitle>{{ loadingBlogs ? t('blogSync.blogs.loading') : t('blogSync.blogs.empty') }}</EmptyTitle>
              </EmptyHeader>
            </Empty>

            <Dialog :open="createModalShow" @update:open="handleCreateModalOpen">
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{{ t('blogSync.blogs.createTitle') }}</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel for="new-blog-title">
                      {{ t('blogSync.blogs.titleLabel') }}
                    </FieldLabel>
                    <Input
                      id="new-blog-title"
                      v-model="newBlogTitle"
                      :placeholder="t('blogSync.blogs.newTitlePlaceholder')"
                      :disabled="!config.obsidianBlogDir || creatingBlog"
                      @keyup.enter="addBlog"
                    />
                  </Field>
                  <Field>
                    <FieldLabel for="new-blog-directory">
                      {{ t('blogSync.blogs.directoryLabel') }}
                    </FieldLabel>
                    <Input
                      id="new-blog-directory"
                      v-model="newBlogDirectory"
                      list="blog-directory-options"
                      :placeholder="t('blogSync.blogs.directoryPlaceholder')"
                      :disabled="!config.obsidianBlogDir || creatingBlog"
                      @keyup.enter="addBlog"
                    />
                    <datalist id="blog-directory-options">
                      <option v-for="option in directoryOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </datalist>
                  </Field>
                  <Field>
                    <FieldLabel>{{ t('blogSync.blogs.tagsLabel') }}</FieldLabel>
                    <div
                      class="tag-input-shell w-full"
                      :class="{ 'tag-input-shell--disabled': !config.obsidianBlogDir || creatingBlog }"
                    >
                      <Badge
                        v-for="(tag, index) in newBlogTags"
                        :key="tag"
                        variant="secondary"
                        class="gap-1"
                      >
                        {{ tag }}
                        <button
                          type="button"
                          :disabled="!config.obsidianBlogDir || creatingBlog"
                          class="rounded-full text-muted-foreground hover:text-foreground disabled:pointer-events-none"
                          @click="removeTag(index)"
                        >
                          <XIcon class="size-3" />
                        </button>
                      </Badge>
                      <Input
                        :value="tagInputValue"
                        class="tag-input-field"
                        :placeholder="t('blogSync.blogs.tagsPlaceholder')"
                        :disabled="!config.obsidianBlogDir || creatingBlog"
                        @update:model-value="value => handleTagInputUpdate(String(value))"
                        @keydown="handleTagInputKeydown"
                        @blur="addTag()"
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel for="new-blog-categories">
                      {{ t('blogSync.blogs.categoriesLabel') }}
                    </FieldLabel>
                    <Input
                      id="new-blog-categories"
                      v-model="newBlogCategories"
                      list="blog-category-options"
                      :placeholder="t('blogSync.blogs.categoriesPlaceholder')"
                      :disabled="!config.obsidianBlogDir || creatingBlog"
                      @keyup.enter="addBlog"
                    />
                    <datalist id="blog-category-options">
                      <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </datalist>
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button variant="secondary" @click="createModalShow = false">
                    {{ t('blogSync.blogs.createCancel') }}
                  </Button>
                  <Button
                    :disabled="!config.obsidianBlogDir || !newBlogTitle.trim() || creatingBlog"
                    @click="addBlog"
                  >
                    <Loader2Icon v-if="creatingBlog" data-icon="inline-start" class="animate-spin" />
                    {{ t('blogSync.blogs.createConfirm') }}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </main>
</template>

<style scoped>
.tag-input-shell {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  background: transparent;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.tag-input-shell:focus-within {
  border-color: var(--ring);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--ring) 35%, transparent);
}

.tag-input-shell--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.tag-input-field {
  min-width: 72px;
  flex: 1;
}

.validation-list {
  display: flex;
  max-height: 320px;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.validation-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
}
</style>
