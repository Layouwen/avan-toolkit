import { createApp, h } from 'vue';
import i18n from './i18n';
import ScreensaverWindow from './views/ScreensaverWindow.vue';
import './index.css';

document.documentElement.classList.add('dark');

createApp({ render: () => h(ScreensaverWindow) }).use(i18n).mount('#app');
