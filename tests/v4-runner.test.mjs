// Harness v4 runner tests. Provider transport is mocked only inside this test
// process; files, events, prompt assembly and session handling are real. No
// record produced here is model evidence or enters the demo history.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.HARNESS_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-v4-runner-'));
process.env.OPENAI_API_KEY = '';
process.env.OPENAI_MODEL = '';
process.env.OPENAI_BASE_URL = '';
const { configureProvider, getPublicConfig } = await import('../lib/provider.mjs');
const { createRun, filePath, workspace, runDir, TICKET, READABLE, FILES } = await import('../lib/store.mjs');
const { executeTool, startRun, pauseRun, resumeRun, running, assembleModelInput, buildHandoff, compactChecks } = await import('../lib/runner.mjs');
const { withoutHeldOut, CHECK_SUITE_VERSION } = await import('../lib/browser.mjs');
configureProvider({ apiKey: 'unit-only-never-send', model: 'unit-model', baseUrl: 'https://unit.invalid/v1' });
globalThis.fetch = async () => { throw new Error('Network prohibited in v4 runner unit tests'); };
test.after(async () => { await fs.rm(process.env.HARNESS_DATA_DIR, { recursive: true, force: true }); });

const TICKET_HEADING = 'Related ticket thread PN-142, supplied by the harness:';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('new runs use harness version 4 and include src/export.js in the editable, hashed file set', async () => {
  const run = await createRun({ mode: 'minimal' });
  assert.equal(run.harnessVersion, 4);
  assert.equal(run.resetAfterCalls, null);
  assert.equal(run.appliedAt, null);
  assert.ok(FILES.includes('src/export.js'));
  assert.match(await fs.readFile(filePath(run.id, 'src/export.js'), 'utf8'), /buildBackup/);
  const listed = await executeTool(run, 'list_files', {});
  assert.ok(listed.files.some(file => file.path === 'src/export.js' && file.writable));
  const before = run.revision;
  await executeTool(run, 'write_file', { path: 'src/export.js', content: '// test-only edit\n' });
  assert.notEqual(run.revision, before, 'src/export.js is part of the revision hash');
});

test('createRun validates resetAfterCalls', async () => {
  for (const value of [1, 24, 0, 2.5, '3', -4]) await assert.rejects(createRun({ mode: 'minimal', resetAfterCalls: value }), /resetAfterCalls/);
  assert.equal((await createRun({ mode: 'minimal', resetAfterCalls: 2 })).resetAfterCalls, 2);
  assert.equal((await createRun({ mode: 'engineered', resetAfterCalls: 23 })).resetAfterCalls, 23);
  assert.equal((await createRun({ mode: 'engineered', resetAfterCalls: null })).resetAfterCalls, null);
});

test('ticket thread is supplied only through context management on harness version 4', async () => {
  const ticket = (await fs.readFile(TICKET, 'utf8')).replace(/\r\n/g, '\n');
  assert.ok(ticket.length < 6000, 'The fixture ticket fits the bound without truncation');
  for (const [mode, features, expected] of [['minimal', undefined, false], ['engineered', undefined, true], ['minimal', { context: true }, true], ['engineered', { context: false }, false], ['minimal', { instructions: true }, false]]) {
    const run = await createRun({ mode, features });
    const assembled = await assembleModelInput(run);
    assert.equal(assembled.text.includes(TICKET_HEADING), expected, `${mode} ${JSON.stringify(features)}`);
    assert.equal(assembled.text.includes('INC-37'), expected);
    assert.equal(!!assembled.sections.context?.includes(TICKET_HEADING), expected);
    if (expected) assert.ok(assembled.sections.context.endsWith(`${TICKET_HEADING}\n${ticket.slice(0, 6000)}`));
  }
  const older = await createRun({ mode: 'engineered' });
  older.harnessVersion = 3;
  const assembled = await assembleModelInput(older);
  assert.ok(assembled.sections.context, 'Version 3 keeps its context section');
  assert.equal(assembled.text.includes(TICKET_HEADING), false, 'Version 1 to 3 runs keep their recorded behavior');
});

test('the ticket is never copied, listed or readable through tools', async () => {
  const run = await createRun({ mode: 'engineered' });
  for (const target of ['../ticket/PN-142.md', 'PN-142.md', 'fixtures/ticket/PN-142.md', '../../fixtures/ticket/PN-142.md']) {
    await assert.rejects(executeTool(run, 'read_file', { path: target }), /Invalid path argument/);
    assert.throws(() => filePath(run.id, target), /Permission denied/);
  }
  assert.equal(READABLE.some(name => /PN-142|ticket/i.test(name)), false);
  const listed = await executeTool(run, 'list_files', {});
  assert.equal(listed.files.some(file => /PN-142|ticket/i.test(file.path)), false);
  await assert.rejects(fs.access(path.join(workspace(run.id), 'PN-142.md')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(workspace(run.id), 'ticket')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(runDir(run.id), 'ticket')), { code: 'ENOENT' });
});

