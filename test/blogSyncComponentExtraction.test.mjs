import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test';

const rootDir = new URL('..', import.meta.url).pathname;
const routePath = join(rootDir, 'src/views/BlogSync.vue');
const routeSource = readFileSync(routePath, 'utf8');

const featureComponents = [
  'BlogSyncConfigCard.vue',
  'BlogSyncRunCard.vue',
  'BlogSyncLogCard.vue',
  'BlogSyncValidationCard.vue',
  'BlogLibraryCard.vue',
];

test('Blog Sync route is composed from extracted feature cards', () => {
  for (const component of featureComponents) {
    assert.ok(
      existsSync(join(rootDir, 'src/features/blog-sync/components', component)),
      `${component} should exist in src/features/blog-sync/components`,
    );
  }

  for (const component of featureComponents) {
    const componentName = component.replace(/\.vue$/, '');
    assert.match(
      routeSource,
      new RegExp(`import\\s+${componentName}\\s+from\\s+['"]@/features/blog-sync/components/${component}['"]`),
      `BlogSync.vue should import ${componentName}`,
    );
    assert.match(
      routeSource,
      new RegExp(`<${componentName}\\b`),
      `BlogSync.vue should render ${componentName}`,
    );
  }
});

test('Blog Sync route keeps only tab-shell UI imports after extraction', () => {
  const forbiddenImports = [
    '@/components/BlogTree.vue',
    '@/components/ConfirmButton.vue',
    '@/components/ui/card',
    '@/components/ui/alert',
    '@/components/ui/input',
    '@/components/ui/select',
    '@/components/ui/toggle-group',
    '@/components/ui/empty',
    '@/components/ui/dialog',
  ];

  for (const importPath of forbiddenImports) {
    assert.doesNotMatch(
      routeSource,
      new RegExp(`from\\s+['"]${importPath.replaceAll('/', '\\/')}['"]`),
      `BlogSync.vue should not import ${importPath}`,
    );
  }

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
});
