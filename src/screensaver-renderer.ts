import { darkTheme, NConfigProvider, NDialogProvider, NMessageProvider } from 'naive-ui';
import { createApp, h } from 'vue';
import i18n from './i18n';
import ScreensaverWindow from './views/ScreensaverWindow.vue';
import './index.css';

const ScreensaverApp = {
  render() {
    return h(NConfigProvider, { theme: darkTheme }, {
      default: () => h(NMessageProvider, null, {
        default: () => h(NDialogProvider, null, {
          default: () => h(ScreensaverWindow),
        }),
      }),
    });
  },
};

createApp(ScreensaverApp).use(i18n).mount('#app');
