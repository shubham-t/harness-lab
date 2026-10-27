// Records the real runs shown on the harness builder page (docs/BUILDER.md,
// work package C). Phase "record" makes real, billable model calls: one
// model-only request and eight runs. It never approves anything. Phase
// "finish" runs after the presenter approved step 7 in the dashboard.
// The pure helpers below are exported so tests can check argument handling,
// the step plan, key hygiene and both phases without any network or browser.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { localApi, FEATURE_KEYS } from './evaluate.mjs';
import { evaluateStoppedRun } from './evaluation-client.mjs';
import { RESET_AFTER_CALLS } from '../lib/store.mjs';

export const PHASES = ['record', 'finish'];
export const SCENARIO = 'draft';
export const DEFAULTS = { url: 'http://127.0.0.1:4318', out: 'live-validation/builder', resetAfterCalls: 5, phase: 'record' };
export const NOTE = 'Recorded real runs for the harness builder page. Nothing scripted; failures kept.';
export const APPROVAL_MESSAGE = 'Step 7 is waiting for approval. Read its diff in the dashboard, approve it, then run --phase finish.';

export const USAGE = `Usage: node scripts/record-builder.mjs [options]
  --url ORIGIN        Dashboard origin (default ${DEFAULTS.url}).
  --out DIR           Recording directory (default ${DEFAULTS.out}).
                      Writes DIR/recording.json, DIR/runs/*.json and DIR/screens/*.png.
  --reset-after N     Step 6 forces a fresh session after model call N (${RESET_AFTER_CALLS.min} to ${RESET_AFTER_CALLS.max}, default ${DEFAULTS.resetAfterCalls}).
                      Only the two step-6 runs use it. Phase record only.
  --steps LIST        Phase record only: re-record just these steps (comma-separated, 0 to 7) into an
                      existing recording. The earlier entries and their screenshots are kept as
                      superseded evidence; nothing is deleted.
  --phase NAME        record (default): step 0 model-only request, then runs for steps 1 to 7.
                      Stops when step 7 waits for approval. This script never approves.
                      finish: after you approved step 7 in the dashboard, re-exports it,
                      captures the production phone after approval and marks the recording complete.
  --help              Print this text and exit without calling the server.
Phase record makes real, billable model calls: one model-only request and eight runs.
It refuses to start without a configured provider or over an existing recording.`;

export class UsageError extends Error {}

const VALUED = ['--url', '--out', '--reset-after', '--phase', '--steps'];
const FLAGS = ['--help'];

