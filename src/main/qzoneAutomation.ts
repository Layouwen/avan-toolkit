import type { BrowserContext, Frame, Locator, Page } from 'playwright';
import type { AppConfig } from './configManager';
import type { ModuleLogger } from './logger';
import { Buffer } from 'node:buffer';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { createModuleLogger } from './logger';

export interface QzoneAutomationResult {
  success: boolean;
  message: string;
  steps: string[];
}

export interface QzoneListItem {
  id: string;
  text: string;
  source: string;
  images: string[];
}

export interface QzoneListResult extends QzoneAutomationResult {
  items: QzoneListItem[];
  hasMore: boolean;
}

type QzoneConfig = AppConfig['qzone'];

const QZONE_URL = 'https://qzone.qq.com/';
const QZONE_FEEDS_MORE_URL = 'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds3_html_more';
const LOGIN_WAIT_MS = 180_000;
const SHORT_WAIT_MS = 2_000;
const MEDIUM_WAIT_MS = 8_000;
const LIST_ITEM_LIMIT = 20;
const FEED_PAGE_SIZE = 10;
const FEED_PAGE_LIMIT = 3;
const SESSION_CLOSE_TIMEOUT_MS = 3_000;
const IMAGE_FETCH_TIMEOUT_MS = 5_000;
const IMAGE_INLINE_LIMIT = 12;

interface QzoneBrowserSession {
  profileDir: string;
  context: BrowserContext;
  page: Page | null;
  closed: boolean;
}

interface FrameListItem {
  id: string;
  index: number;
  text: string;
  visible: boolean;
  source: string;
  images: string[];
}

interface QzoneCookie {
  name: string;
  value: string;
}

interface QzoneFeedMain {
  hasMoreFeeds?: boolean;
  begintime?: string | number;
  pagenum?: string | number;
  externparam?: string;
  dayspac?: string | number;
}

interface QzoneFeedDataItem {
  abstime?: string | number;
  feedstime?: string;
  html?: string;
  key?: string;
  nickname?: string;
  opuin?: string | number;
  uin?: string | number;
}

interface QzoneFeedPayload {
  code?: number;
  message?: string;
  data?: {
    main?: QzoneFeedMain;
    data?: Array<QzoneFeedDataItem | undefined>;
  };
}

interface QzoneFeedPage {
  items: QzoneFeedDataItem[];
  main: QzoneFeedMain;
}

interface QzoneFeedApiSession {
  cookieHeader: string;
  gtk: number;
  hasMoreFeeds: boolean;
  previousMain?: QzoneFeedMain;
  seen: Set<string>;
  uin: string;
  userAgent: string;
}

let qzoneSession: QzoneBrowserSession | null = null;
let qzoneFeedApiSession: QzoneFeedApiSession | null = null;
let qzoneTaskQueue: Promise<void> = Promise.resolve();
const qzoneStepLoggers = new WeakMap<string[], ModuleLogger>();

function pushStep(steps: string[], message: string) {
  const line = `${new Date().toLocaleTimeString()} ${message}`;
  steps.push(line);
  qzoneStepLoggers.get(steps)?.info(line);
}

