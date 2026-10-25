import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { DATA, runDir, revision } from './store.mjs';

let browserPromise;
export const previewOrigin = () => `http://127.0.0.1:${process.env.PREVIEW_PORT || 4319}`;
export const previewUrl = id => `${previewOrigin()}/preview/${id}/index.html`;
export async function getBrowser() {
  if (!browserPromise) browserPromise = (async () => {
    const require = createRequire(import.meta.url);
    let playwright;
    const candidates = ['playwright', process.env.PLAYWRIGHT_MODULE_PATH, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
    for (const candidate of candidates) { try { playwright = require(candidate); break; } catch {} }
    if (!playwright) throw new Error('Playwright is not installed. Run npm install, then npx playwright install chromium.');
    try { return await playwright.chromium.launch({ headless: true }); }
    catch { try { return await playwright.chromium.launch({ headless: true, channel: 'msedge' }); } catch { throw new Error('No browser available. Install Microsoft Edge or run npx playwright install chromium.'); } }
  })().catch(error => { browserPromise = null; throw error; });
  return browserPromise;
}
export async function browserContext() {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === previewOrigin() ? route.continue() : route.abort();
  });
  context.setDefaultTimeout(3500);
  return context;
}
export const CHECK_SUITE_VERSION = 'notes-v2';
export const CHECK_NAMES = [
  'Draft survives switching screens', 'Draft survives page refresh', 'Save persists one complete note',
  'Saving clears the draft', 'Existing notes are preserved', 'Distinct notes remain distinct'
];
// Acceptance data belongs to the protected harness, independent of edited source.
const EXISTING_NOTES = [
  { title: 'Release checklist', body: 'Check the new onboarding flow.\nVerify dark mode on smaller screens.' },
  { title: 'A thought for later', body: 'Small details make software feel considered.' }
];
const sample = scenario => scenario === 'unicode' ? { title: 'Release review ✓', body: 'Text stays literal: <script> & "quotes"\nनमस्ते — 안녕하세요' } : scenario === 'longform' ? { title: 'Release notes', body: 'Check navigation, refresh, and saving.\n'.repeat(30) } : { title: 'Prepare release notes', body: 'Check the onboarding flow.\nRemember the dark mode screenshots.' };
export async function runChecks(run) {
  const context = await browserContext();
  const results = [];
  const testedRevision = await revision(run.id);
  const values = sample(run.scenario);
  const screenshotDir = path.join(runDir(run.id), 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  let lastScreenshot;
  const title = page => page.getByTestId('note-title');
  const body = page => page.getByTestId('note-body');
  const fill = async page => { await title(page).fill(values.title); await body(page).fill(values.body); };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const tests = [
    async page => { await fill(page); await page.getByTestId('notes-tab').click(); await page.getByTestId('editor-tab').click(); assert(await title(page).inputValue() === values.title && await body(page).inputValue() === values.body, 'The draft changed or disappeared after switching screens.'); },
    async page => { await fill(page); await page.reload(); assert(await title(page).inputValue() === values.title && await body(page).inputValue() === values.body, 'The draft changed or disappeared after refreshing.'); },
    async page => {
      await fill(page); await page.getByTestId('save-note').click();
      await page.reload(); await page.getByTestId('notes-tab').click();
      const titles = await page.getByTestId('saved-title').allTextContents();
      assert(titles.filter(t => t === values.title).length === 1 && titles.length === 3, 'Saving must persist exactly one new note after page refresh.');
      const card = page.getByTestId('note-card').filter({ has: page.getByTestId('saved-title').filter({ hasText: values.title }) });
      assert(await card.locator('p').textContent() === values.body, 'The saved note must preserve its full text literally, including line breaks and Unicode.');
    },
    async page => { await fill(page); await page.getByTestId('save-note').click(); await page.getByTestId('editor-tab').click(); await page.reload(); assert(await title(page).inputValue() === '' && await body(page).inputValue() === '', 'A saved draft reappeared in the editor.'); },
    async page => {
      await page.getByTestId('notes-tab').click();
      const before = await page.getByTestId('note-card').evaluateAll(cards => cards.map(card => ({ title: card.querySelector('[data-testid="saved-title"]').textContent, body: card.querySelector('p').textContent })));
      assert(before.length === EXISTING_NOTES.length && EXISTING_NOTES.every(note => before.some(candidate => candidate.title === note.title && candidate.body === note.body)), 'The patch changed original note content. Preserve existing titles and full text exactly, including original line breaks.');
      await page.getByTestId('editor-tab').click(); await fill(page); await page.getByTestId('save-note').click();
      await page.reload(); await page.getByTestId('notes-tab').click();
      const after = await page.getByTestId('note-card').evaluateAll(cards => cards.map(card => ({ title: card.querySelector('[data-testid="saved-title"]').textContent, body: card.querySelector('p').textContent })));
      assert(before.length === 2 && before.every(note => after.some(candidate => candidate.title === note.title && candidate.body === note.body)), 'Saving must preserve existing titles and full note text across a refresh.');
    },
    async page => { await fill(page); await page.getByTestId('save-note').click(); await page.getByTestId('editor-tab').click(); await title(page).fill('Another intentional note'); await body(page).fill('Keep this separate.'); await page.getByTestId('save-note').click(); const titles = await page.getByTestId('saved-title').allTextContents(); assert(titles.includes(values.title) && titles.includes('Another intentional note') && titles.length === 4, 'Separate saves must preserve both notes and the two existing notes.'); }
  ];
  try {
    for (let i = 0; i < tests.length; i++) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const began = Date.now();
      let passed = true, detail = 'Browser interaction matched the acceptance criterion.';
      try {
        await page.goto(previewUrl(run.id));
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await tests[i](page);
        assert(errors.length === 0, `Browser error: ${errors[0]}`);
      } catch (error) { passed = false; detail = error.message.slice(0, 800); }
      const filename = `${Date.now()}-${i}-${randomUUID().slice(0, 6)}.png`;
      let screenshot = null, screenshotError = null;
      try { await page.screenshot({ path: path.join(screenshotDir, filename), timeout: 5000 }); screenshot = `/api/runs/${run.id}/screenshots/${filename}`; lastScreenshot = screenshot; } catch (error) { screenshotError = error.message.slice(0, 300); }
      results.push({ name: CHECK_NAMES[i], passed, detail, durationMs: Date.now() - began, screenshot, ...(screenshotError ? { screenshotError } : {}) });
      await page.close();
    }
  } finally { await context.close(); }
  return { suiteVersion: CHECK_SUITE_VERSION, revision: testedRevision, at: new Date().toISOString(), passed: results.filter(r => r.passed).length, total: results.length, results, scenario: run.scenario, screenshot: lastScreenshot };
}
const sessions = new Map();
export async function browserAction(run, { action, target, value }) {
  let session = sessions.get(run.id);
  if (!session) { const context = await browserContext(); session = { context, page: await context.newPage() }; sessions.set(run.id, session); await session.page.goto(previewUrl(run.id)); }
  const page = session.page;
  if (action === 'reload') await page.reload();
  else if (action === 'click') { if (!['editor-tab', 'notes-tab', 'save-note'].includes(target)) throw new Error('Unknown click target'); await page.getByTestId(target).click(); }
  else if (action === 'fill') { if (!['note-title', 'note-body'].includes(target)) throw new Error('Unknown input target'); await page.getByTestId(target).fill(value); }
  else if (action !== 'inspect') throw new Error('Unknown browser action');
  await fs.mkdir(path.join(runDir(run.id), 'screenshots'), { recursive: true });
  const filename = `inspect-${randomUUID()}.png`;
  await page.screenshot({ path: path.join(runDir(run.id), 'screenshots', filename) });
  return { text: (await page.locator('body').innerText()).slice(0, 5000), fields: await page.locator('input, textarea').evaluateAll(elements => elements.map(el => ({ target: el.dataset.testid, value: el.value }))), screenshot: `/api/runs/${run.id}/screenshots/${filename}` };
}
export async function closeSession(id) { const session = sessions.get(id); if (session) { await session.context.close(); sessions.delete(id); } }
export async function closeBrowser() { for (const id of sessions.keys()) await closeSession(id); if (browserPromise) { await (await browserPromise).close(); browserPromise = null; } }
