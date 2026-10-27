// Argument handling, the step plan, key hygiene and both phases of
// scripts/record-builder.mjs. Every test injects a fake API, fake export and
// fake screenshots: no network, no browser, no model call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RESET_AFTER_CALLS } from '../lib/store.mjs';
import { parseArgs, planSteps, featureSet, findKeyLike, recordPhase, finishPhase, runRecorder, UsageError, APPROVAL_MESSAGE, NOTE, DEFAULTS } from '../scripts/record-builder.mjs';

const script = fileURLToPath(new URL('../scripts/record-builder.mjs', import.meta.url));
const PREVIEW = 'http://127.0.0.1:4319';
const made = [];
const tempDir = async () => { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'record-builder-')); made.push(dir); return dir; };
test.after(() => Promise.all(made.map(dir => fs.rm(dir, { recursive: true, force: true }))));
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('defaults, valid values and invalid arguments', () => {
  assert.deepEqual(parseArgs([]), { url: 'http://127.0.0.1:4318', out: 'live-validation/builder', resetAfterCalls: 5, phase: 'record', help: false });
  const custom = parseArgs(['--url', 'http://localhost:5000/x', '--out', 'tmp/rec', '--reset-after', String(RESET_AFTER_CALLS.max), '--phase', 'record']);
  assert.deepEqual(custom, { url: 'http://localhost:5000', out: 'tmp/rec', resetAfterCalls: RESET_AFTER_CALLS.max, phase: 'record', help: false });
  assert.equal(parseArgs(['--phase', 'finish']).phase, 'finish');
  assert.equal(parseArgs(['--help']).help, true);
  for (const argv of [
    ['--phase', 'approve'], ['--phase'], ['--reset-after', String(RESET_AFTER_CALLS.min - 1)], ['--reset-after', String(RESET_AFTER_CALLS.max + 1)],
    ['--reset-after', '2.5'], ['--reset-after', 'five'], ['--url', 'not a url'], ['--url', 'ftp://127.0.0.1'], ['--out'], ['--out', '--phase'],
    ['--trials', '1'], ['--help', '--help'], ['--out', 'a', '--out', 'b'], ['--phase', 'finish', '--reset-after', '5']
  ]) assert.throws(() => parseArgs(argv), UsageError, argv.join(' '));
});

test('the command line prints usage and refuses invalid arguments without calling a server', () => {
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /--phase NAME/); assert.match(help.stdout, /real, billable model calls/); assert.match(help.stdout, /never approves/);
  const bad = spawnSync(process.execPath, [script, '--reset-after', '99'], { encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /--reset-after must be an integer from 2 to 23/); assert.match(bad.stderr, /Usage:/);
});

test('the step plan follows the steps table: draft only, explicit features, reset only on step 6', () => {
  const plan = planSteps(7);
  assert.deepEqual(plan.map(item => `${item.key}${item.slot ? '.' + item.slot : ''}`), ['step0', 'step1', 'step2', 'step3', 'step4', 'step5', 'step6.withoutMemory', 'step6.withMemory', 'step7']);
  assert.equal(plan[0].modelOnly, true); assert.equal(plan[0].body, undefined);
  const bodies = Object.fromEntries(plan.slice(1).map(item => [`${item.key}${item.slot ? '.' + item.slot : ''}`, item.body]));
  const f = (...on) => ({ instructions: on.includes('instructions'), context: on.includes('context'), memory: on.includes('memory'), verification: on.includes('verification'), permissions: on.includes('permissions') });
  assert.deepEqual(bodies.step1, { mode: 'minimal', loopOnly: true, scenario: 'draft' });
  assert.deepEqual(bodies.step2, { mode: 'minimal', features: f(), scenario: 'draft' });
  assert.deepEqual(bodies.step3, { mode: 'minimal', features: f('instructions'), scenario: 'draft' });
  assert.deepEqual(bodies.step4, { mode: 'minimal', features: f('instructions', 'context'), scenario: 'draft' });
  assert.deepEqual(bodies.step5, { mode: 'minimal', features: f('instructions', 'context', 'verification'), scenario: 'draft' });
  assert.deepEqual(bodies['step6.withoutMemory'], { mode: 'minimal', features: f('instructions', 'context', 'verification'), resetAfterCalls: 7, scenario: 'draft' });
  assert.deepEqual(bodies['step6.withMemory'], { mode: 'minimal', features: f('instructions', 'context', 'verification', 'memory'), resetAfterCalls: 7, scenario: 'draft' });
  assert.deepEqual(bodies.step7, { mode: 'engineered', scenario: 'draft' });
  for (const [key, body] of Object.entries(bodies)) {
    assert.equal('resetAfterCalls' in body, key.startsWith('step6'), key);
    if (body.features) assert.ok(Object.values(body.features).every(value => typeof value === 'boolean') && Object.keys(body.features).length === 5, key);
  }
  assert.equal(plan.filter(item => item.probe).map(item => item.key).join(), 'step2');
  assert.equal(plan.filter(item => item.approvalStep).map(item => item.key).join(), 'step7');
  assert.equal(planSteps()[6].body.resetAfterCalls, DEFAULTS.resetAfterCalls);
  assert.deepEqual(featureSet(), f());
  assert.throws(() => featureSet(['sandbox']), /Unknown feature/);
});

