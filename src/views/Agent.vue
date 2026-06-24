<script setup lang="ts">
import type { AgentConfig, AgentResult } from '../electron-api.d';
import { Loader2Icon, SendIcon } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const { t } = useI18n();

const prompt = ref('');
const running = ref(false);
const errorMessage = ref('');
const result = ref<AgentResult | null>(null);
const agentConfig = ref<AgentConfig>({
  baseURL: '',
  model: '',
  apiKey: '',
});

onMounted(async () => {
  const config = await window.electronAPI.getConfig();
  if (config.agent) {
    agentConfig.value = { ...config.agent };
  }
});

async function saveAgentConfig() {
  const config = await window.electronAPI.getConfig();
  await window.electronAPI.setConfig({ ...config, agent: { ...agentConfig.value } });
}

async function runAgent() {
  if (!prompt.value.trim() || running.value) {
    return;
  }

  if (!agentConfig.value.baseURL.trim() || !agentConfig.value.model.trim() || !agentConfig.value.apiKey.trim()) {
    errorMessage.value = t('agentPage.error', { error: t('agentPage.configRequired') });
    return;
  }

  running.value = true;
  errorMessage.value = '';
  result.value = null;

  try {
    const runtimeConfig = {
      baseURL: agentConfig.value.baseURL.trim().replace(/\/+$/, ''),
      model: agentConfig.value.model.trim(),
      apiKey: agentConfig.value.apiKey.trim(),
    };

    agentConfig.value = { ...runtimeConfig };
    await saveAgentConfig();
    result.value = await window.electronAPI.recommendActivity(prompt.value.trim(), runtimeConfig);
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = t('agentPage.error', { error: message });
  }
  finally {
    running.value = false;
  }
}

const stepItems = computed(() => [
  t('agentPage.steps.config'),
  t('agentPage.steps.singleTurn'),
  t('agentPage.steps.history'),
  t('agentPage.steps.rawPayload'),
]);

const demoItems = computed(() => [
  t('agentPage.demos.promptTemplate'),
  t('agentPage.demos.toolCalling'),
  t('agentPage.demos.rag'),
  t('agentPage.demos.memory'),
  t('agentPage.demos.multiAgent'),
  t('agentPage.demos.tracing'),
]);
</script>

<template>
  <main class="agent-demo-page min-h-full p-6">
    <div class="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{{ t('agentPage.title') }}</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle class="text-base">
                {{ t('agentPage.configTitle') }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel for="agent-base-url">
                    {{ t('agentPage.baseUrlLabel') }}
                  </FieldLabel>
                  <Input
                    id="agent-base-url"
                    v-model="agentConfig.baseURL"
                    :placeholder="t('agentPage.baseUrlPlaceholder')"
                    @blur="saveAgentConfig"
                  />
                </Field>
                <Field>
                  <FieldLabel for="agent-model">
                    {{ t('agentPage.modelInputLabel') }}
                  </FieldLabel>
                  <Input
                    id="agent-model"
                    v-model="agentConfig.model"
                    :placeholder="t('agentPage.modelPlaceholder')"
                    @blur="saveAgentConfig"
                  />
                </Field>
                <Field>
                  <FieldLabel for="agent-api-key">
                    {{ t('agentPage.apiKeyLabel') }}
                  </FieldLabel>
                  <Input
                    id="agent-api-key"
                    v-model="agentConfig.apiKey"
                    type="password"
                    :placeholder="t('agentPage.apiKeyPlaceholder')"
                    @blur="saveAgentConfig"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Textarea
            v-model="prompt"
            :rows="3"
            :placeholder="t('agentPage.inputPlaceholder')"
          />
          <div class="flex justify-end">
            <Button
              :disabled="!prompt.trim() || running"
              @click="runAgent"
            >
              <Loader2Icon v-if="running" data-icon="inline-start" class="animate-spin" />
              <SendIcon v-else data-icon="inline-start" />
              {{ t('agentPage.send') }}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle class="text-base">
                {{ t('agentPage.outputTitle') }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div v-if="running" class="flex items-center gap-2 text-muted-foreground">
                <Loader2Icon class="size-4 animate-spin" />
                {{ t('agentPage.running') }}
              </div>
              <Alert v-else-if="errorMessage" variant="destructive">
                <AlertDescription class="whitespace-pre-wrap break-all">
                  {{ errorMessage }}
                </AlertDescription>
              </Alert>
              <div v-else-if="result" class="flex flex-col gap-3">
                <p class="m-0 leading-6 text-card-foreground">
                  {{ result.answer }}
                </p>
                <div class="text-xs text-muted-foreground">
                  {{ t('agentPage.endpointLabel') }}: {{ result.baseURL }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ t('agentPage.modelLabel') }}: {{ result.model }}
                </div>
                <Separator />
                <div class="text-sm text-card-foreground">
                  {{ t('agentPage.traceTitle') }}
                </div>
                <ul class="overflow-hidden rounded-md border">
                  <li v-for="item in result.trace" :key="item" class="border-b px-3 py-2 text-sm last:border-b-0">
                    {{ item }}
                  </li>
                </ul>
              </div>
              <span v-else class="text-muted-foreground">{{ t('agentPage.waiting') }}</span>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              {{ t('agentPage.stepTitle') }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="overflow-hidden rounded-md border">
              <li v-for="item in stepItems" :key="item" class="border-b px-3 py-2 text-sm last:border-b-0">
                {{ item }}
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              {{ t('agentPage.demoTitle') }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="item in demoItems" :key="item" variant="secondary">
                {{ item }}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </main>
</template>

<style scoped>
.agent-demo-page {
  background:
    radial-gradient(1200px 500px at 85% -20%, rgba(72, 144, 255, 0.24), transparent 60%),
    radial-gradient(900px 460px at -10% 120%, rgba(61, 115, 199, 0.16), transparent 60%),
    linear-gradient(180deg, #121720 0%, #0f141d 100%);
}
</style>
