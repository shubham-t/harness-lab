// Harness builder runtime tests (package A). Provider transport is mocked only
// inside this test process; files, events, prompt assembly and the loop are
// real. Nothing produced here is model evidence or enters the demo history.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.HARNESS_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-builder-runner-'));
process.env.OPENAI_API_KEY = '';
process.env.OPENAI_MODEL = '';
process.env.OPENAI_BASE_URL = '';
const { configureProvider, getPublicConfig } = await import('../lib/provider.mjs');
const { createRun, revision } = await import('../lib/store.mjs');
const { executeTool, startRun, pauseRun, running, toolsForRun, assembleModelInput, TOOL_SCHEMAS, MODEL_ONLY_INSTRUCTIONS } = await import('../lib/runner.mjs');
const { anatomyState, componentsForEvent } = await import('../public/anatomy.mjs');
const { preset, outcome, comparableRuns, ladderTable, ladderFilters } = await import('../public/lesson.mjs');
configureProvider({ apiKey: 'unit-only-never-send', model: 'unit-model', baseUrl: 'https://unit.invalid/v1' });
globalThis.fetch = async () => { throw new Error('Network prohibited in builder runner unit tests'); };
test.after(async () => { await fs.rm(process.env.HARNESS_DATA_DIR, { recursive: true, force: true }); });

const LOOP_SENTENCE = 'This is an agent loop without tools: each reply is recorded, the harness answers with what changed (nothing can change without tools), and the loop repeats until the budget ends.';
const UNAVAILABLE = name => `Tool ${name} is unavailable in this harness configuration.`;
const NONE = { instructions: false, context: false, memory: false, verification: false, permissions: false };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, description, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; await delay(10); }
  assert.fail(`Timed out waiting for ${description}`);
}
const json = body => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
const textReply = n => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: `TEST ONLY scripted reply ${n}: I would inspect storage.js.` }] }], usage: { input_tokens: 5, output_tokens: 3 } });
const callReply = (n, name, args) => ({ status: 'completed', output: [{ type: 'function_call', call_id: `builder-unit-${n}`, name, arguments: JSON.stringify(args) }], usage: { input_tokens: 5, output_tokens: 3 } });

test('createRun validates loopOnly and stores it as a boolean', async () => {
  for (const value of ['true', 1, 0, null, {}, []]) await assert.rejects(createRun({ mode: 'minimal', loopOnly: value }), { message: 'loopOnly must be true, false or omitted.' }, JSON.stringify(value));
  for (const features of [{ instructions: true }, { context: true }, { memory: true }, { verification: true }, { permissions: true }]) {
    await assert.rejects(createRun({ mode: 'minimal', loopOnly: true, features }), { message: 'A loop-only run cannot enable harness features.' }, JSON.stringify(features));
  }
  await assert.rejects(createRun({ mode: 'engineered', loopOnly: true }), { message: 'A loop-only run cannot enable harness features.' });
  await assert.rejects(createRun({ mode: 'engineered', loopOnly: true, features: NONE }), /must use mode minimal/);
  await assert.rejects(createRun({ mode: 'minimal', loopOnly: true, resetAfterCalls: 1 }), /resetAfterCalls/);
  const loop = await createRun({ mode: 'minimal', loopOnly: true, features: { context: false } });
  assert.equal(loop.loopOnly, true);
  assert.deepEqual(loop.features, NONE);
  assert.equal(loop.harnessVersion, 4);
  assert.equal((await createRun({ mode: 'minimal', loopOnly: true, resetAfterCalls: 3 })).resetAfterCalls, 3);
  assert.equal((await createRun({ mode: 'minimal' })).loopOnly, false, 'New runs always store a boolean');
  assert.equal((await createRun({ mode: 'engineered', loopOnly: false })).loopOnly, false);
});

