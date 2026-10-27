// Runs real model trials against the running local server. Every trial makes
// real, billable provider calls. The pure helpers below are exported so tests
// can check argument handling, rung planning and summaries without any network.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateStoppedRun } from './evaluation-client.mjs';
import { PRESETS, RESET_AFTER_CALLS } from '../lib/store.mjs';

export const SCENARIOS = ['draft', 'unicode', 'longform'];
export const FEATURE_KEYS = Object.keys(PRESETS.engineered);
// Order used for rung labels. It follows the ladder: verification first.
const FEATURE_ORDER = ['verification', 'instructions', 'context', 'memory', 'permissions'];
if (FEATURE_KEYS.some(key => !FEATURE_ORDER.includes(key))) throw new Error('evaluate.mjs does not know every harness feature. Update FEATURE_ORDER.');
export const DEFAULT_LADDER = ['minimal', 'verification', 'verification,instructions,context', 'verification,instructions,context,memory', 'engineered'];

export const USAGE = `Usage: node scripts/evaluate.mjs [options]
  --trials N          Trials per scenario, 1 to 10 (default 1).
  --scenarios LIST    Comma-separated: ${SCENARIOS.join(',')} (default draft).
  --ladder            Run five rungs per trial: ${DEFAULT_LADDER.join(' ; ')}.
  --rungs LIST        Custom rungs instead. Separate rungs with ";" and features with "+" or ",".
                      Features: ${FEATURE_KEYS.join(', ')}. Use minimal or engineered alone.
                      Example: --rungs "minimal;verification;verification+memory;engineered"
  --reset-after N     Force one fresh session after model call N (${RESET_AFTER_CALLS.min} to ${RESET_AFTER_CALLS.max}) in every run.
  --out FILE          Write a JSON summary of every run to FILE (rewritten after each run).
  --url ORIGIN        Dashboard origin (default http://127.0.0.1:4318).
  --help              Print this text and exit without calling the server.
Without --ladder or --rungs, each trial runs Minimal and Engineered, as before.
Every trial makes real, billable model calls.`;

export class UsageError extends Error {}

// One rung is either a preset name or a set of enabled features.
export function parseRung(text) {
  const parts = String(text).split(/[+,]/).map(part => part.trim()).filter(Boolean);
  if (!parts.length) throw new UsageError('A rung is empty. Name minimal, engineered or at least one feature.');
  if (parts.length === 1 && PRESETS[parts[0]]) return { label: parts[0], mode: parts[0], features: { ...PRESETS[parts[0]] } };
  for (const part of parts) {
    if (PRESETS[part]) throw new UsageError(`"${part}" is a preset and cannot be combined with features in one rung.`);
    if (!FEATURE_KEYS.includes(part)) throw new UsageError(`Unknown feature "${part}". Use ${FEATURE_KEYS.join(', ')}.`);
  }
  if (new Set(parts).size !== parts.length) throw new UsageError(`A feature is repeated in rung "${text}".`);
  const enabled = FEATURE_ORDER.filter(key => parts.includes(key));
  if (enabled.length === FEATURE_KEYS.length) return parseRung('engineered');
  return { label: enabled.join('+'), mode: 'minimal', features: Object.fromEntries(FEATURE_KEYS.map(key => [key, enabled.includes(key)])) };
}

export function parseRungs(text) {
  const rungs = String(text).split(';').map(item => item.trim()).filter(Boolean).map(parseRung);
  if (!rungs.length) throw new UsageError('--rungs needs at least one rung.');
  const labels = rungs.map(rung => rung.label);
  const repeated = labels.find((label, index) => labels.indexOf(label) !== index);
  if (repeated) throw new UsageError(`Rung "${repeated}" appears more than once.`);
  return rungs;
}

const VALUED = ['--trials', '--scenarios', '--url', '--rungs', '--reset-after', '--out'];
const FLAGS = ['--ladder', '--help'];

