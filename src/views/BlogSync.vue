<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import type { AppConfig } from '../electron-api.d';

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
  if (syncing.value) return;
  syncing.value = true;
  status.value = 'syncing';
  logs.value = [];

  await window.electronAPI.setConfig({ ...config.value });

  window.electronAPI.onSyncDone((success, error) => {
    syncing.value = false;
    status.value = success ? 'success' : 'error';
    if (error) {
      logs.value.push({ id: logIdCounter++, text: `失败: ${error}`, level: 'error' });
    } else {
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
  <div class="sync-page">
    <!-- Config Section -->
    <section class="config-section">
      <h2 class="section-title">⚙️ 配置</h2>
      <div class="field">
        <label>Obsidian Blog 目录</label>
        <div class="input-row">
          <input
            v-model="config.obsidianBlogDir"
            placeholder="例如：D:\Obsidian\blog"
            @blur="saveConfig"
          />
          <button class="btn-browse" @click="browseDir('obsidianBlogDir')">浏览</button>
        </div>
      </div>
      <div class="field">
        <label>Hexo 项目目录</label>
        <div class="input-row">
          <input
            v-model="config.hexoBlogDir"
            placeholder="例如：D:\code\blog"
            @blur="saveConfig"
          />
          <button class="btn-browse" @click="browseDir('hexoBlogDir')">浏览</button>
        </div>
      </div>
    </section>

    <!-- Action Section -->
    <section class="action-section">
      <button
        class="btn-sync"
        :class="{ loading: syncing }"
        :disabled="syncing || !config.obsidianBlogDir || !config.hexoBlogDir"
        @click="startSync"
      >
        <span v-if="syncing" class="spinner"></span>
        <span>{{ syncing ? '同步中...' : '一键同步并发布' }}</span>
      </button>

      <div class="status-badge" :class="status">
        <span class="dot"></span>
        <span>{{ { idle: 'Idle', syncing: 'Syncing', success: 'Success', error: 'Error' }[status] }}</span>
      </div>
    </section>

    <!-- Log Section -->
    <section class="log-section">
      <div class="log-header">
        <h2 class="section-title">📋 日志</h2>
        <button class="btn-clear" @click="clearLogs">清空</button>
      </div>
      <div ref="logContainer" class="log-container">
        <div
          v-for="line in logs"
          :key="line.id"
          class="log-line"
          :class="line.level"
        >{{ line.text }}</div>
        <div v-if="logs.length === 0" class="log-empty">暂无日志，点击「一键同步并发布」开始</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sync-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  height: 100%;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Config */
.config-section {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px 20px;
}

.field {
  margin-bottom: 12px;
}
.field:last-child {
  margin-bottom: 0;
}

.field label {
  display: block;
  font-size: 13px;
  color: #aaa;
  margin-bottom: 6px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 7px 10px;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.input-row input:focus {
  border-color: #5a9fd4;
}

.btn-browse {
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 6px;
  color: #cbd5e0;
  font-size: 13px;
  padding: 7px 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.btn-browse:hover {
  background: #3d4a5c;
}

/* Action */
.action-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-sync {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2d6a4f;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 24px;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.btn-sync:hover:not(:disabled) {
  background: #3a8a65;
}
.btn-sync:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #aaa;
}
.status-badge .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #555;
}
.status-badge.idle .dot   { background: #555; }
.status-badge.syncing .dot { background: #f6c90e; animation: pulse 1s infinite; }
.status-badge.success .dot { background: #40c074; }
.status-badge.error .dot   { background: #e05252; }
.status-badge.syncing { color: #f6c90e; }
.status-badge.success { color: #40c074; }
.status-badge.error   { color: #e05252; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Log */
.log-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px 20px;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.btn-clear {
  background: transparent;
  border: 1px solid #444;
  border-radius: 5px;
  color: #777;
  font-size: 12px;
  padding: 3px 10px;
  cursor: pointer;
}
.btn-clear:hover {
  color: #aaa;
  border-color: #666;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: #141414;
  border-radius: 6px;
  padding: 12px;
  font-family: 'Cascadia Code', 'Fira Mono', Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.6;
}

.log-line {
  color: #c9d1d9;
  white-space: pre-wrap;
  word-break: break-all;
}
.log-line.success { color: #40c074; }
.log-line.error   { color: #e05252; }

.log-empty {
  color: #555;
  font-style: italic;
  text-align: center;
  margin-top: 20px;
}
</style>