function timeoutPromise(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeUin(value: string | undefined | null): string | null {
  const text = String(value || '').trim();
  const prefixed = text.match(/^[ou](\d+)$/i);
  if (prefixed) {
    return prefixed[1];
  }

  const digits = text.match(/\d{5,}/);
  return digits ? digits[0] : null;
}

function profileDirOf(qzone: QzoneConfig): string {
  return qzone.playwrightProfileDir.trim();
}

function contentTypeToImageMime(contentType: string | null): string {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (normalized.startsWith('image/')) {
    return normalized;
  }
  return 'image/jpeg';
}

function qzoneGtk(skey: string): number {
  let hash = 5381;
  for (let index = 0; index < skey.length; index += 1) {
    hash += (hash << 5) + skey.charCodeAt(index);
  }
  return hash & 0x7FFFFFFF;
}

function cookieValue(cookies: QzoneCookie[], names: string[]): string | null {
  for (const name of names) {
    const cookie = cookies.find(item => item.name === name);
    if (cookie?.value) {
      return cookie.value;
    }
  }
  return null;
}

function cookieHeader(cookies: QzoneCookie[]): string {
  return cookies
    .filter(cookie => cookie.name && cookie.value)
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

function decodeHtmlEntity(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

function normalizeHtmlText(value: string | undefined | null): string {
  return decodeHtmlEntity(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<img(?:\s[^>]*)?\stitle=(["'])([^"']*)\1[^>]*>/gi, ' $2 ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|span|a)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function attrFromHtml(html: string, attrName: string): string {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*(['"])(.*?)\\1`, 'i');
  return decodeHtmlEntity(html.match(pattern)?.[2] || '').trim();
}

function classBlockText(html: string, className: string): string {
  const pattern = new RegExp(`<([a-z0-9]+)\\b[^>]*class=(['"])[^'"]*\\b${className}\\b[^'"]*\\2[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
  return normalizeHtmlText(html.match(pattern)?.[3]);
}

function allClassBlockTexts(html: string, className: string): string[] {
  const pattern = new RegExp(`<([a-z0-9]+)\\b[^>]*class=(['"])[^'"]*\\b${className}\\b[^'"]*\\2[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
  return [...html.matchAll(pattern)]
    .map(match => normalizeHtmlText(match[3]))
    .filter(Boolean);
}

function countClassBlocks(html: string, className: string): number {
  const pattern = new RegExp(`class=(['"])[^'"]*\\b${className}\\b`, 'gi');
  return [...html.matchAll(pattern)].length;
}

function imagesFromFeedHtml(html: string): string[] {
  const imageUrls = [...html.matchAll(/<img(?:\s[^>]*)?\ssrc=(["'])([^"']*)\1/gi)]
    .map(match => decodeHtmlEntity(match[2]).trim())
    .filter(Boolean)
    .filter((url) => {
      const normalized = url.toLowerCase();
      return !normalized.includes('qlogo')
        && !normalized.includes('/qzone/em/')
        && !normalized.includes('qzonestyle.gtimg.cn/qzone/em/')
        && !normalized.includes('store.qq.com/qzone');
    });
  return [...new Set(imageUrls)];
}

function parseQzoneCallback(raw: string): QzoneFeedPayload {
  const trimmed = raw.trim();
  const match = trimmed.match(/^_Callback\(([\s\S]*)\);?\s*$/);
  const expression = match?.[1] || trimmed;
  return vm.runInNewContext(`(${expression})`, Object.create(null), {
    timeout: 1_000,
  }) as QzoneFeedPayload;
}

function qzoneFeedItemToListItem(feed: QzoneFeedDataItem, index: number): QzoneListItem | null {
  const html = String(feed.html || '');
  const author = String(feed.nickname || '').trim();
  const time = String(feed.feedstime || feed.abstime || '').trim();
  const directContent = classBlockText(html, 'f-info');
  const summaryText = allClassBlockTexts(html, 'txt-box')
    .find(text => text && text !== author) || '';
  const content = directContent || summaryText;
  const images = imagesFromFeedHtml(html);
  const source = classBlockText(html, 'f-reprint');
  const visitor = normalizeHtmlText(html.match(/<a(?:\s[^>]*)?\sdata-role=(["'])Visitor\1[^>]*>([\s\S]*?)<\/a>/i)?.[2]);
  const likeCount = attrFromHtml(html.match(/<[^>]+\bclass=(["'])[^"']*\b_likeInfo\b[^"']*\1[^>]*>/i)?.[0] || '', 'likeinfo')
    || attrFromHtml(html.match(/<[^>]+\bclass=(["'])[^"']*\bqz_like_btn_v3\b[^"']*\1[^>]*>/i)?.[0] || '', 'data-likecnt')
    || allClassBlockTexts(html, 'f-like-cnt')[0]
    || '';
  const commentCount = countClassBlocks(html, 'comments-item');
  const imageCount = images.length > 0 ? `图片${images.length}张` : '';
  const parts = [
    author ? `作者：${author}` : '',
    time ? `时间：${time}` : '',
    content ? `正文：${content}` : '',
    imageCount,
    source,
    visitor,
    likeCount ? `${likeCount}人觉得很赞` : '',
    commentCount > 0 ? `评论${commentCount}条` : '',
  ].filter(Boolean);

  if (parts.length === 0 && images.length === 0) {
    return null;
  }

  const id = [
    feed.opuin || feed.uin || 'feed',
    feed.key || feed.abstime || index,
  ].filter(Boolean).join('_');

  return {
    id,
    text: parts.join('\n'),
    source: 'feeds3_html_more',
    images,
  };
}

async function inferQzoneUin(context: BrowserContext, page: Page, qzone: QzoneConfig): Promise<string | null> {
  const configuredUin = normalizeUin(qzone.qqNumber);
  if (configuredUin) {
    return configuredUin;
  }

  const pageUin = normalizeUin(page.url().match(/user\.qzone\.qq\.com\/(\d+)/)?.[1]);
  if (pageUin) {
    return pageUin;
  }

  const cookies = await context.cookies().catch((): Array<{ name: string; value: string }> => []);
  const cookieNames = new Set(['p_uin', 'uin', 'ptui_loginuin', 'o_cookie']);
  for (const cookie of cookies) {
    if (!cookieNames.has(cookie.name)) {
      continue;
    }

    const cookieUin = normalizeUin(cookie.value);
    if (cookieUin) {
      return cookieUin;
    }
  }

  return null;
}

async function firstVisibleLocator(candidates: Locator[], timeout = SHORT_WAIT_MS): Promise<Locator | null> {
  for (const locator of candidates) {
    try {
      await locator.first().waitFor({ state: 'visible', timeout });
      return locator.first();
    }
    catch {
      // Try the next candidate. Qzone changes markup often, so several fallbacks are expected.
    }
  }
  return null;
}

async function firstAttachedLocator(candidates: Locator[], timeout = SHORT_WAIT_MS): Promise<Locator | null> {
  for (const locator of candidates) {
    try {
      await locator.first().waitFor({ state: 'attached', timeout });
      return locator.first();
    }
    catch {
      // Try the next candidate.
    }
  }
  return null;
}

function frameTextCandidates(frame: Frame) {
  return [
    frame.locator('.qz-poster-editor-cont .qz-inputer [contenteditable="true"]:visible'),
    frame.locator('.qz-poster-editor-cont [id$="_substitutor_content"]:visible'),
    frame.locator('.qz-poster-editor-cont [id$="_content_content"]:visible'),
    frame.locator('textarea'),
    frame.locator('[contenteditable="true"]'),
    frame.locator('[role="textbox"]'),
    frame.getByPlaceholder(/说点什么|发表|分享|动态|心情|what/i),
  ];
}

function framePublishCandidates(frame: Frame) {
  return [
    frame.locator('.qz-poster-ft .btn-post:visible'),
    frame.locator('[data-hottag="MOODPOSTER.POST"]:visible'),
    frame.locator('.op .btn-post:visible'),
    frame.getByRole('button', { name: /发表|发布|发送|post|publish/i }),
    frame.locator('button:has-text("发表")'),
    frame.locator('a:has-text("发表")'),
    frame.locator('[role="button"]:has-text("发表")'),
  ];
}

async function findVisibleInFrames(
  page: Page,
  createCandidates: (frame: Frame) => Locator[],
  timeout = SHORT_WAIT_MS,
): Promise<Locator | null> {
  for (const frame of page.frames()) {
    const locator = await firstVisibleLocator(createCandidates(frame), timeout);
    if (locator) {
      return locator;
    }
  }
  return null;
}

async function findAttachedInFrames(
  page: Page,
  createCandidates: (frame: Frame) => Locator[],
  timeout = SHORT_WAIT_MS,
): Promise<Locator | null> {
  for (const frame of page.frames()) {
    const locator = await firstAttachedLocator(createCandidates(frame), timeout);
    if (locator) {
      return locator;
    }
  }
  return null;
}

async function hasLoggedInSignal(page: Page): Promise<boolean> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: MEDIUM_WAIT_MS });
  }
  catch {
    // Continue with DOM probing.
  }

  const loginSignals = [
    page.locator('iframe[id*="login"], iframe[src*="xui.ptlogin2.qq.com"]'),
    page.getByText(/扫码登录|帐号密码登录|账号密码登录|QQ帐号|QQ账号/),
  ];
  const loggedInSignals = [
    page.locator('#QM_OwnerInfo_Icon, .user-home, .head-avatar, [data-clicklog*="profile"]'),
    page.getByText(/说说|好友动态|个人档|日志/),
  ];

  const loginSignal = await firstVisibleLocator(loginSignals, 800);
  if (loginSignal) {
    return false;
  }

  const loggedInSignal = await firstVisibleLocator(loggedInSignals, 800);
  return Boolean(loggedInSignal);
}

async function waitForLogin(page: Page, steps: string[]): Promise<boolean> {
  pushStep(steps, '等待登录完成。');
  const deadline = Date.now() + LOGIN_WAIT_MS;
  while (Date.now() < deadline) {
    if (await hasLoggedInSignal(page)) {
      pushStep(steps, '检测到 QQ 空间已登录。');
      return true;
    }
    await page.waitForTimeout(1_500);
  }
  return false;
}

async function fillCredentials(page: Page, qzone: QzoneConfig, steps: string[]): Promise<void> {
  if (!qzone.qqNumber || !qzone.qqPassword) {
    pushStep(steps, '账号或密码为空，保留登录页等待手动登录。');
    return;
  }

  pushStep(steps, '尝试切换到账号密码登录并自动填写。');
  for (const frame of page.frames()) {
    const passwordLogin = await firstVisibleLocator([
      frame.getByText(/帐号密码登录|账号密码登录|密码登录/),
      frame.locator('a:has-text("帐号密码登录")'),
      frame.locator('a:has-text("账号密码登录")'),
    ], 800);
    if (passwordLogin) {
      await passwordLogin.click().catch((): void => undefined);
      break;
    }
  }

  const accountInput = await findVisibleInFrames(page, frame => [
    frame.locator('input[name="u"]'),
    frame.locator('input[id="u"]'),
    frame.getByPlaceholder(/QQ号码|QQ号|账号|帐号/),
    frame.locator('input[type="text"]'),
  ], 1_000);
  const passwordInput = await findVisibleInFrames(page, frame => [
    frame.locator('input[name="p"]'),
    frame.locator('input[id="p"]'),
    frame.locator('input[type="password"]'),
    frame.getByPlaceholder(/密码/),
  ], 1_000);

  if (!accountInput || !passwordInput) {
    pushStep(steps, '未找到账号密码输入框，保留页面等待扫码或手动登录。');
    return;
  }

  await accountInput.fill(qzone.qqNumber);
  await passwordInput.fill(qzone.qqPassword);

  const loginButton = await findVisibleInFrames(page, frame => [
    frame.getByRole('button', { name: /登录|登 录|login/i }),
    frame.locator('input[type="submit"]'),
    frame.locator('button:has-text("登录")'),
    frame.locator('a:has-text("登录")'),
  ], 1_000);

  if (!loginButton) {
    pushStep(steps, '未找到登录按钮，已填写账号密码，请手动继续。');
    return;
  }

  await loginButton.click();
  pushStep(steps, '已点击登录；如出现验证码、滑块、短信或扫码校验，请在窗口中手动完成。');
}

async function ensureLoggedIn(page: Page, qzone: QzoneConfig, steps: string[]): Promise<boolean> {
  pushStep(steps, `打开 QQ 空间: ${QZONE_URL}`);
  await page.goto(QZONE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  if (await hasLoggedInSignal(page)) {
    pushStep(steps, '复用已保存登录态成功。');
    return true;
  }

  if (qzone.loginMode === 'credentials') {
    await fillCredentials(page, qzone, steps);
  }
  else {
    pushStep(steps, '当前为扫码登录模式，请在弹出的浏览器窗口中扫码。');
  }

  return waitForLogin(page, steps);
}

async function closeCurrentQzoneSession(): Promise<void> {
  const session = qzoneSession;
  qzoneSession = null;
  session?.context.removeAllListeners('close');
  if (!session) {
    return;
  }

  await Promise.race([
    session.context.close().catch((): void => undefined),
    timeoutPromise(SESSION_CLOSE_TIMEOUT_MS),
  ]);
}

function closeCurrentQzoneSessionInBackground(steps?: string[]): void {
  const session = qzoneSession;
  qzoneSession = null;
  session?.context.removeAllListeners('close');
  if (!session) {
    return;
  }

  void Promise.race([
    session.context.close().catch((): void => undefined),
    timeoutPromise(SESSION_CLOSE_TIMEOUT_MS),
  ]).then(() => {
    if (steps) {
      pushStep(steps, '已请求关闭弹出的 QQ 空间浏览器会话。');
    }
  });
}

async function getQzoneSession(qzone: QzoneConfig, steps: string[]): Promise<QzoneBrowserSession> {
  const profileDir = profileDirOf(qzone);
  if (!profileDir) {
    throw new Error('Qzone Playwright profile directory is empty. Please set a profile directory first.');
  }

  if (qzoneSession && (qzoneSession.closed || qzoneSession.profileDir !== profileDir)) {
    pushStep(steps, qzoneSession.profileDir === profileDir
      ? '已登录浏览器会话已关闭，准备重新打开。'
      : 'Qzone profile 目录已变更，准备重建浏览器会话。');
    await closeCurrentQzoneSession();
  }

  if (!qzoneSession) {
    pushStep(steps, `打开可复用浏览器会话: ${profileDir}`);
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1280, height: 860 },
    });
    const session: QzoneBrowserSession = {
      profileDir,
      context,
      page: null,
      closed: false,
    };
    context.once('close', () => {
      session.closed = true;
      if (qzoneSession === session) {
        qzoneSession = null;
      }
    });
    qzoneSession = session;
  }
  else {
    pushStep(steps, '复用当前已打开的 Qzone 浏览器会话。');
  }

  if (!qzoneSession.page || qzoneSession.page.isClosed()) {
    qzoneSession.page = qzoneSession.context.pages().find(page => !page.isClosed())
      || await qzoneSession.context.newPage();
  }

  return qzoneSession;
}

async function withQzoneTaskLock<T>(task: () => Promise<T>): Promise<T> {
  const previousTask = qzoneTaskQueue.catch((): void => undefined);
  let release: () => void = () => {};
  qzoneTaskQueue = previousTask.then(() => new Promise<void>((resolve) => {
    release = resolve;
  }));

  await previousTask;
  try {
    return await task();
  }
  finally {
    release();
  }
}

async function focusShuoshuoEditor(page: Page, steps: string[]): Promise<Locator | null> {
  pushStep(steps, '查找说说输入区域。');
  const directEditor = await findVisibleInFrames(page, frameTextCandidates, 1_000);
  if (directEditor) {
    await directEditor.click().catch((): void => undefined);
    await page.waitForTimeout(500);
    return directEditor;
  }

  const entry = await findVisibleInFrames(page, frame => [
    frame.getByText(/说说|写说说|发表说说|分享新鲜事/),
    frame.locator('a:has-text("说说")'),
    frame.locator('button:has-text("说说")'),
  ], 1_000);
  if (entry) {
    await entry.click().catch((): void => undefined);
    await page.waitForTimeout(1_000);
  }

  const editor = await findVisibleInFrames(page, frameTextCandidates, 1_000);
  if (editor) {
    await editor.click().catch((): void => undefined);
    await page.waitForTimeout(500);
  }
  return editor;
}

async function fillEditor(editor: Locator, content: string): Promise<void> {
  try {
    await editor.click();
    await editor.fill(content);
  }
  catch {
    await editor.click();
    await editor.evaluate((node) => {
      const element = node as {
        value?: string;
        textContent?: string | null;
        dispatchEvent: (event: unknown) => boolean;
      };
      if ('value' in element) {
        element.value = '';
      }
      else {
        element.textContent = '';
      }
      const EventCtor = (globalThis as { Event: new (type: string, init?: { bubbles?: boolean }) => unknown }).Event;
      element.dispatchEvent(new EventCtor('input', { bubbles: true }));
      element.dispatchEvent(new EventCtor('change', { bubbles: true }));
    });
    await editor.pressSequentially(content);
  }
}

async function publishShuoshuo(page: Page, content: string, steps: string[]): Promise<QzoneAutomationResult> {
  const editor = await focusShuoshuoEditor(page, steps);
  if (!editor) {
    return {
      success: false,
      message: '未找到 QQ 空间说说输入框。可能是页面结构已变化，或登录/风控校验尚未完成。',
      steps,
    };
  }

  await fillEditor(editor, content);
  pushStep(steps, '已填写说说内容。');

  const publishButton = await findVisibleInFrames(page, framePublishCandidates, 1_000);
  if (!publishButton) {
    return {
      success: false,
      message: '未找到发表按钮。内容已尽量填入，请在浏览器窗口中手动确认。',
      steps,
    };
  }

  await publishButton.click();
  pushStep(steps, '已点击发表按钮。');
  await page.waitForTimeout(2_000);

  return {
    success: true,
    message: '已尝试发表 QQ 空间说说。请在 QQ 空间页面确认最终发布状态。',
    steps,
  };
}

async function runWithContext(
  qzone: QzoneConfig,
  task: (context: BrowserContext, page: Page, steps: string[]) => Promise<QzoneAutomationResult>,
  logger: ModuleLogger,
): Promise<QzoneAutomationResult> {
  return withQzoneTaskLock(async () => {
    const steps: string[] = [];
    qzoneStepLoggers.set(steps, logger);
    logger.info(`Qzone config: ${JSON.stringify(qzone)}`, { sensitive: true });
    try {
      const session = await getQzoneSession(qzone, steps);
      const result = await task(session.context, session.page!, steps);
      logger.log(result.success ? 'success' : 'error', `Qzone task result: ${JSON.stringify(result)}`, { sensitive: true });
      return result;
    }
    catch (error) {
      pushStep(steps, `执行失败: ${toErrorMessage(error)}`);
      logger.error(`Qzone task failed: ${toErrorMessage(error)}`, { sensitive: true });
      return {
        success: false,
        message: toErrorMessage(error),
        steps,
      };
    }
  });
}

export async function closeQzoneSession(): Promise<void> {
  await closeCurrentQzoneSession();
}

function feedRequestParams(uin: string, gtk: number, previousMain?: QzoneFeedMain): URLSearchParams {
  const params = new URLSearchParams({
    uin,
    scope: '0',
    view: '1',
    daylist: '',
    uinlist: '',
    gid: '',
    flag: '1',
    filter: 'all',
    applist: 'all',
    refresh: '0',
    aisortEndTime: '0',
    aisortOffset: '0',
    getAisort: '0',
    aisortBeginTime: '0',
    pagenum: String(previousMain?.pagenum || 1),
    externparam: String(previousMain?.externparam || ''),
    firstGetGroup: '0',
    icServerTime: '0',
    mixnocache: '0',
    scene: '0',
    begintime: String(previousMain?.begintime || 0),
    count: String(FEED_PAGE_SIZE),
    dayspac: String(previousMain?.dayspac || 0),
    sidomain: 'qzonestyle.gtimg.cn',
    useutf8: '1',
    outputhtmlfeed: '1',
    rd: String(Math.random()),
    usertime: String(Date.now()),
    windowId: String(Math.random()),
    g_tk: String(gtk),
  });
  params.append('g_tk', String(gtk));
  return params;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  }
  finally {
    clearTimeout(timeout);
  }
}

async function fetchQzoneFeedPage(session: QzoneFeedApiSession): Promise<QzoneFeedPage> {
  const url = `${QZONE_FEEDS_MORE_URL}?${feedRequestParams(session.uin, session.gtk, session.previousMain).toString()}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'accept': '*/*',
      'cookie': session.cookieHeader,
      'referer': `https://user.qzone.qq.com/${session.uin}/infocenter`,
      'User-Agent': session.userAgent,
    },
  }, 20_000);

  if (!response.ok) {
    throw new Error(`feeds3_html_more returned HTTP ${response.status}`);
  }

  const payload = parseQzoneCallback(await response.text());
  if (payload.code !== 0) {
    throw new Error(`feeds3_html_more returned code ${payload.code ?? 'unknown'} ${payload.message || ''}`.trim());
  }

  return {
    items: (payload.data?.data?.filter(Boolean) as QzoneFeedDataItem[] | undefined) || [],
    main: payload.data?.main || {},
  };
}

async function createQzoneFeedApiSession(
  context: BrowserContext,
  page: Page,
  qzone: QzoneConfig,
): Promise<QzoneFeedApiSession> {
  const cookies = await context.cookies();
  const uin = await inferQzoneUin(context, page, qzone);
  if (!uin) {
    throw new Error('未能从配置、当前 URL 或 cookie 推断 QQ 号。');
  }

  const skey = cookieValue(cookies, ['p_skey', 'skey']);
  if (!skey) {
    throw new Error('未找到 p_skey/skey cookie，无法计算 g_tk。');
  }

  const header = cookieHeader(cookies);
  if (!header) {
    throw new Error('登录 cookie 为空，无法调用好友动态接口。');
  }

  return {
    cookieHeader: header,
    gtk: qzoneGtk(skey),
    hasMoreFeeds: true,
    seen: new Set<string>(),
    uin,
    userAgent: String(await page.evaluate('navigator.userAgent').catch(() => 'Mozilla/5.0')),
  };
}

async function readQzoneFeedItemsFromApiSession(
  session: QzoneFeedApiSession,
  steps: string[],
  limit = LIST_ITEM_LIMIT,
): Promise<QzoneListItem[]> {
  const items: QzoneListItem[] = [];
  pushStep(steps, `通过 feeds3_html_more 接口加载好友动态: uin=${session.uin}`);

  for (let pageIndex = 0; pageIndex < FEED_PAGE_LIMIT && items.length < limit && session.hasMoreFeeds; pageIndex += 1) {
    const feedPage = await fetchQzoneFeedPage(session);
    session.previousMain = feedPage.main;
    session.hasMoreFeeds = Boolean(feedPage.main.hasMoreFeeds);
    pushStep(steps, `接口第 ${pageIndex + 1} 页返回 ${feedPage.items.length} 条动态。`);

    for (const feed of feedPage.items) {
      const item = qzoneFeedItemToListItem(feed, items.length);
      if (!item) {
        continue;
      }

      const dedupeKey = item.id || item.text || item.images.join('|');
      if (session.seen.has(dedupeKey)) {
        continue;
      }
      session.seen.add(dedupeKey);
      items.push({
        ...item,
        id: `${item.id}-${session.seen.size}`,
      });
      if (items.length >= limit) {
        break;
      }
    }

    if (feedPage.items.length === 0) {
      break;
    }
  }

  if (items.length === 0) {
    throw new Error('feeds3_html_more 接口未返回可解析动态。');
  }

  pushStep(steps, `接口加载成功，解析到 ${items.length} 条好友动态。`);
  return items;
}

async function listQzoneShuoshuoByApi(
  context: BrowserContext,
  page: Page,
  qzone: QzoneConfig,
  steps: string[],
): Promise<QzoneListItem[]> {
  const session = await createQzoneFeedApiSession(context, page, qzone);
  qzoneFeedApiSession = session;
  return readQzoneFeedItemsFromApiSession(session, steps);
}

async function collectVisibleListItems(page: Page, steps: string[]): Promise<QzoneListItem[]> {
  pushStep(steps, '抓取 QQ 空间页面中的好友动态列表。');
  const items: QzoneListItem[] = [];
  const seen = new Set<string>();

  for (const frame of page.frames()) {
    const frameUrl = frame.url();
    const frameItems = await frame.locator('body').evaluate((bodyNode, url) => {
      interface ElementLike {
        className?: unknown;
        getAttribute: (name: string) => string | null;
        getBoundingClientRect: () => { width: number; height: number };
        matches: (selector: string) => boolean;
        querySelector: (selector: string) => ElementLike | null;
        querySelectorAll: (selector: string) => ArrayLike<ElementLike>;
        textContent?: string | null;
      }

      function normalizeText(value: string | null | undefined): string {
        return String(value || '').replace(/\s+/g, ' ').trim();
      }

      function textOf(node: ElementLike | null): string {
        return normalizeText(node?.textContent);
      }

      function attrOf(node: ElementLike | null, name: string): string {
        return normalizeText(node?.getAttribute(name));
      }

      const body = bodyNode as ElementLike;
      const feedNodes = Array.from(body.querySelectorAll('#feed_friend_list > li.f-single'));
      if (feedNodes.length > 0) {
        return feedNodes
          .map((node, index) => {
            const box = node.getBoundingClientRect();
            const feedData = node.querySelector('[name="feed_data"]');
            const feedItem = node.querySelector('.f-item');
            const author = textOf(node.querySelector('.f-single-head .f-name'));
            const time = textOf(node.querySelector('.f-single-head .info-detail .state'));
            const directContent = textOf(node.querySelector('.f-info'));
            const summaryText = textOf(node.querySelector('.qz_summary .txt-box'));
            const content = directContent || summaryText;
            const reprintSource = textOf(node.querySelector('.qz_summary .f-reprint .item'));
            const images = Array.from(node.querySelectorAll('.img-item img'))
              .map(img => attrOf(img, 'src'))
              .filter(Boolean);
            const imageCountText = textOf(node.querySelector('.img-num .num'));
            const visibleImageCount = images.length;
            const imageCount = imageCountText
              ? `图片${imageCountText.replace(/\D+/g, '') || imageCountText}张`
              : (visibleImageCount > 0 ? `图片${visibleImageCount}张` : '');
            const likeCount = attrOf(node.querySelector('._likeInfo'), 'likeinfo')
              || attrOf(node.querySelector('.qz_like_btn_v3'), 'data-likecnt')
              || textOf(node.querySelector('.f-like-cnt'));
            const visitor = textOf(node.querySelector('.qz_feed_plugin[data-role="Visitor"]'));
            const commentCount = Array.from(node.querySelectorAll('.comments-list .comments-item')).length;
            const parts = [
              author ? `作者：${author}` : '',
              time ? `时间：${time}` : '',
              content ? `正文：${content}` : '',
              imageCount,
              reprintSource,
              visitor,
              likeCount ? `${likeCount}人觉得很赞` : '',
              commentCount > 0 ? `评论${commentCount}条` : '',
            ].filter(Boolean);

            return {
              id: attrOf(feedData, 'data-topicid')
                || attrOf(feedData, 'data-tid')
                || attrOf(feedItem, 'data-key')
                || attrOf(node, 'id')
                || `${url}-${index}`,
              index,
              text: parts.join('\n'),
              visible: box.width > 20 && box.height > 10,
              source: '#feed_friend_list',
              images,
            };
          })
          .filter(item => item.visible && (item.text.length > 0 || item.images.length > 0))
          .slice(0, 60);
      }

      return [];
    }, frameUrl).catch((): FrameListItem[] => []);

    for (const item of frameItems) {
      const normalized = item.text
        .split('\n')
        .map(line => line.replace(/[^\S\n]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
      const dedupeKey = item.id || normalized || item.images.join('|');
      if (!dedupeKey || seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      items.push({
        id: `${item.id}-${items.length}`,
        text: normalized,
        source: item.source,
        images: item.images,
      });
      if (items.length >= 20) {
        return items;
      }
    }
  }

  pushStep(steps, '未从 #feed_friend_list 解析到动态，忽略主页导航、好友模块、访客记录等非动态内容。');
  return items;
}

async function inlineQzoneImages(context: BrowserContext, page: Page, items: QzoneListItem[], steps: string[]): Promise<QzoneListItem[]> {
  const imageUrls = [...new Set(items.flatMap(item => item.images))];
  if (imageUrls.length === 0) {
    return items;
  }

  pushStep(steps, `尝试转存 ${imageUrls.length} 张 QQ 空间图片，避免防盗链占位图。`);
  const imageMap = new Map<string, string>();
  const referer = page.url().startsWith('http') ? page.url() : QZONE_URL;

  for (const url of imageUrls.slice(0, IMAGE_INLINE_LIMIT)) {
    try {
      const response = await context.request.get(url, {
        headers: {
          referer,
          'User-Agent': 'Mozilla/5.0',
        },
        timeout: IMAGE_FETCH_TIMEOUT_MS,
      });

      if (!response.ok()) {
        continue;
      }

      const body = await response.body();
      const mime = contentTypeToImageMime(response.headers()['content-type'] || null);
      imageMap.set(url, `data:${mime};base64,${body.toString('base64')}`);
    }
    catch {
      // Keep the original URL if Qzone refuses the request.
    }
  }

  pushStep(steps, `已成功转存 ${imageMap.size}/${imageUrls.length} 张图片。`);
  return items.map(item => ({
    ...item,
    images: item.images.map(image => imageMap.get(image) || image),
  }));
}

async function inlineQzoneImagesByApiSession(
  session: QzoneFeedApiSession,
  items: QzoneListItem[],
  steps: string[],
): Promise<QzoneListItem[]> {
  const imageUrls = [...new Set(items.flatMap(item => item.images))];
  if (imageUrls.length === 0) {
    return items;
  }

  pushStep(steps, `通过接口登录态转存 ${imageUrls.length} 张 QQ 空间图片。`);
  const imageMap = new Map<string, string>();
  for (const url of imageUrls.slice(0, IMAGE_INLINE_LIMIT)) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'cookie': session.cookieHeader,
          'referer': `https://user.qzone.qq.com/${session.uin}/infocenter`,
          'User-Agent': session.userAgent,
        },
      }, IMAGE_FETCH_TIMEOUT_MS);

      if (!response.ok) {
        continue;
      }

      const body = Buffer.from(await response.arrayBuffer());
      const mime = contentTypeToImageMime(response.headers.get('content-type'));
      imageMap.set(url, `data:${mime};base64,${body.toString('base64')}`);
    }
    catch {
      // Keep the original URL if Qzone refuses the request.
    }
  }

  pushStep(steps, `已成功转存 ${imageMap.size}/${imageUrls.length} 张图片。`);
  return items.map(item => ({
    ...item,
    images: item.images.map(image => imageMap.get(image) || image),
  }));
}

async function waitForFeedFriendList(page: Page, steps: string[]): Promise<boolean> {
  const deadline = Date.now() + MEDIUM_WAIT_MS;
  while (Date.now() < deadline) {
    const feedList = await findAttachedInFrames(page, frame => [
      frame.locator('#feed_friend_list > li.f-single'),
      frame.locator('#feed_friend_list'),
    ], 600);

    if (feedList) {
      pushStep(steps, '检测到 #feed_friend_list 好友动态列表。');
      return true;
    }

    await page.waitForTimeout(500);
  }

  pushStep(steps, '未检测到 #feed_friend_list。');
  return false;
}

async function openInfocenter(page: Page, uin: string, steps: string[]): Promise<boolean> {
  const infocenterUrl = `https://user.qzone.qq.com/${uin}/infocenter`;
  pushStep(steps, `尝试直接打开好友动态页: ${infocenterUrl}`);
  await page.goto(infocenterUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch((): void => undefined);
  return waitForFeedFriendList(page, steps);
}

async function openTimeline(context: BrowserContext, page: Page, qzone: QzoneConfig, steps: string[]): Promise<void> {
  pushStep(steps, '尝试进入说说/好友动态列表区域。');
  if (await waitForFeedFriendList(page, steps)) {
    return;
  }

  const uin = await inferQzoneUin(context, page, qzone);
  if (uin && await openInfocenter(page, uin, steps)) {
    return;
  }
  if (!uin) {
    pushStep(steps, '未能从配置、当前 URL 或登录 cookie 推断 QQ 号，跳过直接打开 infocenter。');
  }

  const entry = await findVisibleInFrames(page, frame => [
    frame.getByText(/好友动态/),
    frame.locator('a:has-text("好友动态")'),
  ], 1_000);

  if (!entry) {
    pushStep(steps, '未找到明确的好友动态入口。');
    return;
  }

  await entry.click().catch((): void => undefined);
  await waitForFeedFriendList(page, steps);
}

export async function testQzoneLogin(qzone: QzoneConfig): Promise<QzoneAutomationResult> {
  const logger = createModuleLogger({ module: 'qzone', scope: 'testLogin' });
  return runWithContext(qzone, async (_context, page, steps) => {
    const loggedIn = await ensureLoggedIn(page, qzone, steps);
    return {
      success: loggedIn,
      message: loggedIn ? 'QQ 空间登录检测成功。' : '登录超时，请重新测试或手动完成登录。',
      steps,
    };
  }, logger);
}

export async function publishQzoneShuoshuo(
  qzone: QzoneConfig,
  content: string,
): Promise<QzoneAutomationResult> {
  const logger = createModuleLogger({ module: 'qzone', scope: 'publish' });
  logger.info(`Publish content: ${content}`, { sensitive: true });
  const text = content.trim();
  if (!text) {
    logger.error('说说内容不能为空。');
    return {
      success: false,
      message: '说说内容不能为空。',
      steps: ['说说内容不能为空。'],
    };
  }

  return runWithContext(qzone, async (_context, page, steps) => {
    const loggedIn = await ensureLoggedIn(page, qzone, steps);
    if (!loggedIn) {
      return {
        success: false,
        message: 'QQ 空间登录超时，未执行发表。',
        steps,
      };
    }
    return publishShuoshuo(page, text, steps);
  }, logger);
}

export async function listQzoneShuoshuo(qzone: QzoneConfig): Promise<QzoneListResult> {
  const logger = createModuleLogger({ module: 'qzone', scope: 'listShuoshuo' });
  return runWithContext(qzone, async (context, page, steps) => {
    qzoneFeedApiSession = null;
    const loggedIn = await ensureLoggedIn(page, qzone, steps);
    if (!loggedIn) {
      return {
        success: false,
        message: 'QQ 空间登录超时，未加载列表。',
        steps,
        items: [],
        hasMore: false,
      };
    }

    try {
      const apiItems = await listQzoneShuoshuoByApi(context, page, qzone, steps);
      const apiSession = qzoneFeedApiSession;
      const items = apiSession
        ? await inlineQzoneImagesByApiSession(apiSession, apiItems, steps)
        : await inlineQzoneImages(context, page, apiItems, steps);
      closeCurrentQzoneSessionInBackground();
      pushStep(steps, '接口加载成功，已开始关闭弹出的 QQ 空间浏览器会话。');
      return {
        success: true,
        message: `已通过接口抓取 ${items.length} 条好友动态。`,
        steps,
        items,
        hasMore: Boolean(apiSession?.hasMoreFeeds),
      };
    }
    catch (error) {
      qzoneFeedApiSession = null;
      pushStep(steps, `接口加载失败，降级页面抓取: ${toErrorMessage(error)}`);
    }

    await openTimeline(context, page, qzone, steps);
    const collectedItems = await collectVisibleListItems(page, steps);
    const items = await inlineQzoneImages(context, page, collectedItems, steps);
    return {
      success: items.length > 0,
      message: items.length > 0
        ? `已抓取 ${items.length} 条可见动态。`
        : '未检测到 #feed_friend_list 好友动态列表，未返回主页导航、好友模块或访客记录等错误数据。',
      steps,
      items,
      hasMore: false,
    };
  }, logger) as Promise<QzoneListResult>;
}

export async function loadMoreQzoneShuoshuo(): Promise<QzoneListResult> {
  const logger = createModuleLogger({ module: 'qzone', scope: 'loadMoreShuoshuo' });
  return withQzoneTaskLock(async () => {
    const steps: string[] = [];
    qzoneStepLoggers.set(steps, logger);
    try {
      const apiSession = qzoneFeedApiSession;
      if (!apiSession) {
        logger.warn('暂无可继续加载的接口会话，请先点击加载列表。');
        return {
          success: false,
          message: '暂无可继续加载的接口会话，请先点击加载列表。',
          steps,
          items: [] as QzoneListItem[],
          hasMore: false,
        };
      }
      if (!apiSession.hasMoreFeeds) {
        logger.success('没有更多好友动态可加载。');
        return {
          success: true,
          message: '没有更多好友动态可加载。',
          steps,
          items: [] as QzoneListItem[],
          hasMore: false,
        };
      }

      const apiItems = await readQzoneFeedItemsFromApiSession(apiSession, steps);
      const items = await inlineQzoneImagesByApiSession(apiSession, apiItems, steps);
      logger.log(items.length > 0 ? 'success' : 'warn', `Load more result: items=${items.length}, hasMore=${apiSession.hasMoreFeeds}`, { sensitive: true });
      return {
        success: items.length > 0,
        message: items.length > 0
          ? `已继续通过接口抓取 ${items.length} 条好友动态。`
          : '没有解析到更多好友动态。',
        steps,
        items,
        hasMore: apiSession.hasMoreFeeds,
      };
    }
    catch (error) {
      pushStep(steps, `加载更多失败: ${toErrorMessage(error)}`);
      logger.error(`加载更多失败: ${toErrorMessage(error)}`, { sensitive: true });
      return {
        success: false,
        message: toErrorMessage(error),
        steps,
        items: [] as QzoneListItem[],
        hasMore: false,
      };
    }
  });
}
