// Captures real dashboard screens of recorded harness v4 runs for the workshop deck.
// Read-only against the local server: it never starts a model run, never opens the
// model setup dialog and never touches the pristine fixture. The only writes are the
// presenter's own trap checks typed into a run's published production copy, which
// live in this script's throwaway browser profile.
//
// Usage: npm start (in another terminal), then
//   node presentation/capture-v4.mjs [--origin http://127.0.0.1:4318] [--out presentation/assets/v4]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : null).filter(Boolean));
const origin = args.origin || 'http://127.0.0.1:4318';
const out = path.resolve(args.out || path.join(here, 'assets/v4'));
await fs.mkdir(out, { recursive: true });

// Recorded runs from live-validation/v4/RESULTS.md (26 October 2026, cohere/north-mini-code:free).
const WANT = {
  minimal: 'd13b50fa',          // Minimal, draft: budget exceeded, 6/6 visible, 5/5 held-out, nothing published
  verification: 'd017cd57',     // +Verification, draft: completed, applied automatically without review
  engineered: '5794a37d',       // Engineered, draft: waited for approval, approved after diff inspection
  resetMemory: 'b4feef72',      // +Memory, draft, forced reset after call 8: handoff restored, budget stop
  resetVerification: 'b1f14631' // +Verification, draft, forced reset after call 8: no handoff, budget stop
};
const state = await (await fetch(origin + '/api/state')).json();
const byPrefix = prefix => state.runs.find(run => run.id.startsWith(prefix));
const runs = Object.fromEntries(Object.entries(WANT).map(([key, prefix]) => [key, byPrefix(prefix)]));
for (const [key, run] of Object.entries(runs)) if (!run) throw new Error(`Recorded run ${WANT[key]} is not in this server's data directory.`);
const manifest = {
  capturedAt: new Date().toISOString(), origin, checkSuiteVersion: state.checkSuiteVersion,
  viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  runs: Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, { id: r.id, status: r.status, scenario: r.scenario, model: r.provider?.model, createdAt: r.createdAt, appliedAt: r.appliedAt || null, resetAfterCalls: r.resetAfterCalls ?? null, calls: r.usage?.calls }])),
  files: {}
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'en-GB' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const delay = ms => new Promise(r => setTimeout(r, ms));
const record = (file, note, run) => { manifest.files[file] = { note, run: run?.id || null, status: run?.status || null }; };
async function shot(locator, file, note, run) {
  await locator.first().scrollIntoViewIfNeeded();
  await delay(250);
  await locator.first().screenshot({ path: path.join(out, file), animations: 'disabled' });
  record(file, note, run);
  console.log('captured', file);
}
async function selectRun(run, view = 'workbench') {
  await page.goto(`${origin}/#${view}`);
  await page.evaluate(id => sessionStorage.setItem('harness-selected-run', id), run.id);
  await page.reload();
  await page.waitForFunction(id => document.querySelector('#run-number')?.textContent.includes(id.slice(0, 8).toUpperCase()), run.id);
  if (view === 'workbench') {
    await page.waitForFunction(() => document.querySelector('#preview-placeholder')?.hidden && document.querySelector('#production-placeholder')?.hidden, null, { timeout: 30000 }).catch(() => console.warn('phone placeholders still visible'));
    await delay(600);
  }
  await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.remove()));
}
async function openModal(trigger) {
  await trigger.click();
  await page.waitForFunction(() => document.querySelector('#modal')?.open);
  await delay(300);
}
async function closeModal() { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#modal')?.open); }
async function tallViewport(on) { await page.setViewportSize({ width: 1440, height: on ? 1600 : 900 }); await delay(200); }
// Scroll a scrollable <pre> so that the first occurrence of `needle` is near its top.
async function scrollPreTo(locator, needle) {
  await locator.evaluate((el, text) => {
    // Walk the text nodes to the first occurrence and measure its position with a Range.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let offset = 0, node;
    while ((node = walker.nextNode())) {
      const index = node.data.indexOf(text);
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index); range.setEnd(node, index + text.length);
        const top = range.getBoundingClientRect().top - el.getBoundingClientRect().top;
        el.scrollTop += top - 10;
        return;
      }
      offset += node.data.length;
    }
  }, needle);
  await delay(150);
}
const production = page.frameLocator('#production-frame');

