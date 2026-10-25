// Real dashboard/browser tests. No provider is configured and no model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getBrowser, closeBrowser } from '../lib/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:4348';
const preview = 'http://127.0.0.1:4349';
const captures = path.resolve(root, '../../work/harness-lab-qa');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('dashboard interactions in a real browser without API credentials', { timeout: 180000 }, async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-dashboard-'));
  let output = '';
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  const child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, HARNESS_DATA_DIR: data, PORT: '4348', PREVIEW_PORT: '4349', OPENAI_API_KEY: '', OPENAI_MODEL: '' }
  });
  child.stdout.on('data', chunk => output += chunk);
  child.stderr.on('data', chunk => output += chunk);
  t.after(async () => {
    await closeBrowser();
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      if (child.connected) child.send('test-shutdown'); else child.kill();
      await Promise.race([exited, delay(5000)]);
      if (child.exitCode === null) { child.kill(); await exited; }
    }
    await fs.rm(data, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) break;
    try { if (output.includes(`Harness Lab: ${origin}`)) { const state = await (await fetch(origin + '/api/state')).json(); if (state.browser.available) { ready = true; break; } } } catch {}
    await delay(100);
  }
  assert.ok(ready, output);
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const external = [], errors = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if ([origin, preview].includes(new URL(url).origin)) return route.continue();
    external.push(url); return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await fs.mkdir(captures, { recursive: true });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#run-button').textContent.includes('Run coding agent') && document.querySelector('#notes-frame').src.includes('/preview/'));
  const frame = page.frameLocator('#notes-frame');
  const state = () => fetch(origin + '/api/state').then(response => response.json());
  const runId = (await state()).runs[0].id;

  await t.test('visible agent button explains missing credentials; typing survives dashboard polling', async () => {
    assert.equal(await page.locator('[data-anatomy]').count(), 7);
    assert.match(await page.locator('[data-anatomy="verification"]').innerText(), /Enabled/);
    await page.locator('[data-anatomy="context"]').click();
    assert.equal(await page.locator('#modal-title').innerText(), 'Context management');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#run-button').isDisabled(), true);
    assert.equal(await page.locator('#run-requirements').isVisible(), true);
    assert.equal(await page.locator('#keyless-checks').isEnabled(), true);
    await frame.getByTestId('note-title').fill('My release draft');
    await frame.getByTestId('note-body').fill('Keep this while the dashboard refreshes.');
    await delay(1600); // Cross a real polling cycle; it must not reload the iframe.
    assert.equal(await frame.getByTestId('note-title').inputValue(), 'My release draft');
    await frame.getByTestId('notes-tab').click();
    await frame.getByTestId('editor-tab').click();
    assert.equal(await frame.getByTestId('note-title').inputValue(), '', 'Original bug must remain reproducible');
    assert.equal((await state()).runs[0].usage.calls, 0);
  });
  await t.test('focus mode keeps the run controls in view on common presentation screens', async () => {
    await page.screenshot({ path: path.join(captures, 'dashboard-desktop.png'), fullPage: true });
    await page.locator('#focus-toggle').click();
    for (const [width, height] of [[1440, 900], [1280, 720]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await page.locator('#run-button').boundingBox();
      assert.ok(box.y > 0 && box.y + box.height <= height, `Run button outside ${width}x${height}: ${JSON.stringify(box)}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      await page.screenshot({ path: path.join(captures, `focus-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  });
  await t.test('keyless action executes the actual browser suite and exposes screenshot evidence', async () => {
    await page.locator('#keyless-checks').click();
    await page.waitForFunction(() => document.querySelector('#checks-summary').textContent.includes('4/6'), null, { timeout: 45000 });
    assert.match(await page.locator('#anatomy-now').innerText(), /Presenter evaluation/);
    assert.equal((await state()).runs[0].usage.calls, 0);
    await page.locator('[data-check="0"]').click();
    assert.match(await page.locator('#modal-body').innerText(), /FAILED/);
    const href = await page.getByRole('link', { name: 'Open recorded screenshot' }).getAttribute('href');
    const response = await fetch(origin + href);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#modal').isVisible(), false);
  });
  await t.test('permission probe, diff, memory, and concept dialogs reflect real workspace state', async () => {
    await page.locator('#probe-button').click();
    await page.locator('#activity-list').getByText('Protected-file boundary tested', { exact: true }).waitFor();
    const probeRun = (await state()).runs.find(run => run.id === runId);
    assert.ok(probeRun.events.some(event => event.kind === 'permission'));
    await page.locator('#view-diff').click();
    await page.getByText('No source changes have been recorded in this workspace.').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('[data-panel="memory"]').click();
    assert.match(await page.locator('#memory-content').innerText(), /No .*memory|No handoff/i);
    await page.locator('[data-panel="activity"]').click();
    await page.locator('[data-anatomy="context"]').click();
    assert.equal(await page.locator('#modal-title').innerText(), 'Context management');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-anatomy="context"]').evaluate(el => el === document.activeElement), true);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#export-button').click();
    const download = await downloadEvent;
    const evidence = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.ok(!JSON.stringify(evidence).includes('apiKey'));
    assert.equal(evidence.history, undefined);
  });
  await t.test('setup validates required fields and saves settings without making a model request', async () => {
    await page.locator('#setup-button').click();
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    assert.equal(await page.locator('#api-model').evaluate(el => el.validity.valueMissing), true);
    await page.locator('#api-model').fill('configure-real-model-later');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await page.getByText('Connection saved. The model has not been called.').waitFor();
    assert.equal((await state()).provider.configured, false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#run-button').isDisabled(), true);
  });
  await t.test('new workspace respects presets, individual controls, and scenario selection', async () => {
    await page.locator('#focus-toggle').click();
    await page.locator('#new-workspace').click();
    await page.locator('[data-preset="minimal"]').click();
    assert.equal(await page.locator('#feature-verification').isChecked(), false);
    await page.locator('#feature-permissions').check();
    await page.locator('#scenario').selectOption('unicode');
    await page.getByRole('button', { name: 'Prepare workspace' }).click();
    await page.waitForFunction(() => !document.querySelector('#modal').open);
    const runs = (await state()).runs;
    assert.equal(runs.length, 2);
    const created = runs.find(run => run.id !== runId);
    assert.equal(created.features.permissions, true);
    assert.equal(created.features.verification, false);
    assert.equal(created.scenario, 'unicode');
    assert.equal(created.usage.calls, 0);
    assert.equal(created.checks, null);
    assert.match(await page.locator('[data-anatomy="verification"]').innerText(), /Off/);
    assert.match(await page.locator('[data-anatomy="memory"]').innerText(), /Off/);
    assert.match(await page.locator('[data-anatomy="guardrails"]').innerText(), /Enabled/);
  });
  await t.test('evals exclude manual checks; guide and history navigation work', async () => {
    await page.locator('[data-view="evals"]').click();
    await page.getByText(/No agent outcomes measured yet/).waitFor();
    assert.equal(await page.locator('.history-row').count(), 2);
    await page.locator(`[data-open-run="${runId}"]`).click();
    assert.equal(await page.locator('#view-workbench').isVisible(), true);
    await page.locator('[data-view="guide"]').click();
    assert.equal(await page.locator('.guide-step').count(), 8);
    await page.locator('#back-to-workbench').click();
  });
  await t.test('mobile layout and setup dialog remain usable without horizontal overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
    await page.screenshot({ path: path.join(captures, 'dashboard-mobile.png'), fullPage: true });
    await page.locator('#setup-button').click();
    const box = await page.locator('#modal').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    assert.deepEqual(external, [], 'Dashboard must not contact any external services');
  });
});