test('key hygiene finds key-like values by path and never echoes them', () => {
  assert.equal(findKeyLike({ a: [{ b: 'Bearer sk-abcdefgh12' }] }), '$.a[0].b');
  assert.equal(findKeyLike({ text: 'key=sk-proj-12345678' }), '$.text');
  assert.equal(findKeyLike({ 'sk-abcdefghijk': 1 }), '$ (a property name)');
  assert.equal(findKeyLike({ text: 'sk-short and task-specific advice from a risk-assessment' }), null);
  assert.equal(findKeyLike({ n: 1, ok: true, none: null }), null);
});

// A fake server that follows the documented contract. Runs stop on the second
// poll. Loop-only runs end at the budget, Engineered waits for approval, the
// rest complete and publish.
function fakeServer({ configured = true, model = 'example-model', failOn = null, step7Status = 'awaiting_approval', neverStops = false } = {}) {
  const calls = [];
  const runs = new Map();
  let next = 0;
  const api = async (route, data) => {
    calls.push({ route, data });
    if (failOn?.(route, data)) throw new Error('Server refused the request');
    if (route === '/api/state') return { provider: { configured, model: configured ? model : '', baseUrl: 'https://provider.example/v1', protocol: 'responses' }, previewOrigin: PREVIEW };
    if (route === '/api/model/task-only') return { id: 'mo-1', at: '2026-10-27T10:00:00.000Z', model, baseUrl: 'https://provider.example/v1', protocol: 'responses', instructions: 'You are asked…', task: 'Fix Pocket Notes…', text: 'I would read storage.js.', status: 'completed', incompleteReason: null, usage: { input: 100, output: 40 }, usageReported: true };
    if (route === '/api/runs') {
      const id = uuid(++next);
      const run = { id, mode: data.mode, loopOnly: data.loopOnly === true, features: data.features ?? { instructions: true, context: true, memory: true, verification: true, permissions: true }, scenario: data.scenario, resetAfterCalls: data.resetAfterCalls ?? null, provider: { model }, status: 'ready', polls: 0, usage: { input: 0, output: 0, calls: 0 }, events: [], appliedRevision: null, revision: 'r' + next };
      runs.set(id, run); return { ...run };
    }
    const [, id, action = ''] = route.match(/^\/api\/runs\/([^/]+)(?:\/(.*))?$/);
    const run = runs.get(id);
    if (action === 'start') { run.status = 'running'; return { ...run }; }
    if (action === '') {
      if (run.status === 'running' && !neverStops && ++run.polls >= 2) {
        run.usage = { input: 1000, output: 100, calls: run.loopOnly ? 24 : 9 };
        if (run.loopOnly) run.status = 'budget_exceeded';
        else if (run.features.permissions) run.status = step7Status;
        else { run.status = 'completed'; run.appliedRevision = run.revision; }
      }
      return { ...run };
    }
    if (action === 'checks') { run.checks = { passed: 6, total: 6, origin: 'presenter', heldOut: { passed: 5, total: 5, origin: 'presenter' } }; run.events.push({ kind: 'checks', origin: 'presenter' }); return { ...run }; }
    if (action === 'probe') { run.events.push({ kind: 'permission', title: 'Protected-file boundary tested' }); return { ...run }; }
    if (action === 'pause') { run.status = 'paused'; return { ...run }; }
    throw new Error(`Unexpected route ${route}`);
  };
  return { api, calls, runs };
}

