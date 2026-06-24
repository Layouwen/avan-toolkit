<script setup lang="ts">
import type { ObsidianBlog } from '../electron-api.d';
import { ChevronRightIcon, FileTextIcon, FolderIcon, Loader2Icon } from '@lucide/vue';
import ConfirmButton from './ConfirmButton.vue';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export interface BlogTreeNode {
  key: string;
  label: string;
  kind: 'folder' | 'blog';
  directoryPath?: string;
  blog?: ObsidianBlog;
  children?: BlogTreeNode[];
}

const props = defineProps<{
  nodes: BlogTreeNode[];
  expandedKeys: Array<string | number>;
  deletingBlogId: string;
  removeLabel: string;
  removeTitle: string;
  removeConfirmText: string;
  removeCancelText: string;
  removePrompt: (blog: ObsidianBlog) => string;
  formatUpdatedAt: (value: string) => string;
}>();

const emit = defineEmits<{
  'update:expandedKeys': [keys: Array<string | number>];
  'contextmenu': [event: MouseEvent, node: BlogTreeNode];
  'remove': [blog: ObsidianBlog];
}>();

function isExpanded(node: BlogTreeNode) {
  return props.expandedKeys.includes(node.key);
}

function toggleFolder(node: BlogTreeNode) {
  const expanded = isExpanded(node);
  emit(
    'update:expandedKeys',
    expanded
      ? props.expandedKeys.filter(key => key !== node.key)
      : [...props.expandedKeys, node.key],
  );
}

function countBlogs(node: BlogTreeNode): number {
  if (node.kind === 'blog') {
    return 1;
  }
  return (node.children || []).reduce((count, child) => count + countBlogs(child), 0);
}
</script>

<template>
  <ul class="flex flex-col gap-1">
    <li v-for="node in nodes" :key="node.key">
      <div
        class="group flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
        @contextmenu.prevent.stop="emit('contextmenu', $event, node)"
      >
        <Button
          v-if="node.kind === 'folder'"
          variant="ghost"
          size="icon-sm"
          class="mt-0.5 shrink-0"
          @click="toggleFolder(node)"
        >
          <ChevronRightIcon :class="{ 'rotate-90': isExpanded(node) }" />
        </Button>
        <span v-else class="mt-1 inline-flex size-8 shrink-0 items-center justify-center">
          <FileTextIcon class="size-4 text-muted-foreground" />
        </span>

        <div class="min-w-0 flex-1">
          <div v-if="node.kind === 'folder'" class="flex min-w-0 items-center gap-2 py-1">
            <FolderIcon class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate font-medium text-foreground">{{ node.label }}</span>
            <Badge variant="secondary">
              {{ countBlogs(node) }}
            </Badge>
          </div>
          <div v-else-if="node.blog" class="min-w-0">
            <div class="truncate text-foreground">
              {{ node.label }}
            </div>
            <div class="break-all text-xs text-muted-foreground">
              {{ node.blog.relativePath }} · {{ formatUpdatedAt(node.blog.updatedAt) }}
            </div>
            <div v-if="node.blog.tags.length > 0" class="mt-1 flex flex-wrap gap-1">
              <Badge v-for="tag in node.blog.tags" :key="tag" variant="secondary">
                {{ tag }}
              </Badge>
            </div>
          </div>
        </div>

        <ConfirmButton
          v-if="node.blog"
          :title="removeTitle"
          :description="removePrompt(node.blog)"
          :confirm-text="removeConfirmText"
          :cancel-text="removeCancelText"
          variant="destructive"
          size="sm"
          :disabled="Boolean(deletingBlogId)"
          class="opacity-0 transition-opacity group-hover:opacity-100"
          @confirm="emit('remove', node.blog)"
        >
          <Loader2Icon v-if="deletingBlogId === node.blog.id" data-icon="inline-start" class="animate-spin" />
          {{ removeLabel }}
        </ConfirmButton>
      </div>

      <BlogTree
        v-if="node.children && isExpanded(node)"
        class="ml-6 mt-1"
        :nodes="node.children"
        :expanded-keys="expandedKeys"
        :deleting-blog-id="deletingBlogId"
        :remove-label="removeLabel"
        :remove-title="removeTitle"
        :remove-confirm-text="removeConfirmText"
        :remove-cancel-text="removeCancelText"
        :remove-prompt="removePrompt"
        :format-updated-at="formatUpdatedAt"
        @update:expanded-keys="emit('update:expandedKeys', $event)"
        @contextmenu="(event, child) => emit('contextmenu', event, child)"
        @remove="emit('remove', $event)"
      />
    </li>
  </ul>
</template>
