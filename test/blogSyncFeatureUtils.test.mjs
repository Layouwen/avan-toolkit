import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const require = createRequire(import.meta.url);

function loadBlogSyncUtils() {
  const source = fs.readFileSync(path.join(root, 'src/features/blog-sync/utils.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };

  // eslint-disable-next-line no-new-func
  const factory = new Function('require', 'exports', 'module', compiled);
  factory(require, module.exports, module);
  return module.exports;
}

function blog(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    fileName: overrides.fileName ?? `${overrides.id}.md`,
    directory: overrides.directory ?? '',
    relativePath: overrides.relativePath ?? `${overrides.directory ? `${overrides.directory}/` : ''}${overrides.fileName ?? `${overrides.id}.md`}`,
    absolutePath: overrides.absolutePath ?? `/blogs/${overrides.id}.md`,
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    tags: overrides.tags ?? [],
    categories: overrides.categories ?? [],
  };
}

test('parseCategoryPath trims and removes empty segments', () => {
  const { parseCategoryPath } = loadBlogSyncUtils();

  assert.deepEqual(parseCategoryPath(' 博客 / Vue //  组合式 API / '), ['博客', 'Vue', '组合式 API']);
});

test('inferBlogDefaults maps known and custom directories', () => {
  const { inferBlogDefaults } = loadBlogSyncUtils();

  assert.deepEqual(inferBlogDefaults('article/vue'), {
    directory: 'article/vue',
    tags: ['博客', 'vue'],
    categories: '博客/vue',
  });
  assert.deepEqual(inferBlogDefaults('summary/weekly'), {
    directory: 'summary/weekly',
    tags: ['汇总', 'weekly'],
    categories: '汇总/weekly',
  });
  assert.deepEqual(inferBlogDefaults('custom/path'), {
    directory: 'custom/path',
    tags: ['path'],
    categories: 'custom/path',
  });
});

test('normalizeTreeDirectory normalizes separators and uniqueTags trims duplicates', () => {
  const { normalizeTreeDirectory, uniqueTags } = loadBlogSyncUtils();

  assert.equal(normalizeTreeDirectory(' /article\\vue/ '), 'article/vue');
  assert.deepEqual(uniqueTags([' vue ', 'vue', '', 'ts']), ['vue', 'ts']);
});

test('filterBlogsBySelectedTags requires every selected tag', () => {
  const { filterBlogsBySelectedTags } = loadBlogSyncUtils();
  const blogs = [
    blog({ id: 'one', tags: ['vue', 'electron'] }),
    blog({ id: 'two', tags: ['vue'] }),
    blog({ id: 'three', tags: ['electron', 'desktop'] }),
  ];

  assert.deepEqual(
    filterBlogsBySelectedTags(blogs, ['vue', 'electron']).map(item => item.id),
    ['one'],
  );
});

test('sortBlogs sorts by title ascending and updatedAt descending', () => {
  const { sortBlogs } = loadBlogSyncUtils();
  const blogs = [
    blog({ id: 'one', title: 'Zoo', updatedAt: '2026-01-02T00:00:00.000Z' }),
    blog({ id: 'two', title: 'Alpha', updatedAt: '2026-01-03T00:00:00.000Z' }),
    blog({ id: 'three', title: 'Middle', updatedAt: '2026-01-01T00:00:00.000Z' }),
  ];

  assert.deepEqual(sortBlogs(blogs, 'title', 'asc').map(item => item.id), ['two', 'three', 'one']);
  assert.deepEqual(sortBlogs(blogs, 'updatedAt', 'desc').map(item => item.id), ['two', 'one', 'three']);
});

test('buildBlogTree builds nested folders and collectBlogTreeFolderKeys collects them', () => {
  const { buildBlogTree, collectBlogTreeFolderKeys } = loadBlogSyncUtils();
  const blogs = [
    blog({
      id: 'vue',
      title: 'Vue Notes',
      directory: 'article/vue',
      relativePath: 'article/vue/vue-notes.md',
    }),
    blog({
      id: 'weekly',
      title: 'Weekly Notes',
      directory: 'summary/weekly',
      relativePath: 'summary/weekly/2026-01.md',
    }),
  ];

  const tree = buildBlogTree(blogs, 'title', 'asc');

  assert.deepEqual(tree.map(node => node.key), ['dir:article', 'dir:summary']);
  assert.equal(tree[0].children[0].key, 'dir:article/vue');
  assert.equal(tree[0].children[0].children[0].key, 'blog:article/vue/vue-notes.md');
  assert.equal(tree[1].children[0].key, 'dir:summary/weekly');
  assert.equal(tree[1].children[0].children[0].key, 'blog:summary/weekly/2026-01.md');
  assert.deepEqual(collectBlogTreeFolderKeys(tree), [
    'dir:article',
    'dir:article/vue',
    'dir:summary',
    'dir:summary/weekly',
  ]);
});

test('emptyValidationResult returns an ok zero-count result', () => {
  const { emptyValidationResult } = loadBlogSyncUtils();

  assert.deepEqual(emptyValidationResult(), {
    ok: true,
    issues: [],
    checkedFiles: 0,
    obsidianCheckedFiles: 0,
    hexoCheckedFiles: 0,
    errorCount: 0,
    warningCount: 0,
  });
});