function fakes() {
  const shots = [], exports = [];
  let opened = 0, closed = 0;
  return {
    shots, exports, counts: () => ({ opened, closed }),
    exportRun: async (api, id) => { exports.push(id); const run = await api(`/api/runs/${id}`); return { ...run, changes: [], note: 'Visible events and tool evidence only.' }; },
    openScreens: async origin => { opened++; assert.equal(origin, PREVIEW); return { capture: async (url, file) => { shots.push({ url, file }); }, close: async () => { closed++; } }; }
  };
}

const quiet = { wait: async () => {}, log: () => {} };

test('phase record follows the plan, probes only step 2, never approves and stops at awaiting_approval', async () => {
  const dir = await tempDir();
  const server = fakeServer();
  const fake = fakes();
  const lines = [];
  const recording = await recordPhase({ ...DEFAULTS, out: dir, url: 'http://127.0.0.1:4318' }, { api: server.api, ...fake, ...quiet, log: line => lines.push(line) });
  // The billable-call warning comes before any request.
  assert.match(lines[0], /real, billable model calls/); assert.match(lines[0], /never approves/);
  assert.equal(server.calls[0].route, '/api/state');
  assert.equal(server.calls[1].route, '/api/model/task-only'); assert.deepEqual(server.calls[1].data, {});
  assert.equal(lines.at(-1), APPROVAL_MESSAGE);
  assert.ok(!server.calls.some(call => /approve/.test(call.route)), 'the recorder never approves');
  // Run creation bodies are exactly the plan, in order.
  const created = server.calls.filter(call => call.route === '/api/runs').map(call => call.data);
  assert.deepEqual(created, planSteps(5).slice(1).map(item => item.body));
  const ids = [...server.runs.keys()];
  assert.equal(ids.length, 8);
  // Per run: start, polls, presenter evaluation, then (step 2 only) the probe.
  for (const [index, id] of ids.entries()) {
    const routes = server.calls.map(call => call.route).filter(route => route.startsWith(`/api/runs/${id}`));
    const start = routes.indexOf(`/api/runs/${id}/start`), checks = routes.indexOf(`/api/runs/${id}/checks`), probe = routes.indexOf(`/api/runs/${id}/probe`);
    assert.ok(start >= 0 && checks > start, id);
    assert.equal(probe >= 0, index === 1, `probe only for step 2 (${id})`);
    if (probe >= 0) assert.ok(probe > checks, 'probe after the presenter evaluation');
  }
  // Runs are sequential: each run is created after the previous one was evaluated.
  const order = server.calls.map(call => call.route);
  for (let i = 1; i < ids.length; i++) assert.ok(order.indexOf(`/api/runs/${ids[i - 1]}/checks`) < order.indexOf(`/api/runs/${ids[i]}/start`));
  // Export happens after the probe, so the step-2 export carries the presenter probe event.
  assert.deepEqual(fake.exports, ids);
  assert.ok(recording.steps.step2.run.events.some(item => item.kind === 'permission'));
  // Screenshots: sandbox and production per run, step 7 production before approval.
  assert.deepEqual(fake.shots.map(shot => path.relative(dir, shot.file).split(path.sep).join('/')), [
    'screens/step1-sandbox.png', 'screens/step1-production.png', 'screens/step2-sandbox.png', 'screens/step2-production.png',
    'screens/step3-sandbox.png', 'screens/step3-production.png', 'screens/step4-sandbox.png', 'screens/step4-production.png',
    'screens/step5-sandbox.png', 'screens/step5-production.png', 'screens/step6-without-memory-sandbox.png', 'screens/step6-without-memory-production.png',
    'screens/step6-with-memory-sandbox.png', 'screens/step6-with-memory-production.png', 'screens/step7-sandbox.png', 'screens/step7-production-before.png'
  ]);
  assert.deepEqual(fake.shots.slice(0, 2).map(shot => shot.url), [`${PREVIEW}/preview/${ids[0]}/index.html`, `${PREVIEW}/production/${ids[0]}/index.html`]);
  assert.deepEqual(fake.counts(), { opened: 1, closed: 1 });
  // The file on disk is the C4 shape, with relative paths and embedded exports.
  const saved = await readJson(path.join(dir, 'recording.json'));
  assert.deepEqual(saved, JSON.parse(JSON.stringify(recording)));
  assert.equal(saved.note, NOTE); assert.equal(saved.complete, false); assert.equal(saved.finishedAt, null); assert.equal(saved.error, null);
  assert.equal(saved.model, 'example-model'); assert.equal(saved.protocol, 'responses'); assert.equal(saved.baseUrl, 'https://provider.example/v1');
  assert.equal(saved.origin, 'http://127.0.0.1:4318'); assert.equal(saved.resetAfterCalls, 5); assert.equal(saved.scenario, 'draft');
  assert.deepEqual(Object.keys(saved.steps), ['step0', 'step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7']);
  assert.equal(saved.steps.step0.id, 'mo-1'); assert.equal(saved.steps.step0.text, 'I would read storage.js.');
  assert.deepEqual(Object.keys(saved.steps.step6), ['withoutMemory', 'withMemory']);
  const step1 = saved.steps.step1;
  assert.deepEqual({ runId: step1.runId, status: step1.status, calls: step1.calls, export: step1.export, screens: step1.screens },
    { runId: ids[0], status: 'budget_exceeded', calls: 24, export: `runs/step1-loop-only-${ids[0]}.json`, screens: { sandbox: 'screens/step1-sandbox.png', production: 'screens/step1-production.png' } });
  assert.deepEqual(step1.run, await readJson(path.join(dir, step1.export)));
  assert.equal(saved.steps.step6.withMemory.export, `runs/step6-with-memory-${ids[6]}.json`);
  assert.equal(saved.steps.step6.withMemory.run.resetAfterCalls, 5);
  assert.deepEqual(saved.steps.step7.screens, { sandbox: 'screens/step7-sandbox.png', productionBefore: 'screens/step7-production-before.png', productionAfter: null });
  assert.equal(saved.steps.step7.status, 'awaiting_approval');
  // No temporary files are left behind by the atomic writes.
  assert.deepEqual((await fs.readdir(dir)).sort(), ['recording.json', 'runs']);
  assert.ok((await fs.readdir(path.join(dir, 'runs'))).every(name => name.endsWith('.json') && !name.includes('.tmp')));
});

