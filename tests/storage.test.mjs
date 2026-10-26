// Fault injection is confined to tests. No provider calls or fake demo runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.env.HARNESS_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(),'harness-storage-'));
const {atomicJson,createRun,runDir,initStore,runs,persist} = await import('../lib/store.mjs');
const {executeTool} = await import('../lib/runner.mjs');
test.after(async()=>{await fs.rm(process.env.HARNESS_DATA_DIR,{recursive:true,force:true});});
test('temporary rename locks retry without destroying the last good snapshot',async t=>{
  const file=path.join(process.env.HARNESS_DATA_DIR,'atomic.json');
  await atomicJson(file,{version:1});
  const rename=fs.rename;let failures=0;
  t.mock.method(fs,'rename',async(from,to)=>{
    if(to===file && failures++<3){assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),{version:1});throw Object.assign(new Error('test lock'),{code:'EPERM'});}
    return rename(from,to);
  });
  await atomicJson(file,{version:2});
  assert.equal(failures,4);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),{version:2});
  assert.equal((await fs.readdir(process.env.HARNESS_DATA_DIR)).some(n=>n.endsWith('.tmp')),false);
});
test('permanent rename failure preserves the old snapshot and removes temporary files',async t=>{
  const file=path.join(process.env.HARNESS_DATA_DIR,'permanent.json');await atomicJson(file,{version:1});
  const rename=fs.rename;let calls=0;
  t.mock.method(fs,'rename',async(from,to)=>{if(to===file){calls++;throw Object.assign(new Error('test disk failure'),{code:'EIO'});}return rename(from,to);});
  await assert.rejects(atomicJson(file,{version:2}),/test disk failure/);assert.equal(calls,1);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),{version:1});
  assert.equal((await fs.readdir(process.env.HARNESS_DATA_DIR)).some(n=>n.endsWith('.tmp')),false);
});
test('failed file staging exposes no partial publication and can be retried',async t=>{
  const run=await createRun({mode:'minimal'}),copy=fs.copyFile;let calls=0;
  const mock=t.mock.method(fs,'copyFile',async(from,to)=>{if(++calls===2)throw Object.assign(new Error('test copy failure'),{code:'EIO'});return copy(from,to);});
  await assert.rejects(executeTool(run,'request_completion',{summary:'Test only'}),/test copy failure/);
  await assert.rejects(fs.access(path.join(runDir(run.id),'published')),/ENOENT/);
  assert.equal(run.appliedRevision,null);assert.notEqual(run.status,'completed');
  assert.equal((await fs.readdir(runDir(run.id))).some(n=>n.startsWith('.publish-')),false);
  mock.mock.restore();
  const result=await executeTool(run,'request_completion',{summary:'Test retry'});
  assert.equal(result.accepted,true);assert.equal(run.status,'completed');
});
test('publication remains truthful when evidence storage fails and restart recovers the commit',async t=>{
  const run=await createRun({mode:'minimal'}),rename=fs.rename;
  const mock=t.mock.method(fs,'rename',async(from,to)=>{
    if(to===path.join(runDir(run.id),'run.json') && run.appliedRevision)throw Object.assign(new Error('test evidence disk failure'),{code:'EIO'});
    return rename(from,to);
  });
  const result=await executeTool(run,'request_completion',{summary:'Test publication'});
  assert.equal(result.accepted,true);assert.equal(result.published,true);assert.equal(run.status,'completed');
  assert.equal(run.storageWarning.code,'EIO');
  const durable=JSON.parse(await fs.readFile(path.join(runDir(run.id),'run.json'),'utf8'));
  assert.notEqual(durable.status,'completed','Simulate older metadata after the real directory commit');
  mock.mock.restore();runs.delete(run.id);await initStore();
  const recovered=runs.get(run.id);assert.equal(recovered.status,'completed');assert.equal(recovered.appliedRevision,run.appliedRevision);
  assert.ok(recovered.events.some(e=>e.title==='Published copy recovered after restart'));
});
test('readable interrupted runs stay visible even when recovery cannot be persisted',async t=>{
  const run=await createRun({mode:'minimal'});run.status='running';await persist(run);
  const rename=fs.rename;t.mock.method(fs,'rename',async(from,to)=>{if(to===path.join(runDir(run.id),'run.json'))throw Object.assign(new Error('test recovery failure'),{code:'EIO'});return rename(from,to);});
  runs.delete(run.id);await initStore();
  assert.equal(runs.get(run.id).status,'interrupted');assert.equal(runs.get(run.id).storageWarning.code,'EIO');
});
test('approval HTTP response reports an applied patch even if final event storage fails',async t=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'harness-approval-storage-'));
  const wrapper=`import fs from 'node:fs/promises';import path from 'node:path';
    const store=await import('./lib/store.mjs');await import('./server.mjs');
    const {executeTool}=await import('./lib/runner.mjs');
    process.on('message',m=>{if(m==='stop'){process.disconnect();process.emit('SIGTERM');}});
    const run=await store.createRun({mode:'minimal',features:{permissions:true}});
    await executeTool(run,'request_completion',{summary:'Test-only proposal'});
    const rename=fs.rename;fs.rename=async(from,to)=>{if(to===path.join(store.runDir(run.id),'run.json')&&run.appliedRevision)throw Object.assign(new Error('test approval disk error'),{code:'EIO'});return rename(from,to);};
    process.send({id:run.id});`;
  const child=spawn(process.execPath,['--input-type=module','--eval',wrapper],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,HARNESS_DATA_DIR:data,PORT:'4388',PREVIEW_PORT:'4389',OPENAI_API_KEY:'',OPENAI_MODEL:''}});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  t.after(async()=>{if(child.exitCode===null){const done=new Promise(r=>child.once('exit',r));if(child.connected)child.send('stop');else child.kill();await Promise.race([done,new Promise(r=>setTimeout(r,5000))]);if(child.exitCode===null){child.kill();await done;}}await fs.rm(data,{recursive:true,force:true});});
  const message=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Test server did not start: '+output)),15000);child.once('message',m=>{clearTimeout(timer);resolve(m);});child.once('error',reject);});
  const response=await fetch(`http://127.0.0.1:4388/api/runs/${message.id}/approve`,{method:'POST',headers:{'Content-Type':'application/json','X-Harness-Client':'local'},body:'{}'});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.status,'completed');assert.ok(result.appliedRevision);assert.equal(result.storageWarning.code,'EIO');
  assert.equal((await fetch(`http://127.0.0.1:4389/published/${message.id}/index.html`)).status,200);
});