export function parseArgs(argv) {
  const options = { ...DEFAULTS, steps: null, help: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (!VALUED.includes(name) && !FLAGS.includes(name)) throw new UsageError(`Unknown option "${name}".`);
    if (seen.has(name)) throw new UsageError(`${name} is given more than once.`);
    seen.add(name);
    if (name === '--help') { options.help = true; continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--') || !value.trim()) throw new UsageError(`${name} needs a value.`);
    if (name === '--url') {
      let url; try { url = new URL(value); } catch { throw new UsageError('--url must be an origin such as http://127.0.0.1:4318.'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw new UsageError('--url must use http or https.');
      options.url = url.origin;
    } else if (name === '--out') options.out = value;
    else if (name === '--reset-after') {
      const n = Number(value);
      if (!/^\d+$/.test(value) || n < RESET_AFTER_CALLS.min || n > RESET_AFTER_CALLS.max) throw new UsageError(`--reset-after must be an integer from ${RESET_AFTER_CALLS.min} to ${RESET_AFTER_CALLS.max}.`);
      options.resetAfterCalls = n;
    } else if (name === '--steps') {
      const steps = value.split(',').map(item => item.trim());
      if (!steps.every(item => /^[0-7]$/.test(item))) throw new UsageError('--steps lists step numbers from 0 to 7, separated by commas.');
      if (new Set(steps).size !== steps.length) throw new UsageError('--steps lists a step more than once.');
      options.steps = steps.map(Number).sort();
    } else if (name === '--phase') {
      if (!PHASES.includes(value)) throw new UsageError(`--phase must be ${PHASES.join(' or ')}.`);
      options.phase = value;
    }
  }
  if (options.phase === 'finish' && seen.has('--reset-after')) throw new UsageError('--reset-after applies only to --phase record.');
  if (options.phase === 'finish' && options.steps) throw new UsageError('--steps applies only to --phase record.');
  return options;
}

// Every key present and boolean, so the server never falls back to a preset value.
export function featureSet(enabled = []) {
  for (const key of enabled) if (!FEATURE_KEYS.includes(key)) throw new Error(`Unknown feature "${key}".`);
  return Object.fromEntries(FEATURE_KEYS.map(key => [key, enabled.includes(key)]));
}

// The steps table of docs/BUILDER.md. Same task, starting files and budgets in
// every run; only what the harness supplies and requires differs. Only step 6
// passes resetAfterCalls. Approval is never part of the plan.
export function planSteps(resetAfterCalls = DEFAULTS.resetAfterCalls) {
  const step5 = ['instructions', 'context', 'verification'];
  const run = (step, label, title, body, extra = {}) => ({ step, key: `step${step}`, slot: null, label, title, body: { ...body, scenario: SCENARIO }, probe: false, ...extra });
  return [
    { step: 0, key: 'step0', slot: null, label: 'model-only', title: 'A model alone', modelOnly: true },
    run(1, 'loop-only', 'Agent loop', { mode: 'minimal', loopOnly: true }),
    run(2, 'tools', 'Tools and sandbox', { mode: 'minimal', features: featureSet([]) }, { probe: true }),
    run(3, 'instructions', 'Instructions and policies', { mode: 'minimal', features: featureSet(['instructions']) }),
    run(4, 'context', 'Context management', { mode: 'minimal', features: featureSet(['instructions', 'context']) }),
    run(5, 'verification', 'Verification', { mode: 'minimal', features: featureSet(step5) }),
    run(6, 'without-memory', 'Memory and state (without memory)', { mode: 'minimal', features: featureSet(step5), resetAfterCalls }, { slot: 'withoutMemory' }),
    run(6, 'with-memory', 'Memory and state (with memory)', { mode: 'minimal', features: featureSet([...step5, 'memory']), resetAfterCalls }, { slot: 'withMemory' }),
    run(7, 'engineered', 'Guardrails (approval)', { mode: 'engineered' }, { approvalStep: true })
  ];
}

// Screen and export names. Step 6 has two runs, so its names carry the slot label.
export function screenBase(item) { return item.slot ? `step${item.step}-${item.label}` : `step${item.step}`; }
export function exportName(item, runId, suffix = '') { return `step${item.step}-${item.label}-${runId}${suffix}.json`; }

// C4 key hygiene. A key-like value is "sk-" followed by 8 or more non-space
// characters, not preceded by a letter or digit (so prose such as
// "task-specific" is not mistaken for a key). Returns the JSON path, never the value.
const KEY_PATTERN = /(?<![A-Za-z0-9])sk-\S{8,}/;
export function findKeyLike(value, where = '$') {
  if (typeof value === 'string') return KEY_PATTERN.test(value) ? where : null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) { const hit = findKeyLike(value[i], `${where}[${i}]`); if (hit) return hit; }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (KEY_PATTERN.test(key)) return `${where} (a property name)`;
      const hit = findKeyLike(item, `${where}.${key}`); if (hit) return hit;
    }
  }
  return null;
}
export function assertNoKeys(value, label) {
  const hit = findKeyLike(value);
  if (hit) throw new Error(`Refusing to write ${label}: a value at ${hit} looks like an API key ("sk-" followed by 8 or more characters). Nothing was written.`);
}

// Atomic JSON write: temporary file in the same directory, then rename.
export async function writeJsonAtomic(file, data, label = path.basename(file)) {
  assertNoKeys(data, label);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}-${randomUUID().slice(0, 8)}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n');
    await fs.rename(temp, file);
  } catch (error) { await fs.rm(temp, { force: true }); throw error; }
}

const rel = (...parts) => parts.join('/');
const exists = file => fs.access(file).then(() => true, () => false);

export function defaultExportRun(api, id) { return api(`/api/runs/${id}/export`); }

