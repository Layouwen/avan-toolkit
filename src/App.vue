<script setup lang="ts">
</script>

<template>
  <nav class="flex items-center gap-3 px-4 py-2 bg-[#1e1e1e] border-b border-[#333] text-sm">
    <router-link to="/" class="text-[#aaa] hover:text-[#e0e0e0] transition-colors">
      Home
    </router-link>
    <span class="text-[#444]">|</span>
    <router-link to="/sync" class="text-[#aaa] hover:text-[#e0e0e0] transition-colors">
      博客同步
    </router-link>
    <span class="text-[#444]">|</span>
    <router-link to="/about" class="text-[#aaa] hover:text-[#e0e0e0] transition-colors">
      关于
    </router-link>
  </nav>
  <div class="h-full">
    <router-view />
  </div>
</template>
