<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  seconds: number;
  finished?: boolean;
  compact?: boolean;
  fill?: boolean;
}>(), {
  finished: false,
  compact: false,
  fill: false,
});

const formattedCountdown = computed(() => {
  const totalSeconds = Math.max(0, props.seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(value => value.toString().padStart(2, '0'))
    .join(':');
});

const formattedCountdownParts = computed(() => formattedCountdown.value.split(''));

const countdownEl = ref<HTMLElement | null>(null);
const fillSize = ref(0);
let resizeObserver: ResizeObserver | null = null;

function updateFillSize() {
  if (!props.fill || !countdownEl.value) {
    fillSize.value = 0;
    return;
  }

  const { width, height } = countdownEl.value.getBoundingClientRect();
  if (width <= 0 || height <= 0) {
    fillSize.value = Math.max(64, Math.min(window.innerWidth * 0.86 / 7.35, window.innerHeight * 0.78 / 3.1));
    return;
  }

  fillSize.value = Math.max(64, Math.min(width * 0.86 / 7.35, height * 0.78 / 1.34));
}

const countdownStyle = computed(() => (
  props.fill && fillSize.value > 0
    ? { '--flip-fill-size': `${fillSize.value}px` }
    : undefined
));

onMounted(() => {
  resizeObserver = new ResizeObserver(updateFillSize);
  if (countdownEl.value) {
    resizeObserver.observe(countdownEl.value);
  }
  window.addEventListener('resize', updateFillSize);
  void nextTick(updateFillSize);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener('resize', updateFillSize);
});

watch(() => props.fill, () => {
  void nextTick(updateFillSize);
});
</script>

<template>
  <div ref="countdownEl" class="flip-countdown" :class="{ finished, compact, fill }" :style="countdownStyle">
    <div class="flip-countdown-track">
      <template v-for="(part, index) in formattedCountdownParts" :key="index">
        <span v-if="part === ':'" class="flip-separator">:</span>
        <span v-else class="flip-card">
          <Transition name="digit-flip" mode="out-in">
            <span :key="part" class="flip-digit">{{ part }}</span>
          </Transition>
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.flip-countdown {
  width: 100%;
  font-variant-numeric: tabular-nums;
}

.flip-countdown-track {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(6px, 1.2vw, 14px);
}

.flip-card {
  width: clamp(46px, 8vw, 106px);
  height: clamp(68px, 11vw, 146px);
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background:
    linear-gradient(
      rgba(255, 255, 255, 0.13),
      rgba(255, 255, 255, 0) 49%,
      rgba(0, 0, 0, 0.16) 51%,
      rgba(255, 255, 255, 0.08)
    ),
    rgba(10, 18, 24, 0.38);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
}

.flip-card::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: rgba(0, 0, 0, 0.32);
  z-index: 2;
}

.flip-digit {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.94);
  font-size: clamp(52px, 8.6vw, 118px);
  font-weight: 300;
  line-height: 1;
  transform-origin: 50% 50%;
  backface-visibility: hidden;
}

.flip-separator {
  margin-inline: clamp(-2px, 0.2vw, 4px);
  color: rgba(255, 255, 255, 0.74);
  font-size: clamp(48px, 8vw, 108px);
  font-weight: 200;
  line-height: 1;
}

.finished .flip-card {
  border-color: rgba(24, 160, 88, 0.62);
  background:
    linear-gradient(
      rgba(24, 160, 88, 0.34),
      rgba(24, 160, 88, 0.04) 49%,
      rgba(0, 0, 0, 0.18) 51%,
      rgba(24, 160, 88, 0.18)
    ),
    rgba(10, 18, 24, 0.48);
}

.compact {
  --flip-gap: 8px;
}

.compact .flip-countdown-track {
  gap: var(--flip-gap);
}

.compact .flip-card {
  width: clamp(38px, 6.4vw, 76px);
  height: clamp(54px, 8vw, 98px);
}

.compact .flip-digit {
  font-size: clamp(40px, 6vw, 74px);
}

.compact .flip-separator {
  font-size: clamp(38px, 5.8vw, 70px);
}

.digit-flip-enter-active,
.digit-flip-leave-active {
  transition:
    opacity 0.34s ease,
    transform 0.34s ease;
}

.digit-flip-enter-from {
  opacity: 0;
  transform: rotateX(-88deg) translateY(18px);
}

.digit-flip-leave-to {
  opacity: 0;
  transform: rotateX(88deg) translateY(-18px);
}

@media (max-width: 640px) {
  .flip-countdown-track {
    gap: 4px;
  }
}

.fill {
  --flip-size: var(--flip-fill-size, 64px);
  --flip-gap: calc(var(--flip-size) * 0.16);
  display: grid;
  place-items: center;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.fill .flip-countdown-track {
  gap: var(--flip-gap);
}

.fill .flip-card {
  width: var(--flip-size);
  height: calc(var(--flip-size) * 1.34);
  border-radius: max(6px, calc(var(--flip-size) * 0.1));
  box-shadow: 0 calc(var(--flip-size) * 0.3) calc(var(--flip-size) * 0.8) rgba(0, 0, 0, 0.2);
}

.fill .flip-digit {
  font-size: calc(var(--flip-size) * 1.02);
}

.fill .flip-separator {
  margin-inline: calc(var(--flip-size) * -0.03);
  font-size: calc(var(--flip-size) * 0.94);
}
</style>
