// Audience explanations use recorded state. No scripted outcomes or playback.
const featureKeys = ['instructions', 'context', 'memory', 'verification', 'permissions'];
export function preset(run) {
  const count = featureKeys.filter(key => run.features?.[key]).length;
  return count === 0 ? 'Minimal' : count === featureKeys.length ? 'Engineered' : 'Custom';
}
export function outcome(run, suiteVersion) {
  const checks = run.checks;
  const current = !!checks && checks.suiteVersion === suiteVersion && checks.revision === run.revision;
  const source = !checks ? 'Not measured yet' : !current ? 'Earlier evidence; measure again' : `${checks.passed}/${checks.total} checks passed`;
  const required = run.features?.verification ? 'Passing checks required before completion' : (run.harnessVersion || 1) < 2 ? 'Assessment runs; passing is not required (legacy)' : 'No acceptance check required before completion';
  const publication = run.appliedRevision ? (run.features?.permissions ? 'Applied after human approval' : 'Applied automatically') : run.status === 'awaiting_approval' ? 'Waiting for human approval' : 'Not applied';
  let explanation, next;
  if (run.storageWarning) { explanation = 'A disk write failed. The published-copy status and the saved trace are separate facts.'; next = 'Export evidence and resolve the storage error before more runs.'; }
  else if (run.status === 'ready') { explanation = `${preset(run)} is prepared. No model has worked on this workspace yet.`; next = 'Type a draft, switch to My notes and return to Draft. Then run the agent.'; }
  else if (run.status === 'running') { explanation = run.features?.verification ? 'The model proposes changes. The harness will require passing checks before it accepts completion.' : 'The model can edit and use the browser. Completion will not require the protected acceptance checks.'; next = 'Watch an action, then open its highlighted component to inspect the evidence.'; }
  else if (run.status === 'awaiting_approval') { explanation = 'The model has stopped at the approval boundary. The patch has not been applied.'; next = 'Review the diff and current check results before approving.'; }
  else if (run.status === 'completed') { explanation = run.features?.verification ? 'The harness required verification before this run completed.' : 'The model declared completion. The harness allowed application without requiring passing acceptance evidence.'; next = current ? 'Inspect any failed check, then try the published app. Passing checks cover only the tested behaviors.' : 'Click Evaluate outcome to measure the actual patch; application alone does not prove it works.'; }
  else if (run.status === 'paused') { explanation = run.features?.memory ? 'Files remain and saved observations can be handed to a fresh conversation.' : 'Files remain, but no saved progress handoff will be supplied to a fresh conversation.'; next = 'Inspect Memory, then use New session to see what information is carried forward.'; }
  else { explanation = 'Execution stopped before successful completion. A working partial patch and a completed run are different outcomes.'; next = 'Inspect the stopping event and evaluate the source. Keep the failure visible.'; }
  const stoppingEvent = (run.events || []).findLast(e => run.status === 'budget_exceeded' ? e.kind === 'budget' : e.kind === 'error');
  const stopReason = ['failed','budget_exceeded','interrupted'].includes(run.status) ? String(stoppingEvent?.detail || '').slice(0, 600) : '';
  return { source, current, heldOut: heldOutOutcome(run, suiteVersion), required, publication, explanation, next, stopReason, approval: run.features?.permissions ? 'Human approval required' : 'No human approval required' };
}
// Held-out results come only from presenter evaluation. A later agent run_checks
// replaces run.checks with a visible-only result, so fall back to the latest
// recorded presenter event; currency is still judged by suite and revision.
export function latestHeldOut(run) {
  if (run?.checks?.heldOut) return run.checks.heldOut;
  return (run?.events || []).findLast(e => e.kind === 'checks' && e.result?.heldOut)?.result.heldOut || null;
}
export function heldOutOutcome(run, suiteVersion) {
  const heldOut = latestHeldOut(run);
  if (!heldOut) return 'Not measured';
  const current = (!suiteVersion || heldOut.suiteVersion === suiteVersion) && heldOut.revision === run.revision;
  return current ? `${heldOut.passed}/${heldOut.total} held-out checks passed` : 'Earlier evidence; measure again';
}
// What the production copy currently is. Only publish() changes production.
export function productionBanner(run, formatTime = value => value) {
  if (run?.appliedRevision) {
    const at = run.appliedAt ? formatTime(run.appliedAt) : 'an unrecorded time';
    return run.features?.permissions
      ? { state: 'approved', text: `Updated after your approval at ${at}.` }
      : { state: 'automatic', text: `Updated automatically by the agent at ${at}. No review.` };
  }
  if (run?.status === 'awaiting_approval') return { state: 'waiting', text: 'Original build. One change is waiting for your approval.' };
  return { state: 'original', text: 'Original build. No change applied.' };
}

