// Harness builder page, live mode (docs/BUILDER.md, package E). The unmodified
// server on ports 4458/4459 talks to a deliberately scripted, TEST-ONLY loopback
// provider on 4460; Chromium drives the real page. Nothing produced here is model
// evidence, and the temporary recording must come out byte-for-byte unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { builderRecording } from './support/builder-recording.mjs';
import { correctStorage, fixtureSource } from './support/reference-patches.mjs';

const origin = 'http://127.0.0.1:4458';
const preview = 'http://127.0.0.1:4459';
const providerOrigin = 'http://127.0.0.1:4460';
const testKey = 'unit-test-only-builder-live-no-real-credential';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// The smallest valid PNG: 1×1 transparent pixel. Test data only.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const LOOP_SENTENCE = 'This is an agent loop without tools: each reply is recorded, the harness answers with what changed (nothing can change without tools), and the loop repeats until the budget ends.';
const usage = { input_tokens: 3, output_tokens: 2 };
const textReply = text => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }], usage });
const callReply = (n, name, args) => ({ status: 'completed', output: [{ type: 'function_call', call_id: `builder-live-${n}`, name, arguments: JSON.stringify(args) }], usage });

async function api(route, body) {
  const response = await fetch(origin + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const raw = await response.text();
  return { status: response.status, raw, body: JSON.parse(raw) };
}

test('builder page live mode in Chromium: steps 0, 1, 2, 5, 6 and 7 against the scripted provider', { timeout: 600000 }, async t => {
  const { getBrowser, closeBrowser } = await import('../lib/browser.mjs');
  const { ROOT: root } = await import('../lib/store.mjs');
  const { MODEL_ONLY_INSTRUCTIONS } = await import('../lib/runner.mjs');
  const repaired = correctStorage(await fixtureSource('src/storage.js'));
  const recording = builderRecording();
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-builder-live-data-'));
  const recordingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-builder-live-recording-'));
  const recordingFile = path.join(recordingDir, 'recording.json');
  await fs.writeFile(recordingFile, JSON.stringify(recording));
  const recordingBytes = await fs.readFile(recordingFile);
  await fs.mkdir(path.join(recordingDir, 'screens'));
  const screens = new Set();
  const collect = entry => Object.values(entry?.screens || {}).filter(Boolean).forEach(rel => screens.add(path.basename(rel)));
  for (const [key, entry] of Object.entries(recording.steps)) if (key === 'step6') { collect(entry.withoutMemory); collect(entry.withMemory); } else collect(entry);
  for (const name of screens) await fs.writeFile(path.join(recordingDir, 'screens', name), PNG);

  // plan.reply(index, body) returns the scripted Responses body for the request at that index.
  let plan = null;
  const providerErrors = [];
  const provider = http.createServer(async (req, res) => {
    try {
      assert.ok(plan, 'No provider plan installed');
      assert.equal(req.headers.authorization, `Bearer ${testKey}`);
      assert.equal(req.url, '/v1/responses');
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      const index = plan.requests.length;
      plan.requests.push(body);
      const reply = plan.reply(index, body);
      assert.ok(reply, `Unexpected extra provider request ${index}`);
      if (plan.delay) await delay(plan.delay);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reply));
    } catch (error) {
      providerErrors.push(error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: error.message } }));
    }
  });
  const steps = list => ({ requests: [], reply: index => list[index] && callReply(index, ...list[index]) });

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
    await fs.rm(recordingDir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => { provider.once('error', reject); provider.listen(4460, '127.0.0.1', resolve); });
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'unit-test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, HARNESS_DATA_DIR: data, PORT: '4458', PREVIEW_PORT: '4459', HARNESS_BUILDER_RECORDING: recordingFile, OPENAI_API_KEY: '', OPENAI_MODEL: '', OPENAI_BASE_URL: providerOrigin + '/v1', LLM_PROTOCOL: 'responses' }
  });
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  for (let i = 0; ; i++) {
    if (child.exitCode !== null) assert.fail(output);
    const state = await api('/api/state').catch(() => null);
    if (state?.status === 200 && state.body.browser.available) break;
    assert.ok(i < 600, `isolated server and browser: ${output}`);
    await delay(100);
  }

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const pageErrors = [], consoleErrors = [], external = [];
  await context.route('**/*', route => {
    if ([origin, preview].includes(new URL(route.request().url()).origin)) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  // Moves between steps without reloading: live runs live in page memory.
  const goStep = async n => {
    await page.evaluate(step => { location.hash = `#step-${step}`; }, n);
    await page.waitForFunction(step => document.querySelector('#step-count').textContent === `STEP ${step} OF 7`, n);
  };
  const runLive = () => page.locator('#live [data-action="run-live"]');
  const statusText = () => page.locator('#live [data-live-status]').allInnerTexts();
  const marks = () => page.locator('.request-text mark.req-new').allInnerTexts();
  const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.body.scrollWidth <= document.documentElement.clientWidth);
  const evaluationDone = slot => page.locator(`[data-evaluation="${slot}"][data-state="done"]`).waitFor({ timeout: 120000 });

  await t.test('no provider configured: the live buttons are hidden with a note', async () => {
    await page.goto(`${origin}/builder.html#step-1`);
    await page.locator('#live [data-live-unavailable]').waitFor();
    assert.match(await page.locator('#live [data-live-unavailable]').innerText(), /No model connection is configured on this server/);
    assert.equal(await runLive().count(), 0);
    assert.match(await page.locator('#proof [data-footer]').innerText(), /Recorded run\. Not live\./);
  });

  const configured = await api('/api/config', { apiKey: testKey, model: 'unit-test-model-builder-live', baseUrl: providerOrigin + '/v1', protocol: 'responses' });
  assert.equal(configured.status, 200, configured.raw);

  await t.test('step 0 live: one request, no tools, the reply as text', async () => {
    await page.goto(`${origin}/builder.html?configured=1#step-0`);
    await runLive().waitFor();
    assert.equal(await page.locator('#live [data-live-unavailable]').count(), 0);
    assert.match(await page.locator('#live .live-hint').innerText(), /one real, billable request/);
    plan = { requests: [], reply: index => index === 0 && textReply('TEST ONLY scripted live reply: I would edit src/storage.js.') };
    await runLive().click();
    await page.waitForFunction(() => document.querySelector('[data-reply]')?.textContent === 'TEST ONLY scripted live reply: I would edit src/storage.js.');
    assert.equal(plan.requests.length, 1);
    assert.deepEqual(plan.requests[0].tools, []);
    assert.equal(plan.requests[0].instructions, MODEL_ONLY_INSTRUCTIONS);
    assert.match((await statusText())[0], /^Completed · 1 request, no tools · 5 reported tokens · request [0-9A-F]{8}$/);
    const footer = page.locator('#proof [data-footer]');
    assert.equal(await footer.getAttribute('data-live'), 'true');
    assert.match(await footer.innerText(), /Live run\. Started at \d\d:\d\d:\d\d\./);
    assert.doesNotMatch(await footer.innerText(), /Not live/);
    assert.equal(await page.locator('#mode-text').innerText(), 'RECORDED AND LIVE RUNS');
    assert.equal(await runLive().isDisabled(), false);
  });

  await t.test('step 1 live: the loop grows until the budget stops it, then the presenter evaluates', async () => {
    await goStep(1);
    plan = { requests: [], delay: 250, reply: index => index < 30 && textReply(`TEST ONLY scripted loop reply ${index}.`) };
    await runLive().click();
    const samples = [];
    for (let i = 0; i < 400; i++) {
      const sample = await page.evaluate(() => ({
        status: document.querySelector('#live [data-live-status]')?.textContent || '',
        total: Number(document.querySelector('#proof .builder-activity')?.dataset.total || 0),
        badge: document.querySelector('#mode-text').textContent,
        disabled: document.querySelector('#live [data-action="run-live"]')?.disabled,
        budget: document.querySelectorAll('#proof .event-row[data-kind="budget"]').length
      }));
      samples.push(sample);
      // Until the live run has started, the step still shows its recorded run (which has a budget stop).
      if (sample.budget && /^Budget reached/.test(sample.status)) break;
      await delay(150);
    }
    const running = samples.filter(s => /^Running · call \d+ of 24 · /.test(s.status));
    assert.ok(running.length >= 2, `seen while running: ${JSON.stringify(samples.map(s => s.status))}`);
    assert.ok(running.some(s => Number(/call (\d+)/.exec(s.status)[1]) < 24));
    assert.ok(running.every(s => s.badge === 'LIVE RUN IN PROGRESS' && s.disabled === true), 'badge and disabled button while active');
    const totals = [...new Set(samples.filter(s => /^(Running|Budget reached) · /.test(s.status)).map(s => s.total).filter(Boolean))];
    assert.ok(totals.length >= 2, `the activity list grows: ${totals}`);
    assert.deepEqual(totals, [...totals].sort((a, b) => a - b));
    assert.equal(samples.at(-1).budget, 1, 'the budget stop appears');
    await evaluationDone('main');
    assert.match((await statusText())[0], /^Budget reached · call 24 of 24 · 120 reported tokens · \d+ s · run [0-9A-F]{8}$/);
    const evaluation = await page.locator('[data-evaluation="main"]').innerText();
    assert.match(evaluation, /YOUR EVALUATION · PRESENTER ACTION, NOT THE MODEL/);
    assert.match(evaluation, /Checks the agent can run: \d\/\d passed/);
    assert.match(evaluation, /Held-out checks, never shown to the agent: \d\/\d passed/);
    assert.ok(await page.locator('.builder-activity .event-row[data-kind="observation"]').count() > 0);
    assert.match(await page.locator('.builder-activity .event-row[data-actor="presenter"]').innerText(), /Presenter action, not the model/);
    // The request highlight compares with step 0's live request (same base text), so only the loop's additions are new.
    assert.match(await page.locator('[data-request-caption]').innerText(), /^Highlighted: new since step 0\./);
    const added = (await marks()).map(text => text.trim());
    assert.equal(added[0], LOOP_SENTENCE);
    assert.ok(!added.join('').includes('You are asked to fix'));
    assert.equal(plan.requests.length, 24);
    for (const body of plan.requests) { assert.deepEqual(body.tools, []); assert.ok(body.instructions.startsWith(MODEL_ONLY_INSTRUCTIONS)); }
    await page.waitForFunction(() => !document.querySelector('#live [data-action="run-live"]').disabled);
    assert.equal(await page.locator('#mode-text').innerText(), 'RECORDED AND LIVE RUNS');
    assert.match(await page.locator('#proof [data-footer]').innerText(), /Live run\. Started at/);
    assert.deepEqual(providerErrors, []);
  });

  await t.test('step 2 live: real tools, then your boundary probe is rejected', async () => {
    await goStep(2);
    assert.equal(await page.locator('[data-action="probe"]').count(), 0, 'no probe button before a live run');
    plan = steps([['read_file', { path: 'src/storage.js' }], ['request_completion', { summary: 'TEST ONLY scripted step 2 completion.' }]]);
    await runLive().click();
    await evaluationDone('main');
    const probeButton = page.locator('[data-action="probe"]');
    await probeButton.waitFor();
    assert.match(await page.locator('[data-probe]').innerText(), /YOUR ACTION, NOT THE MODEL'S/);
    assert.match(await page.locator('.proof-highlights').innerText(), /Write outside the sandbox: not tested yet/);
    await probeButton.click();
    await page.locator('[data-probe-result="rejected"]').waitFor();
    assert.match(await page.locator('[data-probe-result]').innerText(), /^Rejected\. The harness answered: \S/);
    const probeRow = page.locator('.builder-activity .event-row[data-actor="probe"]');
    assert.equal(await probeRow.count(), 1);
    assert.match(await probeRow.innerText(), /Presenter-triggered probe, not a model action/);
    assert.match(await page.locator('.proof-highlights').innerText(), /Write outside the sandbox: rejected \(presenter-triggered probe, not a model action\)/);
    assert.equal(await page.locator('.builder-activity .event-row', { hasText: 'Tool: read_file' }).count(), 1);
    assert.ok(plan.requests[0].tools.some(tool => tool.name === 'write_file'));
    const sandbox = await page.locator('[data-phone="sandbox"] iframe').getAttribute('src');
    assert.match(sandbox, new RegExp(`^${preview}/preview/[a-f0-9-]{36}/index\\.html\\?rev=`));
    assert.deepEqual(providerErrors, []);
  });

  await t.test('a failed create shows the server message verbatim and keeps the recorded run', async () => {
    await goStep(3);
    await page.route('**/api/runs', route => route.request().method() === 'POST' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'TEST ONLY refused create.' }) }) : route.continue());
    await runLive().click();
    await page.locator('#live [data-live-error]').waitFor();
    assert.equal(await page.locator('#live [data-live-error]').innerText(), 'TEST ONLY refused create.');
    assert.match(await page.locator('#proof [data-footer]').innerText(), /Recorded run\. Not live\./);
    assert.equal(await runLive().isDisabled(), false);
    await page.unroute('**/api/runs');
  });

  await t.test('step 5 live: checks before completion, then both tiers of the presenter evaluation', async () => {
    await goStep(5);
    plan = steps([
      ['read_file', { path: 'src/storage.js' }],
      ['write_file', { path: 'src/storage.js', content: repaired }],
      ['run_checks', {}],
      ['request_completion', { summary: 'TEST ONLY scripted step 5 completion.' }]
    ]);
    await runLive().click();
    await evaluationDone('main');
    assert.match((await statusText())[0], /^Completed · call 4 of 24 · 20 reported tokens · /);
    const evaluation = await page.locator('[data-evaluation="main"]').innerText();
    assert.match(evaluation, /Checks the agent can run: 6\/6 passed/);
    assert.match(evaluation, /Held-out checks, never shown to the agent: 5\/5 passed/);
    assert.ok(plan.requests[0].tools.some(tool => tool.name === 'run_checks'));
    assert.deepEqual(await page.locator('.builder-activity .event-row[data-kind="verification"] strong').allInnerTexts(), ['6/6 browser checks passed', '6/6 browser checks passed']);
    assert.match(await page.locator('[data-request-caption]').innerText(), /new since step 3 \(step 4 is not recorded\)/);
    assert.match(await page.locator('#phones .subtle-badge').innerText(), /Live run on this server/);
    await page.frameLocator('[data-phone="sandbox"] iframe').getByText('My notes').first().waitFor();
    assert.deepEqual(providerErrors, []);
  });

  await t.test('step 6 live: without memory first, then with memory; both evaluated', async () => {
    await goStep(6);
    const script = [
      ['write_file', { path: 'src/storage.js', content: repaired }],
      ['request_completion', { summary: 'TEST ONLY scripted step 6 completion.' }]
    ];
    plan = steps([...script, ...script]);
    plan.delay = 400;
    await runLive().click();
    await page.locator('[data-slot="withMemory"] [data-pending]').waitFor();
    assert.match(await page.locator('[data-slot="withMemory"]').innerText(), /Starts after the run without memory stops\./);
    assert.equal(await page.locator('#phones [data-pending]').count(), 1);
    await evaluationDone('withoutMemory');
    await evaluationDone('withMemory');
    assert.equal(plan.requests.length, 4);
    assert.equal(plan.requests[0].tools.some(tool => tool.name === 'save_memory'), false, 'without memory first');
    assert.equal(plan.requests[2].tools.some(tool => tool.name === 'save_memory'), true);
    assert.equal(await page.locator('.proof-column [data-footer][data-live="true"]').count(), 2);
    const lines = await statusText();
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^Without memory: Completed · /);
    assert.match(lines[1], /^With memory: Completed · /);
    assert.equal(await page.locator('#phones iframe').count(), 4);
    assert.match(await page.locator('.proof-look').innerText(), /^Both runs were set to reset right after their first file edit\./);
    assert.deepEqual(providerErrors, []);
  });

  await t.test('step 7 live: awaiting approval, the diff, your approval, production changes', async () => {
    await goStep(7);
    plan = steps([
      ['read_file', { path: 'src/storage.js' }],
      ['write_file', { path: 'src/storage.js', content: repaired }],
      ['run_checks', {}],
      ['request_completion', { summary: 'TEST ONLY scripted step 7 completion.' }]
    ]);
    await runLive().click();
    await evaluationDone('main');
    await page.locator('[data-approval][data-status="awaiting_approval"]').waitFor();
    assert.match((await statusText())[0], /^Awaiting approval · call 4 of 24 · /);
    assert.match(await page.locator('[data-approval]').innerText(), /YOUR DECISION, NOT THE MODEL'S/);
    assert.deepEqual(await page.locator('#phones .builder-phone').evaluateAll(phones => phones.map(p => p.dataset.phone)), ['sandbox', 'production']);
    assert.equal(await page.locator('#phones .production-banner').innerText(), 'Original build. One change is waiting for your approval.');
    assert.match(await page.locator('[data-changes]').innerText(), /WHAT IS WAITING FOR APPROVAL[\s\S]*src\/storage\.js/);
    assert.match(await page.locator('[data-phone="production"] iframe').getAttribute('src'), /\?rev=original$/);

    await page.locator('[data-approval] [data-action="view-diff"]').click();
    await page.locator('#modal .diff-file').first().waitFor();
    assert.equal(await page.locator('#modal-title').innerText(), 'Inspect the proposed change.');
    assert.equal(await page.locator('#modal .diff-file h3').allInnerTexts().then(list => list.join(',')), 'src/storage.js');
    assert.match(await page.locator('#modal .diff-panel:not(.before) pre').innerText(), /localStorage\.setItem\(prefix \+ 'draft'/);
    assert.match(await page.locator('#modal .diff-panel.before pre').innerText(), /Draft storage is not implemented yet/);
    await page.locator('#modal-close').click();
    await page.waitForFunction(() => !document.querySelector('#modal').open);

    await page.locator('[data-approval] [data-action="approve"]').click();
    await page.locator('#confirm-approve').waitFor();
    assert.match(await page.locator('#modal-body').innerText(), /This is your decision, not the model's\./);
    await page.locator('#confirm-approve').click();
    await page.waitForFunction(() => /^Updated after your approval at \d\d:\d\d:\d\d\.$/.test(document.querySelector('#phones .production-banner')?.textContent || ''));
    const state = (await api('/api/state')).body.runs.find(run => run.features.permissions && run.appliedRevision);
    assert.ok(state, 'the server published the approved revision');
    assert.equal(state.status, 'completed');
    assert.equal(await page.locator('[data-phone="production"] iframe').getAttribute('src'), `${preview}/production/${state.id}/index.html?rev=${encodeURIComponent(state.appliedRevision)}`);
    assert.match((await statusText())[0], /^Completed · call 4 of 24 · /);
    assert.match(await page.locator('[data-approval]').innerText(), /You approved it\. Production was updated at/);
    assert.match(await page.locator('.builder-activity').innerText(), /Published after a person approved · Harness/);
    await page.frameLocator('[data-phone="production"] iframe').getByText('My notes').first().waitFor();
    assert.equal(await (await fetch(`${preview}/production/${state.id}/src/storage.js`)).text(), repaired);
    assert.deepEqual(providerErrors, []);
  });

  await t.test('both viewports free of horizontal scroll with live runs on screen; no errors, no external requests', async () => {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      for (const step of [0, 1, 2, 5, 6, 7]) {
        await goStep(step);
        assert.ok(await noHorizontalScroll(), `no horizontal scroll at ${viewport.width}x${viewport.height}, step ${step}`);
      }
    }
    assert.deepEqual(await fs.readFile(recordingFile), recordingBytes, 'a live run never touches the recording');
    assert.deepEqual(pageErrors, []);
    // The only console error allowed is the deliberately refused create (HTTP 400).
    assert.deepEqual(consoleErrors.filter(text => !/status of 400/.test(text)), []);
    assert.deepEqual(external, []);
    await context.close();
  });
});
