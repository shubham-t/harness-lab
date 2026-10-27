// Records one continuous, silent video of the harness builder page running every
// step live against the local server, then writes a trimmed copy with the idle
// waiting removed. Every step makes real, billable model calls through the page's
// own "Run this step live" button; nothing is scripted or replayed, and no run is
// shortened or stopped early. Presenter actions (evaluation, the sandbox probe,
// the diff, the approval) are triggered the way a presenter would click them.
// Step 7 is approved only after the diff passes the review a presenter does by
// hand: one changed file, src/storage.js, with the notes key intact and a
// separate draft key added. Otherwise it is left waiting for a person.
//
//   node presentation/record-builder-video.mjs [--origin http://127.0.0.1:4318]
//        [--out presentation/video/harness-builder-live.webm] [--pause 8]
//        [--step-timeout 900] [--no-trim]
//
// Output: the original recording (kept untouched), <name>.trimmed.webm (the
// idle stretches cut; every moment where something changed on screen is kept
// with a little context), <name>.notes.txt (a timeline with mm:ss marks for
// both files and the run ids), and <name>.trim.json (the kept intervals).
// A one-second title card marks every step boundary so cut points are obvious.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
if (args.includes('--help')) {
  console.log('Usage: node presentation/record-builder-video.mjs [--origin ORIGIN] [--out FILE.webm] [--pause SECONDS] [--step-timeout SECONDS] [--no-trim]\nRecords the builder page running every step live in one continuous video, then writes a trimmed copy without the idle waiting. Real, billable model calls. Approves step 7 only after an automated review of its diff.');
  process.exit(0);
}
const origin = new URL(option('--origin', 'http://127.0.0.1:4318')).origin;
const out = path.resolve(option('--out', 'presentation/video/harness-builder-live.webm'));
const pauseMs = Math.max(0, Number(option('--pause', '8'))) * 1000;
const stepTimeoutMs = Math.max(60, Number(option('--step-timeout', '900'))) * 1000;
const trim = !args.includes('--no-trim');
const size = { width: 1440, height: 900 };
const CARD_MS = 1000;
const KEEP_BEFORE = 1.5, KEEP_AFTER = 3.0; // seconds of context around every on-screen change

