import type { Ref } from 'vue';
import type { AppConfig, BlogValidationIssue, BlogValidationResult } from '../../../electron-api.d';
import { ref, shallowRef } from 'vue';
import { emptyValidationResult } from '@/features/blog-sync/utils';

interface UseBlogSyncValidationOptions {
  config: Ref<AppConfig>;
  plainConfig: () => AppConfig;
}

export function useBlogSyncValidation(options: UseBlogSyncValidationOptions) {
  const validatingBlogs = shallowRef(false);
  const validationError = shallowRef('');
  const validationResult = ref<BlogValidationResult>(emptyValidationResult());
  const openingValidationIssueId = shallowRef('');
  const deletingHexoIssueId = shallowRef('');

  async function loadValidation(): Promise<BlogValidationResult> {
    validationError.value = '';
    if (!options.config.value.obsidianBlogDir.trim()) {
      validationResult.value = emptyValidationResult();
      return validationResult.value;
    }

    validatingBlogs.value = true;
    try {
      await window.electronAPI.setConfig(options.plainConfig());
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

  function clearValidationError() {
    validationError.value = '';
  }

  function resetValidationResult() {
    validationResult.value = emptyValidationResult();
  }

  return {
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
  };
}
