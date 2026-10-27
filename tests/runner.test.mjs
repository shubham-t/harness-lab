// Runner unit tests: provider transport is mocked only inside this test process.
// Files, memory records, pause handling and prompt assembly are real. No model
// evaluation result is produced, and none of these records enter the demo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.HARNESS_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-runner-unit-'));
process.env.OPENAI_API_KEY = '';
process.env.OPENAI_MODEL = '';
process.env.OPENAI_BASE_URL = '';
const { configureProvider, getPublicConfig } = await import('../lib/provider.mjs');
const { createRun, filePath, runDir, persist, initStore, runs, publicRun } = await import('../lib/store.mjs');
const { executeTool, startRun, pauseRun, resumeRun, running, toolsForRun, assembleModelInput, buildHandoff } = await import('../lib/runner.mjs');
configureProvider({ apiKey: 'unit-only-never-send', model: 'unit-model', baseUrl: 'https://unit.invalid/v1' });
globalThis.fetch = async () => { throw new Error('Network prohibited in runner unit tests'); };

test('compact handoff retains edits, excludes repeated payloads and freezes prior-session observations', async () => {
  const run = await createRun({mode:'engineered',provider:getPublicConfig()});
  run.checkpoints=[{tool:'write_file',revision:run.revision,detail:{written:'src/storage.js'}}, {tool:'run_checks',revision:run.revision,detail:{suiteVersion:'notes-v2',revision:run.revision,origin:'agent',passed:6,total:6,results:[{passed:true,detail:'LARGE_PASSED_TEXT'.repeat(1000)}]}}];
  for(let i=0;i<20;i++)run.checkpoints.push({tool:'browser_action',revision:run.revision,detail:{text:'LARGE_PAGE_TEXT'.repeat(1000)}});
  run.sessionHandoff=buildHandoff(run);run.session=2;
  const frozen=JSON.stringify(run.sessionHandoff);assert.ok(frozen.length<2000);
  assert.equal(run.sessionHandoff.editedFiles[0].file,'src/storage.js');assert.equal(run.sessionHandoff.checks.passed,6);
  run.checkpoints.push({tool:'write_file',revision:'new',detail:{written:'src/app.js'}});
  run.memory='CURRENT_SESSION_NOTE';
  const input=await assembleModelInput(run);
  assert.ok(input.sections.memory.includes(frozen));assert.equal(input.sections.memory.includes('CURRENT_SESSION_NOTE'),false);
  assert.equal(input.sections.memory.includes('LARGE_PAGE_TEXT'),false);
  assert.equal(input.sections.memory.includes('src/app.js'),false);
  run.features.verification=false;
  assert.equal(buildHandoff(run).checks,null,'Verification-disabled handoffs exclude acceptance results');
  assert.match(input.text,/Remaining model calls: 24 of 24/);
  const minimal=await createRun({mode:'minimal'});assert.match((await assembleModelInput(minimal)).text,/Remaining model calls: 24 of 24/);
});

