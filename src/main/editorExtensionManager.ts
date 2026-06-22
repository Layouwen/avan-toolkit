import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { app, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from './configManager';

const execFileAsync = promisify(execFile);

export type EditorKind = 'vscode' | 'cursor';
export type EditorExtensionScope = 'common' | 'vscode' | 'cursor';
export type EditorExtensionInitializeSource = EditorKind | 'both';

export interface EditorExtensionRecord {
  id: string;
  extensionId: string;
  name: string;
  vscodeName: string;
  cursorName: string;
  note: string;
  scope: EditorExtensionScope;
  createdAt: string;
  updatedAt: string;
}

export interface EditorExtensionStatus {
  vscode: boolean | null;
  cursor: boolean | null;
}

export interface EditorExtensionLocalVsixStatus {
  exists: boolean;
  filePath: string;
  bytes: number;
}

export interface EditorExtensionWithStatus extends EditorExtensionRecord {
  status: EditorExtensionStatus;
  localVsix: EditorExtensionLocalVsixStatus;
}

export interface EditorExtensionImportResult {
  added: number;
  updated: number;
  skipped: number;
  records: EditorExtensionRecord[];
}

export interface EditorExtensionCommandResult {
  success: boolean;
  message: string;
}

export interface EditorExtensionInitializeResult {
  added: number;
  updated: number;
  skipped: number;
  failedEditors: EditorKind[];
  records: EditorExtensionRecord[];
}

export interface EditorExtensionVsixDownloadResult {
  canceled: boolean;
  filePath: string;
  bytes: number;
}

const STORE_FILE = path.join(app.getPath('userData'), 'editor-extensions.json');
const VALID_EXTENSION_ID = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i;

function validateEditor(editor: EditorKind): void {
  if (editor !== 'vscode' && editor !== 'cursor') {
    throw new Error('Unknown editor.');
  }
}

function editorCommandName(editor: EditorKind): string {
  validateEditor(editor);
  return editor === 'vscode' ? 'code' : 'cursor';
}

function editorCommandCandidates(editor: EditorKind): string[] {
  const command = editorCommandName(editor);
  if (process.platform !== 'darwin') {
    return [command];
  }

  const appPath = editor === 'vscode'
    ? '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
    : '/Applications/Cursor.app/Contents/Resources/app/bin/cursor';

  return [
    command,
    `/opt/homebrew/bin/${command}`,
    `/usr/local/bin/${command}`,
    appPath,
  ];
}

async function resolveEditorCommand(editor: EditorKind): Promise<string> {
  const [command, ...absoluteCandidates] = editorCommandCandidates(editor);
  for (const candidate of absoluteCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    }
    catch {
      // Try the next common macOS install path.
    }
  }
  return command;
}

function validateAction(action: 'install' | 'uninstall'): void {
  if (action !== 'install' && action !== 'uninstall') {
    throw new Error('Unknown extension command action.');
  }
}

function validateTarget(target: EditorKind | 'common'): void {
  if (target !== 'vscode' && target !== 'cursor' && target !== 'common') {
    throw new Error('Unknown extension command target.');
  }
}

function validateInitializeSource(source: EditorExtensionInitializeSource): void {
  if (source !== 'vscode' && source !== 'cursor' && source !== 'both') {
    throw new Error('Unknown extension initialize source.');
  }
}

function normalizeExtensionId(value: string): string {
  return value.trim().toLowerCase();
}

function isPlaceholderName(value: string): boolean {
  return /^%[^%]+%$/.test(value.trim());
}

function shouldAutoReplaceName(record: EditorExtensionRecord): boolean {
  return !record.name.trim() || record.name === record.extensionId || isPlaceholderName(record.name);
}

function resolveLocalizedValue(value: string | undefined, messages: Record<string, string>): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  const placeholder = /^%([^%]+)%$/.exec(trimmed);
  if (!placeholder) {
    return trimmed;
  }
  return messages[placeholder[1]]?.trim();
}

function validateExtensionId(extensionId: string): void {
  if (!VALID_EXTENSION_ID.test(extensionId)) {
    throw new Error(`Invalid extension id: ${extensionId}`);
  }
}