const require = createRequire(import.meta.url);
let playwright;
for (const candidate of ['playwright', process.env.PLAYWRIGHT_MODULE_PATH, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) { try { playwright = require(candidate); break; } catch {} }
if (!playwright) throw new Error('Playwright is not installed. Run npm install, then npx playwright install chromium.');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mmss = seconds => { const s = Math.max(0, Math.round(seconds)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
let videoStart = Date.now();
const now = () => (Date.now() - videoStart) / 1000;
const log = line => console.log(`[${mmss(now())}] ${line}`);

async function api(route, body) {
  const response = await fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
  return json;
}

// The review a presenter does before approving: one file, storage only, the
// notes key untouched, a separate draft key added. Anything else is not approved.
export function reviewDiff(changes) {
  if (changes.length !== 1 || changes[0].file !== 'src/storage.js') return `changed ${changes.map(c => c.file).join(', ') || 'nothing'}, not only src/storage.js`;
  const after = changes[0].after;
  if (!after.includes("prefix + 'notes'")) return 'the notes key is no longer read or written as before';
  if (!/prefix \+ ['"]draft['"]/.test(after)) return 'no separate draft key was added';
  if (!/export function readDraft|export function writeDraft|export function clearDraft/.test(after)) return 'the draft functions are missing';
  return null;
}

// Keep intervals: every narration pause and every on-screen change with context, merged.
export function keepIntervals(changes, pauses, end) {
  const raw = [...pauses.map(([a, b]) => [a, b]), ...changes.map(t => [t - KEEP_BEFORE, t + KEEP_AFTER])]
    .map(([a, b]) => [Math.max(0, a), Math.min(end, b)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b] of raw) {
    const last = merged.at(-1);
    if (last && a <= last[1] + 0.5) last[1] = Math.max(last[1], b); else merged.push([a, b]);
  }
  return merged;
}

async function waitFor(description, predicate, timeoutMs = stepTimeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

const STEP_TITLES = ['A model alone', 'Agent loop', 'Tools and sandbox', 'Instructions and policies', 'Context management', 'Verification', 'Memory and state', 'Guardrails: approval'];
async function titleCard(page, step) {
  await page.evaluate(([step, title]) => {
    const card = document.createElement('div');
    card.id = 'builder-title-card';
    card.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:#1f3b2a;color:#f6f5ef;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Georgia,serif;');
    card.innerHTML = `<div style="font-size:22px;letter-spacing:4px;opacity:.8">STEP ${step} OF 7</div><div style="font-size:64px;margin-top:18px">${title}</div>`;
    document.body.appendChild(card);
  }, [step, STEP_TITLES[step]]);
  await sleep(CARD_MS);
  await page.evaluate(() => document.getElementById('builder-title-card')?.remove());
}

// A signature of what is visible: when it changes, something happened on screen.
const SIGNATURE = `(() => {
  const strip = s => s.replace(/waiting \\d+ s/g, 'waiting').replace(/\\b\\d+ s\\b/g, 's');
  return JSON.stringify({
    step: location.hash, rows: document.querySelectorAll('#proof .event-row').length,
    status: [...document.querySelectorAll('[data-live-status]')].map(e => strip(e.innerText)),
    badge: document.querySelector('#mode-text')?.innerText, modal: document.querySelector('#modal')?.open || false,
    evals: [...document.querySelectorAll('[data-evaluation]')].map(e => e.getAttribute('data-state') + ':' + (e.innerText.match(/\\d+\\/\\d+/g) || []).join(',')),
    probe: document.querySelector('[data-probe]')?.innerText.slice(0, 80), approval: document.querySelector('[data-approval]')?.getAttribute('data-status'),
    banners: [...document.querySelectorAll('.production-banner')].map(e => e.innerText), errors: document.querySelectorAll('[data-live-error]').length
  });
})()`;

async function ffmpegPath() {
  const base = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'ms-playwright');
  const names = await fs.readdir(base).catch(() => []);
  for (const name of names.filter(n => n.startsWith('ffmpeg-')).sort().reverse()) {
    for (const file of ['ffmpeg-win64.exe', 'ffmpeg-linux', 'ffmpeg-mac']) { const full = path.join(base, name, file); try { await fs.access(full); return full; } catch {} }
  }
  return null;
}
function run(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; child.stderr.on('data', d => { err += d; });
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}: ${err.slice(-600)}`)));
  });
}

const state = await api('/api/state');
if (!state.provider?.configured) throw new Error('No model provider is configured on the server. Nothing was recorded.');
const before = new Set(state.runs.map(run => run.id));
console.log(`Recording the builder page at ${origin} with ${state.provider.model}. Real, billable model calls follow. Output: ${out}`);

await fs.mkdir(path.dirname(out), { recursive: true });
const videoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-video-'));
const browser = await playwright.chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size } });
videoStart = Date.now();
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const marks = [], changes = [], pauses = [];
const mark = label => { marks.push([now(), label]); log(label); };

// Watch the screen for changes while the live runs progress.
let lastSignature = null, watching = true;
const watcher = (async () => {
  while (watching) {
    try { const signature = await page.evaluate(SIGNATURE); if (signature !== lastSignature) { if (lastSignature !== null) changes.push(now()); lastSignature = signature; } } catch {}
    await sleep(500);
  }
})();
const text = selector => page.locator(selector).allInnerTexts().then(items => items.join('\n')).catch(() => '');
const liveButtonEnabled = () => page.locator('[data-action="run-live"]').isEnabled().catch(() => false);
const errorShown = () => page.locator('[data-live-error]').count().then(n => n > 0);
async function evaluationsDone(keys) {
  for (const key of keys) {
    const block = page.locator(`[data-evaluation="${key}"]`);
    if (await block.count() === 0) return false;
    if (!/\d+\/6/.test(await block.innerText())) return false;
  }
  return true;
}
async function liveRun(prefix) {
  const latest = await api('/api/state');
  return latest.runs.find(r => r.id.startsWith(String(prefix || 'none').toLowerCase()) && !before.has(r.id)) || null;
}

let approved = null, approvalNote = 'No run was approved.';
try {
  await page.goto(`${origin}/builder.html#step-0`, { waitUntil: 'networkidle' });
  await waitFor('the live button on step 0', () => page.locator('[data-action="run-live"]').count().then(n => n > 0), 30000);
  for (let step = 0; step <= 7; step++) {
    if (step > 0) { await page.locator('#next').click(); await sleep(800); }
    const cardAt = now();
    await titleCard(page, step);
    mark(`Step ${step}: title card, then the page (pause for narration)`);
    await sleep(pauseMs);
    pauses.push([cardAt, now() + 1]);
    const keys = step === 0 ? [] : step === 6 ? ['withoutMemory', 'withMemory'] : ['main'];
    // A dropped provider connection must not end a long recording: the page shows the
    // error, the notes record it, and the step is started again (a new real run).
    let finished = false;
    for (let attempt = 1; attempt <= 3 && !finished; attempt++) {
      await page.locator('[data-action="run-live"]').click();
      mark(`Step ${step}: live run started${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
      let failure = null;
      await waitFor(`step ${step} to finish`, async () => {
        if (await errorShown()) { failure = await text('[data-live-error]'); return true; }
        if (!(await liveButtonEnabled())) return false;
        return step === 0 ? true : evaluationsDone(keys);
      });
      if (failure) { mark(`Step ${step}: the page reported an error (kept in the video): ${failure.replace(/\n/g, ' ').slice(0, 160)}`); await sleep(5000); continue; }
      // Step 7 exists to show the approval boundary. A run that stops before it (budget,
      // provider failure) is kept in the video and the notes, then the step is tried again.
      if (step === 7 && !(await text('[data-approval]')).includes('waits for you')) {
        mark(`Step 7: the run stopped before the approval boundary (${(await text('[data-live-status]')).replace(/\n/g, ' ').slice(0, 120)}); kept in the video`);
        if (attempt < 3) { await sleep(6000); continue; }
      }
      finished = true;
    }
    if (!finished) { mark(`Step ${step}: not finished after 3 attempts; moving on`); const tailAt = now(); await sleep(4000); pauses.push([tailAt, now()]); continue; }
    mark(`Step ${step}: finished. ${(await text('[data-live-status]')).replace(/\n/g, ' | ')}`);
    if (step === 2) {
      await sleep(3000);
      const probe = page.locator('[data-probe] button');
      if (await probe.count()) { await probe.first().click(); await waitFor('the probe result', () => page.locator('[data-probe]').innerText().then(t => /Rejected/i.test(t)), 60000); mark('Step 2: sandbox probe rejected (presenter action)'); }
    }
    if (step === 7) {
      const prefix = (await text('[data-live-status]')).match(/run ([0-9a-f]{8})/i)?.[1];
      const run = await liveRun(prefix);
      if (!run) throw new Error('Could not identify the live step 7 run.');
      await page.locator('[data-action="view-diff"]').first().click();
      await sleep(6000);
      mark('Step 7: diff shown');
      const { changes: diff } = await api(`/api/runs/${run.id}/diff`);
      const problem = reviewDiff(diff);
      await page.locator('[data-close-modal]').first().click().catch(() => {});
      await sleep(1000);
      const current = await api(`/api/runs/${run.id}`);
      if (current.status !== 'awaiting_approval') approvalNote = `Step 7 run ${run.id} was not waiting for approval (status ${current.status}); nothing approved.`;
      else if (problem) approvalNote = `Step 7 run ${run.id} NOT approved. Review found: ${problem}. Left waiting for a person.`;
      else {
        await page.locator('[data-action="approve"]').first().click();
        await sleep(2500);
        await page.locator('#confirm-approve').click();
        await waitFor('the approval to apply', () => page.locator('[data-approval][data-status="completed"]').count().then(n => n > 0), 120000);
        approved = run.id;
        approvalNote = `Approved run ${run.id} after the automated diff review (storage only, notes key intact, draft key added).`;
      }
      mark(`Step 7: ${approvalNote}`);
    }
    const tailAt = now();
    await sleep(step === 7 ? 10000 : 5000);
    pauses.push([tailAt, now()]);
  }
  await page.locator('#phones').scrollIntoViewIfNeeded().catch(() => {});
  const endAt = now();
  await sleep(6000);
  pauses.push([endAt, now()]);
} finally {
  watching = false; await watcher;
  const end = now();
  await context.close();
  await browser.close();
  const files = (await fs.readdir(videoDir)).filter(name => name.endsWith('.webm'));
  if (files.length) { await fs.rm(out, { force: true }); await fs.rename(path.join(videoDir, files[0]), out); }
  await fs.rm(videoDir, { recursive: true, force: true }).catch(() => {});

  // Trimmed copy: the original stays as it is.
  const intervals = keepIntervals(changes, pauses, end);
  const trimmedOut = out.replace(/\.webm$/, '') + '.trimmed.webm';
  const trimJson = out.replace(/\.webm$/, '') + '.trim.json';
  const kept = intervals.reduce((sum, [a, b]) => sum + (b - a), 0);
  await fs.writeFile(trimJson, JSON.stringify({ original: out, trimmed: trimmedOut, originalSeconds: end, keptSeconds: kept, keepBefore: KEEP_BEFORE, keepAfter: KEEP_AFTER, intervals, changes, pauses }, null, 2) + '\n');
  let trimNote = `Trimmed copy not written (--no-trim).`;
  if (trim && files.length) {
    const ffmpeg = await ffmpegPath();
    if (!ffmpeg) trimNote = 'Trimmed copy not written: Playwright\'s ffmpeg was not found.';
    else {
      const select = intervals.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+');
      try {
        await run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', out, '-vf', `select='${select}',setpts=N/FRAME_RATE/TB`, '-an', '-c:v', 'libvpx-vp9', '-b:v', '2M', '-deadline', 'good', '-cpu-used', '4', trimmedOut]);
        trimNote = `Trimmed copy: ${trimmedOut} (${mmss(kept)} kept of ${mmss(end)}; ${intervals.length} segments; the original is untouched).`;
      } catch (error) { trimNote = `Trimmed copy failed: ${error.message}`; }
    }
  }
  // Timeline marks in both files: original time, and where that moment lands in the trimmed copy.
  const inTrimmed = t => { let acc = 0; for (const [a, b] of intervals) { if (t < a) return acc; if (t <= b) return acc + (t - a); acc += b - a; } return acc; };
  const after = (await api('/api/state').catch(() => ({ runs: [] }))).runs.filter(r => !before.has(r.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const notes = [
    `Harness builder live recording, ${new Date(videoStart).toISOString()}, model ${state.provider.model}, origin ${origin}.`,
    `Original: ${out} (${mmss(end)}, untouched)`, trimNote, '',
    'Timeline (original mm:ss -> trimmed mm:ss):',
    ...marks.map(([t, label]) => `  ${mmss(t)} -> ${mmss(inTrimmed(t))}  ${label}`), '',
    'Runs created during the recording:',
    ...after.map(r => `  ${r.id}  ${r.loopOnly ? 'loop-only' : r.mode} ${JSON.stringify(r.features)} reset=${r.resetAfterFirstEdit ? 'first edit' : r.resetAfterCalls ?? 'none'}  status=${r.status}  calls=${r.usage?.calls}`), '',
    approvalNote, pageErrors.length ? `Script errors seen by the browser (these include errors inside the phone iframes, where the model-written app runs; a broken app.js written by the model shows up here): ${pageErrors.join(' | ')}` : 'Script errors seen by the browser: none.'
  ];
  await fs.writeFile(out.replace(/\.webm$/, '') + '.notes.txt', notes.join('\n') + '\n');
  console.log(notes.join('\n'));
}
