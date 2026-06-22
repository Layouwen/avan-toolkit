import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';

const root = process.cwd();

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('editor extensions can download VSIX for both editors without auto-installing', () => {
  const configManager = readProjectFile('src/main/configManager.ts');
  const main = readProjectFile('src/main.ts');
  const preload = readProjectFile('src/preload.ts');
  const electronApi = readProjectFile('src/electron-api.d.ts');
  const editorExtensionManager = readProjectFile('src/main/editorExtensionManager.ts');
  const editorExtensionsView = readProjectFile('src/views/EditorExtensions.vue');
  const zhCn = readProjectFile('src/locales/zh-CN.ts');
  const en = readProjectFile('src/locales/en.ts');
  const managerDownloadFunction = editorExtensionManager.match(/export async function downloadEditorExtensionVsix[\s\S]*?export async function runEditorExtensionCommand/)?.[0] || '';
  const viewDownloadFunction = editorExtensionsView.match(/async function downloadVsix[\s\S]*?async function runCommand/)?.[0] || '';

  assert.match(configManager, /editorExtensions:\s*\{/);
  assert.match(configManager, /vsixDownloadDir:\s*''/);
  assert.match(preload, /editorExtensions:\s*\{\s*vsixDownloadDir:\s*string;\s*\}/);
  assert.match(electronApi, /editorExtensions:\s*EditorExtensionsConfig/);
  assert.match(electronApi, /interface EditorExtensionsConfig\s*\{\s*vsixDownloadDir:\s*string;/);

  assert.match(editorExtensionManager, /EditorExtensionVsixDownloadResult/);
  assert.match(editorExtensionManager, /downloadEditorExtensionVsix/);
  assert.match(editorExtensionManager, /marketplace\.visualstudio\.com\/_apis\/public\/gallery\/publishers/);
  assert.match(editorExtensionManager, /vsextensions/);
  assert.match(editorExtensionManager, /vspackage/);
  assert.match(managerDownloadFunction, /getConfig\(\)/);
  assert.match(managerDownloadFunction, /app\.getPath\(['"]downloads['"]\)/);
  assert.match(managerDownloadFunction, /fs\.mkdir\(downloadDir,\s*\{\s*recursive:\s*true\s*\}\)/);
  assert.match(managerDownloadFunction, /path\.join\(downloadDir,\s*`\$\{normalizedId\}\.vsix`\)/);
  assert.match(managerDownloadFunction, /fs\.writeFile\(filePath,\s*buffer\)/);
  assert.match(editorExtensionManager, /shell\.showItemInFolder\(filePath\)/);
  assert.doesNotMatch(editorExtensionManager, /dialog\.showSaveDialog/);
  assert.doesNotMatch(managerDownloadFunction, /--install-extension/);

  assert.match(main, /ipcMain\.handle\(['"]editorExtensions:downloadVsix['"]/);
  assert.match(preload, /downloadEditorExtensionVsix:\s*\(extensionId:\s*string\)/);
  assert.match(preload, /ipcRenderer\.invoke\(['"]editorExtensions:downloadVsix['"],\s*extensionId\)/);
  assert.match(electronApi, /interface EditorExtensionVsixDownloadResult/);
  assert.match(electronApi, /downloadEditorExtensionVsix:\s*\(extensionId:\s*string\)\s*=>\s*Promise<EditorExtensionVsixDownloadResult>/);

  assert.match(editorExtensionsView, /vsixDownloadDir/);
  assert.match(editorExtensionsView, /selectVsixDownloadDir/);
  assert.match(editorExtensionsView, /editorExtensions\.downloadSettingsTitle/);
  assert.match(editorExtensionsView, /vscode:downloadVsix:\$\{record\.extensionId\}/);
  assert.match(editorExtensionsView, /cursor:downloadVsix:\$\{record\.extensionId\}/);
  assert.match(editorExtensionsView, /downloadVsix\('vscode',\s*record\.extensionId\)/);
  assert.match(editorExtensionsView, /downloadVsix\('cursor',\s*record\.extensionId\)/);
  assert.match(editorExtensionsView, /editorExtensions\.downloadVsix/);
  assert.match(editorExtensionsView, /electronAPI\.downloadEditorExtensionVsix/);
  assert.doesNotMatch(viewDownloadFunction, /runEditorExtensionCommand/);

  assert.match(zhCn, /downloadSettingsTitle:/);
  assert.match(zhCn, /vsixDownloadDir:/);
  assert.match(zhCn, /selectVsixDownloadDir:/);
  assert.match(zhCn, /vsixDownloadDirSaved:/);
  assert.match(zhCn, /downloadVsix:/);
  assert.match(zhCn, /vsixDownloaded:/);
  assert.doesNotMatch(zhCn, /vsixDownloadCanceled:/);
  assert.match(en, /downloadSettingsTitle:/);
  assert.match(en, /vsixDownloadDir:/);
  assert.match(en, /selectVsixDownloadDir:/);
  assert.match(en, /vsixDownloadDirSaved:/);
  assert.match(en, /downloadVsix:/);
  assert.match(en, /vsixDownloaded:/);
  assert.doesNotMatch(en, /vsixDownloadCanceled:/);
});
