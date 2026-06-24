import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'dist', 'node_modules', 'out']);
const sourceExtensions = new Set(['.ts', '.mts', '.vue', '.json']);

function collectProjectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        collectProjectFiles(path.join(dir, entry.name), files);
      }
      continue;
    }

    const filePath = path.join(dir, entry.name);
    if (sourceExtensions.has(path.extname(filePath))) {
      files.push(filePath);
    }
  }

  return files;
}

test('renderer UI no longer depends on Naive UI or vicons', () => {
  const offenders = collectProjectFiles(root)
    .filter(filePath => path.relative(root, filePath) !== 'package-lock.json')
    .flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return ['naive-ui', '@vicons']
        .filter(token => source.includes(token))
        .map(token => `${path.relative(root, filePath)} contains ${token}`);
    });

  assert.deepEqual(offenders, []);
});
