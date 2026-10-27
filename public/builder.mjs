// Harness builder page (docs/BUILDER.md, work packages B and E). Every "proof" on
// this page is derived from a real run: the recorded one from the builder
// recording, or a live run the presenter started on this page (package E), kept
// in page memory only and never written to the recording. Nothing is animated,
// invented or pooled. The pure functions below are exported for tests; the DOM
// code at the bottom runs only in a browser.
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
  const live = !!source.live && !source.live.pending;
  const note = live ? liveNote(source.live.startedAt) : RECORDED_NOTE;
  if (source.run) {
    const run = source.run;
    return { kind: 'run', runId: run.id, shortId: shortId(run.id), date: run.createdAt || run.startedAt || null, model: run.provider?.model || recording?.model || 'Unknown model', status: run.status, statusLabel: statusLabel(run.status), calls: run.usage?.calls ?? source.calls ?? null, note, live };
  }
  if (typeof source.text === 'string') return { kind: 'request', runId: source.id, shortId: shortId(source.id), date: source.at || null, model: source.model || recording?.model || 'Unknown model', status: source.status, statusLabel: statusLabel(source.status), calls: 1, note, live };
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
      const untested = entry.live ? 'Write outside the sandbox: not tested yet (your action, once the run has stopped)' : `Write outside the sandbox: ${NOT_RECORDED.toLowerCase()}`;
      return [`${plural(tool('read_file'), 'file read')}, ${plural(tool('write_file'), 'file write')}, ${plural(tool('browser_action'), 'browser action')}`, probe ? `Write outside the sandbox: ${rejected ? 'rejected' : 'see the recorded result'} (presenter-triggered probe, not a model action)` : untested, stopLine];
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
      const active = isActiveRun(run);
      return [waiting ? 'The agent stopped and waited for approval.' : active ? 'The agent is still working.' : 'No approval wait was recorded.', run.appliedRevision ? 'Production changed only after approval.' : run.status === 'awaiting_approval' ? 'Still waiting for approval: production unchanged.' : 'Nothing published: production unchanged.', files.length ? `Files changed: ${files.join(', ')}` : active ? 'Files changed: shown when the agent stops' : 'Files changed: none recorded'];
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
  if (entry?.live?.pending) return [`${label}: ${PENDING_TEXT.toLowerCase()}`];
  const run = entry?.run;
  if (!run) return [`${label}: ${NOT_RECORDED}`];
  const events = run.events || [];
  const reset = events.find(e => e.kind === 'reset');
  const calls = run.usage?.calls ?? null;
  // A run that finishes before the reset point never resets. Say so instead of implying a cut-off.
  if (!reset) {
    if (isActiveRun(run)) return [`${label}: running, ${plural(calls ?? 0, 'call')} so far; not cut off yet.`];
    if (run.resetAfterFirstEdit === true) {
      const edited = events.some(e => e.kind === 'edit');
      return [`${label}: ${run.status === 'completed' || run.status === 'awaiting_approval' ? `finished in ${plural(calls ?? 0, 'call')}` : `stopped (${run.status}) after ${plural(calls ?? 0, 'call')}`}${edited ? ' before the reset after its first file edit could happen' : ' without editing a file'}, so it never reset and had no fresh session.`];
    }
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
  const line = outcomeLine(label, run, calls);
  if (isActiveRun(run)) return line;
  // An edit after the agent's last check was never checked by the agent. The presenter line shows its result.
  const checked = lastAgentCheckRevision(run);
  return checked && run.revision && checked !== run.revision ? `${line} Its last edit came after its last check and was never checked.` : line;
}
function outcomeLine(label, run, calls) {
  const requested = (run.events || []).some(e => e.kind === 'tool' && e.tool === 'request_completion');
  if (isActiveRun(run)) return `${label}, after the cut-off: still running, ${plural(calls ?? 0, 'call')} so far.`;
  if (run.status === 'completed' || run.status === 'awaiting_approval') return `${label}, after the cut-off: ${run.status === 'completed' ? 'completed' : 'reached the approval boundary'} after ${plural(calls ?? 0, 'call')} in total.`;
  if (run.status === 'budget_exceeded') return `${label}, after the cut-off: stopped at its budget after ${plural(calls ?? 0, 'call')} in total${requested ? '' : ' without requesting completion'}. A handoff carries state; it does not make the model stop.`;
  if (run.status === 'failed') {
    const reason = failureReason(run);
    return `${label}, after the cut-off: failed after ${plural(calls ?? 0, 'call')} in total${reason ? ` (${reason})` : ''}.`;
  }
  return `${label}, after the cut-off: ${run.status} after ${plural(calls ?? 0, 'call')} in total.`;
}
// The last error event, first 80 characters. It is called a provider error only when
// the runner recorded that the model request itself threw (the usage-unavailable event
// written in callModel's catch immediately precedes the error).
export function failureReason(run) {
  const events = run?.events || [];
  const index = events.findLastIndex(e => e.kind === 'error');
  if (index < 0) return null;
  const detail = String(events[index].detail ?? '').trim().slice(0, 80);
  if (!detail) return null;
  const provider = events[index - 1]?.kind === 'usage' && events[index - 1]?.title === 'Request token usage unavailable';
  return `${provider ? 'provider error' : 'error'}: ${detail}`;
}
// The source revision of the agent's own last run_checks (never the harness's
// completion assessment or a presenter evaluation), or null when it never checked.
export function lastAgentCheckRevision(run) {
  const events = run?.events || [];
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === 'tool_result' && e.tool === 'run_checks' && typeof e.result?.revision === 'string') return e.result.revision;
    if (isCheckResult(e) && typeof e.checks?.revision === 'string') {
      const start = events.slice(0, i).findLast(x => x.kind === 'verification' && !isCheckResult(x));
      if (start?.title !== 'Independent final browser assessment') return e.checks.revision;
    }
  }
  return null;
}
export function proofSummary(stepId, recording) {
  const entry = stepEntry(recording, stepId);
  if (!isRecorded(recording, stepId)) return { recorded: false, message: NOT_RECORDED, footers: [], highlights: [] };
  if (stepId === 6) {
    const slots = [['withoutMemory', 'Without memory'], ['withMemory', 'With memory']];
    return { recorded: true, footers: slots.map(([slot, label]) => ({ label, slot, pending: !!entry[slot]?.live?.pending, facts: footerFacts(entry[slot], recording) })), highlights: slots.flatMap(([slot]) => memoryHighlights(slot, entry[slot])) };
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
    if (!run) return { label, missing: true, pending: !!item?.live?.pending, phones: [] };
    // A live run from this page: the sandbox URL carries the source revision so the
    // phone reloads only when a file actually changed.
    const liveRun = !!item.live;
    const live = !!(previewOrigin && recording?.present?.[run.id]);
    const sandboxUrl = `${previewOrigin}/preview/${encodeURIComponent(run.id)}/index.html${liveRun ? `?rev=${encodeURIComponent(run.revision || 'original')}` : ''}`;
    const productionUrl = `${previewOrigin}/production/${encodeURIComponent(run.id)}/index.html?rev=${encodeURIComponent(run.appliedRevision || 'original')}`;
    const missingText = liveRun ? 'Live preview unavailable' : undefined;
    const phones = [{ role: 'sandbox', label: 'SANDBOX', caption: 'The agent\'s working copy.', live, src: live ? sandboxUrl : assetUrl(item.screens?.sandbox), missingText }];
    if (stepId === 7 && liveRun) {
      // Live: one production phone whose banner and build change when you approve.
      phones.push({ role: 'production', label: 'PRODUCTION', banner: productionBanner(run, formatTime), live, src: live ? productionUrl : null, missingText });
    } else if (stepId === 7) {
      const before = stateBeforeApproval(run);
      phones.push({ role: 'production-before', label: 'PRODUCTION · BEFORE', banner: before ? productionBanner(before, formatTime) : { state: 'original', text: NOT_RECORDED }, live: false, src: assetUrl(item.screens?.productionBefore) });
      phones.push(run.appliedRevision
        ? { role: 'production-after', label: 'PRODUCTION · AFTER', banner: productionBanner(run, formatTime), live, src: live ? productionUrl : assetUrl(item.screens?.productionAfter) }
        : { role: 'production-after', label: 'PRODUCTION · AFTER', banner: { state: 'original', text: `${NOT_RECORDED}: no approval recorded.` }, live: false, src: null });
    } else phones.push({ role: 'production', label: 'PRODUCTION', banner: productionBanner(run, formatTime), live, src: live ? productionUrl : assetUrl(item.screens?.production), missingText });
    return { label, missing: false, liveRun, runId: run.id, phones };
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
// What to look for. Two steps depend on the run shown: a live step 2 has not
// been probed yet, and step 6 may reset by call count or after the first edit.
export function stepLook(stepId, recording) {
  const step = STEPS[stepId];
  if (stepId === 2 && stepEntry(recording, 2)?.live) return 'Look for real file reads and writes in the sandbox. When the run has stopped, use "Test the sandbox boundary": you, not the model, try a write outside the sandbox.';
  if (stepId === 6) {
    const entry = stepEntry(recording, 6);
    const runs = [entry?.withoutMemory?.run, entry?.withMemory?.run].filter(Boolean);
    if (runs.length && runs.every(run => run.resetAfterFirstEdit === true)) return 'Both runs were set to reset right after their first file edit. Compare what each fresh session started with, and how each run ended.';
  }
  return step.look;
}

// ======================= Live mode (work package E) =======================
// A live run is a real run started from this page. It replaces the recorded run
// for its step in page memory only, until the page is reloaded.
export const MAX_CALLS = 24;
export const POLL_MS = 1500;
export const BUSY_MESSAGE = 'This run is busy. Pause it and wait for the current operation to finish.';
export const PENDING_TEXT = 'Starts after the run without memory stops.';
const FEATURE_KEYS = ['instructions', 'context', 'memory', 'verification', 'permissions'];
const featureSet = (...enabled) => Object.fromEntries(FEATURE_KEYS.map(key => [key, enabled.includes(key)]));
export const clock = value => { const d = new Date(value); return value && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''; };
export const liveNote = at => `Live run. Started at ${clock(at) || 'an unrecorded time'}.`;
export const isActiveRun = run => !!run && (['running', 'pausing'].includes(run.status) || !!run.activeSessionStartedAt);
// The create body per step: the same values scripts/record-builder.mjs uses,
// except that both step 6 runs reset right after their first file edit.
export function liveStepConfig(stepId) {
  const id = Number(stepId);
  if (!Number.isInteger(id) || id < 0 || id > 7) throw new Error(`Unknown step ${stepId}.`);
  if (id === 0) return { step: 0, modelOnly: true, endpoint: '/api/model/task-only', body: {}, runs: [], probe: false, approval: false };
  const step5 = ['instructions', 'context', 'verification'];
  const runs = {
    1: [[null, { mode: 'minimal', loopOnly: true }]],
    2: [[null, { mode: 'minimal', features: featureSet() }]],
    3: [[null, { mode: 'minimal', features: featureSet('instructions') }]],
    4: [[null, { mode: 'minimal', features: featureSet('instructions', 'context') }]],
    5: [[null, { mode: 'minimal', features: featureSet(...step5) }]],
    6: [['withoutMemory', { mode: 'minimal', features: featureSet(...step5), resetAfterFirstEdit: true }], ['withMemory', { mode: 'minimal', features: featureSet(...step5, 'memory'), resetAfterFirstEdit: true }]],
    7: [[null, { mode: 'engineered' }]]
  }[id];
  return { step: id, modelOnly: false, endpoint: '/api/runs', runs: runs.map(([slot, body]) => ({ slot, body: { ...body, scenario: 'draft' } })), probe: id === 2, approval: id === 7 };
}
// A new recording-shaped object with the live run (or, for step 0, the
// model-only record) in place of the recorded one, marked `live`. A null run
// on step 6 marks that slot as waiting for its turn. Never mutates the input.
export function mergeLiveRun(recording, stepId, slot, run) {
  const base = recording && typeof recording === 'object' ? recording : { steps: {}, present: {} };
  const next = { ...base, steps: { ...(base.steps || {}) }, present: { ...(base.present || {}) }, live: { ...(base.live || {}), [`step${stepId}`]: true } };
  if (stepId === 0) {
    next.steps.step0 = run ? { ...run, live: { startedAt: run.at ?? null } } : base.steps?.step0;
    return next;
  }
  const entry = run ? { runId: run.id, status: run.status, calls: run.usage?.calls ?? 0, screens: null, run, live: { startedAt: run.startedAt || run.createdAt || null } } : { run: null, live: { pending: true } };
  if (run?.id) next.present[run.id] = true;
  if (stepId === 6) next.steps.step6 = { ...(base.steps?.step6 || {}), [slot]: entry };
  else next.steps[`step${stepId}`] = entry;
  return next;
}
// One line for the status bar: status, call N of 24, reported tokens, elapsed seconds, run id.
export function liveStatusLine(source) {
  if (!source) return null;
  if (!Array.isArray(source.events)) {
    // The step 0 model-only record: one request, no run.
    const tokens = (source.usage?.input ?? 0) + (source.usage?.output ?? 0);
    const unreported = source.usageReported === false ? 1 : 0;
    const tokensText = unreported ? 'tokens not reported' : `${tokens.toLocaleString('en-US')} reported tokens`;
    return { kind: 'request', status: source.status, statusLabel: statusLabel(source.status), calls: 1, maxCalls: 1, tokens, unreported, seconds: null, runId: source.id, shortId: shortId(source.id), text: [statusLabel(source.status), '1 request, no tools', tokensText, `request ${shortId(source.id)}`].join(' · ') };
  }
  const calls = source.usage?.calls ?? 0;
  const tokens = (source.usage?.input ?? 0) + (source.usage?.output ?? 0);
  const unreported = source.usage?.unreportedRequests || 0;
  const seconds = Math.max(0, Math.round((Number(source.elapsedMs) || 0) / 1000));
  const tokensText = `${tokens.toLocaleString('en-US')} reported tokens${unreported ? ` (${plural(unreported, 'request')} without usage)` : ''}`;
  return { kind: 'run', status: source.status, statusLabel: statusLabel(source.status), calls, maxCalls: MAX_CALLS, tokens, unreported, seconds, runId: source.id, shortId: shortId(source.id), text: [statusLabel(source.status), `call ${calls} of ${MAX_CALLS}`, tokensText, `${seconds} s`, `run ${shortId(source.id)}`].join(' · ') };
}
// The presenter evaluation recorded on a run (both tiers), from its own event.
export function presenterEvaluation(run) {
  const event = (run?.events || []).findLast(e => e.kind === 'checks' && e.phase === 'end' && e.result);
  if (!event) return null;
  const tier = result => result ? { passed: result.passed, total: result.total, revision: result.revision ?? null, results: (result.results || []).map(item => ({ name: item.name, passed: !!item.passed, detail: String(item.detail ?? '') })) } : null;
  return { at: event.at ?? null, revision: event.result.revision ?? null, visible: tier(event.result), heldOut: tier(event.result.heldOut) };
}
// The presenter's boundary probe on a run: what the harness answered, verbatim.
export function probeResult(run) {
  const event = (run?.events || []).findLast(e => e.kind === 'permission' && e.title === PROBE_TITLE);
  if (!event) return null;
  const error = event.result && typeof event.result === 'object' && typeof event.result.error === 'string' ? event.result.error : null;
  return { at: event.at ?? null, rejected: !!error, error, result: event.result ?? null };
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
    arrowRight: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    code: '<path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
  const eventIcon = kind => ({ instructions: 'file', context: 'folder', tool: 'terminal', tool_error: 'error', edit: 'edit', checks: 'checkCircle', verification: 'checkCircle', gate: 'shield', browser: 'layout', memory: 'layers', permission: 'shield', budget: 'clock', reset: 'refresh', observation: 'refresh', model: 'sparkles', assistant: 'sparkles', run: 'play', error: 'error' }[kind] || 'info');
  const time = value => { const d = new Date(value); return value && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''; };
  const date = value => { const d = new Date(value); return value && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'; };

  let recording = null, loadState = 'loading', previewOrigin = null, current = 0;
  // Live mode. providerState: null while unknown, then { configured, error }.
  let providerState = null;
  const live = {};
  let shown = { step: null, live: '', proof: '', phones: '' };

  const segmentsHTML = segments => segments.map(s => (s.added ? `<mark class="req-new">${escapeHTML(s.text)}</mark>` : escapeHTML(s.text))).join('');
  const notRecorded = extra => `<div class="not-recorded" data-not-recorded><strong>${NOT_RECORDED}</strong><span>${escapeHTML(extra || 'This step has no recorded run on this server. The problem and the component are still shown.')}</span></div>`;
  const pendingBlock = () => `<div class="not-recorded live-pending" data-pending><strong>Waiting</strong><span>${escapeHTML(PENDING_TEXT)}</span></div>`;
  function activityHTML(excerpt, emptyText = 'No activity recorded.') {
    if (!excerpt.rows.length) return `<p class="builder-empty">${escapeHTML(emptyText)}</p>`;
    return `<div class="activity-list builder-activity" data-total="${excerpt.total}">${excerpt.rows.map(row => row.elided
      ? `<div class="event-elided" data-elided="${row.elided}">${row.elided} more ${row.elided === 1 ? 'line' : 'lines'}</div>`
      : `<div class="event-row" data-kind="${escapeHTML(row.kind)}" data-actor="${escapeHTML(row.actor)}"><span class="event-icon ${escapeHTML(row.kind)}">${svg(eventIcon(row.kind))}</span><span class="event-body"><span class="event-meta"><strong>${escapeHTML(row.title)}</strong><time>${escapeHTML(time(row.at))}</time></span>${row.detail ? `<p>${escapeHTML(row.detail)}</p>` : ''}<span class="event-label${row.actor === 'presenter' || row.actor === 'probe' ? ' presenter-label' : ''}">${escapeHTML(row.label)}</span></span></div>`).join('')}</div>`;
  }
  const shortReply = excerpt => ({ ...excerpt, rows: excerpt.rows.map(row => ({ ...row, detail: `${row.detail.length.toLocaleString('en-US')} characters of text, shown in full below.` })) });
  function footerHTML(footer) {
    const f = footer.facts;
    if (!f) return `<p class="proof-footer">${footer.label ? `<strong>${escapeHTML(footer.label)}</strong> · ` : ''}${footer.pending ? 'Live run not started yet.' : NOT_RECORDED}</p>`;
    return `<p class="proof-footer" data-footer data-live="${f.live ? 'true' : 'false'}">${footer.label ? `<strong>${escapeHTML(footer.label)}</strong>` : ''}<span title="${escapeHTML(f.runId)}">${f.kind === 'run' ? 'Run' : 'Request'} ${escapeHTML(f.shortId)}</span><span>${escapeHTML(date(f.date))}</span><span>${escapeHTML(f.model)}</span><span>${escapeHTML(f.statusLabel)}</span><span>${f.calls == null ? '? calls' : escapeHTML(plural(f.calls, 'model call'))}</span><span class="${f.live ? 'live-note' : 'recorded-note'}">${escapeHTML(f.note)}</span></p>`;
  }
  function requestHTML(view) {
    if (!view) return '';
    return `<div class="request-box" data-request><div class="request-head"><span class="tiny-label">${escapeHTML(view.heading.toUpperCase())}</span><span class="request-caption" data-request-caption>${escapeHTML(view.caption)}${view.newLines ? ` ${plural(view.newLines, 'new line')}.` : ''}</span></div><pre class="request-text" tabindex="0" aria-label="Text sent to the model"><span class="request-part">${segmentsHTML(view.instructions)}</span>\n\n<span class="request-task-label">TASK</span>\n<span class="request-part">${segmentsHTML(view.task)}</span></pre></div>`;
  }
  function phoneHTML(phone) {
    const screen = phone.live
      ? `<iframe title="${escapeHTML(phone.label)} phone (live)" sandbox="allow-scripts allow-same-origin allow-forms" src="${escapeHTML(phone.src)}"></iframe>`
      : phone.src ? `<img class="phone-screen" alt="${escapeHTML(phone.label)} phone, recorded screenshot" src="${escapeHTML(phone.src)}">` : `<div class="phone-missing">${escapeHTML(phone.missingText || NOT_RECORDED)}</div>`;
    return `<section class="phone-column builder-phone${phone.role.startsWith('production') ? ' production' : ''}" data-phone="${escapeHTML(phone.role)}" data-live="${phone.live}"><div class="phone-caption"><span class="phone-label">${escapeHTML(phone.label)}</span>${phone.banner ? `<span class="production-banner" data-state="${escapeHTML(phone.banner.state)}">${escapeHTML(phone.banner.text)}</span>` : `<span class="phone-caption-text">${escapeHTML(phone.caption || '')}</span>`}<span class="phone-source">${phone.live ? 'Live copy on this server' : phone.src ? 'Recorded screenshot' : ''}</span></div><div class="phone-slot"><div class="phone-shell"><div class="phone-top"><span>9:41</span><div class="dynamic-island"></div><span></span></div>${screen}<div class="phone-home"><span></span></div></div></div></section>`;
  }

  // ---- Live state (page memory only; never written to the recording) ----
  const slotKey = slot => slot || 'main';
  const isActive = state => !!state && ['starting', 'running', 'evaluating'].includes(state.phase);
  const anyActive = () => Object.values(live).some(isActive);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function api(route, body) {
    const options = body === undefined ? { cache: 'no-store' } : { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Harness-Client': 'local' }, body: JSON.stringify(body) };
    const response = await fetch(route, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }
  // The recording the panels render: recorded runs with every live run merged in.
  function viewRecording() {
    let view = recording;
    for (const [id, state] of Object.entries(live)) {
      const stepId = Number(id);
      if (stepId === 0) { if (state.record) view = mergeLiveRun(view, 0, null, state.record); continue; }
      for (const [key, run] of Object.entries(state.slots)) view = mergeLiveRun(view, stepId, key === 'main' ? null : key, run && stepId === 7 && state.changes ? { ...run, changes: state.changes } : run);
    }
    return view;
  }
  const slotLabel = key => ({ withoutMemory: 'Without memory', withMemory: 'With memory' }[key] || null);
  function liveHint(stepId) {
    if (stepId === 0) return 'Sends one real, billable request to the configured model, with no tools.';
    if (stepId === 6) return 'Starts two real runs, one after the other: without memory, then with memory. Each is cut off right after its first file edit. Billable model calls, up to 24 per run.';
    return 'Starts a fresh run with exactly this step\'s harness. Billable model calls, up to 24.';
  }
  function statusLines(stepId, state) {
    if (!state) return [];
    if (stepId === 0) {
      if (state.phase === 'starting') return [`Sending one request to the model · waiting ${Math.max(0, Math.round((Date.now() - state.clientStartedAt) / 1000))} s`];
      return state.record ? [liveStatusLine(state.record).text] : [];
    }
    if (state.phase === 'starting') return ['Creating a fresh workspace and starting the run…'];
    return Object.entries(state.slots).map(([key, run]) => {
      const label = slotLabel(key);
      const text = run ? liveStatusLine(run).text : PENDING_TEXT;
      return [key, `${label ? `${label}: ` : ''}${text}`];
    });
  }
  function liveBarHTML(stepId) {
    if (!providerState) return '';
    if (!providerState.configured) {
      const reason = providerState.error ? `The server state could not be read (${providerState.error}).` : 'No model connection is configured on this server.';
      return `<p class="live-unavailable" data-live-unavailable>${svg('info')}<span>Live runs are off. ${escapeHTML(reason)} Connect a model in the dashboard and reload this page to run a step live. Until then each step shows its recorded run.</span></p>`;
    }
    const state = live[stepId];
    const active = isActive(state);
    const lines = statusLines(stepId, state).map(line => Array.isArray(line) ? line : ['main', line]);
    const errors = [state?.error, state?.pollError].filter(Boolean);
    return `<div class="live-bar" data-live-bar><div class="live-row"><button class="button button-primary" type="button" data-action="run-live" data-step="${stepId}"${active ? ' disabled' : ''}>${svg('play')}<span>Run this step live</span></button><span class="live-hint">${escapeHTML(liveHint(stepId))}</span></div>${lines.map(([key, line]) => `<p class="live-status" data-live-status="${escapeHTML(key)}"><span class="live-dot${active ? ' on' : ''}" aria-hidden="true"></span>${escapeHTML(line)}</p>`).join('')}${errors.map(error => `<p class="live-error" data-live-error role="alert">${escapeHTML(error)}</p>`).join('')}</div>`;
  }
  // Presenter evaluation of a live run: both tiers, labelled as your action.
  function evaluationHTML(state, key, run) {
    const evaluation = state?.evaluation?.[key];
    const result = presenterEvaluation(run);
    const label = `<span class="tiny-label">YOUR EVALUATION${slotLabel(key) ? ` · ${slotLabel(key).toUpperCase()}` : ''} · PRESENTER ACTION, NOT THE MODEL</span>`;
    let body;
    if (evaluation?.state === 'error') body = `<p class="live-error" role="alert">${escapeHTML(evaluation.error)}</p>`;
    else if (evaluation?.state === 'running') body = '<p class="builder-empty">Running the independent browser checks on this run\'s sandbox…</p>';
    else if (result && evaluation?.state === 'done') {
      const tier = (title, data) => data ? `<div class="eval-tier"><strong>${escapeHTML(title)}: ${data.passed}/${data.total} passed</strong><ul class="eval-results">${data.results.map(item => `<li data-passed="${item.passed}"><span>${item.passed ? 'PASS' : 'FAIL'}</span> ${escapeHTML(item.name)}</li>`).join('')}</ul></div>` : `<div class="eval-tier"><strong>${escapeHTML(title)}: not measured</strong></div>`;
      body = `<p class="eval-intro">You ran the checks after the run stopped, on source revision ${escapeHTML(result.revision || 'unknown')}. This did not change what the agent did.</p><div class="eval-tiers">${tier('Checks the agent can run', result.visible)}${tier('Held-out checks, never shown to the agent', result.heldOut)}</div>`;
    } else body = '<p class="builder-empty">Runs when the run stops.</p>';
    return `<div class="proof-block presenter-eval" data-evaluation="${escapeHTML(key)}" data-state="${escapeHTML(evaluation?.state || 'waiting')}">${label}${body}</div>`;
  }
  function probeHTML(state, run) {
    const probe = probeResult(run);
    const busy = state.probe?.state === 'running' || isActive(state);
    let result = '';
    if (probe) result = `<p class="probe-result" data-probe-result="${probe.rejected ? 'rejected' : 'not-rejected'}"><strong>${probe.rejected ? 'Rejected.' : 'Not rejected.'}</strong> The harness answered: ${escapeHTML(probe.rejected ? probe.error : JSON.stringify(probe.result))}</p>`;
    if (state.probe?.state === 'error') result += `<p class="live-error" role="alert">${escapeHTML(state.probe.error)}</p>`;
    return `<div class="proof-block live-action" data-probe><span class="tiny-label">YOUR ACTION, NOT THE MODEL'S</span><p class="eval-intro">Ask the harness to write <code>../protected-checks.mjs</code>, a file outside this run's sandbox.</p><button class="button button-secondary" type="button" data-action="probe"${busy ? ' disabled' : ''}>${svg('shield')}<span>Test the sandbox boundary</span></button>${result}</div>`;
  }
  function approvalHTML(state, run) {
    const busy = state.approval?.state === 'running' || isActive(state);
    const waiting = run.status === 'awaiting_approval';
    const intro = waiting ? 'The agent stopped. Production waits for you: read the change, then decide.' : run.appliedRevision ? `You approved it. Production was updated at ${time(run.appliedAt)}.` : `Status: ${statusLabel(run.status)}. Nothing is waiting for approval.`;
    const error = state.approval?.state === 'error' ? `<p class="live-error" role="alert">${escapeHTML(state.approval.error)}</p>` : '';
    const buttons = `<div class="live-actions"><button class="button button-secondary" type="button" data-action="view-diff" data-run="${escapeHTML(run.id)}">${svg('code')}<span>View diff</span></button>${waiting ? `<button class="button button-primary" type="button" data-action="approve"${busy ? ' disabled' : ''}>${svg('checkCircle')}<span>Approve and publish</span></button>` : ''}</div>`;
    return `<div class="proof-block live-action" data-approval data-status="${escapeHTML(run.status)}"><span class="tiny-label">YOUR DECISION, NOT THE MODEL'S</span><p class="eval-intro">${escapeHTML(intro)}</p>${waiting || run.appliedRevision ? buttons : ''}${error}</div>`;
  }

  function renderDiagram(stepId) {
    $('#diagram').innerHTML = diagramState(stepId).map(card => `<div class="anatomy-card ${card.enabled ? 'enabled' : 'limited'}${card.current ? ' highlight' : ''}" data-component="${card.id}" data-enabled="${card.enabled}" data-current="${card.current}"><span class="anatomy-card-top"><span>${card.number}</span>${svg(card.icon)}<span class="component-mark">${card.enabled ? '✓' : '—'}</span></span><strong>${escapeHTML(card.name)}</strong><span class="anatomy-badge">${escapeHTML(card.badge)}</span>${card.current ? '<span class="component-state">Added now</span>' : ''}</div>`).join('');
  }
  function renderCode(step) {
    const code = step.code;
    if (!code) { $('#code').innerHTML = '<figcaption>No code is added at this step.</figcaption>'; return; }
    $('#code').innerHTML = `<figcaption><strong>${escapeHTML(code.file)}</strong> · ${escapeHTML(code.caption)}</figcaption><pre><code>${code.parts.map(part => part.map(escapeHTML).join('\n')).join('\n<span class="code-gap">⋯</span>\n')}</code></pre>`;
  }
  function renderLive(step) {
    const html = liveBarHTML(step.id);
    if (html === shown.live) return;
    shown.live = html;
    $('#live').innerHTML = html;
  }
  function proofHTML(step, view) {
    const summary = proofSummary(step.id, view);
    const intro = `<p class="proof-look">${escapeHTML(stepLook(step.id, view))}</p>`;
    if (!summary.recorded) return { html: intro + notRecorded(loadState === 'missing' ? 'No builder recording was found on this server. Record one with scripts/record-builder.mjs.' : loadState === 'error' ? 'The builder recording could not be loaded.' : undefined), view: null };
    const request = requestView(view, step.id);
    const highlights = `<ul class="proof-highlights">${summary.highlights.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`;
    const state = live[step.id];
    let activity;
    if (step.id === 0) {
      // The whole reply, verbatim and scrollable: it can be long, and it is the point of this step.
      const record = stepEntry(view, 0);
      activity = `<div class="proof-block"><span class="tiny-label">THE REPLY</span>${activityHTML(shortReply(modelOnlyActivity(record)))}<pre class="handoff-text reply-text" tabindex="0" data-reply aria-label="The model's full reply">${escapeHTML(record.text)}</pre></div>`;
    }
    else if (step.id === 6) {
      const entry = stepEntry(view, 6);
      const column = (slot, label) => {
        const item = entry[slot];
        const body = item?.live?.pending ? pendingBlock() : item?.run ? activityHTML(activityExcerpt(item.run, 6)) : notRecorded(`The ${label.toLowerCase()} run is not recorded.`);
        const evaluation = item?.live && item.run ? evaluationHTML(state, slot, item.run) : '';
        return `<div class="proof-column" data-slot="${slot}"><span class="tiny-label">${escapeHTML(label.toUpperCase())}</span>${body}${evaluation}${footerHTML(summary.footers.find(f => f.slot === slot))}</div>`;
      };
      const handoff = handoffText(view);
      activity = `<div class="proof-columns">${column('withoutMemory', 'Without memory')}${column('withMemory', 'With memory')}</div><div class="proof-block handoff" data-handoff><span class="tiny-label">THE HANDOFF THE FRESH SESSION RECEIVED (WITH MEMORY)</span>${handoff ? `<pre class="handoff-text" tabindex="0">${escapeHTML(handoff.text)}</pre>` : `<p class="builder-empty">${entry.withMemory?.live ? 'Not received yet.' : NOT_RECORDED}</p>`}</div>`;
    } else {
      const entry = stepEntry(view, step.id);
      const run = entry.run;
      activity = `<div class="proof-block"><span class="tiny-label">WHAT HAPPENED</span>${activityHTML(activityExcerpt(run, step.id), entry.live ? 'Nothing has happened yet.' : undefined)}</div>`;
      if (entry.live) {
        activity += evaluationHTML(state, 'main', run);
        if (step.id === 2 && !isActiveRun(run) && state?.phase === 'done') activity += probeHTML(state, run);
        if (step.id === 7 && !isActiveRun(run) && (run.status === 'awaiting_approval' || run.appliedRevision) && state?.phase === 'done') activity += approvalHTML(state, run);
      }
      if (step.id === 7) {
        const changes = changeSummary(run);
        activity += `<div class="proof-block" data-changes><span class="tiny-label">${run.appliedRevision ? 'WHAT THE PERSON APPROVED' : 'WHAT IS WAITING FOR APPROVAL'}</span>${changes.length ? `<ul class="change-list">${changes.map(c => `<li><strong>${escapeHTML(c.file)}</strong> ${c.before} lines before, ${c.after} lines after</li>`).join('')}</ul>` : `<p class="builder-empty">${entry.live && isActiveRun(run) ? 'Shown when the agent stops.' : 'No file changes recorded.'}</p>`}</div>`;
      }
    }
    const footers = step.id === 6 ? '' : summary.footers.map(footerHTML).join('');
    return { html: intro + highlights + requestHTML(request) + activity + footers, view: request };
  }
  function renderProof(step) {
    const proof = $('#proof');
    const view = viewRecording();
    const { html, view: request } = proofHTML(step, view);
    if (html === shown.proof) return;
    // A live update that leaves the request unchanged keeps the reader's scroll
    // positions; a new step or a new request scrolls to its highlight.
    const oldRequest = shown.step === step.id ? proof.querySelector('.request-text')?.innerHTML ?? null : null;
    const kept = [...proof.querySelectorAll('pre[tabindex]')].map(pre => pre.scrollTop);
    shown.proof = html;
    proof.innerHTML = html;
    if (oldRequest !== null && proof.querySelector('.request-text')?.innerHTML === oldRequest) { [...proof.querySelectorAll('pre[tabindex]')].forEach((pre, i) => { if (kept[i] != null) pre.scrollTop = kept[i]; }); return; }
    // The request box is the marks' offset parent (position: relative).
    const marks = [...proof.querySelectorAll('.request-text .req-new')];
    const mark = (request?.focus && marks.find(item => item.textContent.includes(request.focus))) || marks[0];
    if (mark) $('.request-text', proof).scrollTop = Math.max(0, mark.offsetTop - 24);
  }
  function renderPhones(step) {
    const target = $('#phones');
    const view = viewRecording();
    let html;
    if (!isRecorded(view, step.id) && step.id !== 0) html = `<div class="section-heading"><div><span class="panel-kicker">THE TWO PHONES</span><h2>Sandbox and production</h2></div></div>${notRecorded('No phones without a recorded run.')}`;
    else {
      const views = phoneViews(step.id, view, previewOrigin, time);
      const liveRun = views.groups.some(g => g.liveRun);
      const badge = liveRun ? 'Live run on this server' : views.groups.some(g => g.phones.some(p => p.live)) ? 'Live copies of recorded runs' : 'Recorded screenshots';
      const heading = `<div class="section-heading"><div><span class="panel-kicker">THE TWO PHONES</span><h2>Sandbox and production</h2></div><span class="subtle-badge">${badge}</span></div>`;
      if (views.note) html = `${heading}<p class="phones-note">${escapeHTML(views.note)}</p>`;
      else html = heading + `<div class="phone-groups">${views.groups.map(group => `<div class="phone-group">${group.label ? `<span class="tiny-label">${escapeHTML(group.label.toUpperCase())}</span>` : ''}${group.pending ? pendingBlock() : group.missing ? notRecorded('This run is not recorded.') : `<div class="phone-row">${group.phones.map(phoneHTML).join('')}</div>`}</div>`).join('')}</div>`;
    }
    // Unchanged phones are left alone, so a live iframe reloads only when its source revision changes.
    if (html === shown.phones) return;
    shown.phones = html;
    target.innerHTML = html;
    watchScreens();
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
  function renderBadge() {
    const badge = $('#mode-badge');
    const active = anyActive();
    const shownLive = Object.values(live).some(state => state.record || Object.keys(state.slots).length);
    badge.dataset.mode = active ? 'live' : shownLive ? 'mixed' : 'recorded';
    $('#mode-text').textContent = active ? 'LIVE RUN IN PROGRESS' : shownLive ? 'RECORDED AND LIVE RUNS' : 'RECORDED RUNS · NOT LIVE';
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
    if (shown.step !== step.id) shown = { step: null, live: '', proof: '', phones: '' };
    renderDiagram(step.id);
    renderCode(step);
    renderLive(step);
    renderProof(step);
    renderPhones(step);
    shown.step = step.id;
    renderBadge();
    $('#back').disabled = step.id === 0;
    $('#next').disabled = step.id === 7;
    const notice = $('#recording-notice');
    notice.hidden = loadState === 'ready';
    notice.textContent = loadState === 'loading' ? 'Loading the recording…' : loadState === 'missing' ? 'No builder recording was found on this server. Each step still shows its problem and its component; the proof panel says "Not recorded yet".' : loadState === 'error' ? 'The builder recording could not be loaded. The proof panels say "Not recorded yet".' : '';
  }
  // Called after every live change: the badge always, the panels when that step is on screen.
  function update(stepId) {
    renderBadge();
    if (stepId !== current) return;
    const step = STEPS[current];
    renderLive(step);
    renderProof(step);
    renderPhones(step);
  }

  // ---- Live actions ----
  async function startLive(stepId) {
    const previous = live[stepId];
    if (isActive(previous) || !providerState?.configured) return;
    const config = liveStepConfig(stepId);
    // Until the new run has started, the step keeps showing what it showed before.
    const state = { phase: 'starting', slots: previous?.slots || {}, record: previous?.record || null, error: null, pollError: null, evaluation: previous?.evaluation || {}, probe: previous?.probe || {}, approval: previous?.approval || {}, changes: previous?.changes || null, clientStartedAt: Date.now() };
    live[stepId] = state;
    update(stepId);
    // A failed create or start keeps the recorded run (or the earlier live run) and shows the server's message.
    const fail = message => {
      if (live[stepId] !== state) return;
      if (previous) { Object.assign(previous, { error: message, pollError: null }); live[stepId] = previous; }
      else live[stepId] = { phase: 'error', slots: {}, record: null, error: message, pollError: null, evaluation: {}, probe: {}, approval: {}, changes: null };
      update(stepId);
    };
    if (config.modelOnly) {
      try {
        const record = await api(config.endpoint, config.body);
        if (live[stepId] !== state) return;
        Object.assign(state, { record, phase: 'done' });
        update(stepId);
      } catch (error) { fail(error.message); }
      return;
    }
    let first = true;
    for (const item of config.runs) {
      const key = slotKey(item.slot);
      let run;
      try {
        const created = await api(config.endpoint, item.body);
        run = await api(`/api/runs/${created.id}/start`, {});
      } catch (error) {
        if (first) { fail(error.message); return; }
        // The first step 6 run stays on screen; the second did not start.
        state.phase = 'error';
        state.error = `${slotLabel(key) || 'Run'}: ${error.message}`;
        update(stepId);
        return;
      }
      if (live[stepId] !== state) return;
      if (first) {
        state.slots = Object.fromEntries(config.runs.map(other => [slotKey(other.slot), null]));
        Object.assign(state, { evaluation: {}, probe: {}, approval: {}, changes: null });
        first = false;
      }
      state.slots[key] = run;
      state.phase = 'running';
      update(stepId);
      if (!await followRun(stepId, state, key, run.id)) return;
      await evaluateLive(stepId, state, key, run.id);
      if (live[stepId] !== state) return;
    }
    state.phase = 'done';
    update(stepId);
  }
  // Polls GET /api/runs/:id every 1.5 s until the run has stopped. Returns false
  // when a newer live run replaced this one. A pause from elsewhere shows "Paused"
  // and keeps following the run, in case it is resumed.
  async function followRun(stepId, state, key, id) {
    while (live[stepId] === state) {
      await wait(POLL_MS);
      if (live[stepId] !== state) return false;
      let run;
      try { run = await api(`/api/runs/${id}`); state.pollError = null; }
      catch (error) { state.pollError = `Could not read run ${shortId(id)}: ${error.message}. Reading it again in ${POLL_MS / 1000} s.`; update(stepId); continue; }
      state.slots[key] = run;
      const paused = ['paused', 'interrupted'].includes(run.status) && !isActiveRun(run);
      state.phase = paused ? 'paused' : 'running';
      if (stepId === 7 && !isActiveRun(run) && ['awaiting_approval', 'completed'].includes(run.status)) {
        try { state.changes = (await api(`/api/runs/${id}/diff`)).changes || []; }
        catch (error) { state.pollError = `Could not read the change: ${error.message}`; }
      }
      update(stepId);
      if (!isActiveRun(run) && !paused && run.status !== 'ready') return true;
    }
    return false;
  }
  // Presenter evaluation after the run stops, with the same bounded retry as
  // scripts/evaluation-client.mjs evaluateStoppedRun: only the exact busy
  // conflict is retried (terminal status can precede the runner lock release).
  async function evaluateLive(stepId, state, key, id, attempts = 40) {
    state.phase = 'evaluating';
    state.evaluation[key] = { state: 'running' };
    update(stepId);
    const done = result => { if (live[stepId] === state) { state.evaluation[key] = result; update(stepId); } };
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (live[stepId] !== state) return;
      let run;
      try { run = await api(`/api/runs/${id}`); }
      catch (error) { done({ state: 'error', error: error.message }); return; }
      state.slots[key] = run;
      if (!isActiveRun(run)) {
        try { state.slots[key] = await api(`/api/runs/${id}/checks`, {}); done({ state: 'done' }); return; }
        catch (error) { if (error.message !== BUSY_MESSAGE) { done({ state: 'error', error: error.message }); return; } }
      }
      if (attempt + 1 < attempts) await wait(250);
    }
    done({ state: 'error', error: `Run ${id} has not released its operation lock; evaluation was not completed.` });
  }
  async function probeLive() {
    const state = live[2];
    const run = state?.slots?.main;
    if (!run || state.probe?.state === 'running') return;
    state.probe = { state: 'running' };
    update(2);
    try { state.slots.main = await api(`/api/runs/${run.id}/probe`, {}); state.probe = { state: 'done' }; }
    catch (error) { state.probe = { state: 'error', error: error.message }; }
    update(2);
  }
  async function approveLive() {
    const state = live[7];
    const run = state?.slots?.main;
    if (!run || state.approval?.state === 'running') return;
    state.approval = { state: 'running' };
    update(7);
    try { state.slots.main = await api(`/api/runs/${run.id}/approve`, {}); state.approval = { state: 'done' }; }
    catch (error) { state.approval = { state: 'error', error: error.message }; }
    update(7);
  }

  // ---- Dialog (diff and approval), the dashboard's styles ----
  let modalOpener = null, modalVersion = 0;
  function openModal(title, kicker, body) {
    modalVersion++;
    modalOpener = document.activeElement;
    $('#modal-title').textContent = title;
    $('#modal-kicker').textContent = kicker;
    $('#modal-body').innerHTML = body;
    if (!$('#modal').open) $('#modal').showModal();
    $('#modal').scrollTop = 0;
  }
  function closeModal() { if ($('#modal').open) $('#modal').close(); modalVersion++; if (modalOpener instanceof HTMLElement && modalOpener.isConnected) modalOpener.focus(); }
  async function showDiff(runId) {
    const run = live[7]?.slots?.main;
    openModal('Inspect the proposed change.', 'SOURCE BEFORE & AFTER', '<p class="empty-dialog">Loading the actual source diff…</p>');
    const version = modalVersion;
    try {
      const result = await api(`/api/runs/${encodeURIComponent(runId)}/diff`);
      if (version !== modalVersion) return;
      $('#modal-body').innerHTML = (result.changes?.length ? `<p class="dialog-description">Actual source snapshots for run ${escapeHTML(shortId(runId))}. Publication requires your approval. Passing checks on the current revision are required.</p>${result.changes.map(change => `<section class="diff-file"><h3>${escapeHTML(change.file)}</h3><div class="diff-panels"><div class="diff-panel before"><span>BEFORE</span><pre>${escapeHTML(change.before)}</pre></div><div class="diff-panel"><span>AFTER</span><pre>${escapeHTML(change.after)}</pre></div></div></section>`).join('')}` : '<p class="empty-dialog">No source changes have been recorded in this workspace.</p>')
        + `<div class="dialog-actions"><button class="button button-secondary" type="button" data-close-modal>Close</button>${run?.id === runId && run.status === 'awaiting_approval' ? `<button class="button button-primary" type="button" data-action="approve">${svg('checkCircle')}<span>Approve and publish</span></button>` : ''}</div>`;
    } catch (error) { if (version === modalVersion) $('#modal-body').innerHTML = `<p class="empty-dialog danger-label">${escapeHTML(error.message)}</p>`; }
  }
  function showApprove() {
    const run = live[7]?.slots?.main;
    if (!run || run.status !== 'awaiting_approval') return;
    const checks = run.checks ? `${run.checks.passed}/${run.checks.total} browser checks passed on revision ${run.checks.revision}.` : 'No browser evaluation recorded.';
    openModal('Publish this change?', 'YOUR APPROVAL', `<p>Approve revision <strong>${escapeHTML(run.pendingRevision || 'unknown')}</strong> from run <strong>${escapeHTML(shortId(run.id))}</strong>. The server confirms the source still matches the proposal and the checks pass, then updates this run's production copy. This is your decision, not the model's.</p><div class="dialog-callout">${svg('checkCircle')}<span>${escapeHTML(checks)} Read the diff before you approve.</span></div><div class="dialog-actions"><button class="button button-secondary" type="button" data-action="view-diff" data-run="${escapeHTML(run.id)}">${svg('code')}<span>View diff</span></button><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="button" id="confirm-approve">${svg('checkCircle')}<span>Approve and publish</span></button></div>`);
  }

  function go(stepId) {
    const next = Math.max(0, Math.min(7, stepId));
    if (location.hash !== `#step-${next}`) location.hash = `#step-${next}`;
    else if (next !== current) { current = next; render(); }
  }
  window.addEventListener('hashchange', () => { current = parseStep(location.hash); render(); window.scrollTo(0, 0); });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if ($('#modal').open) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(current + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(current - 1); }
  });
  $('#back').addEventListener('click', () => go(current - 1));
  $('#next').addEventListener('click', () => go(current + 1));
  // One delegated handler for the live buttons (no inline handlers: the CSP forbids them).
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#modal-close, [data-close-modal]')) { closeModal(); return; }
    if (target.closest('#confirm-approve')) { closeModal(); approveLive(); return; }
    const button = target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'run-live') startLive(Number(button.dataset.step));
    else if (action === 'probe') probeLive();
    else if (action === 'view-diff') showDiff(button.dataset.run);
    else if (action === 'approve') showApprove();
  });
  $('#modal').addEventListener('close', () => { modalVersion++; });
  // While a step-0 request is waiting, its status line counts the seconds.
  setInterval(() => { if (anyActive()) renderLive(STEPS[current]); }, 1000);
  current = parseStep(location.hash);
  render();
  (async () => {
    try {
      const response = await fetch('/api/builder', { cache: 'no-store' });
      if (response.status === 404) loadState = 'missing';
      else if (!response.ok) throw new Error(`HTTP ${response.status}`);
      else { recording = await response.json(); loadState = 'ready'; }
    } catch { loadState = 'error'; recording = null; }
    // The server state says whether live runs are possible and where the phones live.
    try {
      const state = await api('/api/state');
      previewOrigin = state.previewOrigin || null;
      providerState = { configured: !!state.provider?.configured, error: null };
    } catch (error) { previewOrigin = null; providerState = { configured: false, error: error.message }; }
    render();
  })();
}
