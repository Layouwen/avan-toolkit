import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const rootDir = new URL('..', import.meta.url).pathname;

function transpileFeatureModule(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const replacements = [
    ['from "vue"', 'from "./mock-vue.mjs"'],
    ['from \'vue\'', 'from \'./mock-vue.mjs\''],
    ['from "vue-sonner"', 'from "./mock-vue-sonner.mjs"'],
    ['from \'vue-sonner\'', 'from \'./mock-vue-sonner.mjs\''],
    ['from "@/features/editor-extensions/utils"', 'from "./utils.mjs"'],
    ['from \'@/features/editor-extensions/utils\'', 'from \'./utils.mjs\''],
  ];

  return replacements.reduce(
    (currentOutput, [search, replacement]) => currentOutput.replaceAll(search, replacement),
    output,
  );
}

async function loadComposableHarness() {
  const harnessDir = join(tmpdir(), `editor-extensions-composable-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(harnessDir, { recursive: true });

  const utilsSource = await readFile(join(rootDir, 'src/features/editor-extensions/utils.ts'), 'utf8');
  const composableSource = await readFile(
    join(rootDir, 'src/features/editor-extensions/composables/useEditorExtensions.ts'),
    'utf8',
  );

  await writeFile(join(harnessDir, 'mock-vue.mjs'), `
export function ref(value) {
  return { value };
}
export const shallowRef = ref;
export function reactive(value) {
  return value;
}
export function computed(getter) {
  return {
    get value() {
      return getter();
    },
  };
}
`);

  await writeFile(join(harnessDir, 'mock-vue-sonner.mjs'), `
export const toastCalls = [];
export const toast = {
  success(message) {
    toastCalls.push(['success', message]);
  },
  warning(message) {
    toastCalls.push(['warning', message]);
  },
  error(message) {
    toastCalls.push(['error', message]);
  },
};
export function resetToastCalls() {
  toastCalls.length = 0;
}
`);

  await writeFile(join(harnessDir, 'utils.mjs'), transpileFeatureModule(utilsSource));
  await writeFile(join(harnessDir, 'useEditorExtensions.mjs'), transpileFeatureModule(composableSource));

  const composableModule = await import(pathToFileURL(join(harnessDir, 'useEditorExtensions.mjs')).href);
  const toastModule = await import(pathToFileURL(join(harnessDir, 'mock-vue-sonner.mjs')).href);

  return {
    ...composableModule,
    ...toastModule,
    cleanup: () => rm(harnessDir, { recursive: true, force: true }),
  };
}

function createRecord(overrides = {}) {
  return {
    id: 'record-1',
    extensionId: 'publisher.extension',
    name: 'Extension',
    vscodeName: '',
    cursorName: '',
    note: '',
    scope: 'common',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: {
      vscode: false,
      cursor: false,
    },
    localVsix: {
      exists: true,
      filePath: '/tmp/publisher.extension.vsix',
      bytes: 12,
    },
    ...overrides,
  };
}

function createElectronApiMock() {
  const calls = [];
  const records = [createRecord()];
  const api = {
    calls,
    async listEditorExtensionsWithStatus() {
      calls.push(['listEditorExtensionsWithStatus']);
      return records;
    },
    async listEditorExtensions() {
      calls.push(['listEditorExtensions']);
      return records.map(({ status, localVsix, ...record }) => record);
    },
    async getConfig() {
      calls.push(['getConfig']);
      return {
        editorExtensions: {
          vsixDownloadDir: '/downloads',
        },
      };
    },
    async setConfig(config) {
      calls.push(['setConfig', config]);
    },
    async selectDirectory() {
      calls.push(['selectDirectory']);
      return '/selected';
    },
    async saveEditorExtension(payload) {
      calls.push(['saveEditorExtension', payload]);
      return createRecord(payload);
    },
    async deleteEditorExtension(recordId) {
      calls.push(['deleteEditorExtension', recordId]);
    },
    async exportEditorExtensionsMarkdown(target) {
      calls.push(['exportEditorExtensionsMarkdown', target]);
      return '|插件 id|';
    },
    async readClipboardText() {
      calls.push(['readClipboardText']);
      return '|publisher.extension|';
    },
    async copyEditorExtensionId(extensionId) {
      calls.push(['copyEditorExtensionId', extensionId]);
    },
    async importEditorExtensionsMarkdown(markdown, scope) {
      calls.push(['importEditorExtensionsMarkdown', markdown, scope]);
      return {
        added: 1,
        updated: 0,
        skipped: 0,
        records: [],
      };
    },
    async initializeEditorExtensions(source) {
      calls.push(['initializeEditorExtensions', source]);
      return {
        added: 1,
        updated: 0,
        skipped: 0,
        failedEditors: [],
        records: [],
      };
    },
    async downloadEditorExtensionVsix(extensionId) {
      calls.push(['downloadEditorExtensionVsix', extensionId]);
      return {
        filePath: '/selected/publisher.extension.vsix',
        bytes: 100,
      };
    },
    async installDownloadedEditorExtensionVsix(editor, extensionId) {
      calls.push(['installDownloadedEditorExtensionVsix', editor, extensionId]);
      return {
        success: true,
        message: `${editor} installed ${extensionId}`,
      };
    },
    async runEditorExtensionCommand(editor, action, extensionId) {
      calls.push(['runEditorExtensionCommand', editor, action, extensionId]);
      return {
        success: true,
        message: `${editor} ${action} ${extensionId}`,
      };
    },
    async runEditorExtensionBulkCommand(editor, action, target) {
      calls.push(['runEditorExtensionBulkCommand', editor, action, target]);
      return [
        {
          success: true,
          message: `${editor} ${action} ${target}`,
        },
      ];
    },
  };

  return api;
}

function callNames(api) {
  return api.calls.map(call => call[0]);
}

function createT() {
  return (key, values = {}) => `${key}:${JSON.stringify(values)}`;
}

test('useEditorExtensions saves records, closes the form, reloads, and toasts success', async () => {
  const harness = await loadComposableHarness();
  try {
    const api = createElectronApiMock();
    globalThis.window = { electronAPI: api };
    harness.resetToastCalls();

    const state = harness.useEditorExtensions({ t: createT() });
    state.form.extensionId = 'publisher.extension';
    state.form.name = 'Extension';
    state.showFormModal.value = true;

    await state.saveRecord();

    assert.deepEqual(callNames(api), [
      'saveEditorExtension',
      'listEditorExtensionsWithStatus',
    ]);
    assert.equal(state.showFormModal.value, false);
    assert.equal(state.form.extensionId, '');
    assert.deepEqual(harness.toastCalls.at(-1), ['success', 'editorExtensions.saved:{}']);
  }
  finally {
    await harness.cleanup();
    delete globalThis.window;
  }
});

test('useEditorExtensions keeps VSIX download separate from install commands', async () => {
  const harness = await loadComposableHarness();
  try {
    const api = createElectronApiMock();
    globalThis.window = { electronAPI: api };
    harness.resetToastCalls();

    const state = harness.useEditorExtensions({ t: createT() });

    await state.downloadVsix('vscode', 'publisher.extension');

    assert.deepEqual(callNames(api), ['downloadEditorExtensionVsix']);
    assert.equal(state.actionKey.value, '');
    assert.equal(api.calls.some(call => call[0] === 'runEditorExtensionCommand'), false);
    assert.match(state.lastOutput.value, /editorExtensions\.vsixDownloaded/);
    assert.equal(harness.toastCalls.at(-1)?.[0], 'success');
  }
  finally {
    await harness.cleanup();
    delete globalThis.window;
  }
});

test('useEditorExtensions installs downloaded VSIX and reloads records on success', async () => {
  const harness = await loadComposableHarness();
  try {
    const api = createElectronApiMock();
    globalThis.window = { electronAPI: api };
    harness.resetToastCalls();

    const state = harness.useEditorExtensions({ t: createT() });

    await state.installDownloadedVsix('cursor', 'publisher.extension');

    assert.deepEqual(callNames(api), [
      'installDownloadedEditorExtensionVsix',
      'listEditorExtensionsWithStatus',
    ]);
    assert.equal(state.actionKey.value, '');
    assert.equal(state.lastOutput.value, 'cursor installed publisher.extension');
    assert.deepEqual(harness.toastCalls.at(-1), ['success', 'editorExtensions.installDone:{}']);
  }
  finally {
    await harness.cleanup();
    delete globalThis.window;
  }
});

test('useEditorExtensions refreshes records after import and successful editor commands', async () => {
  const harness = await loadComposableHarness();
  try {
    const api = createElectronApiMock();
    globalThis.window = { electronAPI: api };
    harness.resetToastCalls();

    const state = harness.useEditorExtensions({ t: createT() });
    state.importMarkdown.value = '|publisher.extension|';

    await state.importFromMarkdown();
    await state.runCommand('vscode', 'install', 'publisher.extension');
    await state.runBulk('cursor', 'install', 'common');

    assert.deepEqual(callNames(api), [
      'importEditorExtensionsMarkdown',
      'listEditorExtensionsWithStatus',
      'runEditorExtensionCommand',
      'listEditorExtensionsWithStatus',
      'runEditorExtensionBulkCommand',
      'listEditorExtensionsWithStatus',
    ]);
    assert.equal(state.actionKey.value, '');
    assert.equal(harness.toastCalls.some(call => call[1].startsWith('editorExtensions.imported:')), true);
    assert.equal(harness.toastCalls.some(call => call[1].startsWith('editorExtensions.installDone:')), true);
    assert.equal(harness.toastCalls.some(call => call[1].startsWith('editorExtensions.bulkDone:')), true);
  }
  finally {
    await harness.cleanup();
    delete globalThis.window;
  }
});
