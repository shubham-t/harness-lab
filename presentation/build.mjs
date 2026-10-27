// Editable deck authoring source for Agent-Harness-Workshop.pptx and speaker-notes.md.
// Rebuilt for harness v4 on 27 October 2026 with pptxgenjs. The earlier source needed the
// Codex artifact runtime and is kept in git history before this rebuild.
//
// Usage:  npm install --no-save pptxgenjs   (or set DECK_NODE_MODULES to a node_modules directory that has it)
//         node presentation/build.mjs [--out presentation/Agent-Harness-Workshop.pptx]
// The script writes the deck and regenerates speaker-notes.md from the notes below.
// Edit notes here; speaker-notes.md is generated output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const modules = process.env.DECK_NODE_MODULES;
const require = createRequire(modules ? path.join(path.resolve(modules), 'package.json') : import.meta.url);
let pptxgen;
try { pptxgen = require('pptxgenjs'); }
catch { console.error('pptxgenjs is not installed. Run `npm install --no-save pptxgenjs` in the repository, or set DECK_NODE_MODULES to a node_modules directory that contains it.'); process.exit(1); }
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : null).filter(Boolean));
const outFile = path.resolve(args.out || path.join(here, 'Agent-Harness-Workshop.pptx'));
const BUILD_DATE = '27 October 2026';

// Palette and geometry from the original deck: a 1280 x 720 px canvas, Arial throughout.
const C = { cream: 'F7F7F1', green: '174535', muted: '54685D', blue: '174B91', orange: 'E87924', gray: 'ECEEF1', white: 'FFFFFF', paleBlue: 'D9E7FA', amber: 'FFB454', border: 'D4DDD5', alt: 'EEF2EA' };
const px = v => Math.round((v / 96) * 10000) / 10000;
// Font sizes in this file are CSS pixels, as in the original deck source; PowerPoint wants points.
const pt = v => Math.round(v * 0.75 * 100) / 100;
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in = 1280 x 720 px at 96 dpi
pres.title = 'Agent harness & harness engineering';
pres.subject = 'Harness Lab workshop deck, rebuilt for harness v4';
pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
const slideNumber = color => ({ x: px(1160), y: px(675), w: px(54), h: px(23), fontFace: 'Arial', fontSize: pt(15), color });
pres.defineSlideMaster({ title: 'LIGHT', background: { color: C.cream }, slideNumber: slideNumber(C.muted), objects: [
  { placeholder: { options: { name: 'title', type: 'title', x: px(64), y: px(48), w: px(1152), h: px(100), fontFace: 'Arial', fontSize: pt(44), bold: true, color: C.green, valign: 'top', align: 'left' }, text: 'Title' } }
] });
pres.defineSlideMaster({ title: 'DARK', background: { color: C.blue }, slideNumber: slideNumber(C.paleBlue), objects: [
  { placeholder: { options: { name: 'title', type: 'title', x: px(64), y: px(48), w: px(1152), h: px(200), fontFace: 'Arial', fontSize: pt(64), bold: true, color: C.white, valign: 'top', align: 'left' }, text: 'Title' } }
] });
// Light titles must stay on one line above the content; long titles step down in size.
const titleSize = title => { const n = title.length; return n <= 46 ? 44 : n <= 52 ? 40 : 36; };