// 1. Minimal: two enabled components, budget stop, original production build, Backup screen of the starting app.
await selectRun(runs.minimal);
await shot(page.locator('.experiment-card'), 'minimal-status.png', 'Run header: Minimal harness, Budget reached, 24 model calls', runs.minimal);
await shot(page.locator('.anatomy-board'), 'minimal-anatomy.png', 'Anatomy board: Agent loop and Tools & sandbox enabled, five cards off', runs.minimal);
await shot(page.locator('#phone-stage'), 'minimal-phones.png', 'Sandbox and production phones; production banner: Original build. No change applied.', runs.minimal);
await production.getByTestId('backup-tab').click();
await delay(400);
await shot(page.locator('#production-phone'), 'fixture-backup-production.png', 'Production phone (original build) on the Backup screen of the starting app', runs.minimal);
await production.getByTestId('editor-tab').click();
await shot(page.locator('.verification-card'), 'minimal-verification.png', 'Verification card after presenter evaluation: visible and held-out tiers', runs.minimal);
await tallViewport(true);
await openModal(page.locator('#explain-run'));
await shot(page.locator('#modal'), 'minimal-explain.png', 'Explain & compare opened on the Minimal run', runs.minimal);
await closeModal();
await tallViewport(false);

// 2. +Verification: the first rung that finished; applied automatically to production with no review.
await selectRun(runs.verification);
await shot(page.locator('.experiment-card'), 'verification-status.png', 'Run header: Custom harness (+Verification), Completed, 10 model calls', runs.verification);
await shot(page.locator('.anatomy-board'), 'verification-anatomy.png', 'Anatomy board: Agent loop, Tools & sandbox and Verification enabled', runs.verification);
await shot(page.locator('#phone-stage'), 'verification-phones.png', 'Production banner: Updated automatically by the agent. No review.', runs.verification);
// Presenter trap checks on the published production copy (manual actions, recorded here as such).
await production.getByTestId('note-body').fill('Presenter draft typed on production');
await production.getByTestId('notes-tab').click();
await delay(250);
await production.getByTestId('editor-tab').click();
await delay(300);
await shot(page.locator('#production-phone'), 'verification-production-draft-after-switch.png', 'Presenter typed a draft on production, switched to My notes and back', runs.verification);
await production.getByTestId('backup-tab').click();
await delay(400);
await shot(page.locator('#production-phone'), 'verification-production-backup.png', 'Backup screen on production while an unsaved presenter draft exists', runs.verification);
await production.getByTestId('editor-tab').click();
await production.getByTestId('note-body').fill('<b>bold</b> & co');
await production.getByTestId('notes-tab').click();
await delay(250);
await production.getByTestId('editor-tab').click();
await delay(300);
await shot(page.locator('#production-phone'), 'verification-production-literal.png', 'Presenter typed markup into the draft on production and switched screens', runs.verification);
await production.getByTestId('note-body').fill('');
await shot(page.locator('.verification-card'), 'verification-verification.png', 'Verification card after presenter evaluation', runs.verification);
await tallViewport(true);
await openModal(page.locator('#claims-button'));
await shot(page.locator('#modal'), 'verification-claims.png', 'What it claimed, what was observed', runs.verification);
await closeModal();
await tallViewport(false);
// Activity rows around the agent's own run_checks calls.
const firstChecks = page.locator('.event-row').filter({ hasText: 'Tool: run_checks' }).first();
await firstChecks.evaluate(el => el.scrollIntoView({ block: 'start' }));
await delay(200);
await shot(page.locator('#activity-content'), 'verification-activity-run-checks.png', 'Activity list scrolled to the first run_checks call by the agent', runs.verification);

