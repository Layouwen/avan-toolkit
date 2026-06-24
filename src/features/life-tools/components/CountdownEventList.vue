<script setup lang="ts">
import type { CountdownEventViewModel } from '../composables/useLifeTools';
import { CalendarDaysIcon, PencilIcon, PinIcon, RotateCcwIcon, Trash2Icon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ConfirmButton from '@/components/ConfirmButton.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

const props = defineProps<{
  events: CountdownEventViewModel[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (event: 'edit', eventId: string): void;
  (event: 'delete', eventId: string): void;
}>();

const { t } = useI18n();

const eventRows = computed(() =>
  props.events.map(({ event, summary }) => ({
    event,
    summary,
    categoryLabel: event.category || t('lifeToolsPage.countdown.uncategorized'),
    dayLabel: formatDays(summary.daysRemaining, summary.state),
    occurrenceLabel: event.recurrence === 'yearly'
      ? t('lifeToolsPage.countdown.yearlyOccurrence', { date: event.date, occurrence: summary.occurrenceDate })
      : summary.occurrenceDate,
    recurrenceLabel: event.recurrence === 'yearly'
      ? t('lifeToolsPage.countdown.yearly')
      : t('lifeToolsPage.countdown.oneTime'),
    stateVariant: summary.state === 'past' ? 'outline' : 'secondary',
  })),
);

function formatDays(daysRemaining: number, state: CountdownEventViewModel['summary']['state']): string {
  if (state === 'today') {
    return t('lifeToolsPage.countdown.today');
  }
  if (state === 'past') {
    return t('lifeToolsPage.countdown.daysPast', { count: Math.abs(daysRemaining) });
  }
  return t('lifeToolsPage.countdown.daysRemaining', { count: daysRemaining });
}
</script>

<template>
  <section class="flex min-h-0 flex-col gap-3">
    <div class="flex min-w-0 items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-base font-semibold text-foreground">
          {{ t('lifeToolsPage.countdown.listTitle') }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t('lifeToolsPage.countdown.listDescription', { count: events.length }) }}
        </p>
      </div>
    </div>

    <Empty v-if="!loading && eventRows.length === 0" class="min-h-48 rounded-lg border bg-card/70">
      <EmptyHeader>
        <EmptyTitle>{{ t('lifeToolsPage.countdown.emptyTitle') }}</EmptyTitle>
        <EmptyDescription>{{ t('lifeToolsPage.countdown.emptyDescription') }}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CalendarDaysIcon class="mx-auto size-8 text-muted-foreground" />
      </EmptyContent>
    </Empty>

    <div v-else class="flex min-h-0 flex-col gap-3">
      <Card
        v-for="row in eventRows"
        :key="row.event.id"
        class="rounded-lg py-4 transition-colors hover:bg-accent/30"
      >
        <CardHeader class="gap-2 px-4">
          <div class="flex min-w-0 items-start justify-between gap-3">
            <div class="min-w-0">
              <CardTitle class="flex min-w-0 items-center gap-2 text-base">
                <PinIcon v-if="row.event.pinned" class="size-4 shrink-0 text-primary" />
                <span class="truncate">{{ row.event.title }}</span>
              </CardTitle>
              <div class="mt-2 flex flex-wrap gap-2">
                <Badge :variant="row.stateVariant">
                  {{ row.dayLabel }}
                </Badge>
                <Badge variant="outline">
                  {{ row.categoryLabel }}
                </Badge>
                <Badge variant="outline">
                  <RotateCcwIcon v-if="row.event.recurrence === 'yearly'" class="mr-1 size-3" />
                  {{ row.recurrenceLabel }}
                </Badge>
                <Badge v-if="row.event.reminderDaysBefore !== null && row.event.reminderDaysBefore !== undefined" variant="outline">
                  {{ t('lifeToolsPage.countdown.reminderBadge', { count: row.event.reminderDaysBefore }) }}
                </Badge>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" :aria-label="t('lifeToolsPage.common.edit')" @click="emit('edit', row.event.id)">
                <PencilIcon class="size-4" />
              </Button>
              <ConfirmButton
                :title="t('lifeToolsPage.countdown.deleteTitle')"
                :description="t('lifeToolsPage.countdown.deleteDescription', { title: row.event.title })"
                :confirm-text="t('lifeToolsPage.common.delete')"
                :cancel-text="t('lifeToolsPage.common.cancel')"
                variant="ghost"
                size="icon"
                @confirm="emit('delete', row.event.id)"
              >
                <Trash2Icon class="size-4" />
                <span class="sr-only">{{ t('lifeToolsPage.common.delete') }}</span>
              </ConfirmButton>
            </div>
          </div>
        </CardHeader>

        <CardContent class="px-4">
          <div class="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div class="min-w-0">
              <span class="text-card-foreground">{{ t('lifeToolsPage.countdown.dateLabel') }}:</span>
              <span class="ml-1 break-words">{{ row.occurrenceLabel }}</span>
            </div>
            <div v-if="row.event.notes" class="min-w-0 sm:text-right">
              <span class="break-words">{{ row.event.notes }}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
