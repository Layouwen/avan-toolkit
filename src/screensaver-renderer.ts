import { createApp } from 'vue';
import i18n from './i18n';
import ScreensaverWindow from './views/ScreensaverWindow.vue';
import './index.css';

createApp(ScreensaverWindow).use(i18n).mount('#app');
