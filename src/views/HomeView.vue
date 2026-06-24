<script setup lang="ts">
import { ArrowRightIcon } from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const router = useRouter();
const { t } = useI18n();

const tools = computed(() => [
  {
    title: t('home.tools.blogSync.title'),
    description: t('home.tools.blogSync.description'),
    path: '/sync',
  },
  {
    title: t('home.tools.agent.title'),
    description: t('home.tools.agent.description'),
    path: '/agent',
  },
  {
    title: t('home.tools.qzone.title'),
    description: t('home.tools.qzone.description'),
    path: '/qzone',
  },
  {
    title: t('home.tools.editorExtensions.title'),
    description: t('home.tools.editorExtensions.description'),
    path: '/editor-extensions',
  },
  {
    title: t('home.tools.screensaver.title'),
    description: t('home.tools.screensaver.description'),
    path: '/screensaver',
  },
]);
</script>

<template>
  <main class="min-h-full p-6">
    <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-normal text-foreground">
            {{ t('home.title') }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Toolkit
          </p>
        </div>
        <Badge variant="secondary">
          shadcn-vue
        </Badge>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          v-for="tool in tools"
          :key="tool.path"
          class="tool-card cursor-pointer transition-colors hover:bg-accent/40"
          @click="router.push(tool.path)"
        >
          <CardHeader>
            <CardTitle class="text-base">
              {{ tool.title }}
            </CardTitle>
            <CardDescription class="leading-6">
              {{ tool.description }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" size="sm">
              <ArrowRightIcon data-icon="inline-start" />
              Open
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  </main>
</template>
