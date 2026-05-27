<script setup lang="ts">
import type { AgentConfig, AgentResult } from '../electron-api.d';
import {
  NButton,
  NCard,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NList,
  NListItem,
  NSpace,
  NTag,
  NThing,
} from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

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
    <NSpace vertical :size="16" class="mx-auto max-w-4xl">
      <NCard :title="t('agentPage.title')" embedded>
        <NSpace vertical>
          <NCard size="small" :title="t('agentPage.configTitle')" embedded>
            <NForm label-placement="top">
              <NFormItem :label="t('agentPage.baseUrlLabel')">
                <NInput
                  v-model:value="agentConfig.baseURL"
                  :placeholder="t('agentPage.baseUrlPlaceholder')"
                  @blur="saveAgentConfig"
                />
              </NFormItem>
              <NFormItem :label="t('agentPage.modelInputLabel')">
                <NInput
                  v-model:value="agentConfig.model"
                  :placeholder="t('agentPage.modelPlaceholder')"
                  @blur="saveAgentConfig"
                />
              </NFormItem>
              <NFormItem :label="t('agentPage.apiKeyLabel')" class="mb-0!">
                <NInput
                  v-model:value="agentConfig.apiKey"
                  type="password"
                  :placeholder="t('agentPage.apiKeyPlaceholder')"
                  @blur="saveAgentConfig"
                />
              </NFormItem>
            </NForm>
          </NCard>

          <NInput
            v-model:value="prompt"
            type="textarea"
            :rows="3"
            :placeholder="t('agentPage.inputPlaceholder')"
          />
          <NSpace justify="end">
            <NButton
              type="primary"
              :loading="running"
              :disabled="!prompt.trim() || running"
              @click="runAgent"
            >
              {{ t('agentPage.send') }}
            </NButton>
          </NSpace>
          <NCard size="small" :title="t('agentPage.outputTitle')" embedded>
            <div v-if="running" class="text-[#94a3b8]">
              {{ t('agentPage.running') }}
            </div>
            <div v-else-if="errorMessage" class="text-[#e05252] whitespace-pre-wrap break-all">
              {{ errorMessage }}
            </div>
            <div v-else-if="result" class="space-y-2">
              <NThing>
                {{ result.answer }}
              </NThing>
              <div class="text-xs text-[#94a3b8]">
                {{ t('agentPage.endpointLabel') }}: {{ result.baseURL }}
              </div>
              <div class="text-xs text-[#94a3b8]">
                {{ t('agentPage.modelLabel') }}: {{ result.model }}
              </div>
              <NDivider class="my-2!" />
              <div class="text-sm text-[#cbd5e1]">
                {{ t('agentPage.traceTitle') }}
              </div>
              <NList bordered>
                <NListItem v-for="item in result.trace" :key="item">
                  {{ item }}
                </NListItem>
              </NList>
            </div>
            <span v-else class="text-[#94a3b8]">{{ t('agentPage.waiting') }}</span>
          </NCard>
        </NSpace>
      </NCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NCard :title="t('agentPage.stepTitle')" embedded>
          <NList bordered>
            <NListItem v-for="item in stepItems" :key="item">
              <NThing>
                {{ item }}
              </NThing>
            </NListItem>
          </NList>
        </NCard>

        <NCard :title="t('agentPage.demoTitle')" embedded>
          <NSpace>
            <NTag v-for="item in demoItems" :key="item" type="info" round>
              {{ item }}
            </NTag>
          </NSpace>
        </NCard>
      </div>
    </NSpace>
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