function buildMarketplaceVsixUrl(extensionId: string): string {
  const [publisher, extensionName] = extensionId.split('.');
  return `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${encodeURIComponent(publisher)}/vsextensions/${encodeURIComponent(extensionName)}/latest/vspackage`;
}

function normalizeScope(value: unknown, fallback: EditorExtensionScope = 'common'): EditorExtensionScope {
  if (value === 'vscode' || value === 'cursor' || value === 'common') {
    return value;
  }
  return fallback;
}

function normalizeRecord(input: Partial<EditorExtensionRecord>): EditorExtensionRecord {
  const extensionId = normalizeExtensionId(input.extensionId || '');
  validateExtensionId(extensionId);
  const now = new Date().toISOString();

  return {
    id: input.id || uuidv4(),
    extensionId,
    name: (input.name || extensionId).trim(),
    vscodeName: (input.vscodeName || '').trim(),
    cursorName: (input.cursorName || '').trim(),
    note: (input.note || '').trim(),
    scope: normalizeScope(input.scope),
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
}

export async function listEditorExtensions(): Promise<EditorExtensionRecord[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<EditorExtensionRecord>[];
    return parsed.map(item => normalizeRecord(item)).sort((a, b) => a.extensionId.localeCompare(b.extensionId));
  }
  catch {
    return [];
  }
}

async function saveEditorExtensions(records: EditorExtensionRecord[]): Promise<void> {
  await ensureStoreDir();
  const normalized = records.map(item => normalizeRecord(item));
  await fs.writeFile(STORE_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
}

export async function upsertEditorExtension(input: Partial<EditorExtensionRecord>): Promise<EditorExtensionRecord> {
  const records = await listEditorExtensions();
  const next = normalizeRecord(input);
  const index = records.findIndex(item => item.extensionId === next.extensionId);

  if (index >= 0) {
    records[index] = {
      ...records[index],
      extensionId: next.extensionId,
      name: next.name,
      vscodeName: input.vscodeName === undefined ? records[index].vscodeName : next.vscodeName,
      cursorName: input.cursorName === undefined ? records[index].cursorName : next.cursorName,
      note: next.note,
      scope: next.scope,
      updatedAt: next.updatedAt,
    };
  }
  else {
    records.push(next);
  }

  await saveEditorExtensions(records);
  return index >= 0 ? records[index] : next;
}

export async function deleteEditorExtension(recordId: string): Promise<void> {
  const records = await listEditorExtensions();
  await saveEditorExtensions(records.filter(item => item.id !== recordId));
}

function shouldIncludeRecord(record: EditorExtensionRecord, target: EditorKind | 'common'): boolean {
  if (target === 'common') {
    return record.scope === 'common';
  }
  return record.scope === 'common' || record.scope === target;
}

function shouldExportRecord(record: EditorExtensionRecord, target: EditorKind | 'common'): boolean {
  return record.scope === target;
}

export function exportEditorExtensionsMarkdown(records: EditorExtensionRecord[], target: EditorKind | 'common'): string {
  validateTarget(target);
  const rows = records
    .filter(record => shouldExportRecord(record, target))
    .sort((a, b) => a.name.localeCompare(b.name) || a.extensionId.localeCompare(b.extensionId));
  const table = [
    '|序号|插件 id|插件名|插件备注|',
    '|----|----|----|----|',
    ...rows.map((record, index) => `|${index + 1}|${record.extensionId}|${record.name}|${record.note}|`),
  ];
  return table.join('\n');
}

function parseMarkdownTable(markdown: string, scope: EditorExtensionScope): EditorExtensionRecord[] {
  const rows = markdown
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('|') && line.endsWith('|'))
    .map(line => line.slice(1, -1).split('|').map(cell => cell.trim()));

  const dataRows = rows.filter((cells) => {
    if (cells.length < 3) {
      return false;
    }
    const joined = cells.join('');
    const normalizedFirstCell = cells[0].toLowerCase();
    return !/^[-:\s]+$/.test(joined)
      && normalizedFirstCell !== '序号'
      && normalizedFirstCell !== 'no.'
      && normalizedFirstCell !== 'no'
      && normalizedFirstCell !== '插件 id'
      && normalizedFirstCell !== 'extension id';
  });

  return dataRows.map((cells) => {
    const hasIndexColumn = cells.length >= 4
      && (/^\d+$/.test(cells[0] || '') || VALID_EXTENSION_ID.test(normalizeExtensionId(cells[1] || '')));
    const extensionIdIndex = hasIndexColumn ? 1 : 0;
    const extensionId = normalizeExtensionId(cells[extensionIdIndex] || '');
    validateExtensionId(extensionId);
    return normalizeRecord({
      extensionId,
      name: cells[extensionIdIndex + 1] || extensionId,
      note: cells[extensionIdIndex + 2] || '',
      scope,
    });
  });
}

