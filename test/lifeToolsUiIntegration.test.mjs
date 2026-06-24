import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test';

const rootDir = new URL('..', import.meta.url).pathname;
const routePath = join(rootDir, 'src/views/LifeTools.vue');
const componentsDir = join(rootDir, 'src/features/life-tools/components');
const composablePath = join(rootDir, 'src/features/life-tools/composables/useLifeTools.ts');

function readProjectFile(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

const componentNames = [
  'CountdownEventForm',
  'CountdownEventList',
  'FocusTimerPanel',
];

test('Life Tools route, nav, and home entry are wired', () => {
  const routerSource = readProjectFile('src/router/index.ts');
  const appSource = readProjectFile('src/App.vue');
  const homeSource = readProjectFile('src/views/HomeView.vue');

  assert.match(
    routerSource,
    /path:\s*['"]\/life-tools['"][\s\S]*?import\(['"]\.\.\/views\/LifeTools\.vue['"]\)/,
    'router should lazy-load LifeTools.vue at /life-tools',
  );
  assert.match(appSource, /t\(['"]nav\.lifeTools['"]\)[\s\S]*?key:\s*['"]\/life-tools['"]/);
  assert.match(homeSource, /t\(['"]home\.tools\.lifeTools\.title['"]\)[\s\S]*?path:\s*['"]\/life-tools['"]/);
});

test('Life Tools i18n keys exist in zh-CN and en locales', () => {
  for (const localePath of ['src/locales/zh-CN.ts', 'src/locales/en.ts']) {
    const source = readProjectFile(localePath);

    assert.match(source, /lifeTools:\s*['"][^'"]+['"]/, `${localePath} should include nav.lifeTools`);
    assert.match(source, /lifeTools:\s*\{[\s\S]*?title:\s*['"][^'"]+['"][\s\S]*?description:\s*['"][^'"]+['"]/);
    assert.match(source, /lifeToolsPage:\s*\{[\s\S]*?countdown:\s*\{[\s\S]*?focus:\s*\{/);
    assert.match(source, /oneTime:\s*['"][^'"]+['"]/);
    assert.match(source, /yearly:\s*['"][^'"]+['"]/);
    assert.match(source, /reminderDaysBefore:\s*['"][^'"]+['"]/);
    assert.match(source, /startFocus:\s*['"][^'"]+['"]/);
    assert.match(source, /completeSession:\s*['"][^'"]+['"]/);
    assert.match(source, /cancelSession:\s*['"][^'"]+['"]/);
  }
});

test('Life Tools feature files exist and route stays a thin composition surface', () => {
  assert.ok(existsSync(routePath), 'src/views/LifeTools.vue should exist');
  assert.ok(existsSync(composablePath), 'useLifeTools.ts should exist under the Life Tools feature');

  const routeSource = readFileSync(routePath, 'utf8');
  assert.match(
    routeSource,
    /import\s+\{\s*useLifeTools\s*\}\s+from\s+['"]@\/features\/life-tools\/composables\/useLifeTools['"]/,
    'LifeTools.vue should import the feature composable',
  );

  for (const componentName of componentNames) {
    assert.ok(
      existsSync(join(componentsDir, `${componentName}.vue`)),
      `${componentName}.vue should exist under src/features/life-tools/components`,
    );
    assert.match(
      routeSource,
      new RegExp(`import\\s+${componentName}\\s+from\\s+['"]@/features/life-tools/components/${componentName}\\.vue['"]`),
      `LifeTools.vue should import ${componentName}`,
    );
    assert.match(routeSource, new RegExp(`<${componentName}\\b`), `LifeTools.vue should render ${componentName}`);
  }

  const templateSource = routeSource.match(/<template>([\s\S]*?)<\/template>/)?.[1] || '';
  assert.doesNotMatch(templateSource, /<Card\b/, 'route view should not own feature cards');
  assert.doesNotMatch(templateSource, /<Input\b|<Textarea\b|<NativeSelect\b/, 'route view should not own form controls');
  assert.match(templateSource, /grid-cols-1[\s\S]*lg:grid-cols-\[/, 'route should provide responsive workbench columns');
});

test('Life Tools child components use typed props and emits contracts', () => {
  const formSource = readProjectFile('src/features/life-tools/components/CountdownEventForm.vue');
  const listSource = readProjectFile('src/features/life-tools/components/CountdownEventList.vue');
  const timerSource = readProjectFile('src/features/life-tools/components/FocusTimerPanel.vue');

  assert.match(formSource, /defineProps<[\s\S]*event\?:\s*CountdownEvent[\s\S]*>/);
  assert.match(formSource, /defineEmits<[\s\S]*submit[\s\S]*cancel[\s\S]*>/);
  assert.match(listSource, /defineProps<[\s\S]*events:\s*CountdownEventViewModel\[\][\s\S]*>/);
  assert.match(listSource, /defineEmits<[\s\S]*edit[\s\S]*delete[\s\S]*>/);
  assert.match(timerSource, /defineProps<[\s\S]*presets:\s*FocusPreset\[\][\s\S]*activeSession:\s*FocusSession\s*\|\s*null[\s\S]*>/);
  assert.match(timerSource, /defineEmits<[\s\S]*selectPreset[\s\S]*start[\s\S]*complete[\s\S]*cancel[\s\S]*>/);
});

test('Life Tools countdown form and list guard accessibility and destructive actions', () => {
  const formSource = readProjectFile('src/features/life-tools/components/CountdownEventForm.vue');
  const listSource = readProjectFile('src/features/life-tools/components/CountdownEventList.vue');

  assert.match(formSource, /Switch[\s\S]*aria-label/, 'pinned switch should have an accessible name');
  assert.doesNotMatch(formSource, /toISOString\(\)\.slice\(0,\s*10\)/, 'default date should use local date parts');
  assert.match(formSource, /formatLocalDateInputValue/, 'default date should use a local date helper');

  assert.match(listSource, /import\s+ConfirmButton\s+from\s+['"]@\/components\/ConfirmButton\.vue['"]/);
  assert.match(listSource, /<ConfirmButton[\s\S]*@confirm="emit\('delete', row\.event\.id\)"/);
});

test('Life Tools English placeholders use a real ellipsis character', () => {
  const enSource = readProjectFile('src/locales/en.ts');

  assert.doesNotMatch(enSource, /travel\.\.\./);
});