test('held-out results never reach prompts, compact checks or handoffs', async () => {
  const secret = 'HELD_OUT_PRESENTER_ONLY_DETAIL';
  const heldOut = { suiteVersion: CHECK_SUITE_VERSION, tier: 'heldOut', revision: 'x', passed: 0, total: 5, results: [{ name: secret, passed: false, detail: secret }] };
  for (const harnessVersion of [2, 3, 4]) {
    const run = await createRun({ mode: 'engineered' });
    run.harnessVersion = harnessVersion;
    run.checks = { suiteVersion: CHECK_SUITE_VERSION, tier: 'visible', revision: run.revision, origin: 'presenter', passed: 5, total: 6, results: [{ name: 'Visible failure', passed: false, detail: 'VISIBLE_DETAIL' }], heldOut };
    run.checkpoints = [{ tool: 'run_checks', revision: run.revision, detail: run.checks }];
    run.session = 2;
    run.sessionHandoff = buildHandoff(run);
    const assembled = await assembleModelInput(run);
    assert.ok(assembled.text.includes('VISIBLE_DETAIL'), 'Visible presenter results still reach a verification-enabled context');
    assert.equal(assembled.text.includes(secret), false, `v${harnessVersion} prompt`);
    assert.equal(assembled.text.includes('heldOut'), false);
    assert.equal(JSON.stringify(run.sessionHandoff).includes(secret), false);
    assert.equal('heldOut' in compactChecks(run.checks), false);
  }
  const visible = { passed: 1, total: 1, heldOut };
  assert.deepEqual(withoutHeldOut(visible), { passed: 1, total: 1 });
  assert.equal('heldOut' in visible, true, 'Stripping returns a copy and leaves the stored presenter result intact');
});

test('agent browser_action may click the Backup tab with the same schema for every preset', async () => {
  const minimal = await createRun({ mode: 'minimal' }), engineered = await createRun({ mode: 'engineered' });
  const { toolsForRun } = await import('../lib/runner.mjs');
  const schema = run => toolsForRun(run).find(tool => tool.name === 'browser_action');
  assert.deepEqual(schema(minimal), schema(engineered));
  assert.ok(schema(minimal).parameters.properties.target.enum.includes('backup-tab'));
  await assert.rejects(executeTool(minimal, 'browser_action', { action: 'click', target: 'note-body', value: '' }), /button target/);
});

