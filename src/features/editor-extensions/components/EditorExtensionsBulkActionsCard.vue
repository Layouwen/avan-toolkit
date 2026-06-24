<script setup lang="ts">
import type { EditorKind } from '../../../electron-api.d';
import type { EditorExtensionCommandAction } from '@/features/editor-extensions/types';
import { Loader2Icon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import ConfirmButton from '@/components/ConfirmButton.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

defineProps<{
  actionKey: string;
}>();

const emit = defineEmits<{
  runBulk: [editor: EditorKind, action: EditorExtensionCommandAction, target: EditorKind | 'common'];
}>();

const { t } = useI18n();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        {{ t('editorExtensions.bulkTitle') }}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="grid grid-cols-1 gap-2">
        <Button
          v-for="target in ['common', 'vscode']"
          :key="`vscode-install-${target}`"
          variant="secondary"
          :disabled="Boolean(actionKey)"
          @click="emit('runBulk', 'vscode', 'install', target as EditorKind | 'common')"
        >
          <Loader2Icon v-if="actionKey === `vscode:install:bulk:${target}`" data-icon="inline-start" class="animate-spin" />
          {{ t('editorExtensions.bulkInstallVscode', { target: t(`editorExtensions.scopes.${target}`) }) }}
        </Button>
        <Button
          v-for="target in ['common', 'cursor']"
          :key="`cursor-install-${target}`"
          variant="secondary"
          :disabled="Boolean(actionKey)"
          @click="emit('runBulk', 'cursor', 'install', target as EditorKind | 'common')"
        >
          <Loader2Icon v-if="actionKey === `cursor:install:bulk:${target}`" data-icon="inline-start" class="animate-spin" />
          {{ t('editorExtensions.bulkInstallCursor', { target: t(`editorExtensions.scopes.${target}`) }) }}
        </Button>
        <ConfirmButton
          v-for="target in ['common', 'vscode']"
          :key="`vscode-uninstall-${target}`"
          :title="t('editorExtensions.uninstall')"
          :description="t('editorExtensions.bulkUninstallConfirm')"
          :confirm-text="t('editorExtensions.uninstall')"
          :cancel-text="t('editorExtensions.cancel')"
          variant="destructive"
          :disabled="Boolean(actionKey)"
          @confirm="emit('runBulk', 'vscode', 'uninstall', target as EditorKind | 'common')"
        >
          <Loader2Icon v-if="actionKey === `vscode:uninstall:bulk:${target}`" data-icon="inline-start" class="animate-spin" />
          {{ t('editorExtensions.bulkUninstallVscode', { target: t(`editorExtensions.scopes.${target}`) }) }}
        </ConfirmButton>
        <ConfirmButton
          v-for="target in ['common', 'cursor']"
          :key="`cursor-uninstall-${target}`"
          :title="t('editorExtensions.uninstall')"
          :description="t('editorExtensions.bulkUninstallConfirm')"
          :confirm-text="t('editorExtensions.uninstall')"
          :cancel-text="t('editorExtensions.cancel')"
          variant="destructive"
          :disabled="Boolean(actionKey)"
          @confirm="emit('runBulk', 'cursor', 'uninstall', target as EditorKind | 'common')"
        >
          <Loader2Icon v-if="actionKey === `cursor:uninstall:bulk:${target}`" data-icon="inline-start" class="animate-spin" />
          {{ t('editorExtensions.bulkUninstallCursor', { target: t(`editorExtensions.scopes.${target}`) }) }}
        </ConfirmButton>
      </div>
    </CardContent>
  </Card>
</template>
