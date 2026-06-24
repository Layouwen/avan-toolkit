<script setup lang="ts">
import type {
  EditorExtensionRecord,
  EditorExtensionWithStatus,
  EditorKind,
} from '../../../electron-api.d';
import type {
  EditorExtensionCommandAction,
  EditorExtensionFilterScope,
  EditorExtensionSortDirection,
  EditorExtensionSortField,
  EditorExtensionStats,
  EditorExtensionStatusVariant,
} from '@/features/editor-extensions/types';
import { CopyIcon, Loader2Icon, PencilIcon, Trash2Icon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import ConfirmButton from '@/components/ConfirmButton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Option<T extends string> {
  label: string;
  value: T;
}

defineProps<{
  filteredRecords: EditorExtensionWithStatus[];
  stats: EditorExtensionStats;
  keyword: string;
  filterScope: EditorExtensionFilterScope;
  sortField: EditorExtensionSortField;
  sortDirection: EditorExtensionSortDirection;
  filterScopeOptions: Option<EditorExtensionFilterScope>[];
  sortFieldOptions: Option<EditorExtensionSortField>[];
  sortDirectionOptions: Option<EditorExtensionSortDirection>[];
  actionKey: string;
  statusVariant: (value: boolean | null) => EditorExtensionStatusVariant;
  statusLabel: (value: boolean | null) => string;
  canInstallDownloadedVsix: (record: EditorExtensionWithStatus, editor: EditorKind) => boolean;
}>();

const emit = defineEmits<{
  'update:keyword': [value: string];
  'update:filterScope': [value: unknown];
  'update:sortField': [value: unknown];
  'update:sortDirection': [value: unknown];
  'copyExtensionId': [extensionId: string];
  'runCommand': [editor: EditorKind, action: EditorExtensionCommandAction, extensionId: string];
  'installDownloadedVsix': [editor: EditorKind, extensionId: string];
  'downloadVsix': [editor: EditorKind, extensionId: string];
  'edit': [record: EditorExtensionRecord];
  'delete': [recordId: string];
}>();

const { t } = useI18n();
</script>

