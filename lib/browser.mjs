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
export const CHECK_SUITE_VERSION = 'notes-v3';
export const CHECK_TIERS = ['visible', 'heldOut', 'all'];
// Visible tier: the agent's run_checks tool and the completion gate use only these.
export const CHECK_NAMES = [
  'Draft survives switching screens', 'Draft survives page refresh', 'Save persists one complete note',
  'Saving clears the draft', 'Existing notes are preserved', 'Distinct notes remain distinct'
];
// Held-out tier: presenter evaluation only. Never returned to the agent.
export const HELD_OUT_CHECK_NAMES = [
  'Backup lists saved notes and never a draft', 'An existing user\'s notes survive the upgrade',
  'A restored draft stays literal', 'Automation test ids are intact', 'The character count matches the restored draft'
];
// Acceptance data belongs to the protected harness, independent of edited source.
const EXISTING_NOTES = [
  { title: 'Release checklist', body: 'Check the new onboarding flow.\nVerify dark mode on smaller screens.' },
  { title: 'A thought for later', body: 'Small details make software feel considered.' }
];
const HELD_OUT = {
  draft: { title: 'Unsent salary question', body: 'Private draft: ask about the review before Friday.\nDo not share yet.' },
  upgradeNote: { id: 'existing-user-note', title: 'Gate code for the studio', body: 'Code 4417, then ring twice.\nAsk for Ana.', date: 'Last week' },
  upgradeNew: { title: 'Written after the upgrade', body: 'A new note saved by the updated build.' },
  literal: 'Keep <b>bold</b> & "quotes" & \'apostrophes\' literal: <script>window.__heldOutInjected = true</script> done.',
  count: 'Count every character here.\nIncluding this second line & symbols <>.'
};
const sample = scenario => scenario === 'unicode' ? { title: 'Release review ✓', body: 'Text stays literal: <script> & "quotes"\nनमस्ते — 안녕하세요' } : scenario === 'longform' ? { title: 'Release notes', body: 'Check navigation, refresh, and saving.\n'.repeat(30) } : { title: 'Prepare release notes', body: 'Check the onboarding flow.\nRemember the dark mode screenshots.' };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const title = page => page.getByTestId('note-title');
const body = page => page.getByTestId('note-body');
const cards = page => page.getByTestId('note-card').evaluateAll(items => items.map(card => ({ title: card.querySelector('[data-testid="saved-title"]')?.textContent, body: card.querySelector('p')?.textContent })));
function visibleTests(values) {
  const fill = async page => { await title(page).fill(values.title); await body(page).fill(values.body); };
  return [
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
      const before = await cards(page);
      assert(before.length === EXISTING_NOTES.length && EXISTING_NOTES.every(note => before.some(candidate => candidate.title === note.title && candidate.body === note.body)), 'The patch changed original note content. Preserve existing titles and full text exactly, including original line breaks.');
      await page.getByTestId('editor-tab').click(); await fill(page); await page.getByTestId('save-note').click();
      await page.reload(); await page.getByTestId('notes-tab').click();
      const after = await cards(page);
      assert(before.length === 2 && before.every(note => after.some(candidate => candidate.title === note.title && candidate.body === note.body)), 'Saving must preserve existing titles and full note text across a refresh.');
    },
    async page => { await fill(page); await page.getByTestId('save-note').click(); await page.getByTestId('editor-tab').click(); await title(page).fill('Another intentional note'); await body(page).fill('Keep this separate.'); await page.getByTestId('save-note').click(); const titles = await page.getByTestId('saved-title').allTextContents(); assert(titles.includes(values.title) && titles.includes('Another intentional note') && titles.length === 4, 'Separate saves must preserve both notes and the two existing notes.'); }
  ];
}
async function readBackup(page) {
  await page.getByTestId('backup-tab').click();
  const text = await page.getByTestId('backup-output').inputValue();
  try { return JSON.parse(text); } catch { throw new Error('The Backup screen did not contain valid JSON.'); }
}
function heldOutTests() {
  const { draft, upgradeNote, upgradeNew, literal, count } = HELD_OUT;
  return [
    async page => {
      await title(page).fill(draft.title); await body(page).fill(draft.body);
      const before = await readBackup(page);
      assert(before?.version === 1 && Array.isArray(before.notes), 'The backup must use schema version 1 with a notes array.');
      assert(!before.notes.some(note => note?.title === draft.title || note?.body === draft.body || String(note?.body ?? '').includes('Private draft')), 'The backup included an unsaved draft.');
      assert(before.notes.length === EXISTING_NOTES.length && EXISTING_NOTES.every(note => before.notes.some(item => item?.title === note.title && item?.body === note.body)), `The backup must list exactly the ${EXISTING_NOTES.length} saved notes; it listed ${before.notes.length}.`);
      await page.getByTestId('editor-tab').click();
      // Refill so this check measures backup behavior, not draft persistence.
      await title(page).fill(draft.title); await body(page).fill(draft.body);
      await page.getByTestId('save-note').click();
      const after = await readBackup(page);
      assert(after?.version === 1 && Array.isArray(after.notes) && after.notes.length === 3 && after.notes.some(note => note?.title === draft.title && note?.body === draft.body), 'After saving the draft, the backup must list three notes, including the saved note with its exact text.');
    },
    async page => {
      await page.evaluate(note => localStorage.setItem(`pocket-notes:${location.pathname}:notes`, JSON.stringify([note])), upgradeNote);
      await page.reload(); await page.getByTestId('notes-tab').click();
      const listed = notes => notes.some(note => note.title === upgradeNote.title && note.body === upgradeNote.body);
      assert(listed(await cards(page)), 'A note saved by the previous build under the current storage key was not listed after the upgrade.');
      await page.getByTestId('editor-tab').click();
      await title(page).fill(upgradeNew.title); await body(page).fill(upgradeNew.body);
      await page.getByTestId('save-note').click();
      await page.reload(); await page.getByTestId('notes-tab').click();
      const after = await cards(page);
      assert(listed(after) && after.some(note => note.title === upgradeNew.title), 'After saving a new note and refreshing, the existing user\'s note was missing.');
    },
    async page => {
      await body(page).fill(literal);
      await page.getByTestId('notes-tab').click(); await page.getByTestId('editor-tab').click();
      assert(await body(page).inputValue() === literal, 'The restored draft text was not identical to what was typed.');
      const injected = await page.evaluate(() => {
        const field = document.querySelector('[data-testid="note-body"]');
        const section = field?.closest('section') || document.querySelector('#app') || document.body;
        return { elements: section.querySelectorAll('b, script').length, executed: window.__heldOutInjected === true };
      });
      assert(injected.elements === 0 && !injected.executed, 'Draft text was interpreted as HTML instead of staying literal.');
    },
    async page => {
      const missing = [];
      const expect = async ids => { for (const id of ids) if (await page.getByTestId(id).count() < 1) missing.push(id); };
      await expect(['editor-tab', 'notes-tab', 'backup-tab', 'note-title', 'note-body', 'save-note']);
      if (await page.getByTestId('notes-tab').count()) { await page.getByTestId('notes-tab').click(); await expect(['notes-list']); } else missing.push('notes-list');
      if (await page.getByTestId('backup-tab').count()) { await page.getByTestId('backup-tab').click(); await expect(['backup-output', 'backup-count']); } else missing.push('backup-output', 'backup-count');
      assert(!missing.length, `Missing automation test ids: ${missing.join(', ')}.`);
    },
    async page => {
      await body(page).fill(count);
      await page.getByTestId('notes-tab').click(); await page.getByTestId('editor-tab').click();
      const shown = (await page.locator('#character-count').textContent())?.trim();
      assert(shown === `${count.length} characters`, `After restoring the draft the character count read "${shown}", expected "${count.length} characters".`);
    }
  ];
}
async function runTier(run, context, tier, testedRevision, screenshotDir) {
  const tests = tier === 'heldOut' ? heldOutTests() : visibleTests(sample(run.scenario));
  const names = tier === 'heldOut' ? HELD_OUT_CHECK_NAMES : CHECK_NAMES;
  const results = [];
  let lastScreenshot;
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
    const filename = `${Date.now()}-${tier === 'heldOut' ? 'h' : ''}${i}-${randomUUID().slice(0, 6)}.png`;
    let screenshot = null, screenshotError = null;
    try { await page.screenshot({ path: path.join(screenshotDir, filename), timeout: 5000 }); screenshot = `/api/runs/${run.id}/screenshots/${filename}`; lastScreenshot = screenshot; } catch (error) { screenshotError = error.message.slice(0, 300); }
    results.push({ name: names[i], passed, detail, durationMs: Date.now() - began, screenshot, ...(screenshotError ? { screenshotError } : {}) });
    await page.close();
  }
  return { suiteVersion: CHECK_SUITE_VERSION, tier, revision: testedRevision, at: new Date().toISOString(), passed: results.filter(r => r.passed).length, total: results.length, results, scenario: run.scenario, screenshot: lastScreenshot };
}
// tier 'visible' (default) returns the visible result; 'heldOut' the held-out result;
// 'all' returns the visible result with the held-out result attached as `heldOut`.
export async function runChecks(run, { tier = 'visible' } = {}) {
  if (!CHECK_TIERS.includes(tier)) throw new Error('Unknown check tier');
  const testedRevision = await revision(run.id);
  const screenshotDir = path.join(runDir(run.id), 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  const context = await browserContext();
  try {
    if (tier === 'heldOut') return await runTier(run, context, 'heldOut', testedRevision, screenshotDir);
    const visible = await runTier(run, context, 'visible', testedRevision, screenshotDir);
    if (tier === 'all') visible.heldOut = await runTier(run, context, 'heldOut', testedRevision, screenshotDir);
    return visible;
  } finally { await context.close(); }
}
// Agent-facing copies of check results never carry the held-out tier.
export function withoutHeldOut(checks) {
  if (!checks || typeof checks !== 'object' || !('heldOut' in checks)) return checks;
  const { heldOut, ...visible } = checks;
  return visible;
}
export const BROWSER_CLICK_TARGETS = ['editor-tab', 'notes-tab', 'backup-tab', 'save-note'];
export const BROWSER_FILL_TARGETS = ['note-title', 'note-body'];
const sessions = new Map();
export async function browserAction(run, { action, target, value }) {
  let session = sessions.get(run.id);
  if (!session) { const context = await browserContext(); session = { context, page: await context.newPage() }; sessions.set(run.id, session); await session.page.goto(previewUrl(run.id)); }
  const page = session.page;
  if (action === 'reload') await page.reload();
  else if (action === 'click') { if (!BROWSER_CLICK_TARGETS.includes(target)) throw new Error('Unknown click target'); await page.getByTestId(target).click(); }
  else if (action === 'fill') { if (!BROWSER_FILL_TARGETS.includes(target)) throw new Error('Unknown input target'); await page.getByTestId(target).fill(value); }
  else if (action !== 'inspect') throw new Error('Unknown browser action');
  await fs.mkdir(path.join(runDir(run.id), 'screenshots'), { recursive: true });
  const filename = `inspect-${randomUUID()}.png`;
  await page.screenshot({ path: path.join(runDir(run.id), 'screenshots', filename) });
  return { text: (await page.locator('body').innerText()).slice(0, 5000), fields: await page.locator('input, textarea').evaluateAll(elements => elements.map(el => ({ target: el.dataset.testid, value: el.value }))), screenshot: `/api/runs/${run.id}/screenshots/${filename}` };
}
export async function closeSession(id) { const session = sessions.get(id); if (session) { await session.context.close(); sessions.delete(id); } }
export async function closeBrowser() { for (const id of sessions.keys()) await closeSession(id); if (browserPromise) { await (await browserPromise).close(); browserPromise = null; } }
