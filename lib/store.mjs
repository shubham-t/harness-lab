import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.resolve(process.env.HARNESS_DATA_DIR || path.join(ROOT, '../../work/harness-lab-runtime'));
export const FIXTURE = path.join(ROOT, 'fixtures/notes');
export const FILES = ['index.html', 'src/app.js', 'src/export.js', 'src/storage.js', 'src/styles.css'];
export const READABLE = [...FILES, 'PROJECT.md'];
// Harness-owned knowledge outside the workspace. Never copied, listed or readable through tools.
export const TICKET = path.join(ROOT, 'fixtures/ticket/PN-142.md');
export const HARNESS_VERSION = 4;
// Added by harness v4. Workspaces created earlier never had these files; presence
// decides, so their revisions, diffs and publications stay exactly as recorded.
export const V4_FILES = ['src/export.js'];
export async function presentFiles(directory, names = FILES) {
  const present = [];
  for (const name of names) {
    try { await fs.access(path.join(directory, name)); present.push(name); }
    catch (error) { if (error.code !== 'ENOENT' || !V4_FILES.includes(name)) throw error; }
  }
  return present;
}
export const RESET_AFTER_CALLS = { min: 2, max: 23 };
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
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(temp, JSON.stringify(object, null, 2));
    // Windows readers and scanners can briefly hold the destination open.
    // Never remove the last good snapshot to work around a failed rename.
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(temp, file); break; }
      catch (error) {
        if (attempt >= 4 || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt));
      }
    }
  } finally { await fs.rm(temp, { force: true }).catch(() => {}); }
}
export function noteStorageFailure(run, error) {
  run.storageWarning = { at: new Date().toISOString(), code: error.code || 'UNKNOWN', message: error.message };
  if (run.events.at(-1)?.title !== 'Evidence storage needs attention') run.events.push({ id: randomUUID(), at: run.storageWarning.at, kind: 'error', title: 'Evidence storage needs attention', detail: 'A disk write failed. Applied files remain applied; some recent evidence may exist only in memory. Export evidence and resolve the disk error before continuing.', storageWarning: run.storageWarning });
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
      // A manifest is committed atomically with the complete published copy.
      // Recover publication even if run.json could not be saved afterwards.
      try {
        const published = path.join(runDir(name), 'published');
        const manifest = JSON.parse(await fs.readFile(path.join(published, '.publication.json'), 'utf8'));
        if (manifest.runId !== run.id || run.id !== name || !/^[a-f0-9]{12}$/.test(manifest.revision) || !Number.isFinite(Date.parse(manifest.at)) || manifest.revision !== await revisionAt(published)) throw new Error('Publication manifest does not match the saved files. Inspect this run before trusting publication evidence.');
        if (run.appliedRevision !== manifest.revision || run.status !== 'completed') {
          run.status = 'completed'; run.appliedRevision = manifest.revision; run.pendingRevision = manifest.revision; run.endedAt = manifest.at; run.appliedAt = manifest.at;
          run.events.push({ id: randomUUID(), at: new Date().toISOString(), kind: 'permission', title: 'Published copy recovered after restart', detail: `Complete publication ${manifest.revision} verified against its committed manifest. Intermediate events may be missing.`, revision: manifest.revision });
          recovered = true;
        }
      } catch (error) { if (error.code !== 'ENOENT') noteStorageFailure(run, error); }
      if (recovered) { try { await persist(run); } catch (error) { noteStorageFailure(run, error); } }
      runs.set(run.id, run);
    } catch { /* Ignore incomplete, unrelated directories. */ }
  }
}
export async function revision(id) {
  return revisionAt(workspace(id));
}
export async function revisionAt(directory) {
  const hash = createHash('sha256');
  for (const name of await presentFiles(directory)) hash.update(name).update(await fs.readFile(path.join(directory, name)));
  return hash.digest('hex').slice(0, 12);
}
export async function createRun({ mode = 'engineered', source = 'live', features, provider, scenario = 'draft', resetAfterCalls } = {}) {
  if (!PRESETS[mode]) throw new Error('Unknown harness mode');
  if (source !== 'live') throw new Error('Only real model runs are supported');
  if (!['draft', 'unicode', 'longform'].includes(scenario)) throw new Error('Unknown evaluation scenario');
  if (resetAfterCalls != null && !(Number.isInteger(resetAfterCalls) && resetAfterCalls >= RESET_AFTER_CALLS.min && resetAfterCalls <= RESET_AFTER_CALLS.max)) throw new Error(`resetAfterCalls must be an integer from ${RESET_AFTER_CALLS.min} to ${RESET_AFTER_CALLS.max}, or omitted.`);
  const id = randomUUID();
  await fs.cp(FIXTURE, workspace(id), { recursive: true });
  const selected = { ...PRESETS[mode] };
  for (const key of Object.keys(selected)) if (typeof features?.[key] === 'boolean') selected[key] = features[key];
  const run = { id, mode, source, scenario, features: selected, status: 'ready', createdAt: new Date().toISOString(), startedAt: null, endedAt: null, elapsedMs: 0, task: TASK, provider, events: [], history: [], memory: '', checkpoints: [], usage: { input: 0, output: 0, calls: 0 }, step: 0, session: 1, checks: null, summary: '', pendingRevision: null, appliedRevision: null, appliedAt: null, resetAfterCalls: resetAfterCalls ?? null, revision: await revision(id) };
  run.harnessVersion = HARNESS_VERSION;
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
  for (const name of await presentFiles(workspace(run.id))) {
    const before = await fs.readFile(path.join(FIXTURE, name), 'utf8');
    const after = await fs.readFile(filePath(run.id, name), 'utf8');
    if (before !== after) changes.push({ file: name, before, after });
  }
  return changes;
}
