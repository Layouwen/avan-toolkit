import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';

const root = process.cwd();

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const sharedTypeNames = [
  'ScreensaverConfig',
  'EditorExtensionsConfig',
  'ScreensaverStatus',
  'AppConfig',
  'AgentConfig',
  'AgentResult',
  'LogModule',
  'LogLevel',
  'AppLogEntry',
  'LogFilters',
  'QzoneConfig',
  'QzoneAutomationResult',
  'QzoneListItem',
  'QzoneListResult',
  'ObsidianBlog',
  'BlogValidationSeverity',
  'BlogValidationSource',
  'BlogValidationIssue',
  'BlogValidationResult',
  'EditorKind',
  'EditorExtensionScope',
  'EditorExtensionInitializeSource',
  'EditorExtensionRecord',
  'EditorExtensionStatus',
  'EditorExtensionLocalVsixStatus',
  'EditorExtensionWithStatus',
  'EditorExtensionImportResult',
  'EditorExtensionCommandResult',
  'EditorExtensionInitializeResult',
  'EditorExtensionVsixDownloadResult',
  'CreateObsidianBlogPayload',
  'AppUpdateInfo',
];

test('Electron bridge DTOs live in shared module and remain publicly re-exported', () => {
  const sharedTypesPath = path.join(root, 'src/shared/electronApiTypes.ts');

  assert.equal(fs.existsSync(sharedTypesPath), true);

  const sharedTypes = readProjectFile('src/shared/electronApiTypes.ts');
  const preload = readProjectFile('src/preload.ts');
  const electronApi = readProjectFile('src/electron-api.d.ts');

  for (const typeName of sharedTypeNames) {
    assert.match(sharedTypes, new RegExp(`export\\s+(?:interface|type)\\s+${typeName}\\b`));
  }

  assert.match(preload, /import\s+type\s+\{[\s\S]*AppConfig[\s\S]*\}\s+from\s+['"]\.\/shared\/electronApiTypes['"]/);
  assert.match(preload, /setConfig:\s*\(config:\s*AppConfig\)/);
  assert.match(preload, /recommendActivity:\s*\(prompt:\s*string,\s*config:\s*AgentConfig\)/);
  assert.match(preload, /onScreensaverConfig:\s*\(cb:\s*\(config:\s*ScreensaverConfig\)/);

  for (const typeName of sharedTypeNames) {
    assert.doesNotMatch(preload, new RegExp(`(?:interface|type)\\s+${typeName}\\b`));
  }
  assert.doesNotMatch(preload, /interface\s+PreloadConfig\b/);
  assert.doesNotMatch(preload, /PreloadConfig\[['"](?:agent|screensaver)['"]\]/);

  assert.match(electronApi, /export\s+type\s+\{[\s\S]*AppConfig[\s\S]*\}\s+from\s+['"]\.\/shared\/electronApiTypes['"]/);
  assert.match(electronApi, /import\s+type\s+\{[\s\S]*AppConfig[\s\S]*\}\s+from\s+['"]\.\/shared\/electronApiTypes['"]/);
  assert.match(electronApi, /export\s+interface\s+ElectronAPI\b/);
  assert.match(electronApi, /interface\s+Window\s*\{\s*electronAPI:\s*ElectronAPI;\s*\}/);

  for (const typeName of sharedTypeNames) {
    assert.doesNotMatch(electronApi, new RegExp(`export\\s+(?:interface|type)\\s+${typeName}\\b`));
  }
});
