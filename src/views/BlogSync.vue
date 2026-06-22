<script setup lang="ts">
import type { TreeOption } from 'naive-ui';
import type { AppConfig, BlogValidationIssue, BlogValidationResult, ObsidianBlog } from '../electron-api.d';
import {
  NAlert,
  NAutoComplete,
  NButton,
  NCard,
  NDropdown,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  NThing,
  NTree,
} from 'naive-ui';
import { computed, h, nextTick, onMounted, onUnmounted, ref, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface LogLine {
  id: number;
  text: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

type BlogTreeNode = TreeOption & {
  key: string;
  label: string;
  kind: 'folder' | 'blog';
  directoryPath?: string;
  blog?: ObsidianBlog;
  children?: BlogTreeNode[];
};

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

const tagFilterSelectStyle = computed(() => {
  const labels = selectedTagFilters.value.length > 0
    ? selectedTagFilters.value
    : [t('blogSync.blogs.tagSearchPlaceholder')];
  const contentWidth = labels.reduce((width, label) => width + label.length * 8 + 42, 48);
  return {
    width: `${Math.min(Math.max(contentWidth, 220), 560)}px`,
    maxWidth: '100%',
  };
});

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
      isLeaf: true,
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

function showDirectoryOptions() {
  return directoryOptions.value.length > 0;
}

function showCategoryOptions() {
  return categoryOptions.value.length > 0;
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

function renderBlogTreeLabel({ option }: { option: TreeOption }) {
  const node = option as BlogTreeNode;
  if (node.kind === 'folder') {
    const count = countBlogs(node);
    return h('span', { class: 'font-medium text-[#d8dee9]' }, `${node.label} (${count})`);
  }

  const blog = node.blog;
  const tagNodes = blog && blog.tags.length > 0
    ? h(
        'div',
        { class: 'mt-1 flex flex-wrap gap-1' },
        blog.tags.map(tag => h(
          NTag,
          {
            key: tag,
            size: 'small',
            type: 'info',
            round: true,
          },
          { default: () => tag },
        )),
      )
    : null;

  return h('div', { class: 'min-w-0 py-1' }, [
    h('div', { class: 'truncate text-[#e5e7eb]' }, node.label),
    blog
      ? h('div', { class: 'text-xs text-[#94a3b8] break-all' }, `${blog.relativePath} · ${formatUpdatedAt(blog.updatedAt)}`)
      : null,
    tagNodes,
  ]);
}

function renderBlogTreeSuffix({ option }: { option: TreeOption }) {
  const node = option as BlogTreeNode;
  const blog = node.blog;
  if (!blog) {
    return null;
  }

  return h(
    NPopconfirm,
    {
      positiveText: t('blogSync.blogs.confirmRemove'),
      negativeText: t('blogSync.blogs.cancelRemove'),
      onPositiveClick: () => removeBlog(blog),
    },
    {
      trigger: () => h(
        NButton,
        {
          size: 'small',
          type: 'error',
          tertiary: true,
          loading: deletingBlogId.value === blog.id,
          onClick: (event: MouseEvent) => event.stopPropagation(),
        },
        { default: () => t('blogSync.blogs.remove') },
      ),
      default: () => t('blogSync.blogs.removePrompt', { title: blog.title }),
    },
  );
}

function countBlogs(node: BlogTreeNode): number {
  if (node.kind === 'blog') {
    return 1;
  }
  return (node.children || []).reduce((count, child) => count + countBlogs(child as BlogTreeNode), 0);
}

function openBlogContextMenu(event: MouseEvent, node: BlogTreeNode) {
  event.preventDefault();
  contextMenuNode.value = node;
  contextMenuBlog.value = node.blog || null;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextMenuShow.value = true;
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

function blogNodeProps({ option }: { option: TreeOption }) {
  const node = option as BlogTreeNode;
  return {
    onContextmenu: (event: MouseEvent) => openBlogContextMenu(event, node),
  };
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

function issueTagType(issue: BlogValidationIssue) {
  return issue.severity === 'error' ? 'error' : 'warning';
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
    <NTabs type="line" animated>
      <NTabPane name="sync" :tab="t('blogSync.tabs.sync')">
        <div class="flex flex-col gap-5">
          <NCard :title="t('blogSync.config.title')" embedded>
            <NForm label-placement="top">
              <NFormItem :label="t('blogSync.config.obsidianBlogDir')">
                <div class="flex w-full items-center gap-2">
                  <NInput
                    v-model:value="config.obsidianBlogDir"
                    class="min-w-0 flex-1"
                    :placeholder="t('blogSync.config.obsidianPlaceholder')"
                    @blur="saveConfig"
                  />
                  <NButton @click="browseDir('obsidianBlogDir')">
                    {{ t('blogSync.config.browse') }}
                  </NButton>
                </div>
              </NFormItem>

              <NFormItem :label="t('blogSync.config.hexoBlogDir')">
                <div class="flex w-full items-center gap-2">
                  <NInput
                    v-model:value="config.hexoBlogDir"
                    class="min-w-0 flex-1"
                    :placeholder="t('blogSync.config.hexoPlaceholder')"
                    @blur="saveConfig"
                  />
                  <NButton @click="browseDir('hexoBlogDir')">
                    {{ t('blogSync.config.browse') }}
                  </NButton>
                </div>
              </NFormItem>

              <NFormItem :label="t('blogSync.config.hexoEditorCommand')">
                <NSelect
                  v-model:value="config.hexoEditorCommand"
                  :options="hexoEditorCommandOptions"
                  @update:value="saveConfig"
                />
              </NFormItem>
            </NForm>
          </NCard>

          <NCard embedded>
            <NSpace align="center" justify="space-between">
              <NSpace align="center">
                <NButton
                  type="primary"
                  :loading="syncing"
                  :disabled="syncing || pullingBlog || !config.obsidianBlogDir || !config.hexoBlogDir"
                  @click="startSync"
                >
                  {{ syncing ? t('blogSync.action.syncing') : t('blogSync.action.sync') }}
                </NButton>
                <NButton
                  tertiary
                  :loading="pullingBlog"
                  :disabled="syncing || pullingBlog || !config.hexoBlogDir"
                  @click="pullBlog"
                >
                  {{ pullingBlog ? t('blogSync.action.pulling') : t('blogSync.action.pull') }}
                </NButton>
                <NTag
                  :type="status === 'success' ? 'success' : status === 'error' ? 'error' : status === 'syncing' ? 'warning' : 'default'"
                  round
                >
                  {{ t(`blogSync.status.${status}`) }}
                </NTag>
              </NSpace>
            </NSpace>
          </NCard>

          <NCard class="flex-1 min-h-0" embedded>
            <template #header>
              {{ t('blogSync.logs.title') }}
            </template>
            <template #header-extra>
              <NButton tertiary size="small" @click="clearLogs">
                {{ t('blogSync.logs.clear') }}
              </NButton>
            </template>

            <div
              ref="logContainer"
              class="h-[360px] overflow-y-auto rounded-md border border-[#2e3440] bg-[#141414] p-3 font-mono text-[12.5px] leading-relaxed"
            >
              <NThing
                v-for="line in logs"
                :key="line.id"
                class="whitespace-pre-wrap break-all"
                :class="{
                  'text-[#c9d1d9]': line.level === 'info',
                  'text-[#40c074]': line.level === 'success',
                  'text-[#f0a020]': line.level === 'warn',
                  'text-[#e05252]': line.level === 'error',
                }"
              >
                {{ line.text }}
              </NThing>

              <div v-if="logs.length === 0" class="text-[#555] italic text-center mt-5">
                {{ t('blogSync.logs.empty') }}
              </div>
            </div>
          </NCard>

          <NCard embedded>
            <template #header>
              {{ t('blogSync.validation.title') }}
            </template>
            <template #header-extra>
              <NSpace :size="8" justify="end">
                <NButton
                  tertiary
                  size="small"
                  :disabled="!config.obsidianBlogDir"
                  @click="openConfiguredBlogDir('obsidian')"
                >
                  {{ t('blogSync.validation.openObsidianDir') }}
                </NButton>
                <NButton
                  tertiary
                  size="small"
                  :disabled="!config.hexoBlogDir"
                  @click="openConfiguredBlogDir('hexo')"
                >
                  {{ t('blogSync.validation.openHexoDir') }}
                </NButton>
                <NButton
                  tertiary
                  size="small"
                  :disabled="!config.obsidianBlogDir"
                  @click="openObsidianPage"
                >
                  {{ t('blogSync.validation.openObsidianPage') }}
                </NButton>
                <NButton
                  tertiary
                  size="small"
                  :disabled="!config.hexoBlogDir"
                  @click="openHexoProjectInEditor"
                >
                  {{ t('blogSync.validation.openProjectDir') }}
                </NButton>
                <NButton
                  tertiary
                  size="small"
                  :loading="validatingBlogs"
                  :disabled="!config.obsidianBlogDir"
                  @click="loadValidation"
                >
                  {{ t('blogSync.validation.refresh') }}
                </NButton>
              </NSpace>
            </template>

            <NSpace vertical :size="12">
              <NAlert v-if="validationError" type="error" closable @close="validationError = ''">
                {{ validationError }}
              </NAlert>

              <NAlert
                v-if="validationResult.ok"
                type="success"
              >
                {{ t('blogSync.validation.ok', {
                  count: validationResult.checkedFiles,
                  obsidian: validationResult.obsidianCheckedFiles,
                  hexo: validationResult.hexoCheckedFiles,
                }) }}
              </NAlert>

              <template v-else>
                <NAlert :type="validationResult.errorCount > 0 ? 'error' : 'warning'">
                  {{ t('blogSync.validation.failed', {
                    count: validationResult.issues.length,
                    errors: validationResult.errorCount,
                    warnings: validationResult.warningCount,
                  }) }}
                </NAlert>
                <div class="validation-list">
                  <div
                    v-for="issue in validationResult.issues"
                    :key="issue.id"
                    class="validation-row"
                  >
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <NTag size="small" :type="issue.source === 'hexo' ? 'info' : 'default'" round>
                          {{ issue.source }}
                        </NTag>
                        <NTag size="small" :type="issueTagType(issue)" round>
                          {{ issue.field }}
                        </NTag>
                        <span class="break-all text-[#e5e7eb]">{{ issue.relativePath }}</span>
                      </div>
                      <div class="mt-1 text-sm text-[#b6c2d1]">
                        {{ issue.message }}
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <NPopconfirm
                        v-if="canDeleteHexoOrphanIssue(issue)"
                        :positive-text="t('blogSync.validation.confirmDeleteHexoOrphan')"
                        :negative-text="t('blogSync.validation.cancelDeleteHexoOrphan')"
                        @positive-click="deleteHexoOrphanBlog(issue)"
                      >
                        <template #trigger>
                          <NButton
                            size="small"
                            tertiary
                            type="error"
                            :loading="deletingHexoIssueId === issue.id"
                          >
                            {{ t('blogSync.validation.deleteHexoOrphan') }}
                          </NButton>
                        </template>
                        {{ t('blogSync.validation.deleteHexoOrphanPrompt', { path: issue.relativePath }) }}
                      </NPopconfirm>
                      <NButton
                        size="small"
                        tertiary
                        :loading="openingValidationIssueId === issue.id"
                        @click="openValidationIssue(issue)"
                      >
                        {{ t('blogSync.validation.open') }}
                      </NButton>
                    </div>
                  </div>
                </div>
              </template>
            </NSpace>
          </NCard>
        </div>
      </NTabPane>

      <NTabPane name="blogs" :tab="t('blogSync.tabs.blogs')">
        <NCard embedded>
          <template #header>
            {{ t('blogSync.blogs.title') }}
          </template>
          <template #header-extra>
            <NSpace :size="8" align="center">
              <NButton
                size="small"
                type="primary"
                :disabled="!config.obsidianBlogDir || creatingBlog"
                @click="openCreateBlogModal()"
              >
                {{ t('blogSync.blogs.add') }}
              </NButton>
              <NButton size="small" tertiary :loading="loadingBlogs" @click="loadBlogs">
                {{ t('blogSync.blogs.refresh') }}
              </NButton>
            </NSpace>
          </template>

          <NSpace vertical :size="14">
            <NAlert v-if="blogError" type="error" closable @close="blogError = ''">
              {{ blogError }}
            </NAlert>

            <template v-if="blogs.length > 0">
              <NSpace :size="8" align="center">
                <NSelect
                  v-model:value="selectedTagFilters"
                  class="tag-filter-select"
                  :style="tagFilterSelectStyle"
                  size="small"
                  multiple
                  filterable
                  clearable
                  :options="tagFilterOptions"
                  :placeholder="t('blogSync.blogs.tagSearchPlaceholder')"
                />
                <NSelect
                  v-model:value="blogSortBy"
                  class="w-[150px]"
                  size="small"
                  :options="sortByOptions"
                />
                <NSelect
                  v-model:value="blogSortOrder"
                  class="w-[140px]"
                  size="small"
                  :options="sortOrderOptions"
                />
                <NButton size="small" tertiary @click="expandAllBlogFolders">
                  {{ t('blogSync.blogs.expandAll') }}
                </NButton>
                <NButton size="small" tertiary @click="collapseAllBlogFolders">
                  {{ t('blogSync.blogs.collapseAll') }}
                </NButton>
              </NSpace>

              <NDropdown
                trigger="manual"
                placement="bottom-start"
                :show="contextMenuShow"
                :x="contextMenuX"
                :y="contextMenuY"
                :options="blogContextMenuOptions"
                @select="handleBlogContextMenuSelect"
                @clickoutside="contextMenuShow = false"
              />
              <NTree
                v-if="sortedBlogs.length > 0"
                v-model:expanded-keys="expandedBlogKeys"
                :data="blogTreeData"
                :node-props="blogNodeProps"
                :render-label="renderBlogTreeLabel"
                :render-suffix="renderBlogTreeSuffix"
                block-line
                expand-on-click
              />
              <NEmpty v-else :description="t('blogSync.blogs.noTagMatches')" />
              <NModal
                v-model:show="renameModalShow"
                preset="dialog"
                :title="renameMode === 'title' ? t('blogSync.blogs.renameTitle') : t('blogSync.blogs.renameFileName')"
                :positive-text="t('blogSync.blogs.renameConfirm')"
                :negative-text="t('blogSync.blogs.renameCancel')"
                :loading="renaming"
                :positive-button-props="{ disabled: !renameValue.trim() }"
                @positive-click="confirmRename"
              >
                <NInput
                  v-model:value="renameValue"
                  :placeholder="renameMode === 'title'
                    ? t('blogSync.blogs.renameTitlePlaceholder')
                    : t('blogSync.blogs.renameFileNamePlaceholder')"
                  @keyup.enter="confirmRename"
                />
              </NModal>
            </template>

            <NEmpty v-else :description="loadingBlogs ? t('blogSync.blogs.loading') : t('blogSync.blogs.empty')" />
            <NModal
              v-model:show="createModalShow"
              preset="dialog"
              :title="t('blogSync.blogs.createTitle')"
              :positive-text="t('blogSync.blogs.createConfirm')"
              :negative-text="t('blogSync.blogs.createCancel')"
              :loading="creatingBlog"
              :positive-button-props="{ disabled: !config.obsidianBlogDir || !newBlogTitle.trim() }"
              @positive-click="addBlog"
              @after-leave="resetCreateBlogForm"
            >
              <NForm label-placement="top" class="mt-2">
                <NFormItem :label="t('blogSync.blogs.titleLabel')">
                  <NInput
                    v-model:value="newBlogTitle"
                    :placeholder="t('blogSync.blogs.newTitlePlaceholder')"
                    :disabled="!config.obsidianBlogDir || creatingBlog"
                    @keyup.enter="addBlog"
                  />
                </NFormItem>
                <NFormItem :label="t('blogSync.blogs.directoryLabel')">
                  <NAutoComplete
                    v-model:value="newBlogDirectory"
                    :options="directoryOptions"
                    :get-show="showDirectoryOptions"
                    :placeholder="t('blogSync.blogs.directoryPlaceholder')"
                    :disabled="!config.obsidianBlogDir || creatingBlog"
                    clearable
                    @keyup.enter="addBlog"
                  />
                </NFormItem>
                <NFormItem :label="t('blogSync.blogs.tagsLabel')">
                  <div
                    class="tag-input-shell w-full"
                    :class="{ 'tag-input-shell--disabled': !config.obsidianBlogDir || creatingBlog }"
                  >
                    <NTag
                      v-for="(tag, index) in newBlogTags"
                      :key="tag"
                      size="small"
                      type="info"
                      round
                      closable
                      :disabled="!config.obsidianBlogDir || creatingBlog"
                      @close="removeTag(index)"
                    >
                      {{ tag }}
                    </NTag>
                    <NInput
                      :value="tagInputValue"
                      class="tag-input-field"
                      size="small"
                      :placeholder="t('blogSync.blogs.tagsPlaceholder')"
                      :disabled="!config.obsidianBlogDir || creatingBlog"
                      :bordered="false"
                      @update:value="handleTagInputUpdate"
                      @keydown="handleTagInputKeydown"
                      @blur="addTag()"
                    />
                  </div>
                </NFormItem>
                <NFormItem :label="t('blogSync.blogs.categoriesLabel')">
                  <NAutoComplete
                    v-model:value="newBlogCategories"
                    :options="categoryOptions"
                    :get-show="showCategoryOptions"
                    :placeholder="t('blogSync.blogs.categoriesPlaceholder')"
                    :disabled="!config.obsidianBlogDir || creatingBlog"
                    clearable
                    @keyup.enter="addBlog"
                  />
                </NFormItem>
              </NForm>
            </NModal>
          </NSpace>
        </NCard>
      </NTabPane>
    </NTabs>
  </main>
</template>

<style scoped>
.tag-input-shell {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 3px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.02);
  transition:
    border-color 0.2s var(--n-bezier),
    box-shadow 0.2s var(--n-bezier);
}

.tag-input-shell:focus-within {
  border-color: #63e2b7;
  box-shadow: 0 0 0 2px rgba(99, 226, 183, 0.2);
}

.tag-input-shell--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.tag-input-field {
  min-width: 72px;
  flex: 1;
}

.tag-filter-select {
  flex: 0 1 auto;
}

.tag-filter-select :deep(.n-base-selection-tags) {
  flex-wrap: wrap;
  max-width: 100%;
}

.tag-filter-select :deep(.n-base-selection-tag-wrapper) {
  max-width: 100%;
}

.tag-filter-select :deep(.n-tag) {
  max-width: 100%;
}

.tag-filter-select :deep(.n-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
