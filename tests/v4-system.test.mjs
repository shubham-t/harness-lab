// Harness v4 HTTP and real-browser tests. A deliberately scripted, TEST-ONLY
// loopback provider drives the unmodified runtime; reference patches live in
// tests/support and are never model output, demo data or fixture changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { ROOT as root, FIXTURE_DIR, correctStorage, fixtureSource, applyReferencePatch } from './support/reference-patches.mjs';

const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-v4-system-'));
process.env.HARNESS_DATA_DIR = data;
process.env.PORT = '4418';
process.env.PREVIEW_PORT = '4419';
const origin = 'http://127.0.0.1:4418';
const preview = 'http://127.0.0.1:4419';
const providerOrigin = 'http://127.0.0.1:4420';
const testKey = 'unit-test-only-v4-no-real-credential';
const { FILES, workspace } = await import('../lib/store.mjs');
const { runChecks, getBrowser, closeBrowser, HELD_OUT_CHECK_NAMES } = await import('../lib/browser.mjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const TICKET_HEADING = 'Related ticket thread PN-142, supplied by the harness:';
const SEED_TITLES = ['Release checklist', 'A thought for later'];

async function api(route, body) {
  const response = await fetch(origin + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() };
}
async function until(read, predicate, description, timeout = 60000) {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) { value = await read(); if (predicate(value)) return value; await delay(50); }
  assert.fail(`Timed out waiting for ${description}: ${JSON.stringify(value)?.slice(0, 2000)}`);
}
async function productionBytes(id, file) {
  const response = await fetch(`${preview}/production/${id}/${file}`);
  assert.equal(response.status, 200, file);
  return { body: Buffer.from(await response.arrayBuffer()), csp: response.headers.get('content-security-policy') };
}

