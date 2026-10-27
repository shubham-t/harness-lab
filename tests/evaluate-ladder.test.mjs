// Ladder planning, argument validation and summary derivation for
// scripts/evaluate.mjs. Every test uses an injected fake API: no network call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PRESETS, RESET_AFTER_CALLS } from '../lib/store.mjs';
import { parseArgs, parseRung, planTrials, runRequest, claimedWithoutRefreshTest, appliedWithoutReview, summarizeRun, runEvaluation, DEFAULT_LADDER, UsageError } from '../scripts/evaluate.mjs';

const script = fileURLToPath(new URL('../scripts/evaluate.mjs', import.meta.url));
const tool = (name, args = {}) => ({ kind: 'tool', tool: name, arguments: args });
const labels = plan => plan.map(item => `${item.scenario}/${item.trial}/${item.rung.label}`);

test('default options keep the Minimal and Engineered pair with alternating order', () => {
  const options = parseArgs(['--trials', '2', '--scenarios', 'draft,unicode']);
  assert.equal(options.ladder, false); assert.equal(options.resetAfterCalls, null); assert.equal(options.out, null);
  assert.deepEqual(labels(planTrials(options)), [
    'draft/1/minimal', 'draft/1/engineered', 'draft/2/engineered', 'draft/2/minimal',
    'unicode/1/minimal', 'unicode/1/engineered', 'unicode/2/engineered', 'unicode/2/minimal'
  ]);
  const [minimal, engineered] = planTrials(parseArgs([]));
  assert.deepEqual(runRequest(minimal), { mode: 'minimal', features: PRESETS.minimal, scenario: 'draft' });
  assert.deepEqual(runRequest(engineered), { mode: 'engineered', features: PRESETS.engineered, scenario: 'draft' });
});

