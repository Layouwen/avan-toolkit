import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const browsersDir = path.join(projectRoot, '.playwright-browsers');
const playwrightCli = path.join(projectRoot, 'node_modules', 'playwright', 'cli.js');

if (!fs.existsSync(playwrightCli)) {
  console.error('Playwright CLI was not found. Run "npm install" first.');
  process.exit(1);
}

fs.mkdirSync(browsersDir, { recursive: true });

const result = spawnSync(process.execPath, [playwrightCli, 'install', 'chromium'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: browsersDir,
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
