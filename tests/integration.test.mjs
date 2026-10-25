import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-lab-test-'));
process.env.HARNESS_DATA_DIR = data;
process.env.PORT = '4328';
process.env.PREVIEW_PORT = '4329';
process.env.OPENAI_API_KEY = '';
process.env.OPENAI_MODEL = '';
const origin = 'http://127.0.0.1:4328';
const { executeTool, approveRun } = await import('../lib/runner.mjs');
const { closeBrowser, runChecks } = await import('../lib/browser.mjs');
const { filePath, revision } = await import('../lib/store.mjs');

async function api(route, options = {}) {
  const response = await fetch(origin + route, { method: options.method || 'GET', headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local', ...options.headers }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
  return { status: response.status, body: await response.json() };
}

test('real local application, browser checks, and harness boundaries', { timeout: 120000 }, async t => {
  let output = '';
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  const child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], { cwd: root, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  child.stdout.on('data', chunk => output += chunk);
  child.stderr.on('data', chunk => output += chunk);
  t.after(async () => {
    await closeBrowser();
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      if (child.connected) child.send('test-shutdown'); else child.kill();
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))]);
      if (child.exitCode === null) { child.kill(); await exited; }
    }
    await fs.rm(data, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if (output.includes(`Harness Lab: ${origin}`)) { const result = await api('/api/state'); if (result.status === 200) { ready = true; break; } } } catch {}
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  let run;
  await t.test('creates a real workspace without starting or fabricating model activity', async () => {
    const response = await api('/api/runs', { method: 'POST', body: { mode: 'engineered' } });
    assert.equal(response.status, 201);
    run = response.body;
    assert.equal(run.source, 'live');
    assert.equal(run.status, 'ready');
    assert.equal(run.usage.calls, 0);
    assert.equal(run.events.length, 0);
    assert.match(await fs.readFile(filePath(run.id, 'src/storage.js'), 'utf8'), /Draft storage is not implemented/);
  });
  await t.test('requires an actual API connection and rejects simulated runs', async () => {
    const start = await api(`/api/runs/${run.id}/start`, { method: 'POST', body: {} });
    assert.equal(start.status, 400);
    assert.match(start.body.error, /API key/);
    const simulated = await api('/api/runs', { method: 'POST', body: { source: 'rehearsal' } });
    assert.equal(simulated.status, 400);
    assert.match(simulated.body.error, /real model/);
    const connection = await api('/api/config/test', { method: 'POST', body: {} });
    assert.equal(connection.status, 400);
    assert.match(connection.body.error, /API key/);
    const prematureApproval = await api(`/api/runs/${run.id}/approve`, { method: 'POST', body: {} });
    assert.equal(prematureApproval.status, 400);
    const prematureResume = await api(`/api/runs/${run.id}/resume`, { method: 'POST', body: {} });
    assert.equal(prematureResume.status, 400);
  });
  await t.test('blocks cross-origin control and path traversal', async () => {
    const hostile = await api('/api/runs', { method: 'POST', headers: { Origin: 'http://evil.example' }, body: {} });
    assert.equal(hostile.status, 403);
    assert.throws(() => filePath(run.id, '../server.mjs', true), /Permission denied/);
    await assert.rejects(executeTool(run, 'write_file', { path: '../protected-checks.mjs', content: 'bad' }), /Invalid|Permission/);
    const preview = await fetch(`http://127.0.0.1:4329/preview/${run.id}/index.html`);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('content-security-policy'), /connect-src 'none'/);
    const secret = await fetch(`http://127.0.0.1:4329/preview/${run.id}/.env`);
    assert.equal(secret.status, 404);
    const missingEvidence = await api(`/api/runs/${run.id}/screenshots/nonexistent.png`);
    assert.equal(missingEvidence.status, 404);
    assert.equal((await api('/api/state')).status, 200, 'Missing assets must not terminate the server');
  });
  await t.test('actual browser checks reproduce both draft failures, while preserving four passing behaviors', async () => {
    const checked = await api(`/api/runs/${run.id}/checks`, { method: 'POST', body: {} });
    assert.equal(checked.status, 200, JSON.stringify(checked.body));
    assert.equal(checked.body.checks.passed, 4);
    assert.equal(checked.body.checks.total, 6);
    assert.deepEqual(checked.body.checks.results.map(result => result.passed), [false, false, true, true, true, true]);
    assert.equal(checked.body.usage.calls, 0);
  });
  await t.test('completion gate rejects buggy source even if completion is requested', async () => {
    const result = await executeTool(run, 'request_completion', { summary: 'Test the gate against the actual unfixed app.' });
    assert.equal(result.accepted, false);
    assert.equal(run.pendingRevision, null);
  });
  await t.test('real file edits affect actual browser behavior and await approval', async () => {
    // An integration-test repair only. No fixture, demo mode or model run uses this patch.
    const original = await fs.readFile(filePath(run.id, 'src/storage.js'), 'utf8');
    const fixed = original.replace("return { title: '', body: '' };", "try { return JSON.parse(localStorage.getItem(prefix + 'draft')) || { title: '', body: '' }; } catch { return { title: '', body: '' }; }")
      .replace('// Draft storage is not implemented yet.', "localStorage.setItem(prefix + 'draft', JSON.stringify(draft));")
      .replace('// Clear the draft once a note has been saved.', "localStorage.removeItem(prefix + 'draft');");
    await executeTool(run, 'write_file', { path: 'src/storage.js', content: fixed });
    const result = await executeTool(run, 'request_completion', { summary: 'Integration test repair, checked in an actual browser.' });
    assert.equal(result.accepted, true);
    assert.equal(run.checks.passed, 6);
    assert.equal(run.status, 'awaiting_approval');
    const approvedRevision = run.pendingRevision;
    await fs.appendFile(filePath(run.id, 'src/storage.js'), '\n// changed after verification');
    await assert.rejects(approveRun(run), /source changed/);
    await fs.writeFile(filePath(run.id, 'src/storage.js'), fixed);
    assert.equal(await revision(run.id), approvedRevision);
    const suiteVersion = run.checks.suiteVersion;
    delete run.checks.suiteVersion;
    await assert.rejects(approveRun(run), /Rerun browser checks/);
    run.checks.suiteVersion = suiteVersion;
    await approveRun(run);
    assert.equal(run.status, 'completed');
    const published = await fetch(`http://127.0.0.1:4329/published/${run.id}/src/storage.js`);
    assert.equal(await published.text(), fixed);
  });
  await t.test('Unicode and long-form variants exercise real browser behavior on repaired code', async () => {
    for (const scenario of ['unicode', 'longform']) {
      const checks = await runChecks({ ...run, scenario });
      assert.equal(checks.passed, 6, JSON.stringify(checks.results));
      assert.equal(checks.scenario, scenario);
      const evidence = await fetch(origin + checks.results[0].screenshot);
      assert.equal(evidence.status, 200);
      assert.equal(evidence.headers.get('content-type'), 'image/png');
    }
  });
  await t.test('verification catches a plausible repair that silently discards saved note text', async () => {
    const filename = filePath(run.id, 'src/app.js');
    const goodSource = await fs.readFile(filename, 'utf8');
    try {
      await fs.writeFile(filename, goodSource.replace('body: body.value, date:', "body: '', date:"));
      const checks = await runChecks(run);
      assert.equal(checks.results[2].passed, false);
      assert.match(checks.results[2].detail, /full text/);
    } finally { await fs.writeFile(filename, goodSource); }
  });
  await t.test('verification catches an incidental change to original note text', async () => {
    const filename = filePath(run.id, 'src/storage.js');
    const goodSource = await fs.readFile(filename, 'utf8');
    const changedSource = goodSource.replace('onboarding flow.', 'onboarding flow changed.');
    assert.notEqual(changedSource, goodSource);
    try {
      await fs.writeFile(filename, changedSource);
      const checks = await runChecks(run);
      assert.equal(checks.results[4].passed, false);
      assert.match(checks.results[4].detail, /original note content/);
    } finally { await fs.writeFile(filename, goodSource); }
  });
  await t.test('new workspaces reset source, preserve previous work, and enforce the probe without an edit', async () => {
    const response = await api('/api/runs', { method: 'POST', body: { mode: 'minimal', features: { memory: true }, scenario: 'unicode' } });
    assert.equal(response.status, 201);
    const fresh = response.body;
    assert.notEqual(fresh.id, run.id);
    assert.equal(fresh.features.memory, true);
    assert.equal(fresh.features.verification, false);
    assert.match(await fs.readFile(filePath(fresh.id, 'src/storage.js'), 'utf8'), /Draft storage is not implemented/);
    assert.doesNotMatch(await fs.readFile(filePath(run.id, 'src/storage.js'), 'utf8'), /Draft storage is not implemented/);
    const probed = await api(`/api/runs/${fresh.id}/probe`, { method: 'POST', body: {} });
    assert.equal(probed.status, 200);
    assert.match(probed.body.events.at(-1).detail, /not a model-generated action/);
    assert.equal(probed.body.revision, fresh.revision);
    assert.equal(probed.body.usage.calls, 0);
    assert.deepEqual((await api(`/api/runs/${fresh.id}/diff`)).body.changes, []);
  });
  await t.test('unrun workspaces and manual checks do not create benchmark claims', async () => {
    const result = await api('/api/evals');
    assert.equal(result.body.count, 0);
    assert.deepEqual(result.body.groups, []);
    const exported = await api(`/api/runs/${run.id}/export`);
    assert.equal('history' in exported.body, false);
    assert.equal('transcript' in exported.body, false);
  });
});
