<script setup lang="ts">
import {
  NButton,
  NCard,
  NInput,
  NList,
  NListItem,
  NSpace,
  NTag,
  NThing,
} from 'naive-ui';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const prompt = ref('');

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
          <NInput
            v-model:value="prompt"
            type="textarea"
            :rows="3"
            :placeholder="t('agentPage.inputPlaceholder')"
          />
          <NSpace justify="end">
            <NButton type="primary" :disabled="!prompt.trim()">
              {{ t('agentPage.send') }}
            </NButton>
          </NSpace>
          <NCard size="small" :title="t('agentPage.outputTitle')" embedded>
            <span class="text-[#94a3b8]">{{ t('agentPage.waiting') }}</span>
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
