import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';

const root = process.cwd();

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Forge packaging keeps Playwright modules and embedded browser resources', () => {
  const forgeConfig = readProjectFile('forge.config.ts');

  assert.match(forgeConfig, /asar:\s*\{\s*unpack:\s*['"]\*\*\/\*\.node['"]/);
  assert.match(forgeConfig, /extraResource:\s*\[[\s\S]*['"]\.\/screensaver\.html['"][\s\S]*['"]\.\/\.playwright-browsers['"]/);
  assert.match(forgeConfig, /['"]\/node_modules['"]/);
  assert.doesNotMatch(forgeConfig, /allowedPaths\s*=\s*\[[\s\S]*['"]\/node_modules['"][\s\S]*\]/);
  assert.match(forgeConfig, /node_modules\/playwright/);
  assert.match(forgeConfig, /node_modules\/playwright-core/);
  assert.match(forgeConfig, /prePackage/);
  assert.match(forgeConfig, /Playwright Chromium/);
});

test('Qzone automation lazy-loads Playwright from packaged browser resources', () => {
  const qzoneAutomation = readProjectFile('src/main/qzoneAutomation.ts');

  assert.doesNotMatch(qzoneAutomation, /import\s+\{\s*chromium\s*\}\s+from\s+['"]playwright['"]/);
  assert.match(qzoneAutomation, /await import\(['"]playwright['"]\)/);
  assert.match(qzoneAutomation, /PLAYWRIGHT_BROWSERS_PATH/);
  assert.match(qzoneAutomation, /process\.resourcesPath/);
  assert.match(qzoneAutomation, /app\.getAppPath\(\)/);
  assert.match(qzoneAutomation, /\.playwright-browsers/);
});

test('npm scripts install embedded Playwright browsers before package and make', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));

  assert.equal(packageJson.scripts['install:playwright'], 'node scripts/install-playwright-browsers.mjs');
  assert.equal(packageJson.scripts.package, 'npm run install:playwright && electron-forge package');
  assert.equal(packageJson.scripts.make, 'npm run install:playwright && electron-forge make');
});

test('screensaver renderer builds from its dedicated HTML entry', () => {
  const forgeConfig = readProjectFile('forge.config.ts');
  const rendererConfig = readProjectFile('vite.renderer.config.mts');

  assert.doesNotMatch(forgeConfig, /entry:\s*['"]screensaver-vue\.html['"]/);
  assert.match(rendererConfig, /forgeConfigSelf/);
  assert.match(rendererConfig, /rendererName\s*=\s*forgeConfigSelf\.name/);
  assert.match(rendererConfig, /rendererName\s*===\s*['"]screensaver_window['"]/);
  assert.match(rendererConfig, /screensaver-vue\.html/);
  assert.match(rendererConfig, /index\.html/);
  assert.match(rendererConfig, /rollupOptions:\s*\{[\s\S]*input:/);
  assert.match(rendererConfig, /copyScreensaverHtmlToIndex/);
  assert.match(rendererConfig, /copyFileSync\(source,\s*target\)/);
});