test('harness v4: Backup screen, production route, held-out tier and forced reset', { timeout: 240000 }, async t => {
  let plan;
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
      const step = plan.steps[index];
      assert.ok(step, `Unexpected extra provider request ${index}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', call_id: `v4-unit-${index}`, name: step.name, arguments: JSON.stringify(step.args) }], usage: { input_tokens: 3, output_tokens: 2 } }));
    } catch (error) {
      providerErrors.push(error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
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
  await new Promise((resolve, reject) => { provider.once('error', reject); provider.listen(4420, '127.0.0.1', resolve); });
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'unit-test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, HARNESS_DATA_DIR: data, PORT: '4418', PREVIEW_PORT: '4419', OPENAI_API_KEY: '', OPENAI_MODEL: '', OPENAI_BASE_URL: providerOrigin + '/v1', LLM_PROTOCOL: 'responses' }
  });
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  await until(async () => {
    if (child.exitCode !== null) assert.fail(output);
    try { return await api('/api/state'); } catch { return null; }
  }, result => result?.status === 200 && result.body.browser.available, 'isolated server and browser');
  assert.deepEqual((await api('/api/state')).body.heldOutCheckNames, HELD_OUT_CHECK_NAMES);

  const createRun = async options => { const created = await api('/api/runs', options); assert.equal(created.status, 201, JSON.stringify(created.body)); return created.body; };

  await t.test('the buggy fixture renders a Backup screen listing the two seed notes', async () => {
    const run = await createRun({ mode: 'minimal' });
    const browser = await getBrowser();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${preview}/preview/${run.id}/index.html`);
      await page.getByTestId('note-title').fill('An unsaved draft title');
      await page.getByTestId('backup-tab').click();
      const backup = JSON.parse(await page.getByTestId('backup-output').inputValue());
      assert.equal(backup.version, 1);
      assert.deepEqual(backup.notes.map(note => note.title), SEED_TITLES);
      assert.deepEqual(Object.keys(backup.notes[0]).sort(), ['body', 'date', 'id', 'title']);
      assert.equal(backup.notes[0].body, 'Check the new onboarding flow.\nVerify dark mode on smaller screens.');
      assert.equal(await page.getByTestId('backup-count').innerText(), '2 notes');
      assert.match(await page.locator('.backup-note').innerText(), /Unsaved drafts are never included\./);
      assert.equal(await page.getByTestId('backup-output').getAttribute('readonly'), '');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  await t.test('production serves the pristine fixture, not the sandbox, before publication', async () => {
    const run = await createRun({ mode: 'minimal' });
    await fs.appendFile(path.join(workspace(run.id), 'src/storage.js'), '\n// sandbox-only edit\n');
    const previewCsp = (await fetch(`${preview}/preview/${run.id}/index.html`)).headers.get('content-security-policy');
    for (const file of FILES) {
      const served = await productionBytes(run.id, file);
      assert.deepEqual(served.body, await fs.readFile(path.join(FIXTURE_DIR, file)), file);
      assert.equal(served.csp, previewCsp, 'Same CSP as the preview routes');
    }
    for (const name of ['PROJECT.md', '.env', '../ticket/PN-142.md', 'src/../../ticket/PN-142.md']) assert.equal((await fetch(`${preview}/production/${run.id}/${name}`)).status, 404, name);
    assert.equal((await fetch(`${preview}/production/00000000-0000-0000-0000-000000000000/index.html`)).status, 404);
    assert.equal((await fetch(`${origin}/production/${run.id}/index.html`)).status, 404, 'Production is served only by the preview origin');
  });

  await t.test('held-out tier passes a correct reference fix and catches a draft stored inside the notes array', async () => {
    const run = await createRun({ mode: 'engineered' });
    await assert.rejects(runChecks(run, { tier: 'everything' }), /Unknown check tier/);
    await applyReferencePatch(workspace(run.id), 'correct');
    const correct = await runChecks(run, { tier: 'all' });
    assert.equal(correct.tier, 'visible');
    assert.equal(correct.passed, 6, JSON.stringify(correct.results));
    assert.equal(correct.heldOut.tier, 'heldOut');
    assert.equal(correct.heldOut.passed, 5, JSON.stringify(correct.heldOut.results));
    assert.equal(correct.heldOut.revision, correct.revision);

    await applyReferencePatch(workspace(run.id), 'draft-in-notes');
    const visible = await runChecks(run);
    assert.equal(visible.tier, 'visible');
    assert.equal('heldOut' in visible, false);
    assert.equal(visible.passed, 6, `The wrong fix passes every visible check: ${JSON.stringify(visible.results)}`);
    const heldOut = await runChecks(run, { tier: 'heldOut' });
    assert.equal(heldOut.tier, 'heldOut');
    assert.equal('heldOut' in heldOut, false);
    assert.deepEqual(heldOut.results.map(result => result.passed), [false, true, true, true, true], JSON.stringify(heldOut.results));
    assert.equal(heldOut.results[0].name, 'Backup lists saved notes and never a draft');
    assert.match(heldOut.results[0].detail, /unsaved draft|exactly the 2 saved notes/);
    assert.equal(await fixtureSource('src/storage.js'), await fs.readFile(path.join(root, 'fixtures/notes/src/storage.js'), 'utf8'));
    assert.match(await fixtureSource('src/storage.js'), /Draft storage is not implemented/, 'Reference patches never touch the fixture');
  });

  await t.test('forced reset at the same call for both presets; production changes only through publish', async () => {
    const repaired = correctStorage(await fixtureSource('src/storage.js'));
    const records = {};
    for (const mode of ['minimal', 'engineered']) {
      plan = { requests: [], steps: [
        { name: 'write_file', args: { path: 'src/storage.js', content: repaired } },
        { name: 'list_files', args: {} },
        { name: 'request_completion', args: { summary: `TEST ONLY ${mode} scripted completion after a forced reset.` } }
      ] };
      const configured = await api('/api/config', { apiKey: testKey, model: `unit-test-model-v4-${mode}`, baseUrl: providerOrigin + '/v1', protocol: 'responses' });
      assert.equal(configured.status, 200, JSON.stringify(configured.body));
      assert.equal((await api('/api/runs', { mode, resetAfterCalls: 1 })).status, 400, 'resetAfterCalls must be at least 2');
      assert.equal((await api('/api/runs', { mode, resetAfterCalls: '2' })).status, 400, 'resetAfterCalls must be an integer');
      const run = await createRun({ mode, resetAfterCalls: 2 });
      assert.equal(run.resetAfterCalls, 2);
      assert.equal(run.harnessVersion, 4);
      assert.equal((await api(`/api/runs/${run.id}/start`, {})).status, 200);
      await until(() => api(`/api/runs/${run.id}`), result => !['running', 'ready'].includes(result.body.status), `${mode} run to stop`);
      const record = await until(() => fs.readFile(path.join(data, 'runs', run.id, 'run.json'), 'utf8').then(JSON.parse), item => item.activeSessionStartedAt === null, 'final persistence');
      records[mode] = record;
      assert.deepEqual(providerErrors, []);
      assert.equal(record.status, mode === 'minimal' ? 'completed' : 'awaiting_approval', JSON.stringify(record.events.filter(item => ['error', 'gate'].includes(item.kind))));
      assert.equal(record.session, 2);
      assert.equal(record.usage.calls, 3);
      const resets = record.events.filter(item => item.kind === 'reset');
      assert.equal(resets.length, 1);
      assert.equal(resets[0].call, 2);
      assert.equal(resets[0].title, 'Context limit reached: fresh session required');
      assert.equal(plan.requests[1].input.length, 3);
      assert.equal(plan.requests[2].input.length, 1, 'Session 2 has no previous API conversation');
      assert.equal(plan.requests[2].instructions.includes('Restored durable memory'), mode === 'engineered');
      assert.equal(plan.requests[2].instructions.includes(TICKET_HEADING), mode === 'engineered');
      assert.equal(plan.requests[0].instructions.includes(TICKET_HEADING), mode === 'engineered');
      const completion = record.events.find(item => item.kind === 'tool_result' && item.tool === 'request_completion').result;
      assert.equal(completion.accepted, true);
      if (completion.checks) assert.equal('heldOut' in completion.checks, false);
      const storage = (await productionBytes(run.id, 'src/storage.js')).body.toString('utf8');
      if (mode === 'minimal') {
        assert.ok(Number.isFinite(Date.parse(record.appliedAt)), 'publish() records appliedAt');
        assert.equal(storage, repaired, 'Minimal published without review, so production changed');
      } else {
        assert.equal(record.appliedAt, null);
        assert.equal(storage, await fixtureSource('src/storage.js'), 'Awaiting approval: production is still the original build');
        const approved = await api(`/api/runs/${run.id}/approve`, {});
        assert.equal(approved.status, 200, JSON.stringify(approved.body));
        assert.ok(Number.isFinite(Date.parse(approved.body.appliedAt)));
        assert.equal((await productionBytes(run.id, 'src/storage.js')).body.toString('utf8'), repaired);
        const evaluated = await api(`/api/runs/${run.id}/checks`, {});
        assert.equal(evaluated.status, 200, JSON.stringify(evaluated.body));
        assert.equal(evaluated.body.checks.passed, 6);
        assert.equal(evaluated.body.checks.heldOut.passed, 5);
      }
    }
    assert.equal(records.minimal.events.find(item => item.kind === 'reset').call, records.engineered.events.find(item => item.kind === 'reset').call);
    const evals = (await api('/api/evals')).body;
    const groups = evals.groups.filter(group => group.model?.startsWith('unit-test-model-v4-'));
    assert.equal(groups.length, 2);
    for (const group of groups) {
      assert.equal(group.resetAfterCalls, 2);
      assert.equal(group.heldOutVerified, group.model.endsWith('engineered') ? 1 : 0);
      assert.equal(group.verified, group.model.endsWith('engineered') ? 1 : 0);
    }
  });
});
