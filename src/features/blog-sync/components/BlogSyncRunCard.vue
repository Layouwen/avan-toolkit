<script setup lang="ts">
import type { BadgeVariants } from '@/components/ui/badge';
import { CheckCircle2Icon, Loader2Icon, RotateCcwIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const props = defineProps<{
  syncing: boolean;
  pullingBlog: boolean;
  canSync: boolean;
  canPull: boolean;
  status: SyncStatus;
}>();

const emit = defineEmits<{
  startSync: [];
  pullBlog: [];
}>();

const { t } = useI18n();

function statusBadgeVariant(): BadgeVariants['variant'] {
  if (props.status === 'success') {
    return 'default';
  }
  if (props.status === 'error') {
    return 'destructive';
  }
  if (props.status === 'syncing') {
    return 'secondary';
  }
  return 'outline';
}
</script>

<template>
  <Card>
    <CardContent>
      <div class="flex flex-wrap items-center gap-2">
        <Button :disabled="!canSync" @click="emit('startSync')">
          <Loader2Icon v-if="syncing" data-icon="inline-start" class="animate-spin" />
          <CheckCircle2Icon v-else data-icon="inline-start" />
          {{ syncing ? t('blogSync.action.syncing') : t('blogSync.action.sync') }}
        </Button>
        <Button variant="secondary" :disabled="!canPull" @click="emit('pullBlog')">
          <Loader2Icon v-if="pullingBlog" data-icon="inline-start" class="animate-spin" />
          <RotateCcwIcon v-else data-icon="inline-start" />
          {{ pullingBlog ? t('blogSync.action.pulling') : t('blogSync.action.pull') }}
        </Button>
        <Badge :variant="statusBadgeVariant()">
          {{ t(`blogSync.status.${status}`) }}
        </Badge>
      </div>
    </CardContent>
  </Card>
</template>
