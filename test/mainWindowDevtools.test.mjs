import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('main window opens DevTools only when using the Vite dev server', () => {
  const source = fs.readFileSync(path.resolve('src/main.ts'), 'utf8');
  const devServerBlock = source.match(/if \(MAIN_WINDOW_VITE_DEV_SERVER_URL\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  const packagedBlock = source.match(/else \{([\s\S]*?)\n  \}/)?.[1] || '';

  assert.match(devServerBlock, /openDevTools\(\)/);
  assert.doesNotMatch(packagedBlock, /openDevTools\(\)/);
});
