<script setup lang="ts">
import { NButton, NCard, NModal } from 'naive-ui';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, tm } = useI18n();

const config = ref<any>(null);
const currentTime = ref('');
const currentDate = ref('');
const countdown = ref(0);
const countdownFinished = ref(false);
const showConfirmDialog = ref(false);
const confirmMessage = ref('');

let timeInterval: number | null = null;
let countdownInterval: number | null = null;

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function getRandomConfirmMessage() {
  const messages = tm('screensaverWindow.confirmMessages') as string[];
  return messages[Math.floor(Math.random() * messages.length)];
}

function startCountdown() {
  if (!config.value)
    return;
  countdown.value = config.value.countdownSeconds;
  countdownFinished.value = false;

  countdownInterval = window.setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--;
    }
    else {
      countdownFinished.value = true;
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }
  }, 1000);
}

function tryClose() {
  if (countdownFinished.value) {
    closeScreensaver();
  }
  else {
    confirmMessage.value = getRandomConfirmMessage();
    showConfirmDialog.value = true;
  }
}

function confirmClose() {
  showConfirmDialog.value = false;
  closeScreensaver();
}

function cancelClose() {
  showConfirmDialog.value = false;
}

function closeScreensaver() {
  void window.electronAPI.closeScreensaver();
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    tryClose();
  }
}

function handleConfig(data: any) {
  config.value = data;
  startCountdown();
}

onMounted(() => {
  updateTime();
  timeInterval = window.setInterval(updateTime, 1000);

  window.electronAPI.onScreensaverConfig(handleConfig);
  void window.electronAPI.getScreensaverConfig().then((cfg) => {
    config.value = cfg;
    startCountdown();
  });

  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval);
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  window.electronAPI.offScreensaverConfig();
  window.removeEventListener('keydown', handleKeyDown);
});

const backgroundStyle = computed(() => {
  if (!config.value) {
    return { backgroundColor: '#1a3a2a' };
  }
  if (config.value.backgroundType === 'color') {
    return { backgroundColor: config.value.backgroundColor };
  }
  if (config.value.backgroundImagePath) {
    return {
      backgroundImage: `url('file://${config.value.backgroundImagePath}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  return { backgroundColor: '#1a3a2a' };
});
</script>

<template>
  <div class="screensaver-page">
    <div
      class="screensaver-container"
      :style="backgroundStyle"
    >
      <div class="content-wrapper">
        <div class="time-display">
          {{ currentTime }}
        </div>
        <div class="date-display">
          {{ currentDate }}
        </div>
        <div class="countdown-display" :class="{ finished: countdownFinished }">
          {{ countdownFinished ? t('screensaverWindow.close') : `${countdown}s` }}
        </div>
        <NButton
          v-if="countdownFinished"
          type="primary"
          size="large"
          @click="tryClose"
        >
          {{ t('screensaverWindow.close') }}
        </NButton>
        <NButton
          v-else
          text
          type="info"
          size="large"
          @click="tryClose"
        >
          {{ t('screensaverWindow.close') }}
        </NButton>
      </div>

      <NModal
        v-model:show="showConfirmDialog"
        preset="card"
        style="width: 400px"
        :title="t('screensaverWindow.confirmTitle')"
        size="huge"
      >
        <NCard>
          <p class="text-lg mb-6">
            {{ confirmMessage }}
          </p>
          <div class="flex justify-end gap-3">
            <NButton @click="cancelClose">
              {{ t('screensaverWindow.cancel') }}
            </NButton>
            <NButton type="primary" @click="confirmClose">
              {{ t('screensaverWindow.confirm') }}
            </NButton>
          </div>
        </NCard>
      </NModal>
    </div>
  </div>
</template>

<style>
.screensaver-page {
  margin: 0 !important;
  padding: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  overflow: hidden !important;
}

body,
html,
#app {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
}
</style>

<style scoped>
.screensaver-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
}

.content-wrapper {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
}

.time-display {
  font-size: 120px;
  font-weight: 300;
  letter-spacing: 4px;
}

.date-display {
  font-size: 24px;
  opacity: 0.8;
}

.countdown-display {
  font-size: 80px;
  font-weight: 200;
  margin-top: 40px;
  transition: all 0.3s;
}

.countdown-display.finished {
  font-size: 32px;
  opacity: 0.7;
}
</style>