test('phase record refuses without a provider and over an existing recording, before any run', async () => {
  const dir = await tempDir();
  const unconfigured = fakeServer({ configured: false });
  await assert.rejects(recordPhase({ ...DEFAULTS, out: dir }, { api: unconfigured.api, ...fakes(), ...quiet }), /No model provider is configured/);
  assert.deepEqual(unconfigured.calls.map(call => call.route), ['/api/state']);
  await fs.writeFile(path.join(dir, 'recording.json'), '{"keep":true}');
  const server = fakeServer();
  await assert.rejects(recordPhase({ ...DEFAULTS, out: dir }, { api: server.api, ...fakes(), ...quiet }), /already exists/);
  assert.equal(server.calls.length, 0);
  assert.equal(await fs.readFile(path.join(dir, 'recording.json'), 'utf8'), '{"keep":true}');
});

test('a failure leaves the partial recording with the error', async () => {
  const dir = await tempDir();
  const server = fakeServer({ failOn: (route, data) => route === '/api/runs' && data?.features?.verification === true });
  await assert.rejects(recordPhase({ ...DEFAULTS, out: dir }, { api: server.api, ...fakes(), ...quiet }), /Server refused/);
  const saved = await readJson(path.join(dir, 'recording.json'));
  assert.deepEqual(Object.keys(saved.steps), ['step0', 'step1', 'step2', 'step3', 'step4']);
  assert.equal(saved.complete, false); assert.equal(saved.error, 'Server refused the request');
});

test('a run over the time cap is paused and the recording stops', async () => {
  const dir = await tempDir();
  const server = fakeServer({ neverStops: true });
  let clock = 0;
  await assert.rejects(recordPhase({ ...DEFAULTS, out: dir }, { api: server.api, ...fakes(), log: () => {}, now: () => clock, wait: async ms => { clock += ms; }, timeoutMs: 6000 }), /exceeded .* paused/);
  const [first] = server.runs.keys();
  assert.ok(server.calls.some(call => call.route === `/api/runs/${first}/pause`));
  assert.equal([...server.runs.values()].length, 1, 'no further run was created');
  assert.match((await readJson(path.join(dir, 'recording.json'))).error, /paused/);
});

