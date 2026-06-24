<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { ButtonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const props = withDefaults(defineProps<{
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  disabled?: boolean;
  class?: HTMLAttributes['class'];
}>(), {
  variant: 'outline',
  size: 'default',
  disabled: false,
});

const emit = defineEmits<{
  confirm: [];
}>();
</script>

<template>
  <AlertDialog>
    <AlertDialogTrigger as-child>
      <Button :variant="props.variant" :size="props.size" :disabled="props.disabled" :class="props.class">
        <slot />
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ props.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ props.description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ props.cancelText }}</AlertDialogCancel>
        <AlertDialogAction @click="emit('confirm')">
          {{ props.confirmText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
