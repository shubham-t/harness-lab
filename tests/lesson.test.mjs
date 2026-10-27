import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { outcome, comparableRuns, claimsEvidence, toolCalls, productionBanner, promptInputs, latestHeldOut, heldOutOutcome, ladderTable, ladderFilters, CLAIMS_FOOTER } from '../public/lesson.mjs';
const minimal = { id:'m', features:{}, status:'completed', task:'same task', harnessVersion:3, scenario:'draft', revision:'abc', usage:{calls:2}, provider:{model:'test-model',baseUrl:'https://unit.invalid',protocol:'responses'}, createdAt:'2026-10-26' };
const engineered = { ...minimal, id:'e', features:{instructions:true,context:true,memory:true,verification:true,permissions:true}, status:'awaiting_approval' };
test('explanation separates passing source, required controls and application', () => {
  const checks = {suiteVersion:'current',revision:'abc',passed:6,total:6};
  const m = outcome({...minimal, checks, appliedRevision:'abc'}, 'current');
  const e = outcome({...engineered, checks}, 'current');
  assert.equal(m.source,e.source);
  assert.match(m.required,/No acceptance/);
  assert.match(e.required,/Passing checks required/);
  assert.equal(m.publication,'Applied automatically');
  assert.equal(e.publication,'Waiting for human approval');
  const partial = outcome({...engineered, checks, status:'budget_exceeded'},'current');
  assert.equal(partial.source,'6/6 checks passed');
  assert.equal(partial.publication,'Not applied');
  assert.match(partial.explanation,/before successful completion/);
  const failed=outcome({...minimal,checks,status:'failed',events:[{kind:'error',detail:'The model request timed out after 120 seconds.'}]},'current');
  assert.equal(failed.source,'6/6 checks passed');assert.match(failed.stopReason,/timed out/);assert.equal(failed.publication,'Not applied');
});
test('unmeasured and stale results never appear as a current success', () => {
  assert.equal(outcome(minimal,'current').source,'Not measured yet');
  for (const checks of [{suiteVersion:'old',revision:'abc',passed:6,total:6},{suiteVersion:'current',revision:'old',passed:6,total:6}]) {
    assert.equal(outcome({...minimal,checks},'current').current,false);
    assert.match(outcome({...minimal,checks},'current').source,/Earlier evidence/);
  }
});
test('comparison excludes unrun workspaces, custom presets and incompatible trials', () => {
  const excluded = [ {...engineered,id:'ready',usage:{calls:0}}, {...engineered,id:'custom',features:{memory:true}}, {...engineered,id:'session',session:2}, {...engineered,id:'version',harnessVersion:2}, {...engineered,id:'scenario',scenario:'unicode'}, {...engineered,id:'task',task:'other'}, ...['model','baseUrl','protocol'].map(key=>({...engineered,id:key,provider:{...engineered.provider,[key]:'other'}})) ];
  assert.deepEqual(comparableRuns(minimal,[minimal,engineered,...excluded]).map(r=>r.id),['e']);
  assert.deepEqual(comparableRuns({...minimal,usage:{calls:0}},[engineered]),[]);
});