test('--ladder runs five rungs per trial, reversing the order on even trials', () => {
  const plan = planTrials(parseArgs(['--ladder', '--trials', '3']));
  assert.equal(plan.length, 15);
  const first = ['minimal', 'verification', 'verification+instructions+context', 'verification+instructions+context+memory', 'engineered'];
  assert.deepEqual(plan.slice(0, 5).map(item => item.rung.label), first);
  assert.deepEqual(plan.slice(5, 10).map(item => item.rung.label), [...first].reverse());
  assert.deepEqual(plan.slice(10).map(item => item.rung.label), first);
  assert.deepEqual(plan.map(item => item.trial), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
  const features = Object.fromEntries(plan.slice(0, 5).map(item => [item.rung.label, item.rung.features]));
  assert.deepEqual(features.minimal, PRESETS.minimal);
  assert.deepEqual(features.verification, { instructions: false, context: false, memory: false, verification: true, permissions: false });
  assert.deepEqual(features['verification+instructions+context'], { instructions: true, context: true, memory: false, verification: true, permissions: false });
  assert.deepEqual(features['verification+instructions+context+memory'], { instructions: true, context: true, memory: true, verification: true, permissions: false });
  assert.deepEqual(features.engineered, PRESETS.engineered);
  assert.equal(DEFAULT_LADDER.length, 5);
});

test('--rungs accepts custom feature sets and rejects ambiguous ones', () => {
  const options = parseArgs(['--rungs', 'minimal; memory+verification ;context,instructions;engineered', '--scenarios', 'longform']);
  assert.deepEqual(planTrials(options).map(item => item.rung.label), ['minimal', 'verification+memory', 'instructions+context', 'engineered']);
  assert.deepEqual(parseRung('permissions+memory+context+instructions+verification'), { label: 'engineered', mode: 'engineered', features: PRESETS.engineered });
  assert.equal(parseRung('permissions').features.permissions, true);
  for (const [rungs, message] of [
    ['minimal,verification', /preset/], ['verification;sandbox', /Unknown feature "sandbox"/], ['verification;verification', /more than once/],
    ['memory+verification;verification,memory', /more than once/], ['memory+memory', /repeated/], [';;', /at least one rung/]
  ]) assert.throws(() => parseArgs(['--rungs', rungs]), error => error instanceof UsageError && message.test(error.message), rungs);
});

test('--reset-after passes resetAfterCalls to every run and is bounded like the server', () => {
  const options = parseArgs(['--ladder', '--reset-after', '6']);
  assert.equal(options.resetAfterCalls, 6);
  for (const item of planTrials(options)) assert.equal(runRequest(item, options.resetAfterCalls).resetAfterCalls, 6);
  assert.equal(parseArgs(['--reset-after', String(RESET_AFTER_CALLS.min)]).resetAfterCalls, RESET_AFTER_CALLS.min);
  assert.equal(parseArgs(['--reset-after', String(RESET_AFTER_CALLS.max)]).resetAfterCalls, RESET_AFTER_CALLS.max);
  for (const value of [String(RESET_AFTER_CALLS.min - 1), String(RESET_AFTER_CALLS.max + 1), '2.5', 'six', '-3'])
    assert.throws(() => parseArgs(['--reset-after', value]), UsageError, value);
});

test('argument validation rejects bad values before anything runs', () => {
  for (const argv of [
    ['--trials', '0'], ['--trials', '11'], ['--trials', '1.5'], ['--trials', 'two'], ['--trials'],
    ['--scenarios', 'draft,emoji'], ['--scenarios', 'draft,draft'], ['--out'], ['--out', '--ladder'],
    ['--url', 'not a url'], ['--url', 'ftp://127.0.0.1'], ['--laddr'], ['--ladder', '--ladder'], ['--trials', '1', '--trials', '2']
  ]) assert.throws(() => parseArgs(argv), UsageError, argv.join(' '));
  assert.equal(parseArgs(['--out', 'results/ladder.json']).out, 'results/ladder.json');
  assert.equal(parseArgs(['--url', 'http://127.0.0.1:4318/']).url, 'http://127.0.0.1:4318');
});

test('the command line prints usage and refuses invalid arguments without calling a server', () => {
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /--ladder/); assert.match(help.stdout, /real, billable model calls/);
  const bad = spawnSync(process.execPath, [script, '--ladder', '--reset-after', '99'], { encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /--reset-after must be an integer from 2 to 23/); assert.match(bad.stderr, /Usage:/);
});

test('claimed without a refresh test is derived from recorded tool events only', () => {
  const write = tool('write_file', { path: 'src/storage.js' });
  const complete = tool('request_completion', { summary: 'Draft survives page refresh.' });
  assert.equal(claimedWithoutRefreshTest([write, tool('browser_action', { action: 'click', target: 'notes-tab' }), complete]), true);
  assert.equal(claimedWithoutRefreshTest([write, tool('browser_action', { action: 'reload', target: '' }), complete]), false);
  assert.equal(claimedWithoutRefreshTest([write, tool('run_checks'), complete]), false);
  // A reload before the last edit does not test the final source.
  assert.equal(claimedWithoutRefreshTest([tool('browser_action', { action: 'reload' }), write, complete]), true);
  // No completion request means nothing was claimed.
  assert.equal(claimedWithoutRefreshTest([write]), false);
  assert.equal(claimedWithoutRefreshTest([]), false);
  // No edit at all: every action after the start counts.
  assert.equal(claimedWithoutRefreshTest([complete]), true);
  assert.equal(claimedWithoutRefreshTest([tool('browser_action', { action: 'reload' }), complete]), false);
  // Only tool events count; results, model text and presenter checks do not.
  assert.equal(claimedWithoutRefreshTest([write, { kind: 'assistant', detail: 'I reloaded the page.' }, { kind: 'tool_result', tool: 'run_checks' }, { kind: 'checks', origin: 'presenter' }, complete]), true);
});

test('applied without review needs completion, approval off and a publication', () => {
  const off = { ...PRESETS.minimal, verification: true };
  assert.equal(appliedWithoutReview({ status: 'completed', features: off, appliedRevision: 'abc' }), true);
  assert.equal(appliedWithoutReview({ status: 'completed', features: PRESETS.engineered, appliedRevision: 'abc' }), false);
  assert.equal(appliedWithoutReview({ status: 'completed', features: off, appliedRevision: null }), false);
  assert.equal(appliedWithoutReview({ status: 'budget_exceeded', features: off, appliedRevision: null }), false);
  assert.equal(appliedWithoutReview({ status: 'awaiting_approval', features: PRESETS.engineered, appliedRevision: null }), false);
});

test('a run summary records rung, tiers, usage and the two derived flags', () => {
  const rung = parseRung('minimal');
  const run = {
    id: 'run-1', mode: 'minimal', scenario: 'draft', features: PRESETS.minimal, harnessVersion: 4, provider: { model: 'example-model' },
    resetAfterCalls: 6, status: 'completed', revision: 'aaa', appliedRevision: 'aaa', elapsedMs: 4200,
    usage: { input: 1000, output: 200, calls: 9, unreportedRequests: 1 },
    checks: { suiteVersion: 'notes-v3', tier: 'visible', revision: 'aaa', passed: 6, total: 6, origin: 'presenter', results: [], heldOut: { suiteVersion: 'notes-v3', tier: 'heldOut', revision: 'aaa', passed: 4, total: 5, origin: 'presenter', results: [] } },
    events: [{ kind: 'reset', call: 6 }, tool('write_file'), tool('request_completion')]
  };
  assert.deepEqual(summarizeRun(run, { scenario: 'draft', trial: 2, rung }), {
    trial: 2, scenario: 'draft', rung: 'minimal', runId: 'run-1', mode: 'minimal', features: PRESETS.minimal, harnessVersion: 4, model: 'example-model',
    resetAfterCalls: 6, forcedReset: true, status: 'completed',
    visible: { passed: 6, total: 6, suiteVersion: 'notes-v3', revision: 'aaa', currentRevision: true, origin: 'presenter' },
    heldOut: { passed: 4, total: 5, suiteVersion: 'notes-v3', revision: 'aaa', currentRevision: true, origin: 'presenter' },
    calls: 9, tokens: { input: 1000, output: 200, total: 1200, unreportedRequests: 1 }, elapsedMs: 4200,
    appliedWithoutReview: true, claimedWithoutRefreshTest: true
  });
  const unmeasured = summarizeRun({ id: 'run-2', status: 'failed', features: PRESETS.engineered, revision: 'bbb', checks: null, events: [] }, { scenario: 'unicode', trial: 1, rung: parseRung('engineered') });
  assert.equal(unmeasured.visible, null); assert.equal(unmeasured.heldOut, null); assert.equal(unmeasured.calls, null);
  assert.equal(unmeasured.tokens.total, null); assert.equal(unmeasured.forcedReset, false); assert.equal(unmeasured.scenario, 'unicode');
  const stale = summarizeRun({ ...run, revision: 'ccc' }, { scenario: 'draft', trial: 1, rung });
  assert.equal(stale.visible.currentRevision, false); assert.equal(stale.heldOut.currentRevision, false);
});

function fakeServer({ configured = true } = {}) {
  const calls = [];
  let next = 0;
  const runs = new Map();
  const api = async (route, data) => {
    calls.push({ route, data });
    if (route === '/api/state') return { provider: { configured, model: configured ? 'example-model' : '' } };
    if (route === '/api/runs') {
      const run = { id: `run-${++next}`, mode: data.mode, scenario: data.scenario, features: data.features, resetAfterCalls: data.resetAfterCalls ?? null, harnessVersion: 4, status: 'ready', revision: 'r' + next, usage: { input: 10, output: 5, calls: 3 }, elapsedMs: 100, events: [] };
      runs.set(run.id, run); return run;
    }
    const [, id, action] = route.match(/^\/api\/runs\/([^/]+)(?:\/(.*))?$/);
    const run = runs.get(id);
    if (action === 'start') {
      run.status = 'completed';
      run.events = [tool('write_file'), tool('request_completion')];
      if (!run.features.permissions) run.appliedRevision = run.revision; else run.status = 'awaiting_approval';
      return run;
    }
    if (action === 'checks') { run.checks = { suiteVersion: 'notes-v3', revision: run.revision, passed: 6, total: 6, origin: 'presenter', heldOut: { suiteVersion: 'notes-v3', revision: run.revision, passed: 5, total: 5, origin: 'presenter' } }; return run; }
    return run;
  };
  return { api, calls };
}

test('the evaluation refuses to start without a configured provider and creates no run', async () => {
  const { api, calls } = fakeServer({ configured: false });
  await assert.rejects(runEvaluation(parseArgs(['--ladder']), { api, log: () => {}, wait: async () => {} }), /No model provider is configured/);
  assert.deepEqual(calls.map(call => call.route), ['/api/state']);
});

test('a ladder evaluation sends equal settings, measures each run and writes the summary', async () => {
  const { api, calls } = fakeServer();
  const written = [], lines = [];
  const report = await runEvaluation(parseArgs(['--ladder', '--trials', '2', '--reset-after', '5', '--out', 'ladder.json']), {
    api, log: line => lines.push(line), wait: async () => {}, write: async (file, data) => written.push({ file, data: JSON.parse(JSON.stringify(data)) })
  });
  const created = calls.filter(call => call.route === '/api/runs').map(call => call.data);
  assert.equal(created.length, 10);
  assert.ok(created.every(body => body.resetAfterCalls === 5 && body.scenario === 'draft'));
  assert.equal(calls.filter(call => call.route.endsWith('/checks')).length, 10);
  assert.match(lines[0], /10 real, billable model trials/); assert.match(lines[0], /after model call 5/);
  assert.equal(report.complete, true); assert.equal(report.runs.length, 10);
  assert.deepEqual(report.options, { ladder: true, rungs: ['minimal', 'verification', 'verification+instructions+context', 'verification+instructions+context+memory', 'engineered'], trials: 2, scenarios: ['draft'], resetAfterCalls: 5 });
  assert.deepEqual(report.runs.map(run => run.rung).slice(4, 6), ['engineered', 'engineered']);
  const byRung = Object.fromEntries(report.runs.filter(run => run.trial === 1).map(run => [run.rung, run]));
  assert.equal(byRung.minimal.appliedWithoutReview, true); assert.equal(byRung.engineered.appliedWithoutReview, false);
  assert.equal(byRung.engineered.status, 'awaiting_approval'); assert.equal(byRung.minimal.heldOut.passed, 5);
  assert.ok(report.runs.every(run => run.claimedWithoutRefreshTest === true));
  assert.equal(written.length, 11); assert.ok(written.every(item => item.file === 'ladder.json'));
  assert.equal(written.at(-1).data.complete, true); assert.equal(written[0].data.runs.length, 1);
});

test('a failed trial still writes the partial summary with the error', async () => {
  const { api } = fakeServer();
  const failing = async (route, data) => { if (route === '/api/runs' && data.features.memory) throw new Error('Server refused the run'); return api(route, data); };
  const written = [];
  await assert.rejects(runEvaluation(parseArgs(['--ladder', '--out', 'x.json']), { api: failing, log: () => {}, wait: async () => {}, write: async (file, data) => written.push(JSON.parse(JSON.stringify(data))) }), /Server refused/);
  const last = written.at(-1);
  assert.equal(last.complete, false); assert.equal(last.error, 'Server refused the run'); assert.equal(last.runs.length, 3);
});