<template>
  <Card class="min-w-0">
    <CardHeader>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle class="text-base">
            {{ t('editorExtensions.listTitle') }}
          </CardTitle>
          <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div class="rounded border bg-background px-3 py-2">
              <div class="text-muted-foreground">
                {{ t('editorExtensions.stats.total') }}
              </div>
              <div class="text-base font-semibold text-foreground">
                {{ stats.total }}
              </div>
            </div>
            <div class="rounded border bg-background px-3 py-2">
              <div class="text-muted-foreground">
                {{ t('editorExtensions.stats.common') }}
              </div>
              <div class="text-base font-semibold text-foreground">
                {{ stats.common }}
              </div>
            </div>
            <div class="rounded border bg-background px-3 py-2">
              <div class="text-muted-foreground">
                {{ t('editorExtensions.stats.vscode') }}
              </div>
              <div class="text-base font-semibold text-foreground">
                {{ stats.vscode }}
              </div>
            </div>
            <div class="rounded border bg-background px-3 py-2">
              <div class="text-muted-foreground">
                {{ t('editorExtensions.stats.cursor') }}
              </div>
              <div class="text-base font-semibold text-foreground">
                {{ stats.cursor }}
              </div>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1fr)_160px_160px_120px]">
          <Input
            :model-value="keyword"
            :placeholder="t('editorExtensions.searchPlaceholder')"
            @update:model-value="emit('update:keyword', String($event ?? ''))"
          />
          <Select :model-value="filterScope" @update:model-value="emit('update:filterScope', $event)">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="option in filterScopeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select :model-value="sortField" @update:model-value="emit('update:sortField', $event)">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="option in sortFieldOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select :model-value="sortDirection" @update:model-value="emit('update:sortDirection', $event)">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="option in sortDirectionOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div class="text-xs text-muted-foreground">
          {{ t('editorExtensions.filteredCount', { count: filteredRecords.length }) }}
        </div>
      </div>
    </CardHeader>

    <CardContent>
      <div class="overflow-x-auto">
        <Table class="min-w-[1120px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead class="w-[5%]">
                {{ t('editorExtensions.index') }}
              </TableHead>
              <TableHead class="w-[17%]">
                {{ t('editorExtensions.extensionId') }}
              </TableHead>
              <TableHead class="w-[16%]">
                {{ t('editorExtensions.extensionName') }}
              </TableHead>
              <TableHead class="w-[17%]">
                {{ t('editorExtensions.note') }}
              </TableHead>
              <TableHead class="w-[8%]">
                {{ t('editorExtensions.scope') }}
              </TableHead>
              <TableHead class="w-[14%]">
                VS Code
              </TableHead>
              <TableHead class="w-[14%]">
                Cursor
              </TableHead>
              <TableHead class="w-[11%]">
                {{ t('editorExtensions.actions') }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="filteredRecords.length === 0">
              <TableCell colspan="8" class="py-10 text-center text-muted-foreground">
                {{ t('editorExtensions.empty') }}
              </TableCell>
            </TableRow>
            <TableRow
              v-for="(record, index) in filteredRecords"
              :key="record.id"
            >
              <TableCell class="align-top text-muted-foreground">
                {{ index + 1 }}
              </TableCell>
              <TableCell class="align-top">
                <button
                  class="cursor-pointer break-all text-left font-mono text-foreground transition hover:text-primary"
                  type="button"
                  @click="emit('copyExtensionId', record.extensionId)"
                >
                  <CopyIcon class="mr-1 inline size-3" />
                  {{ record.extensionId }}
                </button>
              </TableCell>
              <TableCell class="break-words align-top text-foreground">
                {{ record.name }}
              </TableCell>
              <TableCell class="break-words align-top text-muted-foreground">
                {{ record.note }}
              </TableCell>
              <TableCell class="align-top">
                <Badge variant="secondary">
                  {{ t(`editorExtensions.scopes.${record.scope}`) }}
                </Badge>
              </TableCell>
              <TableCell class="align-top">
                <div class="flex flex-col gap-2">
                  <div v-if="record.vscodeName" class="break-words text-xs text-muted-foreground">
                    {{ record.vscodeName }}
                  </div>
                  <Badge :variant="statusVariant(record.status.vscode)">
                    {{ statusLabel(record.status.vscode) }}
                  </Badge>
                  <div class="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      :disabled="Boolean(actionKey)"
                      @click="emit('runCommand', 'vscode', 'install', record.extensionId)"
                    >
                      <Loader2Icon v-if="actionKey === `vscode:install:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                      {{ t('editorExtensions.install') }}
                    </Button>
                    <Button
                      v-if="canInstallDownloadedVsix(record, 'vscode')"
                      size="sm"
                      :disabled="Boolean(actionKey)"
                      @click="emit('installDownloadedVsix', 'vscode', record.extensionId)"
                    >
                      <Loader2Icon v-if="actionKey === `vscode:installDownloadedVsix:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                      {{ t('editorExtensions.installDownloadedVsix') }}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      :disabled="Boolean(actionKey)"
                      @click="emit('downloadVsix', 'vscode', record.extensionId)"
                    >
                      <Loader2Icon v-if="actionKey === `vscode:downloadVsix:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                      {{ t('editorExtensions.downloadVsix') }}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      :disabled="Boolean(actionKey)"
                      @click="emit('runCommand', 'vscode', 'uninstall', record.extensionId)"
                    >
                      <Loader2Icon v-if="actionKey === `vscode:uninstall:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                      {{ t('editorExtensions.uninstall') }}
                    </Button>
                  </div>
                </div>
              </TableCell>
              <TableCell class="align-top">
                <div class="flex flex-col gap-2">
                  <div v-if="record.cursorName" class="break-words text-xs text-muted-foreground">
                    {{ record.cursorName }}
                  </div>
                  <Badge :variant="statusVariant(record.status.cursor)">
                    {{ statusLabel(record.status.cursor) }}
                  </Badge>
                  <div class="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      :disabled="Boolean(actionKey)"
                      @click="emit('runCommand', 'cursor', 'install', record.extensionId)"
                    >
                      <Loader2Icon v-if="actionKey === `cursor:install:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                      {{ t('editorExtensions.install') }}
                    </Button>
                    <Button
                      v-if="canInstallDownloadedVsix(record, 'cursor')"
                      size="sm"
                      :disabled="Boolean(actionKey)"
                      @click="emit('installDownloadedVsix', 'cursor', record.extensionId)"
                    >
                      <Loader2Icon v-if="actionKey === `cursor:installDownloadedVsix:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                      {{ t('editorExtensions.installDownloadedVsix') }}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      :disabled="Boolean(actionKey)"
                      @click="emit('downloadVsix', 'cursor', record.extensionId)"
                    >
                      <Loader2Icon v-if="actionKey === `cursor:downloadVsix:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                      {{ t('editorExtensions.downloadVsix') }}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      :disabled="Boolean(actionKey)"
                      @click="emit('runCommand', 'cursor', 'uninstall', record.extensionId)"
                    >
                      <Loader2Icon v-if="actionKey === `cursor:uninstall:${record.extensionId}`" data-icon="inline-start" class="animate-spin" />
                      {{ t('editorExtensions.uninstall') }}
                    </Button>
                  </div>
                </div>
              </TableCell>
              <TableCell class="align-top">
                <div class="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" @click="emit('edit', record)">
                    <PencilIcon data-icon="inline-start" />
                    {{ t('editorExtensions.edit') }}
                  </Button>
                  <ConfirmButton
                    :title="t('editorExtensions.delete')"
                    :description="t('editorExtensions.deleteConfirm')"
                    :confirm-text="t('editorExtensions.delete')"
                    :cancel-text="t('editorExtensions.cancel')"
                    variant="destructive"
                    size="sm"
                    @confirm="emit('delete', record.id)"
                  >
                    <Trash2Icon data-icon="inline-start" />
                    {{ t('editorExtensions.delete') }}
                  </ConfirmButton>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
</template>
