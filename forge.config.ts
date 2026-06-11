import type { ForgeConfig } from '@electron-forge/shared-types';
import fs from 'node:fs';
import path from 'node:path';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const PLAYWRIGHT_BROWSERS_DIR = '.playwright-browsers';

function isAllowedPackagePath(filePath: string): boolean {
  if (!filePath) {
    return true;
  }

  const normalized = filePath.replaceAll(path.sep, '/');
  if (normalized === '/node_modules') {
    return true;
  }

  const allowedPaths = [
    '/.vite',
    '/package.json',
    '/node_modules/playwright',
    '/node_modules/playwright-core',
  ];

  return allowedPaths.some(allowedPath =>
    normalized === allowedPath || normalized.startsWith(`${allowedPath}/`),
  );
}

function hasPackagedChromium(): boolean {
  const browsersDir = path.resolve(PLAYWRIGHT_BROWSERS_DIR);
  if (!fs.existsSync(browsersDir)) {
    return false;
  }

  return fs.readdirSync(browsersDir).some(entry => entry.startsWith('chromium-'));
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/*.node',
    },
    extraResource: ['./screensaver.html', './.playwright-browsers'],
    ignore: filePath => !isAllowedPackagePath(filePath),
    prune: false,
  },
  hooks: {
    prePackage: async () => {
      if (!hasPackagedChromium()) {
        throw new Error(`Playwright Chromium is missing. Run "npm run install:playwright" before packaging.`);
      }
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
        {
          name: 'screensaver_window',
          config: 'vite.renderer.config.mts',
          entry: 'screensaver-vue.html',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
