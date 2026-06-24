<script setup lang="ts">
import type { ObsidianBlog } from '../../../electron-api.d';
import type { BlogTreeNode } from '@/features/blog-sync/types';
import type { BlogSortBy, SortOrder } from '@/features/blog-sync/utils';
import { Loader2Icon, PlusIcon, RefreshCwIcon, XIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import BlogTree from '@/components/BlogTree.vue';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface SelectOption<T extends string = string> {
  label: string;
  value: T;
}

interface ContextMenuOption {
  label: string;
  key: string;
}

defineProps<{
  obsidianConfigured: boolean;
  blogs: ReadonlyArray<ObsidianBlog>;
  loadingBlogs: boolean;
  creatingBlog: boolean;
  deletingBlogId: string;
  blogError: string;
  tagFilterOptions: ReadonlyArray<SelectOption>;
  selectedTagFilters: ReadonlyArray<string>;
  sortByOptions: ReadonlyArray<SelectOption<BlogSortBy>>;
  blogSortBy: BlogSortBy;
  sortOrderOptions: ReadonlyArray<SelectOption<SortOrder>>;
  blogSortOrder: SortOrder;
  contextMenuShow: boolean;
  contextMenuStyle: Record<string, string>;
  blogContextMenuOptions: ReadonlyArray<ContextMenuOption>;
  sortedBlogs: ReadonlyArray<ObsidianBlog>;
  blogTreeData: ReadonlyArray<BlogTreeNode>;
  expandedBlogKeys: Array<string | number>;
  renameModalShow: boolean;
  renameMode: 'title' | 'fileName';
  renameValue: string;
  renaming: boolean;
  createModalShow: boolean;
  newBlogTitle: string;
  newBlogDirectory: string;
  directoryOptions: ReadonlyArray<SelectOption>;
  newBlogTags: ReadonlyArray<string>;
  tagInputValue: string;
  newBlogCategories: string;
  categoryOptions: ReadonlyArray<SelectOption>;
  formatUpdatedAt: (value: string) => string;
  removePrompt: (blog: ObsidianBlog) => string;
}>();

const emit = defineEmits<{
  'clearError': [];
  'openCreate': [];
  'refresh': [];
  'update:selectedTagFilters': [value: string[]];
  'update:blogSortBy': [value: BlogSortBy];
  'update:blogSortOrder': [value: SortOrder];
  'expandAll': [];
  'collapseAll': [];
  'selectContextMenu': [key: string];
  'update:expandedBlogKeys': [keys: Array<string | number>];
  'blogContextMenu': [event: MouseEvent, node: BlogTreeNode];
  'remove': [blog: ObsidianBlog];
  'update:renameModalShow': [open: boolean];
  'update:renameValue': [value: string];
  'confirmRename': [];
  'update:createModalShow': [open: boolean];
  'update:newBlogTitle': [value: string];
  'update:newBlogDirectory': [value: string];
  'updateTagInput': [value: string];
  'tagKeydown': [event: KeyboardEvent];
  'addTag': [];
  'removeTag': [index: number];
  'update:newBlogCategories': [value: string];
  'addBlog': [];
}>();

const { t } = useI18n();

function updateSelectedTagFilters(value: unknown) {
  emit(
    'update:selectedTagFilters',
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [],
  );
}

function updateBlogSortBy(value: unknown) {
  if (value === 'fileName' || value === 'title' || value === 'updatedAt') {
    emit('update:blogSortBy', value);
  }
}

function updateBlogSortOrder(value: unknown) {
  if (value === 'asc' || value === 'desc') {
    emit('update:blogSortOrder', value);
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle class="text-base">
          {{ t('blogSync.blogs.title') }}
        </CardTitle>
        <div class="flex flex-wrap gap-2">
          <Button
            size="sm"
            :disabled="!obsidianConfigured || creatingBlog"
            @click="emit('openCreate')"
          >
            <PlusIcon data-icon="inline-start" />
            {{ t('blogSync.blogs.add') }}
          </Button>
          <Button size="sm" variant="secondary" :disabled="loadingBlogs" @click="emit('refresh')">
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
          <Button variant="ghost" size="icon-sm" @click="emit('clearError')">
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
            <Button size="sm" variant="secondary" @click="emit('expandAll')">
              {{ t('blogSync.blogs.expandAll') }}
            </Button>
            <Button size="sm" variant="secondary" @click="emit('collapseAll')">
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
            @click="emit('selectContextMenu', option.key)"
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
          :remove-prompt="removePrompt"
          :format-updated-at="formatUpdatedAt"
          @update:expanded-keys="emit('update:expandedBlogKeys', $event)"
          @contextmenu="(event, node) => emit('blogContextMenu', event, node)"
          @remove="emit('remove', $event)"
        />
        <Empty v-else>
          <EmptyHeader>
            <EmptyTitle>{{ t('blogSync.blogs.noTagMatches') }}</EmptyTitle>
            <EmptyDescription>{{ t('blogSync.blogs.noTagMatches') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>

        <Dialog :open="renameModalShow" @update:open="emit('update:renameModalShow', $event)">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{{ renameMode === 'title' ? t('blogSync.blogs.renameTitle') : t('blogSync.blogs.renameFileName') }}</DialogTitle>
            </DialogHeader>
            <Input
              :model-value="renameValue"
              :placeholder="renameMode === 'title'
                ? t('blogSync.blogs.renameTitlePlaceholder')
                : t('blogSync.blogs.renameFileNamePlaceholder')"
              @update:model-value="emit('update:renameValue', String($event))"
              @keyup.enter="emit('confirmRename')"
            />
            <DialogFooter>
              <Button variant="secondary" @click="emit('update:renameModalShow', false)">
                {{ t('blogSync.blogs.renameCancel') }}
              </Button>
              <Button :disabled="!renameValue.trim() || renaming" @click="emit('confirmRename')">
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

      <Dialog :open="createModalShow" @update:open="emit('update:createModalShow', $event)">
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
                :model-value="newBlogTitle"
                :placeholder="t('blogSync.blogs.newTitlePlaceholder')"
                :disabled="!obsidianConfigured || creatingBlog"
                @update:model-value="emit('update:newBlogTitle', String($event))"
                @keyup.enter="emit('addBlog')"
              />
            </Field>
            <Field>
              <FieldLabel for="new-blog-directory">
                {{ t('blogSync.blogs.directoryLabel') }}
              </FieldLabel>
              <Input
                id="new-blog-directory"
                :model-value="newBlogDirectory"
                list="blog-directory-options"
                :placeholder="t('blogSync.blogs.directoryPlaceholder')"
                :disabled="!obsidianConfigured || creatingBlog"
                @update:model-value="emit('update:newBlogDirectory', String($event))"
                @keyup.enter="emit('addBlog')"
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
                :class="{ 'tag-input-shell--disabled': !obsidianConfigured || creatingBlog }"
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
                    :disabled="!obsidianConfigured || creatingBlog"
                    class="rounded-full text-muted-foreground hover:text-foreground disabled:pointer-events-none"
                    @click="emit('removeTag', index)"
                  >
                    <XIcon class="size-3" />
                  </button>
                </Badge>
                <Input
                  :model-value="tagInputValue"
                  class="tag-input-field"
                  :placeholder="t('blogSync.blogs.tagsPlaceholder')"
                  :disabled="!obsidianConfigured || creatingBlog"
                  @update:model-value="emit('updateTagInput', String($event))"
                  @keydown="emit('tagKeydown', $event)"
                  @blur="emit('addTag')"
                />
              </div>
            </Field>
            <Field>
              <FieldLabel for="new-blog-categories">
                {{ t('blogSync.blogs.categoriesLabel') }}
              </FieldLabel>
              <Input
                id="new-blog-categories"
                :model-value="newBlogCategories"
                list="blog-category-options"
                :placeholder="t('blogSync.blogs.categoriesPlaceholder')"
                :disabled="!obsidianConfigured || creatingBlog"
                @update:model-value="emit('update:newBlogCategories', String($event))"
                @keyup.enter="emit('addBlog')"
              />
              <datalist id="blog-category-options">
                <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </datalist>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="secondary" @click="emit('update:createModalShow', false)">
              {{ t('blogSync.blogs.createCancel') }}
            </Button>
            <Button
              :disabled="!obsidianConfigured || !newBlogTitle.trim() || creatingBlog"
              @click="emit('addBlog')"
            >
              <Loader2Icon v-if="creatingBlog" data-icon="inline-start" class="animate-spin" />
              {{ t('blogSync.blogs.createConfirm') }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>
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
</style>
