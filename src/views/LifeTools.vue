<script setup lang="ts">
import type { CountdownEventDraft } from '@/features/life-tools/composables/useLifeTools';
import { computed, onMounted, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import CountdownEventForm from '@/features/life-tools/components/CountdownEventForm.vue';
import CountdownEventList from '@/features/life-tools/components/CountdownEventList.vue';
import FocusTimerPanel from '@/features/life-tools/components/FocusTimerPanel.vue';
import { useLifeTools } from '@/features/life-tools/composables/useLifeTools';

const { t } = useI18n();
const lifeTools = useLifeTools();
const editingEventId = shallowRef<string | null>(null);

const editingEvent = computed(() =>
  lifeTools.countdownEvents.value.find(event => event.id === editingEventId.value),
);

onMounted(() => {
  void lifeTools.loadLifeTools();
});

async function handleSaveCountdownEvent(draft: CountdownEventDraft) {
  await lifeTools.saveCountdownEvent(draft);
  editingEventId.value = null;
}

async function handleDeleteCountdownEvent(eventId: string) {
  if (editingEventId.value === eventId) {
    editingEventId.value = null;
  }
  await lifeTools.deleteCountdownEvent(eventId);
}
</script>

<template>
  <main class="life-tools-page min-h-full p-4 sm:p-6">
    <div class="mx-auto flex max-w-7xl flex-col gap-5">
      <header class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold tracking-normal text-foreground">
            {{ t('lifeToolsPage.title') }}
          </h1>
          <p class="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {{ t('lifeToolsPage.description') }}
          </p>
        </div>
      </header>

      <p v-if="lifeTools.errorMessage.value" class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {{ lifeTools.errorMessage.value }}
      </p>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-5">
          <CountdownEventForm
            :event="editingEvent"
            :submitting="lifeTools.saving.value"
            @submit="handleSaveCountdownEvent"
            @cancel="editingEventId = null"
          />

          <FocusTimerPanel
            :presets="lifeTools.focusPresets.value"
            :selected-preset-id="lifeTools.selectedFocusPresetId.value"
            :active-session="lifeTools.activeFocusSession.value"
            :status="lifeTools.focusStatus.value"
            :remaining-seconds="lifeTools.focusRemainingSeconds.value"
            :progress-percent="lifeTools.focusProgressPercent.value"
            :history="lifeTools.focusHistory.value"
            :saving="lifeTools.saving.value"
            @select-preset="lifeTools.selectFocusPreset"
            @start="lifeTools.startFocusSession"
            @complete="lifeTools.completeFocusSession"
            @cancel="lifeTools.cancelFocusSession"
          />
        </div>

        <CountdownEventList
          :events="lifeTools.sortedCountdownEvents.value"
          :loading="lifeTools.loading.value"
          @edit="editingEventId = $event"
          @delete="handleDeleteCountdownEvent"
        />
      </div>
    </div>
  </main>
</template>

<style scoped>
.life-tools-page {
  background:
    radial-gradient(900px 360px at 92% -10%, rgba(22, 163, 74, 0.16), transparent 60%),
    radial-gradient(720px 420px at -8% 18%, rgba(14, 165, 233, 0.12), transparent 55%),
    linear-gradient(180deg, hsl(var(--background)) 0%, rgba(12, 18, 26, 0.96) 100%);
}
</style>