export async function importEditorExtensionsMarkdown(markdown: string, scope: EditorExtensionScope): Promise<EditorExtensionImportResult> {
  const incoming = parseMarkdownTable(markdown, scope);
  const records = await listEditorExtensions();
  const byExtensionId = new Map(records.map(record => [record.extensionId, record]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of incoming) {
    const existing = byExtensionId.get(record.extensionId);
    if (!existing) {
      records.push(record);
      byExtensionId.set(record.extensionId, record);
      added += 1;
      continue;
    }

    const next = {
      ...existing,
      name: record.name || existing.name,
      vscodeName: record.vscodeName || existing.vscodeName,
      cursorName: record.cursorName || existing.cursorName,
      note: record.note || existing.note,
      scope: record.scope,
      updatedAt: new Date().toISOString(),
    };

    if (next.name === existing.name && next.note === existing.note && next.scope === existing.scope) {
      skipped += 1;
      continue;
    }

    Object.assign(existing, next);
    updated += 1;
  }

  await saveEditorExtensions(records);
  return {
    added,
    updated,
    skipped,
    records,
  };
}

async function listInstalledExtensionIds(editor: EditorKind): Promise<Set<string> | null> {
  try {
    const { stdout } = await execFileAsync(await resolveEditorCommand(editor), ['--list-extensions'], {
      timeout: 30000,
      windowsHide: true,
    });
    return new Set(stdout.split(/\r?\n/).map(normalizeExtensionId).filter(Boolean));
  }
  catch {
    return null;
  }
}

function editorExtensionDirectory(editor: EditorKind): string {
  return path.join(app.getPath('home'), editor === 'vscode' ? '.vscode/extensions' : '.cursor/extensions');
}

async function readExtensionDisplayNames(editor: EditorKind): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const entries = await fs.readdir(editorExtensionDirectory(editor), { withFileTypes: true });
    await Promise.all(entries
      .filter(entry => entry.isDirectory())
      .map(async (entry) => {
        try {
          const raw = await fs.readFile(path.join(editorExtensionDirectory(editor), entry.name, 'package.json'), 'utf-8');
          const parsed = JSON.parse(raw) as {
            publisher?: string;
            name?: string;
            displayName?: string;
          };
          if (!parsed.publisher || !parsed.name) {
            return;
          }

          const extensionId = normalizeExtensionId(`${parsed.publisher}.${parsed.name}`);
          if (!VALID_EXTENSION_ID.test(extensionId)) {
            return;
          }

          const extensionDir = path.join(editorExtensionDirectory(editor), entry.name);
          const messages = await readPackageNlsMessages(extensionDir);
          const displayName = resolveLocalizedValue(parsed.displayName, messages)
            || resolveLocalizedValue(parsed.name, messages)
            || parsed.name
            || extensionId;
          if (!names.has(extensionId) || isPlaceholderName(names.get(extensionId) || '')) {
            names.set(extensionId, displayName.trim());
          }
        }
        catch {
          // Ignore malformed or partially removed extension directories.
        }
      }));
  }
  catch {
    return names;
  }

  return names;
}

async function readPackageNlsMessages(extensionDir: string): Promise<Record<string, string>> {
  const fileNames = [
    'package.nls.json',
    'package.nls.zh-cn.json',
    'package.nls.zh-tw.json',
  ];
  const messages: Record<string, string> = {};

  for (const fileName of fileNames) {
    try {
      const raw = await fs.readFile(path.join(extensionDir, fileName), 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const [key, value] of Object.entries(parsed)) {
        messages[key] ||= value;
      }
    }
    catch {
      // Missing locale files are expected for many extensions.
    }
  }

  return messages;
}

