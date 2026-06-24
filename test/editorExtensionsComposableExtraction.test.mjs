import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test';

const rootDir = new URL('..', import.meta.url).pathname;
const routePath = join(rootDir, 'src/views/EditorExtensions.vue');
const routeSource = readFileSync(routePath, 'utf8');
const composablePath = join(rootDir, 'src/features/editor-extensions/composables/useEditorExtensions.ts');
const utilsPath = join(rootDir, 'src/features/editor-extensions/utils.ts');

test('Editor Extensions feature utility and composable files exist and route imports the composable', () => {
  assert.ok(
    existsSync(utilsPath),
    'src/features/editor-extensions/utils.ts should exist',
  );
  assert.ok(
    existsSync(composablePath),
    'src/features/editor-extensions/composables/useEditorExtensions.ts should exist',
  );
  assert.match(
    routeSource,
    /import\s+\{\s*useEditorExtensions\s*\}\s+from\s+['"]@\/features\/editor-extensions\/composables\/useEditorExtensions['"]/,
    'EditorExtensions.vue should import useEditorExtensions from the feature folder',
  );
});

test('Editor Extensions route no longer owns extracted Electron side effects', () => {
  assert.doesNotMatch(
    routeSource,
    /window\.electronAPI/,
    'EditorExtensions.vue should not call window.electronAPI directly',
  );

  const movedFunctions = [
    'loadRecords',
    'loadEditorExtensionConfig',
    'selectVsixDownloadDir',
    'withEditorExtensionConfig',
    'saveRecord',
    'deleteRecord',
    'exportMarkdown',
    'readClipboard',
    'copyExtensionId',
    'importFromMarkdown',
    'initializeFromInstalled',
    'downloadVsix',
    'installDownloadedVsix',
    'runCommand',
    'runBulk',
  ];

  for (const functionName of movedFunctions) {
    assert.doesNotMatch(
      routeSource,
      new RegExp(`(?:async\\s+)?function\\s+${functionName}\\b|const\\s+${functionName}\\s*=`),
      `EditorExtensions.vue should not define ${functionName}`,
    );
  }
});

test('Editor Extensions route keeps i18n mount wiring and template action hooks', () => {
  assert.match(routeSource, /const\s+\{\s*t\s*\}\s*=\s*useI18n\(\)/);
  const onMountedBody = routeSource.match(/onMounted\(\(\)\s*=>\s*\{([\s\S]*?)\n\}\);/)?.[1] || '';
  assert.match(
    onMountedBody,
    /void\s+loadRecords\(\);/,
    'EditorExtensions.vue should load records inside onMounted',
  );
  assert.match(
    onMountedBody,
    /void\s+loadEditorExtensionConfig\(\);/,
    'EditorExtensions.vue should load editor extension config inside onMounted',
  );
  assert.match(routeSource, /downloadVsix\('vscode',\s*record\.extensionId\)/);
  assert.match(routeSource, /downloadVsix\('cursor',\s*record\.extensionId\)/);
  assert.match(routeSource, /installDownloadedVsix\('vscode',\s*record\.extensionId\)/);
  assert.match(routeSource, /installDownloadedVsix\('cursor',\s*record\.extensionId\)/);
});
