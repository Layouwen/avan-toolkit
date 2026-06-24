import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test';

const root = process.cwd();

const expectedModules = [
  'agentIpc.ts',
  'appIpc.ts',
  'blogIpc.ts',
  'editorExtensionsIpc.ts',
  'index.ts',
  'logIpc.ts',
  'qzoneIpc.ts',
  'types.ts',
];

const expectedRegistrars = [
  'registerAgentIpcHandlers',
  'registerAppIpcHandlers',
  'registerBlogIpcHandlers',
  'registerEditorExtensionsIpcHandlers',
  'registerLogIpcHandlers',
  'registerQzoneIpcHandlers',
];

const expectedChannels = [
  'shell:openExternal',
  'updates:getInfo',
  'updates:openDownload',
  'config:get',
  'config:set',
  'blogs:list',
  'blogs:validate',
  'blogs:openInEditor',
  'blogs:openValidationIssue',
  'blogs:openConfiguredDir',
  'blogs:openObsidianPage',
  'blogs:openHexoProjectInEditor',
  'blogs:create',
  'blogs:delete',
  'blogs:deleteHexoOrphan',
  'blogs:renameTitle',
  'blogs:renameFileName',
  'dialog:selectDir',
  'dialog:selectImage',
  'sync:start',
  'sync:pullBlog',
  'logs:list',
  'logs:clear',
  'logs:openFile',
  'logs:subscribe',
  'logs:unsubscribe',
  'editorExtensions:list',
  'editorExtensions:listWithStatus',
  'editorExtensions:save',
  'editorExtensions:delete',
  'editorExtensions:exportMarkdown',
  'editorExtensions:importMarkdown',
  'editorExtensions:initialize',
  'editorExtensions:readClipboard',
  'editorExtensions:copyExtensionId',
  'editorExtensions:runCommand',
  'editorExtensions:runBulkCommand',
  'editorExtensions:downloadVsix',
  'editorExtensions:installDownloadedVsix',
  'agent:recommendActivity',
  'qzone:testLogin',
  'qzone:publishShuoshuo',
  'qzone:listShuoshuo',
  'qzone:loadMoreShuoshuo',
];

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function listIpcModules() {
  const ipcDir = path.join(root, 'src/main/ipc');
  return fs.readdirSync(ipcDir)
    .filter(fileName => fileName.endsWith('.ts'))
    .sort();
}

function extractHandledChannels(source) {
  return [...source.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
}

test('main process IPC registration is extracted into focused modules', () => {
  const mainSource = readProjectFile('src/main.ts');
  const indexSource = readProjectFile('src/main/ipc/index.ts');
  const moduleNames = listIpcModules();

  for (const moduleName of expectedModules) {
    assert.ok(
      moduleNames.includes(moduleName),
      `Expected src/main/ipc/${moduleName} to exist`,
    );
  }

  assert.match(mainSource, /registerIpcHandlers/);
  assert.match(mainSource, /registerIpcHandlers\(\{\s*getMainWindow:\s*\(\)\s*=>\s*mainWindow\s*\}\)/);
  assert.doesNotMatch(mainSource, /ipcMain\.handle\(/);

  for (const registrar of expectedRegistrars) {
    assert.match(
      indexSource,
      new RegExp(`import\\s+\\{\\s*${registrar}\\s*\\}`),
      `Expected src/main/ipc/index.ts to import ${registrar}`,
    );
    assert.match(
      indexSource,
      new RegExp(`${registrar}\\(`),
      `Expected src/main/ipc/index.ts to call ${registrar}`,
    );
  }

  const ipcSources = moduleNames
    .map(moduleName => readProjectFile(`src/main/ipc/${moduleName}`))
    .join('\n');
  const actualChannelList = extractHandledChannels(ipcSources);
  const actualChannels = new Set(actualChannelList);

  assert.equal(
    actualChannelList.length,
    actualChannels.size,
    'IPC handlers should not register duplicate channel names',
  );
  assert.deepEqual([...actualChannels].sort(), [...expectedChannels].sort());
});