// Claims versus evidence. Derived only from recorded tool events; never from
// model reasoning, page text or screenshots.
export const CLAIMS_FOOTER = 'Claims are the model\'s words. Observations are recorded tool actions. This panel does not interpret model reasoning.';
export const CLAIM_BEHAVIORS = [
  { id: 'switch', behavior: 'Switch screens', rule: 'A fill, then a notes-tab click, then an editor-tab click', checks: [['visible', 'Draft survives switching screens']] },
  { id: 'refresh', behavior: 'Refresh', rule: 'A reload action', checks: [['visible', 'Draft survives page refresh']] },
  { id: 'save', behavior: 'Save', rule: 'A save-note click', checks: [['visible', 'Save persists one complete note']] },
  { id: 'clear', behavior: 'Clear draft', rule: 'A save-note click, then a later editor-tab click or reload', checks: [['visible', 'Saving clears the draft']] },
  { id: 'existing', behavior: 'Preserve existing notes', rule: 'A save-note click, then a later notes-tab click or reload', checks: [['visible', 'Existing notes are preserved'], ['heldOut', 'An existing user\'s notes survive the upgrade']] },
  { id: 'distinct', behavior: 'Distinct notes', rule: 'Two save-note clicks with a fill between them', checks: [['visible', 'Distinct notes remain distinct']] },
  { id: 'backup', behavior: 'Backup', rule: 'A backup-tab click', checks: [['heldOut', 'Backup lists saved notes and never a draft']] },
  { id: 'literal', behavior: 'Literal text', rule: 'A fill whose value contains <', checks: [['heldOut', 'A restored draft stays literal']] }
];
// A tool call counts only when its own tool_result was recorded without an error.
export function toolCalls(run) {
  const events = run?.events || [], calls = [];
  events.forEach((event, index) => {
    if (event.kind !== 'tool') return;
    let ok = false, failed = false;
    for (let j = index + 1; j < events.length && events[j].kind !== 'tool'; j++) {
      if (events[j].kind === 'tool_error') failed = true;
      if (events[j].kind === 'tool_result') { ok = !failed && !(events[j].result && typeof events[j].result === 'object' && 'error' in events[j].result); break; }
    }
    calls.push({ index, tool: event.tool, args: event.arguments || {}, ok, at: event.at });
  });
  return calls;
}
function exercisedBehaviors(actions) {
  const click = (a, target) => a.action === 'click' && a.target === target;
  const after = (i, test) => actions.slice(i + 1).some(test);
  const saves = actions.map((a, i) => click(a, 'save-note') ? i : -1).filter(i => i >= 0);
  let fill = false, notes = false, switched = false;
  for (const a of actions) {
    if (a.action === 'fill') fill = true;
    else if (fill && click(a, 'notes-tab')) notes = true;
    else if (notes && click(a, 'editor-tab')) { switched = true; break; }
  }
  return {
    switch: switched,
    refresh: actions.some(a => a.action === 'reload'),
    save: saves.length > 0,
    clear: saves.some(i => after(i, a => click(a, 'editor-tab') || a.action === 'reload')),
    existing: saves.some(i => after(i, a => click(a, 'notes-tab') || a.action === 'reload')),
    distinct: saves.some((i, n) => saves.slice(n + 1).some(k => actions.slice(i + 1, k).some(a => a.action === 'fill'))),
    backup: actions.some(a => click(a, 'backup-tab')),
    literal: actions.some(a => a.action === 'fill' && String(a.value ?? '').includes('<'))
  };
}
function harnessResult(run, tier, name, suiteVersion) {
  const result = tier === 'heldOut' ? latestHeldOut(run) : run.checks;
  const item = result?.results?.find(r => r.name === name);
  if (!item) return { tier, name, measured: false, text: 'not measured' };
  const currentSuite = !suiteVersion || result.suiteVersion === suiteVersion, currentRevision = result.revision === run.revision;
  const qualifier = !currentSuite ? `earlier suite ${result.suiteVersion || 'notes-v1'}` : !currentRevision ? 'earlier revision' : '';
  return { tier, name, measured: true, passed: !!item.passed, current: currentSuite && currentRevision, suiteVersion: result.suiteVersion, revision: result.revision, text: `${item.passed ? 'Pass' : 'Fail'}${qualifier ? ` · ${qualifier}` : ''}` };
}
export function claimsEvidence(run, { suiteVersion } = {}) {
  const calls = toolCalls(run);
  const completions = calls.filter(c => c.tool === 'request_completion');
  if (!completions.length) return { available: false, rows: [], footer: CLAIMS_FOOTER };
  const succeeded = calls.filter(c => c.ok);
  const lastEdit = succeeded.findLast(c => c.tool === 'write_file');
  const afterEdit = succeeded.filter(c => !lastEdit || c.index > lastEdit.index);
  const actions = afterEdit.filter(c => c.tool === 'browser_action').map(c => c.args);
  const exercised = exercisedBehaviors(actions);
  const checksAvailable = !!run.features?.verification || (run.harnessVersion || 1) < 2;
  const checksRun = afterEdit.filter(c => c.tool === 'run_checks').length;
  const accepted = ['completed', 'awaiting_approval'].includes(run.status);
  const rows = CLAIM_BEHAVIORS.map(row => ({
    id: row.id, behavior: row.behavior, rule: row.rule, exercised: exercised[row.id],
    agentChecks: checksAvailable ? checksRun : null,
    agentChecksText: !checksAvailable ? 'tool not available' : `${checksRun} run_checks after the last edit${row.checks.every(([tier]) => tier === 'heldOut') ? ' (this behavior is not in the agent\'s checks)' : ''}`,
    harness: row.checks.map(([tier, name]) => harnessResult(run, tier, name, suiteVersion))
  }));
  return {
    available: true,
    summary: String(completions.at(-1).args.summary ?? ''),
    completionRequests: completions.length,
    lastEditAt: lastEdit?.at || null,
    hasEdit: !!lastEdit,
    browserActionsAfterEdit: actions.length,
    checksAvailable, checksRun, accepted,
    claimedWithoutRefreshTest: accepted && !exercised.refresh && checksRun === 0,
    rows, footer: CLAIMS_FOOTER
  };
}
// The first assembled prompt of a run: exactly what the harness sent, unpadded.
export function promptInputs(run) {
  const event = (run?.events || []).find(e => e.kind === 'prompt');
  if (!event) return null;
  const instructions = String(event.instructions ?? event.detail ?? ''), task = String(event.task ?? run.task ?? '');
  return { instructions, task, session: event.session ?? 1, instructionsChars: instructions.length, taskChars: task.length, totalChars: instructions.length + task.length };
}

