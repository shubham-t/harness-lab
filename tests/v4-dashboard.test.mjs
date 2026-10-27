// v4 dashboard in a real browser against a TEST-ONLY scripted loopback provider.
// The scripted responses exercise transport, runtime and UI behavior, never live
// model quality. A recorded v3 run is copied into an isolated data directory so the
// claims panel is built from real recorded evidence. No live provider is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getBrowser, closeBrowser } from '../lib/browser.mjs';
import { correctStorage, draftInNotesStorage, draftInNotesApp, fixtureSource } from './support/reference-patches.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:4428';
const preview = 'http://127.0.0.1:4429';
const providerOrigin = 'http://127.0.0.1:4430';
const model = 'unit-test-model-v4-dashboard-only';
const key = 'unit-test-key-never-a-live-credential';
const recordedFile = path.join(root, 'live-validation/v3/minimal-e25d301f-60f1-46a2-aadf-93f595e3221c.json');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const qa = process.env.HARNESS_QA_DIR; // Optional screenshot directory for manual review.

test('v4 dashboard: production phone, held-out tier, claims, inputs and ladder', { timeout: 420000 }, async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-v4-dashboard-'));
  const recorded = JSON.parse(await fs.readFile(recordedFile, 'utf8'));
  // Copy (never move or edit) the recorded run into the isolated data directory.
  await fs.mkdir(path.join(data, 'runs', recorded.id), { recursive: true });
  await fs.writeFile(path.join(data, 'runs', recorded.id, 'run.json'), JSON.stringify({ ...recorded, history: [] }));
  const storage = await fixtureSource('src/storage.js'), app = await fixtureSource('src/app.js');
  const call = (name, args) => ({ name, args });
  let script = [];
  const requests = [], providerErrors = [], browserErrors = [], external = [];
  const provider = http.createServer(async (req, res) => {
    try {
      assert.equal(req.url, '/v1/responses');
      assert.equal(req.headers.authorization, `Bearer ${key}`);
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      requests.push(body);
      const step = script.shift();
      assert.ok(step, `Unexpected test provider request ${requests.length}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', call_id: `v4-dashboard-${requests.length}`, name: step.name, arguments: JSON.stringify(step.args) }], usage: { input_tokens: 13, output_tokens: 9 } }));
    } catch (error) {
      providerErrors.push(error.message);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: error.message } }));
    }
  });
  let child, output = '';
  t.after(async () => {
    await closeBrowser();
    if (child && child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      if (child.connected) child.send('unit-test-shutdown'); else child.kill();
      await Promise.race([exited, delay(5000)]);
      if (child.exitCode === null) { child.kill('SIGKILL'); await exited; }
    }
    provider.closeAllConnections();
    await new Promise(resolve => provider.close(resolve));
    await fs.rm(data, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => { provider.once('error', reject); provider.listen(4430, '127.0.0.1', resolve); });
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'unit-test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, HARNESS_DATA_DIR: data, PORT: '4428', PREVIEW_PORT: '4429', OPENAI_API_KEY: key, OPENAI_MODEL: model, OPENAI_BASE_URL: providerOrigin + '/v1', LLM_PROTOCOL: 'responses' }
  });
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const state = () => fetch(origin + '/api/state').then(response => response.json());
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) break;
    try { if (output.includes(`Harness Lab: ${origin}`) && (await state()).browser.available) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready, output);
  assert.deepEqual((await state()).runs.map(run => run.id), [recorded.id]);
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    if ([origin, preview].includes(new URL(route.request().url()).origin)) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  context.on('page', tab => tab.on('pageerror', error => browserErrors.push(error.message)));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(origin);
  await page.waitForFunction(id => document.querySelector('#run-number').textContent.includes(id.slice(0, 8).toUpperCase()), recorded.id);
  const runById = async id => (await state()).runs.find(run => run.id === id);
  const production = page.frameLocator('#production-frame');
  const shot = async name => { if (qa) { await fs.mkdir(qa, { recursive: true }); await page.screenshot({ path: path.join(qa, `v4-${name}.png`), fullPage: true }); } };
  const prepare = async preset => {
    const before = new Set((await state()).runs.map(run => run.id));
    await page.locator('#new-workspace').click();
    await page.locator(`[data-preset="${preset}"]`).click();
    await page.getByRole('button', { name: 'Prepare workspace' }).click();
    await page.waitForFunction(() => !document.querySelector('#modal').open);
    const created = (await state()).runs.find(run => !before.has(run.id));
    assert.ok(created);
    await page.waitForFunction(id => document.querySelector('#production-frame').src.includes(`/production/${id}/index.html?rev=original`), created.id);
    return created.id;
  };
  const evaluate = async () => {
    await page.getByRole('button', { name: 'Evaluate outcome', exact: true }).click();
    await page.waitForFunction(() => /\d+\/\d+ held-out/.test(document.querySelector('#checks-summary').textContent), null, { timeout: 90000 });
  };
  let minimalId, engineeredId;

  await t.test('claims panel is built from a recorded run: refresh claimed, never exercised', async () => {
    assert.equal(await page.locator('#claims-button').isVisible(), true);
    assert.equal(await page.locator('#production-banner').innerText(), 'Updated automatically by the agent at an unrecorded time. No review.');
    assert.equal(await page.locator('#production-banner').getAttribute('data-state'), 'automatic');
    assert.match(await page.locator('#production-frame').getAttribute('src'), new RegExp(`/production/${recorded.id}/index\\.html\\?rev=${recorded.appliedRevision}$`));
    assert.match(await page.locator('#checks-summary').innerText(), /6\/6 visible \(older test suite\) · held-out not measured/);
    assert.equal(await page.locator('#heldout-checks-summary').innerText(), 'not measured');
    await page.locator('#claims-button').click();
    assert.equal(await page.locator('#modal-title').innerText(), 'What it claimed, what was observed');
    const summary = recorded.events.findLast(e => e.kind === 'tool' && e.tool === 'request_completion').arguments.summary;
    assert.equal(await page.locator('#claims-summary').evaluate(el => el.textContent), summary, 'summary rendered verbatim');
    const row = id => page.locator(`#claims-table tr[data-claim="${id}"]`);
    assert.equal(await page.locator('#claims-table tbody tr').count(), 8);
    assert.match(await row('refresh').locator('td').nth(0).innerText(), /^No$/);
    assert.match(await row('switch').locator('td').nth(0).innerText(), /^Yes$/);
    assert.equal(await row('refresh').locator('td').nth(1).innerText(), 'tool not available');
    assert.match(await row('refresh').locator('td').nth(2).innerText(), /Pass · earlier suite notes-v2/);
    assert.match(await row('backup').locator('td').nth(2).innerText(), /not measured/);
    assert.equal(await page.locator('#claims-footer').innerText(), "Claims are the model's words. Observations are recorded tool actions. This panel does not interpret model reasoning.");
    await shot('claims-recorded');
    await page.keyboard.press('Escape');
  });

  await t.test('a ready workspace shows the original production build in its own phone', async () => {
    minimalId = await prepare('minimal');
    assert.equal(await page.locator('#production-banner').innerText(), 'Original build. No change applied.');
    assert.equal(await page.locator('#production-banner').getAttribute('data-state'), 'original');
    assert.equal(await page.locator('#claims-button').isVisible(), false);
    assert.match(await page.locator('#sandbox-phone .phone-label').innerText(), /^SANDBOX$/);
    assert.match(await page.locator('#production-phone .phone-label').innerText(), /^PRODUCTION$/);
    await production.getByTestId('backup-tab').click();
    assert.equal(await production.getByTestId('backup-count').innerText(), '2 notes');
    await production.getByTestId('editor-tab').click();
    assert.match(await page.locator('#checks-summary').innerText(), /Not run yet/);
    assert.equal(await page.locator('#heldout-check-grid .check-item').count(), 5);
  });

  await t.test('Minimal auto-applies to production; held-out checks expose what visible checks miss', async () => {
    script = [
      call('write_file', { path: 'src/storage.js', content: draftInNotesStorage(storage) }),
      call('write_file', { path: 'src/app.js', content: draftInNotesApp(app) }),
      call('browser_action', { action: 'fill', target: 'note-body', value: 'TEST ONLY scripted draft' }),
      call('browser_action', { action: 'click', target: 'notes-tab', value: '' }),
      call('browser_action', { action: 'click', target: 'editor-tab', value: '' }),
      call('request_completion', { summary: 'TEST ONLY scripted summary: the draft survives switching screens and page refresh.' })
    ];
    await page.locator('#run-button').click();
    await page.waitForFunction(() => document.querySelector('#run-button').textContent.includes('Published'), null, { timeout: 60000 });
    const run = await runById(minimalId);
    assert.equal(run.status, 'completed');
    assert.ok(run.appliedAt);
    await page.waitForFunction(() => document.querySelector('#production-banner').dataset.state === 'automatic');
    assert.match(await page.locator('#production-banner').innerText(), /^Updated automatically by the agent at .+\. No review\.$/);
    assert.match(await page.locator('#production-frame').getAttribute('src'), new RegExp(`\\?rev=${run.appliedRevision}$`));
    // The production phone serves the published copy: the draft survives, and the Backup screen leaks it.
    await production.getByTestId('note-body').fill('Production draft typed by the presenter');
    await production.getByTestId('notes-tab').click();
    await production.getByTestId('editor-tab').click();
    assert.equal(await production.getByTestId('note-body').inputValue(), 'Production draft typed by the presenter');
    await production.getByTestId('backup-tab').click();
    assert.match(await production.getByTestId('backup-output').inputValue(), /Production draft typed by the presenter/);
    await production.getByTestId('editor-tab').click();
    await page.locator('#claims-button').click();
    assert.match(await page.locator('#claims-table tr[data-claim="refresh"] td').nth(0).innerText(), /^No$/);
    assert.match(await page.locator('#claims-table tr[data-claim="switch"] td').nth(0).innerText(), /^Yes$/);
    await page.keyboard.press('Escape');
    await evaluate();
    assert.equal(await page.locator('#checks-summary').innerText(), '6/6 visible · 4/5 held-out');
    assert.equal(await page.locator('#heldout-checks-summary').innerText(), '4/5 passed · presenter evaluation');
    assert.match(await page.locator('[data-heldout-check="0"]').getAttribute('class'), /fail/);
    assert.match(await page.locator('[data-heldout-check="1"]').getAttribute('class'), /pass/);
    await page.locator('[data-heldout-check="0"]').click();
    assert.match(await page.locator('#modal-kicker').innerText(), /HELD-OUT/);
    assert.match(await page.locator('#modal-title').innerText(), /Backup lists saved notes and never a draft/);
    await page.keyboard.press('Escape');
    await shot('minimal-evaluated');
  });

  await t.test('Engineered waits for approval, then production updates after approval', async () => {
    engineeredId = await prepare('engineered');
    script = [
      call('write_file', { path: 'src/storage.js', content: correctStorage(storage) }),
      call('run_checks', {}),
      call('request_completion', { summary: 'TEST ONLY scripted summary after passing visible checks.' })
    ];
    await page.locator('#run-button').click();
    await page.waitForFunction(() => document.querySelector('#run-button').textContent.includes('Review proposed changes'), null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#production-banner').dataset.state === 'waiting');
    assert.equal(await page.locator('#production-banner').innerText(), 'Original build. One change is waiting for your approval.');
    assert.match(await page.locator('#production-frame').getAttribute('src'), /\?rev=original$/);
    assert.match(await page.locator('#checks-summary').innerText(), /^6\/6 visible · held-out not measured$/);
    await page.locator('#approve-button').click();
    await page.locator('#confirm-approve').click();
    await page.getByRole('link', { name: 'Open published app' }).waitFor();
    await page.keyboard.press('Escape');
    const run = await runById(engineeredId);
    assert.equal(run.status, 'completed');
    await page.waitForFunction(() => document.querySelector('#production-banner').dataset.state === 'approved');
    assert.match(await page.locator('#production-banner').innerText(), /^Updated after your approval at .+\.$/);
    assert.match(await page.locator('#production-frame').getAttribute('src'), new RegExp(`\\?rev=${run.appliedRevision}$`));
    await production.getByTestId('note-body').fill('Approved production draft');
    await production.getByTestId('notes-tab').click();
    await production.getByTestId('editor-tab').click();
    assert.equal(await production.getByTestId('note-body').inputValue(), 'Approved production draft');
    await evaluate();
    assert.equal(await page.locator('#checks-summary').innerText(), '6/6 visible · 5/5 held-out');
    await shot('engineered-approved');
  });

  await t.test('Explain & compare shows held-out results and what each agent was told', async () => {
    await page.locator('#explain-run').click();
    assert.match(await page.locator('.lesson-results').evaluate(el => el.textContent), /Held-out checks \(presenter only\)5\/5 held-out checks passed/, 'the collapsed explanation lists the held-out result');
    assert.equal(await page.locator('#compare-run').inputValue(), minimalId);
    const heldRow = page.locator('#lesson-comparison tr').filter({ hasText: 'Held-out checks (presenter only)' });
    assert.deepEqual(await heldRow.locator('td').allInnerTexts(), ['4/5 held-out checks passed', '5/5 held-out checks passed']);
    const columns = page.locator('#inputs-comparison [data-inputs-run]');
    assert.equal(await columns.count(), 2);
    const runs = (await state()).runs;
    for (const id of [minimalId, engineeredId]) {
      const prompt = runs.find(run => run.id === id).events.find(event => event.kind === 'prompt');
      const column = page.locator(`#inputs-comparison [data-inputs-run="${id}"]`);
      assert.equal(await column.locator('[data-chars="instructions"]').innerText(), prompt.instructions.length.toLocaleString('en-US'));
      assert.equal(await column.locator('[data-chars="task"]').innerText(), prompt.task.length.toLocaleString('en-US'));
      // HTML parsing normalizes CRLF to LF in rendered text; the counts above are of the exact recorded payload.
      assert.equal(await column.locator('pre').evaluate(el => el.textContent), `${prompt.instructions}\n\n--- Task ---\n${prompt.task}`.replace(/\r\n?/g, '\n'));
    }
    assert.match(await page.locator(`[data-inputs-run="${engineeredId}"] pre`).innerText(), /Related ticket thread PN-142, supplied by the harness/);
    assert.doesNotMatch(await page.locator(`[data-inputs-run="${minimalId}"] pre`).innerText(), /PN-142/);
    await shot('explain-compare');
    await page.keyboard.press('Escape');
  });

  await t.test('both phones fit in Focus mode at presentation sizes', async () => {
    await page.locator('#focus-toggle').click();
    for (const [width, height] of [[1280, 720], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      await delay(300);
      if (qa) await page.screenshot({ path: path.join(qa, `v4-focus-${width}.png`) });
      const layout = await page.evaluate(() => {
        const rect = el => el.getBoundingClientRect().toJSON();
        return { stage: rect(document.querySelector('#phone-stage')), phones: [...document.querySelectorAll('#phone-stage .phone-shell')].map(rect), banner: rect(document.querySelector('#production-banner')), labels: [...document.querySelectorAll('#phone-stage .phone-label')].map(rect), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.overflow, false, `Horizontal overflow at ${width}x${height}`);
      assert.equal(layout.phones.length, 2);
      for (const box of [...layout.phones, layout.banner, ...layout.labels]) {
        assert.ok(box.left >= layout.stage.left - 0.5 && box.right <= layout.stage.right + 0.5 && box.top >= layout.stage.top - 0.5 && box.bottom <= layout.stage.bottom + 0.5 && box.bottom <= height, `Outside the phone stage at ${width}x${height}: ${JSON.stringify({ box, stage: layout.stage })}`);
      }
      for (const box of layout.phones) assert.ok(box.width >= 180 && box.height >= 180, `Phone too small at ${width}x${height}: ${JSON.stringify(box)}`);
      const run = await page.locator('#run-button').boundingBox();
      assert.ok(run.y > 0 && run.y + run.height <= height, `Run button outside ${width}x${height}`);
    }
    await page.locator('#focus-toggle').click();
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  await t.test('ladder scoreboard is built from evaluation groups with empty unmeasured cells', async () => {
    await page.locator('[data-view="evals"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#ladder-filter option').length === 2);
    const label = await page.locator('#ladder-filter option:checked').innerText();
    assert.match(label, new RegExp(`${model} · The disappearing draft · Harness v4 · no forced reset`));
    assert.deepEqual(await page.locator('#ladder-body tr').evaluateAll(rows => rows.map(row => row.dataset.rung)), ['minimal', 'verification', 'instructions-context', 'memory', 'engineered']);
    const cells = async rung => page.locator(`#ladder-body tr[data-rung="${rung}"] td`).evaluateAll(tds => tds.slice(1).map(td => td.textContent));
    assert.deepEqual(await cells('minimal'), ['1', '1/1', '1/1', '0/1', '1/1', '1/1', '6', '132']);
    assert.deepEqual(await cells('engineered'), ['1', '1/1', '1/1', '1/1', '0/1', '0/1', '3', '66']);
    assert.deepEqual(await cells('verification'), ['0', '', '', '', '', '', '', '']);
    assert.equal(await page.locator('#ladder-body tr[data-rung="memory"] td.empty-cell').count(), 7);
    await page.locator('#ladder-filter').selectOption({ index: 1 });
    assert.match(await page.locator('#ladder-filter option:checked').innerText(), /Harness v3/);
    const historical = await cells('minimal');
    assert.equal(historical[0], '1');
    assert.match(historical[2], /1\/1 on notes-v2 \(historical\)/);
    assert.equal(historical[3], '', 'no held-out tier was measured in v3');
    assert.deepEqual(await cells('engineered'), ['0', '', '', '', '', '', '', '']);
    await shot('ladder');
    await page.locator('[data-view="workbench"]').click();
  });

  await t.test('a forced reset is labelled as Agent loop and keeps a disabled Memory card dark', async () => {
    const before = new Set((await state()).runs.map(run => run.id));
    await page.locator('#new-workspace').click();
    await page.locator('[data-preset="minimal"]').click();
    await page.locator('#reset-after').fill('2');
    await page.getByRole('button', { name: 'Prepare workspace' }).click();
    await page.waitForFunction(() => !document.querySelector('#modal').open);
    const created = (await state()).runs.find(run => !before.has(run.id));
    assert.equal(created.resetAfterCalls, 2);
    script = [
      call('write_file', { path: 'src/storage.js', content: correctStorage(storage) }),
      call('browser_action', { action: 'inspect', target: '', value: '' }),
      call('request_completion', { summary: 'TEST ONLY scripted summary after a forced reset.' })
    ];
    await page.locator('#run-button').click();
    await page.waitForFunction(() => document.querySelector('#run-button').textContent.includes('Published'), null, { timeout: 60000 });
    const run = await runById(created.id);
    assert.equal(run.session, 2);
    assert.equal(run.events.filter(event => event.kind === 'reset').length, 1);
    const resetRow = page.locator('.event-row').filter({ hasText: 'Context limit reached: fresh session required' });
    assert.match(await resetRow.locator('.event-label').innerText(), /Agent loop · forced reset/i);
    assert.match(await page.locator('[data-anatomy="memory"]').getAttribute('class'), /limited/);
    assert.doesNotMatch(await page.locator('[data-anatomy="memory"]').getAttribute('class'), /highlight/);
    await page.locator('#run-details').click();
    assert.match(await page.locator('#modal-body').innerText(), /After model call 2 · recorded after call 2/);
    await page.keyboard.press('Escape');
    await page.locator('#explain-run').click();
    assert.match(await page.locator('#modal-body').innerText(), /No matching opposite-preset/, 'a reset run is never compared with an uninterrupted run');
    await page.keyboard.press('Escape');
  });

  await t.test('no browser errors, no external requests, provider script fully consumed', async () => {
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(external, []);
    assert.deepEqual(providerErrors, []);
    assert.deepEqual(script, []);
    assert.equal(requests.length, 12);
    assert.equal(await fs.readFile(path.join(root, 'fixtures/notes/src/storage.js'), 'utf8'), storage, 'fixture untouched');
  });
});
