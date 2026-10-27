// Harness builder page (docs/BUILDER.md, work package B). Every "proof" on this
// page is derived from a recorded run in the builder recording; nothing is
// animated, invented or pooled. The pure functions below are exported for tests;
// the DOM code at the bottom runs only in a browser.
import { COMPONENTS } from './anatomy.mjs';
import { productionBanner, promptInputs } from './lesson.mjs';

export const RECORDED_NOTE = 'Recorded run. Not live.';
export const NOT_RECORDED = 'Not recorded yet';
export const MAX_ROWS = 10;
// The order in which the page adds components. Names come from COMPONENTS.
export const ORDER = ['loop', 'tools', 'instructions', 'context', 'verification', 'memory', 'guardrails'];
const SECTION_KINDS = ['instructions', 'context', 'memory'];

// Verbatim lines from lib/runner.mjs (tests check every line against the file).
const CODE = {
  "0": {
    "file": "lib/runner.mjs",
    "caption": "the text for a model alone, the callModel request (step 0 sends it once from server.mjs, with no tools), and the reply kept as text",
    "parts": [
      [
        "// Builder step 0 and the base of step 1: the same request without tools.",
        "export const MODEL_ONLY_INSTRUCTIONS = 'You are asked to fix the real Pocket Notes application. You have no tools: you cannot read or change files, run checks or use a browser. Reply with what you would do. The source files are not available to you.';"
      ],
      [
        "        reply = await callModel({ instructions: system, history: run.history, tools: availableTools, signal: control.abort.signal, provider: run.provider,"
      ],
      [
        "      run.history.push(...reply.items);",
        "      if (reply.text) await event(run, 'assistant', 'Model progress', reply.text.slice(0, 12000));"
      ]
    ]
  },
  "1": {
    "file": "lib/runner.mjs",
    "caption": "loop(): build the request, stop at the budget, call the model, return an observation",
    "parts": [
      [
        "    while (!control.paused && run.status === 'running') {",
        "      const { text: system, sections } = await assembleModelInput(run);",
        "      const availableTools = toolsForRun(run);"
      ],
      [
        "      if (run.step >= MAX_TURNS || run.usage.input + run.usage.output + nextReservation > TOKEN_BUDGET) {",
        "        run.status = 'budget_exceeded';"
      ],
      [
        "        reply = await callModel({ instructions: system, history: run.history, tools: availableTools, signal: control.abort.signal, provider: run.provider,"
      ],
      [
        "      if (!reply.calls.length && run.loopOnly) {",
        "        // The loop's third beat, recorded so the activity list shows it. Nothing can change without tools.",
        "        const observation = `Observation: no action was requested and no tools exist in this configuration, so nothing changed. Source revision ${await revision(run.id)} is unchanged. The draft still disappears. Continue.`;",
        "        run.history.push({ role: 'user', content: observation });",
        "        await event(run, 'observation', 'Observation returned to the model', observation, { call: run.step, session: run.session });"
      ]
    ]
  },
  "2": {
    "file": "lib/runner.mjs",
    "caption": "toolsForRun and executeTool: only listed tools run, and only inside the sandbox",
    "parts": [
      [
        "export function toolsForRun(run) {",
        "  // A loop-only run has no tools at all; executeTool rejects any requested tool.",
        "  if (run.loopOnly) return [];",
        "  if ((run.harnessVersion || 1) < 2) return TOOL_SCHEMAS;",
        "  return TOOL_SCHEMAS.filter(tool => (tool.name !== 'run_checks' || run.features.verification) && (tool.name !== 'save_memory' || run.features.memory)).map(tool => tool.name === 'request_completion' && !run.features.verification ? { ...tool, description: 'Declare the task complete with a change summary. No automated acceptance checks run. With approval disabled, this applies the patch immediately to the isolated demo copy.' } : tool);",
        "}"
      ],
      [
        "export async function executeTool(run, name, args) {",
        "  validate(name, args);",
        "  if (!toolsForRun(run).some(tool => tool.name === name)) throw new Error(`Tool ${name} is unavailable in this harness configuration.`);"
      ],
      [
        "  } else if (name === 'write_file') {",
        "    await closeSession(run.id);",
        "    await fs.writeFile(filePath(run.id, args.path, true), args.content, 'utf8');"
      ]
    ]
  },
  "3": {
    "file": "lib/runner.mjs",
    "caption": "assembleModelInput adds the project rules; each request records them",
    "parts": [
      [
        "  if (run.features.instructions) {",
        "    let policies = project.replace(projectMap, '').trim();",
        "    if (!run.features.verification) policies = policies.replace(/## Verification\\r?\\n[\\s\\S]*?(?=\\r?\\n## |$)/, '').trim();",
        "    sections.instructions = `Automatically loaded project instructions (PROJECT.md):\\n${policies}`;",
        "    text += `\\n\\n${sections.instructions}`;",
        "  }"
      ],
      [
        "      for (const [component, content] of Object.entries(sections)) {",
        "        await event(run, component, { instructions: 'Project rules included in request', context: 'Project context included in request', memory: 'Saved handoff included in request' }[component], content, { content, call: run.step, session: run.session });"
      ]
    ]
  },
  "4": {
    "file": "lib/runner.mjs",
    "caption": "assembleModelInput adds the project map, file list and current version",
    "parts": [
      [
        "  if (run.features.context) {",
        "    const files = await Promise.all((await presentFiles(workspace(run.id), READABLE)).map(async name => `${name} (${(await fs.stat(filePath(run.id, name))).size} bytes${FILES.includes(name) ? ', editable' : ', read-only'})`));",
        "    sections.context = `Current project context:\\n${projectMap}\\n\\nAccessible files:\\n${files.join('\\n')}\\nCurrent source revision: ${await revision(run.id)}. Browser viewport: 390 × 760. Browser targets are listed in the browser_action tool schema.`;"
      ],
      [
        "    text += `\\n\\n${sections.context}`;",
        "  }"
      ]
    ]
  },
  "5": {
    "file": "lib/runner.mjs",
    "caption": "assess() runs the checks; request_completion refuses \"done\" while they fail",
    "parts": [
      [
        "async function assess(run, final = false) {",
        "  await event(run, 'verification', final ? 'Independent final browser assessment' : 'Running browser checks', 'Protected acceptance checks are running against the sandbox source.');",
        "  // The agent tool and the completion gate use the visible tier only.",
        "  const checks = withoutHeldOut(await runChecks(run, { tier: 'visible' }));",
        "  checks.origin = 'agent';",
        "  run.checks = checks;",
        "  await event(run, 'verification', `${checks.passed}/${checks.total} browser checks passed`, checks.results.map(result => `${result.passed ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`).join('\\n'), { checks, screenshot: checks.screenshot });"
      ],
      [
        "    if (run.features.verification && (checks.suiteVersion !== CHECK_SUITE_VERSION || checks.revision !== current || checks.passed !== checks.total || !checks.total)) {",
        "      result = { accepted: false, reason: 'Verification gate blocked completion. Inspect these observed failures, correct the source, and request completion again.', checks };",
        "      await event(run, 'gate', 'Completion blocked by verification', `${checks.passed}/${checks.total} checks passed at revision ${checks.revision}.`);"
      ]
    ]
  },
  "6": {
    "file": "lib/runner.mjs",
    "caption": "buildHandoff saves what was recorded; startFreshSession hands it to the next session",
    "parts": [
      [
        "export function buildHandoff(run) {",
        "  const checkpoints = run.checkpoints || [];",
        "  const edits = new Map();",
        "  for (const checkpoint of checkpoints) if (checkpoint.tool === 'write_file' && FILES.includes(checkpoint.detail?.written)) edits.set(checkpoint.detail.written, { file: checkpoint.detail.written, revision: checkpoint.revision });",
        "  const checked = checkpoints.findLast(c => c.tool === 'run_checks');",
        "  return { previousSession: run.session, sourceRevision: run.revision, savedNote: (run.memory || '').slice(0, 6000), editedFiles: [...edits.values()], checks: run.features.verification && checked ? compactChecks(checked.detail) : null, recentActions: checkpoints.slice(-5).map(c => ({ tool: c.tool, revision: c.revision })), note: 'Files remain. Previous API messages are cleared. This handoff contains recorded observations, not proof of completion. Compare check and source revisions before reusing evidence.' };"
      ],
      [
        "function startFreshSession(run) {",
        "  // Intentional session reset: the model receives no previous API messages.",
        "  const previous = { history: run.history, session: run.session, sessionHandoff: run.sessionHandoff };",
        "  run.sessionHandoff = run.features.memory && run.harnessVersion >= 3 ? buildHandoff(run) : null;",
        "  run.history = [];",
        "  run.session = (run.session || 1) + 1;"
      ]
    ]
  },
  "7": {
    "file": "lib/runner.mjs",
    "caption": "approveRun publishes only after a person approves; request_completion waits for that",
    "parts": [
      [
        "export async function approveRun(run) {",
        "  if (running(run.id)) throw new Error('Wait for the runner to finish before approving.');",
        "  if (run.status !== 'awaiting_approval' || !run.features.permissions) throw new Error('This run has no pending approval.');",
        "  return publish(run);"
      ],
      [
        "async function publish(run) {",
        "  const current = await revision(run.id);",
        "  if (!run.pendingRevision || run.pendingRevision !== current) throw new Error('The source changed after completion was requested. A fresh completion assessment is required.');",
        "  if (run.features.verification && !(run.checks?.suiteVersion === CHECK_SUITE_VERSION && run.checks.revision === current && run.checks.passed === run.checks.total && run.checks.total > 0)) throw new Error(`Passing ${CHECK_SUITE_VERSION} checks on the current source revision are required before approval. Rerun browser checks to refresh older evidence.`);"
      ],
      [
        "      if (run.features.permissions) {",
        "        run.status = 'awaiting_approval';",
        "        await event(run, 'permission', 'Awaiting explicit approval', `Patch revision ${current} is ready for review. Applying it updates only this run's isolated demo copy.`);"
      ]
    ]
  }
};

