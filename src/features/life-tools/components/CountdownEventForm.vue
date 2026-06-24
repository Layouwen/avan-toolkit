<script setup lang="ts">
import type { CountdownEventDraft } from '../composables/useLifeTools';
import type { CountdownEvent, CountdownRecurrence } from '../types';
import { SaveIcon, XIcon } from '@lucide/vue';
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const props = defineProps<{
  event?: CountdownEvent;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (event: 'submit', draft: CountdownEventDraft): void;
  (event: 'cancel'): void;
}>();

const { t } = useI18n();

interface FormState {
  title: string;
  date: string;
  recurrence: CountdownRecurrence;
  category: string;
  pinned: boolean;
  reminderDaysBefore: number | null;
  notes: string;
}

const form = reactive<FormState>(createEmptyForm());

const isEditing = computed(() => Boolean(props.event));
const canSubmit = computed(() => form.title.trim().length > 0 && form.date.trim().length > 0);
const submitLabel = computed(() => (isEditing.value ? t('lifeToolsPage.countdown.update') : t('lifeToolsPage.countdown.add')));

watch(
  () => props.event,
  (event) => {
    Object.assign(form, event ? formFromEvent(event) : createEmptyForm());
  },
  { immediate: true },
);

function handleSubmit() {
  if (!canSubmit.value || props.submitting) {
    return;
  }

  emit('submit', {
    id: props.event?.id,
    title: form.title,
    date: form.date,
    recurrence: form.recurrence,
    category: form.category,
    pinned: form.pinned,
    reminderDaysBefore: form.reminderDaysBefore,
    notes: form.notes,
  });

  if (!props.event) {
    Object.assign(form, createEmptyForm());
  }
}

function createEmptyForm(): FormState {
  return {
    title: '',
    date: formatLocalDateInputValue(),
    recurrence: 'none',
    category: '',
    pinned: false,
    reminderDaysBefore: null,
    notes: '',
  };
}

function formFromEvent(event: CountdownEvent): FormState {
  return {
    title: event.title,
    date: event.date,
    recurrence: event.recurrence,
    category: event.category ?? '',
    pinned: Boolean(event.pinned),
    reminderDaysBefore: event.reminderDaysBefore ?? null,
    notes: event.notes ?? '',
  };
}

function formatLocalDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
</script>

<template>
  <section class="rounded-lg border bg-card/80 p-4 shadow-sm">
    <div class="mb-4 flex min-w-0 items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-base font-semibold text-card-foreground">
          {{ isEditing ? t('lifeToolsPage.countdown.editTitle') : t('lifeToolsPage.countdown.formTitle') }}
        </h2>
        <p class="mt-1 text-sm leading-6 text-muted-foreground">
          {{ t('lifeToolsPage.countdown.formDescription') }}
        </p>
      </div>
      <Button v-if="isEditing" type="button" variant="ghost" size="icon" :aria-label="t('lifeToolsPage.common.cancel')" @click="emit('cancel')">
        <XIcon class="size-4" />
      </Button>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <FieldGroup>
        <Field>
          <FieldLabel for="life-event-title">
            {{ t('lifeToolsPage.countdown.titleLabel') }}
          </FieldLabel>
          <Input
            id="life-event-title"
            v-model="form.title"
            :placeholder="t('lifeToolsPage.countdown.titlePlaceholder')"
            maxlength="80"
          />
        </Field>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel for="life-event-date">
              {{ t('lifeToolsPage.countdown.dateLabel') }}
            </FieldLabel>
            <Input id="life-event-date" v-model="form.date" type="date" />
          </Field>

          <Field>
            <FieldLabel for="life-event-recurrence">
              {{ t('lifeToolsPage.countdown.recurrenceLabel') }}
            </FieldLabel>
            <NativeSelect id="life-event-recurrence" v-model="form.recurrence" class="w-full">
              <NativeSelectOption value="none">
                {{ t('lifeToolsPage.countdown.oneTime') }}
              </NativeSelectOption>
              <NativeSelectOption value="yearly">
                {{ t('lifeToolsPage.countdown.yearly') }}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field>
            <FieldLabel for="life-event-category">
              {{ t('lifeToolsPage.countdown.categoryLabel') }}
            </FieldLabel>
            <Input
              id="life-event-category"
              v-model="form.category"
              :placeholder="t('lifeToolsPage.countdown.categoryPlaceholder')"
              maxlength="32"
            />
          </Field>

          <Field>
            <FieldLabel for="life-event-reminder">
              {{ t('lifeToolsPage.countdown.reminderDaysBefore') }}
            </FieldLabel>
            <Input
              id="life-event-reminder"
              v-model.number="form.reminderDaysBefore"
              type="number"
              min="0"
              max="365"
              :placeholder="t('lifeToolsPage.countdown.noReminder')"
            />
          </Field>
        </div>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>{{ t('lifeToolsPage.countdown.pinnedLabel') }}</FieldTitle>
          </FieldContent>
          <Switch v-model="form.pinned" :aria-label="t('lifeToolsPage.countdown.pinnedLabel')" />
        </Field>

        <Field>
          <FieldLabel for="life-event-notes">
            {{ t('lifeToolsPage.countdown.notesLabel') }}
          </FieldLabel>
          <Textarea
            id="life-event-notes"
            v-model="form.notes"
            :placeholder="t('lifeToolsPage.countdown.notesPlaceholder')"
            class="min-h-20"
            maxlength="240"
          />
        </Field>
      </FieldGroup>

      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button v-if="isEditing" type="button" variant="ghost" @click="emit('cancel')">
          <XIcon data-icon="inline-start" />
          {{ t('lifeToolsPage.common.cancel') }}
        </Button>
        <Button type="submit" :disabled="!canSubmit || submitting">
          <SaveIcon data-icon="inline-start" />
          {{ submitLabel }}
        </Button>
      </div>
    </form>
  </section>
</template>
