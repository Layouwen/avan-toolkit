<script setup lang="ts">
</script>

<template>
  <main class="agent-demo-page h-full flex flex-col items-center justify-center p-6">
    <section class="w-full max-w-xl bg-[#181f2b] border border-[#2f3848] rounded-2xl shadow-lg p-8 flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-bold text-[#eaf0fb] mb-2">
          Agent 最小演示区
        </h1>
        <p class="text-[#aeb8c8] text-sm mb-4">
          你可以直接在下方粘贴和运行你的 Agent 代码，建议结构：输入框、输出区、发送按钮。后续如需多 Demo 或控制台，可再扩展。
        </p>
      </div>
      <div class="flex flex-col gap-3">
        <input class="bg-[#232b3a] border border-[#344258] rounded-md px-3 py-2 text-[#eaf0fb] text-sm outline-none focus:border-[#5a9fd4] transition-colors" placeholder="请输入你的问题...">
        <button class="bg-[#2d6a4f] hover:bg-[#3a8a65] text-white font-semibold rounded-md px-4 py-2 transition-colors">
          发送
        </button>
        <div class="bg-[#202736] border border-[#344258] rounded-md min-h-[60px] px-3 py-2 text-[#b8c5d8] text-sm mt-2">
          输出区
        </div>
      </div>
    </section>
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