export const STEPS = [
  { id: 0, title: 'A model alone', component: null, recordingKey: 'step0',
    problem: 'We asked a model to fix the bug. It answered well. Nothing happened, because a model can only produce text.',
    add: 'Nothing yet. Only the model, a short instruction and the task.',
    look: 'The request box is everything the model received. Its answer is text, and text changes nothing.' },
  { id: 1, title: 'Agent loop', component: 'loop', recordingKey: 'step1',
    problem: 'One answer is a dead end. Something has to send the request again, report back what happened, and know when to stop.',
    add: 'A loop: send the request, record the reply, return what happened, and repeat until a budget ends it.',
    look: 'Look for the repeating pattern: request, reply, observation. Without tools nothing changes, so the budget stops it.' },
  { id: 2, title: 'Tools and sandbox', component: 'tools', recordingKey: 'step2',
    problem: 'The loop can only talk. It cannot open a file, change the code or try the app, and it must not touch anything outside its own copy.',
    add: 'Tools that really read and change files and use a browser, inside a sandbox copy the agent cannot leave.',
    look: 'Look for real file reads and writes in the sandbox. The write outside the sandbox was tried by the presenter and rejected.' },
  { id: 3, title: 'Instructions and policies', component: 'instructions', recordingKey: 'step3',
    problem: 'The agent does not know how this project wants things done: what to keep, what not to change.',
    add: 'The project\'s own rules, added to every request.',
    look: 'The highlighted block is the project rules, sent with the request. Sending a rule proves it was included, not that the model followed it.' },
  { id: 4, title: 'Context management', component: 'context', recordingKey: 'step4',
    problem: 'Every session starts blind. The agent has to hunt for where things are before it can begin.',
    add: 'A map of the project, its files and the current version, added to every request.',
    look: 'The highlighted block is the project briefing, sent with the request. It proves inclusion, not that the model used it.' },
  { id: 5, title: 'Verification', component: 'verification', recordingKey: 'step5',
    problem: 'The model can say it is done without checking. Nothing tests whether the fix works.',
    add: 'A check tool the agent can run, and a gate: the harness runs the checks itself before it accepts "done".',
    look: 'Look for checks before and after the edit, then the harness\'s own check when the agent says it is done.' },
  { id: 6, title: 'Memory and state', component: 'memory', recordingKey: 'step6',
    problem: 'Long work gets cut off. A fresh session forgets everything the previous one learned.',
    add: 'A saved handoff: when a session is cut off, the next one starts from what was recorded.',
    look: 'Both runs were set to reset at the same call. Compare what each fresh session started with, and how each run ended.' },
  { id: 7, title: 'Guardrails: approval', component: 'guardrails', recordingKey: 'step7',
    problem: 'Everything so far could still ship by itself. Nobody decides.',
    add: 'An approval step: the change waits for a person before it reaches production.',
    look: 'Production waits. A person approves. Only then does production change.' }
].map(step => ({ ...step, code: CODE?.[step.id] || null }));

const STATUS_LABELS = { completed: 'Completed', budget_exceeded: 'Budget reached', awaiting_approval: 'Awaiting approval', failed: 'Failed', paused: 'Paused', interrupted: 'Interrupted', running: 'Running', pausing: 'Pausing', ready: 'Ready', incomplete: 'Incomplete reply' };
export const statusLabel = status => STATUS_LABELS[status] || String(status ?? 'Unknown');
export const shortId = id => String(id || '').slice(0, 8).toUpperCase();

