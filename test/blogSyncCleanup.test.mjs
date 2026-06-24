import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';

const root = process.cwd();

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Hexo orphan cleanup is explicit, validated, and moved to trash', () => {
  const main = readProjectFile('src/main.ts');
  const blogManager = readProjectFile('src/main/blogManager.ts');
  const blogSync = readProjectFile('src/views/BlogSync.vue');

  assert.match(main, /ipcMain\.handle\(['"]blogs:deleteHexoOrphan['"]/);
  assert.match(main, /field\s*===\s*['"]sync:missingObsidian['"]/);
  assert.match(main, /shell\.trashItem\(filePath\)/);
  assert.doesNotMatch(main, /deleteHexoOrphan[\s\S]*fs\.unlink/);

  assert.match(blogManager, /HEXO_SYNCED_BLOG_DIRS\s*=\s*\[['"]article['"],\s*['"]summary['"]\]/);
  assert.match(blogManager, /path\.resolve\(hexoRoot,\s*['"]source['"],\s*['"]_posts['"]\)/);
  assert.match(blogManager, /relativePath\.endsWith\(['"]\.md['"]\)/);
  assert.match(blogManager, /Path is outside the Hexo posts directory/);

  assert.match(blogSync, /canDeleteHexoOrphanIssue\(issue\)/);
  assert.match(blogSync, /issue\.source\s*===\s*['"]hexo['"]/);
  assert.match(blogSync, /issue\.field\s*===\s*['"]sync:missingObsidian['"]/);
  assert.match(blogSync, /ConfirmButton/);
  assert.match(blogSync, /deleteHexoOrphanBlog\(issue\)/);
});
