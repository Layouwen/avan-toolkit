<script setup lang="ts">
import type { AppConfig } from '../electron-api.d';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';

interface LogLine {
  id: number;
  text: string;
  level: 'info' | 'success' | 'error';
}

const config = ref<AppConfig>({ obsidianBlogDir: '', hexoBlogDir: '' });
const logs = ref<LogLine[]>([]);
const syncing = ref(false);
const status = ref<'idle' | 'syncing' | 'success' | 'error'>('idle');
const logContainer = ref<HTMLElement | null>(null);
let logIdCounter = 0;

onMounted(async () => {
  config.value = await window.electronAPI.getConfig();
  window.electronAPI.onSyncLog((message, level) => {
    logs.value.push({ id: logIdCounter++, text: message, level: level as LogLine['level'] });
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  });
});

onUnmounted(() => {
  window.electronAPI.offSyncLog();
});

async function browseDir(field: keyof AppConfig) {
  const dir = await window.electronAPI.selectDirectory();
  if (dir) {
    config.value[field] = dir;
    await window.electronAPI.setConfig({ ...config.value });
  }
}

async function saveConfig() {
  await window.electronAPI.setConfig({ ...config.value });
}

async function startSync() {
  if (syncing.value)
    return;
  syncing.value = true;
  status.value = 'syncing';
  logs.value = [];

  await window.electronAPI.setConfig({ ...config.value });

  window.electronAPI.onSyncDone((success, error) => {
    syncing.value = false;
    status.value = success ? 'success' : 'error';
    if (error) {
      logs.value.push({ id: logIdCounter++, text: `失败: ${error}`, level: 'error' });
    }
    else {
      logs.value.push({ id: logIdCounter++, text: '── 同步完成 ✓', level: 'success' });
    }
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  });

  await window.electronAPI.startSync();
}

function clearLogs() {
  logs.value = [];
}
</script>

<template>
  <div class="flex flex-col gap-5 p-6 h-full">
    <!-- Config Section -->
    <section class="bg-[#1e1e1e] border border-[#333] rounded-lg px-5 py-4">
      <h2 class="mb-3 text-[13px] font-semibold text-[#ccc] uppercase tracking-wider">
        ⚙️ 配置
      </h2>
      <div class="mb-3">
        <label class="block text-[13px] text-[#aaa] mb-1.5">Obsidian Blog 目录</label>
        <div class="flex gap-2">
          <input
            v-model="config.obsidianBlogDir"
            class="flex-1 bg-[#2a2a2a] border border-[#444] rounded-md px-2.5 py-1.75 text-[#e0e0e0] text-[13px] outline-none transition-colors focus:border-[#5a9fd4]"
            placeholder="例如：D:\Obsidian\blog"
            @blur="saveConfig"
          >
          <button
            class="bg-[#2d3748] border border-[#4a5568] rounded-md text-[#cbd5e0] text-[13px] px-3.5 py-1.75 cursor-pointer whitespace-nowrap hover:bg-[#3d4a5c] transition-colors"
            @click="browseDir('obsidianBlogDir')"
          >
            浏览
          </button>
        </div>
      </div>
      <div>
        <label class="block text-[13px] text-[#aaa] mb-1.5">Hexo 项目目录</label>
        <div class="flex gap-2">
          <input
            v-model="config.hexoBlogDir"
            class="flex-1 bg-[#2a2a2a] border border-[#444] rounded-md px-2.5 py-1.75 text-[#e0e0e0] text-[13px] outline-none transition-colors focus:border-[#5a9fd4]"
            placeholder="例如：D:\code\blog"
            @blur="saveConfig"
          >
          <button
            class="bg-[#2d3748] border border-[#4a5568] rounded-md text-[#cbd5e0] text-[13px] px-3.5 py-1.75 cursor-pointer whitespace-nowrap hover:bg-[#3d4a5c] transition-colors"
            @click="browseDir('hexoBlogDir')"
          >
            浏览
          </button>
        </div>
      </div>
    </section>

    <!-- Action Section -->
    <section class="flex items-center gap-4">
      <button
        class="flex items-center gap-2 bg-[#2d6a4f] rounded-lg text-white text-sm font-semibold px-6 py-2.5 cursor-pointer transition-colors hover:bg-[#3a8a65] disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="syncing || !config.obsidianBlogDir || !config.hexoBlogDir"
        @click="startSync"
      >
        <span v-if="syncing" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
        <span>{{ syncing ? '同步中...' : '一键同步并发布' }}</span>
      </button>

      <div
        class="flex items-center gap-1.5 text-[13px]"
        :class="{
          'text-[#aaa]': status === 'idle',
          'text-[#f6c90e]': status === 'syncing',
          'text-[#40c074]': status === 'success',
          'text-[#e05252]': status === 'error',
        }"
      >
        <span
          class="w-2 h-2 rounded-full"
          :class="{
            'bg-[#555]': status === 'idle',
            'bg-[#f6c90e]': status === 'syncing',
            'animate-pulse': status === 'syncing',
            'bg-[#40c074]': status === 'success',
            'bg-[#e05252]': status === 'error',
          }"
        />
        <span>{{ { idle: 'Idle', syncing: 'Syncing', success: 'Success', error: 'Error' }[status] }}</span>
      </div>
    </section>

    <!-- Log Section -->
    <section class="flex flex-col flex-1 min-h-0 bg-[#1e1e1e] border border-[#333] rounded-lg px-5 py-4">
      <div class="flex items-center justify-between mb-2.5">
        <h2 class="text-[13px] font-semibold text-[#ccc] uppercase tracking-wider">
          📋 日志
        </h2>
        <button
          class="bg-transparent border border-[#444] rounded text-[#777] text-xs px-2.5 py-0.5 cursor-pointer hover:text-[#aaa] hover:border-[#666] transition-colors"
          @click="clearLogs"
        >
          清空
        </button>
      </div>
      <div ref="logContainer" class="flex-1 overflow-y-auto bg-[#141414] rounded-md p-3 font-mono text-[12.5px] leading-relaxed">
        <div
          v-for="line in logs"
          :key="line.id"
          class="whitespace-pre-wrap break-all"
          :class="{
            'text-[#c9d1d9]': line.level === 'info',
            'text-[#40c074]': line.level === 'success',
            'text-[#e05252]': line.level === 'error',
          }"
        >
          {{ line.text }}
        </div>
        <div v-if="logs.length === 0" class="text-[#555] italic text-center mt-5">
          暂无日志，点击「一键同步并发布」开始
        </div>
      </div>
    </section>
  </div>
</template>
