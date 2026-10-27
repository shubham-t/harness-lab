import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT, DATA, FILES, FIXTURE, TASK, runs, runDir, workspace, initStore, createRun, publicRun, persist, event, diff, revision, noteStorageFailure, atomicJson } from './lib/store.mjs';
import { getBrowser, closeBrowser, runChecks, CHECK_NAMES, HELD_OUT_CHECK_NAMES, CHECK_SUITE_VERSION, previewOrigin } from './lib/browser.mjs';
import { getPublicConfig, configureProvider, testConnection, callModel } from './lib/provider.mjs';
import { startRun, pauseRun, resumeRun, approveRun, executeTool, running, MODEL_ONLY_INSTRUCTIONS } from './lib/runner.mjs';

const PORT = Number(process.env.PORT || 4318);
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT || 4319);
if (PORT === PREVIEW_PORT) throw new Error('Dashboard and preview must use different ports for origin isolation.');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
let browserStatus = { available: false, error: 'Checking browser availability…' };
const manualChecks = new Set();
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
function headers(res) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); }
function localRequest(req, port) {
  const host = req.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  if (req.headers.origin && ![`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`].includes(req.headers.origin)) return false;
  return true;
}
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 200000) throw new Error('Request body exceeds 200 KB'); }
  const parsed = JSON.parse(text || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object');
  return parsed;
}
async function file(res, filename, type) {
  const content = await fs.readFile(filename);
  res.writeHead(200, { 'Content-Type': type || MIME[path.extname(filename)] || 'application/octet-stream' }); res.end(content);
}
async function optionalFile(res, filename) {
  try { return await file(res, filename); }
  catch (error) { if (error.code === 'ENOENT') return json(res, 404, { error: 'Not found' }); throw error; }
}
function requireIdle(run) {
  if (running(run.id) || manualChecks.has(run.id)) throw new Error('This run is busy. Pause it and wait for the current operation to finish.');
}
function evaluationSummary() {
  const eligible = [...runs.values()].filter(r => r.usage.calls > 0 && ['completed', 'awaiting_approval', 'failed', 'budget_exceeded'].includes(r.status));
  const groups = new Map();
  for (const run of eligible) {
    const suiteVersion = run.checks ? run.checks.suiteVersion || 'notes-v1' : 'unassessed';
    const harnessVersion = run.harnessVersion || 1;
    const resetAfterCalls = run.resetAfterCalls ?? null;
    // Loop-only runs are builder evidence: never pooled with Minimal or Engineered.
    const loopOnly = run.loopOnly === true;
    const key = JSON.stringify([run.provider?.model, run.provider?.baseUrl, run.provider?.protocol, run.features, run.scenario, suiteVersion, harnessVersion, resetAfterCalls, loopOnly]);
    if (!groups.has(key)) groups.set(key, { mode: run.mode, features: run.features, loopOnly, model: run.provider?.model, scenario: run.scenario, suiteVersion, harnessVersion, resetAfterCalls, trials: 0, verified: 0, heldOutVerified: 0, recordedPasses: 0, failed: 0, inputTokens: 0, outputTokens: 0, unreportedRequests: 0, elapsedMs: 0, runIds: [] });
    const group = groups.get(key); group.trials++;
    if (run.checks?.revision === run.revision && run.checks.passed === run.checks.total && run.checks.total > 0) {
      group.recordedPasses++;
      if (suiteVersion === CHECK_SUITE_VERSION) group.verified++;
    }
    const heldOut = run.checks?.heldOut;
    if (heldOut?.suiteVersion === CHECK_SUITE_VERSION && heldOut.revision === run.revision && heldOut.passed === heldOut.total && heldOut.total > 0) group.heldOutVerified++;
    if (['failed', 'budget_exceeded'].includes(run.status)) group.failed++;
    group.inputTokens += run.usage.input; group.outputTokens += run.usage.output; group.elapsedMs += run.elapsedMs; group.runIds.push(run.id);
    group.unreportedRequests += run.usage.unreportedRequests || 0;
  }
  return { groups: [...groups.values()], count: eligible.length, checkSuiteVersion: CHECK_SUITE_VERSION, note: `Only actual model runs. Groups separate scenario, model, provider, harness configuration, loop-only builder mode, harness version, forced-reset setting, and check suite version. Verified counts require visible ${CHECK_SUITE_VERSION} checks on the current source revision; heldOutVerified counts require the presenter-only held-out tier to pass in full on that revision; historical results remain visible. Ready workspaces and manual checks are excluded. Small samples are illustrative, not reliability estimates.` };
}
// Builder step 0: one real model request with the task and no tools. No run,
// workspace or file is touched; the record never contains the API key.
const MODEL_ONLY_DIR = path.join(DATA, 'model-only');
async function modelOnlyRequest() {
  const configured = getPublicConfig();
  if (!configured.configured) throw new Error('Configure an API key and model first. No simulated runs are available.');
  const provider = { model: configured.model, baseUrl: configured.baseUrl, protocol: configured.protocol };
  const at = new Date().toISOString();
  // A failed request throws here: HTTP 400 with the provider message and no record.
  const reply = await callModel({ instructions: MODEL_ONLY_INSTRUCTIONS, history: [{ role: 'user', content: TASK }], tools: [], provider });
  const record = { id: randomUUID(), at, model: provider.model, baseUrl: provider.baseUrl, protocol: provider.protocol, instructions: MODEL_ONLY_INSTRUCTIONS, task: TASK, text: reply.text, status: reply.status, incompleteReason: reply.incompleteReason ?? null, usage: { input: reply.usage.input, output: reply.usage.output }, usageReported: reply.usageReported };
  await atomicJson(path.join(MODEL_ONLY_DIR, `${record.id}.json`), record);
  return record;
}
async function modelOnlyRecords() {
  let names;
  try { names = await fs.readdir(MODEL_ONLY_DIR); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const records = [];
  for (const name of names.filter(item => /^[a-f0-9-]{36}\.json$/.test(item))) {
    try { records.push(JSON.parse(await fs.readFile(path.join(MODEL_ONLY_DIR, name), 'utf8'))); } catch { /* Skip unreadable records. */ }
  }
  return records.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
// The builder page reads one recording of real runs (written by scripts/record-builder.mjs).
const builderRecordingPath = () => process.env.HARNESS_BUILDER_RECORDING || path.join(ROOT, 'live-validation/builder/recording.json');
function recordedRunIds(value, ids = new Set()) {
  if (Array.isArray(value)) value.forEach(item => recordedRunIds(item, ids));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    if (key === 'runId' && typeof item === 'string') ids.add(item);
    else if (key !== 'run') recordedRunIds(item, ids);
  }
  return ids;
}
async function builderRecording() {
  let raw;
  try { raw = await fs.readFile(builderRecordingPath(), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const recording = JSON.parse(raw);
  if (!recording || typeof recording !== 'object' || Array.isArray(recording)) throw new Error('The builder recording is not a JSON object.');
  const present = {};
  for (const id of recordedRunIds(recording.steps || {})) if (runs.has(id)) present[id] = true;
  return { ...recording, present };
}
const app = http.createServer(async (req, res) => {
  headers(res);
  if (!localRequest(req, PORT)) return json(res, 403, { error: 'This local workbench accepts same-origin requests only.' });
  res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src http://127.0.0.1:${PREVIEW_PORT} http://localhost:${PREVIEW_PORT}; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`);
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) {
      if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' });
      if (req.method === 'POST' && (req.headers['x-harness-client'] !== 'local' || !req.headers['content-type']?.startsWith('application/json'))) return json(res, 403, { error: 'Missing local client request headers.' });
      if (pathname === '/api/state' && req.method === 'GET') return json(res, 200, { provider: getPublicConfig(), browser: browserStatus, runs: [...runs.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(publicRun), previewOrigin: previewOrigin(), checkNames: CHECK_NAMES, heldOutCheckNames: HELD_OUT_CHECK_NAMES, checkSuiteVersion: CHECK_SUITE_VERSION });
      if (pathname === '/api/evals' && req.method === 'GET') return json(res, 200, evaluationSummary());
      if (pathname === '/api/config' && req.method === 'POST') {
        if ([...runs.values()].some(r => running(r.id))) throw new Error('Pause active runs before changing the provider.');
        return json(res, 200, configureProvider(await body(req)));
      }
      if (pathname === '/api/config/test' && req.method === 'POST') return json(res, 200, await testConnection());
      if (pathname === '/api/runs' && req.method === 'POST') {
        const options = await body(req);
        if (options.source && options.source !== 'live') throw new Error('Only real model runs are supported.');
        const p = getPublicConfig();
        const run = await createRun({ mode: options.mode, features: options.features, scenario: options.scenario, resetAfterCalls: options.resetAfterCalls, loopOnly: options.loopOnly, provider: { model: p.model, baseUrl: p.baseUrl, protocol: p.protocol } });
        return json(res, 201, publicRun(run));
      }
      if (pathname === '/api/model/task-only' && req.method === 'POST') {
        await body(req);
        return json(res, 201, await modelOnlyRequest());
      }
      if (pathname === '/api/model-only' && req.method === 'GET') return json(res, 200, { records: await modelOnlyRecords() });
      if (pathname === '/api/builder' && req.method === 'GET') {
        const recording = await builderRecording();
        return recording ? json(res, 200, recording) : json(res, 404, { error: 'No builder recording found.' });
      }
      const match = pathname.match(/^\/api\/runs\/([a-f0-9-]{36})(?:\/(.*))?$/);
      if (match) {
        const run = runs.get(match[1]);
        if (!run) return json(res, 404, { error: 'Run not found' });
        const action = match[2] || '';
        if (req.method === 'GET') {
          if (!action) return json(res, 200, publicRun(run));
          if (action === 'diff') return json(res, 200, { changes: await diff(run) });
          if (action === 'export') { res.setHeader('Content-Disposition', `attachment; filename="harness-run-${run.id.slice(0,8)}.json"`); return json(res, 200, { ...publicRun(run), changes: await diff(run), note: 'Visible events and tool evidence only. Provider-private reasoning state is excluded.' }); }
          if (/^screenshots\/[a-zA-Z0-9-]+\.png$/.test(action)) return await file(res, path.join(runDir(run.id), action));
        }
        if (req.method === 'POST') {
          await body(req);
          if (action === 'start') {
            requireIdle(run);
            if (run.status !== 'ready') throw new Error('Create a fresh workspace or resume this run.');
            const provider = getPublicConfig();
            if (!provider.configured) throw new Error('Configure an API key and model first. No simulated runs are available.');
            run.provider = { model: provider.model, baseUrl: provider.baseUrl, protocol: provider.protocol };
            startRun(run);
          } else if (action === 'pause') { await pauseRun(run); }
          else if (action === 'resume') {
            requireIdle(run);
            if (!['paused', 'interrupted', 'failed'].includes(run.status)) throw new Error('Pause the run before starting a fresh session.');
            if (!getPublicConfig().configured) throw new Error('Configure the model connection before resuming.');
            await resumeRun(run);
          } else if (action === 'approve') { requireIdle(run); await approveRun(run); }
          else if (action === 'checks') {
            requireIdle(run); manualChecks.add(run.id);
            try {
              await event(run, 'checks', 'Presenter evaluation started', 'The presenter is running independent browser checks. This action is outside the agent workflow.', { origin: 'presenter', phase: 'start' });
              // Both tiers: run.checks is the visible result, run.checks.heldOut the held-out result.
              const checks = await runChecks(run, { tier: 'all' });
              checks.origin = 'presenter';
              checks.heldOut.origin = 'presenter';
              run.checks = checks;
              const lines = result => result.results.map(item => `${item.passed ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`).join('\n');
              await event(run, 'checks', `${checks.passed}/${checks.total} checks passed`, `Presenter evaluation of source revision ${checks.revision}. This did not change the agent's completion decision.\n\nChecks the agent can run (visible tier): ${checks.passed}/${checks.total} passed.\n${lines(checks)}\n\nHeld-out checks (presenter only, never shown to the agent): ${checks.heldOut.passed}/${checks.heldOut.total} passed.\n${lines(checks.heldOut)}`, { result: checks, origin: 'presenter', phase: 'end' });
            } catch (error) { await event(run, 'error', 'Browser checks could not finish', error.message); throw error; }
            finally { manualChecks.delete(run.id); }
          } else if (action === 'probe') {
            requireIdle(run);
            let outcome;
            try { outcome = await executeTool(run, 'write_file', { path: '../protected-checks.mjs', content: '// Permission probe: no file should be written.' }); }
            catch (error) { outcome = { error: error.message }; }
            await event(run, 'permission', 'Protected-file boundary tested', 'An explicitly requested permission probe attempted an out-of-workspace write. This is a test of the boundary, not a model-generated action.', { result: outcome });
          } else return json(res, 404, { error: 'Unknown run action' });
          try { await persist(run); }
          catch (error) { if (run.appliedRevision && run.status === 'completed') noteStorageFailure(run, error); else throw error; }
          return json(res, 200, publicRun(run));
        }
      }
      return json(res, 404, { error: 'API route not found' });
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    const assets = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/anatomy.mjs': 'anatomy.mjs', '/lesson.mjs': 'lesson.mjs', '/styles.css': 'styles.css', '/builder.html': 'builder.html', '/builder.mjs': 'builder.mjs', '/builder.css': 'builder.css' };
    // A missing asset (for example a builder file not yet written) is a clean 404.
    if (assets[pathname]) return await optionalFile(res, path.join(ROOT, 'public', assets[pathname]));
    if (pathname.startsWith('/builder-assets/')) {
      const screen = pathname.match(/^\/builder-assets\/([a-z0-9-]+)\.png$/);
      if (!screen) return json(res, 404, { error: 'Not found' });
      return await optionalFile(res, path.join(path.dirname(builderRecordingPath()), 'screens', `${screen[1]}.png`));
    }
    if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    return json(res, 404, { error: 'Not found' });
  } catch (error) { if (!res.headersSent) json(res, error.code === 'ENOENT' ? 404 : 400, { error: error.message }); else res.end(); }
});

const preview = http.createServer(async (req, res) => {
  headers(res);
  if (![ `127.0.0.1:${PREVIEW_PORT}`, `localhost:${PREVIEW_PORT}` ].includes(req.headers.host)) return json(res, 403, { error: 'Invalid preview host' });
  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:${PORT} http://localhost:${PORT}`);
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Preview is read-only over HTTP' });
    const pathname = decodeURIComponent(new URL(req.url, previewOrigin()).pathname);
    const match = pathname.match(/^\/(preview|published|production)\/([a-f0-9-]{36})\/(.*)$/);
    if (!match || !runs.has(match[2]) || !FILES.includes(match[3])) return json(res, 404, { error: 'Preview asset not found' });
    if (match[1] === 'production') {
      // Production is the committed publication when one exists, otherwise the pristine fixture.
      // Nothing reaches it except through publish().
      const published = path.join(runDir(match[2]), 'published', match[3]);
      const applied = runs.get(match[2]).appliedRevision && await fs.access(published).then(() => true, () => false);
      return await file(res, applied ? published : path.join(FIXTURE, match[3]));
    }
    const base = match[1] === 'published' ? path.join(runDir(match[2]), 'published') : workspace(match[2]);
    return await file(res, path.join(base, match[3]));
  } catch { return json(res, 404, { error: 'Preview unavailable' }); }
});

await initStore();
await new Promise((resolve, reject) => { preview.once('error', reject); preview.listen(PREVIEW_PORT, '127.0.0.1', resolve); });
await new Promise((resolve, reject) => { app.once('error', reject); app.listen(PORT, '127.0.0.1', resolve); });
console.log(`Harness Lab: http://127.0.0.1:${PORT}`);
console.log(`Isolated application preview: ${previewOrigin()}`);
console.log('Local only. API credentials stay in server memory. No simulated agent runs.');
getBrowser().then(() => { browserStatus = { available: true, error: null }; }).catch(error => { browserStatus = { available: false, error: error.message }; });
let stopping = false;
async function shutdown() {
  if (stopping) return; stopping = true;
  for (const run of runs.values()) if (running(run.id)) await pauseRun(run);
  await closeBrowser(); app.close(); preview.close();
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