// 3. Engineered: seven cards, approval boundary, approved publication, inputs comparison, ticket thread, diff.
await selectRun(runs.engineered);
await shot(page.locator('.experiment-card'), 'engineered-status.png', 'Run header: Engineered harness, Completed, 13 model calls', runs.engineered);
await shot(page.locator('.anatomy-board'), 'engineered-anatomy.png', 'Anatomy board: seven cards enabled, Guardrails approved & applied', runs.engineered);
await shot(page.locator('#phone-stage'), 'engineered-phones.png', 'Production banner: Updated after your approval.', runs.engineered);
await shot(page.locator('.verification-card'), 'engineered-verification.png', 'Verification card: 6/6 visible and 5/5 held-out after presenter evaluation', runs.engineered);
await shot(page.locator('#visible-check-group'), 'engineered-visible-checks.png', 'Checks the agent can run', runs.engineered);
await shot(page.locator('#heldout-check-group'), 'engineered-heldout-checks.png', 'Held-out checks (presenter only)', runs.engineered);
const approvalRow = page.locator('.event-row').filter({ hasText: 'Awaiting explicit approval' }).first();
await approvalRow.evaluate(el => el.scrollIntoView({ block: 'start' }));
await delay(200);
await shot(page.locator('#activity-content'), 'engineered-activity-approval.png', 'Activity list: awaiting approval, presenter evaluation, patch applied', runs.engineered);
await tallViewport(true);
await openModal(page.locator('#claims-button'));
await shot(page.locator('#modal'), 'engineered-claims.png', 'What it claimed, what was observed', runs.engineered);
await closeModal();
await openModal(page.locator('#view-diff'));
await page.waitForSelector('#modal .diff-panel');
await shot(page.locator('#modal'), 'engineered-diff.png', 'Reviewed diff: src/storage.js only', runs.engineered);
await shot(page.locator('#modal .diff-file').first(), 'engineered-diff-file.png', 'Reviewed diff of src/storage.js: before and after panels', runs.engineered);
// The AFTER panel's <pre> is wider than the dialog; clip the shot to the dialog's own box.
const dialogBox = await page.locator('#modal').boundingBox();
const afterBox = await page.locator('#modal .diff-panel:not(.before)').first().boundingBox();
await page.screenshot({ path: path.join(out, 'engineered-diff-after.png'), animations: 'disabled', clip: { x: dialogBox.x, y: afterBox.y, width: dialogBox.width, height: Math.min(afterBox.height, dialogBox.y + dialogBox.height - afterBox.y) } });
record('engineered-diff-after.png', 'Reviewed diff: the AFTER panel of src/storage.js, clipped to the dialog', runs.engineered);
await closeModal();
await openModal(page.locator('#explain-run'));
await page.waitForSelector('#inputs-comparison .inputs-column');
await shot(page.locator('#modal'), 'engineered-explain.png', 'Explain & compare: Minimal versus Engineered, same draft task and model', runs.engineered);
await shot(page.locator('#lesson-comparison'), 'engineered-comparison-table.png', 'Comparison table including the held-out row', runs.engineered);
await shot(page.locator('#inputs-comparison'), 'inputs-top.png', 'What each agent was told: top of both columns', runs.engineered);
await scrollPreTo(page.locator(`[data-inputs-run="${runs.engineered.id}"] pre`), 'Related ticket thread PN-142');
await shot(page.locator('#inputs-comparison'), 'inputs-ticket.png', 'What each agent was told: Engineered column scrolled to the PN-142 ticket thread', runs.engineered);
await shot(page.locator(`[data-inputs-run="${runs.minimal.id}"]`), 'inputs-minimal-column.png', 'What the Minimal agent was told (whole column)', runs.minimal);
await shot(page.locator(`[data-inputs-run="${runs.engineered.id}"]`), 'inputs-engineered-column-ticket.png', 'What the Engineered agent was told, scrolled to the PN-142 ticket thread', runs.engineered);
await closeModal();
await openModal(page.locator('[data-anatomy="context"]'));
await page.locator('#component-evidence').click();
await page.waitForSelector('#modal .evidence-readable');
await delay(200);
await shot(page.locator('#modal'), 'engineered-context-evidence-top.png', 'Context management evidence: repository map and revision', runs.engineered);
await scrollPreTo(page.locator('#modal .evidence-readable').first(), 'Related ticket thread PN-142');
await shot(page.locator('#modal'), 'engineered-context-evidence-ticket.png', 'Context management evidence scrolled to the PN-142 ticket thread', runs.engineered);
await closeModal();
await openModal(page.locator('[data-anatomy="instructions"]'));
await page.locator('#component-evidence').click();
await page.waitForSelector('#modal .evidence-readable');
await delay(200);
await shot(page.locator('#modal'), 'engineered-instructions-evidence.png', 'Instructions & policies evidence: the project rules sent', runs.engineered);
await closeModal();
await tallViewport(false);
await page.locator('#focus-toggle').click();
await delay(600);
await page.screenshot({ path: path.join(out, 'engineered-focus.png'), animations: 'disabled' });
record('engineered-focus.png', 'Focus demo layout at 1440x900 with both phones', runs.engineered);
await page.locator('#focus-toggle').click();