// v4 dashboard derivations. Real recorded runs from live-validation are read-only fixtures.
const recorded = file => JSON.parse(fs.readFileSync(new URL(`../live-validation/${file}`, import.meta.url), 'utf8'));
const byId = claims => Object.fromEntries(claims.rows.map(row => [row.id, row]));
test('comparison requires the same forced-reset setting', () => {
  assert.deepEqual(comparableRuns({...minimal,resetAfterCalls:4},[{...engineered,resetAfterCalls:4},{...engineered,id:'e5',resetAfterCalls:5},{...engineered,id:'none'}]).map(r=>r.id),['e']);
  assert.deepEqual(comparableRuns({...minimal,resetAfterCalls:null},[{...engineered,id:'unset'},{...engineered,id:'r4',resetAfterCalls:4}]).map(r=>r.id),['unset'],'absent and null are the same setting');
});
test('claimsEvidence on recorded v3 Minimal e25d301f: a refresh claim with zero reload actions', () => {
  const run = recorded('v3/minimal-e25d301f-60f1-46a2-aadf-93f595e3221c.json');
  const claims = claimsEvidence(run, { suiteVersion: 'notes-v3' });
  assert.equal(claims.available, true);
  assert.equal(claims.summary, run.events.findLast(e => e.kind === 'tool' && e.tool === 'request_completion').arguments.summary, 'summary is verbatim');
  assert.match(claims.summary, /Survives page refresh/);
  const rows = byId(claims);
  assert.deepEqual(claims.rows.map(r => r.id), ['switch','refresh','save','clear','existing','distinct','backup','literal']);
  assert.deepEqual(Object.fromEntries(claims.rows.map(r => [r.id, r.exercised])), { switch:true, refresh:false, save:true, clear:true, existing:false, distinct:true, backup:false, literal:false });
  assert.equal(claims.checksAvailable, false);
  assert.ok(claims.rows.every(r => r.agentChecksText === 'tool not available' && r.agentChecks === null));
  assert.equal(rows.refresh.harness[0].text, 'Pass · earlier suite notes-v2', 'older suite is labelled, never shown as current');
  assert.equal(rows.refresh.harness[0].current, false);
  assert.equal(rows.backup.harness[0].text, 'not measured');
  assert.deepEqual(rows.existing.harness.map(h => h.tier), ['visible','heldOut']);
  assert.equal(claims.claimedWithoutRefreshTest, true);
  assert.equal(claims.footer, CLAIMS_FOOTER);
  assert.equal(CLAIMS_FOOTER, 'Claims are the model\'s words. Observations are recorded tool actions. This panel does not interpret model reasoning.');
});
test('claimsEvidence on recorded Engineered and legacy runs counts run_checks after the last edit', () => {
  const engineered3 = claimsEvidence(recorded('v3/engineered-0b75acc7-f595-4277-a1ce-082f685acff0.json'), { suiteVersion: 'notes-v3' });
  assert.equal(engineered3.checksRun, 2);
  assert.equal(byId(engineered3).switch.exercised, true);
  assert.equal(byId(engineered3).refresh.exercised, false);
  assert.equal(byId(engineered3).refresh.agentChecksText, '2 run_checks after the last edit');
  assert.match(byId(engineered3).backup.agentChecksText, /not in the agent's checks/);
  assert.equal(engineered3.claimedWithoutRefreshTest, false);
  const engineered2 = claimsEvidence(recorded('revised-cards/engineered-draft-cf25feae-cd17-4bfa-a052-d9771d84c848.json'), { suiteVersion: 'notes-v3' });
  assert.equal(engineered2.checksRun, 1);
  assert.equal(engineered2.browserActionsAfterEdit, 0);
  const legacy = recorded('minimal-3177359d-554a-408c-81b5-f4d2215cecc1.json');
  assert.equal(legacy.harnessVersion, undefined);
  const legacyClaims = claimsEvidence(legacy, { suiteVersion: 'notes-v3' });
  assert.equal(legacyClaims.checksAvailable, true, 'version 1 exposed run_checks to every preset');
  assert.equal(legacyClaims.checksRun, 1);
  assert.equal(byId(legacyClaims).switch.harness[0].text, 'Pass · earlier suite notes-v1');
  assert.equal(claimsEvidence({ ...legacy, events: legacy.events.filter(e => e.tool !== 'request_completion') }).available, false);
  assert.equal(claimsEvidence({ features:{}, status:'ready' }).available, false);
});
test('claimsEvidence uses only successful browser actions after the last successful write_file', () => {
  let n = 0;
  const call = (tool, args, result = { ok: true }) => [{ kind:'tool', tool, arguments: args, at: `t${n++}` }, { kind:'tool_result', tool, result }];
  const click = target => call('browser_action', { action:'click', target, value:'' });
  const events = [
    ...call('write_file', { path:'src/storage.js', content:'a' }),
    ...call('browser_action', { action:'reload', target:'', value:'' }),
    ...call('run_checks', {}),
    ...call('write_file', { path:'src/app.js', content:'b' }),
    ...call('write_file', { path:'src/nope.js', content:'c' }, { error:'Permission denied' }),
    { kind:'tool', tool:'browser_action', arguments:{ action:'reload', target:'', value:'' } }, { kind:'tool_error', title:'Tool failed' }, { kind:'tool_result', tool:'browser_action', result:{ error:'boom' } },
    ...call('browser_action', { action:'fill', target:'note-body', value:'<b>x</b> & "y"' }),
    ...click('notes-tab'), ...click('editor-tab'), ...click('backup-tab'), ...click('save-note'),
    ...call('browser_action', { action:'fill', target:'note-title', value:'second' }), ...click('save-note'), ...click('notes-tab'),
    ...call('request_completion', { summary:'First claim' }, { accepted:false }),
    ...call('request_completion', { summary:'Final claim: survives refresh.' }, { accepted:true })
  ];
  const run = { harnessVersion:4, features:{ verification:true }, status:'awaiting_approval', revision:'r1', events,
    checks:{ suiteVersion:'notes-v3', revision:'r1', passed:5, total:6, results:[{ name:'Draft survives page refresh', passed:false }], heldOut:{ suiteVersion:'notes-v3', revision:'r0', passed:4, total:5, results:[{ name:'Backup lists saved notes and never a draft', passed:true }] } } };
  assert.equal(toolCalls(run).filter(c => !c.ok).length, 2);
  const claims = claimsEvidence(run, { suiteVersion:'notes-v3' });
  assert.equal(claims.summary, 'Final claim: survives refresh.');
  assert.equal(claims.completionRequests, 2);
  assert.deepEqual(Object.fromEntries(claims.rows.map(r => [r.id, r.exercised])), { switch:true, refresh:false, save:true, clear:false, existing:true, distinct:true, backup:true, literal:true });
  assert.equal(claims.checksRun, 0, 'a run_checks before the last edit does not count');
  assert.equal(byId(claims).refresh.agentChecksText, '0 run_checks after the last edit');
  assert.equal(byId(claims).refresh.harness[0].text, 'Fail');
  assert.equal(byId(claims).backup.harness[0].text, 'Pass · earlier revision');
  assert.equal(claims.claimedWithoutRefreshTest, true);
  assert.equal(claimsEvidence({ ...run, status:'running' }).claimedWithoutRefreshTest, false, 'only accepted completions count');
});
test('held-out evidence falls back to the latest presenter event and is never reported current when stale', () => {
  const heldOut = { suiteVersion:'notes-v3', revision:'r1', passed:5, total:5, results:[] };
  const run = { revision:'r1', checks:{ suiteVersion:'notes-v3', revision:'r1', passed:6, total:6, origin:'agent' }, events:[{ kind:'checks', phase:'end', result:{ heldOut } }] };
  assert.equal(latestHeldOut(run), heldOut);
  assert.equal(heldOutOutcome(run, 'notes-v3'), '5/5 held-out checks passed');
  assert.equal(heldOutOutcome({ ...run, revision:'r2' }, 'notes-v3'), 'Earlier evidence; measure again');
  assert.equal(heldOutOutcome({ revision:'r1', events:[] }, 'notes-v3'), 'Not measured');
  assert.equal(outcome({ ...minimal, events:[] }, 'notes-v3').heldOut, 'Not measured');
});
test('production banner follows publication state only', () => {
  const at = '2026-10-26T10:42:13.000Z', fmt = value => `T(${value})`;
  assert.deepEqual(productionBanner({ status:'ready', features:{} }), { state:'original', text:'Original build. No change applied.' });
  assert.equal(productionBanner({ status:'running', features:{ permissions:true } }).text, 'Original build. No change applied.');
  assert.deepEqual(productionBanner({ status:'awaiting_approval', features:{ permissions:true } }), { state:'waiting', text:'Original build. One change is waiting for your approval.' });
  assert.deepEqual(productionBanner({ status:'completed', features:{}, appliedRevision:'abc', appliedAt:at }, fmt), { state:'automatic', text:`Updated automatically by the agent at T(${at}). No review.` });
  assert.deepEqual(productionBanner({ status:'completed', features:{ permissions:true }, appliedRevision:'abc', appliedAt:at }, fmt), { state:'approved', text:`Updated after your approval at T(${at}).` });
  assert.equal(productionBanner({ status:'completed', features:{}, appliedRevision:'abc' }).text, 'Updated automatically by the agent at an unrecorded time. No review.', 'older runs have no appliedAt');
  assert.equal(productionBanner({ status:'budget_exceeded', features:{} }).state, 'original');
});
test('promptInputs returns the first recorded prompt exactly, without padding', () => {
  const run = recorded('v3/minimal-e25d301f-60f1-46a2-aadf-93f595e3221c.json');
  const first = run.events.find(e => e.kind === 'prompt');
  const inputs = promptInputs(run);
  assert.equal(inputs.instructions, first.instructions);
  assert.equal(inputs.task, first.task);
  assert.equal(inputs.instructionsChars, first.instructions.length);
  assert.equal(inputs.totalChars, first.instructions.length + first.task.length);
  const two = promptInputs({ task:'t', events:[{ kind:'prompt', instructions:'first', session:1 }, { kind:'prompt', instructions:'second session', session:2 }] });
  assert.deepEqual([two.instructions, two.task, two.session], ['first', 't', 1]);
  assert.equal(promptInputs({ events:[] }), null);
});
test('ladder is ordered, filtered and leaves unmeasured cells empty', () => {
  const all = { instructions:true, context:true, memory:true, verification:true, permissions:true }, none = { instructions:false, context:false, memory:false, verification:false, permissions:false };
  const completion = [{ kind:'tool', tool:'write_file', arguments:{} }, { kind:'tool_result', tool:'write_file', result:{} }, { kind:'tool', tool:'request_completion', arguments:{ summary:'done' } }, { kind:'tool_result', tool:'request_completion', result:{ accepted:true } }];
  const runs = [
    { id:'m1', createdAt:'2026-10-26T01', features:none, status:'completed', appliedRevision:'r', revision:'r', usage:{ calls:6 }, events:completion, checks:{ suiteVersion:'notes-v3', revision:'r', passed:6, total:6, heldOut:{ suiteVersion:'notes-v3', revision:'r', passed:4, total:5 } } },
    { id:'m2', createdAt:'2026-10-26T02', features:none, status:'budget_exceeded', revision:'q', usage:{ calls:24 }, events:[] },
    { id:'e1', createdAt:'2026-10-26T03', features:all, status:'awaiting_approval', revision:'s', usage:{ calls:5 }, events:[...completion.slice(0,2), { kind:'tool', tool:'run_checks', arguments:{} }, { kind:'tool_result', tool:'run_checks', result:{} }, ...completion.slice(2)], checks:{ suiteVersion:'notes-v3', revision:'s', passed:6, total:6 } },
    { id:'c1', createdAt:'2026-10-26T04', features:{ ...none, memory:true }, status:'failed', revision:'t', usage:{ calls:3 }, events:[] },
    { id:'o1', createdAt:'2026-10-25T00', features:none, status:'completed', revision:'u', usage:{ calls:9 }, events:[] }
  ];
  const group = (features, extra) => ({ model:'m', scenario:'draft', harnessVersion:4, resetAfterCalls:null, features, trials:0, verified:0, heldOutVerified:0, recordedPasses:0, failed:0, inputTokens:0, outputTokens:0, unreportedRequests:0, ...extra });
  const evals = { checkSuiteVersion:'notes-v3', groups:[
    group(none, { suiteVersion:'notes-v3', trials:1, verified:1, recordedPasses:1, inputTokens:100, outputTokens:20, runIds:['m1'] }),
    group(none, { suiteVersion:'unassessed', trials:1, failed:1, inputTokens:300, outputTokens:40, unreportedRequests:1, runIds:['m2'] }),
    group(all, { suiteVersion:'notes-v3', trials:1, verified:1, recordedPasses:1, inputTokens:50, outputTokens:10, runIds:['e1'] }),
    group({ ...none, memory:true }, { suiteVersion:'unassessed', trials:1, failed:1, runIds:['c1'] }),
    group(none, { harnessVersion:3, suiteVersion:'notes-v2', trials:1, recordedPasses:1, runIds:['o1'] })
  ] };
  const filters = ladderFilters(evals.groups, runs);
  assert.equal(filters.length, 2);
  assert.equal(filters[0].harnessVersion, 4, 'most recent combination first');
  const rows = ladderTable(evals, runs, filters[0].key);
  assert.deepEqual(rows.map(r => r.label), ['Minimal','+Verification','+Instructions & context','+Memory','Engineered','Custom']);
  const [m, v, , , e, custom] = rows;
  assert.equal(m.trials, 2); assert.equal(m.completed, 1);
  assert.deepEqual(m.visible, { passed:1, measured:1, historical:[] });
  assert.deepEqual(m.heldOut, { passed:0, measured:1 }, 'held-out pass comes from the group, measured from the run list');
  assert.deepEqual(m.appliedWithoutReview, { count:1, of:2 });
  assert.deepEqual(m.claimedWithoutRefreshTest, { count:1, of:1 });
  assert.equal(m.avgCalls, 15); assert.equal(m.avgTokens, 230); assert.equal(m.tokensIncomplete, true);
  assert.deepEqual([v.trials, v.completed, v.visible, v.heldOut, v.appliedWithoutReview, v.claimedWithoutRefreshTest, v.avgCalls, v.avgTokens], [0, null, null, null, null, null, null, null], 'an unrun rung stays empty');
  assert.equal(e.heldOut, null, 'no held-out result means not measured, not zero');
  assert.deepEqual(e.claimedWithoutRefreshTest, { count:0, of:1 });
  assert.deepEqual(e.appliedWithoutReview, { count:0, of:1 });
  assert.deepEqual(custom.features, ['memory']);
  assert.equal(custom.visible, null);
  const historical = ladderTable(evals, runs, filters[1].key)[0];
  assert.deepEqual(historical.visible, { passed:0, measured:0, historical:[{ suiteVersion:'notes-v2', passed:1, trials:1 }] });
  assert.equal(ladderTable(evals, runs, 'no-such-filter').every(r => r.trials === 0), true);
});
