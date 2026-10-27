// Harness builder HTTP tests (package A). A deliberately scripted, TEST-ONLY
// loopback provider drives the unmodified server; no record produced here is
// model evidence or enters the demo history.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';

const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-builder-system-'));
const recordingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-builder-recording-'));
const recordingFile = path.join(recordingDir, 'recording.json');
process.env.HARNESS_DATA_DIR = data;
process.env.PORT = '4438';
process.env.PREVIEW_PORT = '4439';
const origin = 'http://127.0.0.1:4438';
const providerOrigin = 'http://127.0.0.1:4440';
const testKey = 'unit-test-only-builder-no-real-credential';
const { ROOT: root, TASK } = await import('../lib/store.mjs');
const { MODEL_ONLY_INSTRUCTIONS } = await import('../lib/runner.mjs');
const { getBrowser, closeBrowser } = await import('../lib/browser.mjs');
const { preset } = await import('../public/lesson.mjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// The smallest valid PNG: 1×1 transparent pixel. Test data only.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function api(route, body) {
  const response = await fetch(origin + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const raw = await response.text();
  return { status: response.status, raw, body: JSON.parse(raw) };
}
async function until(read, predicate, description, timeout = 60000) {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) { value = await read(); if (predicate(value)) return value; await delay(50); }
  assert.fail(`Timed out waiting for ${description}: ${JSON.stringify(value)?.slice(0, 2000)}`);
}
const textReply = n => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: `TEST ONLY scripted reply ${n}.` }] }], usage: { input_tokens: 3, output_tokens: 2 } });
const callReply = (n, name, args) => ({ status: 'completed', output: [{ type: 'function_call', call_id: `builder-system-${n}`, name, arguments: JSON.stringify(args) }], usage: { input_tokens: 3, output_tokens: 2 } });