// 4. Forced reset: the reset event and the handoff supplied to session 2 (+Memory), and the no-handoff run.
await selectRun(runs.resetMemory);
await shot(page.locator('.experiment-card'), 'reset-memory-status.png', 'Run header: session 2 after a forced reset, Budget reached', runs.resetMemory);
const resetRow = page.locator('.event-row').filter({ hasText: 'Context limit reached: fresh session required' }).first();
await resetRow.evaluate(el => el.scrollIntoView({ block: 'start' }));
await delay(200);
await shot(page.locator('#activity-content'), 'reset-memory-activity.png', 'Activity list from the forced reset event onward (+Memory run)', runs.resetMemory);
await page.locator('.tab[data-panel="memory"]').click();
await delay(300);
await shot(page.locator('#memory-content'), 'reset-memory-handoff.png', 'Memory tab: saved note and the frozen handoff supplied to session 2', runs.resetMemory);
await page.locator('#memory-content .memory-section-title').first().evaluate(el => { const box = el.closest('#memory-content'); box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 12; });
await delay(200);
await shot(page.locator('#memory-content'), 'reset-memory-handoff-session2.png', 'Memory tab scrolled to the frozen handoff supplied to session 2', runs.resetMemory);
await page.locator('.tab[data-panel="activity"]').click();
await delay(200);
await tallViewport(true);
await openModal(resetRow);
await shot(page.locator('#modal'), 'reset-memory-event.png', 'The recorded reset event', runs.resetMemory);
await closeModal();
await tallViewport(false);
await selectRun(runs.resetVerification);
const resetRow2 = page.locator('.event-row').filter({ hasText: 'Context limit reached: fresh session required' }).first();
await resetRow2.evaluate(el => el.scrollIntoView({ block: 'start' }));
await delay(200);
await shot(page.locator('#activity-content'), 'reset-verification-activity.png', 'Activity list from the forced reset event onward (+Verification run, no handoff)', runs.resetVerification);
await page.locator('.tab[data-panel="memory"]').click();
await delay(300);
await shot(page.locator('#memory-content'), 'reset-verification-memory.png', 'Memory tab of the run without Memory: no handoff', runs.resetVerification);

// 5. Ladder scoreboard and evaluation summary.
await selectRun(runs.engineered, 'evals');
await page.waitForFunction(() => document.querySelectorAll('#ladder-body tr').length >= 5);
const options = await page.locator('#ladder-filter option').allInnerTexts();
console.log('ladder filters:', options);
const pick = async pattern => {
  const label = options.find(text => pattern.test(text));
  if (!label) throw new Error(`No ladder filter matches ${pattern}`);
  await page.locator('#ladder-filter').selectOption({ label });
  await delay(300);
  return label;
};
manifest.ladderFilters = {};
for (const [file, pattern] of [
  ['ladder-draft.png', /north-mini-code:free · The disappearing draft · Harness v4 · no forced reset/],
  ['ladder-draft-reset8.png', /north-mini-code:free · The disappearing draft · Harness v4 · reset after call 8/],
  ['ladder-unicode.png', /north-mini-code:free · Unicode & multiline · Harness v4 · no forced reset/],
  ['ladder-longform.png', /north-mini-code:free · Long-form writing · Harness v4 · no forced reset/]
]) {
  const label = await pick(pattern);
  manifest.ladderFilters[file] = label;
  await shot(page.locator('#ladder-section'), file, `Ladder scoreboard for ${label}`, null);
}
await shot(page.locator('#eval-summary'), 'eval-summary.png', 'Runs & evals summary tiles', null);

await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
console.log(`Wrote ${Object.keys(manifest.files).length} screenshots and manifest.json to ${out}`);
