import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadManualUpdateManager(platform = process.platform, arch = process.arch) {
  const source = fs.readFileSync(path.join(root, 'src/main/manualUpdateManager.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const previousPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  const previousArch = Object.getOwnPropertyDescriptor(process, 'arch');

  Object.defineProperty(process, 'platform', { value: platform });
  Object.defineProperty(process, 'arch', { value: arch });

  try {
    const openedUrls = [];
    const localRequire = (id) => {
      if (id === 'electron') {
        return {
          app: {
            getVersion: () => '1.0.1',
          },
          shell: {
            openExternal: async url => openedUrls.push(url),
          },
        };
      }
      return require(id);
    };

    // eslint-disable-next-line no-new-func
    const factory = new Function('require', 'exports', 'module', 'process', compiled);
    factory(localRequire, module.exports, module, process);
    module.exports.openedUrls = openedUrls;
    return module.exports;
  }
  finally {
    if (previousPlatform) {
      Object.defineProperty(process, 'platform', previousPlatform);
    }
    if (previousArch) {
      Object.defineProperty(process, 'arch', previousArch);
    }
  }
}

test('manual update version comparison detects newer stable versions', () => {
  const manager = loadManualUpdateManager();

  assert.equal(manager.compareVersions('1.0.2', '1.0.1'), 1);
  assert.equal(manager.compareVersions('v1.0.2', '1.0.2'), 0);
  assert.equal(manager.compareVersions('1.0.1', 'v1.0.2'), -1);
});

test('manual update asset selection prefers current macOS architecture DMG', () => {
  const manager = loadManualUpdateManager('darwin', 'arm64');
  const asset = manager.selectDownloadAsset([
    { name: 'AvanToolkit-1.0.2-arm64.zip', browser_download_url: 'zip' },
    { name: 'AvanToolkit-1.0.2-x64.dmg', browser_download_url: 'x64' },
    { name: 'AvanToolkit-1.0.2-arm64.dmg', browser_download_url: 'arm64' },
  ]);

  assert.equal(asset.name, 'AvanToolkit-1.0.2-arm64.dmg');
});

test('manual update opens only GitHub release URLs case-insensitively', async () => {
  const manager = loadManualUpdateManager();
  const downloadUrl = 'https://github.com/Layouwen/avan-toolkit/releases/download/v1.0.3/AvanToolkit-1.0.3-arm64.dmg';
  const releaseUrl = 'https://github.com/layouwen/avan-toolkit/releases/tag/v1.0.3';

  await manager.openUpdateDownload(downloadUrl);
  await manager.openUpdateDownload(releaseUrl);

  assert.deepEqual(manager.openedUrls, [downloadUrl, releaseUrl]);
});

test('manual update rejects non-release update URLs', async () => {
  const manager = loadManualUpdateManager();
  const invalidUrls = [
    'https://evil.com/layouwen/avan-toolkit/releases/download/v1.0.3/file.dmg',
    'http://github.com/layouwen/avan-toolkit/releases/download/v1.0.3/file.dmg',
    'https://github.com/layouwen/avan-toolkit/issues/1',
    'not-a-url',
  ];

  for (const invalidUrl of invalidUrls) {
    await assert.rejects(() => manager.openUpdateDownload(invalidUrl), /Invalid update URL/);
  }
});

test('manual update is wired as a manual GitHub release check', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
  const appIpc = fs.readFileSync(path.join(root, 'src/main/ipc/appIpc.ts'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'src/preload.ts'), 'utf8');
  const electronApi = fs.readFileSync(path.join(root, 'src/electron-api.d.ts'), 'utf8');
  const sharedTypes = fs.readFileSync(path.join(root, 'src/shared/electronApiTypes.ts'), 'utf8');
  const forgeConfig = fs.readFileSync(path.join(root, 'forge.config.ts'), 'utf8');
  const updateManager = fs.readFileSync(path.join(root, 'src/main/manualUpdateManager.ts'), 'utf8');

  assert.doesNotMatch(main, /updateElectronApp\(\)/);
  assert.match(appIpc, /ipcMain\.handle\(['"]updates:getInfo['"]/);
  assert.match(appIpc, /ipcMain\.handle\(['"]updates:openDownload['"]/);
  assert.match(preload, /getUpdateInfo/);
  assert.match(preload, /openUpdateDownload/);
  assert.match(sharedTypes, /interface AppUpdateInfo/);
  assert.match(electronApi, /export type\s*\{[\s\S]*AppUpdateInfo[\s\S]*\}\s*from\s*['"]\.\/shared\/electronApiTypes['"]/);
  assert.match(electronApi, /getUpdateInfo:\s*\(\)\s*=>\s*Promise<AppUpdateInfo>/);
  assert.match(forgeConfig, /prerelease:\s*false/);
  assert.match(updateManager, /release => !release\.draft && !release\.prerelease/);
  assert.match(updateManager, /https:\/\/api\.github\.com\/repos\/layouwen\/avan-toolkit\/releases/);
});
