import type { Ref } from 'vue';
import type { AppConfig, BlogValidationResult, ObsidianBlog } from '../../../electron-api.d';
import type { BlogTreeNode } from '@/features/blog-sync/types';
import type { BlogSortBy, SortOrder } from '@/features/blog-sync/utils';
import { computed, ref, shallowRef } from 'vue';
import {
  buildBlogTree,
  collectBlogTreeFolderKeys,
  filterBlogsBySelectedTags,
  inferBlogDefaults,
  parseCategoryPath,
  sortBlogs,
} from '@/features/blog-sync/utils';

type Translate = (key: string) => string;

interface UseBlogLibraryOptions {
  config: Ref<AppConfig>;
  plainConfig: () => AppConfig;
  loadValidation: () => Promise<BlogValidationResult>;
  resetValidation: () => void;
  t: Translate;
}

export function useBlogLibrary(options: UseBlogLibraryOptions) {
  const blogs = ref<ObsidianBlog[]>([]);
  const loadingBlogs = shallowRef(false);
  const creatingBlog = shallowRef(false);
  const deletingBlogId = shallowRef('');
  const blogError = shallowRef('');
  const newBlogTitle = shallowRef('');
  const newBlogDirectory = shallowRef('');
  const newBlogTags = ref<string[]>([]);
  const tagInputValue = shallowRef('');
  const newBlogCategories = shallowRef('');
  const createModalShow = shallowRef(false);
  const expandedBlogKeys = ref<Array<string | number>>([]);
  const blogSortBy = shallowRef<BlogSortBy>('updatedAt');
  const blogSortOrder = shallowRef<SortOrder>('desc');
  const selectedTagFilters = ref<string[]>([]);
  const contextMenuShow = shallowRef(false);
  const contextMenuX = shallowRef(0);
  const contextMenuY = shallowRef(0);
  const contextMenuNode = ref<BlogTreeNode | null>(null);
  const contextMenuBlog = ref<ObsidianBlog | null>(null);
  const renameModalShow = shallowRef(false);
  const renameMode = shallowRef<'title' | 'fileName'>('title');
  const renameValue = shallowRef('');
  const renaming = shallowRef(false);

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
    { label: options.t('blogSync.blogs.sortByTime'), value: 'updatedAt' as const },
    { label: options.t('blogSync.blogs.sortByFileName'), value: 'fileName' as const },
    { label: options.t('blogSync.blogs.sortByTitle'), value: 'title' as const },
  ]);

  const sortOrderOptions = computed(() => [
    { label: options.t('blogSync.blogs.sortDesc'), value: 'desc' as const },
    { label: options.t('blogSync.blogs.sortAsc'), value: 'asc' as const },
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
        { label: options.t('blogSync.blogs.createInFolder'), key: 'create' },
      ];
    }

    return [
      { label: options.t('blogSync.blogs.renameTitle'), key: 'title' },
      { label: options.t('blogSync.blogs.renameFileName'), key: 'fileName' },
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

  async function loadBlogs() {
    blogError.value = '';
    if (!options.config.value.obsidianBlogDir.trim()) {
      blogs.value = [];
      options.resetValidation();
      return;
    }

    loadingBlogs.value = true;
    try {
      await window.electronAPI.setConfig(options.plainConfig());
      blogs.value = await window.electronAPI.listObsidianBlogs();
      expandedBlogKeys.value = allFolderKeys.value;
      await options.loadValidation();
    }
    catch (error) {
      blogs.value = [];
      blogError.value = error instanceof Error ? error.message : String(error);
    }
    finally {
      loadingBlogs.value = false;
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
      await window.electronAPI.setConfig(options.plainConfig());
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
      await options.loadValidation();
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
      await window.electronAPI.setConfig(options.plainConfig());
      const updated = renameMode.value === 'title'
        ? await window.electronAPI.renameObsidianBlogTitle(blog.relativePath, value)
        : await window.electronAPI.renameObsidianBlogFileName(blog.relativePath, value);

      blogs.value = blogs.value.map(item =>
        item.relativePath === blog.relativePath ? updated : item,
      );
      contextMenuBlog.value = updated;
      renameModalShow.value = false;
      await options.loadValidation();
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

  function clearBlogError() {
    blogError.value = '';
  }

  return {
    blogs,
    loadingBlogs,
    creatingBlog,
    deletingBlogId,
    blogError,
    newBlogTitle,
    newBlogDirectory,
    newBlogTags,
    tagInputValue,
    newBlogCategories,
    createModalShow,
    expandedBlogKeys,
    blogSortBy,
    blogSortOrder,
    selectedTagFilters,
    contextMenuShow,
    renameModalShow,
    renameMode,
    renameValue,
    renaming,
    directoryOptions,
    categoryOptions,
    sortByOptions,
    sortOrderOptions,
    tagFilterOptions,
    blogContextMenuOptions,
    contextMenuStyle,
    sortedBlogs,
    blogTreeData,
    loadBlogs,
    addBlog,
    removeBlog,
    formatUpdatedAt,
    openCreateBlogModal,
    expandAllBlogFolders,
    collapseAllBlogFolders,
    addTag,
    removeTag,
    handleTagInputUpdate,
    handleTagInputKeydown,
    openBlogContextMenu,
    closeBlogContextMenu,
    handleBlogContextMenuSelect,
    confirmRename,
    updateBlogSortBy,
    updateBlogSortOrder,
    updateSelectedTagFilters,
    handleCreateModalOpen,
    clearBlogError,
  };
}
