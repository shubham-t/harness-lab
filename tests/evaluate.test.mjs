import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStoppedRun } from '../scripts/evaluation-client.mjs';

test('presenter evaluation waits for a terminal run to release its operation lock', async () => {
  let checks=0, waits=0;
  const result=await evaluateStoppedRun(async (route,body)=>{
    if(!body)return {status:'completed',activeSessionStartedAt:null};
    checks++;
    if(checks===1)throw new Error('This run is busy. Pause it and wait for the current operation to finish.');
    return {checks:{passed:6,total:6}};
  },'example',{wait:async()=>waits++});
  assert.equal(checks,2);assert.equal(waits,1);assert.equal(result.checks.passed,6);
});

test('presenter evaluation preserves actual errors and bounds waiting', async () => {
  let attempts=0;
  await assert.rejects(evaluateStoppedRun(async(route,body)=>{
    if(!body)return {status:'completed'};
    attempts++;throw new Error('Browser crashed');
  },'example',{wait:async()=>{}}),/Browser crashed/);
  assert.equal(attempts,1);
  let checks=0;
  await assert.rejects(evaluateStoppedRun(async(route,body)=>{
    if(body)checks++;
    return {status:'running'};
  },'example',{wait:async()=>{},attempts:3}),/operation lock/);
  assert.equal(checks,0);
});
