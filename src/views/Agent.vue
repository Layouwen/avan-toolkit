<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const minimalAgentSteps = computed(() => [
  t('agentPage.steps.config'),
  t('agentPage.steps.singleTurn'),
  t('agentPage.steps.history'),
  t('agentPage.steps.rawPayload'),
]);

const advancedDemos = computed(() => [
  t('agentPage.demos.promptTemplate'),
  t('agentPage.demos.toolCalling'),
  t('agentPage.demos.rag'),
  t('agentPage.demos.memory'),
  t('agentPage.demos.multiAgent'),
  t('agentPage.demos.tracing'),
]);
</script>

<template>
  <main class="agent-page h-full overflow-auto p-6">
    <section class="hero mb-5 rounded-2xl border border-[#2f3848] p-6">
      <div class="hero-bg" />
      <div class="relative z-10">
        <p class="text-[12px] tracking-[0.16em] uppercase text-[#96c6ff] mb-2">
          Agent Lab
        </p>
        <h1 class="text-[26px] font-semibold text-[#f4f8ff] leading-tight">
          AI Agent 开发与演示工作台
        </h1>
        <p class="mt-2 text-[14px] text-[#b8c5d8] max-w-190 leading-6">
          当前页面只提供结构与样式，用于承载你后续接入的 OpenAI SDK 最小 Agent 以及 LangChain 等进阶 Demo。
        </p>
      </div>
    </section>

    <section class="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
      <article class="panel rounded-xl border border-[#2e3444] p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-[16px] font-semibold text-[#eaf0fb]">
            Minimal Agent（OpenAI SDK）
          </h2>
          <span class="badge">MVP</span>
        </div>

        <p class="text-[13px] text-[#aeb8c8] mb-4 leading-6">
          用于快速验证模型调用链路。你可以先在这里接入最小可运行 Agent，再逐步加入工具、记忆与路由能力。
        </p>

        <ol class="space-y-2.5 text-[13px] text-[#cfd8e8]">
          <li
            v-for="(step, index) in minimalAgentSteps"
            :key="step"
            class="step-item"
          >
            <span class="step-index">{{ index + 1 }}</span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </article>

      <article class="panel rounded-xl border border-[#2e3444] p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-[16px] font-semibold text-[#eaf0fb]">
            Advanced Demos（LangChain / More）
          </h2>
          <span class="badge badge-alt">Planned</span>
        </div>

        <p class="text-[13px] text-[#aeb8c8] mb-4 leading-6">
          用于展示更完整的 Agent 能力。建议每个 Demo 独立一个模块，便于切换与对比效果。
        </p>

        <div class="demo-tags">
          <span
            v-for="demo in advancedDemos"
            :key="demo"
            class="demo-tag"
          >
            {{ demo }}
          </span>
        </div>
      </article>
    </section>

    <section class="panel rounded-xl border border-[#2e3444] p-5">
      <h2 class="text-[15px] font-semibold text-[#eaf0fb] mb-3">
        工作区布局建议
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
        <div class="mini-card">
          <p class="mini-title">左侧：控制台</p>
          <p class="mini-desc">模型、温度、系统提示词、工具开关等配置区。</p>
        </div>
        <div class="mini-card">
          <p class="mini-title">中间：对话区</p>
          <p class="mini-desc">输入输出、消息历史、函数调用结果可视化。</p>
        </div>
        <div class="mini-card">
          <p class="mini-title">右侧：调试区</p>
          <p class="mini-desc">请求参数、Token 使用、链路耗时与日志追踪。</p>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.agent-page {
  background:
    radial-gradient(1200px 500px at 85% -20%, rgba(72, 144, 255, 0.24), transparent 60%),
    radial-gradient(900px 460px at -10% 120%, rgba(61, 115, 199, 0.16), transparent 60%),
    linear-gradient(180deg, #121720 0%, #0f141d 100%);
}

.hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(25, 35, 53, 0.96) 0%, rgba(20, 26, 38, 0.96) 100%);
}

.hero-bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, transparent 0%, rgba(104, 178, 255, 0.16) 48%, transparent 100%),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 12px,
      rgba(255, 255, 255, 0.015) 12px,
      rgba(255, 255, 255, 0.015) 24px
    );
  animation: bgFloat 10s ease-in-out infinite;
}

.panel {
  background: rgba(18, 23, 33, 0.82);
  backdrop-filter: blur(3px);
}

.badge {
  border: 1px solid #426f9e;
  color: #9ac8ff;
  background: rgba(67, 120, 173, 0.18);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
}

.badge-alt {
  border-color: #4a6783;
  color: #b4c8dd;
  background: rgba(92, 119, 143, 0.2);
}

.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #2c3647;
  border-radius: 10px;
  background: rgba(26, 33, 45, 0.8);
  padding: 9px 10px;
}

.step-index {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #2f4d72;
  color: #d9e9ff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.demo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.demo-tag {
  border: 1px solid #344258;
  border-radius: 999px;
  color: #d2ddef;
  background: rgba(34, 41, 56, 0.78);
  font-size: 12px;
  padding: 5px 11px;
}

.mini-card {
  border: 1px solid #2c3647;
  border-radius: 12px;
  background: rgba(24, 31, 43, 0.74);
  padding: 12px;
}

.mini-title {
  color: #dfe9f8;
  font-weight: 600;
  margin-bottom: 6px;
}

.mini-desc {
  color: #aeb8c8;
  line-height: 1.5;
}

@keyframes bgFloat {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-1.5%);
  }
}

@media (max-width: 768px) {
  .agent-page {
    padding: 14px;
  }

  .hero {
    padding: 18px;
  }
}
</style>
