// Writes a trimmed copy of a builder recording from the intervals in its
// <name>.trim.json (written by record-builder-video.mjs). The original file is
// never changed. Two methods, chosen automatically:
//   1. A full ffmpeg (ffmpeg on PATH, or the ffmpeg-static package): one pass with
//      the select filter. Exact cuts.
//   2. Otherwise headless Chromium replays the kept intervals of the original in a
//      <video> element while Playwright records the screen. Needs nothing beyond
//      the project's own dependencies; cut points land within about half a second.
//
//   node presentation/trim-video.mjs [--in presentation/video/harness-builder-live.webm]
//        [--out <name>.trimmed.webm] [--method auto|ffmpeg|replay]
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
if (args.includes('--help')) { console.log('Usage: node presentation/trim-video.mjs [--in FILE.webm] [--out FILE.trimmed.webm] [--method auto|ffmpeg|replay]'); process.exit(0); }
const input = path.resolve(option('--in', 'presentation/video/harness-builder-live.webm'));
const base = input.replace(/\.webm$/, '');
const output = path.resolve(option('--out', `${base}.trimmed.webm`));
const method = option('--method', 'auto');
const plan = JSON.parse(await fs.readFile(`${base}.trim.json`, 'utf8'));
const intervals = plan.intervals;
if (!intervals?.length) throw new Error('The trim plan has no intervals.');
if (path.resolve(output) === input) throw new Error('The output must not be the original file.');
const kept = intervals.reduce((sum, [a, b]) => sum + (b - a), 0);
const mmss = seconds => { const s = Math.max(0, Math.round(seconds)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function fullFfmpeg() {
  const require = createRequire(import.meta.url);
  const candidates = [];
  try { candidates.push(require('ffmpeg-static')); } catch {}
  candidates.push('ffmpeg');
  for (const candidate of candidates) {
    if (!candidate) continue;
    const probe = spawnSync(candidate, ['-hide_banner', '-filters'], { encoding: 'utf8' });
    if (probe.status === 0 && /\bselect\b/.test(probe.stdout) && /\bsetpts\b/.test(probe.stdout)) return candidate;
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

async function trimWithFfmpeg(ffmpeg) {
  const select = intervals.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+');
  await run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-vf', `select='${select}',setpts=N/FRAME_RATE/TB`, '-an', '-c:v', 'libvpx-vp9', '-b:v', '2M', '-deadline', 'good', '-cpu-used', '4', output]);
  return 'ffmpeg select filter (exact cuts)';
}

async function playwrightFfmpeg() {
  const base = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'ms-playwright');
  const names = await fs.readdir(base).catch(() => []);
  for (const name of names.filter(n => n.startsWith('ffmpeg-')).sort().reverse()) {
    for (const file of ['ffmpeg-win64.exe', 'ffmpeg-linux', 'ffmpeg-mac']) { const full = path.join(base, name, file); try { await fs.access(full); return full; } catch {} }
  }
  return null;
}
async function trimWithReplay() {
  const require = createRequire(import.meta.url);
  let playwright;
  for (const candidate of ['playwright', process.env.PLAYWRIGHT_MODULE_PATH].filter(Boolean)) { try { playwright = require(candidate); break; } catch {} }
  if (!playwright) throw new Error('Playwright is not installed.');
  const size = { width: 1440, height: 900 };
  const bytes = await fs.readFile(input);
  // Serve the original and a player page on a loopback port; nothing else is reachable.
  const server = http.createServer((req, res) => {
    if (req.url === '/video.webm') {
      const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
      if (range) { const start = Number(range[1]), end = range[2] ? Number(range[2]) : bytes.length - 1; res.writeHead(206, { 'Content-Type': 'video/webm', 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 }); return res.end(bytes.subarray(start, end + 1)); }
      res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': bytes.length, 'Accept-Ranges': 'bytes' }); return res.end(bytes);
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000;overflow:hidden}video{display:block;width:${size.width}px;height:${size.height}px}</style></head><body><video id="v" src="/video.webm" muted playsinline preload="auto"></video></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const videoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-trim-'));
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size } });
  const page = await context.newPage();
  const videoStart = Date.now();
  let lead = 0;
  try {
    await page.goto(origin + '/', { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('v').readyState >= 1, null, { timeout: 60000 });
    lead = (Date.now() - videoStart) / 1000;
    for (const [a, b] of intervals) {
      await page.evaluate(async ([a, b]) => {
        const v = document.getElementById('v');
        v.pause();
        await new Promise(resolve => { const done = () => { v.removeEventListener('seeked', done); resolve(); }; v.addEventListener('seeked', done); v.currentTime = a; });
        await v.play();
        await new Promise(resolve => { const tick = () => { if (v.currentTime >= b || v.ended) { v.pause(); resolve(); } else requestAnimationFrame(tick); }; tick(); });
      }, [a, b]);
    }
    await page.waitForTimeout(500);
  } finally {
    await context.close();
    await browser.close();
    server.close();
    const files = (await fs.readdir(videoDir)).filter(name => name.endsWith('.webm'));
    if (files.length) { await fs.rm(output, { force: true }); await fs.rename(path.join(videoDir, files[0]), output); }
    await fs.rm(videoDir, { recursive: true, force: true }).catch(() => {});
  }
  // Cut the blank lead-in before the first segment with Playwright's own ffmpeg (a plain start offset needs no filters).
  const bundled = await playwrightFfmpeg();
  if (bundled && lead > 0.2) {
    const temp = output + '.lead.webm';
    try { await run(bundled, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', lead.toFixed(2), '-i', output, '-an', '-c:v', 'libvpx-vp9', '-b:v', '2M', '-deadline', 'good', '-cpu-used', '4', temp]); await fs.rename(temp, output); }
    catch { await fs.rm(temp, { force: true }).catch(() => {}); }
  }
  return 'Chromium replay of the kept intervals (cut points within about half a second)';
}

const ffmpeg = method === 'replay' ? null : fullFfmpeg();
if (method === 'ffmpeg' && !ffmpeg) throw new Error('No full ffmpeg found (ffmpeg on PATH or the ffmpeg-static package).');
console.log(`Trimming ${input}: keeping ${mmss(kept)} of ${mmss(plan.originalSeconds)} in ${intervals.length} segments. The original is not changed.`);
const how = ffmpeg ? await trimWithFfmpeg(ffmpeg) : await trimWithReplay();
console.log(`Wrote ${output} using ${how}.`);
