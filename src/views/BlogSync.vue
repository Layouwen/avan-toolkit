<script setup lang="ts">
import type { AppConfig, BlogValidationIssue, BlogValidationResult, ObsidianBlog } from '../electron-api.d';
import type { BlogTreeNode, LogLine } from '@/features/blog-sync/types';
import type { BlogSortBy, SortOrder } from '@/features/blog-sync/utils';
import { computed, onMounted, onUnmounted, ref, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BlogLibraryCard from '@/features/blog-sync/components/BlogLibraryCard.vue';
import BlogSyncConfigCard from '@/features/blog-sync/components/BlogSyncConfigCard.vue';
import BlogSyncLogCard from '@/features/blog-sync/components/BlogSyncLogCard.vue';
import BlogSyncRunCard from '@/features/blog-sync/components/BlogSyncRunCard.vue';
import BlogSyncValidationCard from '@/features/blog-sync/components/BlogSyncValidationCard.vue';
import {
  buildBlogTree,
  collectBlogTreeFolderKeys,
  emptyValidationResult,
  filterBlogsBySelectedTags,
  inferBlogDefaults,
  parseCategoryPath,
  sortBlogs,
} from '@/features/blog-sync/utils';

const { t } = useI18n();

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

const filteredBlogs = computed(() => filterBlogsBySelectedTags(blogs.value, selectedTagFilters.value));

const sortedBlogs = computed(() => sortBlogs(filteredBlogs.value, blogSortBy.value, blogSortOrder.value));

const blogTreeData = computed<BlogTreeNode[]>(() => buildBlogTree(sortedBlogs.value, blogSortBy.value, blogSortOrder.value));

const allFolderKeys = computed(() => collectBlogTreeFolderKeys(blogTreeData.value));

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
  });

  await window.electronAPI.pullBlog();
}

function clearLogs() {
  logs.value = [];
}

function updateHexoEditorCommand(value: unknown) {
  if (value === 'cursor' || value === 'code') {
    config.value.hexoEditorCommand = value;
    void saveConfig();
  }
}

function updateBlogSortBy(value: BlogSortBy) {
  blogSortBy.value = value;
}

function updateBlogSortOrder(value: SortOrder) {
  blogSortOrder.value = value;
}

function updateSelectedTagFilters(value: string[]) {
  selectedTagFilters.value = value;
}

function handleCreateModalOpen(open: boolean) {
  createModalShow.value = open;
  if (!open) {
    resetCreateBlogForm();
  }
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
          <BlogSyncConfigCard
            :obsidian-blog-dir="config.obsidianBlogDir"
            :hexo-blog-dir="config.hexoBlogDir"
            :hexo-editor-command="config.hexoEditorCommand"
            :hexo-editor-command-options="hexoEditorCommandOptions"
            @update:obsidian-blog-dir="config.obsidianBlogDir = $event"
            @update:hexo-blog-dir="config.hexoBlogDir = $event"
            @update:hexo-editor-command="updateHexoEditorCommand"
            @browse="browseDir"
            @save="saveConfig"
          />

          <BlogSyncRunCard
            :syncing="syncing"
            :pulling-blog="pullingBlog"
            :can-sync="!syncing && !pullingBlog && Boolean(config.obsidianBlogDir && config.hexoBlogDir)"
            :can-pull="!syncing && !pullingBlog && Boolean(config.hexoBlogDir)"
            :status="status"
            @start-sync="startSync"
            @pull-blog="pullBlog"
          />

          <BlogSyncLogCard :logs="logs" @clear="clearLogs" />

          <BlogSyncValidationCard
            :obsidian-configured="Boolean(config.obsidianBlogDir)"
            :hexo-configured="Boolean(config.hexoBlogDir)"
            :validation-error="validationError"
            :validation-result="validationResult"
            :validating-blogs="validatingBlogs"
            :opening-validation-issue-id="openingValidationIssueId"
            :deleting-hexo-issue-id="deletingHexoIssueId"
            @clear-error="validationError = ''"
            @refresh="loadValidation"
            @open-configured-dir="openConfiguredBlogDir"
            @open-obsidian-page="openObsidianPage"
            @open-hexo-project="openHexoProjectInEditor"
            @open-issue="openValidationIssue"
            @delete-hexo-orphan="deleteHexoOrphanBlog"
          />
        </div>
      </TabsContent>

      <TabsContent value="blogs">
        <BlogLibraryCard
          :obsidian-configured="Boolean(config.obsidianBlogDir)"
          :blogs="blogs"
          :loading-blogs="loadingBlogs"
          :creating-blog="creatingBlog"
          :deleting-blog-id="deletingBlogId"
          :blog-error="blogError"
          :tag-filter-options="tagFilterOptions"
          :selected-tag-filters="selectedTagFilters"
          :sort-by-options="sortByOptions"
          :blog-sort-by="blogSortBy"
          :sort-order-options="sortOrderOptions"
          :blog-sort-order="blogSortOrder"
          :context-menu-show="contextMenuShow"
          :context-menu-style="contextMenuStyle"
          :blog-context-menu-options="blogContextMenuOptions"
          :sorted-blogs="sortedBlogs"
          :blog-tree-data="blogTreeData"
          :expanded-blog-keys="expandedBlogKeys"
          :rename-modal-show="renameModalShow"
          :rename-mode="renameMode"
          :rename-value="renameValue"
          :renaming="renaming"
          :create-modal-show="createModalShow"
          :new-blog-title="newBlogTitle"
          :new-blog-directory="newBlogDirectory"
          :directory-options="directoryOptions"
          :new-blog-tags="newBlogTags"
          :tag-input-value="tagInputValue"
          :new-blog-categories="newBlogCategories"
          :category-options="categoryOptions"
          :format-updated-at="formatUpdatedAt"
          :remove-prompt="(blog: ObsidianBlog) => t('blogSync.blogs.removePrompt', { title: blog.title })"
          @clear-error="blogError = ''"
          @open-create="openCreateBlogModal()"
          @refresh="loadBlogs"
          @update:selected-tag-filters="updateSelectedTagFilters"
          @update:blog-sort-by="updateBlogSortBy"
          @update:blog-sort-order="updateBlogSortOrder"
          @expand-all="expandAllBlogFolders"
          @collapse-all="collapseAllBlogFolders"
          @select-context-menu="handleBlogContextMenuSelect"
          @update:expanded-blog-keys="expandedBlogKeys = $event"
          @blog-context-menu="openBlogContextMenu"
          @remove="removeBlog"
          @update:rename-modal-show="renameModalShow = $event"
          @update:rename-value="renameValue = $event"
          @confirm-rename="confirmRename"
          @update:create-modal-show="handleCreateModalOpen"
          @update:new-blog-title="newBlogTitle = $event"
          @update:new-blog-directory="newBlogDirectory = $event"
          @update-tag-input="handleTagInputUpdate"
          @tag-keydown="handleTagInputKeydown"
          @add-tag="addTag()"
          @remove-tag="removeTag"
          @update:new-blog-categories="newBlogCategories = $event"
          @add-blog="addBlog"
        />
      </TabsContent>
    </Tabs>
  </main>
</template>