const notes = [];
let count = 0, currentSection = '';
function section(title) { currentSection = title; pres.addSection({ title }); }
function text(s, value, x, y, w, h, size = 27, color = C.green, bold = false, extra = {}) {
  s.addText(value, { x: px(x), y: px(y), w: px(w), h: px(h), fontFace: 'Arial', fontSize: pt(size), color, bold, valign: 'top', isTextBox: true, ...extra });
}
function page(title, bodyNotes, { dark = false, section: label = '', size } = {}) {
  const s = pres.addSlide({ masterName: dark ? 'DARK' : 'LIGHT', sectionTitle: currentSection });
  count += 1;
  s.addText(title, { placeholder: 'title', align: 'left', fontSize: pt(size || (dark ? 64 : titleSize(title))) });
  if (label) text(s, label.toUpperCase(), 66, 18, 1050, 25, 13, dark ? C.paleBlue : C.muted, true);
  s.addNotes(bodyNotes);
  notes.push({ slide: count, title, notes: bodyNotes });
  return s;
}
function rows(s, items, { top = 190, gap = 110, left = 70, width = 1100, size = 27, bodySize = 24, bodyHeight = 65, bodyColor = C.muted } = {}) {
  items.forEach(([label, body], i) => { text(s, label, left, top + i * gap, width, 36, size, C.blue, true); text(s, body, left, top + 40 + i * gap, width, bodyHeight, bodySize, bodyColor); });
}
function cap(s, value, x, y, w, h = 40, size = 14) { text(s, value, x, y, w, h, size, C.muted); }
function dims(file) { const b = fs.readFileSync(file); if (b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }
// Places a PNG from assets/ inside a box, preserving its aspect ratio. Returns the placed rectangle in px.
function picture(s, name, x, y, w, h, { crop, align = 'center', valign = 'middle', alt } = {}) {
  const file = path.join(here, 'assets', name);
  const { w: W, h: H } = dims(file);
  const l = crop?.left || 0, t = crop?.top || 0, r = crop?.right || 0, b = crop?.bottom || 0;
  const cw = W * (1 - l - r), ch = H * (1 - t - b);
  const scale = Math.min(w / cw, h / ch), vw = cw * scale, vh = ch * scale;
  const ox = align === 'left' ? 0 : (w - vw) / 2, oy = valign === 'top' ? 0 : (h - vh) / 2;
  const opts = { path: file, x: px(x + ox), y: px(y + oy), w: px(vw), h: px(vh), altText: alt || name.replace(/^v4\//, '').replace(/\.png$/, '').replaceAll('-', ' ') };
  if (crop) { const Sw = vw / (1 - l - r), Sh = vh / (1 - t - b); opts.w = px(Sw); opts.h = px(Sh); opts.sizing = { type: 'crop', x: px(l * Sw), y: px(t * Sh), w: px(vw), h: px(vh) }; }
  s.addImage(opts);
  return { x: x + ox, y: y + oy, w: vw, h: vh };
}
function table(s, values, { x = 65, y = 182, w = 1150, h = 390, widths, size = 23 } = {}) {
  const colW = (widths || values[0].map(() => w / values[0].length)).map(px);
  const rowsOut = values.map((row, r) => row.map(cell => ({ text: cell, options: { fill: { color: r === 0 ? C.blue : r % 2 ? C.white : C.alt }, color: r === 0 ? C.white : C.green, bold: r === 0, fontFace: 'Arial', fontSize: pt(size), valign: 'top', margin: 0.08 } })));
  s.addTable(rowsOut, { x: px(x), y: px(y), w: px(w), colW, rowH: px(h / values.length), border: { type: 'solid', pt: 0.75, color: C.border } });
}

const ref = 'Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab.';
const live = 'Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark.';
const v3 = 'Historical v3 evidence: live-validation/v3/comparison-fallback-before-approval.png, fallback-matrix.json and the exported runs e25d301f-60f1-46a2-aadf-93f595e3221c and 0b75acc7-f595-4277-a1ce-082f685acff0. Actual OpenRouter calls on 26 October 2026 with cohere/north-mini-code:free. Same Draft task, starting fixture and shared budgets. These are two individual trials, not a reliability benchmark.';
const v4 = 'Recorded v4 evidence: live-validation/v4/RESULTS.md and the exported traces in live-validation/v4/runs. Actual OpenRouter Chat Completions calls on 26 October 2026 with cohere/north-mini-code:free, harness v4, check suite notes-v3, one trial per rung and scenario. The screenshots were taken from the recorded runs in the dashboard on 27 October 2026 (presentation/assets/v4, manifest.json lists each file); times inside them are local to the laptop (Asia/Calcutta). Individual trials, not a reliability benchmark. Do not pool them with v2 or v3.';
const v4label = 'Recorded v4 ladder / 26 October 2026 · dashboard screenshots 27 October 2026';
const v2label = 'Historical · recorded v2 rehearsal / 25 October 2026';
const v3label = 'Historical · recorded v3 rehearsal / 26 October 2026';

// ---------------------------------------------------------------- Concepts (1 to 20)
section('Concepts');
let s = page('Agent harness &\nharness engineering', 'Welcome. This session is for engineers, architects and leaders who work on mobile applications. The objective is to understand why a production agent needs more than a capable model and a prompt. We will use a real model fixing a real Notes app, then inspect what the harness adds. No company-internal data or model claims are involved. ' + ref, { dark: true });
text(s, 'Building reliable coding workflows', 68, 290, 1000, 70, 36, C.white); text(s, 'Concepts, a live bug fix, and evidence from rehearsal', 70, 390, 1040, 75, 25, C.paleBlue); text(s, 'HARNESS LAB', 70, 615, 1000, 28, 18, C.amber, true);

s = page('The session', 'Spend 5 minutes on the problem, 20 on concepts, 20 on the live demonstration, 10 on results and discussion, and keep 5 minutes for questions or a slow provider. Some concept slides can be covered quickly for an experienced audience. The optional memory demonstration can use recorded evidence if time is short.');
rows(s, [['25 minutes  /  Concepts', 'What a harness contains and how teams improve it'], ['20 minutes  /  Live bug fix', 'The same Notes app and model under two configurations'], ['15 minutes  /  Evidence and discussion', 'Actual outcomes, limits, team practices and questions']], { gap: 135 });

s = page('Harness and harness engineering', ref + ' Source slides 2 and 3. A harness is the working software around the model. Harness engineering is the discipline of designing and improving it. Teams can build a small harness or configure an existing coding agent. Avoid treating these as interchangeable nouns.');
text(s, 'Agent harness', 70, 198, 520, 48, 34, C.blue, true); text(s, 'The software around the model that lets it act, retain state and check work.', 70, 265, 510, 170, 31);
text(s, 'Harness engineering', 680, 198, 530, 48, 34, C.blue, true); text(s, 'The work of designing, testing and improving that software for real tasks.', 680, 265, 510, 170, 31); text(s, 'One is the system. The other is the engineering practice.', 70, 555, 1100, 60, 28, C.muted);

s = page('Model and harness', ref + ' Source slides 3 and 4. The model proposes language and tool requests. Runtime code executes actions, manages state and enforces boundaries. A model API alone does not execute a local file write or persist a task handoff. Providers may offer stateful features, but some external system still manages that state.');
text(s, 'Model', 70, 198, 490, 60, 42, C.blue, true); text(s, 'Interprets the task\nProposes the next action\nGenerates code and explanations', 70, 290, 500, 220, 31);
text(s, 'Harness', 680, 198, 490, 60, 42, C.blue, true); text(s, 'Executes the tools\nSupplies context and saved state\nEnforces checks and approvals', 680, 290, 510, 220, 31); text(s, 'An agent combines both in a working loop.', 70, 585, 1110, 55, 30, C.muted);

s = page('Prompt, context and harness', ref + ' Source slide 5. These are useful scopes, not universally standardized product boundaries. Prompt engineering chooses wording. Context engineering chooses what information the model receives. Harness engineering includes the execution lifecycle around those inputs. A better prompt can help but cannot itself enforce a filesystem allowlist.');
rows(s, [['Prompt engineering', 'How should we phrase the task and rules?'], ['Context engineering', 'Which instructions, files, history and observations should be included?'], ['Harness engineering', 'How should the entire workflow execute, recover and verify?']], { gap: 135 });

s = page('Related terms', ref + ' Source slide 6. Terminology varies across vendors. Use these definitions consistently for this session rather than claiming a formal industry standard. An agent framework may implement much of a runtime; a team still chooses policies, integrations and checks.');
table(s, [['Term', 'Useful meaning'], ['Framework', 'A library of building blocks'], ['Runtime', 'The engine that executes and resumes steps'], ['Harness', 'The assembled system around a model'], ['Harness engineering', 'Designing and improving that assembled system']], { h: 370, widths: [360, 790], size: 26 });

s = page('Seven components in this demo', ref + ' Source slide 7, revised to match the agreed demo anatomy. Instructions & policies replaces Observability as a card; orchestration is outside the live example. Observability and orchestration remain important topics later. These seven are the presentation vocabulary, not a universal taxonomy.');
[['01', 'Agent loop'], ['02', 'Tools & sandbox'], ['03', 'Instructions & policies'], ['04', 'Context management'], ['05', 'Memory & state'], ['06', 'Guardrails'], ['07', 'Verification']].forEach(([n, label], i) => { const x = i < 4 ? 75 : 700, y = 185 + (i < 4 ? i : i - 4) * 105; text(s, n, x, y, 65, 46, 27, C.orange, true); text(s, label, x + 80, y, 460, 65, 31, C.green, true); });

s = page('The agent loop', ref + ' Source slide 8. The visible trace shows requests, tool actions and observations, not private model reasoning. A completion signal does not prove success. Shared call/token budgets and a pause mechanism stop unbounded activity. The model can request several tools, but this runtime executes them serially.');
rows(s, [['1   Request an action', 'Send the task, enabled project inputs and current observations.'], ['2   Execute and observe', 'Validate the tool call, run it and return the measured result.'], ['3   Continue or stop', 'Repeat until completion, a budget, a failure or a human interruption.']], { gap: 135 });

s = page('Tools & sandbox', ref + ' Source slide 9. In Harness Lab the model can list/read/write allowlisted source files and operate a real browser. It cannot edit protected checks or use an arbitrary shell. Browser preview and dashboard have separate origins. Both presets share this boundary. A local teaching sandbox is not a production service for hostile code.');
rows(s, [['Tools make actions possible', 'Files, browser operations and readable results'], ['Tool design affects the next decision', 'Clear schemas, narrow operations and useful errors'], ['The sandbox limits the action', 'Allowed paths, isolated copies and controlled browser access']], { gap: 135 });

s = page('Instructions & policies and context', ref + ' Expands source slides 5, 7 and 10. Both are model inputs and can be included together. Instructions & policies supplies project conventions; Context management supplies the repository map and current revision. The recorded request evidence shows exact payloads. Basic task/conversation context stays present in Minimal, and the model can read PROJECT.md manually. In harness v4, Context management also supplies the PN-142 ticket thread: knowledge from outside the repository that no tool can read.');
text(s, 'Instructions & policies', 70, 190, 530, 50, 32, C.blue, true); text(s, 'How to do the work', 70, 250, 510, 50, 29); text(s, 'Preserve existing notes.\nKeep user text literal.\nUse the storage module.', 70, 325, 510, 200, 28, C.muted);
text(s, 'Context management', 680, 190, 530, 50, 32, C.blue, true); text(s, 'Information for this task', 680, 250, 510, 50, 29); text(s, 'storage.js handles persistence.\napp.js handles interactions.\nThis is the current source revision.\nThe PN-142 ticket thread (v4).', 680, 325, 510, 200, 28, C.muted); text(s, 'Supplying a rule does not prove the model followed it.', 70, 580, 1120, 55, 28, C.orange, true);

s = page('Context beyond a project map', ref + ' Source slide 10. The reference describes compaction, offloading and just-in-time loading. Our demo only supplies a project map, revision and selected observations. It does not implement general retrieval, automatic summarization or production compaction. Keep that scope distinction explicit. Large context can waste tokens and hide useful details.');
rows(s, [['Load relevant information when needed', 'Retrieve the file or document for the current decision.'], ['Keep large outputs outside the prompt', 'Store artifacts and provide a useful summary or reference.'], ['Manage long conversations', 'Compact carefully and preserve evidence needed for the next step.']], { gap: 135 });

s = page('Memory & state', ref + ' Source slide 11. Distinguish persistent files from saved handoff and API conversation history. In both presets the edited source remains. Engineered saves observed checkpoints and can save model-written progress. A fresh session clears API history and includes supported memory. None of this guarantees the model will make the right next decision.');
table(s, [['State', 'Minimal', 'Engineered'], ['Working files', 'Remain', 'Remain'], ['Previous API conversation in a new session', 'Cleared', 'Cleared'], ['Saved progress supplied to the new session', 'Off', 'Enabled']], { h: 330, widths: [610, 270, 270], size: 25 }); text(s, 'Saved progress helps the next session understand what already happened.', 70, 575, 1110, 65, 28, C.muted);

s = page('Guardrails', ref + ' Source slide 12. Instructions ask; enforcement restricts. Both demo presets retain the file allowlist and execution budgets. This card represents the additional human approval gate. Minimal applies only to its isolated published demo copy, never a real production deployment. Tokens are reported by the provider; the runtime also reserves space conservatively before the next request.');
rows(s, [['Permissions constrain available actions', 'Use scoped tools, paths and credentials.'], ['Budgets bound continued execution', 'Stop excessive calls or token use and preserve evidence.'], ['Approval controls application of a patch', 'Require a human decision on the exact reviewed revision.']], { gap: 135 });

s = page('Verification', ref + ' Source slide 13. Tests, builds, type checks and linters provide executable evidence. LLM judges can add semantic review but require their own validation. Passing a finite suite is not universal correctness. In this demo checks are protected from agent edits and tied to a revision. Failure feedback can return to the model for another attempt. In harness v4 there are two tiers: six visible checks the agent can run, and five held-out checks only the presenter runs. A patch can pass every check it was shown and still fail one it was not.');
text(s, 'A completion claim needs evidence.', 70, 190, 1100, 80, 39, C.blue, true);
rows(s, [['Behavioral checks', 'Does the draft survive navigation and refresh? Does saving preserve text?'], ['Independent enforcement', 'A failing current revision cannot complete under Engineered.'], ['Two tiers in harness v4', 'Six visible checks the agent can run; five held-out checks only the presenter runs.']], { top: 300, gap: 108, size: 26 });

s = page('Guides and sensors', 'Adapted from Birgitta Böckeler, Harness engineering for coding agent users, 2 April 2026: https://martinfowler.com/articles/harness-engineering.html . Guides shape behavior before an action. Sensors inspect the result and can help the agent correct it. The computational/inferential distinction is separate from before/after. This table uses our own concise examples. ' + ref + ' Source slide 16.');
table(s, [['Control', 'Deterministic example', 'Model-based example'], ['Guide before action', 'Bootstrap script or allowed tool schema', 'Project instructions or a skill'], ['Sensor after action', 'Tests, type checks and linters', 'Rubric review or LLM judge']], { h: 310, widths: [300, 420, 430], size: 25 }); text(s, 'Useful feedback tells the agent what failed and what evidence to inspect.', 70, 560, 1120, 75, 29, C.muted);

s = page('Observability and orchestration', ref + ' Source slides 14 and 15. They remain part of the broader subject even though they are not toggled cards here. Traces make comparisons auditable; evals require repeated comparable tasks. Orchestration assigns responsibility and coordinates handoffs across agents. A single focused workflow often does not require multiple agents.');
text(s, 'Observability and evals', 70, 200, 535, 55, 33, C.blue, true); text(s, 'Record requests, tool results, checks and failures.\n\nCompare outcome, steps, tokens and time across repeated tasks.', 70, 280, 520, 255, 28);
text(s, 'Orchestration', 680, 200, 530, 55, 33, C.blue, true); text(s, 'Split work when roles or isolation help.\n\nUse clear ownership, handoffs and shared-state rules.', 680, 280, 510, 255, 28); text(s, 'This demo records both runs and uses one coding agent per run.', 70, 595, 1120, 55, 27, C.muted);

s = page('Harness engineering as a practice', ref + ' Source slide 17. Use actual failure evidence to identify the missing capability. A stronger system may require an input, a tool or an enforced check, not a longer prompt. Re-run representative evaluations and remove changes that add cost without improving the intended behavior.');
rows(s, [['Observe and diagnose', 'Read the trace and identify the missing information, action or check.'], ['Encode a durable change', 'Update a rule, tool, project document, test or runtime control.'], ['Measure and revise', 'Re-run comparable tasks and check quality, overhead and new failure modes.']], { gap: 135 });

s = page('Examples from engineering teams', 'Sources: Anthropic, Effective harnesses for long-running agents, 26 Nov 2025, https://www.anthropic.com/research/effective-harnesses-for-long-running-agents . OpenAI, Ryan Lopopolo, Harness engineering: leveraging Codex in an agent-first world, 11 Feb 2026, https://openai.com/index/harness-engineering/ . Both are reports by their authors, not controlled comparisons or guarantees for our organization. ' + ref + ' Source slides 18 and 19.');
text(s, 'Anthropic', 70, 192, 510, 50, 34, C.blue, true); text(s, 'An initializer prepares the environment. Coding sessions leave progress artifacts and Git history for the next session.', 70, 270, 510, 210, 29);
text(s, 'OpenAI', 680, 192, 510, 50, 34, C.blue, true); text(s, 'An internal project used repository documentation, enforced architecture and agent-accessible feedback to support coding work.', 680, 270, 510, 230, 29); text(s, 'Shared lesson: the working environment needs deliberate engineering.', 70, 580, 1110, 70, 28, C.muted);

s = page('Failures and useful controls', ref + ' Source slide 20. These are diagnostic hypotheses, not proof that every failure is caused by the harness. Model capability, provider availability and the task itself also matter. Start by checking the trace.');
table(s, [['Observed failure', 'Candidate control'], ['Repeated investigation after restart', 'Saved progress and revision evidence'], ['Completion with a broken behavior', 'Protected tests and a completion gate'], ['Too much irrelevant context', 'Selective loading and compact tool output'], ['Unwanted publication', 'Revision-bound approval'], ['Conflicting changes across agents', 'Ownership and handoff rules']], { h: 420, widths: [575, 575], size: 25 });

s = page('Design principles', ref + ' Source slide 21. These are practical guidelines rather than a promise of optimal design. Prefer the smallest system that covers observed failures. A deterministic check can also be wrong; the earlier Notes trial exposed a test gap around seed-note text, so check quality matters.');
rows(s, [['Start with a useful, small workflow', 'Add components in response to observed needs.'], ['Make knowledge and acceptance explicit', 'Keep project rules accessible and checks executable.'], ['Keep feedback actionable and review changes', 'Measure overhead and re-audit scaffolding as models improve.']], { gap: 135 });

// ---------------------------------------------------------------- Live demo, harness v4 (21 to 32)
section('Live demo · harness v4');
s = page('The disappearing draft and four traps', 'v4 demo flow. Image: the Backup screen of the starting app on the production phone of run d13b50fa (original build, nothing applied), captured from the recorded run on 27 October 2026. Use the live app. Pocket Notes now has three screens: Draft, My notes and Backup. On the SANDBOX phone, type a draft, switch to My notes and back, then refresh: the draft is gone both times. Open Backup: it lists saved notes as JSON and says unsaved drafts are never included. Before any model runs, name four ways a correct-looking patch is wrong. The backup leaks the draft. Existing users lose their notes after a storage change. Typed markup comes back as HTML. Test ids that QA automation uses disappear. These are held-out checks. No agent ever sees them. Each trap is a property real codebases have; nothing here tricks the model. ' + v4, { section: v4label });
text(s, 'Three screens: Draft, My notes and Backup.', 70, 150, 780, 45, 28, C.blue, true);
text(s, 'Type a draft, switch to My notes and back: it is gone. Refresh: gone again. Backup lists saved notes as JSON and says unsaved drafts are never included.', 70, 200, 780, 105, 26);
text(s, 'Four ways a correct-looking patch is wrong', 70, 318, 780, 40, 28, C.blue, true);
[['01', 'The backup leaks the draft'], ['02', 'Existing users lose their notes'], ['03', 'Restored text becomes markup'], ['04', 'Automation test ids disappear']].forEach(([n, label], i) => { text(s, n, 75, 365 + i * 58, 60, 40, 27, C.orange, true); text(s, label, 135, 365 + i * 58, 640, 40, 30, C.green, true); });
text(s, 'Four of the five held-out checks. No agent ever sees them.', 70, 600, 780, 40, 24, C.muted);
picture(s, 'v4/fixture-backup-production.png', 880, 150, 336, 450, { valign: 'top' });
cap(s, 'Starting app on the production phone of run d13b50fa (original build) · 26 Oct 2026 · dashboard screenshot 27 Oct 2026', 880, 606, 336, 60);

s = page('Minimal: two components and what it was told', 'Live step 1. Images: the anatomy board and the Minimal column of What each agent was told for run d13b50fa (Minimal, draft scenario, 26 October 2026). Create a fresh Minimal workspace with the same model and scenario you will use for Engineered. Blue means enabled, gray means off. Agent loop and Tools & sandbox are on. Every preset gets the same task text, starting files, tool schemas and budgets. Save a note on the PRODUCTION phone first, so you are an existing user. Start the run. Open Explain & compare and show what each agent was told. Minimal\'s column is short by nature: 1,102 characters of instructions and 331 of task in this run. It can read PROJECT.md with a tool if it decides to; d13b50fa did so on its first call. It cannot read the PN-142 ticket thread, which lives outside the workspace. In the recorded run Minimal produced a patch that passed 6/6 visible and 5/5 held-out checks, spent all 24 calls on manual browser actions and never requested completion. ' + v4, { section: v4label });
picture(s, 'v4/minimal-anatomy.png', 64, 150, 690, 200, { valign: 'top', align: 'left' });
text(s, 'Blue means enabled. Gray means off.', 70, 372, 690, 36, 28, C.blue, true);
text(s, 'Agent loop and Tools & sandbox are on. Same task text, starting files, tool schemas and budgets as Engineered.', 70, 412, 690, 70, 24);
text(s, 'Recorded outcome: Budget reached after 24 model calls. A patch that passed every check, never submitted. Nothing published.', 70, 492, 690, 80, 24, C.orange, true);
picture(s, 'v4/inputs-minimal-column.png', 790, 150, 426, 350, { valign: 'top', align: 'left' });
text(s, 'What the Minimal agent was told: 1,102 characters of instructions and 331 of task. It may read PROJECT.md with a tool. It cannot read the PN-142 ticket.', 790, 508, 426, 90, 18);
cap(s, 'Run d13b50fa · Minimal · draft scenario · 26 Oct 2026 · dashboard screenshots 27 Oct 2026', 70, 615, 1080, 30);

s = page('Production updates by itself', 'Live step 2. Images: the two phones of run d13b50fa (Minimal: Budget reached, production still on the original build) and of run d017cd57 (+Verification rung: applied automatically at 22:42:24 local time with no review), both draft scenario, 26 October 2026. Production shows the original build until something is published. If Minimal declares completion, its patch is published at once and the banner says it was updated automatically by the agent, with no review. No check was required and nobody approved it. In the recorded ladder no Minimal run completed, so the automatic-publication banner shown here comes from the +Verification rung, the first rung that finished; without the approval gate it also publishes by itself. Production here is the run\'s isolated published copy, not a real deployment. If Minimal does not complete, say so and show the status instead. ' + v4, { section: v4label });
picture(s, 'v4/minimal-phones.png', 64, 150, 392, 400, { valign: 'top', align: 'left' });
picture(s, 'v4/verification-phones.png', 470, 150, 392, 400, { valign: 'top', align: 'left' });
text(s, 'Minimal · d13b50fa', 70, 558, 392, 30, 19, C.blue, true); text(s, 'Budget reached. Nothing published. Production still runs the original build.', 70, 586, 392, 60, 17);
text(s, '+Verification · d017cd57', 476, 558, 392, 30, 19, C.blue, true); text(s, 'The first rung that finished. Published automatically. No review.', 476, 586, 392, 60, 17);
text(s, 'Nothing stands between completion and production.', 890, 150, 326, 120, 27, C.blue, true);
text(s, 'Without the approval gate, a completion request publishes at once. No check was required and nobody approved it.', 890, 282, 326, 155, 22);
text(s, 'In this ladder no Minimal run finished. The first run that did shipped straight to production.', 890, 445, 326, 155, 22, C.orange, true);
cap(s, 'Draft scenario · 26 Oct 2026 · dashboard screenshots 27 Oct 2026 · production is the run\'s isolated published copy', 890, 605, 326, 65);

s = page('Try the traps on production', 'Live step 3. Images: the production phone of run d017cd57 after presenter actions on 27 October 2026: a draft typed on production survived switching to My notes and back; Backup still listed 2 notes and no draft; the text <b>bold</b> & co came back literal with 16 characters. These are presenter actions on the published copy, not agent actions. On the production phone, check each trap by hand. Is the note you saved still listed after a refresh? Type a draft and open Backup: is the draft in the JSON? Type text with a bold tag and an ampersand, switch screens and back: is it still literal? Describe only what you see. The model may have handled every trap, as this one did. ' + v4, { section: v4label });
picture(s, 'v4/verification-production-draft-after-switch.png', 64, 150, 200, 430, { valign: 'top', align: 'left' });
picture(s, 'v4/verification-production-backup.png', 290, 150, 200, 430, { valign: 'top', align: 'left' });
picture(s, 'v4/verification-production-literal.png', 516, 150, 200, 430, { valign: 'top', align: 'left' });
text(s, '1 · Draft typed, screens switched: still there', 64, 588, 200, 60, 16, C.green, true); text(s, '2 · Backup: 2 notes, no draft in the JSON', 290, 588, 200, 60, 16, C.green, true); text(s, '3 · <b>bold</b> & co stays literal, 16 characters', 516, 588, 200, 60, 16, C.green, true);
text(s, 'Try the traps yourself on production.', 760, 150, 456, 80, 30, C.blue, true);
text(s, 'Is the note you saved still listed after a refresh?\n\nType a draft, open Backup: is it in the JSON?\n\nType <b>bold</b> & co, switch screens: still literal?', 760, 240, 456, 225, 22);
text(s, 'Describe only what you see. This model handled all three.', 760, 475, 456, 80, 23, C.orange, true);
cap(s, 'Presenter actions on the production copy of run d017cd57 (+Verification, draft, 26 Oct 2026) · screenshots 27 Oct 2026', 760, 565, 456, 60);

s = page('Claims versus evidence', 'Live step 4. Image: the claims panel of run d017cd57 (+Verification, draft, 26 October 2026). Open the panel titled What it claimed, what was observed. The left column is the agent\'s completion summary, word for word. The right column lists each behavior with what the agent exercised in the browser after its last edit, whether it ran acceptance checks, and the harness result. In this run the summary says the draft survives page refresh; the agent made no browser action after its last edit and instead ran the protected checks once, which passed. If a summary claims the refresh survives, look for a reload after the last edit or a run_checks. Claims are the model\'s words; observations are recorded tool actions. The panel does not interpret reasoning. This is observation the model did not make. The Minimal runs never requested completion, so their claims panel is empty. ' + v4, { section: v4label });
picture(s, 'v4/verification-claims.png', 64, 145, 440, 515, { valign: 'top', align: 'left' });
text(s, 'Left: the completion summary, verbatim.', 540, 150, 676, 40, 27, C.blue, true);
text(s, 'Right: per behavior, what the agent exercised in the browser after its last edit, whether it ran acceptance checks, and the harness result.', 540, 195, 676, 95, 23);
text(s, 'd017cd57 claimed: draft survives page refresh.', 540, 300, 676, 40, 25, C.blue, true);
text(s, 'Browser action after the last edit: No.   run_checks after the last edit: 1.   Harness result: Pass.', 540, 345, 676, 75, 23);
text(s, 'Claims are the model\'s words. Observations are recorded tool actions. The panel does not interpret reasoning.', 540, 430, 676, 95, 23, C.orange, true);
text(s, 'Minimal runs never requested completion, so their panel stays empty.', 540, 530, 676, 55, 21, C.muted);
cap(s, 'Run d017cd57 · +Verification · draft scenario · 26 Oct 2026 · dashboard screenshot 27 Oct 2026', 540, 600, 676, 50);

s = page('Engineered: knowledge it cannot know', 'Live step 5. Images: What each agent was told for Minimal d13b50fa and Engineered 5794a37d side by side (1,102 versus 5,646 characters of instructions, the same 331-character task, Engineered scrolled to the ticket), the Context management evidence of 5794a37d scrolled to the PN-142 ticket thread, and its anatomy board with seven enabled cards after approval. Create a fresh Engineered workspace with the same model, scenario and task. Seven cards are blue. Open Instructions & policies to show the project rules. Open Context management to show the repository map, revision and the PN-142 ticket thread. The ticket explains incident INC-37 (a renamed storage key hid users\' notes), the QA test ids, the backup privacy rule and the path-prefixed storage keys. Then show what each agent was told, side by side. Supplying a rule proves inclusion, not compliance; judge compliance from the diff and the checks. ' + v4, { section: v4label });
picture(s, 'v4/inputs-ticket.png', 64, 150, 700, 290, { valign: 'top', align: 'left' });
cap(s, 'What each agent was told · Minimal d13b50fa (1,102 characters of instructions) and Engineered 5794a37d (5,646), the same 331-character task · Engineered column scrolled to the ticket', 64, 442, 700, 40);
picture(s, 'v4/engineered-anatomy.png', 64, 486, 620, 180, { valign: 'top', align: 'left' });
picture(s, 'v4/engineered-context-evidence-ticket.png', 800, 150, 416, 380, { valign: 'top' });
text(s, 'The PN-142 ticket thread reaches the model only through Context management. No tool can read it.', 800, 538, 416, 75, 19, C.blue, true);
cap(s, 'Run 5794a37d · Engineered · draft scenario · 26 Oct 2026 · dashboard screenshots 27 Oct 2026', 800, 618, 416, 50);

s = page('The gate and the repair loop', 'Live step 6. Image: the activity list of run d017cd57 at its first run_checks call. The agent ran the six visible checks before editing (4/6, the unfixed baseline), edited src/storage.js, ran them again (6/6) and requested completion; the gate\'s independent assessment passed 6/6. With Verification on, the agent can run the six visible checks, and completion requires all six to pass on the current revision. A failure goes back to the model, which can try again within the shared budget. Show a repair loop only if one appears in the trace: in the recorded ladder no completion request was rejected by the gate. Automated tests cover the rejection path. The held-out checks are never part of this gate. ' + v4, { section: v4label });
picture(s, 'v4/verification-activity-run-checks.png', 64, 150, 610, 445, { valign: 'top', align: 'left' });
text(s, 'Six visible checks. Completion needs 6/6 on the current revision.', 720, 150, 496, 75, 25, C.blue, true);
text(s, 'run_checks before editing: 4/6, the unfixed baseline\n\nEdit src/storage.js, run_checks again: 6/6\n\nrequest_completion: independent assessment 6/6, then published', 720, 232, 496, 195, 21);
text(s, 'A failing result goes back to the model for another attempt within the budget. No completion was rejected in these runs; automated tests cover that path. Show a repair loop only if one appears.', 720, 435, 496, 140, 20, C.orange, true);
cap(s, 'Run d017cd57 · +Verification · draft scenario · 26 Oct 2026 · dashboard screenshot 27 Oct 2026 · held-out checks are never part of this gate', 720, 585, 496, 70);

s = page('Approval', 'Live step 7. Images: the two phones of run 5794a37d (Engineered, draft scenario, 26 October 2026) after approval, its activity list at the approval boundary and the AFTER panel of the reviewed diff, which changed only src/storage.js. After the visible checks pass, Engineered waits. The production banner says one change is waiting for approval. Open the diff and the tested revision (367e4adf43ac here). Approve. The banner changes to say it was updated after your approval (22:45:01 local time in this run). Try the traps on production again. This is authority the model should not have. All four Engineered runs in the ladder stopped at this boundary and were approved only after a diff inspection. ' + v4, { section: v4label });
picture(s, 'v4/engineered-phones.png', 64, 150, 420, 432, { valign: 'top', align: 'left' });
picture(s, 'v4/engineered-activity-approval.png', 510, 150, 380, 276, { valign: 'top', align: 'left' });
picture(s, 'v4/engineered-diff-after.png', 510, 440, 380, 220, { valign: 'top', align: 'left' });
text(s, 'Engineered stops at the approval boundary.', 920, 150, 296, 105, 25, C.blue, true);
text(s, 'Production stayed on the original build until a human approved revision 367e4adf43ac after reading the diff.', 920, 262, 296, 130, 20);
text(s, 'The reviewed diff changed only src/storage.js.', 920, 398, 296, 55, 20);
text(s, 'Banner after approval: Updated after your approval at 22:45:01.', 920, 458, 296, 85, 20, C.orange, true);
cap(s, 'Run 5794a37d · Engineered · draft scenario · 26 Oct 2026 · dashboard screenshots 27 Oct 2026 · phones, activity list at the approval boundary, diff AFTER panel', 920, 550, 296, 110);

s = page('Held-out grading', 'Live step 8. Image: the Browser verification card of run 5794a37d after presenter evaluation: 6/6 visible and 5/5 held-out on the applied revision. Click Evaluate outcome on both runs. This is presenter evaluation, outside the agent workflow, with no model call. It runs both tiers. The Verification card shows the checks the agent can run and the held-out checks separately; Explain & compare adds a held-out row. Engineered can also fail a held-out check: it had the ticket, but it never saw these checks. Read the actual results. In the recorded ladder every applied patch, automatic or approved, passed 5/5 held-out, and so did the unpublished Minimal patches; the traps were measured, not demonstrated. On the unfixed starter app the automated tests observe 4/6 visible and 3/5 held-out. ' + v4, { section: v4label });
picture(s, 'v4/engineered-verification.png', 64, 150, 1152, 410, { valign: 'top', align: 'left' });
text(s, 'Both tiers on the applied revision of run 5794a37d: 6/6 visible · 5/5 held-out.', 70, 568, 1080, 34, 25, C.blue, true);
text(s, 'Presenter evaluation, outside the agent workflow. Minimal d13b50fa also passed 5/5 held-out on its unpublished patch. The unfixed starter app scores 4/6 visible and 3/5 held-out.', 70, 604, 1080, 46, 19);
cap(s, 'Run 5794a37d · Engineered · draft scenario · 26 Oct 2026 · dashboard screenshot 27 Oct 2026 · Engineered can fail a held-out check too; read the actual results', 70, 650, 1080, 24);

s = page('Optional: forced session reset', 'Optional live step. Images: the activity list of run b4feef72 (+Memory, draft scenario, forced reset after model call 8) from the reset event onward, and its Memory tab scrolled to the frozen handoff supplied to session 2. Prepare two workspaces with the same Forced session reset call number (resetAfterCalls). After that model call, the harness records Context limit reached: fresh session required, clears the conversation and starts session 2. Files remain in both runs. Only the run with Memory receives a frozen handoff; in b1f14631 (+Verification, no Memory) session 2 re-read every file and rewrote src/app.js as the budget ended. Show the reset event and the next prompt. This is state the model cannot keep. Restored state does not guarantee completion: b4feef72 restored the handoff, passed the checks within its first seven calls of session 2 and still stopped at its 24-call budget without requesting completion, like the historical v3 memory trials. ' + v4, { section: v4label });
picture(s, 'v4/reset-memory-activity.png', 64, 150, 560, 406, { valign: 'top', align: 'left' });
picture(s, 'v4/reset-memory-handoff-session2.png', 650, 150, 566, 410, { valign: 'top', align: 'left' });
text(s, 'The reset event and the next prompt · b4feef72 (+Memory)', 64, 562, 560, 30, 18, C.blue, true);
text(s, 'The frozen handoff supplied to session 2 · b4feef72', 650, 562, 566, 30, 18, C.blue, true);
text(s, 'b4feef72 restored the handoff, passed the checks within seven calls of session 2 and still stopped at its 24-call budget. b1f14631 (+Verification, no Memory, same reset) re-read every file in session 2 and also stopped at its budget.', 70, 595, 1080, 55, 19);
cap(s, 'Draft scenario · forced reset after model call 8 · 26 Oct 2026 · dashboard screenshots 27 Oct 2026 · restored state did not produce completion', 70, 648, 1080, 25);

s = page('The ladder', 'Image: the ladder scoreboard for cohere/north-mini-code:free, the draft scenario, harness v4 and no forced reset, one trial per rung (26 October 2026). Open Runs & evals and the ladder scoreboard: Minimal, +Verification, +Instructions & context, +Memory, Engineered. Each rung adds one thing. Columns include trials, completed, visible pass, held-out pass, applied without review, claimed without a refresh test, average calls and average tokens. The ladder comes from node scripts/evaluate.mjs --ladder, which makes real, billable calls. Across the three scenarios (15 runs): Minimal completed 0 of 3 and passed 3 of 3 held-out; every rung with run_checks completed 3 of 3; +Verification, +Instructions & context and +Memory applied without review 3 of 3 each; Engineered waited for approval 3 of 3; claimed without a refresh test was 0 in every row. The dashboard filters the ladder per model, scenario, harness version and reset setting; the forced-reset ladder is a separate filter. Empty cells mean not measured. One trial per cell is illustrative, not a reliability rate; provider HTTP 429 failures were retried as fresh runs and are listed in the report. ' + v4, { section: v4label });
picture(s, 'v4/ladder-draft.png', 64, 150, 760, 350, { valign: 'top', align: 'left' });
text(s, 'Each rung adds one component. Empty cells mean nothing was measured. The dashboard filters per model, scenario, harness version and reset setting; the forced-reset ladder is a separate filter.', 64, 505, 760, 75, 19);
cap(s, 'Ladder scoreboard · cohere/north-mini-code:free · draft scenario · harness v4 · no forced reset · runs of 26 Oct 2026 · dashboard screenshot 27 Oct 2026 · three-scenario totals from live-validation/v4/RESULTS.md', 64, 588, 760, 60);
text(s, 'Across three scenarios, 15 runs, one per rung and scenario:', 850, 150, 366, 90, 22, C.blue, true);
text(s, 'Minimal: 0/3 completed · 3/3 held-out pass · 24 calls each\n\n+Verification, +Instructions & context, +Memory: 3/3 completed · 3/3 applied without review\n\nEngineered: 3/3 waited for approval · 0/3 applied without review\n\nClaimed without a refresh test: 0 in every row · 5/5 held-out on every applied patch', 850, 245, 366, 300, 18);
text(s, 'One trial per cell with a free model. Illustrative, not a reliability rate.', 850, 555, 366, 80, 19, C.orange, true);

s = page('What the demo establishes', 'Say only what the live runs and the automated tests show. The automated tests establish that the ticket reaches the model only through Context management, that held-out checks never reach the agent, that a draft-in-notes patch passes all six visible checks and fails the backup held-out check, that production changes only through publication, and that a forced reset happens at the same call for every preset. They do not establish model behavior. The first live ladder (one trial per cell, a free model, 26 October 2026) showed Minimal producing correct patches and never finishing, the first rung with run_checks shipping to production with no review, Engineered waiting for approval every time, and no held-out failure on any applied patch. If Minimal passes everything, say so: it still shipped with no evidence required and no review. Close with: the model did not get smarter. The harness supplied what it could not know, checked what it did not look at, kept what it would forget, and held back what it should not decide alone. ' + v4, { section: v4label });
rows(s, [['The controls are visible and testable', 'Automated tests show the ticket reaches the model only through Context management, held-out checks never reach the agent, production changes only through publication, and a forced reset hits every preset at the same call.'], ['A capable model can succeed with Minimal', 'In the first live ladder every Minimal run produced a correct patch and never finished. The first rung that finished shipped with no review. Engineered waited for approval every time.'], ['Harnesses still have limits', 'One trial per cell, a free model and provider rate limits. No reliability claim. The traps were measured, not demonstrated.']], { top: 145, gap: 130, size: 28, bodySize: 22, bodyHeight: 88, bodyColor: C.green });
text(s, 'The model did not get smarter. The harness supplied what it could not know, checked what it did not look at, kept what it would forget, and held back what it should not decide alone.', 70, 548, 1100, 95, 25, C.orange, true);

// ---------------------------------------------------------------- Closing (33 to 35)
section('Closing');
s = page('Applying this to existing coding agents', ref + ' Source slides 21 and 22. You do not need to replace Claude Code, Codex or another coding environment to practice harness engineering. Maintain clear repository instructions, runnable checks, scoped access and a review process. Avoid version-specific command claims here. Reassess instructions and scaffolding when model capability changes; extra constraints can add cost or distract the model.');
rows(s, [['Project knowledge', 'A concise AGENTS.md or equivalent points to current setup and design docs.'], ['Executable feedback', 'Tests, builds and architectural checks explain failures clearly.'], ['Measured workflow changes', 'Use representative bug fixes, review evidence and remove unnecessary scaffolding.']], { gap: 135 });

s = page('Discussion', 'Close with the original goal: production agents need an engineered environment around the model. Ask engineers for a recurring failure, architects for an enforceable boundary, and leaders for evidence they would require before expanding access. Keep the discussion anchored to a real workflow rather than choosing the largest component list. ' + ref + ' Source slide 23.');
text(s, 'Which recurring failure in our bug-fixing work could we address with a better harness?', 70, 210, 1110, 190, 44, C.blue, true); text(s, 'What input, tool, check or approval would change the outcome?', 70, 465, 1100, 115, 32);

s = page('Sources and further reading', 'Reference supplied by the user: Agent-Harness-and-Harness-Engineering.pptx, all 24 slides reviewed. External primary sources checked on 25 October 2026. URLs below support the case examples and guides/sensors framing; local real-run evidence supports demo outcomes. The source deck also lists a Thoughtworks podcast and a community collection as optional reading, but no claims here depend on them.');
rows(s, [['Anthropic: Effective harnesses for long-running agents', 'anthropic.com/research/effective-harnesses-for-long-running-agents'], ['Birgitta Böckeler: Harness engineering for coding agent users', 'martinfowler.com/articles/harness-engineering.html'], ['OpenAI: Harness engineering', 'openai.com/index/harness-engineering/'], ['Harness Lab: real run traces and screenshots', 'live-validation/ in the repository: v2, v3 and v4 evidence kept separately']], { top: 175, gap: 115, size: 25 });

// ---------------------------------------------------------------- Appendix: historical v2 and v3 slides (36 to 48)
section('Appendix · historical v2 and v3');
const appendixStart = count + 1;
s = page('Appendix:\nhistorical v2 and v3 evidence', 'The slides that follow are the demo slides of the pre-v4 deck, kept for the record. They show an earlier fixture (no Backup screen), a single check tier, no production phone and no ladder, with different models: nvidia/nemotron-3.5-super-vl:free on 25 October 2026 (v2) and cohere/north-mini-code:free on 26 October 2026 (v3). Do not pool them with harness v4 or with each other. Present them only if asked about the earlier rehearsals.', { dark: true, size: 56 });
text(s, 'Earlier fixture, a single check tier, no production phone, different models.', 68, 290, 1000, 110, 32, C.white); text(s, 'Kept for the record. Not comparable with harness v4.', 70, 420, 1040, 75, 25, C.paleBlue); text(s, 'HARNESS LAB', 70, 615, 1000, 28, 18, C.amber, true);

s = page('Demo: the disappearing draft (v2)', live + ' We use a browser-based mobile app so no emulator is needed. In a fresh workspace type a draft title and text, click My notes and return to Draft. The text disappears; refresh also loses it. The requested repair must also preserve saving, existing notes and distinct notes. This is one task with three acceptance-data variants, not three unrelated applications.', { section: v2label });
text(s, 'Pocket Notes', 70, 190, 650, 65, 38, C.blue, true); text(s, 'An unfinished draft disappears when the user changes screens or refreshes.', 70, 290, 650, 140, 32); text(s, 'The fix must preserve normal saving and existing notes.', 70, 475, 650, 120, 28, C.muted); picture(s, 'phone.png', 850, 165, 260, 490);

s = page('Minimal: two enabled components (v2)', live + ' Live step 1. Create a fresh Minimal workspace and choose the same model and scenario you will use for Engineered. Blue means enabled; gray means off. Basic task context and sandbox protection remain. Minimal can manually inspect files, read PROJECT.md and use the browser. The disabled cards refer to automatic project support, handoff, acceptance enforcement and approval.', { section: v2label });
picture(s, 'minimal-components.png', 64, 175, 1152, 190); text(s, 'The model can request actions and use real tools.', 70, 410, 1120, 65, 33, C.blue, true); text(s, 'No automatic project inputs, saved handoff, acceptance checks or approval.', 70, 505, 1110, 100, 28);

s = page('Engineered: inputs in a real request (v2)', live + ' Live step 2. Start Engineered. The orange outline identifies active components; it does not reveal private reasoning. This screenshot records an actual request with Agent loop, Instructions & policies and Context management active together. Open either input card to inspect its separate payload. The model is the same as Minimal. Image source: actual run cf25feae-cd17-4bfa-a052-d9771d84c848, draft scenario.', { section: v2label });
picture(s, 'engineered-live.png', 64, 175, 1152, 220, { crop: { left: 0.017, top: 0.106, right: 0.017, bottom: 0.721 } }); text(s, 'Blue\nEnabled', 70, 455, 300, 110, 32, C.blue, true); text(s, 'Orange outline\nCurrent action', 470, 455, 350, 110, 30, C.orange, true); text(s, 'Click a card\nInspect evidence', 910, 455, 300, 110, 29);

s = page('Two different project inputs (v2)', live + ' Live step 3. Show the exact rules and map, not just this summary. The instructions payload says to preserve existing notes and literal text. The context payload identifies src/storage.js as notes and draft storage, with file sizes and source revision. Both appear in the actual model request. Rule compliance must be judged from the diff and tests. Image sources: corresponding instructions and context evidence screenshots from run cf25feae.', { section: v2label });
picture(s, 'instructions-excerpt.png', 64, 160, 555, 350); picture(s, 'context-excerpt.png', 655, 160, 555, 350); text(s, 'Instructions & policies', 70, 535, 550, 45, 28, C.blue, true); text(s, 'Rules for doing the work', 70, 590, 550, 45, 24, C.muted); text(s, 'Context management', 660, 535, 550, 45, 28, C.blue, true); text(s, 'Information about this project', 660, 590, 550, 45, 24, C.muted);

s = page('Evaluation after Minimal stops (v2)', live + ' Live step 4. Minimal can publish when it declares completion, without acceptance checks. Evaluate outcome is a separate presenter action. In this captured draft trial the model hit its budget before completing and never published. The independent checks found 5/6, including a regression to existing note text. Do not describe this specific run as an automatically published bad patch.', { section: v2label });
picture(s, 'minimal-regression.png', 64, 185, 1152, 260); text(s, 'Observed in the draft rehearsal: 5/6 checks passed', 70, 475, 1120, 55, 31, C.orange, true); text(s, 'The model changed original note text and hit its budget. No patch was published.', 70, 555, 1120, 90, 27);

s = page('Verification before Engineered completes (v2)', live + ' Live step 5. The harness runs protected tests when requested and independently when completion is requested. All six must pass on the current revision. If they fail, the gate returns failures to the model. In these three successful Engineered trials no final failed-check gate occurred; do not invent one during narration. Automated tests cover that rejection path.', { section: v2label });
picture(s, 'engineered-verification-event.png', 64, 160, 1152, 340); text(s, 'Passing checks are a required condition for completion.', 70, 520, 1120, 60, 32, C.blue, true); text(s, 'A failing result returns feedback for another attempt within the budget.', 70, 600, 1110, 65, 27);

s = page('Review and approval (v2)', live + ' Live step 6. Open the source diff, inspect it and compare the tested revision. Engineered waits for approval rather than applying immediately. Opening the approval dialog does not publish. Confirmation publishes only the checked current revision into the isolated demo copy. Try the published app afterwards. Image source: reviewed storage.js diff from cf25feae.', { section: v2label });
picture(s, 'review-diff.png', 64, 160, 830, 485); text(s, 'Inspect the change', 940, 210, 260, 95, 29, C.blue, true); text(s, 'Check the revision', 940, 340, 260, 95, 29); text(s, 'Approve application', 940, 470, 260, 115, 29);

s = page('v3 comparison (historical)', v3 + ' This screenshot records the state BEFORE human approval. Minimal completed and applied automatically. Engineered passed 6/6 and waited for approval, so the screenshot correctly says its patch has not been applied. The presenter subsequently reviewed the storage.js-only diff and approved it. Do not narrate this screenshot as the final post-approval state. Both fixed the task in this pair. The observed contrast is runtime enforcement and publication control, without a claim that a harness guarantees a better patch.', { section: v3label });
picture(s, 'v3-comparison-before-approval.png', 64, 155, 800, 510); text(s, 'Both passed 6/6', 910, 190, 300, 95, 30, C.blue, true); text(s, 'Minimal applied automatically', 910, 325, 300, 125, 28); text(s, 'Engineered waited for approval', 910, 490, 300, 125, 28, C.orange, true);

s = page('v3 results (historical)', v3 + ' Minimal e25d301f completed automatically with 6/6, 20 real model calls and recorded elapsed time 73.080 seconds. Engineered 0b75acc7 reached approval with 6/6, 13 calls and recorded elapsed time 89.012 seconds. These elapsed values come from the comparison snapshot before human approval and do not include subsequent review time. The presenter reviewed the source diff, which changed only src/storage.js for Engineered, then approved it. Independent browser validation of both published apps passed with zero observed uncaught errors. Minimal changed src/app.js and src/storage.js. A smaller diff and fewer calls in one pair do not establish causality or comparative reliability. Keep these v3 outcomes separate from v2 and from other model/provider failures. Fresh v3 memory trials remain separate and are not represented as completed here.', { section: v3label });
text(s, 'OpenRouter / cohere/north-mini-code:free / same Draft task', 70, 145, 1140, 42, 24, C.muted);
table(s, [['Evidence', 'Minimal', 'Engineered'], ['Observed checks', '6/6 passed', '6/6 passed'], ['Real model calls', '20', '13'], ['Time before review', '73.080 seconds', '89.012 seconds'], ['Publication', 'Applied automatically', 'Reviewed, then approved']], { y: 210, h: 320, widths: [350, 400, 400], size: 24 }); text(s, 'Both published apps passed independent browser validation with zero observed errors.', 70, 558, 1120, 70, 27, C.blue, true); text(s, 'One matched pair. The result shows enforced checks and approval.', 70, 635, 1100, 40, 23, C.muted);

s = page('Historical v2 outcomes', live + ' Six runs, one per preset and acceptance variant. The task and fixture were identical. All successful patches subsequently passed independent published-app checks. This is illustrative evidence, not a statistical reliability claim. The first Minimal trial used 13 calls and hit budget with 5/6. Engineered draft used 5 calls; Unicode 5; long-form 4. Minimal Unicode 11; long-form 12. Do not pool these trials with the v3 pair or with v4, which used different harness versions and models.', { section: v2label });
table(s, [['Acceptance variant', 'Minimal', 'Engineered'], ['Draft', '5/6; budget stopped run', '6/6; waited for approval'], ['Unicode and multiline', '6/6; applied automatically', '6/6; waited for approval'], ['Long-form text', '6/6; applied automatically', '6/6; waited for approval']], { h: 320, widths: [330, 410, 410], size: 24 }); text(s, 'One trial per cell. Success, completion and approval are separate outcomes.', 70, 560, 1120, 85, 27, C.muted);

s = page('Fresh sessions: v2 evidence', live + ' Optional step 7, using this historical recorded trial. Both presets paused after an actual edit and started a fresh session. Minimal had zero saved checkpoints. Engineered supplied the saved source revision/checkpoint in the actual next prompt. The Engineered trial then encountered HTTP 502; one recovery restored the checkpoint again. Both ultimately hit their budgets with a 6/6 patch and did not publish. Memory helps carry state; it does not guarantee completion. Harness v3 froze a compact handoff at session reset, while retaining the full checkpoints as evidence. This screenshot does not establish v3 memory completion. Separate v3 memory trials on 26 October: Minimal 7bc9ac11 in session 2 had no saved handoff, stopped at its 24-call budget with 3/6 and did not publish. Engineered c599c57b in session 2 restored a 766-byte compact frozen handoff, stopped after 23 calls due to conservative next-request reservation with 6/6 and did not publish. These trials show restoration, while successful interrupted-task completion remains unestablished. Keep memory optional. The v4 forced-reset ladder is on slide 30.', { section: v2label });
picture(s, 'memory-checkpoint.png', 64, 160, 830, 485); text(s, 'Both retained files', 940, 190, 260, 100, 28, C.blue, true); text(s, 'Only Engineered restored saved progress', 940, 320, 260, 150, 28); text(s, 'Both hit a budget in this rehearsal', 940, 510, 260, 130, 25, C.orange, true);

s = page('What the demo established (v2 and v3)', 'Evidence sources: historical v2 live-validation/revised-cards/RESULTS.md and v3 live-validation/v3/RESULTS.md plus the exported runs. The v2 set contains six scenario trials plus two interrupted runs. Its recovery belongs to the same Engineered interrupted run. The v3 matched Draft pair shows two passing patches with different completion and publication requirements. Do not pool model versions or harness versions into a success percentage. A provider error is distinct from a code defect. Shared budgets can stop a working patch before completion. Screenshots record real rehearsal, not current live execution. Slide 32 states what the v4 demo establishes.', { section: 'Historical · v2 and v3 conclusions' });
rows(s, [['The controls are visible and testable', 'Inputs, tools, saved state, checks and approval leave recorded evidence.'], ['A capable model can succeed with Minimal', 'The contrast is also what the runtime requires before completion.'], ['Harnesses still have limits', 'Provider failures, budgets and incomplete tests remain possible.']], { gap: 135 });

// ---------------------------------------------------------------- Output
const header = `# Speaker notes

Generated by \`presentation/build.mjs\` on ${BUILD_DATE}. Edit notes in that script; this file is overwritten on every build.

**Status.** The deck was rebuilt for harness v4 on ${BUILD_DATE}. Slides 21 to 32 show the first live v4 ladder (26 October 2026, OpenRouter \`cohere/north-mini-code:free\`, one trial per rung and scenario; see live-validation/v4/RESULTS.md) with screenshots of the recorded runs taken from the dashboard on 27 October 2026 (\`presentation/assets/v4/manifest.json\` lists each file and its run). Slides ${appendixStart} to ${count} keep the earlier v2 and v3 demo slides as a labeled historical appendix. Do not pool versions. One trial per cell is illustrative, not a reliability rate.
`;
const body = notes.map(n => `${n.slide === appendixStart ? '## Appendix: historical v2 and v3 slides\n\nThese slides belong to the pre-v4 deck. They describe historical v2 and v3 evidence with an earlier fixture and a single check tier. Do not pool them with v4 results.\n\n' : ''}## ${n.slide}. ${n.title.replaceAll('\n', ' ')}\n\n${n.notes}\n`).join('\n');
fs.writeFileSync(path.join(here, 'speaker-notes.md'), header + '\n' + body);
await pres.writeFile({ fileName: outFile });
console.log(JSON.stringify({ deck: outFile, slides: count, appendixStart, notes: path.join(here, 'speaker-notes.md') }));
