import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.resolve(process.env.HARNESS_DATA_DIR || path.join(ROOT, '../../work/harness-lab-runtime'));
export const FIXTURE = path.join(ROOT, 'fixtures/notes');
export const FILES = ['index.html', 'src/app.js', 'src/storage.js', 'src/styles.css'];
export const READABLE = [...FILES, 'PROJECT.md'];
export const TASK = 'Fix Pocket Notes: an unfinished draft must survive switching between Draft and My notes, and refreshing the page. Saving creates exactly one note, clears the draft, and preserves existing notes. Distinct intentional notes must remain distinct. Preserve the current appearance. Investigate, implement, verify, and prepare the patch.';
export const PRESETS = {
  minimal: { instructions: false, context: false, memory: false, verification: false, permissions: false },
  engineered: { instructions: true, context: true, memory: true, verification: true, permissions: true }
};
export const runs = new Map();

export function assertId(id) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid run ID'); return id; }
export function runDir(id) { return path.join(DATA, 'runs', assertId(id)); }
export function workspace(id) { return path.join(runDir(id), 'workspace'); }
export function filePath(id, name, write = false) {
  if (!(write ? FILES : READABLE).includes(name)) throw new Error('Permission denied: only the listed application files are accessible. Tests and harness code are protected.');
  return path.join(workspace(id), name);
}
export async function atomicJson(file, object) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  await fs.writeFile(temp, JSON.stringify(object, null, 2));
  await fs.rename(temp, file);
}
const saves = new Map();
export async function persist(run) {
  const snapshot = JSON.parse(JSON.stringify(run));
  const previous = saves.get(run.id) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => atomicJson(path.join(runDir(run.id), 'run.json'), snapshot));
  saves.set(run.id, next);
  await next;
}
export async function initStore() {
  await fs.mkdir(path.join(DATA, 'runs'), { recursive: true });
  const names = await fs.readdir(path.join(DATA, 'runs'));
  for (const name of names) {
    try {
      const run = JSON.parse(await fs.readFile(path.join(runDir(name), 'run.json'), 'utf8'));
      let recovered = false;
      if (run.inFlightRequest) {
        run.usage.unreportedRequests = (run.usage.unreportedRequests || 0) + 1;
        run.inFlightRequest = null;
        run.events.push({ id: randomUUID(), at: new Date().toISOString(), kind: 'usage', title: 'Interrupted request usage unavailable', detail: 'The previous process stopped before this attempted request was accounted for. Its call remains counted; reported token totals exclude any unknown provider usage.' });
        recovered = true;
      }
      if (run.status === 'running') { run.status = 'interrupted'; run.events.push({ id: randomUUID(), at: new Date().toISOString(), kind: 'memory', title: 'Server restarted', detail: 'The previous execution stopped. Resume starts a new model session with the configured memory policy. Time after the last completed session is unreported.' }); recovered = true; }
      run.activeSessionStartedAt = null;
      // Persist recovery and marker removal together so repeated restarts never
      // count the same interrupted request twice.
      if (recovered) await persist(run);
      runs.set(run.id, run);
    } catch { /* Ignore incomplete, unrelated directories. */ }
  }
}
export async function revision(id) {
  const hash = createHash('sha256');
  for (const name of FILES) hash.update(name).update(await fs.readFile(filePath(id, name)));
  return hash.digest('hex').slice(0, 12);
}
export async function createRun({ mode = 'engineered', source = 'live', features, provider, scenario = 'draft' } = {}) {
  if (!PRESETS[mode]) throw new Error('Unknown harness mode');
  if (source !== 'live') throw new Error('Only real model runs are supported');
  if (!['draft', 'unicode', 'longform'].includes(scenario)) throw new Error('Unknown evaluation scenario');
  const id = randomUUID();
  await fs.cp(FIXTURE, workspace(id), { recursive: true });
  const selected = { ...PRESETS[mode] };
  for (const key of Object.keys(selected)) if (typeof features?.[key] === 'boolean') selected[key] = features[key];
  const run = { id, mode, source, scenario, features: selected, status: 'ready', createdAt: new Date().toISOString(), startedAt: null, endedAt: null, elapsedMs: 0, task: TASK, provider, events: [], history: [], memory: '', checkpoints: [], usage: { input: 0, output: 0, calls: 0 }, step: 0, session: 1, checks: null, summary: '', pendingRevision: null, appliedRevision: null, revision: await revision(id) };
  run.harnessVersion = 2;
  runs.set(id, run); await persist(run); return run;
}
export async function event(run, kind, title, detail = '', extra = {}) {
  const item = { id: randomUUID(), at: new Date().toISOString(), kind, title, detail, ...extra };
  run.events.push(item);
  await persist(run);
  return item;
}
export function publicRun(run) {
  const { history, ...rest } = run;
  return { ...rest, elapsedMs: run.elapsedMs + (run.activeSessionStartedAt ? Math.max(0, Date.now() - run.activeSessionStartedAt) : 0), historyItems: history.length };
}
export async function diff(run) {
  const changes = [];
  for (const name of FILES) {
    const before = await fs.readFile(path.join(FIXTURE, name), 'utf8');
    const after = await fs.readFile(filePath(run.id, name), 'utf8');
    if (before !== after) changes.push({ file: name, before, after });
  }
  return changes;
}