test('fresh sessions restore memory only when enabled, retain files, and account for aborted requests', async t => {
  const observed = [];
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    observed.push(JSON.parse(options.body));
    return new Promise((_resolve, reject) => {
      if (options.signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
      else options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  });
  async function waitForRequest(count) {
    for (let i = 0; i < 200 && observed.length < count; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(observed.length, count);
  }
  for (const mode of ['minimal', 'engineered']) {
    await t.test(mode, async () => {
      const run = await createRun({ mode, provider: getPublicConfig() });
      const original = await fs.readFile(filePath(run.id, 'src/storage.js'), 'utf8');
      await executeTool(run, 'write_file', { path: 'src/storage.js', content: original + '\n// UNIT_HANDOFF_SOURCE_CHANGE\n' });
      if (mode === 'engineered') assert.equal((await executeTool(run, 'save_memory', { content: 'UNIT_FINDING: investigate draft persistence next.' })).saved, true);
      else {
        await assert.rejects(executeTool(run, 'save_memory', { content: 'UNIT_FINDING' }), /unavailable/);
        await assert.rejects(executeTool(run, 'run_checks', {}), /unavailable/);
        assert.equal(run.checkpoints.length, 0);
      }
      // Presenter results must never leak into a verification-disabled prompt.
      run.checks = { passed: 4, total: 6, results: [{ name: 'Test-only observation', passed: false, detail: 'PRESENTER_ONLY_EVIDENCE' }] };
      const previousCount = observed.length;
      startRun(run);
      await waitForRequest(previousCount + 1);
      assert.equal(running(run.id), true);
      await pauseRun(run);
      assert.equal(run.status, 'paused');
      assert.equal(running(run.id), false);
      assert.equal(run.activeSessionStartedAt, null);
      const elapsedBeforeResume = publicRun(run).elapsedMs;
      assert.ok(elapsedBeforeResume >= 0);
      resumeRun(run);
      await waitForRequest(previousCount + 2);
      const secondRequest = observed.at(-1);
      for (const component of ['instructions','context']) {
        const recorded=run.events.findLast(e=>e.kind===component);
        assert.equal(!!recorded,mode==='engineered');
        if(recorded) assert.ok(secondRequest.instructions.includes(recorded.content),'Recorded input must be in the actual provider request');
      }
      assert.equal(secondRequest.input.length, 1, 'Fresh session must not keep prior API history');
      assert.equal(secondRequest.instructions.includes('UNIT_FINDING'), mode === 'engineered');
      assert.equal(secondRequest.instructions.includes('Automatically loaded project instructions'), mode === 'engineered');
      assert.equal(secondRequest.instructions.includes('Current project context:'), mode === 'engineered');
      assert.equal(secondRequest.instructions.includes('PRESENTER_ONLY_EVIDENCE'), mode === 'engineered');
      assert.equal(secondRequest.tools.some(tool => tool.name === 'run_checks'), mode === 'engineered');
      assert.equal(secondRequest.tools.some(tool => tool.name === 'save_memory'), mode === 'engineered');
      assert.equal(run.session, 2);
      assert.match(await fs.readFile(filePath(run.id, 'src/storage.js'), 'utf8'), /UNIT_HANDOFF_SOURCE_CHANGE/);
      await pauseRun(run);
      assert.equal(run.usage.calls, 2);
      assert.equal(run.usage.unreportedRequests, 2);
      assert.equal(run.usage.input + run.usage.output, 0, 'Unknown usage cannot be fabricated');
      assert.ok(publicRun(run).elapsedMs >= elapsedBeforeResume);
    });
  }
});

test('project policies and project map are independently enabled inputs',async()=>{
  for(const [instructions,context] of [[false,false],[true,false],[false,true],[true,true]]) {
    const run=await createRun({mode:'minimal',features:{instructions,context}});
    const assembled=await assembleModelInput(run);
    assert.equal(!!assembled.sections.instructions,instructions);
    assert.equal(!!assembled.sections.context,context);
    if(instructions) {
      assert.match(assembled.sections.instructions,/Preserve existing notes/);
      assert.doesNotMatch(assembled.sections.instructions,/## Repository map/);
      assert.doesNotMatch(assembled.sections.instructions,/Use run_checks/,'Disabled verification must not be requested by the project rules');
    }
    if(context) {
      assert.match(assembled.sections.context,/src\/storage.js: notes and draft storage/);
      assert.doesNotMatch(assembled.sections.context,/## Conventions/);
    }
  }
});

test('legacy configurations retain their original tool access', async () => {
  const run = await createRun({ mode: 'minimal' });
  assert.equal(run.harnessVersion, 4);
  delete run.harnessVersion;
  assert.ok(toolsForRun(run).some(tool => tool.name === 'run_checks'));
  assert.equal((await executeTool(run, 'save_memory', { content: 'not retained' })).saved, false);
});

test('checkpoint reload marks a running record interrupted and preserves files and memory', async () => {
  const run = await createRun({ provider: getPublicConfig() });
  await executeTool(run, 'save_memory', { content: 'Persisted unit finding.' });
  run.status = 'running';
  run.activeSessionStartedAt = Date.now() - 10000;
  await persist(run);
  runs.delete(run.id);
  await initStore();
  const loaded = runs.get(run.id);
  assert.equal(loaded.status, 'interrupted');
  assert.equal(loaded.activeSessionStartedAt, null);
  assert.equal(loaded.memory, 'Persisted unit finding.');
  assert.match(loaded.events.at(-1).detail, /previous execution stopped/);
  assert.match(await fs.readFile(filePath(run.id, 'src/storage.js'), 'utf8'), /readDraft/);
});

test('failed resume preserves session state when provider settings differ', async () => {
  const run = await createRun({ provider: getPublicConfig() });
  run.status = 'paused'; run.history = [{ role: 'user', content: 'Persist this history.' }];
  configureProvider({ model: 'different-unit-model' });
  assert.throws(() => resumeRun(run), /pinned/);
  assert.equal(run.session, 1);
  assert.equal(run.status, 'paused');
  assert.equal(run.history[0].content, 'Persist this history.');
  configureProvider({ model: 'unit-model' });
});

test('abrupt process death preserves an attempted call and recovers its unknown usage exactly once', { timeout: 15000 }, async t => {
  // The child uses mocked transport, then is forcibly stopped while that
  // request is unresolved. No shutdown handler gets an opportunity to persist.
  const script = `
    import fs from 'node:fs/promises';
    import path from 'node:path';
    import { configureProvider, getPublicConfig } from './lib/provider.mjs';
    import { createRun, runDir } from './lib/store.mjs';
    import { startRun } from './lib/runner.mjs';
    configureProvider({ apiKey: 'unit-only-never-send', model: 'unit-model', baseUrl: 'https://unit.invalid/v1' });
    let run;
    globalThis.fetch = async () => {
      const persisted = JSON.parse(await fs.readFile(path.join(runDir(run.id), 'run.json'), 'utf8'));
      process.send({ id: run.id, persisted });
      return new Promise(() => {});
    };
    run = await createRun({ provider: getPublicConfig() });
    startRun(run);
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    env: { ...process.env }, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => { if (child.exitCode === null) child.kill('SIGKILL'); await exited; });
  const message = await new Promise((resolve, reject) => {
    child.once('message', resolve);
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Child exited before request: ${code}: ${stderr}`)));
  });
  assert.equal(message.persisted.usage.calls, 1, 'Attempt count must be durable before fetch');
  assert.equal(message.persisted.step, 1);
  assert.equal(message.persisted.inFlightRequest.call, 1);
  child.kill('SIGKILL');
  await exited;
  await initStore();
  let recovered = runs.get(message.id);
  assert.equal(recovered.status, 'interrupted');
  assert.equal(recovered.usage.calls, 1);
  assert.equal(recovered.step, 1);
  assert.equal(recovered.usage.unreportedRequests, 1);
  assert.equal(recovered.usage.input + recovered.usage.output, 0);
  assert.equal(recovered.inFlightRequest, null);
  assert.equal(recovered.events.filter(item => item.title === 'Interrupted request usage unavailable').length, 1);
  const durable = JSON.parse(await fs.readFile(path.join(runDir(message.id), 'run.json'), 'utf8'));
  assert.equal(durable.inFlightRequest, null);
  assert.equal(durable.usage.unreportedRequests, 1);
  runs.delete(message.id);
  await initStore();
  recovered = runs.get(message.id);
  assert.equal(recovered.usage.unreportedRequests, 1, 'A second restart must not account for the same request again');
  assert.equal(recovered.events.filter(item => item.title === 'Interrupted request usage unavailable').length, 1);

  let requested = false;
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    requested = true;
    return new Promise((_resolve, reject) => {
      if (options.signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
      else options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  });
  resumeRun(recovered);
  for (let i = 0; i < 200 && !requested; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(requested);
  await pauseRun(recovered);
  assert.equal(recovered.usage.calls, 2);
  assert.equal(recovered.step, 2);
  assert.equal(recovered.usage.unreportedRequests, 2, 'Only the newly aborted request adds unknown usage');
  assert.equal(recovered.inFlightRequest, null);
});

test('resolved request accounting clears its crash marker for reported, omitted, and failed responses', async t => {
  for (const outcome of ['reported', 'omitted', 'failed']) {
    await t.test(outcome, async t => {
      t.mock.method(globalThis, 'fetch', async () => {
        if (outcome === 'failed') throw new Error('Unit transport failure');
        return new Response(JSON.stringify({
          status: 'completed', output: [{ type: 'function_call', call_id: 'unit_save', name: 'save_memory', arguments: '{"content":"observed"}' }],
          ...(outcome === 'reported' ? { usage: { input_tokens: 17, output_tokens: 5 } } : {})
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      const run = await createRun({ provider: getPublicConfig() });
      // End after one actual request without needing browser or completion tools.
      run.step = 23; run.usage.calls = 23;
      startRun(run);
      for (let i = 0; i < 300 && running(run.id); i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(running(run.id), false);
      assert.equal(run.status, outcome === 'failed' ? 'failed' : 'budget_exceeded');
      assert.equal(run.usage.calls, 24);
      assert.equal(run.step, 24);
      assert.equal(run.inFlightRequest, null);
      assert.equal(run.usage.unreportedRequests || 0, outcome === 'reported' ? 0 : 1);
      assert.equal(run.usage.input, outcome === 'reported' ? 17 : 0);
      assert.equal(run.usage.output, outcome === 'reported' ? 5 : 0);
      runs.delete(run.id);
      await initStore();
      const reloaded = runs.get(run.id);
      assert.deepEqual(reloaded.usage, run.usage, 'Resolved accounting must not be counted again on restart');
      assert.equal(reloaded.inFlightRequest, null);
    });
  }
});
