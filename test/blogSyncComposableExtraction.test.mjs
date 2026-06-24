import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test';

const rootDir = new URL('..', import.meta.url).pathname;
const routePath = join(rootDir, 'src/views/BlogSync.vue');
const routeSource = readFileSync(routePath, 'utf8');

const composables = [
  'useBlogSyncConfig',
  'useBlogSyncLogs',
  'useBlogSyncValidation',
  'useBlogLibrary',
  'useBlogSyncRunner',
];

const featureComponents = [
  'BlogSyncConfigCard',
  'BlogSyncRunCard',
  'BlogSyncLogCard',
  'BlogSyncValidationCard',
  'BlogLibraryCard',
];

test('Blog Sync feature composables exist and are imported by the route', () => {
  for (const composable of composables) {
    assert.ok(
      existsSync(join(rootDir, 'src/features/blog-sync/composables', `${composable}.ts`)),
      `${composable}.ts should exist in src/features/blog-sync/composables`,
    );
    assert.match(
      routeSource,
      new RegExp(`import\\s+\\{\\s*${composable}\\s*\\}\\s+from\\s+['"]@/features/blog-sync/composables/${composable}['"]`),
      `BlogSync.vue should import ${composable}`,
    );
  }
});

test('Blog Sync route no longer owns extracted Electron side effects', () => {
  assert.doesNotMatch(
    routeSource,
    /window\.electronAPI/,
    'BlogSync.vue should not call window.electronAPI directly',
  );

  const movedFunctions = [
    'plainConfig',
    'browseDir',
    'loadBlogs',
    'loadValidation',
    'addBlog',
    'removeBlog',
    'confirmRename',
    'startSync',
    'pullBlog',
    'openValidationIssue',
    'deleteHexoOrphanBlog',
  ];

  for (const functionName of movedFunctions) {
    assert.doesNotMatch(
      routeSource,
      new RegExp(`(?:async\\s+)?function\\s+${functionName}\\b|const\\s+${functionName}\\s*=`),
      `BlogSync.vue should not define ${functionName}`,
    );
  }
});

test('Blog Sync route still renders the tabs shell and all feature cards', () => {
  assert.match(
    routeSource,
    /from\s+['"]@\/components\/ui\/tabs['"]/,
    'BlogSync.vue should still import the tabs shell primitives',
  );

  for (const tabPrimitive of ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger']) {
    assert.match(
      routeSource,
      new RegExp(`\\b${tabPrimitive}\\b`),
      `BlogSync.vue should still use ${tabPrimitive}`,
    );
  }

  for (const componentName of featureComponents) {
    assert.match(
      routeSource,
      new RegExp(`<${componentName}\\b`),
      `BlogSync.vue should still render ${componentName}`,
    );
  }
});
