<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import EditorExtensionFormDialog from '@/features/editor-extensions/components/EditorExtensionFormDialog.vue';
import EditorExtensionsBulkActionsCard from '@/features/editor-extensions/components/EditorExtensionsBulkActionsCard.vue';
import EditorExtensionsDownloadSettingsCard from '@/features/editor-extensions/components/EditorExtensionsDownloadSettingsCard.vue';
import EditorExtensionsHeader from '@/features/editor-extensions/components/EditorExtensionsHeader.vue';
import EditorExtensionsImportCard from '@/features/editor-extensions/components/EditorExtensionsImportCard.vue';
import EditorExtensionsInitializeCard from '@/features/editor-extensions/components/EditorExtensionsInitializeCard.vue';
import EditorExtensionsListCard from '@/features/editor-extensions/components/EditorExtensionsListCard.vue';
import EditorExtensionsOutputCard from '@/features/editor-extensions/components/EditorExtensionsOutputCard.vue';
import { useEditorExtensions } from '@/features/editor-extensions/composables/useEditorExtensions';

type FormTextField = 'extensionId' | 'name' | 'note';

const { t } = useI18n();

const {
  loading,
  actionKey,
  initializingSource,
  showFormModal,
  filterScope,
  keyword,
  sortField,
  sortDirection,
  importMarkdown,
  importScope,
  vsixDownloadDir,
  lastOutput,
  markdownPlaceholder,
  form,
  scopeOptions,
  filterScopeOptions,
  sortFieldOptions,
  sortDirectionOptions,
  exportOptions,
  initializeOptions,
  stats,
  filteredRecords,
  openCreateModal,
  editRecord,
  loadRecords,
  loadEditorExtensionConfig,
  selectVsixDownloadDir,
  saveRecord,
  deleteRecord,
  exportMarkdown,
  readClipboard,
  copyExtensionId,
  importFromMarkdown,
  initializeFromInstalled,
  statusVariant,
  statusLabel,
  downloadVsix,
  canInstallDownloadedVsix,
  installDownloadedVsix,
  runCommand,
  runBulk,
  updateImportScope,
  updateFilterScope,
  updateSortField,
  updateSortDirection,
  updateFormScope,
} = useEditorExtensions({ t });

function updateShowFormModal(value: boolean): void {
  showFormModal.value = value;
}

function updateKeyword(value: string): void {
  keyword.value = value;
}

function updateImportMarkdown(value: string): void {
  importMarkdown.value = value;
}

function updateFormField(field: FormTextField, value: string): void {
  form[field] = value;
}

onMounted(() => {
  void loadRecords();
  void loadEditorExtensionConfig();
});
</script>

<template>
  <main class="editor-extensions-page min-h-full p-4 lg:p-6">
    <div class="flex w-full max-w-none flex-col gap-4">
      <EditorExtensionsHeader
        :loading="loading"
        :export-options="exportOptions"
        @open-create="openCreateModal"
        @refresh="loadRecords()"
        @export-markdown="exportMarkdown"
      />

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div class="flex flex-col gap-4">
          <EditorExtensionsInitializeCard
            :initialize-options="initializeOptions"
            :initializing-source="initializingSource"
            @initialize="initializeFromInstalled"
          />

          <EditorExtensionsDownloadSettingsCard
            :vsix-download-dir="vsixDownloadDir"
            @select-dir="selectVsixDownloadDir"
          />

          <EditorExtensionsImportCard
            :import-scope="importScope"
            :import-markdown="importMarkdown"
            :scope-options="scopeOptions"
            :markdown-placeholder="markdownPlaceholder"
            @update:import-scope="updateImportScope"
            @update:import-markdown="updateImportMarkdown"
            @read-clipboard="readClipboard"
            @import-markdown="importFromMarkdown"
          />

          <EditorExtensionsBulkActionsCard
            :action-key="actionKey"
            @run-bulk="runBulk"
          />
        </div>

        <EditorExtensionsListCard
          :filtered-records="filteredRecords"
          :stats="stats"
          :keyword="keyword"
          :filter-scope="filterScope"
          :sort-field="sortField"
          :sort-direction="sortDirection"
          :filter-scope-options="filterScopeOptions"
          :sort-field-options="sortFieldOptions"
          :sort-direction-options="sortDirectionOptions"
          :action-key="actionKey"
          :status-variant="statusVariant"
          :status-label="statusLabel"
          :can-install-downloaded-vsix="canInstallDownloadedVsix"
          @update:keyword="updateKeyword"
          @update:filter-scope="updateFilterScope"
          @update:sort-field="updateSortField"
          @update:sort-direction="updateSortDirection"
          @copy-extension-id="copyExtensionId"
          @run-command="runCommand"
          @install-downloaded-vsix="installDownloadedVsix"
          @download-vsix="downloadVsix"
          @edit="editRecord"
          @delete="deleteRecord"
        />
      </div>

      <EditorExtensionsOutputCard :last-output="lastOutput" />

      <EditorExtensionFormDialog
        :open="showFormModal"
        :form="form"
        :scope-options="scopeOptions"
        @update:open="updateShowFormModal"
        @update-field="updateFormField"
        @update-scope="updateFormScope"
        @save="saveRecord"
      />
    </div>
  </main>
</template>

<style scoped>
.editor-extensions-page {
  background:
    radial-gradient(900px 420px at 90% -10%, rgba(20, 184, 166, 0.14), transparent 60%),
    linear-gradient(180deg, #111827 0%, #0f141d 100%);
}
</style>
