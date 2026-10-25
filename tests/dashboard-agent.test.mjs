// Actual dashboard interactions against a TEST-ONLY scripted loopback provider.
// This exercises transport and runtime behavior, never live model quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getBrowser, closeBrowser } from '../lib/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:4358';
const preview = 'http://127.0.0.1:4359';
const providerOrigin = 'http://127.0.0.1:4360';
const model = 'unit-test-model-dashboard-only';
const key = 'unit-test-key-never-a-live-credential';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('actual dashboard agent lifecycle with an isolated test-only HTTP provider', { timeout: 120000 }, async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-dashboard-agent-'));
  const original = await fs.readFile(path.join(root, 'fixtures/notes/src/storage.js'), 'utf8');
  // Test-only repair; runtime fixtures and the user's demo records stay untouched.
  const repaired = original.replace("return { title: '', body: '' };", "try { return JSON.parse(localStorage.getItem(prefix + 'draft')) || { title: '', body: '' }; } catch { return { title: '', body: '' }; }")
    .replace('// Draft storage is not implemented yet.', "localStorage.setItem(prefix + 'draft', JSON.stringify(draft));")
    .replace('// Clear the draft once a note has been saved.', "localStorage.removeItem(prefix + 'draft');");
  assert.notEqual(repaired, original);
  const requests = [], providerErrors = [], browserErrors = [], external = [];
  let heldClosed = false;
  const provider = http.createServer(async (req, res) => {
    try {
      assert.equal(req.url, '/v1/responses');
      assert.equal(req.method, 'POST');
      assert.equal(req.headers.authorization, `Bearer ${key}`);
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      assert.equal(body.model, model);
      const index = requests.length;
      requests.push(body);
      if (index === 1) {
        // Keep a genuine HTTP request pending until the UI's Pause action aborts it.
        await new Promise(resolve => res.once('close', resolve));
        heldClosed = true;
        return;
      }
      const steps = {
        2: { name: 'read_file', args: { path: 'src/storage.js' } },
        3: { name: 'write_file', args: { path: 'src/storage.js', content: repaired } },
        4: { name: 'run_checks', args: {} },
        5: { name: 'request_completion', args: { summary: 'TEST ONLY provider repaired draft persistence and inspected actual browser results.' } },
        6: { name: 'request_completion', args: { summary: 'TEST ONLY Minimal requests completion without a repair or test.' } }
      };
      let output;
      if (index === 0) output = [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'OK: test-only local provider.' }] }];
      else {
        assert.ok(steps[index], `Unexpected test provider request ${index}`);
        output = [{ type: 'function_call', call_id: `dashboard-unit-${index}`, name: steps[index].name, arguments: JSON.stringify(steps[index].args) }];
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'completed', output, usage: { input_tokens: 13, output_tokens: 9 } }));
    } catch (error) {
      providerErrors.push(error.message);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: error.message } }));
    }
  });
  let child;
  let output = '';
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
  await new Promise((resolve, reject) => {
    provider.once('error', reject);
    provider.listen(4360, '127.0.0.1', resolve);
  });
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'unit-test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, HARNESS_DATA_DIR: data, PORT: '4358', PREVIEW_PORT: '4359', OPENAI_API_KEY: '', OPENAI_MODEL: '', OPENAI_BASE_URL: providerOrigin + '/v1', LLM_PROTOCOL: 'responses' }
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
  assert.deepEqual((await state()).runs, []);
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    if ([origin, preview].includes(new URL(route.request().url()).origin)) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  context.on('page', tab => {
    tab.on('pageerror', error => browserErrors.push(error.message));
    tab.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
    tab.on('response', response => { if (response.status() >= 500) browserErrors.push(`HTTP ${response.status()}: ${response.url()}`); });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#notes-frame').src.includes('/preview/'));
  const id = (await state()).runs[0].id;
  const current = async () => (await state()).runs.find(run => run.id === id);

  await t.test('Save & test configures from the actual form and verifies local HTTP output', async () => {
    await page.locator('#setup-button').click();
    await page.locator('#api-base').fill(providerOrigin + '/v1');
    await page.locator('#api-model').fill(model);
    await page.locator('#api-protocol').selectOption('responses');
    await page.locator('#api-key').fill(key);
    await page.getByRole('button', { name: 'Save & test' }).click();
    await page.locator('#setup-feedback').getByText('The configured endpoint returned a real model response.').waitFor();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].max_output_tokens, 32);
    assert.equal(await page.locator('#api-key').inputValue(), '');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#run-button').isEnabled(), true);
    assert.equal((await current()).usage.calls, 0, 'Connection test is separate from agent usage');
  });

  await t.test('Run and Pause interrupt held transport and New session requires its UI confirmation', async () => {
    await page.locator('#run-button').click();
    await page.waitForFunction(() => document.querySelector('#run-button').textContent.includes('Pause agent'));
    for (let i = 0; i < 200 && requests.length < 2; i++) await delay(25);
    assert.equal(requests.length, 2);
    assert.equal((await current()).status, 'running');
    await page.locator('#anatomy-now').getByText('Waiting for model response',{exact:true}).waitFor();
    assert.match(await page.locator('[data-anatomy="loop"]').getAttribute('class'), /highlight/);
    for(const [component,expected] of [['instructions','Preserve existing notes'],['context','src/storage.js: notes and draft storage']]) {
      assert.match(await page.locator(`[data-anatomy="${component}"]`).getAttribute('class'), /highlight/);
      await page.locator(`[data-anatomy="${component}"]`).click();
      await page.locator('#component-evidence').click();
      assert.ok((await page.locator('#modal-body').innerText()).includes(expected));
      await page.keyboard.press('Escape');
    }
    await page.locator('#run-button').click();
    await page.waitForFunction(() => document.querySelector('#run-button').textContent.includes('Resume agent'));
    const paused = await current();
    assert.match(await page.locator('.event-row').filter({hasText:'Paused at a safe tool boundary'}).locator('.event-label').innerText(),/Agent loop/i);
    assert.equal(paused.status, 'paused');
    assert.equal(paused.usage.calls, 1);
    assert.equal(paused.usage.unreportedRequests, 1);
    assert.equal(paused.inFlightRequest, null);
    for (let i = 0; i < 100 && !heldClosed; i++) await delay(10);
    assert.equal(heldClosed, true, 'Pause aborts actual provider HTTP transport');
    await page.locator('#new-session').click();
    await page.locator('#confirm-session').waitFor();
    assert.match(await page.locator('#modal-body').innerText(), /makes model requests/);
    assert.equal(requests.length, 2, 'Opening confirmation must not resume');
    await page.locator('#confirm-session').click();
    await page.waitForFunction(() => document.querySelector('#session-number').textContent.includes('2'));
  });

  await t.test('resumed loop edits real files, records independent browser proof and exposes diff', async () => {
    await page.waitForFunction(() => document.querySelector('#run-button').textContent.includes('Review proposed changes'), null, { timeout: 45000 });
    const run = await current();
    assert.equal(run.status, 'awaiting_approval');
    assert.equal(run.session, 2);
    assert.equal(run.checks.passed, 6);
    assert.equal(run.usage.calls, 5);
    assert.equal(run.usage.input, 52);
    assert.equal(run.usage.output, 36);
    assert.equal(run.usage.unreportedRequests, 1);
    assert.equal(requests.length, 6);
    assert.equal(requests[2].input.length, 1, 'Fresh session discards previous API conversation');
    const read = requests[3].input.find(item => item.type === 'function_call_output' && item.call_id === 'dashboard-unit-2');
    assert.equal(JSON.parse(read.output).content, original);
    const checks = requests[5].input.find(item => item.type === 'function_call_output' && item.call_id === 'dashboard-unit-4');
    assert.equal(JSON.parse(checks.output).passed, 6);
    assert.match(await page.locator('#checks-summary').innerText(), /6\/6/);
    assert.equal(await fs.readFile(path.join(data, 'runs', id, 'workspace/src/storage.js'), 'utf8'), repaired);
    await page.locator('#view-diff').click();
    await page.locator('.diff-file h3').getByText('src/storage.js', { exact: true }).waitFor();
    assert.match(await page.locator('.diff-panel.before pre').innerText(), /Draft storage is not implemented/);
    assert.match(await page.locator('.diff-panel:not(.before) pre').innerText(), /localStorage\.setItem\(prefix \+ 'draft'/);
    await page.keyboard.press('Escape');
    assert.equal((await fetch(`${preview}/published/${id}/index.html`)).status, 404);
    assert.equal(run.appliedRevision, null);
    assert.match(await page.locator('#anatomy-now').innerText(), /Waiting for you/);
    assert.match(await page.locator('[data-anatomy="guardrails"]').getAttribute('class'), /highlight/);
  });

  await t.test('approval confirms publication and the published app preserves and saves a complete draft', async () => {
    await page.locator('#approve-button').click();
    await page.locator('#confirm-approve').waitFor();
    assert.match(await page.locator('#modal-kicker').innerText(), /EXPLICIT HUMAN APPROVAL/);
    assert.equal((await current()).status, 'awaiting_approval');
    assert.equal((await fetch(`${preview}/published/${id}/index.html`)).status, 404, 'Opening confirmation cannot publish');
    await page.locator('#confirm-approve').click();
    await page.getByRole('link', { name: 'Open published app' }).waitFor();
    assert.equal((await current()).status, 'completed');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Open published app' }).click();
    const published = await popupPromise;
    await published.waitForURL(`${preview}/published/${id}/index.html`);
    const title = 'Dashboard acceptance ✓';
    const body = 'Preserve literal <script> & quotes.\nनमस्ते — 안녕하세요';
    await published.getByTestId('note-title').fill(title);
    await published.getByTestId('note-body').fill(body);
    await published.getByTestId('notes-tab').click();
    await published.getByTestId('editor-tab').click();
    assert.equal(await published.getByTestId('note-title').inputValue(), title);
    assert.equal(await published.getByTestId('note-body').inputValue(), body);
    await published.reload();
    assert.equal(await published.getByTestId('note-title').inputValue(), title);
    assert.equal(await published.getByTestId('note-body').inputValue(), body);
    await published.getByTestId('save-note').click();
    assert.deepEqual(await published.getByTestId('saved-title').allTextContents(), [title, 'Release checklist', 'A thought for later']);
    assert.equal(await published.getByTestId('note-card').first().locator('p').innerText(), body);
    await published.getByTestId('editor-tab').click();
    await published.reload();
    assert.equal(await published.getByTestId('note-title').inputValue(), '');
    assert.equal(await published.getByTestId('note-body').inputValue(), '');
    await published.close();
    assert.equal(await fs.readFile(path.join(data, 'runs', id, 'published/src/storage.js'), 'utf8'), repaired);
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#run-button').innerText(), /Published/);
    await page.locator('#run-button').click();
    await page.getByRole('link', { name: 'Open published app' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(requests.length, 6, 'Inspecting completed work must not call the model');
  });

  await t.test('evals show one observed test-transport outcome and browser has no application errors', async () => {
    await page.locator('[data-view="evals"]').click();
    await page.locator('.matrix-result strong').getByText('1 / 1', { exact: true }).waitFor();
    assert.equal(await page.locator('.matrix-result').count(), 1);
    assert.equal(await page.locator('.provider-name').innerText(), model);
    assert.equal(await page.locator('.history-row').count(), 1);
    assert.match(await page.locator('.history-meta').innerText(), /5 model calls/);
    assert.match(await page.locator('.history-meta').innerText(), /token usage unreported/);
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(external, [], 'Dashboard browser may only access its local application origins');
    assert.deepEqual(providerErrors, []);
    assert.equal(await fs.readFile(path.join(root, 'fixtures/notes/src/storage.js'), 'utf8'), original);
    const browserStorage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert.equal(browserStorage.includes(key), false);
    const evidence = await (await fetch(`${origin}/api/runs/${id}/export`)).json();
    assert.equal(evidence.history, undefined);
    assert.equal(JSON.stringify(evidence).includes(key), false);
  });
  await t.test('Minimal UI shows unverified publication before independent presenter evaluation', async () => {
    await page.locator('#eval-new-run').click();
    await page.locator('[data-preset="minimal"]').click();
    await page.getByRole('button',{name:'Prepare workspace'}).click();
    await page.waitForFunction(()=>!document.querySelector('#modal').open);
    assert.match(await page.locator('[data-anatomy="verification"]').innerText(),/Off/);
    assert.equal(await page.locator('.anatomy-card.enabled').count(),2);
    assert.equal(await page.locator('.anatomy-card small').count(),0);
    assert.equal(await page.locator('[data-anatomy="loop"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(23, 75, 145)');
    assert.equal(await page.locator('[data-anatomy="instructions"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(236, 238, 241)');
    await page.locator('#run-button').click();
    await page.waitForFunction(()=>document.querySelector('#run-button').textContent.includes('Published'));
    assert.match(await page.locator('#checks-summary').innerText(),/Not run yet/);
    assert.match(await page.locator('#anatomy-now').innerText(),/Applied automatically/);
    assert.match(await page.locator('#anatomy-now').innerText(),/No acceptance check or approval/);
    assert.equal(requests.length,7);
    assert.equal(requests[6].tools.some(tool=>tool.name==='run_checks'||tool.name==='save_memory'),false);
    await page.getByRole('button',{name:'Evaluate outcome',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#checks-summary').textContent.includes('4/6'),null,{timeout:45000});
    assert.match(await page.locator('#anatomy-now').innerText(),/Presenter evaluation/);
    assert.equal(await page.locator('.anatomy-card.highlight').count(),0);
    assert.doesNotMatch(await page.locator('[data-anatomy="verification"]').getAttribute('class'),/highlight/);
    assert.equal(requests.length,7,'Presenter evaluation makes no model call');
    await page.screenshot({path:path.resolve(root,'../../work/harness-lab-qa/minimal-evaluated.png'),fullPage:true});
    assert.deepEqual(providerErrors,[]);
    assert.deepEqual(browserErrors,[]);
  });
});
