import test from 'node:test';
import assert from 'node:assert/strict';
import { anatomyState, componentsForEvent, COMPONENTS } from '../public/anatomy.mjs';
const minimal = { harnessVersion:2,features:{},status:'ready',events:[] };
test('anatomy uses slide terminology and honestly labels shared infrastructure',()=>{
  assert.deepEqual(COMPONENTS.map(c=>c.name),['Agent loop','Tools & sandbox','Instructions & policies','Context management','Memory & state','Guardrails','Verification']);
  const state=anatomyState(minimal);
  assert.equal(state.cards.find(c=>c.id==='verification').enabled,false);
  assert.deepEqual(state.cards.filter(c=>c.enabled).map(c=>c.id),['loop','tools']);
  assert.ok(state.cards.every(c=>c.badge===(c.enabled?'Enabled':'Off')));
  assert.ok(anatomyState({...minimal,features:{instructions:true,context:true,memory:true,permissions:true,verification:true}}).cards.every(c=>c.enabled));
  assert.match(state.cards.find(c=>c.id==='memory').note,/Files remain/);
  assert.equal(state.cards.some(c=>c.highlight),false);
});
test('presenter evaluation never lights up an agent component',()=>{
  const state=anatomyState({...minimal,status:'completed',events:[{kind:'checks',phase:'end',result:{passed:4,total:6},title:'4/6 checks passed'}]});
  assert.equal(state.cards.some(c=>c.highlight),false);
  assert.equal(state.cards.find(c=>c.id==='verification').highlight,false);
  assert.match(state.message,/external evaluation/);
});
test('actual runtime events map to components and preserve blocked decisions through tool output',()=>{
  assert.deepEqual(componentsForEvent({kind:'prompt'}),[]);
  assert.deepEqual(componentsForEvent({kind:'memory'}),['memory']);
  assert.deepEqual(componentsForEvent({kind:'memory',title:'Paused at a safe tool boundary'}),['loop']);
  assert.deepEqual(componentsForEvent({kind:'budget'}),['loop']);
  assert.deepEqual(componentsForEvent({kind:'permission',title:'Protected-file boundary tested'}),['tools']);
  assert.deepEqual(componentsForEvent({kind:'tool',tool:'write_file'}),['tools']);
  const state=anatomyState({...minimal,features:{verification:true},status:'running',events:[{kind:'gate',title:'Completion blocked'},{kind:'tool_result',tool:'request_completion'}]});
  assert.equal(state.state,'blocked');
  assert.equal(state.cards.find(c=>c.id==='verification').highlight,true);
  const waiting=anatomyState({...minimal,status:'running',events:[{kind:'model',title:'Calling the configured model'}]});
  assert.equal(waiting.label,'Waiting for model response');
  assert.deepEqual(waiting.cards.filter(c=>c.highlight).map(c=>c.id),['loop']);
});

test('fresh-session memory highlights actual supplied handoff and opens its own evidence',()=>{
  const events=[{kind:'memory',content:'Frozen handoff'},{kind:'model',title:'Calling the configured model',suppliedComponents:['memory']}];
  const state=anatomyState({...minimal,features:{memory:true},status:'running',events});
  assert.equal(state.cards.find(c=>c.id==='memory').highlight,true);
  assert.equal(state.cards.find(c=>c.id==='memory').eventIndex,0);
  const budget=anatomyState({...minimal,status:'budget_exceeded',events:[{kind:'budget'}]});
  assert.deepEqual(budget.cards.filter(c=>c.highlight).map(c=>c.id),['loop']);
});
test('completion and historical cards reflect the actual acceptance policy',()=>{
  assert.match(anatomyState({...minimal,status:'completed'}).message,/No acceptance check or approval/);
  const legacy=anatomyState({...minimal,harnessVersion:undefined});
  assert.equal(legacy.legacy,true);
  assert.equal(legacy.cards.find(c=>c.id==='verification').badge,'Off');
  assert.equal(anatomyState({...minimal,status:'completed'}).cards.find(c=>c.id==='guardrails').highlight,false);
  const blocked=anatomyState({...minimal,status:'awaiting_approval',features:{verification:true,permissions:true},checks:{passed:5,total:6}});
  assert.equal(blocked.state,'blocked');
});

test('separate input cards open their own payload and can be included together in a request',()=>{
  const events=[{kind:'instructions',content:'Rules'},{kind:'context',content:'Map'},{kind:'model',title:'Calling the configured model',suppliedComponents:['instructions','context']}];
  const state=anatomyState({...minimal,status:'running',features:{instructions:true,context:true},events});
  assert.deepEqual(state.cards.filter(c=>c.highlight).map(c=>c.id),['loop','instructions','context']);
  assert.equal(state.cards.find(c=>c.id==='instructions').eventIndex,0);
  assert.equal(state.cards.find(c=>c.id==='context').eventIndex,1);
  assert.equal(anatomyState({...minimal,features:{instructions:true}}).cards.find(c=>c.id==='context').enabled,false);
  for(const kind of ['instructions','context','memory','permission','verification']) {
    assert.equal(anatomyState({...minimal,status:'running',events:[{kind}]}).cards.some(c=>c.highlight),false,kind);
  }
});

test('forced reset maps to the Agent loop only and never lights a disabled Memory card',()=>{
  const reset={kind:'reset',title:'Context limit reached: fresh session required',call:4,resetAfterCalls:4,memory:false};
  assert.deepEqual(componentsForEvent(reset),['loop']);
  const off=anatomyState({...minimal,harnessVersion:4,status:'running',events:[reset]});
  assert.deepEqual(off.cards.filter(c=>c.highlight).map(c=>c.id),['loop']);
  assert.equal(off.cards.find(c=>c.id==='memory').highlight,false);
  assert.equal(off.cards.find(c=>c.id==='memory').enabled,false);
  assert.equal(off.label,'Forced session reset');
  assert.match(off.message,/Memory is off/);
  const on=anatomyState({...minimal,harnessVersion:4,features:{memory:true},status:'running',events:[{...reset,memory:true}]});
  assert.deepEqual(on.cards.filter(c=>c.highlight).map(c=>c.id),['loop'],'the reset itself is loop control, not memory');
  assert.match(on.message,/frozen handoff/);
  for (const status of ['running','paused','completed','budget_exceeded']) assert.equal(anatomyState({...minimal,harnessVersion:4,status,events:[reset]}).cards.find(c=>c.id==='memory').highlight,false,status);
  assert.deepEqual(anatomyState({...minimal,status:'running',events:[reset]}).trail.at(-1).components,['loop']);
});
test('v4 card text names the ticket thread and the two check tiers',()=>{
  assert.match(COMPONENTS.find(c=>c.id==='context').description,/ticket thread PN-142/);
  assert.match(COMPONENTS.find(c=>c.id==='verification').description,/visible checks/);
  assert.match(COMPONENTS.find(c=>c.id==='verification').description,/Held-out checks are presenter-only/);
  const features={context:true};
  assert.match(anatomyState({...minimal,harnessVersion:4,features}).cards.find(c=>c.id==='context').note,/ticket thread/);
  assert.doesNotMatch(anatomyState({...minimal,harnessVersion:3,features}).cards.find(c=>c.id==='context').note,/ticket/,'earlier versions never received the ticket');
});