test('a key-like value is never written', async () => {
  const dir = await tempDir();
  const server = fakeServer();
  const fake = fakes();
  const leaky = async (api, id) => ({ ...(await fake.exportRun(api, id)), detail: 'Authorization: Bearer sk-live1234567890' });
  await assert.rejects(recordPhase({ ...DEFAULTS, out: dir }, { api: server.api, ...fake, exportRun: leaky, ...quiet }), /looks like an API key/);
  const text = await fs.readFile(path.join(dir, 'recording.json'), 'utf8');
  assert.ok(!text.includes('sk-live')); assert.deepEqual(Object.keys(JSON.parse(text).steps), ['step0']);
  assert.ok(!(await fs.readdir(dir)).includes('runs') || (await fs.readdir(path.join(dir, 'runs'))).length === 0);
});

test('step 7 that does not wait for approval is kept but reported as an error', async () => {
  const dir = await tempDir();
  const server = fakeServer({ step7Status: 'budget_exceeded' });
  await assert.rejects(recordPhase({ ...DEFAULTS, out: dir }, { api: server.api, ...fakes(), ...quiet }), /budget_exceeded, not awaiting_approval/);
  const saved = await readJson(path.join(dir, 'recording.json'));
  assert.equal(saved.steps.step7.status, 'budget_exceeded'); assert.match(saved.error, /not awaiting_approval/);
});

test('phase finish refuses until step 7 is completed and applied, then completes the recording', async () => {
  const dir = await tempDir();
  await assert.rejects(finishPhase({ ...DEFAULTS, out: dir, phase: 'finish' }, { api: fakeServer().api, ...fakes(), ...quiet }), /No recording/);
  const server = fakeServer();
  await recordPhase({ ...DEFAULTS, out: dir }, { api: server.api, ...fakes(), ...quiet });
  const file = path.join(dir, 'recording.json');
  const before = await fs.readFile(file, 'utf8');
  const step7Id = [...server.runs.keys()].at(-1);
  const fake = fakes();
  // Still awaiting approval: refused, nothing changed, nothing exported or captured.
  await assert.rejects(runRecorder({ ...DEFAULTS, out: dir, phase: 'finish' }, { api: server.api, ...fake, ...quiet }), /awaiting_approval with no applied revision/);
  assert.equal(await fs.readFile(file, 'utf8'), before);
  assert.deepEqual(fake.exports, []); assert.deepEqual(fake.shots, []);
  // Completed without a publication is refused too.
  server.runs.get(step7Id).status = 'completed';
  await assert.rejects(finishPhase({ ...DEFAULTS, out: dir, phase: 'finish' }, { api: server.api, ...fake, ...quiet }), /no applied revision/);
  assert.equal(await fs.readFile(file, 'utf8'), before);
  // The presenter approved in the dashboard (simulated here on the fake run).
  Object.assign(server.runs.get(step7Id), { appliedRevision: 'r8', events: [...server.runs.get(step7Id).events, { kind: 'approval', title: 'Presenter approved' }] });
  const finished = await finishPhase({ ...DEFAULTS, out: dir, phase: 'finish' }, { api: server.api, ...fake, ...quiet });
  assert.ok(!server.calls.some(call => /approve/.test(call.route)));
  assert.equal(finished.complete, true); assert.ok(!Number.isNaN(Date.parse(finished.finishedAt)));
  const step7 = (await readJson(file)).steps.step7;
  assert.equal(step7.status, 'completed');
  assert.equal(step7.exportBeforeApproval, `runs/step7-engineered-${step7Id}.json`);
  assert.equal(step7.export, `runs/step7-engineered-${step7Id}-after-approval.json`);
  assert.deepEqual(step7.run, await readJson(path.join(dir, step7.export)));
  assert.equal((await readJson(path.join(dir, step7.exportBeforeApproval))).status, 'awaiting_approval', 'the pre-approval export is kept');
  assert.deepEqual(step7.screens, { sandbox: 'screens/step7-sandbox.png', productionBefore: 'screens/step7-production-before.png', productionAfter: 'screens/step7-production-after.png' });
  assert.deepEqual(fake.shots.map(shot => shot.url), [`${PREVIEW}/production/${step7Id}/index.html`]);
  await assert.rejects(finishPhase({ ...DEFAULTS, out: dir, phase: 'finish' }, { api: server.api, ...fake, ...quiet }), /already complete/);
});