test('a loop-only run has no tools and rejects every requested tool with the unavailable message', async () => {
  const loop = await createRun({ mode: 'minimal', loopOnly: true });
  const minimal = await createRun({ mode: 'minimal' });
  assert.deepEqual(toolsForRun(loop), []);
  assert.ok(toolsForRun(minimal).length > 0, 'Minimal keeps its tools');
  const args = { list_files: {}, read_file: { path: 'PROJECT.md' }, write_file: { path: 'src/storage.js', content: 'x' }, browser_action: { action: 'inspect', target: '', value: '' }, run_checks: {}, save_memory: { content: 'x' }, request_completion: { summary: 'x' } };
  for (const tool of TOOL_SCHEMAS) await assert.rejects(executeTool(loop, tool.name, args[tool.name]), { message: UNAVAILABLE(tool.name) }, tool.name);
  assert.equal(loop.revision, await revision(loop.id), 'Nothing changed in the workspace');
  assert.equal(loop.appliedRevision, null);
});

test('MODEL_ONLY_INSTRUCTIONS is the base of the loop-only prompt; no feature sections exist', async () => {
  assert.equal(MODEL_ONLY_INSTRUCTIONS, 'You are asked to fix the real Pocket Notes application. You have no tools: you cannot read or change files, run checks or use a browser. Reply with what you would do. The source files are not available to you.');
  const loop = await createRun({ mode: 'minimal', loopOnly: true });
  const { text, sections } = await assembleModelInput(loop);
  assert.ok(text.startsWith(`${MODEL_ONLY_INSTRUCTIONS} ${LOOP_SENTENCE}\nRemaining model calls: 24 of 24.`), text);
  assert.deepEqual(sections, {});
  for (const absent of ['You are a software agent', 'No automated acceptance suite', 'Use the file and browser tools', 'Completion is gated', 'explicit human approval', 'PN-142']) assert.equal(text.includes(absent), false, absent);
  const minimal = await assembleModelInput(await createRun({ mode: 'minimal' }));
  assert.match(minimal.text, /^You are a software agent fixing the real Pocket Notes application/, 'Minimal prompt is unchanged');
  assert.equal(minimal.text.includes(MODEL_ONLY_INSTRUCTIONS), false);
});

test('loop-only run: no tools sent, observations recorded and returned, hallucinated tool recorded, stops at the call budget', async t => {
  const observed = [];
  // Call 2 hallucinates a tool; every other call replies with text only.
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    observed.push(JSON.parse(options.body));
    const n = observed.length;
    return json(n === 2 ? callReply(n, 'list_files', {}) : textReply(n));
  });
  const run = await createRun({ mode: 'minimal', loopOnly: true, provider: getPublicConfig() });
  const startRevision = run.revision;
  startRun(run);
  await waitFor(() => run.status !== 'running' && !running(run.id), 'loop-only run to stop');
  assert.equal(run.status, 'budget_exceeded');
  assert.equal(run.usage.calls, 24);
  assert.equal(observed.length, 24, 'Exactly the shared 24-call budget');
  for (const body of observed) {
    assert.deepEqual(body.tools, [], 'Responses request carries no tool schema');
    assert.ok(body.instructions.startsWith(`${MODEL_ONLY_INSTRUCTIONS} ${LOOP_SENTENCE}`));
  }
  assert.match(observed[0].instructions, /Remaining model calls: 24 of 24/);
  assert.match(observed[23].instructions, /Remaining model calls: 1 of 24/);
  assert.deepEqual(observed[0].input, [{ role: 'user', content: run.task }]);

  const observation = `Observation: no action was requested and no tools exist in this configuration, so nothing changed. Source revision ${startRevision} is unchanged. The draft still disappears. Continue.`;
  const observations = run.events.filter(item => item.kind === 'observation');
  assert.equal(observations.length, 23, 'One observation after every text-only reply');
  assert.deepEqual(observations.map(item => item.call), Array.from({ length: 24 }, (_, i) => i + 1).filter(call => call !== 2));
  for (const item of observations) {
    assert.equal(item.title, 'Observation returned to the model');
    assert.equal(item.detail, observation);
    assert.equal(item.session, 1);
  }
  // The next request carries the recorded observation as the newest user message.
  assert.deepEqual(observed[1].input.at(-1), { role: 'user', content: observation });
  assert.equal(observed[1].input.length, 3, 'task, reply, observation');
  // Call 2 requested a tool that does not exist in this configuration.
  const failure = run.events.find(item => item.kind === 'tool_error');
  assert.equal(failure.title, 'Tool failed: list_files');
  assert.equal(failure.detail, UNAVAILABLE('list_files'));
  assert.deepEqual(observed[2].input.at(-1), { type: 'function_call_output', call_id: 'builder-unit-2', output: JSON.stringify({ error: UNAVAILABLE('list_files') }) });
  assert.equal(run.events.filter(item => item.kind === 'tool_error').length, 1);
  // The hallucinated call is followed by its tool output, not an observation.
  assert.equal(run.events.some(item => item.kind === 'observation' && item.call === 2), false);

  const budget = run.events.filter(item => item.kind === 'budget');
  assert.equal(budget.length, 1);
  assert.match(budget[0].detail, /Used 24\/24 model calls/);
  assert.equal(run.events.some(item => ['edit', 'browser', 'verification', 'permission', 'completion', 'instructions', 'context', 'memory'].includes(item.kind)), false);
  assert.equal(JSON.stringify(observed).includes('Use the available tools to investigate'), false, 'The tool nudge is never sent to a loop-only run');
  assert.equal(await revision(run.id), startRevision);
  assert.equal(run.appliedRevision, null);

  // Anatomy over every prefix of the recorded trace: Tools stays Off and never highlights.
  for (let i = 0; i <= run.events.length; i++) {
    const state = anatomyState({ ...run, status: i === run.events.length ? run.status : 'running', events: run.events.slice(0, i) });
    const tools = state.cards.find(card => card.id === 'tools');
    assert.equal(tools.enabled, false);
    assert.equal(tools.badge, 'Off');
    assert.equal(tools.highlight, false, `prefix ${i}: ${run.events[i - 1]?.kind}`);
    assert.equal(tools.eventIndex, -1);
    assert.deepEqual(state.cards.filter(card => card.enabled).map(card => card.id), ['loop']);
    assert.equal(state.trail.some(entry => entry.components.includes('tools')), false);
  }
});

