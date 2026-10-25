// HTTP system tests only: a deliberately scripted, local provider fixture drives
// the unmodified runtime. This is not model-quality evidence or a demo mode.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:4339';
const preview = 'http://127.0.0.1:4340';
const providerOrigin = 'http://127.0.0.1:4338';
const testKey = 'unit-test-only-no-real-credential';
const opaque = 'UNIT_TEST_OPAQUE_PROVIDER_HISTORY';
const files = ['index.html', 'src/app.js', 'src/storage.js', 'src/styles.css'];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function api(route, body) {
  const response = await fetch(origin + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() };
}
async function until(read, predicate, description, timeout = 30000) {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) {
    value = await read();
    if (predicate(value)) return value;
    await delay(50);
  }
  assert.fail(`Timed out waiting for ${description}: ${JSON.stringify(value)}`);
}
function repairedStorage(source) {
  // Derive a replacement from the real fixture, changing only these three
  // unfinished draft functions. This repair exists solely in this test file.
  const replacements = [
    ["return { title: '', body: '' };", "try { return JSON.parse(localStorage.getItem(prefix + 'draft')) || { title: '', body: '' }; } catch { return { title: '', body: '' }; }"],
    ['// Draft storage is not implemented yet.', "localStorage.setItem(prefix + 'draft', JSON.stringify(draft));"],
    ['// Clear the draft once a note has been saved.', "localStorage.removeItem(prefix + 'draft');"]
  ];
  for (const [before, after] of replacements) {
    assert.equal(source.split(before).length, 2, `Fixture changed: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}
function toolResult(body, protocol, id) {
  const result = protocol === 'responses'
    ? body.input.find(item => item.type === 'function_call_output' && item.call_id === id)
    : body.messages.find(item => item.role === 'tool' && item.tool_call_id === id);
  assert.ok(result, `Missing actual tool continuation for ${id}`);
  return JSON.parse(protocol === 'responses' ? result.output : result.content);
}

test('isolated HTTP model-tool loop with a test-only loopback provider', { timeout: 180000 }, async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-system-test-'));
  const original = await fs.readFile(path.join(root, 'fixtures/notes/src/storage.js'), 'utf8');
  const repaired = repairedStorage(original);
  let plan;
  let serverOutput = '';
  let child;
  const providerErrors = [];
  const provider = http.createServer(async (req, res) => {
    try {
      assert.ok(plan, 'No provider response plan was installed');
      assert.equal(req.headers.authorization, `Bearer ${testKey}`);
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      assert.equal(body.model, plan.model);
      assert.equal(req.url, plan.protocol === 'responses' ? '/v1/responses' : '/v1/chat/completions');
      const index = plan.requests.length;
      plan.requests.push(body);
      if (index === 0 && plan.hold) await new Promise(resolve => { plan.release = resolve; });
      const step = plan.steps[index];
      assert.ok(step, 'Unexpected extra provider request');
      const id = `unit-call-${index}`;
      const argumentsText = JSON.stringify(step.args);
      const output = plan.protocol === 'responses' ? {
        status: 'completed',
        output: [
          { type: 'reasoning', id: `rs_unit_${index}`, encrypted_content: opaque },
          { type: 'function_call', id: `fc_unit_${index}`, call_id: id, name: step.name, arguments: argumentsText }
        ],
        usage: { input_tokens: 11, output_tokens: 7 }
      } : {
        choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, reasoning_content: opaque,
          tool_calls: [{ id, type: 'function', function: { name: step.name, arguments: argumentsText } }] } }],
        usage: { prompt_tokens: 11, completion_tokens: 7 }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(output));
    } catch (error) {
      providerErrors.push(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: error.message } }));
    }
  });
  t.after(async () => {
    plan?.release?.();
    if (child && child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      // On Windows kill() terminates immediately, bypassing the application's
      // browser cleanup. An IPC wrapper asks the actual SIGTERM handler to run.
      if (child.connected) child.send('unit-test-shutdown');
      else child.kill();
      await Promise.race([exited, delay(5000)]);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
    }
    provider.closeAllConnections();
    await new Promise(resolve => provider.close(resolve));
    await fs.rm(data, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    provider.once('error', reject);
    provider.listen(4338, '127.0.0.1', resolve);
  });
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'unit-test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, HARNESS_DATA_DIR: data, PORT: '4339', PREVIEW_PORT: '4340',
      OPENAI_API_KEY: '', OPENAI_MODEL: '', OPENAI_BASE_URL: providerOrigin + '/v1', LLM_PROTOCOL: 'responses' }
  });
  child.stdout.on('data', chunk => { serverOutput += chunk; });
  child.stderr.on('data', chunk => { serverOutput += chunk; });
  await until(async () => {
    if (child.exitCode !== null) assert.fail(serverOutput);
    try { return await api('/api/state'); } catch { return null; }
  }, result => result?.status === 200 && result.body.browser.available, 'isolated application and actual browser');
  assert.deepEqual((await api('/api/state')).body.runs, [], 'Test data must start empty');

  const runIds = [];
  async function configure(protocol, suffix, steps, hold = false) {
    plan = { protocol, model: `unit-test-model-${suffix}`, steps, requests: [], hold };
    const configured = await api('/api/config', { apiKey: testKey, model: plan.model, baseUrl: providerOrigin + '/v1', protocol });
    assert.equal(configured.status, 200, JSON.stringify(configured.body));
    assert.equal(JSON.stringify(configured.body).includes(testKey), false);
  }
  async function runToStop(options) {
    const created = await api('/api/runs', options);
    assert.equal(created.status, 201);
    const id = created.body.id;
    runIds.push(id);
    assert.equal(created.body.usage.calls, 0);
    const started = await api(`/api/runs/${id}/start`, {});
    assert.equal(started.status, 200, JSON.stringify(started.body));
    return id;
  }
  async function stopped(id) {
    const response = await until(() => api(`/api/runs/${id}`), result => !['running', 'ready'].includes(result.body.status), 'run to stop');
    assert.notEqual(response.body.status, 'failed', JSON.stringify(response.body.events));
    // Status changes before the runner has persisted its last tool result.
    const final = await until(() => fs.readFile(path.join(data, 'runs', id, 'run.json'), 'utf8').then(JSON.parse),
      record => record.activeSessionStartedAt === null, 'runner final persistence');
    return final;
  }
  async function assertExport(id) {
    const exported = await api(`/api/runs/${id}/export`);
    assert.equal(exported.status, 200);
    assert.equal('history' in exported.body, false);
    assert.equal('transcript' in exported.body, false);
    const text = JSON.stringify(exported.body);
    assert.equal(text.includes(testKey), false);
    assert.equal(text.includes(opaque), false);
    assert.equal(text.includes('encrypted_content'), false);
    assert.equal(text.includes('reasoning_content'), false);
    return exported.body;
  }
  async function assertPublished(id, storage) {
    for (const file of files) {
      const expected = file === 'src/storage.js' ? Buffer.from(storage) : await fs.readFile(path.join(root, 'fixtures/notes', file));
      const response = await fetch(`${preview}/published/${id}/${file}`);
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected, file);
      assert.deepEqual(await fs.readFile(path.join(data, 'runs', id, 'published', file)), expected, file);
    }
  }

  for (const protocol of ['responses', 'chat-completions']) {
    await t.test(`${protocol}: actual read, edit, browser checks, and explicit approval`, async () => {
      await configure(protocol, protocol, [
        { name: 'read_file', args: { path: 'src/storage.js' } },
        { name: 'write_file', args: { path: 'src/storage.js', content: repaired } },
        { name: 'run_checks', args: {} },
        { name: 'request_completion', args: { summary: 'Unit-test fixture repair; actual browser verification.' } }
      ], true);
      const id = await runToStop({ mode: 'engineered', scenario: protocol === 'responses' ? 'unicode' : 'longform' });
      await until(async () => plan.requests.length, count => count === 1, 'held first provider request');
      try {
        const locked = await api('/api/config', { model: 'unit-test-cannot-change-active-model' });
        assert.equal(locked.status, 400);
        assert.match(locked.body.error, /Pause active runs/);
        assert.equal((await api('/api/state')).body.provider.model, plan.model);
      } finally { plan.release(); }
      const record = await stopped(id);
      assert.equal(record.status, 'awaiting_approval');
      assert.deepEqual(record.usage, { input: 44, output: 28, calls: 4 });
      assert.equal(plan.requests.length, 4);
      assert.equal(toolResult(plan.requests[1], protocol, 'unit-call-0').content, original);
      const written = toolResult(plan.requests[2], protocol, 'unit-call-1');
      assert.equal(written.written, 'src/storage.js');
      assert.equal(written.bytes, Buffer.byteLength(repaired));
      const checked = toolResult(plan.requests[3], protocol, 'unit-call-2');
      assert.equal(checked.passed, 6);
      assert.equal(checked.total, 6);
      assert.equal(checked.revision, record.pendingRevision);
      assert.equal(record.checks.revision, record.pendingRevision);
      assert.equal(record.checks.passed, 6);
      assert.equal(record.appliedRevision, null);
      assert.equal((await fetch(`${preview}/published/${id}/src/storage.js`)).status, 404);
      await assert.rejects(fs.stat(path.join(data, 'runs', id, 'published')), { code: 'ENOENT' });
      assert.deepEqual(record.events.filter(item => item.kind === 'tool').map(item => item.tool), ['read_file', 'write_file', 'run_checks', 'request_completion']);
      assert.ok(record.events.some(item => item.kind === 'prompt'));
      assert.ok(record.events.some(item => item.kind === 'verification'));
      assert.ok(record.elapsedMs > 0);
      assert.equal(record.checkpoints.filter(item => item.tool === 'run_checks').length, 2, 'Final assessment executes independently');
      if (protocol === 'responses') {
        assert.equal(plan.requests[1].input.some(item => item.encrypted_content === opaque), true, 'Opaque history continues only to provider');
        assert.equal(plan.requests[0].store, false);
      } else {
        assert.equal(JSON.stringify(plan.requests).includes(opaque), false, 'Chat private reasoning is discarded');
      }
      const exported = await assertExport(id);
      assert.equal(exported.changes.length, 1);
      assert.equal(exported.changes[0].file, 'src/storage.js');
      const screenshot = await fetch(origin + exported.checks.results[0].screenshot);
      assert.equal(screenshot.status, 200);
      assert.equal(screenshot.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await screenshot.arrayBuffer()).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const approved = await api(`/api/runs/${id}/approve`, {});
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'completed');
      assert.equal(approved.body.appliedRevision, record.pendingRevision);
      await assertPublished(id, repaired);
      assert.equal((await api(`/api/runs/${id}/approve`, {})).status, 400, 'Approval cannot apply twice');
    });
  }

  await t.test('minimal: applies without assessment; presenter evaluation later exposes failed acceptance', async () => {
    await configure('responses', 'minimal-no-repair', [{ name: 'request_completion', args: { summary: 'Unit-test fixture deliberately requests completion without repairing.' } }]);
    const id = await runToStop({ mode: 'minimal' });
    let record = await stopped(id);
    assert.equal(record.status, 'completed');
    assert.equal(record.harnessVersion, 2);
    assert.equal(record.checks, null);
    assert.equal(record.events.some(item => item.kind === 'verification'), false);
    assert.equal(record.checkpoints.length, 0);
    assert.equal(plan.requests[0].tools.some(tool => tool.name === 'run_checks'), false);
    assert.equal(plan.requests[0].tools.some(tool => tool.name === 'save_memory'), false);
    record = (await api(`/api/runs/${id}/checks`, {})).body;
    assert.equal(record.checks.origin, 'presenter');
    assert.equal(record.checks.passed, 4);
    assert.equal(record.checks.total, 6);
    assert.deepEqual(record.checks.results.map(result => result.passed), [false, false, true, true, true, true]);
    assert.equal(record.features.verification, false);
    assert.equal(record.features.permissions, false);
    assert.deepEqual(record.usage, { input: 11, output: 7, calls: 1 });
    assert.equal(record.events.some(item => item.kind === 'gate'), false);
    const completion = record.events.find(item => item.kind === 'tool_result' && item.tool === 'request_completion').result;
    assert.equal(completion.accepted, true, JSON.stringify(completion));
    assert.equal(completion.assessmentOnly, false);
    assert.equal(completion.unverified, true);
    assert.equal(completion.checks, null);
    assert.equal(record.appliedRevision, record.revision);
    await assertPublished(id, original);
    await assertExport(id);
  });

  await t.test('custom permissions: assessment-only failures still require explicit approval', async () => {
    await configure('chat-completions', 'custom-no-repair', [{ name: 'request_completion', args: { summary: 'Unit-test approval with verification disabled.' } }]);
    const id = await runToStop({ mode: 'minimal', features: { permissions: true, verification: false } });
    const record = await stopped(id);
    assert.equal(record.status, 'awaiting_approval');
    assert.equal(record.checks, null);
    const evaluated = (await api(`/api/runs/${id}/checks`, {})).body;
    assert.equal(evaluated.checks.passed, 4);
    assert.equal(record.appliedRevision, null);
    assert.equal((await fetch(`${preview}/published/${id}/index.html`)).status, 404);
    assert.equal((await api(`/api/runs/${id}/approve`, {})).status, 200);
    await assertPublished(id, original);
    await assertExport(id);
  });

  await t.test('isolated evaluation groups count observed acceptance results, not completion status', async () => {
    const result = await api('/api/evals');
    assert.equal(result.status, 200);
    assert.equal(result.body.count, 4);
    assert.equal(result.body.groups.length, 4);
    assert.equal(result.body.groups.reduce((sum, group) => sum + group.verified, 0), 2);
    assert.deepEqual(result.body.groups.flatMap(group => group.runIds).sort(), runIds.sort());
    for (const group of result.body.groups) {
      assert.match(group.model, /^unit-test-model-/);
      assert.equal(group.trials, 1);
      assert.equal(group.failed, 0, 'A failed acceptance check differs from a transport/run failure');
      assert.equal(group.verified, group.model.includes('no-repair') ? 0 : 1);
    }
    assert.equal(await fs.readFile(path.join(root, 'fixtures/notes/src/storage.js'), 'utf8'), original, 'Test repairs must never alter the source fixture');
    assert.deepEqual(providerErrors, []);
  });
});