// Playwright is loaded the way lib/browser.mjs loads it. The context follows the
// same rules: a 390x760 phone viewport and only the preview origin reachable.
export async function openPlaywrightScreens(previewOrigin) {
  const require = createRequire(import.meta.url);
  let playwright;
  const candidates = ['playwright', process.env.PLAYWRIGHT_MODULE_PATH, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
  for (const candidate of candidates) { try { playwright = require(candidate); break; } catch {} }
  if (!playwright) throw new Error('Playwright is not installed. Run npm install, then npx playwright install chromium.');
  let browser;
  try { browser = await playwright.chromium.launch({ headless: true }); }
  catch { try { browser = await playwright.chromium.launch({ headless: true, channel: 'msedge' }); } catch { throw new Error('No browser available. Install Microsoft Edge or run npx playwright install chromium.'); } }
  const origin = new URL(previewOrigin).origin;
  return {
    async capture(url, file) {
      if (new URL(url).origin !== origin) throw new Error(`Screenshots are limited to the preview origin ${origin}.`);
      const context = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      context.setDefaultTimeout(10000);
      try {
        const page = await context.newPage();
        const response = await page.goto(url, { waitUntil: 'load' });
        if (!response?.ok()) throw new Error(`${url} answered HTTP ${response?.status() ?? 'no response'}.`);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await page.screenshot({ path: file });
      } finally { await context.close(); }
    },
    async close() { await browser.close(); }
  };
}

function summaryLine(run) {
  const checks = run.checks ? `presenter checks ${run.checks.passed}/${run.checks.total} visible${run.checks.heldOut ? `, ${run.checks.heldOut.passed}/${run.checks.heldOut.total} held-out` : ''}` : 'no presenter checks recorded';
  return `status ${run.status}, ${run.usage?.calls ?? '?'} model calls, ${checks}`;
}

const defaults = {
  log: console.log,
  wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
  now: () => Date.now(),
  exportRun: defaultExportRun,
  openScreens: openPlaywrightScreens,
  pollMs: 1500,
  timeoutMs: 15 * 60 * 1000
};

async function pollUntilStopped(api, id, { wait, now, pollMs, timeoutMs }) {
  const began = now();
  let latest;
  do {
    await wait(pollMs);
    latest = await api(`/api/runs/${id}`);
    if (now() - began > timeoutMs) {
      await api(`/api/runs/${id}/pause`, {});
      throw new Error(`Run ${id} exceeded ${Math.round(timeoutMs / 60000)} minutes; it was paused and the recording stops here.`);
    }
  } while (['running', 'pausing'].includes(latest.status) || latest.activeSessionStartedAt);
  return latest;
}

export async function recordPhase(options, deps = {}) {
  const { api, log, wait, now, exportRun, openScreens, pollMs, timeoutMs } = { ...defaults, ...deps };
  const out = path.resolve(options.out);
  const recordingFile = path.join(out, 'recording.json');
  const selected = options.steps ? new Set(options.steps) : null;
  const plan = planSteps(options.resetAfterCalls).filter(item => !selected || selected.has(item.step));
  const runCount = plan.filter(item => !item.modelOnly).length;
  const modelOnlyCount = plan.filter(item => item.modelOnly).length;
  log(`Phase record makes real, billable model calls: ${modelOnlyCount} model-only request${modelOnlyCount === 1 ? '' : 's'} (step 0) and ${runCount} run${runCount === 1 ? '' : 's'} (${selected ? 'steps ' + [...selected].join(', ') : 'steps 1 to 7, two runs for step 6'}), up to 24 model calls each. Same task, starting files and budgets; only the harness differs. This script never approves.`);
  // Re-recording selected steps keeps the earlier entries and their screenshots as superseded evidence.
  let existing = null;
  if (selected) {
    try { existing = JSON.parse(await fs.readFile(recordingFile, 'utf8')); }
    catch (error) { throw new Error(error.code === 'ENOENT' ? `--steps re-records into an existing recording, but ${recordingFile} does not exist. Run a full record phase first. No request was made.` : `${recordingFile} could not be read: ${error.message}`); }
  } else if (await exists(recordingFile)) throw new Error(`${recordingFile} already exists. Earlier evidence is kept: move it aside, choose another --out, or re-record selected steps with --steps. No request was made.`);
  const state = await api('/api/state');
  if (!state.provider?.configured) throw new Error('No model provider is configured. Open the local setup screen and configure a real model connection first. No request was made.');
  const previewOrigin = state.previewOrigin;
  if (!previewOrigin) throw new Error('The server did not report its preview origin. No request was made.');
  const recording = existing || {
    note: NOTE, recordedAt: new Date().toISOString(), finishedAt: null, complete: false,
    model: state.provider.model, baseUrl: state.provider.baseUrl, protocol: state.provider.protocol, origin: options.url,
    resetAfterCalls: options.resetAfterCalls, scenario: SCENARIO, error: null, steps: {}
  };
  if (existing) {
    if (existing.model !== state.provider.model) throw new Error(`The recording used model "${existing.model}" but the server is configured for "${state.provider.model}". Every step must use the same model. No request was made.`);
    recording.error = null;
    recording.updatedAt = new Date().toISOString();
    recording.superseded ||= [];
    if (selected.has(6)) recording.resetAfterCalls = options.resetAfterCalls;
    if (selected.has(7)) { recording.complete = false; recording.finishedAt = null; }
    for (const step of selected) {
      const key = `step${step}`;
      if (!recording.steps[key]) continue;
      const entry = recording.steps[key];
      const stamp = Date.now();
      for (const part of entry.runId ? [entry] : Object.values(entry)) {
        for (const [name, file] of Object.entries(part.screens || {})) {
          if (!file) continue;
          const moved = rel('screens', `superseded-${stamp}-${path.basename(file)}`);
          await fs.mkdir(path.join(out, 'screens'), { recursive: true });
          await fs.rename(path.join(out, file), path.join(out, moved)).catch(error => { if (error.code !== 'ENOENT') throw error; });
          part.screens[name] = moved;
        }
      }
      recording.superseded.push({ step: key, supersededAt: new Date(stamp).toISOString(), reason: `Re-recorded with --steps ${[...selected].join(',')}${selected.has(6) ? ` --reset-after ${options.resetAfterCalls}` : ''}.`, entry });
      delete recording.steps[key];
      log(`[${key}] earlier entry kept as superseded evidence; its screenshots were renamed with a superseded- prefix.`);
    }
  }
  log(`Model: ${recording.model} (${recording.protocol}, ${recording.baseUrl}). Scenario: ${SCENARIO}. Step 6 resets after model call ${options.resetAfterCalls}. Writing to ${out}.`);
  const save = () => writeJsonAtomic(recordingFile, recording, 'recording.json');
  await save();
  let screens = null;
  const capture = async (url, name) => {
    screens ??= await openScreens(previewOrigin);
    await screens.capture(url, path.join(out, 'screens', name));
    return rel('screens', name);
  };
  try {
    for (const item of plan) {
      const prefix = `[step ${item.step}/7] ${item.title}:`;
      if (item.modelOnly) {
        log(`${prefix} one real model request with the task and no tools (no run, no files).`);
        const record = await api('/api/model/task-only', {});
        if (record.model !== recording.model) throw new Error(`Step 0 used model "${record.model}", not "${recording.model}". Every step must use the same model.`);
        recording.steps.step0 = record;
        await save();
        log(`${prefix} recorded ${record.id}, status ${record.status}, ${String(record.text ?? '').length} characters of reply.`);
        continue;
      }
      log(`${prefix} creating run ${JSON.stringify(item.body)}.`);
      const created = await api('/api/runs', item.body);
      if (created.provider?.model && created.provider.model !== recording.model) throw new Error(`Run ${created.id} uses model "${created.provider.model}", not "${recording.model}". Every step must use the same model.`);
      await api(`/api/runs/${created.id}/start`, {});
      log(`${prefix} run ${created.id} started. Polling every ${pollMs / 1000} s.`);
      await pollUntilStopped(api, created.id, { wait, now, pollMs, timeoutMs });
      // Presenter evaluation after the agent stopped. It is recorded in the run
      // as a presenter action and cannot change the agent's decisions.
      let latest = await evaluateStoppedRun(api, created.id, { wait });
      log(`${prefix} stopped: ${summaryLine(latest)} (presenter evaluation recorded).`);
      if (item.probe) {
        latest = await api(`/api/runs/${created.id}/probe`, {});
        log(`${prefix} presenter probe recorded: an out-of-workspace write was attempted by the presenter, not the model.`);
      }
      const exported = await exportRun(api, created.id);
      const exportFile = rel('runs', exportName(item, created.id));
      await writeJsonAtomic(path.join(out, exportFile), exported, exportFile);
      const base = screenBase(item);
      const sandbox = await capture(`${previewOrigin}/preview/${created.id}/index.html`, `${base}-sandbox.png`);
      const production = await capture(`${previewOrigin}/production/${created.id}/index.html`, `${base}-production${item.approvalStep ? '-before' : ''}.png`);
      const entry = {
        runId: created.id, status: exported.status, calls: exported.usage?.calls ?? null, export: exportFile,
        screens: item.approvalStep ? { sandbox, productionBefore: production, productionAfter: null } : { sandbox, production },
        run: exported
      };
      if (item.slot) recording.steps[item.key] = { ...recording.steps[item.key], [item.slot]: entry };
      else recording.steps[item.key] = entry;
      await save();
      log(`${prefix} exported to ${exportFile}; screenshots ${sandbox}, ${production}.`);
      if (item.approvalStep && exported.status !== 'awaiting_approval') throw new Error(`Step 7 run ${created.id} ended with status ${exported.status}, not awaiting_approval. It is kept in the recording, but --phase finish cannot complete it.`);
    }
  } catch (error) {
    recording.error = error.message;
    try { await save(); } catch (saveError) { log(`The partial recording could not be updated: ${saveError.message}`); }
    throw error;
  } finally {
    if (screens) await screens.close().catch(() => {});
  }
  if (!selected || selected.has(7)) log(APPROVAL_MESSAGE);
  else log(`Re-recorded ${[...selected].map(step => 'step ' + step).join(', ')}. Earlier entries are under "superseded" in ${recordingFile}.`);
  return recording;
}

export async function finishPhase(options, deps = {}) {
  const { api, log, exportRun, openScreens } = { ...defaults, ...deps };
  const out = path.resolve(options.out);
  const recordingFile = path.join(out, 'recording.json');
  let recording;
  try { recording = JSON.parse(await fs.readFile(recordingFile, 'utf8')); }
  catch (error) { throw new Error(error.code === 'ENOENT' ? `No recording at ${recordingFile}. Run --phase record first.` : `${recordingFile} could not be read: ${error.message}`); }
  const step7 = recording.steps?.step7;
  if (!step7?.runId) throw new Error('The recording has no step 7 run. Run --phase record until step 7 waits for approval. Nothing was changed.');
  if (recording.complete) throw new Error('The recording is already complete. Nothing was changed.');
  const run = await api(`/api/runs/${step7.runId}`);
  if (run.status !== 'completed' || !run.appliedRevision) throw new Error(`Step 7 run ${step7.runId} is ${run.status}${run.appliedRevision ? '' : ' with no applied revision'}. Approve it in the dashboard after reading its diff, then run --phase finish again. Nothing was changed.`);
  const state = await api('/api/state');
  if (!state.previewOrigin) throw new Error('The server did not report its preview origin. Nothing was changed.');
  log(`[finish] Step 7 run ${step7.runId} is completed with applied revision ${run.appliedRevision}. No model call is made in this phase.`);
  const exported = await exportRun(api, step7.runId);
  const item = planSteps().find(entry => entry.step === 7);
  const exportFile = rel('runs', exportName(item, step7.runId, '-after-approval'));
  await writeJsonAtomic(path.join(out, exportFile), exported, exportFile);
  const screens = await openScreens(state.previewOrigin);
  const name = 'step7-production-after.png';
  try { await screens.capture(`${state.previewOrigin}/production/${step7.runId}/index.html`, path.join(out, 'screens', name)); }
  finally { await screens.close().catch(() => {}); }
  recording.steps.step7 = {
    ...step7, status: exported.status, calls: exported.usage?.calls ?? null,
    exportBeforeApproval: step7.exportBeforeApproval ?? step7.export, export: exportFile,
    screens: { ...step7.screens, productionAfter: rel('screens', name) }, run: exported
  };
  recording.complete = true;
  recording.finishedAt = new Date().toISOString();
  await writeJsonAtomic(recordingFile, recording, 'recording.json');
  log(`[finish] Re-exported to ${exportFile}; captured screens/${name}. Recording complete: ${recordingFile}.`);
  return recording;
}

export async function runRecorder(options, deps = {}) {
  return options.phase === 'finish' ? finishPhase(options, deps) : recordPhase(options, deps);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (entry.toLowerCase() === import.meta.url.toLowerCase()) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(USAGE);
    else await runRecorder(options, { api: localApi(options.url) });
  } catch (error) {
    console.error(error.message);
    if (error instanceof UsageError) console.error(USAGE);
    process.exitCode = 1;
  }
}