test('the tool nudge for runs with tools is unchanged and not recorded as an event', async t => {
  const observed = [];
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    observed.push(JSON.parse(options.body));
    if (observed.length === 1) return json(textReply(1));
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  });
  const run = await createRun({ mode: 'minimal', provider: getPublicConfig() });
  startRun(run);
  await waitFor(() => observed.length === 2, 'second request');
  await pauseRun(run);
  assert.deepEqual(observed[1].input.at(-1), { role: 'user', content: 'Use the available tools to investigate and implement the task. When ready, call request_completion with your change and verification summary.' });
  assert.ok(observed[0].tools.length > 0);
  assert.equal(run.events.some(item => item.kind === 'observation'), false);
});

test('a Chat Completions loop-only request has no tools entry at all', async t => {
  configureProvider({ protocol: 'chat-completions' });
  t.after(() => configureProvider({ protocol: 'responses' }));
  const observed = [];
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    observed.push(JSON.parse(options.body));
    if (observed.length === 1) return json({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'TEST ONLY chat reply.' } }], usage: { prompt_tokens: 4, completion_tokens: 2 } });
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  });
  const run = await createRun({ mode: 'minimal', loopOnly: true, provider: getPublicConfig() });
  startRun(run);
  await waitFor(() => observed.length === 2, 'second chat request');
  await pauseRun(run);
  for (const body of observed) {
    assert.equal('tools' in body, false);
    assert.equal('parallel_tool_calls' in body, false);
    assert.ok(body.messages[0].content.startsWith(MODEL_ONLY_INSTRUCTIONS));
  }
  assert.match(observed[1].messages.at(-1).content, /^Observation: no action was requested/);
  assert.equal(run.status, 'paused');
});

