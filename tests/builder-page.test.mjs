// Harness builder page (docs/BUILDER.md, package B). Pure derivations on a small
// fixture built from excerpts of recorded runs (tests/support/builder-recording.mjs,
// with clearly marked TEST-ONLY synthetic parts), then the real page in Chromium
// against the unmodified server on ports 4448/4449. No provider is configured and
// no model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { builderRecording } from './support/builder-recording.mjs';
import { COMPONENTS } from '../public/anatomy.mjs';
import {
  STEPS, ORDER, MAX_ROWS, RECORDED_NOTE, NOT_RECORDED, requestText, requestDelta, requestView, activityExcerpt,
  proofSummary, diagramState, phoneViews, assetUrl, stateBeforeApproval, handoffText, changeSummary, parseStep, isRecorded, stepEntry,
  handoffOf, handoffCarried, carriedText, EMPTY_HANDOFF_TEXT
} from '../public/builder.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOOP_SENTENCE = 'This is an agent loop without tools: each reply is recorded, the harness answers with what changed (nothing can change without tools), and the loop repeats until the budget ends.';
const added = segments => segments.filter(s => s.added).map(s => s.text);
const joined = segments => segments.map(s => s.text).join('');
const runOf = (recording, step) => stepEntry(recording, step).run;

test('steps: titles, plain problems, verbatim code excerpts', async () => {
  assert.deepEqual(STEPS.map(s => s.title), ['A model alone', 'Agent loop', 'Tools and sandbox', 'Instructions and policies', 'Context management', 'Verification', 'Memory and state', 'Guardrails: approval']);
  assert.deepEqual(STEPS.map(s => s.id), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(STEPS.slice(1).map(s => s.component), ORDER);
  assert.equal(STEPS[0].problem, 'We asked a model to fix the bug. It answered well. Nothing happened, because a model can only produce text.');
  assert.equal(STEPS[5].problem, 'The model can say it is done without checking. Nothing tests whether the fix works.');
  assert.equal(STEPS[7].problem, 'Everything so far could still ship by itself. Nobody decides.');
  for (const step of STEPS) {
    // Plain language: no ticket, backup or storage-key narrative in fixed page text.
    for (const text of [step.problem, step.add, step.look]) assert.doesNotMatch(text, /ticket|PN-142|backup|storage key|held-out/i, `step ${step.id}`);
    assert.ok(step.code, `step ${step.id} has a code excerpt`);
    assert.ok(['lib/runner.mjs', 'lib/store.mjs', 'lib/browser.mjs'].includes(step.code.file));
    const lines = step.code.parts.flat();
    assert.ok(lines.length >= 5 && lines.length <= 12, `step ${step.id}: ${lines.length} lines`);
    const source = (await fs.readFile(path.join(root, step.code.file), 'utf8')).replace(/\r\n/g, '\n');
    for (const part of step.code.parts) assert.ok(source.includes(part.join('\n')), `step ${step.id}: excerpt is verbatim and contiguous in ${step.code.file}:\n${part[0]}`);
  }
  assert.match(STEPS[2].code.parts.flat().join('\n'), /export function toolsForRun[\s\S]*export async function executeTool/);
  assert.match(STEPS[5].code.parts.flat().join('\n'), /async function assess[\s\S]*Completion blocked by verification/);
  assert.match(STEPS[6].code.parts.flat().join('\n'), /export function buildHandoff[\s\S]*function startFreshSession/);
  assert.match(STEPS[7].code.parts.flat().join('\n'), /export async function approveRun[\s\S]*async function publish/);
});

test('fixture: synthetic parts are marked and step 0 uses the runtime instruction text', async () => {
  const recording = builderRecording();
  const { MODEL_ONLY_INSTRUCTIONS } = await import('../lib/runner.mjs');
  assert.equal(recording.steps.step0.instructions, MODEL_ONLY_INSTRUCTIONS);
  assert.match(recording.steps.step0.fixtureNote, /TEST-ONLY synthetic/);
  assert.match(runOf(recording, 1).fixtureNote, /TEST-ONLY synthetic/);
  assert.match(runOf(recording, 3).fixtureNote, /TEST-ONLY composite/);
  assert.equal(recording.steps.step4, undefined, 'step 4 is absent on purpose');
  assert.ok(runOf(recording, 1).events.find(e => e.kind === 'prompt').instructions.startsWith(`${MODEL_ONLY_INSTRUCTIONS} ${LOOP_SENTENCE}`));
});

test('requestText and requestDelta', () => {
  const recording = builderRecording();
  assert.deepEqual(requestText(recording.steps.step0), { instructions: recording.steps.step0.instructions, task: recording.steps.step0.task, session: null });
  const step6 = stepEntry(recording, 6).withMemory.run;
  assert.equal(requestText(step6).session, 1);
  assert.match(requestText(step6, 2).instructions, /Restored durable memory/);
  assert.equal(requestText(step6, 3), null);
  assert.equal(requestText(null), null);
  // Generic behaviour.
  assert.deepEqual(requestDelta('a\nb', null), [{ text: 'a\nb', added: false }]);
  assert.deepEqual(requestDelta('same line\nother', 'same line\nother'), [{ text: 'same line\nother', added: false }]);
  assert.deepEqual(added(requestDelta('old\nnew line', 'old')), ['new line']);
  assert.deepEqual(added(requestDelta('The first sentence stays put. A second sentence was appended.', 'The first sentence stays put.')), [' A second sentence was appended.']);
  assert.deepEqual(added(requestDelta('intro\nSECTION\nbody\nend', 'intro\nSECTION\nbody\nend', ['SECTION\nbody'])), ['SECTION\nbody']);
  assert.equal(joined(requestDelta('x\n\ny', 'x')), 'x\n\ny', 'segments rebuild the exact text');
});

test('requestView: only what is new since the previous step is highlighted', () => {
  const recording = builderRecording();
  const v0 = requestView(recording, 0);
  assert.equal(added([...v0.instructions, ...v0.task]).length, 0, 'step 0 highlights nothing');
  assert.equal(v0.caption, 'The starting point. Nothing is highlighted.');
  const v1 = requestView(recording, 1);
  assert.deepEqual(added(v1.instructions).map(s => s.trim()), [LOOP_SENTENCE, 'Remaining model calls: 24 of 24. Reported token use: 0 of 150000; the next request must also fit a conservative reservation.  No tool can end the task in this configuration; the budget ends it.']);
  assert.ok(!added(v1.instructions).join('').includes('You are asked to fix'), 'the step 0 text is not highlighted again');
  assert.equal(added(v1.task).length, 0, 'the task is unchanged');
  assert.equal(v1.previousStep, 0);
  const v3 = requestView(recording, 3);
  const rules = runOf(recording, 3).events.find(e => e.kind === 'instructions').content;
  assert.ok(added(v3.instructions).some(text => text.includes(rules)), 'the recorded rules section is marked new in full');
  assert.equal(requestView(recording, 4), null, 'step 4 is not recorded');
  const v5 = requestView(recording, 5);
  assert.equal(v5.previousStep, 3);
  assert.match(v5.caption, /new since step 3 \(step 4 is not recorded\)/);
  assert.deepEqual(added(v5.instructions).map(s => s.trim()), ['Completion is gated by passing protected browser checks on the current revision. Failed completion attempts return observed failures for another edit/verify cycle.']);
  const v6 = requestView(recording, 6);
  assert.equal(v6.session, 2);
  const handoff = handoffText(recording);
  assert.ok(handoff.text.startsWith('Restored durable memory from a previous model session'));
  assert.ok(added(v6.instructions).some(text => text.includes(handoff.text)), 'the recorded handoff section is marked new in full');
  const v7 = requestView(recording, 7);
  assert.equal(v7.previousStep, 6);
  assert.deepEqual(added(v7.instructions).map(s => s.trim()), ['Completion prepares a patch for explicit human approval before applying it to the isolated published demo copy.']);
});

test('activityExcerpt: bounded, keeps the stopping event, labels presenter actions', () => {
  const recording = builderRecording();
  const real = rows => rows.filter(row => !row.elided);
  for (const step of [1, 2, 3, 5, 7]) {
    const run = runOf(recording, step);
    const excerpt = activityExcerpt(run, step);
    assert.ok(real(excerpt.rows).length <= MAX_ROWS, `step ${step}: ${real(excerpt.rows).length} rows`);
    assert.equal(real(excerpt.rows).length + excerpt.rows.filter(r => r.elided).reduce((s, r) => s + r.elided, 0), excerpt.total);
    assert.ok(!excerpt.rows.some(r => ['prompt', 'tool_result', 'usage'].includes(r.kind)));
    for (const row of real(excerpt.rows)) { assert.ok(row.at); assert.ok(row.title); assert.ok(row.label); }
    const stop = run.events.findLast(e => e.kind === 'budget' || (e.kind === 'permission' && ['Awaiting explicit approval', 'Patch applied to local demo copy'].includes(e.title)));
    assert.ok(real(excerpt.rows).some(row => row.title === stop.title), `step ${step} keeps its stopping event`);
    for (const row of real(excerpt.rows).filter(r => r.kind === 'checks')) assert.equal(row.label, 'Presenter action, not the model');
  }
  const loop = activityExcerpt(runOf(recording, 1), 1);
  assert.deepEqual(loop.rows.slice(0, 3).map(r => r.kind), ['model', 'assistant', 'observation']);
  assert.ok(loop.rows.some(r => r.elided > 0), 'a long loop is elided');
  assert.ok(loop.rows.some(r => r.kind === 'tool_error' && /unavailable in this harness configuration/.test(r.detail)));
  assert.ok(loop.rows.some(r => r.kind === 'budget'));
  const tools = activityExcerpt(runOf(recording, 2), 2);
  assert.ok(tools.rows.some(r => r.kind === 'tool' && r.title === 'Tool: read_file'));
  assert.ok(tools.rows.some(r => r.kind === 'tool' && r.title === 'Tool: write_file'), 'a write is not hidden behind reads');
  assert.ok(tools.rows.some(r => r.kind === 'edit'));
  const probe = tools.rows.find(r => r.title === 'Protected-file boundary tested');
  assert.equal(probe.label, 'Presenter-triggered probe, not a model action');
  assert.equal(probe.actor, 'probe');
  const rules = activityExcerpt(runOf(recording, 3), 3);
  assert.equal(rules.rows.filter(r => r.kind === 'instructions').length, 1, 'repeated sections appear once');
  const checks = activityExcerpt(runOf(recording, 5), 5);
  assert.deepEqual(checks.rows.filter(r => r.kind === 'verification').map(r => r.title), ['4/6 browser checks passed', '6/6 browser checks passed', '6/6 browser checks passed']);
  assert.ok(checks.rows.some(r => r.title === 'Tool: request_completion'));
  const { withoutMemory, withMemory } = stepEntry(recording, 6);
  const without = activityExcerpt(withoutMemory.run, 6), withM = activityExcerpt(withMemory.run, 6);
  for (const excerpt of [without, withM]) { assert.ok(excerpt.rows.some(r => r.kind === 'reset')); assert.ok(excerpt.rows.some(r => r.kind === 'budget')); }
  assert.ok(withM.rows.some(r => r.title === 'Saved handoff included in request'));
  assert.ok(!without.rows.some(r => r.title === 'Saved handoff included in request'));
  const approval = activityExcerpt(runOf(recording, 7), 7);
  assert.deepEqual(approval.rows.filter(r => r.kind === 'permission').map(r => r.label), ['Waiting for a person · Harness', 'Published after a person approved · Harness']);
  assert.deepEqual(activityExcerpt(null, 2), { rows: [], total: 0, elided: 0 });
});

test('proofSummary: footer facts, highlights and the Not recorded yet fallback', () => {
  const recording = builderRecording();
  const s2 = proofSummary(2, recording);
  assert.equal(s2.recorded, true);
  const f = s2.footers[0].facts;
  assert.equal(f.runId, runOf(recording, 2).id);
  assert.equal(f.shortId, runOf(recording, 2).id.slice(0, 8).toUpperCase());
  assert.equal(f.date, runOf(recording, 2).createdAt);
  assert.equal(f.model, 'cohere/north-mini-code:free');
  assert.equal(f.statusLabel, 'Budget reached');
  assert.equal(f.calls, 24);
  assert.equal(f.note, RECORDED_NOTE);
  assert.ok(s2.highlights.some(line => /rejected \(presenter-triggered probe, not a model action\)/.test(line)));
  assert.equal(proofSummary(0, recording).footers[0].facts.kind, 'request');
  assert.match(proofSummary(1, recording).highlights.join('\n'), /Tools offered: none/);
  assert.match(proofSummary(5, recording).highlights.join('\n'), /4\/6 → 6\/6/);
  const s6 = proofSummary(6, recording);
  assert.deepEqual(s6.footers.map(x => x.label), ['Without memory', 'With memory']);
  assert.match(s6.highlights[0], /cut off after call 8; the fresh session got the task and files only/);
  assert.deepEqual(s6.highlights.slice(1), ['With memory: cut off after call 8; the fresh session got a saved handoff.', 'The handoff carried a check result, a saved note and 1 recent action, plus the source revision.']);
  assert.match(proofSummary(7, recording).highlights.join('\n'), /Files changed: src\/storage\.js/);
  assert.deepEqual(proofSummary(4, recording), { recorded: false, message: NOT_RECORDED, footers: [], highlights: [] });
  for (let step = 0; step <= 7; step++) {
    assert.equal(isRecorded(null, step), false);
    assert.equal(proofSummary(step, null).message, NOT_RECORDED);
    assert.equal(requestView(null, step), null);
  }
  // A partial step 6 still renders the recorded side.
  const partial = builderRecording();
  delete partial.steps.step6.withMemory;
  assert.equal(proofSummary(6, partial).footers[1].facts, null);
  assert.equal(phoneViews(6, partial).groups[1].missing, true);
});

test('handoffCarried: says plainly when the handoff carried nothing useful', () => {
  // Non-empty branch: the fixture's recorded b4feef72 handoff (reset after call 8, after a check and a saved note).
  const recording = builderRecording();
  const run = stepEntry(recording, 6).withMemory.run;
  assert.deepEqual(handoffCarried(handoffOf(run)), { editedFiles: 0, checks: true, note: true, actions: 1, empty: false });
  // Without sessionHandoff the same object is read from the recorded section text.
  assert.deepEqual(handoffOf({ ...run, sessionHandoff: undefined }), run.sessionHandoff);
  assert.equal(carriedText({ editedFiles: 2, checks: true, note: true, actions: 0, empty: false }), 'The handoff carried 2 edited files, a check result and a saved note, plus the source revision.');
  assert.equal(handoffCarried(null), null);
  assert.equal(handoffOf({ events: [] }), null);
  // Empty branch. TEST-ONLY synthetic: a reset before the first edit, the shape seen in a real
  // builder recording (editedFiles [], checks null, recentActions [], empty savedNote).
  const emptyHandoff = { previousSession: 1, sourceRevision: '3ee13b976c63', savedNote: '', editedFiles: [], checks: null, recentActions: [], note: 'TEST-ONLY synthetic handoff.' };
  assert.deepEqual(handoffCarried(emptyHandoff), { editedFiles: 0, checks: false, note: false, actions: 0, empty: true });
  assert.equal(handoffCarried({ ...emptyHandoff, savedNote: '   ' }).empty, true, 'a blank note is not a note');
  const empty = builderRecording();
  const emptyRun = stepEntry(empty, 6).withMemory.run;
  emptyRun.sessionHandoff = emptyHandoff;
  emptyRun.fixtureNote = 'TEST-ONLY synthetic empty handoff.';
  const handoffEvent = emptyRun.events.find(e => e.title === 'Saved handoff included in request');
  handoffEvent.content = `Restored durable memory from a previous model session (frozen at session start):\n${JSON.stringify(emptyHandoff)}`;
  assert.equal(handoffCarried(handoffOf({ ...emptyRun, sessionHandoff: undefined })).empty, true);
  const highlights = proofSummary(6, empty).highlights;
  assert.equal(highlights.at(-1), EMPTY_HANDOFF_TEXT);
  assert.equal(EMPTY_HANDOFF_TEXT, 'The reset came before the first edit, so the handoff carried only the source revision: no edited files, no check result, no saved note. The difference in calls between the two runs cannot be attributed to memory.');
  assert.ok(!highlights.some(line => /character handoff/.test(line)));
});

test('diagramState: added components are enabled; only the current one is outlined', () => {
  for (let step = 0; step <= 7; step++) {
    const cards = diagramState(step);
    assert.deepEqual(cards.map(c => c.id), ORDER);
    assert.deepEqual(cards.map(c => c.name), ORDER.map(id => COMPONENTS.find(c => c.id === id).name));
    assert.equal(cards.filter(c => c.enabled).length, step);
    assert.equal(cards.filter(c => c.current).length, step === 0 ? 0 : 1);
    assert.ok(cards.every(c => !c.current || c.enabled), 'never highlight a component that is not enabled');
    if (step) assert.equal(cards.find(c => c.current).id, STEPS[step].component);
  }
});

test('phoneViews: screenshots, live copies, approval banners', () => {
  const recording = builderRecording();
  assert.equal(assetUrl('screens/step6-with-memory-sandbox.png'), '/builder-assets/step6-with-memory-sandbox.png');
  assert.equal(assetUrl('screens/../x.png'), '/builder-assets/x.png');
  assert.equal(assetUrl('screens/Bad Name.png'), null);
  assert.equal(assetUrl(null), null);
  assert.match(phoneViews(0, recording).note, /only replied with text/);
  const shots = phoneViews(2, recording);
  assert.deepEqual(shots.groups[0].phones.map(p => [p.role, p.live, p.src]), [['sandbox', false, '/builder-assets/step2-sandbox.png'], ['production', false, '/builder-assets/step2-production.png']]);
  assert.equal(shots.groups[0].phones[1].banner.text, 'Original build. No change applied.');
  const id5 = runOf(recording, 5).id;
  const live = phoneViews(5, { ...recording, present: { [id5]: true } }, 'http://127.0.0.1:4449');
  assert.deepEqual(live.groups[0].phones.map(p => [p.live, p.src]), [[true, `http://127.0.0.1:4449/preview/${id5}/index.html`], [true, `http://127.0.0.1:4449/production/${id5}/index.html?rev=${runOf(recording, 5).appliedRevision}`]]);
  assert.equal(phoneViews(5, { ...recording, present: { [id5]: true } }, null).groups[0].phones[0].live, false, 'no preview origin, no live phone');
  const six = phoneViews(6, recording);
  assert.deepEqual(six.groups.map(g => g.label), ['Without memory', 'With memory']);
  assert.equal(six.groups[1].phones[0].src, '/builder-assets/step6-with-memory-sandbox.png');
  const seven = phoneViews(7, recording);
  assert.deepEqual(seven.groups[0].phones.map(p => p.role), ['sandbox', 'production-before', 'production-after']);
  assert.deepEqual(seven.groups[0].phones[1].banner, { state: 'waiting', text: 'Original build. One change is waiting for your approval.' });
  assert.equal(seven.groups[0].phones[1].src, '/builder-assets/step7-production-before.png');
  assert.equal(seven.groups[0].phones[2].banner.state, 'approved');
  assert.match(seven.groups[0].phones[2].banner.text, /^Updated after your approval at /);
  assert.equal(stateBeforeApproval(runOf(recording, 2)), null, 'no recorded wait, no before state');
  const waiting = builderRecording();
  Object.assign(runOf(waiting, 7), { status: 'awaiting_approval', appliedRevision: null, appliedAt: null });
  waiting.steps.step7.run.events = waiting.steps.step7.run.events.filter(e => e.title !== 'Patch applied to local demo copy');
  assert.match(phoneViews(7, waiting).groups[0].phones[2].banner.text, /Not recorded yet/);
  assert.deepEqual(changeSummary(runOf(recording, 7)).map(c => c.file), ['src/storage.js']);
  assert.equal(parseStep('#step-6'), 6);
  assert.equal(parseStep('#step-9'), 0);
  assert.equal(parseStep(''), 0);
});

// ---------------- Real browser ----------------
const origin = 'http://127.0.0.1:4448';
const preview = 'http://127.0.0.1:4449';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// The smallest valid PNG: 1×1 transparent pixel. Test data only.
const qa = process.env.HARNESS_QA_DIR; // Optional screenshot directory for manual review.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('builder page in Chromium: eight steps, highlights, fallbacks, two viewports, no errors', { timeout: 300000 }, async t => {
  const { getBrowser, closeBrowser } = await import('../lib/browser.mjs');
  const { FIXTURE } = await import('../lib/store.mjs');
  const recording = builderRecording();
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-builder-page-data-'));
  const recordingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-builder-page-recording-'));
  await fs.writeFile(path.join(recordingDir, 'recording.json'), JSON.stringify(recording));
  const screens = new Set();
  const collect = entry => Object.values(entry?.screens || {}).filter(Boolean).forEach(rel => screens.add(path.basename(rel)));
  for (const [key, entry] of Object.entries(recording.steps)) if (key === 'step6') { collect(entry.withoutMemory); collect(entry.withMemory); } else collect(entry);
  await fs.mkdir(path.join(recordingDir, 'screens'));
  // Every screenshot exists except one, to test the missing-screenshot placeholder.
  for (const name of screens) if (name !== 'step3-production.png') await fs.writeFile(path.join(recordingDir, 'screens', name), PNG);
  // One recorded run exists on this server, so step 5 shows live phones.
  const live = runOf(recording, 5);
  await fs.mkdir(path.join(data, 'runs', live.id), { recursive: true });
  await fs.writeFile(path.join(data, 'runs', live.id, 'run.json'), JSON.stringify({ ...live, checkpoints: [], history: [] }));
  await fs.cp(FIXTURE, path.join(data, 'runs', live.id, 'workspace'), { recursive: true });

  const env = { ...process.env, HARNESS_DATA_DIR: data, PORT: '4448', PREVIEW_PORT: '4449', HARNESS_BUILDER_RECORDING: path.join(recordingDir, 'recording.json') };
  for (const name of ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_BASE_URL', 'LLM_PROTOCOL']) delete env[name];
  const wrapper = "await import('./server.mjs'); process.on('message', message => { if (message === 'unit-test-shutdown') { process.disconnect(); process.emit('SIGTERM'); } });";
  const child = spawn(process.execPath, ['--input-type=module', '--eval', wrapper], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    await closeBrowser();
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      if (child.connected) child.send('unit-test-shutdown'); else child.kill();
      await Promise.race([exited, delay(5000)]);
      if (child.exitCode === null) { child.kill('SIGKILL'); await exited; }
    }
    await fs.rm(data, { recursive: true, force: true });
    await fs.rm(recordingDir, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 150 && child.exitCode === null; i++) {
    if (output.includes(`Harness Lab: ${origin}`)) { ready = true; break; }
    await delay(100);
  }
  assert.ok(ready, output);
  for (const asset of ['/builder.html', '/builder.mjs', '/builder.css']) assert.equal((await fetch(origin + asset)).status, 200, asset);
  const served = await (await fetch(origin + '/api/builder')).json();
  assert.deepEqual(served.present, { [live.id]: true });
  assert.equal((await (await fetch(origin + '/api/state')).json()).provider.configured, false, 'no provider is configured');

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const pageErrors = [], consoleErrors = [], external = [];
  await context.route('**/*', route => {
    if ([origin, preview].includes(new URL(route.request().url()).origin)) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const title = () => page.locator('#step-title').innerText();
  const waitStep = async (n, name) => {
    await page.waitForFunction(([hash, text]) => location.hash === hash && document.querySelector('#step-title').textContent === text, [`#step-${n}`, `${name}.`]);
  };
  const marks = () => page.locator('.request-text mark.req-new').allInnerTexts();
  const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.body.scrollWidth <= document.documentElement.clientWidth);
  // The request box scrolls so the step's highlighted section is in view.
  const markInView = start => page.evaluate(text => { const box = document.querySelector('.request-text'); const mark = [...box.querySelectorAll('mark.req-new')].find(m => m.textContent.trim().startsWith(text)); if (!mark) return false; const a = box.getBoundingClientRect(), b = mark.getBoundingClientRect(); return b.top >= a.top && b.top < a.bottom; }, start);
  const current = () => page.locator('#diagram .anatomy-card.highlight').evaluateAll(cards => cards.map(card => [card.dataset.component, card.dataset.enabled]));

  await page.goto(`${origin}/builder.html`);
  await page.waitForFunction(() => document.querySelector('#recording-notice').hidden && document.querySelector('[data-request]'));
  assert.equal(await title(), 'A model alone.');
  assert.equal(await page.locator('#step-count').innerText(), 'STEP 0 OF 7');
  assert.equal((await marks()).length, 0, 'step 0 highlights nothing');
  assert.match(await page.locator('.request-text').innerText(), /You are asked to fix the real Pocket Notes application/);
  assert.equal(await page.locator('[data-reply]').innerText(), recording.steps.step0.text, 'the whole reply, verbatim');
  assert.match(await page.locator('.builder-activity .event-row').innerText(), /characters of text, shown in full below/);
  assert.match(await page.locator('#proof [data-footer]').innerText(), /Recorded run\. Not live\./);
  assert.match(await page.locator('#phones').innerText(), /only replied with text/);
  assert.deepEqual(await current(), []);
  assert.equal(await page.locator('#back').isDisabled(), true);
  assert.match(await page.locator('#code figcaption').innerText(), /lib\/runner\.mjs/);

  await page.keyboard.press('ArrowRight');
  await waitStep(1, 'Agent loop');
  assert.deepEqual((await marks()).map(text => text.trim()), [LOOP_SENTENCE, 'Remaining model calls: 24 of 24. Reported token use: 0 of 150000; the next request must also fit a conservative reservation.  No tool can end the task in this configuration; the budget ends it.']);
  assert.deepEqual(await current(), [['loop', 'true']]);
  assert.equal(await page.locator('#diagram .anatomy-card.enabled').count(), 1);
  assert.ok(await page.locator('.builder-activity .event-row').count() <= MAX_ROWS);
  assert.match(await page.locator('.event-elided').first().innerText(), /^\d+ more lines$/);
  assert.equal(await page.locator('.builder-activity .event-row[data-kind="observation"]').count() > 0, true);
  assert.equal(await page.locator('.builder-activity .event-row[data-kind="budget"]').count(), 1);
  assert.match(await page.locator('#code pre').innerText(), /Observation returned to the model/);

  await page.locator('#next').click();
  await waitStep(2, 'Tools and sandbox');
  assert.deepEqual(await current(), [['tools', 'true']]);
  const probe = page.locator('.builder-activity .event-row[data-actor="probe"]');
  assert.equal(await probe.count(), 1);
  assert.match(await probe.innerText(), /Presenter-triggered probe, not a model action/);
  assert.match(await page.locator('.builder-activity .event-row[data-actor="presenter"]').innerText(), /Presenter action, not the model/);
  assert.equal(await page.locator('.builder-activity .event-row', { hasText: 'Tool: write_file' }).count(), 1);
  assert.equal(await page.locator('#phones iframe').count(), 0, 'no live copy of this run on the server');
  assert.deepEqual(await page.locator('#phones img.phone-screen').evaluateAll(images => images.map(img => new URL(img.src).pathname)), ['/builder-assets/step2-sandbox.png', '/builder-assets/step2-production.png']);
  await page.waitForFunction(() => [...document.querySelectorAll('#phones img.phone-screen')].every(img => img.complete && img.naturalWidth === 1));
  assert.equal(await page.locator('#phones .production-banner').innerText(), 'Original build. No change applied.');

  await page.keyboard.press('ArrowRight');
  await waitStep(3, 'Instructions and policies');
  const ruleMarks = await marks();
  assert.equal(ruleMarks.length, 1);
  assert.match(ruleMarks[0], /^Automatically loaded project instructions \(PROJECT\.md\):/);
  assert.deepEqual(await current(), [['instructions', 'true']]);
  await page.locator('[data-phone="production"] .phone-missing').waitFor();
  assert.equal(await page.locator('[data-phone="production"] .phone-missing').innerText(), 'Screenshot not found');
  assert.equal(await page.locator('[data-phone="sandbox"] img.phone-screen').count(), 1);

  await page.keyboard.press('ArrowRight');
  await waitStep(4, 'Context management');
  assert.match(await page.locator('#proof [data-not-recorded]').innerText(), /^Not recorded yet/);
  assert.match(await page.locator('#phones [data-not-recorded]').innerText(), /^Not recorded yet/);
  assert.equal(await page.locator('#proof [data-request]').count(), 0);
  assert.deepEqual(await current(), [['context', 'true']], 'the diagram still renders');
  assert.match(await page.locator('#problem').innerText(), /starts blind|hunt/);

  await page.keyboard.press('ArrowRight');
  await waitStep(5, 'Verification');
  assert.match(await page.locator('[data-request-caption]').innerText(), /new since step 3 \(step 4 is not recorded\)/);
  assert.deepEqual((await marks()).map(text => text.trim()), ['Completion is gated by passing protected browser checks on the current revision. Failed completion attempts return observed failures for another edit/verify cycle.']);
  assert.deepEqual(await page.locator('#phones iframe').evaluateAll(frames => frames.map(frame => frame.getAttribute('src'))), [`${preview}/preview/${live.id}/index.html`, `${preview}/production/${live.id}/index.html?rev=${live.appliedRevision}`]);
  assert.equal(await page.locator('#phones .production-banner').innerText(), `Updated automatically by the agent at ${new Date(live.appliedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. No review.`);
  for (const role of ['sandbox', 'production']) await page.frameLocator(`[data-phone="${role}"] iframe`).getByText('My notes').first().waitFor();
  assert.deepEqual(await page.locator('.builder-activity .event-row[data-kind="verification"] strong').allInnerTexts(), ['4/6 browser checks passed', '6/6 browser checks passed', '6/6 browser checks passed']);

  await page.locator('#next').click();
  await waitStep(6, 'Memory and state');
  assert.equal(await page.locator('.proof-column').count(), 2);
  assert.equal(await page.locator('.proof-column[data-slot="withMemory"] .event-row', { hasText: 'Saved handoff included in request' }).count(), 1);
  assert.equal(await page.locator('.proof-column[data-slot="withoutMemory"] .event-row', { hasText: 'Saved handoff included in request' }).count(), 0);
  assert.match(await page.locator('.handoff-text').innerText(), /^Restored durable memory from a previous model session/);
  assert.ok((await marks()).some(text => text.startsWith('Restored durable memory')));
  assert.ok(await markInView('Restored durable memory'), 'the handoff section is scrolled into view');
  assert.equal(await page.locator('.proof-column [data-footer]').count(), 2);
  assert.match(await page.locator('.proof-highlights').innerText(), /The handoff carried a check result, a saved note and 1 recent action, plus the source revision\./);
  assert.equal(await page.locator('#phones .builder-phone').count(), 4);
  assert.deepEqual(await current(), [['memory', 'true']]);

  await page.keyboard.press('ArrowRight');
  await waitStep(7, 'Guardrails: approval');
  assert.equal(await page.locator('#next').isDisabled(), true);
  assert.ok(await markInView('Completion prepares a patch for explicit human approval'), 'the new approval line is scrolled into view');
  assert.deepEqual(await page.locator('#phones .production-banner').allInnerTexts(), ['Original build. One change is waiting for your approval.', `Updated after your approval at ${new Date(runOf(recording, 7).appliedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`]);
  assert.deepEqual(await page.locator('#phones .builder-phone').evaluateAll(phones => phones.map(p => p.dataset.phone)), ['sandbox', 'production-before', 'production-after']);
  assert.match(await page.locator('[data-changes]').innerText(), /src\/storage\.js/);
  assert.deepEqual(await page.locator('.builder-activity .event-row[data-kind="permission"] .event-label').allInnerTexts(), ['Waiting for a person · Harness', 'Published after a person approved · Harness']);
  assert.deepEqual(await current(), [['guardrails', 'true']]);
  assert.equal(await page.locator('#diagram .anatomy-card.enabled').count(), 7);
  await page.keyboard.press('ArrowRight');
  assert.equal(await title(), 'Guardrails: approval.', 'no step after 7');

  await page.keyboard.press('ArrowLeft');
  await waitStep(6, 'Memory and state');
  await page.locator('#back').click();
  await waitStep(5, 'Verification');

  // The hash selects a step on load.
  await page.goto(`${origin}/builder.html#step-3`);
  await waitStep(3, 'Instructions and policies');

  // Both viewports, every step: no horizontal scroll.
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (let step = 0; step <= 7; step++) {
      await page.goto(`${origin}/builder.html#step-${step}`);
      await page.waitForFunction(n => document.querySelector('#recording-notice').hidden && document.querySelector('#step-count').textContent === `STEP ${n} OF 7`, step);
      assert.ok(await noHorizontalScroll(), `no horizontal scroll at ${viewport.width}x${viewport.height}, step ${step}`);
      if (qa) { await fs.mkdir(qa, { recursive: true }); await page.screenshot({ path: path.join(qa, `builder-${viewport.width}-step${step}.png`), fullPage: true }); }
    }
  }

  assert.deepEqual(pageErrors, []);
  // The only console errors so far are the deliberately missing screenshot's 404s.
  assert.ok(consoleErrors.length >= 1);
  assert.deepEqual(consoleErrors.filter(text => !/status of 404/.test(text)), []);
  // Missing recording: every step still renders and says Not recorded yet. A new
  // query string forces a real load (a hash-only change would not reload).
  await page.route('**/api/builder', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No builder recording found.' }) }));
  await page.goto(`${origin}/builder.html?missing=1#step-0`);
  await page.waitForFunction(() => /No builder recording/.test(document.querySelector('#recording-notice').textContent) && !document.querySelector('#recording-notice').hidden);
  for (let step = 0; step <= 7; step++) {
    if (step) await page.keyboard.press('ArrowRight');
    await page.waitForFunction(n => document.querySelector('#step-count').textContent === `STEP ${n} OF 7`, step);
    assert.match(await page.locator('#proof [data-not-recorded]').innerText(), /^Not recorded yet/, `step ${step}`);
    assert.equal(await page.locator('#diagram .anatomy-card').count(), 7);
    assert.ok((await page.locator('#problem').innerText()).length > 20);
    assert.ok(await noHorizontalScroll());
  }
  await page.unroute('**/api/builder');

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors.filter(text => !/status of 404/.test(text)), [], 'only the deliberate missing-recording 404 may appear');
  assert.deepEqual(external, []);
  await context.close();
});
