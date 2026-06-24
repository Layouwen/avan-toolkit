<script setup lang="ts">
import type { ObsidianBlog } from '../electron-api.d';
import type { BlogPathField } from '@/features/blog-sync/composables/useBlogSyncConfig';
import { onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BlogLibraryCard from '@/features/blog-sync/components/BlogLibraryCard.vue';
import BlogSyncConfigCard from '@/features/blog-sync/components/BlogSyncConfigCard.vue';
import BlogSyncLogCard from '@/features/blog-sync/components/BlogSyncLogCard.vue';
import BlogSyncRunCard from '@/features/blog-sync/components/BlogSyncRunCard.vue';
import BlogSyncValidationCard from '@/features/blog-sync/components/BlogSyncValidationCard.vue';
import { useBlogLibrary } from '@/features/blog-sync/composables/useBlogLibrary';
import { useBlogSyncConfig } from '@/features/blog-sync/composables/useBlogSyncConfig';
import { useBlogSyncLogs } from '@/features/blog-sync/composables/useBlogSyncLogs';
import { useBlogSyncRunner } from '@/features/blog-sync/composables/useBlogSyncRunner';
import { useBlogSyncValidation } from '@/features/blog-sync/composables/useBlogSyncValidation';

const { t } = useI18n();

const {
  config,
  hexoEditorCommandOptions,
  loadConfig,
  plainConfig,
  saveConfig,
  browseDir,
  updateHexoEditorCommand,
} = useBlogSyncConfig();

const {
  logs,
  appendLog,
  setLogs,
  clearLogs,
  subscribeSyncLogs,
  unsubscribeSyncLogs,
} = useBlogSyncLogs();

const {
  validatingBlogs,
  validationError,
  validationResult,
  openingValidationIssueId,
  deletingHexoIssueId,
  loadValidation,
  openValidationIssue,
  deleteHexoOrphanBlog,
  openConfiguredBlogDir,
  openObsidianPage,
  openHexoProjectInEditor,
  clearValidationError,
  resetValidationResult,
} = useBlogSyncValidation({
  config,
  plainConfig,
});

const blogLibrary = useBlogLibrary({
  config,
  plainConfig,
  loadValidation,
  resetValidation: resetValidationResult,
  t,
});

const {
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
} = blogLibrary;

const {
  syncing,
  pullingBlog,
  status,
  startSync,
  pullBlog,
} = useBlogSyncRunner({
  plainConfig,
  loadValidation,
  appendLog,
  setLogs,
  t,
});

async function handleSaveConfig() {
  await saveConfig();
  await loadBlogs();
}

async function handleBrowseDir(field: BlogPathField) {
  const selected = await browseDir(field);
  if (selected && field === 'obsidianBlogDir') {
    await loadBlogs();
  }
}

async function handleHexoEditorCommandUpdate(value: unknown) {
  const updated = await updateHexoEditorCommand(value);
  if (updated) {
    await loadBlogs();
  }
}

onMounted(async () => {
  await loadConfig();
  await loadBlogs();
  window.addEventListener('click', closeBlogContextMenu);
  subscribeSyncLogs();
});

onUnmounted(() => {
  unsubscribeSyncLogs();
  window.removeEventListener('click', closeBlogContextMenu);
});
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
            @update:hexo-editor-command="handleHexoEditorCommandUpdate"
            @browse="handleBrowseDir"
            @save="handleSaveConfig"
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
            @clear-error="clearValidationError"
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
          @clear-error="clearBlogError"
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
