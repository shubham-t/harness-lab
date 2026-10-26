import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, DATA, FILES, runs, runDir, workspace, initStore, createRun, publicRun, persist, event, diff, revision, noteStorageFailure } from './lib/store.mjs';
import { getBrowser, closeBrowser, runChecks, CHECK_NAMES, CHECK_SUITE_VERSION, previewOrigin } from './lib/browser.mjs';
import { getPublicConfig, configureProvider, testConnection } from './lib/provider.mjs';
import { startRun, pauseRun, resumeRun, approveRun, executeTool, running } from './lib/runner.mjs';

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
function requireIdle(run) {
  if (running(run.id) || manualChecks.has(run.id)) throw new Error('This run is busy. Pause it and wait for the current operation to finish.');
}
function evaluationSummary() {
  const eligible = [...runs.values()].filter(r => r.usage.calls > 0 && ['completed', 'awaiting_approval', 'failed', 'budget_exceeded'].includes(r.status));
  const groups = new Map();
  for (const run of eligible) {
    const suiteVersion = run.checks ? run.checks.suiteVersion || 'notes-v1' : 'unassessed';
    const harnessVersion = run.harnessVersion || 1;
    const key = JSON.stringify([run.provider?.model, run.provider?.baseUrl, run.provider?.protocol, run.features, run.scenario, suiteVersion, harnessVersion]);
    if (!groups.has(key)) groups.set(key, { mode: run.mode, features: run.features, model: run.provider?.model, scenario: run.scenario, suiteVersion, harnessVersion, trials: 0, verified: 0, recordedPasses: 0, failed: 0, inputTokens: 0, outputTokens: 0, unreportedRequests: 0, elapsedMs: 0, runIds: [] });
    const group = groups.get(key); group.trials++;
    if (run.checks?.revision === run.revision && run.checks.passed === run.checks.total && run.checks.total > 0) {
      group.recordedPasses++;
      if (suiteVersion === CHECK_SUITE_VERSION) group.verified++;
    }
    if (['failed', 'budget_exceeded'].includes(run.status)) group.failed++;
    group.inputTokens += run.usage.input; group.outputTokens += run.usage.output; group.elapsedMs += run.elapsedMs; group.runIds.push(run.id);
    group.unreportedRequests += run.usage.unreportedRequests || 0;
  }
  return { groups: [...groups.values()], count: eligible.length, checkSuiteVersion: CHECK_SUITE_VERSION, note: `Only actual model runs. Groups separate scenario, model, provider, harness configuration, and check suite version. Verified counts require ${CHECK_SUITE_VERSION} on the current source revision; historical results remain visible. Ready workspaces and manual checks are excluded. Small samples are illustrative, not reliability estimates.` };
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
      if (pathname === '/api/state' && req.method === 'GET') return json(res, 200, { provider: getPublicConfig(), browser: browserStatus, runs: [...runs.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(publicRun), previewOrigin: previewOrigin(), checkNames: CHECK_NAMES, checkSuiteVersion: CHECK_SUITE_VERSION });
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
        const run = await createRun({ mode: options.mode, features: options.features, scenario: options.scenario, provider: { model: p.model, baseUrl: p.baseUrl, protocol: p.protocol } });
        return json(res, 201, publicRun(run));
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
              run.checks = await runChecks(run);
              run.checks.origin = 'presenter';
              await event(run, 'checks', `${run.checks.passed}/${run.checks.total} checks passed`, `Presenter evaluation of source revision ${run.checks.revision}. This did not change the agent's completion decision.`, { result: run.checks, origin: 'presenter', phase: 'end' });
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
    const assets = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/anatomy.mjs': 'anatomy.mjs', '/lesson.mjs': 'lesson.mjs', '/styles.css': 'styles.css' };
    if (assets[pathname]) return await file(res, path.join(ROOT, 'public', assets[pathname]));
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
    const match = pathname.match(/^\/(preview|published)\/([a-f0-9-]{36})\/(.*)$/);
    if (!match || !runs.has(match[2]) || !FILES.includes(match[3])) return json(res, 404, { error: 'Preview asset not found' });
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
