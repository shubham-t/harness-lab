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
  return { source, current, required, publication, explanation, next, stopReason, approval: run.features?.permissions ? 'Human approval required' : 'No human approval required' };
}
export function comparableRuns(run, runs) {
  const mode = preset(run);
  if (mode === 'Custom' || !run.usage?.calls) return [];
  return runs.filter(other => other.id !== run.id && other.usage?.calls > 0 && preset(other) !== mode && preset(other) !== 'Custom' &&
    other.scenario === run.scenario && (other.session || 1) === (run.session || 1) && (other.harnessVersion || 1) === (run.harnessVersion || 1) &&
    ['model','baseUrl','protocol'].every(key => !!run.provider?.[key] && run.provider[key] === other.provider?.[key]) &&
    other.task === run.task).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
