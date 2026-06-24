import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';

const root = process.cwd();

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Capacitor mobile configuration and scripts are wired', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));
  const capacitorConfig = readProjectFile('capacitor.config.ts');
  const mobileViteConfig = readProjectFile('vite.mobile.config.mts');

  assert.equal(packageJson.scripts['mobile:build'], 'vite build --config vite.mobile.config.mts');
  assert.equal(packageJson.scripts['cap:sync'], 'npm run mobile:build && cap sync');
  assert.equal(packageJson.scripts['cap:open:ios'], 'npm run cap:sync && cap open ios');
  assert.equal(packageJson.scripts['cap:open:android'], 'npm run cap:sync && cap open android');
  assert.match(capacitorConfig, /appId:\s*['"]com\.avan\.toolkit['"]/);
  assert.match(capacitorConfig, /appName:\s*['"]AvanToolkit['"]/);
  assert.match(capacitorConfig, /webDir:\s*['"]dist\/mobile['"]/);
  assert.match(mobileViteConfig, /outDir:\s*['"]dist\/mobile['"]/);
});

test('mobile shell avoids Electron-only navigation and config loading', () => {
  const app = readProjectFile('src/App.vue');
  const home = readProjectFile('src/views/HomeView.vue');
  const router = readProjectFile('src/router/index.ts');

  assert.match(app, /isElectronRuntime/);
  assert.match(app, /if\s*\(!window\.electronAPI\)\s*\{\s*return;/);
  assert.match(app, /isElectronRuntime\.value[\s\S]*nav\.blogSync/);
  assert.match(home, /isElectronRuntime/);
  assert.match(home, /isElectronRuntime\.value[\s\S]*home\.tools\.blogSync\.title/);
  assert.match(router, /requiresElectron:\s*true/);
  assert.match(router, /path:\s*['"]\/about['"][\s\S]*?requiresElectron:\s*true/);
  assert.match(router, /beforeEach\(\(to\)/);
  assert.match(router, /route\.meta\.requiresElectron/);
  assert.match(router, /return ['"]\/life-tools['"]/);
});

test('native mobile projects carry app policy and version settings', () => {
  const packageJson = JSON.parse(readProjectFile('package.json'));
  const androidManifest = readProjectFile('android/app/src/main/AndroidManifest.xml');
  const androidBuild = readProjectFile('android/app/build.gradle');
  const androidInstrumentedTest = readProjectFile('android/app/src/androidTest/java/com/avan/toolkit/ExampleInstrumentedTest.java');
  const iosProject = readProjectFile('ios/App/App.xcodeproj/project.pbxproj');

  assert.match(androidManifest, /android:allowBackup="false"/);
  assert.match(androidManifest, /android\.permission\.SCHEDULE_EXACT_ALARM/);
  assert.match(androidBuild, new RegExp(`versionName "${packageJson.version.replaceAll('.', '\\.')}"`));
  assert.match(androidInstrumentedTest, /package com\.avan\.toolkit;/);
  assert.match(androidInstrumentedTest, /"com\.avan\.toolkit"/);
  assert.match(iosProject, new RegExp(`MARKETING_VERSION = ${packageJson.version.replaceAll('.', '\\.')};`));
});
