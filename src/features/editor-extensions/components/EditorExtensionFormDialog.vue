<script setup lang="ts">
import type { EditorExtensionRecord, EditorExtensionScope } from '../../../electron-api.d';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ScopeOption {
  label: string;
  value: EditorExtensionScope;
}

type FormTextField = 'extensionId' | 'name' | 'note';

defineProps<{
  open: boolean;
  form: Partial<EditorExtensionRecord>;
  scopeOptions: ScopeOption[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'updateField': [field: FormTextField, value: string];
  'updateScope': [value: unknown];
  'save': [];
}>();

const { t } = useI18n();
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{{ form.id ? t('editorExtensions.editTitle') : t('editorExtensions.addTitle') }}</DialogTitle>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel for="extension-id">
            {{ t('editorExtensions.extensionId') }}
          </FieldLabel>
          <Input
            id="extension-id"
            :model-value="form.extensionId"
            placeholder="publisher.extension"
            @update:model-value="emit('updateField', 'extensionId', String($event ?? ''))"
          />
        </Field>
        <Field>
          <FieldLabel for="extension-name">
            {{ t('editorExtensions.extensionName') }}
          </FieldLabel>
          <Input
            id="extension-name"
            :model-value="form.name"
            :placeholder="t('editorExtensions.namePlaceholder')"
            @update:model-value="emit('updateField', 'name', String($event ?? ''))"
          />
        </Field>
        <Field>
          <FieldLabel for="extension-note">
            {{ t('editorExtensions.note') }}
          </FieldLabel>
          <Input
            id="extension-note"
            :model-value="form.note"
            :placeholder="t('editorExtensions.notePlaceholder')"
            @update:model-value="emit('updateField', 'note', String($event ?? ''))"
          />
        </Field>
        <Field>
          <FieldLabel>{{ t('editorExtensions.scope') }}</FieldLabel>
          <Select :model-value="form.scope" @update:model-value="emit('updateScope', $event)">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="option in scopeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button variant="secondary" @click="emit('update:open', false)">
          {{ t('editorExtensions.cancel') }}
        </Button>
        <Button @click="emit('save')">
          {{ t('editorExtensions.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
