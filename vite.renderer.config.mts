import type { Plugin } from 'vite';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

function copyScreensaverHtmlToIndex(rendererName: string, entryHtml: string): Plugin {
  let outDir = '';

  return {
    name: 'copy-screensaver-html-to-index',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      if (rendererName !== 'screensaver_window') {
        return;
      }

      const source = resolve(outDir, entryHtml);
      const target = resolve(outDir, 'index.html');
      if (existsSync(source)) {
        copyFileSync(source, target);
      }
    },
  };
}

// https://vitejs.dev/config
export default defineConfig(({ forgeConfigSelf }) => {
  const rendererName = forgeConfigSelf?.name ?? 'main_window';
  const entryHtml = rendererName === 'screensaver_window'
    ? 'screensaver-vue.html'
    : 'index.html';

  return {
    plugins: [tailwindcss(), vue(), copyScreensaverHtmlToIndex(rendererName, entryHtml)],
    resolve: {
      alias: {
        '@': resolve(rootDir, 'src'),
      },
    },
    build: {
      rollupOptions: {
        input: resolve(rootDir, entryHtml),
      },
    },
  };
});