function mergeScopeForInitializedEditor(
  currentScope: EditorExtensionScope,
  editor: EditorKind,
  installedInOtherEditor: boolean,
): EditorExtensionScope {
  if (installedInOtherEditor || currentScope === (editor === 'vscode' ? 'cursor' : 'vscode') || currentScope === 'common') {
    return 'common';
  }
  return editor;
}

export async function initializeEditorExtensions(source: EditorExtensionInitializeSource): Promise<EditorExtensionInitializeResult> {
  validateInitializeSource(source);
  const editors: EditorKind[] = source === 'both' ? ['vscode', 'cursor'] : [source];
  const installedEntries = await Promise.all(editors.map(async (editor) => {
    const [ids, displayNames] = await Promise.all([
      listInstalledExtensionIds(editor),
      readExtensionDisplayNames(editor),
    ]);
    return { editor, ids, displayNames };
  }));
  const failedEditors = installedEntries.filter(entry => entry.ids === null).map(entry => entry.editor);
  const installedByEditor = new Map<EditorKind, Set<string>>();
  const displayNamesByEditor = new Map<EditorKind, Map<string, string>>();

  for (const entry of installedEntries) {
    if (!entry.ids) {
      continue;
    }
    installedByEditor.set(entry.editor, entry.ids);
    displayNamesByEditor.set(entry.editor, entry.displayNames);
  }

  const records = await listEditorExtensions();
  const byExtensionId = new Map(records.map(record => [record.extensionId, record]));
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const [editor, ids] of installedByEditor.entries()) {
    const otherEditor: EditorKind = editor === 'vscode' ? 'cursor' : 'vscode';
    const otherInstalled = installedByEditor.get(otherEditor);
    for (const extensionId of ids) {
      validateExtensionId(extensionId);
      const existing = byExtensionId.get(extensionId);
      const editorDisplayName = displayNamesByEditor.get(editor)?.get(extensionId) || '';
      const vscodeName = editor === 'vscode'
        ? editorDisplayName
        : displayNamesByEditor.get('vscode')?.get(extensionId) || '';
      const cursorName = editor === 'cursor'
        ? editorDisplayName
        : displayNamesByEditor.get('cursor')?.get(extensionId) || '';
      if (!existing) {
        const scope = otherInstalled?.has(extensionId) ? 'common' : editor;
        const record = normalizeRecord({
          extensionId,
          name: editorDisplayName || extensionId,
          vscodeName,
          cursorName,
          note: '',
          scope,
        });
        records.push(record);
        byExtensionId.set(extensionId, record);
        added += 1;
        continue;
      }

      const nextScope = source === 'both'
        ? (installedByEditor.get('vscode')?.has(extensionId) && installedByEditor.get('cursor')?.has(extensionId)
            ? 'common'
            : editor)
        : mergeScopeForInitializedEditor(existing.scope, editor, Boolean(otherInstalled?.has(extensionId)));
      const nextVscodeName = vscodeName || existing.vscodeName;
      const nextCursorName = cursorName || existing.cursorName;
      const shouldReplacePrimaryName = editorDisplayName && shouldAutoReplaceName(existing);

      if (existing.scope === nextScope) {
        if (
          existing.vscodeName !== nextVscodeName
          || existing.cursorName !== nextCursorName
          || shouldReplacePrimaryName
        ) {
          existing.vscodeName = nextVscodeName;
          existing.cursorName = nextCursorName;
          if (shouldReplacePrimaryName) {
            existing.name = editorDisplayName;
          }
          existing.updatedAt = now;
          updated += 1;
          continue;
        }
        skipped += 1;
        continue;
      }

      existing.scope = nextScope;
      existing.vscodeName = nextVscodeName;
      existing.cursorName = nextCursorName;
      if (shouldReplacePrimaryName) {
        existing.name = editorDisplayName;
      }
      existing.updatedAt = now;
      updated += 1;
    }
  }

  await saveEditorExtensions(records);
  return {
    added,
    updated,
    skipped,
    failedEditors,
    records,
  };
}