// Scripted Responses-protocol transport: two tool calls, then a request held
// open until Pause aborts it.
function scriptedTransport(t, observed, steps) {
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    const body = JSON.parse(options.body);
    observed.push(body);
    const step = steps[observed.length - 1];
    if (!step) return new Promise((_resolve, reject) => {
      if (options.signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
      else options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    return Promise.resolve(new Response(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', call_id: `reset-unit-${observed.length}`, name: step.name, arguments: JSON.stringify(step.args) }], usage: { input_tokens: 5, output_tokens: 3 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
}
async function waitFor(predicate, description, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; await delay(10); }
  assert.fail(`Timed out waiting for ${description}`);
}

test('forced reset happens at the same call for both presets and restores a handoff only with memory', async t => {
  const resets = {};
  for (const mode of ['minimal', 'engineered']) {
    await t.test(mode, async t => {
      const observed = [];
      scriptedTransport(t, observed, [{ name: 'list_files', args: {} }, { name: 'read_file', args: { path: 'PROJECT.md' } }]);
      const run = await createRun({ mode, provider: getPublicConfig(), resetAfterCalls: 2 });
      startRun(run);
      await waitFor(() => observed.length === 3 && run.session === 2, 'third request in session 2');
      assert.equal(running(run.id), true);
      await pauseRun(run);
      assert.equal(run.status, 'paused');
      const resetEvents = run.events.filter(item => item.kind === 'reset');
      assert.equal(resetEvents.length, 1);
      assert.equal(resetEvents[0].title, 'Context limit reached: fresh session required');
      assert.match(resetEvents[0].detail, /previous API conversation is cleared/);
      assert.match(resetEvents[0].detail, /memory policy decides what is restored/);
      assert.equal(resetEvents[0].call, 2);
      assert.equal(resetEvents[0].session, 1);
      assert.equal(resetEvents[0].memory, mode === 'engineered');
      resets[mode] = resetEvents[0].call;
      assert.deepEqual(run.forcedReset && { afterCall: run.forcedReset.afterCall, session: run.forcedReset.session }, { afterCall: 2, session: 1 });
      const resetIndex = run.events.indexOf(resetEvents[0]);
      const freshIndex = run.events.findIndex(item => item.title === 'Fresh model session started');
      assert.ok(freshIndex > resetIndex, 'Session 2 starts after the reset event');
      assert.equal(run.session, 2);
      assert.equal(run.usage.calls, 3);
      assert.equal(observed[1].input.length, 3, 'Session 1 kept its conversation before the reset');
      assert.equal(observed[2].input.length, 1, 'Session 2 starts without previous API messages');
      assert.equal(observed[2].instructions.includes('Restored durable memory'), mode === 'engineered');
      assert.equal(observed[0].instructions.includes('Restored durable memory'), false);
      assert.equal(run.events.some(item => item.title === 'Saved progress restored into this session'), mode === 'engineered');
      assert.equal(!!run.sessionHandoff, mode === 'engineered');
      assert.equal(observed[2].instructions.includes(TICKET_HEADING), mode === 'engineered');
    });
  }
  assert.equal(resets.minimal, resets.engineered);
});

test('a presenter pause during the forced reset settles as paused, then resume starts the fresh session once', async t => {
  for (const occurrence of [1, 2]) {
    await t.test(`pause at reset persistence #${occurrence}`, async t => {
      const observed = [];
      scriptedTransport(t, observed, [{ name: 'list_files', args: {} }, { name: 'list_files', args: {} }, { name: 'list_files', args: {} }]);
      const run = await createRun({ mode: 'minimal', provider: getPublicConfig(), resetAfterCalls: 2 });
      const runJson = path.join(runDir(run.id), 'run.json');
      const rename = fs.rename;
      let seen = 0, pausing = null;
      // #1 is the reset event's own write; #2 is the session-1 loop's final write.
      t.mock.method(fs, 'rename', async (from, to) => {
        if (to === runJson && run.events.at(-1)?.kind === 'reset' && ++seen === occurrence) pausing = pauseRun(run);
        return rename(from, to);
      });
      startRun(run);
      await waitFor(() => pausing, 'pause during reset');
      await pausing;
      assert.equal(run.status, 'paused');
      assert.equal(running(run.id), false);
      assert.equal(run.session, 1, 'No session started behind the pause');
      assert.equal(observed.length, 2);
      assert.equal(run.events.filter(item => item.kind === 'reset').length, 1);
      const paused = run.events.filter(item => item.title === 'Paused at a safe tool boundary');
      assert.equal(paused.length, 1);
      // #1 settles in the loop's own pause handling; #2 after the loop released its controller.
      assert.equal(/during the forced session reset/.test(paused[0].detail), occurrence === 2);
      await delay(50);
      assert.equal(observed.length, 2, 'Nothing resumes on its own after a pause');
      resumeRun(run);
      await waitFor(() => observed.length === 4, 'session 2 requests');
      await pauseRun(run);
      assert.equal(run.session, 2);
      assert.equal(observed[2].input.length, 1);
      assert.equal(observed[2].instructions.includes('Restored durable memory'), false);
      assert.equal(run.events.filter(item => item.kind === 'reset').length, 1, 'Exactly one automatic reset per run');
    });
  }
});

test('a failed automatic session start leaves a resumable paused run with the reset recorded', async t => {
  const observed = [];
  scriptedTransport(t, observed, [{ name: 'list_files', args: {} }, { name: 'list_files', args: {} }]);
  const run = await createRun({ mode: 'engineered', provider: getPublicConfig(), resetAfterCalls: 2 });
  const rename = fs.rename;
  // Change the configured model while session 1 settles, so startRun refuses session 2.
  t.mock.method(fs, 'rename', async (from, to) => {
    if (run.events.at(-1)?.kind === 'reset') configureProvider({ model: 'different-unit-model' });
    return rename(from, to);
  });
  startRun(run);
  await waitFor(() => run.status === 'paused', 'paused after failed automatic start');
  configureProvider({ model: 'unit-model' });
  assert.equal(run.session, 1);
  assert.equal(run.history.length > 1, true, 'A refused session start keeps the previous state');
  assert.equal(run.events.at(-1).title, 'Fresh session could not start');
  assert.equal(running(run.id), false);
  assert.equal(observed.length, 2);
});

test('workspaces created before v4 (no src/export.js) keep their revision, diff, listing and publication', async () => {
  const { createHash } = await import('node:crypto');
  const { revision, revisionAt, diff } = await import('../lib/store.mjs');
  const run = await createRun({ mode: 'minimal' });
  run.harnessVersion = 3;
  await fs.rm(path.join(workspace(run.id), 'src/export.js'));
  const hash = createHash('sha256');
  for (const name of ['index.html', 'src/app.js', 'src/storage.js', 'src/styles.css']) hash.update(name).update(await fs.readFile(path.join(workspace(run.id), name)));
  const legacyRevision = hash.digest('hex').slice(0, 12);
  assert.equal(await revision(run.id), legacyRevision, 'The v3 revision formula is unchanged for v3 workspaces');
  assert.deepEqual(await diff(run), []);
  assert.equal((await executeTool(run, 'list_files', {})).files.some(file => file.path === 'src/export.js'), false);
  const result = await executeTool(run, 'request_completion', { summary: 'Test-only legacy publication.' });
  assert.equal(result.published, true);
  assert.equal(result.revision, legacyRevision);
  const published = path.join(runDir(run.id), 'published');
  await assert.rejects(fs.access(path.join(published, 'src/export.js')), { code: 'ENOENT' });
  assert.equal(await revisionAt(published), legacyRevision);
  assert.equal(JSON.parse(await fs.readFile(path.join(published, '.publication.json'), 'utf8')).at, run.appliedAt);
  await fs.access(path.join(published, 'src/storage.js'));
});