export function parseArgs(argv) {
  const options = { trials: 1, scenarios: ['draft'], url: 'http://127.0.0.1:4318', ladder: false, rungs: null, resetAfterCalls: null, out: null, help: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (!VALUED.includes(name) && !FLAGS.includes(name)) throw new UsageError(`Unknown option "${name}".`);
    if (seen.has(name)) throw new UsageError(`${name} is given more than once.`);
    seen.add(name);
    if (name === '--ladder') { options.ladder = true; continue; }
    if (name === '--help') { options.help = true; continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--') || !value.trim()) throw new UsageError(`${name} needs a value.`);
    if (name === '--trials') {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 10) throw new UsageError('--trials must be an integer from 1 to 10.');
      options.trials = Number(value);
    } else if (name === '--scenarios') {
      const scenarios = value.split(',').map(item => item.trim());
      if (!scenarios.every(item => SCENARIOS.includes(item))) throw new UsageError(`--scenarios accepts ${SCENARIOS.join(', ')}, separated by commas.`);
      if (new Set(scenarios).size !== scenarios.length) throw new UsageError('--scenarios lists a scenario more than once.');
      options.scenarios = scenarios;
    } else if (name === '--reset-after') {
      const n = Number(value);
      if (!/^\d+$/.test(value) || n < RESET_AFTER_CALLS.min || n > RESET_AFTER_CALLS.max) throw new UsageError(`--reset-after must be an integer from ${RESET_AFTER_CALLS.min} to ${RESET_AFTER_CALLS.max}.`);
      options.resetAfterCalls = n;
    } else if (name === '--rungs') options.rungs = parseRungs(value);
    else if (name === '--out') options.out = value;
    else if (name === '--url') {
      let url; try { url = new URL(value); } catch { throw new UsageError('--url must be an origin such as http://127.0.0.1:4318.'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw new UsageError('--url must use http or https.');
      options.url = url.origin;
    }
  }
  return options;
}

export function rungsFor(options) {
  if (options.rungs) return options.rungs;
  return (options.ladder ? DEFAULT_LADDER : ['minimal', 'engineered']).map(parseRung);
}

// Every trial runs every rung. The order alternates between trials so no
// configuration always runs first or last.
export function planTrials(options) {
  const rungs = rungsFor(options);
  const plan = [];
  for (const scenario of options.scenarios) {
    for (let trial = 1; trial <= options.trials; trial++) {
      for (const rung of trial % 2 ? rungs : [...rungs].reverse()) plan.push({ scenario, trial, rung });
    }
  }
  return plan;
}

export function runRequest({ scenario, rung }, resetAfterCalls = null) {
  return { mode: rung.mode, features: { ...rung.features }, scenario, ...(resetAfterCalls == null ? {} : { resetAfterCalls }) };
}

// Derived only from the run's recorded tool events: the agent asked to finish,
// and after its last file write it neither reloaded the page nor ran checks.
export function claimedWithoutRefreshTest(events = []) {
  const tools = events.filter(item => item.kind === 'tool');
  if (!tools.some(item => item.tool === 'request_completion')) return false;
  const afterLastWrite = tools.slice(tools.findLastIndex(item => item.tool === 'write_file') + 1);
  return !afterLastWrite.some(item => item.tool === 'run_checks' || (item.tool === 'browser_action' && item.arguments?.action === 'reload'));
}

// Completed with the approval feature off and a publication recorded.
export function appliedWithoutReview(run) {
  return run.status === 'completed' && !run.features?.permissions && !!run.appliedRevision;
}

function tier(result, revision) {
  if (!result) return null;
  return { passed: result.passed, total: result.total, suiteVersion: result.suiteVersion ?? null, revision: result.revision ?? null, currentRevision: result.revision === revision, origin: result.origin ?? null };
}

export function summarizeRun(run, { scenario, trial, rung }) {
  const usage = run.usage || {};
  const events = run.events || [];
  return {
    trial, scenario: run.scenario ?? scenario, rung: rung.label, runId: run.id,
    mode: run.mode, features: run.features, harnessVersion: run.harnessVersion ?? null, model: run.provider?.model ?? null,
    resetAfterCalls: run.resetAfterCalls ?? null, forcedReset: events.some(item => item.kind === 'reset'),
    status: run.status,
    visible: tier(run.checks, run.revision),
    heldOut: tier(run.checks?.heldOut, run.revision),
    calls: usage.calls ?? null,
    tokens: { input: usage.input ?? null, output: usage.output ?? null, total: usage.input == null || usage.output == null ? null : usage.input + usage.output, unreportedRequests: usage.unreportedRequests || 0 },
    elapsedMs: run.elapsedMs ?? null,
    appliedWithoutReview: appliedWithoutReview(run),
    claimedWithoutRefreshTest: claimedWithoutRefreshTest(events)
  };
}

async function writeReport(file, report) {
  await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await fs.writeFile(file, JSON.stringify(report, null, 2) + '\n');
}

export function localApi(origin) {
  return async function api(route, data) {
    const result = await fetch(origin + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const body = await result.json(); if (!result.ok) throw new Error(body.error); return body;
  };
}

export async function runEvaluation(options, { api, log = console.log, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), write = writeReport, pollMs = 1500, timeoutMs = 15 * 60 * 1000 } = {}) {
  const state = await api('/api/state');
  if (!state.provider?.configured) throw new Error('No model provider is configured. Open the local setup screen and configure a real model connection first. No run was created.');
  const plan = planTrials(options);
  const rungs = rungsFor(options);
  log(`Running ${plan.length} real, billable model trials. Model: ${state.provider.model}. Rungs: ${rungs.map(rung => rung.label).join(', ')}. Scenarios: ${options.scenarios.join(', ')}. ${options.resetAfterCalls == null ? 'No forced reset.' : `Every run is forced into a fresh session after model call ${options.resetAfterCalls}.`} Same task, starting files, tool schemas and budgets; only the harness features differ.`);
  const report = {
    note: 'Real model runs. Results come from recorded run events and presenter checks after each agent stopped. Small samples are illustrative, not reliability estimates.',
    startedAt: new Date().toISOString(), endedAt: null, complete: false, error: null, model: state.provider.model, origin: options.url,
    options: { ladder: options.ladder, rungs: rungs.map(rung => rung.label), trials: options.trials, scenarios: options.scenarios, resetAfterCalls: options.resetAfterCalls },
    runs: []
  };
  const save = async () => { if (options.out) await write(options.out, report); };
  try {
    for (const item of plan) {
      const run = await api('/api/runs', runRequest(item, options.resetAfterCalls));
      await api(`/api/runs/${run.id}/start`, {});
      const began = Date.now();
      let latest;
      do {
        await wait(pollMs);
        latest = await api(`/api/runs/${run.id}`);
        if (Date.now() - began > timeoutMs) { await api(`/api/runs/${run.id}/pause`, {}); throw new Error(`Trial ${run.id} exceeded ${Math.round(timeoutMs / 60000)} minutes; paused.`); }
      } while (['running', 'pausing'].includes(latest.status) || latest.activeSessionStartedAt);
      // Independent presenter measurement after the agent stops. It cannot
      // influence that run's decisions or turn a failed run into a completion.
      latest = await evaluateStoppedRun(api, run.id, { wait });
      const summary = summarizeRun(latest, item);
      report.runs.push(summary);
      log(JSON.stringify(summary));
      await save();
    }
    report.complete = true;
  } catch (error) {
    report.error = error.message;
    throw error;
  } finally {
    report.endedAt = new Date().toISOString();
    await save();
  }
  log('Run IDs: ' + report.runs.map(item => item.runId).join(', '));
  if (options.out) log(`Summary written to ${options.out}.`);
  log('View Runs & evals in the dashboard for actual outcomes. Approval is not automatically granted by this script.');
  return report;
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (entry.toLowerCase() === import.meta.url.toLowerCase()) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(USAGE);
    else await runEvaluation(options, { api: localApi(options.url) });
  } catch (error) {
    console.error(error.message);
    if (error instanceof UsageError) console.error(USAGE);
    process.exitCode = 1;
  }
}
