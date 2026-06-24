<script setup lang="ts">
import type { HexoEditorCommand } from '@/features/blog-sync/types';
import { FolderOpenIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

defineProps<{
  obsidianBlogDir: string;
  hexoBlogDir: string;
  hexoEditorCommand: HexoEditorCommand;
  hexoEditorCommandOptions: ReadonlyArray<{
    label: string;
    value: HexoEditorCommand;
  }>;
}>();

const emit = defineEmits<{
  'update:obsidianBlogDir': [value: string];
  'update:hexoBlogDir': [value: string];
  'update:hexoEditorCommand': [value: HexoEditorCommand];
  'browse': [field: 'obsidianBlogDir' | 'hexoBlogDir'];
  'save': [];
}>();

const { t } = useI18n();

function updateHexoEditorCommand(value: unknown) {
  if (value === 'cursor' || value === 'code') {
    emit('update:hexoEditorCommand', value);
  }
}
</script>

<template>
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
              :model-value="obsidianBlogDir"
              class="min-w-0 flex-1"
              :placeholder="t('blogSync.config.obsidianPlaceholder')"
              @update:model-value="emit('update:obsidianBlogDir', String($event))"
              @blur="emit('save')"
            />
            <Button variant="secondary" @click="emit('browse', 'obsidianBlogDir')">
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
              :model-value="hexoBlogDir"
              class="min-w-0 flex-1"
              :placeholder="t('blogSync.config.hexoPlaceholder')"
              @update:model-value="emit('update:hexoBlogDir', String($event))"
              @blur="emit('save')"
            />
            <Button variant="secondary" @click="emit('browse', 'hexoBlogDir')">
              <FolderOpenIcon data-icon="inline-start" />
              {{ t('blogSync.config.browse') }}
            </Button>
          </div>
        </Field>

        <Field>
          <FieldLabel>{{ t('blogSync.config.hexoEditorCommand') }}</FieldLabel>
          <Select :model-value="hexoEditorCommand" @update:model-value="updateHexoEditorCommand">
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
</template>