export async function listEditorExtensionsWithStatus(): Promise<EditorExtensionWithStatus[]> {
  const records = await listEditorExtensions();
  const [vscodeInstalled, cursorInstalled, localVsixStatuses] = await Promise.all([
    listInstalledExtensionIds('vscode'),
    listInstalledExtensionIds('cursor'),
    Promise.all(records.map(record => resolveDownloadedEditorExtensionVsix(record.extensionId))),
  ]);

  return records.map((record, index) => ({
    ...record,
    status: {
      vscode: vscodeInstalled ? vscodeInstalled.has(record.extensionId) : null,
      cursor: cursorInstalled ? cursorInstalled.has(record.extensionId) : null,
    },
    localVsix: {
      exists: localVsixStatuses[index].exists,
      filePath: localVsixStatuses[index].filePath,
      bytes: localVsixStatuses[index].bytes,
    },
  }));
}

async function resolveDownloadedEditorExtensionVsix(extensionId: string): Promise<EditorExtensionLocalVsixStatus> {
  const normalizedId = normalizeExtensionId(extensionId);
  validateExtensionId(normalizedId);
  const config = await getConfig();
  const downloadDir = path.resolve(config.editorExtensions.vsixDownloadDir.trim() || app.getPath('downloads'));
  const filePath = path.join(downloadDir, `${normalizedId}.vsix`);

  try {
    const stat = await fs.stat(filePath);
    return {
      exists: stat.isFile(),
      filePath,
      bytes: stat.isFile() ? stat.size : 0,
    };
  }
  catch {
    return {
      exists: false,
      filePath,
      bytes: 0,
    };
  }
}

export async function downloadEditorExtensionVsix(
  extensionId: string,
): Promise<EditorExtensionVsixDownloadResult> {
  const normalizedId = normalizeExtensionId(extensionId);
  validateExtensionId(normalizedId);
  const config = await getConfig();
  const downloadDir = path.resolve(config.editorExtensions.vsixDownloadDir.trim() || app.getPath('downloads'));
  await fs.mkdir(downloadDir, { recursive: true });
  const filePath = path.join(downloadDir, `${normalizedId}.vsix`);
  const response = await fetch(buildMarketplaceVsixUrl(normalizedId));
  if (!response.ok) {
    throw new Error(`Download VSIX failed: HTTP ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error('Download VSIX failed: empty response.');
  }

  await fs.writeFile(filePath, buffer);
  shell.showItemInFolder(filePath);
  return {
    canceled: false,
    filePath,
    bytes: buffer.length,
  };
}

export async function installDownloadedEditorExtensionVsix(
  editor: EditorKind,
  extensionId: string,
): Promise<EditorExtensionCommandResult> {
  validateEditor(editor);
  const normalizedId = normalizeExtensionId(extensionId);
  validateExtensionId(normalizedId);
  const vsix = await resolveDownloadedEditorExtensionVsix(normalizedId);
  if (!vsix.exists) {
    return {
      success: false,
      message: `Downloaded VSIX not found: ${vsix.filePath}`,
    };
  }

  const command = await resolveEditorCommand(editor);
  try {
    const { stdout, stderr } = await execFileAsync(command, ['--install-extension', vsix.filePath], {
      timeout: 120000,
      windowsHide: true,
    });
    return {
      success: true,
      message: (stdout || stderr || `${command} install ${normalizedId} from ${vsix.filePath} done.`).trim(),
    };
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message,
    };
  }
}

export async function runEditorExtensionCommand(
  editor: EditorKind,
  action: 'install' | 'uninstall',
  extensionId: string,
): Promise<EditorExtensionCommandResult> {
  validateAction(action);
  const normalizedId = normalizeExtensionId(extensionId);
  validateExtensionId(normalizedId);
  const args = [action === 'install' ? '--install-extension' : '--uninstall-extension', normalizedId];
  const command = await resolveEditorCommand(editor);

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 120000,
      windowsHide: true,
    });
    return {
      success: true,
      message: (stdout || stderr || `${command} ${action} ${normalizedId} done.`).trim(),
    };
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message,
    };
  }
}

export async function runEditorExtensionBulkCommand(
  editor: EditorKind,
  action: 'install' | 'uninstall',
  target: EditorKind | 'common',
): Promise<EditorExtensionCommandResult[]> {
  validateTarget(target);
  const records = (await listEditorExtensions()).filter(record => shouldIncludeRecord(record, target));
  const results: EditorExtensionCommandResult[] = [];

  for (const record of records) {
    results.push(await runEditorExtensionCommand(editor, action, record.extensionId));
  }

  return results;
}