test('anatomy: Tools card Off for loop-only, observation maps to the loop, a disabled card never highlights', () => {
  assert.deepEqual(componentsForEvent({ kind: 'observation' }), ['loop']);
  const base = { harnessVersion: 4, features: NONE, loopOnly: true, status: 'running' };
  const tools = run => anatomyState(run).cards.find(card => card.id === 'tools');
  assert.equal(tools({ ...base, events: [] }).note, 'No tools: the model can only reply with text');
  for (const latest of [{ kind: 'tool', tool: 'list_files' }, { kind: 'tool_error', title: 'Tool failed: list_files' }, { kind: 'tool_result', tool: 'write_file' }, { kind: 'edit' }, { kind: 'browser' }, { kind: 'permission', title: 'Protected-file boundary tested' }]) {
    const state = anatomyState({ ...base, events: [latest] });
    assert.equal(state.cards.find(card => card.id === 'tools').highlight, false, JSON.stringify(latest));
    assert.equal(state.cards.some(card => card.highlight && !card.enabled), false);
  }
  const looping = anatomyState({ ...base, events: [{ kind: 'observation', title: 'Observation returned to the model' }] });
  assert.equal(looping.cards.find(card => card.id === 'loop').highlight, true);
  const stopped = anatomyState({ ...base, status: 'budget_exceeded', events: [{ kind: 'budget' }] });
  assert.equal(stopped.cards.find(card => card.id === 'loop').highlight, true);
  assert.equal(stopped.cards.find(card => card.id === 'tools').highlight, false);
  // Runs with tools are unchanged.
  const minimal = anatomyState({ ...base, loopOnly: false, events: [{ kind: 'tool', tool: 'list_files' }] }).cards.find(card => card.id === 'tools');
  assert.deepEqual([minimal.enabled, minimal.badge, minimal.note, minimal.highlight], [true, 'Enabled', 'Real files and browser', true]);
  assert.equal(anatomyState({ harnessVersion: 4, features: NONE, status: 'ready', events: [] }).cards.find(card => card.id === 'tools').enabled, true, 'Runs recorded before loopOnly existed keep Tools enabled');
});

test('lesson: preset, outcome, comparison and ladder treat loop-only runs as builder evidence only', () => {
  const provider = { model: 'm', baseUrl: 'https://unit.invalid', protocol: 'responses' };
  const common = { task: 'same task', harnessVersion: 4, scenario: 'draft', revision: 'r', usage: { calls: 24 }, provider, createdAt: '2026-10-27', events: [] };
  const loop = { ...common, id: 'loop', features: NONE, loopOnly: true, status: 'budget_exceeded' };
  const minimal = { ...common, id: 'min', features: NONE, loopOnly: false, status: 'completed', createdAt: '2026-10-26' };
  const engineered = { ...common, id: 'eng', features: { instructions: true, context: true, memory: true, verification: true, permissions: true }, status: 'awaiting_approval' };
  assert.equal(preset(loop), 'Loop only');
  assert.equal(preset(minimal), 'Minimal');
  assert.equal(preset({ features: NONE }), 'Minimal', 'Older runs without the field stay Minimal');
  assert.equal(outcome(loop, 'notes-v3').required, 'No tools and no acceptance check: the model could only reply with text');
  assert.match(outcome(minimal, 'notes-v3').required, /No acceptance check required/);
  assert.deepEqual(comparableRuns(loop, [minimal, engineered]), [], 'A loop-only run is never paired');
  assert.deepEqual(comparableRuns(engineered, [loop, minimal]).map(run => run.id), ['min'], 'Never offered as the other side');
  assert.deepEqual(comparableRuns(minimal, [loop, engineered]).map(run => run.id), ['eng']);

  const group = (extra) => ({ model: 'm', scenario: 'draft', harnessVersion: 4, resetAfterCalls: null, features: NONE, suiteVersion: 'unassessed', trials: 1, verified: 0, heldOutVerified: 0, recordedPasses: 0, failed: 0, inputTokens: 10, outputTokens: 5, unreportedRequests: 0, ...extra });
  const evals = { checkSuiteVersion: 'notes-v3', groups: [group({ loopOnly: false, runIds: ['min'] }), group({ loopOnly: true, failed: 1, trials: 1, inputTokens: 999, runIds: ['loop'] })] };
  const filters = ladderFilters(evals.groups, [loop, minimal]);
  assert.equal(filters.length, 1);
  const rows = ladderTable(evals, [loop, minimal], filters[0].key);
  assert.equal(rows[0].label, 'Minimal');
  assert.equal(rows[0].trials, 1, 'The loop-only group is not counted as Minimal');
  assert.equal(rows[0].avgTokens, 15);
  assert.equal(rows.some(row => row.custom), false);
  assert.deepEqual(ladderFilters([group({ loopOnly: true, runIds: ['loop'] })], [loop]), [], 'Loop-only evidence alone creates no ladder filter');
});