// ---- Recording access ----
export function stepEntry(recording, stepId) { return recording?.steps?.[`step${stepId}`] ?? null; }
export function isRecorded(recording, stepId) {
  const entry = stepEntry(recording, stepId);
  if (stepId === 0) return !!(entry && typeof entry.text === 'string');
  if (stepId === 6) return !!(entry?.withoutMemory?.run || entry?.withMemory?.run);
  return !!entry?.run;
}

// ---- The request box ----
// Instructions plus task from the first prompt event (or of a given session), or from a model-only record.
export function requestText(source, session) {
  if (!source) return null;
  if (!Array.isArray(source.events)) {
    if (typeof source.instructions !== 'string') return null;
    return { instructions: source.instructions, task: String(source.task ?? ''), session: null };
  }
  const event = session == null ? null : source.events.find(e => e.kind === 'prompt' && (e.session ?? 1) === session);
  if (session != null && !event) return null;
  const inputs = event ? { instructions: String(event.instructions ?? event.detail ?? ''), task: String(event.task ?? source.task ?? ''), session: event.session ?? 1 } : promptInputs(source);
  return inputs ? { instructions: inputs.instructions, task: inputs.task, session: inputs.session } : null;
}
// The request each step displays, and the one the next step is compared with.
function displayedRequest(recording, stepId) {
  const entry = stepEntry(recording, stepId);
  if (!isRecorded(recording, stepId)) return null;
  if (stepId === 0) return requestText(entry);
  if (stepId === 6) {
    const run = entry.withMemory?.run;
    if (!run) return null;
    const later = run.events.filter(e => e.kind === 'prompt').map(e => e.session ?? 1).filter(s => s > 1);
    return requestText(run, later.length ? Math.min(...later) : undefined);
  }
  return requestText(entry.run);
}
function baselineRequest(recording, stepId) {
  // Step 6 shows its fresh session; the next step compares with its first session.
  if (stepId === 6) return requestText(stepEntry(recording, 6)?.withMemory?.run) ?? null;
  return displayedRequest(recording, stepId);
}
// Line-based diff. A line that is not in the previous request is new; when it
// extends a previous line (same start), only the extension is new. Forced
// sections (the recorded instructions/context/memory blocks) are always new.
export function requestDelta(current, previous, forcedSections = []) {
  const text = String(current ?? '');
  const added = new Uint8Array(text.length);
  if (previous != null) {
    const before = String(previous).split('\n');
    const known = new Set(before);
    let offset = 0;
    for (const line of text.split('\n')) {
      if (line.trim() && !known.has(line)) {
        let common = 0;
        for (const old of before) {
          let k = 0; const limit = Math.min(old.length, line.length);
          while (k < limit && old[k] === line[k]) k++;
          if (k > common) common = k;
        }
        if (common < line.length && common >= 20) { const space = line.lastIndexOf(' ', common); common = space > 0 ? space : 0; }
        if (common < 20) common = 0;
        added.fill(1, offset + common, offset + line.length);
      }
      offset += line.length + 1;
    }
  }
  for (const section of forcedSections) {
    const value = String(section || '');
    const at = value ? text.indexOf(value) : -1;
    if (at >= 0) added.fill(1, at, at + value.length);
  }
  const segments = [];
  for (let i = 0; i < text.length;) {
    let j = i; while (j < text.length && added[j] === added[i]) j++;
    segments.push({ text: text.slice(i, j), added: added[i] === 1 });
    i = j;
  }
  // Whitespace-only highlights carry no information.
  return segments.map(s => (s.added && !s.text.trim() ? { ...s, added: false } : s))
    .reduce((list, s) => { const last = list.at(-1); if (last && last.added === s.added) last.text += s.text; else list.push({ ...s }); return list; }, []);
}
function sectionContent(run, kind, session) {
  // Only the recorded section events ("... included in request"), never other memory events.
  const event = (run?.events || []).find(e => e.kind === kind && (e.session ?? 1) === (session ?? 1) && /included in request$/.test(e.title || '') && (e.content || e.detail));
  return event ? String(event.content ?? event.detail) : null;
}
export function requestView(recording, stepId) {
  const current = displayedRequest(recording, stepId);
  if (!current) return null;
  let previousStep = null, previous = null;
  for (let k = stepId - 1; k >= 0 && !previous; k--) { previous = baselineRequest(recording, k); if (previous) previousStep = k; }
  const step = STEPS[stepId];
  const run = stepId === 6 ? stepEntry(recording, 6)?.withMemory?.run : stepEntry(recording, stepId)?.run;
  const forced = SECTION_KINDS.includes(step.component) ? [sectionContent(run, step.component, current.session)].filter(Boolean) : [];
  const instructions = requestDelta(current.instructions, stepId === 0 ? null : previous?.instructions ?? null, forced);
  const task = requestDelta(current.task, stepId === 0 ? null : previous?.task ?? null);
  const newLines = [...instructions, ...task].filter(s => s.added).reduce((sum, s) => sum + s.text.split('\n').filter(line => line.trim()).length, 0);
  let caption;
  if (stepId === 0) caption = 'The starting point. Nothing is highlighted.';
  else if (previousStep == null) caption = 'No earlier step is recorded, so nothing is compared.';
  else caption = `Highlighted: new since step ${previousStep}${previousStep !== stepId - 1 ? ` (step ${stepId - 1} is not recorded)` : ''}.`;
  // The renderer scrolls the request box to this step's own section when it has one.
  const focus = forced.length ? forced[0].split('\n')[0].slice(0, 60) : null;
  return { session: current.session, previousStep, instructions, task, newLines, caption, focus,
    heading: stepId === 0 ? 'The request: one message, no tools' : stepId === 6 ? `Session ${current.session} request, with memory` : 'The request the harness sent first' };
}

