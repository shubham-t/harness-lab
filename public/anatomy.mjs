// Presentation state is derived from recorded runtime events, never a timer.
export const COMPONENTS = [
  { id:'loop', number:'01', name:'Agent loop', icon:'refresh', description:'The runtime sends a request, executes requested tools, returns observations, and repeats. A model response is not proof of success.' },
  { id:'tools', number:'02', name:'Tools & sandbox', icon:'terminal', description:'Actual file and browser actions execute inside this workspace. This safety boundary stays enabled in both presets.' },
  { id:'instructions', number:'03', name:'Instructions & policies', icon:'file', description:'Project rules tell the agent how to work: use existing storage, preserve user text and existing notes, and keep the appearance. The harness supplies the actual PROJECT.md rules. Supplying a rule does not prove the model followed it; inspect the diff and tests.' },
  { id:'context', number:'04', name:'Context management', icon:'folder', description:'Project information helps the model locate the work: a repository map, accessible files and the current revision. From harness v4 it also supplies the related ticket thread PN-142, knowledge from outside the repository that no agent can read through its tools. This card represents automatic project briefing. Basic task text, tool definitions and the current conversation remain available in both presets.' },
  { id:'memory', number:'05', name:'Memory & state', icon:'layers', description:'Files remain in both presets. When enabled, the harness also saves progress checkpoints and supplies them, plus any saved handoff, to a fresh conversation.' },
  { id:'guardrails', number:'06', name:'Guardrails', icon:'shield', description:'This card represents the optional approval gate: a human must approve before applying a proposed revision. Both presets retain sandbox boundaries and execution budgets.' },
  { id:'verification', number:'07', name:'Verification', icon:'checkCircle', description:'Checks have two tiers. When enabled, the agent can run the visible checks, and completion requires a current passing visible result. Held-out checks are presenter-only: they are never shown to the agent and never control completion. In the Minimal preset only the presenter evaluates the outcome; those checks do not control agent completion.' }
];
export function componentsForEvent(event) {
  if (!event) return [];
  // Existing traces classify pause as memory; pausing itself is loop control.
  if (event.title === 'Paused at a safe tool boundary') return ['loop'];
  if (event.title === 'Protected-file boundary tested') return ['tools'];
  if (['checks','prompt'].includes(event.kind)) return [];
  if (['instructions','context'].includes(event.kind)) return [event.kind];
  if (event.kind === 'model') return ['loop', ...(event.suppliedComponents || []).filter(id=>['instructions','context','memory'].includes(id))];
  if (event.kind === 'memory') return ['memory'];
  if (['budget','reset'].includes(event.kind)) return ['loop'];
  if (event.kind === 'permission') return ['guardrails'];
  if (['verification','gate'].includes(event.kind)) return ['verification'];
  if (['browser','edit'].includes(event.kind)) return ['tools'];
  if (['tool','tool_result','tool_error'].includes(event.kind)) return event.tool === 'run_checks' ? ['verification'] : event.tool === 'save_memory' ? ['memory'] : event.tool === 'request_completion' ? ['loop'] : ['tools'];
  if (['run','model','assistant','completion','error','usage'].includes(event.kind)) return ['loop'];
  return [];
}
export function anatomyState(run) {
  const f = run.features || {}, legacy = (run.harnessVersion || 1) < 2;
  const specs = {
    loop: [true,'Enabled','Model → action → observation'],
    tools: [true,'Enabled','Real files and browser'],
    instructions: [!!f.instructions,f.instructions ? 'Enabled' : 'Off',f.instructions ? 'Project rules supplied with each request' : 'No automatic project policies'],
    context: [!!f.context, f.context ? 'Enabled' : 'Off', f.context ? ((run.harnessVersion || 1) >= 4 ? 'Project map, files, revision and ticket thread supplied' : 'Project map, files and revision supplied') : 'No automatic project briefing'],
    memory: [!!f.memory,f.memory ? 'Handoff enabled' : 'Handoff off',f.memory ? 'Saved progress for new sessions' : 'Files remain; no saved handoff'],
    guardrails: [!!f.permissions,f.permissions ? 'Approval required' : 'Approval off','Sandbox and budgets always on'],
    verification: [!!f.verification,f.verification ? 'Required to finish' : legacy ? 'Legacy: report only' : 'Not in agent loop',f.verification ? 'Failed visible checks block completion' : legacy ? 'Earlier harness assessed at completion' : 'Presenter evaluates separately']
  };
  const events = run.events || [];
  const latest = events.at(-1);
  let ids = componentsForEvent(latest), label = 'Last recorded action', message = latest?.title || 'Prepare a workspace, then start the agent.', state = 'recorded';
  if (run.storageWarning) { ids=[]; label='Evidence storage needs attention'; state='blocked'; message='A disk write failed. Applied files remain applied; export the trace and resolve storage before continuing.'; }
  else if (run.status === 'ready' && !latest) { ids=[]; label='Ready'; state='idle'; }
  else if (latest?.kind === 'checks') {
    label = latest.phase === 'start' || latest.title === 'Browser checks started' ? 'Presenter evaluation running' : 'Presenter evaluation';
    state = latest.phase === 'start' ? 'active' : 'recorded';
    message = latest.result ? `${latest.result.passed}/${latest.result.total} ${latest.result.heldOut ? `visible · ${latest.result.heldOut.passed}/${latest.result.heldOut.total} held-out ` : ''}passed · external evaluation, not an agent action.${run.status === 'completed' ? ' Patch was already applied; this evaluation does not undo publication.' : ''}` : 'Running real browser checks outside the agent workflow.';
  } else if (latest?.kind === 'error') { ids=[];state='blocked';label='Action failed';message=latest.detail || latest.title;
  } else if (run.status === 'awaiting_approval') {
    const failing = run.checks && run.checks.passed < run.checks.total;
    ids=['guardrails']; state=failing ? 'blocked' : 'waiting'; label=failing ? 'Approval blocked' : 'Waiting for you';
    message=failing ? 'The latest checks fail. This patch cannot be approved with verification enabled.' : 'The agent stopped. Review the patch before applying it.';
    if (failing && !f.verification) { state='waiting';label='Waiting for you';message='Checks failed, but enforcement is off. Approval can still apply this patch.'; }
  } else if (run.status === 'completed') {
    ids=f.permissions ? ['guardrails'] : ['loop'];state='done';label=f.permissions ? 'Approved & applied' : 'Applied automatically';
    message=f.permissions ? 'A human approved this revision before publication.' : `${!f.verification && !legacy ? 'No acceptance check or approval was required. ' : 'Approval was disabled. '}Use Evaluate outcome to inspect the result.`;
  } else if (run.status === 'budget_exceeded') { ids=['loop'];state='blocked';label='Budget stopped the run';message='No more model calls. No patch was published. The same execution budget applies to both presets.'; }
  else if (['failed','interrupted'].includes(run.status)) { state='blocked';label='Run stopped'; message=events.findLast(e=>e.kind==='error')?.detail || 'Execution was interrupted; inspect the evidence.'; }
  else if (run.status === 'paused') { ids=['loop'];state='waiting';label='Paused';message=f.memory ? 'Files and recorded progress are ready for a fresh session.' : 'Files remain. A fresh session must rediscover progress.'; }
  else if (run.status === 'running') {
    const gate = [...events].reverse().find(e=>!['tool_result','memory'].includes(e.kind));
    if (gate?.kind === 'gate') {ids=['verification'];state='blocked';label='Completion blocked';message='Failed checks returned to the agent for another repair attempt.';}
    else if (latest?.kind === 'model' && latest.title === 'Calling the configured model') {ids=componentsForEvent(latest);state='active';label='Waiting for model response';message=latest.suppliedComponents?.length ? 'Project inputs are included in this request. Click their cards to inspect exactly what was sent.' : 'The next action is being requested. This does not reveal the model’s internal thinking.';}
    else if (latest?.kind === 'reset') {ids=['loop'];state='active';label='Forced session reset';message=`${latest.title}. ${f.memory ? 'Memory is enabled: the configured policy supplies a frozen handoff to the fresh session.' : 'Memory is off: the fresh session receives the task and the files, without a handoff.'}`;}
    else {state='active';label='Runtime action';}
  }
  const cards = COMPONENTS.map(c => {
    const enabled=specs[c.id][0], highlight=enabled && ids.includes(c.id);
    // Input cards open the specific payload, not the generic model-call event.
    const eventIndex=events.findLastIndex(e=>['instructions','context','memory'].includes(c.id) ? e.kind===c.id : componentsForEvent(e).includes(c.id));
    return {...c,enabled,badge:enabled?'Enabled':'Off',note:specs[c.id][2],highlight,state:highlight?state:'idle',eventIndex:enabled?eventIndex:-1};
  });
  return {cards,label,message,state,legacy,trail:events.map((e,index)=>({event:e,index,components:componentsForEvent(e).filter(id=>specs[id][0])})).filter(x=>!['tool_result','usage'].includes(x.event.kind)).slice(-5)};
}