// Ladder scoreboard: built only from /api/evals groups and the run list.
const allFeatures = ['instructions', 'context', 'memory', 'verification', 'permissions'];
export const LADDER_RUNGS = [
  { id: 'minimal', label: 'Minimal', features: [] },
  { id: 'verification', label: '+Verification', features: ['verification'] },
  { id: 'instructions-context', label: '+Instructions & context', features: ['verification', 'instructions', 'context'] },
  { id: 'memory', label: '+Memory', features: ['verification', 'instructions', 'context', 'memory'] },
  { id: 'engineered', label: 'Engineered', features: allFeatures }
];
const featureSet = features => allFeatures.filter(key => features?.[key]).join(',');
const rungKey = list => allFeatures.filter(key => list.includes(key)).join(',');
export function ladderFilterKey(group) { return JSON.stringify([group.model ?? null, group.scenario ?? null, group.harnessVersion || 1, group.resetAfterCalls ?? null]); }
export function ladderFilters(groups = [], runs = []) {
  const filters = new Map();
  for (const group of groups) {
    const key = ladderFilterKey(group);
    const latest = runs.filter(run => group.runIds?.includes(run.id)).map(run => String(run.createdAt || '')).sort().at(-1) || '';
    const existing = filters.get(key);
    if (!existing) filters.set(key, { key, model: group.model ?? null, scenario: group.scenario ?? null, harnessVersion: group.harnessVersion || 1, resetAfterCalls: group.resetAfterCalls ?? null, latest });
    else if (latest > existing.latest) existing.latest = latest;
  }
  return [...filters.values()].sort((a, b) => b.latest.localeCompare(a.latest));
}
export function ladderTable(evals, runs = [], filterKey, suiteVersion = evals?.checkSuiteVersion) {
  const groups = (evals?.groups || []).filter(group => ladderFilterKey(group) === filterKey);
  const byFeatures = new Map();
  for (const group of groups) {
    const key = featureSet(group.features);
    if (!byFeatures.has(key)) byFeatures.set(key, []);
    byFeatures.get(key).push(group);
  }
  const custom = [...byFeatures.keys()].filter(key => !LADDER_RUNGS.some(r => rungKey(r.features) === key))
    .sort((a, b) => a.split(',').filter(Boolean).length - b.split(',').filter(Boolean).length || a.localeCompare(b))
    .map(key => ({ id: `custom:${key}`, label: 'Custom', custom: true, features: key ? key.split(',') : [] }));
  return [...LADDER_RUNGS, ...custom].map(rung => {
    const rungGroups = byFeatures.get(rungKey(rung.features)) || [];
    const ids = new Set(rungGroups.flatMap(group => group.runIds || []));
    const rungRuns = runs.filter(run => ids.has(run.id));
    const trials = rungGroups.reduce((sum, group) => sum + group.trials, 0);
    const row = { id: rung.id, label: rung.label, custom: !!rung.custom, features: rung.features, trials, completed: null, visible: null, heldOut: null, appliedWithoutReview: null, claimedWithoutRefreshTest: null, avgCalls: null, avgTokens: null, tokensIncomplete: false };
    if (!trials) return row;
    const completedRuns = rungRuns.filter(run => ['completed', 'awaiting_approval'].includes(run.status));
    row.completed = completedRuns.length;
    const current = rungGroups.filter(group => group.suiteVersion === suiteVersion);
    const historical = rungGroups.filter(group => group.suiteVersion !== suiteVersion && group.suiteVersion !== 'unassessed');
    if (current.length || historical.length) row.visible = {
      passed: current.reduce((sum, group) => sum + group.verified, 0), measured: current.reduce((sum, group) => sum + group.trials, 0),
      historical: historical.map(group => ({ suiteVersion: group.suiteVersion, passed: group.recordedPasses || 0, trials: group.trials }))
    };
    const heldOutMeasured = rungRuns.filter(run => run.checks?.heldOut?.suiteVersion === suiteVersion && run.checks.heldOut.revision === run.revision && run.checks.heldOut.total > 0).length;
    if (heldOutMeasured) row.heldOut = { passed: rungGroups.reduce((sum, group) => sum + (group.heldOutVerified || 0), 0), measured: heldOutMeasured };
    row.appliedWithoutReview = { count: rungRuns.filter(run => run.appliedRevision && !run.features?.permissions).length, of: trials };
    if (completedRuns.length) row.claimedWithoutRefreshTest = { count: completedRuns.filter(run => claimsEvidence(run).claimedWithoutRefreshTest).length, of: completedRuns.length };
    if (rungRuns.length) row.avgCalls = rungRuns.reduce((sum, run) => sum + (run.usage?.calls || 0), 0) / rungRuns.length;
    row.avgTokens = rungGroups.reduce((sum, group) => sum + (group.inputTokens || 0) + (group.outputTokens || 0), 0) / trials;
    row.tokensIncomplete = rungGroups.some(group => group.unreportedRequests > 0);
    return row;
  });
}
export function comparableRuns(run, runs) {
  const mode = preset(run);
  if (mode === 'Custom' || !run.usage?.calls) return [];
  return runs.filter(other => other.id !== run.id && other.usage?.calls > 0 && preset(other) !== mode && preset(other) !== 'Custom' &&
    other.scenario === run.scenario && (other.session || 1) === (run.session || 1) && (other.harnessVersion || 1) === (run.harnessVersion || 1) &&
    ['model','baseUrl','protocol'].every(key => !!run.provider?.[key] && run.provider[key] === other.provider?.[key]) &&
    other.task === run.task && (other.resetAfterCalls ?? null) === (run.resetAfterCalls ?? null)).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