test('harness builder: model-only request, loop-only run, builder routes, reset after the first edit', { timeout: 240000 }, async t => {
  // plan.respond(index) returns [status, body] for the request at that index.
  let plan = null;
  const providerErrors = [];
  const provider = http.createServer(async (req, res) => {
    try {
      assert.ok(plan, 'No provider plan installed');
      assert.equal(req.headers.authorization, `Bearer ${testKey}`);
      assert.equal(req.url, '/v1/responses');
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const index = plan.requests.length;
      plan.requests.push(JSON.parse(raw));
      const [status, body] = plan.respond(index);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
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
    await fs.rm(recordingDir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => { provider.once('error', reject); provider.listen(4440, '127.0.0.1', resolve); });
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'unit-test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, HARNESS_DATA_DIR: data, PORT: '4438', PREVIEW_PORT: '4439', HARNESS_BUILDER_RECORDING: recordingFile, OPENAI_API_KEY: '', OPENAI_MODEL: '', OPENAI_BASE_URL: providerOrigin + '/v1', LLM_PROTOCOL: 'responses' }
  });
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  await until(async () => {
    if (child.exitCode !== null) assert.fail(output);
    try { return await api('/api/state'); } catch { return null; }
  }, result => result?.status === 200 && result.body.browser.available, 'isolated server and browser');

  await t.test('POST /api/model/task-only makes one real request with no tools and writes a record', async () => {
    plan = { requests: [], respond: () => [200, textReply(0)] };
    const unconfigured = await api('/api/model/task-only', {});
    assert.equal(unconfigured.status, 400);
    assert.match(unconfigured.body.error, /Configure an API key and model/);
    assert.equal(plan.requests.length, 0, 'No request without a configured provider');
    assert.deepEqual((await api('/api/model-only')).body, { records: [] });
    const missingHeaders = await fetch(origin + '/api/model/task-only', { method: 'POST', body: '{}' });
    assert.equal(missingHeaders.status, 403, 'Same local headers as other POSTs');

    const configured = await api('/api/config', { apiKey: testKey, model: 'unit-test-model-builder', baseUrl: providerOrigin + '/v1', protocol: 'responses' });
    assert.equal(configured.status, 200, JSON.stringify(configured.body));
    const before = (await fs.readdir(path.join(data, 'runs'))).length;
    const result = await api('/api/model/task-only', {});
    assert.equal(result.status, 201, result.raw);
    assert.equal(plan.requests.length, 1, 'Exactly one model request');
    const [request] = plan.requests;
    assert.deepEqual(request.tools, [], 'No tool schema');
    assert.equal(request.instructions, MODEL_ONLY_INSTRUCTIONS);
    assert.deepEqual(request.input, [{ role: 'user', content: TASK }]);
    assert.equal(request.model, 'unit-test-model-builder');
    assert.equal(request.max_output_tokens, 6000, 'Default output limit');
    const record = result.body;
    assert.deepEqual(Object.keys(record).sort(), ['at', 'baseUrl', 'id', 'incompleteReason', 'instructions', 'model', 'protocol', 'status', 'task', 'text', 'usage', 'usageReported']);
    assert.match(record.id, /^[a-f0-9-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(record.at)));
    assert.deepEqual({ model: record.model, baseUrl: record.baseUrl, protocol: record.protocol, instructions: record.instructions, task: record.task, text: record.text, status: record.status, incompleteReason: record.incompleteReason, usage: record.usage, usageReported: record.usageReported },
      { model: 'unit-test-model-builder', baseUrl: providerOrigin + '/v1', protocol: 'responses', instructions: MODEL_ONLY_INSTRUCTIONS, task: TASK, text: 'TEST ONLY scripted reply 0.', status: 'completed', incompleteReason: null, usage: { input: 3, output: 2 }, usageReported: true });
    const stored = await fs.readFile(path.join(data, 'model-only', `${record.id}.json`), 'utf8');
    assert.deepEqual(JSON.parse(stored), record);
    assert.equal(stored.includes(testKey), false, 'The key never reaches the record');
    assert.equal(result.raw.includes(testKey), false, 'The key never reaches the response');
    assert.equal((await fs.readdir(path.join(data, 'runs'))).length, before, 'No run or workspace was created');
    assert.deepEqual((await api('/api/state')).body.runs, []);

    const listed = await api('/api/model-only');
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.records, [record]);
    assert.equal(listed.raw.includes(testKey), false);

    // A failed request: HTTP 400 with the provider message and no record.
    plan = { requests: [], respond: () => [500, { error: { message: 'TEST ONLY provider outage' } }] };
    const failed = await api('/api/model/task-only', {});
    assert.equal(failed.status, 400);
    assert.match(failed.body.error, /TEST ONLY provider outage/);
    assert.equal(plan.requests.length, 1);
    assert.equal((await fs.readdir(path.join(data, 'model-only'))).filter(name => name.endsWith('.json')).length, 1);

    plan = { requests: [], respond: () => [200, textReply(1)] };
    const second = (await api('/api/model/task-only', {})).body;
    assert.deepEqual((await api('/api/model-only')).body.records.map(item => item.id), [second.id, record.id], 'Newest first');
    assert.deepEqual(providerErrors, []);
  });

  let minimalId, loopId;
  await t.test('loop-only validation over HTTP and a Minimal comparison run', async () => {
    for (const [options, message] of [
      [{ mode: 'minimal', loopOnly: 'yes' }, 'loopOnly must be true, false or omitted.'],
      [{ mode: 'minimal', loopOnly: null }, 'loopOnly must be true, false or omitted.'],
      [{ mode: 'minimal', loopOnly: true, features: { context: true } }, 'A loop-only run cannot enable harness features.'],
      [{ mode: 'engineered', loopOnly: true }, 'A loop-only run cannot enable harness features.']
    ]) {
      const refused = await api('/api/runs', options);
      assert.equal(refused.status, 400, JSON.stringify(options));
      assert.equal(refused.body.error, message);
    }
    assert.deepEqual((await api('/api/state')).body.runs, [], 'A refused request creates no workspace');
    plan = { requests: [], respond: index => [200, callReply(index, 'request_completion', { summary: 'TEST ONLY scripted Minimal completion.' })] };
    const created = await api('/api/runs', { mode: 'minimal' });
    assert.equal(created.status, 201);
    assert.equal(created.body.loopOnly, false);
    minimalId = created.body.id;
    assert.equal((await api(`/api/runs/${minimalId}/start`, {})).status, 200);
    await until(() => api(`/api/runs/${minimalId}`), result => result.body.status !== 'running' && result.body.activeSessionStartedAt === null, 'Minimal run to stop');
    assert.equal((await api(`/api/runs/${minimalId}`)).body.status, 'completed');
    assert.ok(plan.requests[0].tools.length > 0, 'Minimal keeps its tools');
  });

  await t.test('a loop-only run over HTTP ends at its budget; evaluation groups keep it separate', async () => {
    plan = { requests: [], respond: index => [200, textReply(index)] };
    const created = await api('/api/runs', { mode: 'minimal', loopOnly: true });
    assert.equal(created.status, 201, created.raw);
    assert.equal(created.body.loopOnly, true);
    loopId = created.body.id;
    assert.equal((await api(`/api/runs/${loopId}/start`, {})).status, 200);
    const record = await until(() => fs.readFile(path.join(data, 'runs', loopId, 'run.json'), 'utf8').then(JSON.parse).catch(() => null), item => item && item.status !== 'running' && item.activeSessionStartedAt === null, 'loop-only run to stop');
    assert.equal(record.status, 'budget_exceeded');
    assert.equal(record.usage.calls, 24);
    assert.equal(plan.requests.length, 24);
    for (const body of plan.requests) {
      assert.deepEqual(body.tools, []);
      assert.ok(body.instructions.startsWith(MODEL_ONLY_INSTRUCTIONS));
    }
    assert.equal(record.events.filter(item => item.kind === 'observation').length, 24);
    assert.equal(record.events.filter(item => item.kind === 'budget').length, 1);
    assert.equal(record.appliedRevision, null);
    assert.deepEqual(providerErrors, []);

    const evals = (await api('/api/evals')).body;
    const groups = evals.groups.filter(group => group.model === 'unit-test-model-builder');
    assert.equal(groups.length, 2, 'Same model and features, but loop-only is its own group');
    const loopGroup = groups.find(group => group.loopOnly === true), minimalGroup = groups.find(group => group.loopOnly === false);
    assert.deepEqual(loopGroup.runIds, [loopId]);
    assert.deepEqual(minimalGroup.runIds, [minimalId]);
    assert.deepEqual(loopGroup.features, minimalGroup.features);
    assert.equal(loopGroup.failed, 1);

    const state = (await api('/api/state')).body;
    const listed = state.runs.find(run => run.id === loopId);
    assert.equal(listed.loopOnly, true);
    assert.equal(preset(listed), 'Loop only');
    assert.equal(preset(state.runs.find(run => run.id === minimalId)), 'Minimal');
    assert.equal(JSON.stringify(state).includes(testKey), false);
  });

  await t.test('the dashboard shows the loop-only run as Loop only with Tools off', async () => {
    const browser = await getBrowser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin + '/#workbench');
      await page.locator('#preset-badge', { hasText: 'Loop only' }).waitFor();
      const chip = page.locator('#harness-features [data-concept="tools"]');
      assert.match(await chip.getAttribute('class'), /\boff\b/);
      const card = page.locator('[data-anatomy="tools"]');
      const cardClass = await card.getAttribute('class');
      assert.doesNotMatch(cardClass, /\benabled\b/);
      assert.doesNotMatch(cardClass, /\bhighlight\b/);
      assert.match(await card.innerText(), /Off/);
      assert.match(await page.locator('#activity-list').innerText(), /Observation returned to the model/);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  await t.test('GET /api/builder: 404 without a recording, the parsed file with present run ids', async () => {
    const missing = await api('/api/builder');
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { error: 'No builder recording found.' });
    const recording = {
      note: 'TEST ONLY recording.', recordedAt: '2026-10-27T00:00:00.000Z', finishedAt: null, complete: false, model: 'unit-test-model-builder', scenario: 'draft', resetAfterCalls: 5,
      steps: {
        step0: { id: 'model-only-record', text: 'TEST ONLY' },
        step1: { runId: loopId, status: 'budget_exceeded', calls: 24, run: { id: loopId } },
        step2: { runId: minimalId, status: 'completed', calls: 1 },
        step6: { withoutMemory: { runId: '00000000-0000-0000-0000-000000000000' }, withMemory: { runId: '11111111-1111-1111-1111-111111111111' } }
      }
    };
    await fs.writeFile(recordingFile, JSON.stringify(recording));
    const found = await api('/api/builder');
    assert.equal(found.status, 200, found.raw);
    assert.deepEqual(found.body, { ...recording, present: { [loopId]: true, [minimalId]: true } });
    await fs.writeFile(recordingFile, '{ not json');
    assert.equal((await api('/api/builder')).status, 400, 'A corrupt recording is an error, not an empty page');
    await fs.writeFile(recordingFile, JSON.stringify(recording));
  });

  await t.test('/builder-assets serves PNG screenshots from the recording directory and rejects other names', async () => {
    await fs.mkdir(path.join(recordingDir, 'screens'), { recursive: true });
    await fs.writeFile(path.join(recordingDir, 'screens', 'step1-sandbox.png'), PNG);
    await fs.writeFile(path.join(recordingDir, 'screens', 'Upper.png'), PNG);
    await fs.writeFile(path.join(recordingDir, 'secret.png'), PNG);
    const served = await fetch(origin + '/builder-assets/step1-sandbox.png');
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), PNG);
    for (const name of ['Upper.png', 'step1_sandbox.png', 'step1-sandbox.jpg', 'step1-sandbox', 'missing.png', '..%2Fsecret.png', '..%2F..%2Frecording.json', 'screens%2Fstep1-sandbox.png', '.png', '']) {
      const refused = await fetch(origin + '/builder-assets/' + name);
      assert.equal(refused.status, 404, name);
      assert.deepEqual(await refused.json(), { error: 'Not found' }, name);
    }
    assert.equal((await fetch(origin + '/builder-assets/step1-sandbox.png', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' }, body: '{}' })).status, 405);
  });

  await t.test('builder page assets are served when present and 404 cleanly when missing', async () => {
    for (const name of ['builder.html', 'builder.mjs', 'builder.css']) {
      const exists = await fs.access(path.join(root, 'public', name)).then(() => true, () => false);
      const response = await fetch(`${origin}/${name}`);
      if (exists) {
        assert.equal(response.status, 200, name);
        assert.match(response.headers.get('content-type'), name.endsWith('.html') ? /text\/html/ : name.endsWith('.css') ? /text\/css/ : /text\/javascript/);
      } else {
        assert.equal(response.status, 404, name);
        assert.deepEqual(await response.json(), { error: 'Not found' }, name);
      }
    }
    assert.equal((await fetch(`${origin}/builder.js`)).status, 404);
  });
  // Work package D: resetAfterFirstEdit over HTTP with the scripted provider.
  await t.test('resetAfterFirstEdit over HTTP: validation, both presets reset right after their first write, separate evaluation groups', async () => {
    for (const [options, message] of [
      [{ mode: 'minimal', resetAfterFirstEdit: 'yes' }, 'resetAfterFirstEdit must be true, false or omitted.'],
      [{ mode: 'minimal', resetAfterFirstEdit: null }, 'resetAfterFirstEdit must be true, false or omitted.'],
      [{ mode: 'engineered', resetAfterFirstEdit: true, resetAfterCalls: 5 }, 'Use resetAfterCalls or resetAfterFirstEdit, not both.']
    ]) {
      const refused = await api('/api/runs', options);
      assert.equal(refused.status, 400, JSON.stringify(options));
      assert.equal(refused.body.error, message);
    }
    const memoryText = memory => memory ? 'memory is enabled, so a frozen handoff of recorded progress is supplied to the next session' : 'memory is off, so no handoff is supplied; the next session receives the task and its normal inputs only';
    const ids = {};
    // Minimal writes at call 2, Engineered at call 4: the reset follows the work, not the call count.
    for (const [mode, before, call] of [['minimal', [['list_files', {}]], 2], ['engineered', [['list_files', {}], ['read_file', { path: 'PROJECT.md' }], ['read_file', { path: 'src/storage.js' }]], 4]]) {
      const script = [...before, ['write_file', { path: 'src/storage.js', content: '// TEST ONLY edit for the first-edit reset\n' }]];
      plan = { requests: [], respond: index => [200, index < script.length ? callReply(index, ...script[index]) : textReply(index)] };
      const created = await api('/api/runs', { mode, resetAfterFirstEdit: true });
      assert.equal(created.status, 201, created.raw);
      assert.equal(created.body.resetAfterFirstEdit, true);
      assert.equal(created.body.resetAfterCalls, null);
      const id = ids[mode] = created.body.id;
      assert.equal((await api(`/api/runs/${id}/start`, {})).status, 200);
      const run = (await until(() => api(`/api/runs/${id}`), result => result.body.status !== 'running' && result.body.activeSessionStartedAt === null, `${mode} first-edit run to stop`)).body;
      assert.equal(run.status, 'budget_exceeded', mode);
      assert.equal(run.session, 2);
      const resets = run.events.filter(item => item.kind === 'reset');
      assert.equal(resets.length, 1);
      const memory = mode === 'engineered';
      assert.equal(resets[0].detail, `Configured forced reset after the first file edit (model call ${call}; resetAfterFirstEdit = true); every preset resets at this same point in its work. This is a harness setting that simulates a context limit, not a provider error. The previous API conversation is cleared. The configured memory policy decides what is restored: ${memoryText(memory)}. Workspace files remain as they are.`);
      assert.deepEqual({ call: resets[0].call, session: resets[0].session, resetAfterFirstEdit: resets[0].resetAfterFirstEdit, memory: resets[0].memory }, { call, session: 1, resetAfterFirstEdit: true, memory });
      assert.deepEqual({ afterCall: run.forcedReset.afterCall, afterFirstEdit: run.forcedReset.afterFirstEdit, session: run.forcedReset.session }, { afterCall: call, afterFirstEdit: true, session: 1 });
      assert.ok(run.events.findIndex(item => item.kind === 'edit') < run.events.indexOf(resets[0]));
      assert.equal(plan.requests[call].input.length, 1, 'Session 2 starts without previous API messages');
      assert.equal(plan.requests[call].instructions.includes('Restored durable memory'), memory);
      if (memory) assert.match(plan.requests[call].instructions, /"editedFiles":\[\{"file":"src\/storage.js"/);
      assert.deepEqual(providerErrors, []);
    }
    const evals = (await api('/api/evals')).body;
    const groups = evals.groups.filter(group => group.model === 'unit-test-model-builder');
    const edited = groups.filter(group => group.resetAfterFirstEdit === true);
    assert.deepEqual(edited.map(group => group.runIds).sort(), [[ids.engineered], [ids.minimal]].sort(), 'One group per preset with the flag');
    assert.ok(edited.every(group => group.resetAfterCalls === null && group.loopOnly === false));
    const plainMinimal = groups.find(group => group.runIds.includes(minimalId));
    assert.equal(plainMinimal.resetAfterFirstEdit, false, 'Same model and features without the flag is its own group');
    assert.equal(plainMinimal.runIds.includes(ids.minimal), false);
    assert.ok(groups.every(group => typeof group.resetAfterFirstEdit === 'boolean'));
  });
});
