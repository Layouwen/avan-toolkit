<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import FlipCountdown from '../components/FlipCountdown.vue';

const { t, tm } = useI18n();

const config = ref<any>(null);
const currentTime = ref('');
const currentDate = ref('');
const currentWeekday = ref('');
const countdown = ref(0);
const countdownFinished = ref(false);
const showConfirmDialog = ref(false);
const confirmMessage = ref('');

let timeInterval: number | null = null;
let countdownInterval: number | null = null;

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  currentWeekday.value = now.toLocaleDateString('zh-CN', { weekday: 'long' });
}

function getRandomConfirmMessage() {
  const messages = tm('screensaverWindow.confirmMessages') as string[];
  return messages[Math.floor(Math.random() * messages.length)];
}

function startCountdown() {
  if (!config.value)
    return;
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  countdown.value = config.value.countdownSeconds;
  countdownFinished.value = false;

  countdownInterval = window.setInterval(() => {
    countdown.value = Math.max(0, countdown.value - 1);
    if (countdown.value <= 0) {
      countdownFinished.value = true;
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      // closeScreensaver();
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
      @click="tryClose"
    >
      <div class="page-stage">
        <div class="content-wrapper countdown-page">
          <div class="time-meta">
            <span>{{ currentWeekday }}</span>
            <span>{{ currentDate }}</span>
          </div>

          <div class="clock-stage">
            <FlipCountdown :seconds="countdown" :finished="countdownFinished" fill />
          </div>

          <div class="time-meta current-time">
            {{ currentTime }}
          </div>

          <Button
            class="close-btn"
            :variant="countdownFinished ? 'default' : 'outline'"
            size="lg"
            @click.stop="tryClose"
          >
            {{ t('screensaverWindow.close') }}
          </Button>
        </div>
      </div>

      <AlertDialog v-model:open="showConfirmDialog">
        <AlertDialogContent class="max-w-[min(400px,90vw)]" @click.stop>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ t('screensaverWindow.confirmTitle') }}</AlertDialogTitle>
            <AlertDialogDescription class="modal-message">
              {{ confirmMessage }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="cancelClose">
              {{ t('screensaverWindow.cancel') }}
            </AlertDialogCancel>
            <AlertDialogAction @click="confirmClose">
              {{ t('screensaverWindow.confirm') }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

.page-stage {
  width: 100vw;
  height: 100vh;
  padding: clamp(24px, 5vh, 72px) clamp(24px, 5vw, 96px);
  display: grid;
  place-items: center;
}

.content-wrapper {
  width: 100%;
  height: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 3vh, 32px);
  align-items: center;
  justify-content: center;
}

.countdown-page {
  gap: clamp(18px, 3vh, 36px);
}

.clock-stage {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.time-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 18px;
  color: rgba(255, 255, 255, 0.68);
  font-size: clamp(15px, 1.8vw, 20px);
  font-weight: 300;
  letter-spacing: 0;
  line-height: 1.4;
}

.current-time {
  font-variant-numeric: tabular-nums;
  font-size: clamp(18px, 2.2vw, 26px);
  color: rgba(255, 255, 255, 0.76);
}

.close-btn {
  margin-top: 0;
  min-width: 128px;
}

@media (max-width: 640px) {
  .page-stage {
    padding: 20px 16px;
  }
}

.modal-message {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.6;
}
</style>
