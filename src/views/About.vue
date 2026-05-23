<script setup lang="ts">
const links = [
  {
    label: 'GitHub',
    url: 'https://github.com/Layouwen',
    display: 'github.com/Layouwen',
  },
  {
    label: '博客',
    url: 'https://layouwen.com',
    display: 'layouwen.com',
  },
  {
    label: 'Twitter / X',
    url: 'https://x.com/Layouwen',
    display: 'x.com/Layouwen',
  },
  {
    label: '掘金',
    url: 'https://juejin.cn/user/Layouwen',
    display: 'juejin.cn/user/Layouwen',
  },
  {
    label: '邮箱',
    url: 'mailto:me@layouwen.com',
    display: 'me@layouwen.com',
  },
];

function openLink(url: string) {
  window.electronAPI.openExternal(url);
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold text-[#e0e0e0] mb-6">
      关于
    </h1>
    <div class="flex flex-col gap-3 max-w-md">
      <button
        v-for="link in links"
        :key="link.label"
        class="flex items-center gap-3 bg-[#252526] border border-[#333] rounded-lg px-4 py-3 text-[#aaa] hover:text-[#e0e0e0] hover:border-[#555] transition-colors text-left cursor-pointer"
        @click="openLink(link.url)"
      >
        <span class="text-sm font-medium min-w-20">{{ link.label }}</span>
        <span class="text-xs text-[#666]">{{ link.display }}</span>
      </button>
    </div>
  </div>
</template>
