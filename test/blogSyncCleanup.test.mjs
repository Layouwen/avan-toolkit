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
  const blogIpc = readProjectFile('src/main/ipc/blogIpc.ts');
  const blogManager = readProjectFile('src/main/blogManager.ts');
  const blogSync = readProjectFile('src/views/BlogSync.vue');
  const blogSyncValidationCard = readProjectFile('src/features/blog-sync/components/BlogSyncValidationCard.vue');
  const blogSyncValidation = readProjectFile('src/features/blog-sync/composables/useBlogSyncValidation.ts');
  const rendererValidationSource = `${blogSync}\n${blogSyncValidationCard}\n${blogSyncValidation}`;

  assert.match(blogIpc, /ipcMain\.handle\(['"]blogs:deleteHexoOrphan['"]/);
  assert.match(blogIpc, /field\s*===\s*['"]sync:missingObsidian['"]/);
  assert.match(blogIpc, /shell\.trashItem\(filePath\)/);
  assert.doesNotMatch(blogIpc, /deleteHexoOrphan[\s\S]*fs\.unlink/);

  assert.match(blogManager, /HEXO_SYNCED_BLOG_DIRS\s*=\s*\[['"]article['"],\s*['"]summary['"]\]/);
  assert.match(blogManager, /path\.resolve\(hexoRoot,\s*['"]source['"],\s*['"]_posts['"]\)/);
  assert.match(blogManager, /relativePath\.endsWith\(['"]\.md['"]\)/);
  assert.match(blogManager, /Path is outside the Hexo posts directory/);

  assert.match(rendererValidationSource, /canDeleteHexoOrphanIssue\(issue\)/);
  assert.match(rendererValidationSource, /issue\.source\s*===\s*['"]hexo['"]/);
  assert.match(rendererValidationSource, /issue\.field\s*===\s*['"]sync:missingObsidian['"]/);
  assert.match(rendererValidationSource, /ConfirmButton/);
  assert.match(rendererValidationSource, /@delete-hexo-orphan="deleteHexoOrphanBlog"/);
  assert.match(rendererValidationSource, /deleteHexoOrphanBlog\(issue\.relativePath\)/);
});
