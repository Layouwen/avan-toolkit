<script setup lang="ts">
import type { BlogValidationIssue, BlogValidationResult } from '../../../electron-api.d';
import type { BadgeVariants } from '@/components/ui/badge';
import { ExternalLinkIcon, FolderOpenIcon, Loader2Icon, RefreshCwIcon, XIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import ConfirmButton from '@/components/ConfirmButton.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

defineProps<{
  obsidianConfigured: boolean;
  hexoConfigured: boolean;
  validationError: string;
  validationResult: BlogValidationResult;
  validatingBlogs: boolean;
  openingValidationIssueId: string;
  deletingHexoIssueId: string;
}>();

const emit = defineEmits<{
  clearError: [];
  refresh: [];
  openConfiguredDir: [kind: 'obsidian' | 'hexo'];
  openObsidianPage: [];
  openHexoProject: [];
  openIssue: [issue: BlogValidationIssue];
  deleteHexoOrphan: [issue: BlogValidationIssue];
}>();

const { t } = useI18n();

function issueBadgeVariant(issue: BlogValidationIssue): BadgeVariants['variant'] {
  return issue.severity === 'error' ? 'destructive' : 'secondary';
}

function canDeleteHexoOrphanIssue(issue: BlogValidationIssue) {
  return issue.source === 'hexo' && issue.field === 'sync:missingObsidian';
}
</script>

<template>
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
            :disabled="!obsidianConfigured"
            @click="emit('openConfiguredDir', 'obsidian')"
          >
            <FolderOpenIcon data-icon="inline-start" />
            {{ t('blogSync.validation.openObsidianDir') }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :disabled="!hexoConfigured"
            @click="emit('openConfiguredDir', 'hexo')"
          >
            <FolderOpenIcon data-icon="inline-start" />
            {{ t('blogSync.validation.openHexoDir') }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :disabled="!obsidianConfigured"
            @click="emit('openObsidianPage')"
          >
            <ExternalLinkIcon data-icon="inline-start" />
            {{ t('blogSync.validation.openObsidianPage') }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :disabled="!hexoConfigured"
            @click="emit('openHexoProject')"
          >
            <ExternalLinkIcon data-icon="inline-start" />
            {{ t('blogSync.validation.openProjectDir') }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :disabled="!obsidianConfigured"
            @click="emit('refresh')"
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
          <Button variant="ghost" size="icon-sm" @click="emit('clearError')">
            <XIcon />
          </Button>
        </AlertDescription>
      </Alert>

      <Alert v-if="validationResult.ok">
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
                @confirm="emit('deleteHexoOrphan', issue)"
              >
                <Loader2Icon v-if="deletingHexoIssueId === issue.id" data-icon="inline-start" class="animate-spin" />
                {{ t('blogSync.validation.deleteHexoOrphan') }}
              </ConfirmButton>
              <Button
                size="sm"
                variant="secondary"
                :disabled="Boolean(openingValidationIssueId)"
                @click="emit('openIssue', issue)"
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
</template>

<style scoped>
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
