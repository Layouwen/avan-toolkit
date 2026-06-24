import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test';

const rootDir = new URL('..', import.meta.url).pathname;
const routePath = join(rootDir, 'src/views/EditorExtensions.vue');
const componentsDir = join(rootDir, 'src/features/editor-extensions/components');
const routeSource = readFileSync(routePath, 'utf8');

const componentNames = [
  'EditorExtensionsHeader',
  'EditorExtensionsInitializeCard',
  'EditorExtensionsDownloadSettingsCard',
  'EditorExtensionsImportCard',
  'EditorExtensionsBulkActionsCard',
  'EditorExtensionsListCard',
  'EditorExtensionsOutputCard',
  'EditorExtensionFormDialog',
];

test('Editor Extensions feature components exist', () => {
  for (const componentName of componentNames) {
    assert.ok(
      existsSync(join(componentsDir, `${componentName}.vue`)),
      `${componentName}.vue should exist under src/features/editor-extensions/components`,
    );
  }
});

test('Editor Extensions route imports and renders extracted feature components', () => {
  for (const componentName of componentNames) {
    assert.match(
      routeSource,
      new RegExp(`import\\s+${componentName}\\s+from\\s+['"]@/features/editor-extensions/components/${componentName}\\.vue['"]`),
      `EditorExtensions.vue should import ${componentName}`,
    );
    assert.match(
      routeSource,
      new RegExp(`<${componentName}\\b`),
      `EditorExtensions.vue should render ${componentName}`,
    );
  }
});

test('Editor Extensions route no longer imports low-level UI primitives or lucide icons', () => {
  const forbiddenImports = [
    '@/components/ConfirmButton.vue',
    '@/components/ui/badge',
    '@/components/ui/button',
    '@/components/ui/card',
    '@/components/ui/dialog',
    '@/components/ui/field',
    '@/components/ui/input',
    '@/components/ui/select',
    '@/components/ui/table',
    '@/components/ui/textarea',
    '@lucide/vue',
  ];

  for (const forbiddenImport of forbiddenImports) {
    assert.doesNotMatch(
      routeSource,
      new RegExp(`from\\s+['"]${forbiddenImport.replaceAll('/', '\\/')}['"]`),
      `EditorExtensions.vue should not import ${forbiddenImport}`,
    );
  }
});

test('Editor Extensions route stays a thin composition shell', () => {
  const templateSource = routeSource.match(/<template>([\s\S]*?)<\/template>/)?.[1] || '';

  assert.doesNotMatch(templateSource, /<Table\b/, 'table markup should live in EditorExtensionsListCard');
  assert.doesNotMatch(templateSource, /<Dialog\b/, 'dialog markup should live in EditorExtensionFormDialog');
  assert.doesNotMatch(templateSource, /<Card\b/, 'card markup should live in feature card components');
  assert.match(templateSource, /<main\b/, 'route should retain the page shell');
});
