import test from 'node:test';
import assert from 'node:assert/strict';
import { outcome, comparableRuns } from '../public/lesson.mjs';
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