// ---- The activity list ----
const STOP_PERMISSIONS = ['Awaiting explicit approval', 'Patch applied to local demo copy'];
export const PROBE_TITLE = 'Protected-file boundary tested';
export function isStopEvent(e) { return ['budget', 'error', 'completion'].includes(e?.kind) || (e?.kind === 'permission' && STOP_PERMISSIONS.includes(e.title)); }
const isModelCall = e => e.kind === 'model' && e.title === 'Calling the configured model';
const isPresenterResult = e => e.kind === 'checks' && e.phase !== 'start' && e.title !== 'Presenter evaluation started';
const isCheckResult = e => e.kind === 'verification' && /checks passed$/.test(e.title || '');
export function actorOf(e) {
  if (e.kind === 'checks') return 'presenter';
  if (e.kind === 'permission' && e.title === PROBE_TITLE) return 'probe';
  if (['assistant', 'tool'].includes(e.kind)) return 'model';
  return 'harness';
}
export const ACTOR_LABELS = { presenter: 'Presenter action, not the model', probe: 'Presenter-triggered probe, not a model action', model: 'Model', harness: 'Harness' };
const KIND_LABELS = { model: 'Request sent', assistant: 'Model reply', observation: 'Observation', tool: 'Tool requested', tool_error: 'Tool rejected', tool_result: 'Tool result', edit: 'File changed in the sandbox', browser: 'Browser', budget: 'Budget stop', verification: 'Check', gate: 'Completion blocked', completion: 'Completion', permission: 'Publishing', reset: 'Session cut off', run: 'Session', memory: 'Memory', instructions: 'Rules in the request', context: 'Context in the request', checks: 'Check', error: 'Error', model_reply: 'Model reply' };
const FILTERS = {
  0: () => false,
  1: e => isModelCall(e) || ['assistant', 'observation', 'tool', 'tool_error', 'budget', 'error'].includes(e.kind),
  2: e => ['tool', 'tool_error', 'edit', 'permission', 'budget', 'completion', 'error'].includes(e.kind),
  3: e => ['instructions', 'tool', 'tool_error', 'edit', 'budget', 'completion', 'error', 'permission'].includes(e.kind),
  4: e => ['context', 'tool', 'tool_error', 'edit', 'budget', 'completion', 'error', 'permission'].includes(e.kind),
  5: e => (e.kind === 'tool' && ['run_checks', 'request_completion', 'write_file'].includes(e.tool)) || isCheckResult(e) || ['gate', 'completion', 'edit', 'budget', 'error', 'permission'].includes(e.kind),
  6: e => ['reset', 'edit', 'gate', 'budget', 'completion', 'error'].includes(e.kind) || (e.kind === 'run' && (e.title || '').startsWith('Fresh')) || (e.kind === 'memory' && e.title !== 'Progress checkpoint saved') || (e.kind === 'tool' && e.tool === 'save_memory') || isCheckResult(e) || (e.kind === 'permission' && isStopEvent(e)),
  7: e => (e.kind === 'tool' && ['request_completion', 'write_file', 'run_checks'].includes(e.tool)) || isCheckResult(e) || ['permission', 'edit', 'gate', 'budget', 'error', 'completion'].includes(e.kind)
};
function rowOf(e, run) {
  const actor = actorOf(e);
  let label = actor === 'presenter' || actor === 'probe' ? ACTOR_LABELS[actor] : `${KIND_LABELS[e.kind] || e.kind} · ${ACTOR_LABELS[actor]}`;
  if (e.kind === 'permission' && e.title === 'Awaiting explicit approval') label = `Waiting for a person · ${ACTOR_LABELS.harness}`;
  if (e.kind === 'permission' && e.title === 'Patch applied to local demo copy') label = run?.features?.permissions ? 'Published after a person approved · Harness' : `Published automatically, no review · ${ACTOR_LABELS.harness}`;
  const detail = SECTION_KINDS.includes(e.kind) && e.content ? e.content : e.detail;
  return { at: e.at ?? null, kind: e.kind, title: e.title || e.kind, detail: typeof detail === 'string' ? detail : detail == null ? '' : JSON.stringify(detail), actor, label };
}
// The events to show for a step, bounded: up to `max` rows. The stopping
// event(s), the presenter actions and the step's own section are always kept,
// then the first event of each kind (so a write is not hidden behind reads),
// then the earliest rows. One "N more lines" marker stands for each gap.
export function activityExcerpt(run, stepId, { max = MAX_ROWS } = {}) {
  const filter = FILTERS[stepId];
  if (!run || !filter) return { rows: [], total: 0, elided: 0 };
  const seen = new Set();
  const step = STEPS[stepId];
  const chosen = [];
  for (const e of run.events || []) {
    if (!(filter(e) || isPresenterResult(e))) continue;
    if (SECTION_KINDS.includes(e.kind) && /included in request$/.test(e.title || '')) {
      const key = `${e.kind}:${e.session ?? 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    chosen.push(e);
  }
  const keep = new Set();
  chosen.forEach((e, i) => {
    if (isStopEvent(e) || isPresenterResult(e) || actorOf(e) === 'probe' || e.kind === 'reset' || (step.component && e.kind === step.component && SECTION_KINDS.includes(e.kind))) keep.add(i);
  });
  const signatures = new Set();
  chosen.forEach((e, i) => {
    const signature = `${e.kind}:${e.tool || ''}`;
    if (signatures.has(signature)) return;
    signatures.add(signature);
    if (keep.size < max) keep.add(i);
  });
  for (let i = 0; i < chosen.length && keep.size < max; i++) keep.add(i);
  const rows = [];
  let gap = 0;
  chosen.forEach((e, i) => {
    if (!keep.has(i)) { gap++; return; }
    if (gap) { rows.push({ elided: gap }); gap = 0; }
    rows.push(rowOf(e, run));
  });
  if (gap) rows.push({ elided: gap });
  return { rows, total: chosen.length, elided: chosen.length - keep.size };
}
export function modelOnlyActivity(record) {
  if (!record || typeof record.text !== 'string') return { rows: [], total: 0, elided: 0 };
  return { rows: [{ at: record.at ?? null, kind: 'assistant', title: 'Model reply (text only)', detail: record.text, actor: 'model', label: `Model reply · ${ACTOR_LABELS.model}` }], total: 1, elided: 0 };
}

// ---- Footer facts and highlights ----
export function footerFacts(source, recording) {
  if (!source) return null;
  if (source.run) {
    const run = source.run;
    return { kind: 'run', runId: run.id, shortId: shortId(run.id), date: run.createdAt || run.startedAt || null, model: run.provider?.model || recording?.model || 'Unknown model', status: run.status, statusLabel: statusLabel(run.status), calls: run.usage?.calls ?? source.calls ?? null, note: RECORDED_NOTE };
  }
  if (typeof source.text === 'string') return { kind: 'request', runId: source.id, shortId: shortId(source.id), date: source.at || null, model: source.model || recording?.model || 'Unknown model', status: source.status, statusLabel: statusLabel(source.status), calls: 1, note: RECORDED_NOTE };
  return null;
}
const count = (run, test) => (run?.events || []).filter(test).length;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function stepHighlights(stepId, entry) {
  const run = entry?.run;
  const tool = name => count(run, e => e.kind === 'tool' && e.tool === name);
  const stop = (run?.events || []).findLast(isStopEvent);
  const stopLine = stop ? `Stopped: ${stop.title}` : `Status: ${statusLabel(run?.status)}`;
  switch (stepId) {
    case 0: return ['One request, with no tools offered.', `The reply: ${String(entry.text).length.toLocaleString('en-US')} characters of text.`, 'No run and no files: nothing could change.'];
    case 1: return [plural(run.usage?.calls ?? 0, 'model call'), `Tools offered: ${run.loopOnly ? 'none' : 'some'}`, plural(count(run, e => e.kind === 'observation'), 'observation') + ' returned to the model', ...(count(run, e => e.kind === 'tool_error') ? [`${plural(count(run, e => e.kind === 'tool_error'), 'tool request')} rejected: no tools exist`] : []), stopLine];
    case 2: {
      const probe = (run.events || []).findLast(e => actorOf(e) === 'probe');
      const rejected = probe && (probe.result?.error || /reject|outside|not allowed|denied/i.test(JSON.stringify(probe.result ?? '')));
      return [`${plural(tool('read_file'), 'file read')}, ${plural(tool('write_file'), 'file write')}, ${plural(tool('browser_action'), 'browser action')}`, probe ? `Write outside the sandbox: ${rejected ? 'rejected' : 'see the recorded result'} (presenter-triggered probe, not a model action)` : `Write outside the sandbox: ${NOT_RECORDED.toLowerCase()}`, stopLine];
    }
    case 3: case 4: {
      const kind = stepId === 3 ? 'instructions' : 'context';
      const first = (run.events || []).find(e => e.kind === kind);
      const chars = first ? String(first.content ?? first.detail ?? '').length : 0;
      return [`${stepId === 3 ? 'Project rules' : 'Project briefing'} in the request: ${chars.toLocaleString('en-US')} characters`, `Sent with ${plural(count(run, e => e.kind === kind), 'request')} of ${run.usage?.calls ?? '?'}`, 'Included is not the same as followed.', stopLine];
    }
    case 5: {
      // Each check result follows its own start event: the agent's run_checks or the harness's final assessment.
      const events = run.events || [], agent = [], gate = [];
      events.forEach((e, i) => {
        if (!isCheckResult(e)) return;
        const start = events.slice(0, i).findLast(x => x.kind === 'verification' && !isCheckResult(x));
        (start?.title === 'Independent final browser assessment' ? gate : agent).push(e.title.replace(' browser checks passed', ''));
      });
      const gates = count(run, e => e.kind === 'gate');
      return [`The agent ran the checks ${plural(tool('run_checks'), 'time')}${agent.length ? `: ${agent.join(' → ')}` : ''}`, gate.length ? `The harness checked again when the agent said "done": ${gate.join(' → ')}` : 'No check at completion was recorded', ...(gates ? [`Completion refused ${plural(gates, 'time')} while checks failed`] : []), stopLine];
    }
    case 7: {
      const waiting = (run.events || []).find(e => e.kind === 'permission' && e.title === 'Awaiting explicit approval');
      const files = (run.changes || []).map(c => c.file);
      return [waiting ? 'The agent stopped and waited for approval.' : 'No approval wait was recorded.', run.appliedRevision ? 'Production changed only after approval.' : 'Still waiting for approval: production unchanged.', files.length ? `Files changed: ${files.join(', ')}` : 'Files changed: none recorded'];
    }
    default: return [];
  }
}
// The frozen handoff a fresh session received: the run's sessionHandoff when the
// export has it, otherwise the JSON inside the recorded "Saved handoff included
// in request" section. Returns null when neither exists or it cannot be parsed.
export function handoffOf(run) {
  if (run?.sessionHandoff && typeof run.sessionHandoff === 'object') return run.sessionHandoff;
  const event = (run?.events || []).find(e => e.kind === 'memory' && e.title === 'Saved handoff included in request' && (e.content || e.detail));
  const text = String(event?.content ?? event?.detail ?? '');
  const at = text.indexOf('{');
  if (at < 0) return null;
  try { const value = JSON.parse(text.slice(at)); return value && typeof value === 'object' ? value : null; } catch { return null; }
}
// What a handoff actually carried. "empty" means nothing beyond the source revision.
export function handoffCarried(handoff) {
  if (!handoff || typeof handoff !== 'object') return null;
  const editedFiles = Array.isArray(handoff.editedFiles) ? handoff.editedFiles.length : 0;
  const checks = !!handoff.checks;
  const note = typeof handoff.savedNote === 'string' && handoff.savedNote.trim().length > 0;
  const actions = Array.isArray(handoff.recentActions) ? handoff.recentActions.length : 0;
  return { editedFiles, checks, note, actions, empty: !editedFiles && !checks && !note && !actions };
}
export const EMPTY_HANDOFF_TEXT = 'The reset came before the first edit, so the handoff carried only the source revision: no edited files, no check result, no saved note. The difference in calls between the two runs cannot be attributed to memory.';
const listItems = items => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
export function carriedText(carried) {
  const items = [];
  if (carried.editedFiles) items.push(plural(carried.editedFiles, 'edited file'));
  if (carried.checks) items.push('a check result');
  if (carried.note) items.push('a saved note');
  if (carried.actions) items.push(plural(carried.actions, 'recent action'));
  return `The handoff carried ${listItems(items)}, plus the source revision.`;
}
function memoryHighlights(slot, entry) {
  const label = slot === 'withMemory' ? 'With memory' : 'Without memory';
  const run = entry?.run;
  if (!run) return [`${label}: ${NOT_RECORDED}`];
  const events = run.events || [];
  const reset = events.find(e => e.kind === 'reset');
  const calls = run.usage?.calls ?? null;
  // A run that finishes before the reset point never resets. Say so instead of implying a cut-off.
  if (!reset) {
    const point = run.resetAfterCalls ?? reset?.resetAfterCalls ?? null;
    return [`${label}: ${run.status === 'completed' || run.status === 'awaiting_approval' ? `finished in ${plural(calls ?? 0, 'call')}` : `stopped (${run.status}) after ${plural(calls ?? 0, 'call')}`}${point ? `, ${calls != null && calls < point ? 'before' : 'at'} the reset point (call ${point})` : ''}, so it never reset and had no fresh session.`];
  }
  const cut = `cut off after call ${reset.call ?? '?'}`;
  const handoffEvent = events.some(e => e.kind === 'memory' && e.title === 'Saved handoff included in request');
  const lines = [];
  if (!handoffEvent) lines.push(`${label}: ${cut}; the fresh session got the task and files only.`);
  else {
    const carried = handoffCarried(handoffOf(run));
    if (!carried) lines.push(`${label}: ${cut}; the fresh session got a saved handoff, but its contents could not be read.`);
    else lines.push(`${label}: ${cut}; the fresh session got a saved handoff.`, carried.empty ? EMPTY_HANDOFF_TEXT : carriedText(carried));
  }
  lines.push(sessionOutcome(label, run, calls));
  return lines;
}
// How the run ended after the cut-off, from its recorded status only.
function sessionOutcome(label, run, calls) {
  const requested = (run.events || []).some(e => e.kind === 'tool' && e.tool === 'request_completion');
  if (run.status === 'completed' || run.status === 'awaiting_approval') return `${label}, after the cut-off: ${run.status === 'completed' ? 'completed' : 'reached the approval boundary'} after ${plural(calls ?? 0, 'call')} in total.`;
  if (run.status === 'budget_exceeded') return `${label}, after the cut-off: stopped at its budget after ${plural(calls ?? 0, 'call')} in total${requested ? '' : ' without requesting completion'}. A handoff carries state; it does not make the model stop.`;
  return `${label}, after the cut-off: ${run.status} after ${plural(calls ?? 0, 'call')} in total.`;
}
export function proofSummary(stepId, recording) {
  const entry = stepEntry(recording, stepId);
  if (!isRecorded(recording, stepId)) return { recorded: false, message: NOT_RECORDED, footers: [], highlights: [] };
  if (stepId === 6) {
    const slots = [['withoutMemory', 'Without memory'], ['withMemory', 'With memory']];
    return { recorded: true, footers: slots.map(([slot, label]) => ({ label, slot, facts: footerFacts(entry[slot], recording) })), highlights: slots.flatMap(([slot]) => memoryHighlights(slot, entry[slot])) };
  }
  return { recorded: true, footers: [{ label: null, facts: footerFacts(entry, recording) }], highlights: stepHighlights(stepId, entry) };
}

// ---- The diagram ----
export function diagramState(stepId) {
  return ORDER.map((id, index) => {
    const component = COMPONENTS.find(c => c.id === id);
    const enabled = index < stepId, current = index === stepId - 1;
    return { id, name: component.name, icon: component.icon, number: String(index + 1).padStart(2, '0'), enabled, current: enabled && current, badge: current ? 'Added now' : enabled ? 'Added' : 'Not yet' };
  });
}

// ---- The phones ----
export function assetUrl(relative) {
  if (!relative) return null;
  const name = String(relative).split('/').pop().replace(/\.png$/, '');
  return /^[a-z0-9-]+$/.test(name) ? `/builder-assets/${name}.png` : null;
}
// The production state just before approval, only when the run recorded that wait.
export function stateBeforeApproval(run) {
  if (!(run?.events || []).some(e => e.kind === 'permission' && e.title === 'Awaiting explicit approval')) return null;
  return { ...run, status: 'awaiting_approval', appliedRevision: null, appliedAt: null };
}
export function phoneViews(stepId, recording, previewOrigin = null, formatTime = value => value) {
  if (stepId === 0) return { note: 'No app at this step. The model only replied with text, so there is nothing to show on a phone.', groups: [] };
  const entry = stepEntry(recording, stepId);
  const sets = stepId === 6 ? [['Without memory', entry?.withoutMemory], ['With memory', entry?.withMemory]] : [[null, entry]];
  const groups = sets.map(([label, item]) => {
    const run = item?.run;
    if (!run) return { label, missing: true, phones: [] };
    const live = !!(previewOrigin && recording?.present?.[run.id]);
    const sandboxUrl = `${previewOrigin}/preview/${encodeURIComponent(run.id)}/index.html`;
    const productionUrl = `${previewOrigin}/production/${encodeURIComponent(run.id)}/index.html?rev=${encodeURIComponent(run.appliedRevision || 'original')}`;
    const phones = [{ role: 'sandbox', label: 'SANDBOX', caption: 'The agent\'s working copy.', live, src: live ? sandboxUrl : assetUrl(item.screens?.sandbox) }];
    if (stepId === 7) {
      const before = stateBeforeApproval(run);
      phones.push({ role: 'production-before', label: 'PRODUCTION · BEFORE', banner: before ? productionBanner(before, formatTime) : { state: 'original', text: NOT_RECORDED }, live: false, src: assetUrl(item.screens?.productionBefore) });
      phones.push(run.appliedRevision
        ? { role: 'production-after', label: 'PRODUCTION · AFTER', banner: productionBanner(run, formatTime), live, src: live ? productionUrl : assetUrl(item.screens?.productionAfter) }
        : { role: 'production-after', label: 'PRODUCTION · AFTER', banner: { state: 'original', text: `${NOT_RECORDED}: no approval recorded.` }, live: false, src: null });
    } else phones.push({ role: 'production', label: 'PRODUCTION', banner: productionBanner(run, formatTime), live, src: live ? productionUrl : assetUrl(item.screens?.production) });
    return { label, missing: false, runId: run.id, phones };
  });
  return { note: null, groups };
}
export function handoffText(recording) {
  const run = stepEntry(recording, 6)?.withMemory?.run;
  const event = (run?.events || []).find(e => e.kind === 'memory' && e.title === 'Saved handoff included in request' && (e.content || e.detail));
  return event ? { text: String(event.content ?? event.detail ?? ''), at: event.at ?? null, session: event.session ?? null } : null;
}
export function changeSummary(run) {
  const lines = value => (value == null ? 0 : String(value).split(/\r?\n/).length);
  return (run?.changes || []).map(change => ({ file: change.file, before: lines(change.before), after: lines(change.after) }));
}
export function parseStep(hash) {
  const match = /^#step-([0-7])$/.exec(String(hash || ''));
  return match ? Number(match[1]) : 0;
}

// ======================= DOM (browser only) =======================
if (typeof document !== 'undefined') {
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = {
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 8a7 7 0 0 1 12-3l3 3M4 16l3 3a7 7 0 0 0 12-3"/>',
    terminal: '<path d="m6 8 4 4-4 4m7 0h5"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
    file: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/>',
    folder: '<path d="M3 6h7l2 3h9v12H3zM3 6V3h7l2 3h6v3"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    error: '<path d="m12 3 10 18H2zM12 9v5m0 3v1"/>',
    play: '<path d="m8 4 12 8-12 8z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M9 9h12"/>',
    arrowLeft: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    arrowRight: '<path d="M4 12h16m-6-6 6 6-6 6"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
  const eventIcon = kind => ({ instructions: 'file', context: 'folder', tool: 'terminal', tool_error: 'error', edit: 'edit', checks: 'checkCircle', verification: 'checkCircle', gate: 'shield', browser: 'layout', memory: 'layers', permission: 'shield', budget: 'clock', reset: 'refresh', observation: 'refresh', model: 'sparkles', assistant: 'sparkles', run: 'play', error: 'error' }[kind] || 'info');
  const time = value => { const d = new Date(value); return value && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''; };
  const date = value => { const d = new Date(value); return value && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'; };

  let recording = null, loadState = 'loading', previewOrigin = null, current = 0;

  const segmentsHTML = segments => segments.map(s => (s.added ? `<mark class="req-new">${escapeHTML(s.text)}</mark>` : escapeHTML(s.text))).join('');
  const notRecorded = extra => `<div class="not-recorded" data-not-recorded><strong>${NOT_RECORDED}</strong><span>${escapeHTML(extra || 'This step has no recorded run on this server. The problem and the component are still shown.')}</span></div>`;
  function activityHTML(excerpt, emptyText = 'No activity recorded.') {
    if (!excerpt.rows.length) return `<p class="builder-empty">${escapeHTML(emptyText)}</p>`;
    return `<div class="activity-list builder-activity">${excerpt.rows.map(row => row.elided
      ? `<div class="event-elided" data-elided="${row.elided}">${row.elided} more ${row.elided === 1 ? 'line' : 'lines'}</div>`
      : `<div class="event-row" data-kind="${escapeHTML(row.kind)}" data-actor="${escapeHTML(row.actor)}"><span class="event-icon ${escapeHTML(row.kind)}">${svg(eventIcon(row.kind))}</span><span class="event-body"><span class="event-meta"><strong>${escapeHTML(row.title)}</strong><time>${escapeHTML(time(row.at))}</time></span>${row.detail ? `<p>${escapeHTML(row.detail)}</p>` : ''}<span class="event-label${row.actor === 'presenter' || row.actor === 'probe' ? ' presenter-label' : ''}">${escapeHTML(row.label)}</span></span></div>`).join('')}</div>`;
  }
  const shortReply = excerpt => ({ ...excerpt, rows: excerpt.rows.map(row => ({ ...row, detail: `${row.detail.length.toLocaleString('en-US')} characters of text, shown in full below.` })) });
  function footerHTML(footer) {
    const f = footer.facts;
    if (!f) return `<p class="proof-footer">${footer.label ? `<strong>${escapeHTML(footer.label)}</strong> · ` : ''}${NOT_RECORDED}</p>`;
    return `<p class="proof-footer" data-footer>${footer.label ? `<strong>${escapeHTML(footer.label)}</strong>` : ''}<span title="${escapeHTML(f.runId)}">${f.kind === 'run' ? 'Run' : 'Request'} ${escapeHTML(f.shortId)}</span><span>${escapeHTML(date(f.date))}</span><span>${escapeHTML(f.model)}</span><span>${escapeHTML(f.statusLabel)}</span><span>${f.calls == null ? '? calls' : escapeHTML(plural(f.calls, 'model call'))}</span><span class="recorded-note">${escapeHTML(f.note)}</span></p>`;
  }
  function requestHTML(view) {
    if (!view) return '';
    return `<div class="request-box" data-request><div class="request-head"><span class="tiny-label">${escapeHTML(view.heading.toUpperCase())}</span><span class="request-caption" data-request-caption>${escapeHTML(view.caption)}${view.newLines ? ` ${plural(view.newLines, 'new line')}.` : ''}</span></div><pre class="request-text" tabindex="0" aria-label="Text sent to the model"><span class="request-part">${segmentsHTML(view.instructions)}</span>\n\n<span class="request-task-label">TASK</span>\n<span class="request-part">${segmentsHTML(view.task)}</span></pre></div>`;
  }
  function phoneHTML(phone) {
    const screen = phone.live
      ? `<iframe title="${escapeHTML(phone.label)} phone (live)" sandbox="allow-scripts allow-same-origin allow-forms" src="${escapeHTML(phone.src)}"></iframe>`
      : phone.src ? `<img class="phone-screen" alt="${escapeHTML(phone.label)} phone, recorded screenshot" src="${escapeHTML(phone.src)}">` : `<div class="phone-missing">${NOT_RECORDED}</div>`;
    return `<section class="phone-column builder-phone${phone.role.startsWith('production') ? ' production' : ''}" data-phone="${escapeHTML(phone.role)}" data-live="${phone.live}"><div class="phone-caption"><span class="phone-label">${escapeHTML(phone.label)}</span>${phone.banner ? `<span class="production-banner" data-state="${escapeHTML(phone.banner.state)}">${escapeHTML(phone.banner.text)}</span>` : `<span class="phone-caption-text">${escapeHTML(phone.caption || '')}</span>`}<span class="phone-source">${phone.live ? 'Live copy on this server' : phone.src ? 'Recorded screenshot' : ''}</span></div><div class="phone-slot"><div class="phone-shell"><div class="phone-top"><span>9:41</span><div class="dynamic-island"></div><span></span></div>${screen}<div class="phone-home"><span></span></div></div></div></section>`;
  }

  function renderDiagram(stepId) {
    $('#diagram').innerHTML = diagramState(stepId).map(card => `<div class="anatomy-card ${card.enabled ? 'enabled' : 'limited'}${card.current ? ' highlight' : ''}" data-component="${card.id}" data-enabled="${card.enabled}" data-current="${card.current}"><span class="anatomy-card-top"><span>${card.number}</span>${svg(card.icon)}<span class="component-mark">${card.enabled ? '✓' : '—'}</span></span><strong>${escapeHTML(card.name)}</strong><span class="anatomy-badge">${escapeHTML(card.badge)}</span>${card.current ? '<span class="component-state">Added now</span>' : ''}</div>`).join('');
  }
  function renderCode(step) {
    const code = step.code;
    if (!code) { $('#code').innerHTML = '<figcaption>No code is added at this step.</figcaption>'; return; }
    $('#code').innerHTML = `<figcaption><strong>${escapeHTML(code.file)}</strong> · ${escapeHTML(code.caption)}</figcaption><pre><code>${code.parts.map(part => part.map(escapeHTML).join('\n')).join('\n<span class="code-gap">⋯</span>\n')}</code></pre>`;
  }
  function renderProof(step) {
    const proof = $('#proof');
    const summary = proofSummary(step.id, recording);
    const intro = `<p class="proof-look">${escapeHTML(step.look)}</p>`;
    if (!summary.recorded) {
      proof.innerHTML = intro + notRecorded(loadState === 'missing' ? 'No builder recording was found on this server. Record one with scripts/record-builder.mjs.' : loadState === 'error' ? 'The builder recording could not be loaded.' : undefined);
      return;
    }
    const view = requestView(recording, step.id);
    const highlights = `<ul class="proof-highlights">${summary.highlights.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`;
    let activity;
    if (step.id === 0) {
      // The whole reply, verbatim and scrollable: it can be long, and it is the point of this step.
      const record = stepEntry(recording, 0);
      activity = `<div class="proof-block"><span class="tiny-label">THE REPLY</span>${activityHTML(shortReply(modelOnlyActivity(record)))}<pre class="handoff-text reply-text" tabindex="0" data-reply aria-label="The model's full reply">${escapeHTML(record.text)}</pre></div>`;
    }
    else if (step.id === 6) {
      const entry = stepEntry(recording, 6);
      const column = (slot, label) => `<div class="proof-column" data-slot="${slot}"><span class="tiny-label">${escapeHTML(label.toUpperCase())}</span>${entry[slot]?.run ? activityHTML(activityExcerpt(entry[slot].run, 6)) : notRecorded(`The ${label.toLowerCase()} run is not recorded.`)}${footerHTML(summary.footers.find(f => f.slot === slot))}</div>`;
      const handoff = handoffText(recording);
      activity = `<div class="proof-columns">${column('withoutMemory', 'Without memory')}${column('withMemory', 'With memory')}</div><div class="proof-block handoff" data-handoff><span class="tiny-label">THE HANDOFF THE FRESH SESSION RECEIVED (WITH MEMORY)</span>${handoff ? `<pre class="handoff-text" tabindex="0">${escapeHTML(handoff.text)}</pre>` : `<p class="builder-empty">${NOT_RECORDED}</p>`}</div>`;
    } else {
      const run = stepEntry(recording, step.id).run;
      activity = `<div class="proof-block"><span class="tiny-label">WHAT HAPPENED</span>${activityHTML(activityExcerpt(run, step.id))}</div>`;
      if (step.id === 7) {
        const changes = changeSummary(run);
        activity += `<div class="proof-block" data-changes><span class="tiny-label">WHAT THE PERSON APPROVED</span>${changes.length ? `<ul class="change-list">${changes.map(c => `<li><strong>${escapeHTML(c.file)}</strong> ${c.before} lines before, ${c.after} lines after</li>`).join('')}</ul>` : `<p class="builder-empty">No file changes recorded.</p>`}</div>`;
      }
    }
    const footers = step.id === 6 ? '' : summary.footers.map(footerHTML).join('');
    proof.innerHTML = intro + highlights + requestHTML(view) + activity + footers;
    // The request box is the marks' offset parent (position: relative).
    const marks = [...proof.querySelectorAll('.request-text .req-new')];
    const mark = (view?.focus && marks.find(item => item.textContent.includes(view.focus))) || marks[0];
    if (mark) $('.request-text', proof).scrollTop = Math.max(0, mark.offsetTop - 24);
  }
  function renderPhones(step) {
    const target = $('#phones');
    if (!isRecorded(recording, step.id) && step.id !== 0) { target.innerHTML = `<div class="section-heading"><div><span class="panel-kicker">THE TWO PHONES</span><h2>Sandbox and production</h2></div></div>${notRecorded('No phones without a recorded run.')}`; return; }
    const views = phoneViews(step.id, recording, previewOrigin, time);
    const heading = `<div class="section-heading"><div><span class="panel-kicker">THE TWO PHONES</span><h2>Sandbox and production</h2></div><span class="subtle-badge">${views.groups.some(g => g.phones.some(p => p.live)) ? 'Live copies of recorded runs' : 'Recorded screenshots'}</span></div>`;
    if (views.note) { target.innerHTML = `${heading}<p class="phones-note">${escapeHTML(views.note)}</p>`; return; }
    target.innerHTML = heading + `<div class="phone-groups">${views.groups.map(group => `<div class="phone-group">${group.label ? `<span class="tiny-label">${escapeHTML(group.label.toUpperCase())}</span>` : ''}${group.missing ? notRecorded('This run is not recorded.') : `<div class="phone-row">${group.phones.map(phoneHTML).join('')}</div>`}</div>`).join('')}</div>`;
  }
  // A screenshot named in the recording but missing on disk shows a plain placeholder (no inline handlers: the CSP forbids them).
  function watchScreens() {
    document.querySelectorAll('#phones img.phone-screen').forEach(img => img.addEventListener('error', () => {
      const missing = document.createElement('div');
      missing.className = 'phone-missing';
      missing.textContent = 'Screenshot not found';
      img.closest('.builder-phone')?.querySelector('.phone-source')?.replaceChildren('Recorded screenshot missing');
      img.replaceWith(missing);
    }, { once: true }));
  }
  function render() {
    const step = STEPS[current];
    document.title = `Harness Lab · Build a harness · Step ${step.id}`;
    $('#step-count').textContent = `STEP ${step.id} OF 7`;
    $('#step-title').innerHTML = `${escapeHTML(step.title)}<span class="title-dot">.</span>`;
    $('#progress').innerHTML = Array.from({ length: 7 }, (_, i) => `<span class="${i < step.id ? 'done' : ''}${i === step.id - 1 ? ' current' : ''}" data-segment="${i + 1}"></span>`).join('');
    $('#progress').setAttribute('aria-label', `Step ${step.id} of 7`);
    $('#problem').textContent = step.problem;
    $('#add-text').textContent = step.add;
    renderDiagram(step.id);
    renderCode(step);
    renderProof(step);
    renderPhones(step);
    watchScreens();
    $('#back').disabled = step.id === 0;
    $('#next').disabled = step.id === 7;
    const notice = $('#recording-notice');
    notice.hidden = loadState === 'ready';
    notice.textContent = loadState === 'loading' ? 'Loading the recording…' : loadState === 'missing' ? 'No builder recording was found on this server. Each step still shows its problem and its component; the proof panel says "Not recorded yet".' : loadState === 'error' ? 'The builder recording could not be loaded. The proof panels say "Not recorded yet".' : '';
  }
  function go(stepId) {
    const next = Math.max(0, Math.min(7, stepId));
    if (location.hash !== `#step-${next}`) location.hash = `#step-${next}`;
    else if (next !== current) { current = next; render(); }
  }
  window.addEventListener('hashchange', () => { current = parseStep(location.hash); render(); window.scrollTo(0, 0); });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(current + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(current - 1); }
  });
  $('#back').addEventListener('click', () => go(current - 1));
  $('#next').addEventListener('click', () => go(current + 1));
  current = parseStep(location.hash);
  render();
  (async () => {
    try {
      const response = await fetch('/api/builder', { cache: 'no-store' });
      if (response.status === 404) { loadState = 'missing'; render(); return; }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      recording = await response.json();
      loadState = 'ready';
      if (Object.keys(recording.present || {}).length) {
        try { previewOrigin = (await (await fetch('/api/state', { cache: 'no-store' })).json()).previewOrigin || null; } catch { previewOrigin = null; }
      }
    } catch { loadState = 'error'; recording = null; }
    render();
  })();
}
