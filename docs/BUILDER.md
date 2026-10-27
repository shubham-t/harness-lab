# Build a harness, step by step: design contract

Status: build contract for the "harness builder" page. Written 27 October 2026 on branch `harness-builder`. [AGENTS.md](../AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md) and [the v4 design](REDESIGN-V4.md) still apply unless this document says otherwise.

## Why

Live rehearsals with a capable model showed that Minimal and Engineered both fix the draft bug, so the audience sees only "one of them ran checks and asked for approval". The owner decided that the lesson is no longer "watch the harness catch a mistake". The lesson is **how to build a harness from scratch, one component at a time**, with real evidence at every step that the component is there and did something.

The audience only needs to understand one thing about Pocket Notes: an unfinished draft disappears when you switch screens or refresh, and the agent has to fix it. Only the **draft** scenario is used. No ticket, backup, storage-key or held-out-trap narrative is needed on this page.

## What the audience looks at

Three places, learned in the first two steps and reused in every step after:

- **The request box:** the exact text sent to the model. It grows as components are added.
- **The activity list:** what happened, line by line, with a time on each line.
- **The two phones:** SANDBOX (the agent's working copy) and PRODUCTION (what users get).

Every "proof" is a visible change in one of those three places: text that was not in the request before, a line that appeared in the activity list, or a phone that changed.

## The steps

| Step | Adds | Recorded evidence | Run configuration |
| --- | --- | --- | --- |
| 0 | A model alone | One real request with the task and no tools; the reply is prose; files unchanged | `POST /api/model/task-only` (no run) |
| 1 | Agent loop | The repeating pattern request → reply → observation; the budget stop | a **loop-only** run: `mode: 'minimal', loopOnly: true` |
| 2 | Tools and sandbox | Real `read_file` and `write_file`; the sandbox phone keeps the draft; a write outside the sandbox rejected (presenter-triggered probe, labelled as such) | `mode: 'minimal'` |
| 3 | Instructions and policies | The PROJECT.md rules block inside the request, highlighted | `mode: 'minimal', features: { instructions: true }` |
| 4 | Context management | The repository map, file list and revision block added to the request | `features: { instructions: true, context: true }` |
| 5 | Verification | `run_checks` appears in the tool list; checks before and after the edit; the independent gate assessment on completion | `features: { instructions, context, verification }` |
| 6 | Memory and state | Two runs cut off at the same call (`resetAfterCalls`): session 2 without a handoff versus session 2 with the frozen handoff; the handoff text itself | the step-5 configuration with `resetAfterCalls: N` and `memory: false`, and the same with `memory: true` |
| 7 | Guardrails (approval) | The production banner "waiting for your approval", the diff, then "updated after your approval" | `mode: 'engineered'` |

Every run uses the same task text, starting files, tool schemas (where tools exist) and the same budgets (24 calls, 150,000 reported tokens). Only what the harness supplies and requires differs. All runs use the draft scenario and the same model.

## Work package A: runtime (loop-only mode, model-only request, builder routes)

Owner of `lib/runner.mjs`, `lib/store.mjs`, `server.mjs`, `public/anatomy.mjs`, `public/lesson.mjs`, `public/app.js` (only where labels derive from `preset()`), `scripts/doctor.mjs` if needed, and the tests named below.

### A1. Loop-only mode

- `createRun({ loopOnly })`: boolean, default `false`. Stored as `run.loopOnly` (always a boolean on new runs). `POST /api/runs` passes `loopOnly` through. Anything other than a boolean or absent returns HTTP 400 `loopOnly must be true, false or omitted.` A loop-only run must be `mode: 'minimal'` with every optional feature off; any enabled feature returns HTTP 400 `A loop-only run cannot enable harness features.` It may carry `resetAfterCalls` (same validation as today).
- `toolsForRun(run)` returns `[]` when `run.loopOnly`. The provider request therefore has no `tools` entry. `executeTool` already rejects a tool that is not in `toolsForRun`; keep that message (`Tool <name> is unavailable in this harness configuration.`) so a model that hallucinates a tool call is recorded as `tool_error`.
- `assembleModelInput`: when `run.loopOnly`, the base text is `MODEL_ONLY_INSTRUCTIONS` (below) followed by one sentence: `This is an agent loop without tools: each reply is recorded, the harness answers with what changed (nothing can change without tools), and the loop repeats until the budget ends.` The v3 budget line (`Remaining model calls: …`) stays. No feature sections exist (all off).
- When a reply contains no tool calls, the runner today appends the nudge `Use the available tools to investigate…`. For a loop-only run append instead: `Observation: no action was requested and no tools exist in this configuration, so nothing changed. Source revision <rev> is unchanged. The draft still disappears. Continue.` Record it as an event `{ kind: 'observation', title: 'Observation returned to the model', detail: <that text>, call, session }` so the activity list shows the loop's third beat. The nudge for runs with tools is unchanged and is not recorded as an event (unchanged behavior).
- The run ends by the existing budget logic (status `budget_exceeded`) or a pause. No new status.
- `MODEL_ONLY_INSTRUCTIONS` (exported from `lib/runner.mjs`): `You are asked to fix the real Pocket Notes application. You have no tools: you cannot read or change files, run checks or use a browser. Reply with what you would do. The source files are not available to you.` This is the text used by step 0 and the base of step 1, so the two steps differ only by the loop.
- `publicRun` exposes `loopOnly` (the spread already does); `evaluationSummary` adds `loopOnly` to the grouping key and to each group (`loopOnly: true|false`).
- `public/anatomy.mjs`: `specs.tools` becomes `[!run.loopOnly, run.loopOnly ? 'Off' : 'Enabled', run.loopOnly ? 'No tools: the model can only reply with text' : 'Real files and browser']`. A loop-only run never highlights the Tools card. Map kind `observation` to `['loop']`.
- `public/lesson.mjs`: `preset(run)` returns `'Loop only'` when `run.loopOnly`. `comparableRuns` never pairs a loop-only run (either side). `ladderTable` ignores groups with `loopOnly: true`. `outcome()` for a loop-only run: `required` = `No tools and no acceptance check: the model could only reply with text`.
- `public/app.js`: wherever the preset badge or feature chips are rendered from `preset()`/features, a loop-only run shows the badge `Loop only` and the Tools chip off. No New workspace control is added for this mode; it is created through the API by the recorder.

### A2. Model-only request (step 0)

- `POST /api/model/task-only` (empty JSON body; same local headers as other POSTs). Requires a configured provider; otherwise HTTP 400 like `/api/runs/:id/start`. Makes **one real model request** through `callModel` with `instructions: MODEL_ONLY_INSTRUCTIONS`, `history: [{ role: 'user', content: TASK }]`, `tools: []`, the pinned public provider config, default output limit. No workspace, no run, no file is touched.
- Response and record: `{ id, at, model, baseUrl, protocol, instructions, task, text, status, incompleteReason, usage: { input, output }, usageReported }`. The record is written atomically to `<HARNESS_DATA_DIR>/model-only/<id>.json` (same key hygiene as runs: never the key). `GET /api/model-only` lists the records (newest first). A failed request returns HTTP 400 with the provider message and writes no record.
- This endpoint is for the builder recording. The dashboard does not expose it.

### A3. Builder routes

- `GET /builder.html`, `/builder.mjs` serve `public/builder.html` and `public/builder.mjs` (add them to the dashboard asset map; package B writes the files). The dashboard CSP already allows same-origin scripts, images and the preview iframes.
- `GET /api/builder` returns the recording JSON at `process.env.HARNESS_BUILDER_RECORDING || path.join(ROOT, 'live-validation/builder/recording.json')`, parsed, with an added field `present: { <runId>: true }` for every recorded run id that exists on this server (so the page knows when live phones are possible). HTTP 404 `{ error: 'No builder recording found.' }` when the file is missing.
- `GET /builder-assets/<name>.png` serves `<dir of recording.json>/screens/<name>.png` for `name` matching `^[a-z0-9-]+$`; 404 otherwise.

### A4. Tests for package A

- `tests/builder-runner.test.mjs` (in process, mocked transport, like `tests/v4-runner.test.mjs`): `loopOnly` validation (non-boolean, with features); a loop-only run sends no `tools`; a hallucinated tool call is recorded as `tool_error` with the unavailable message; the observation event is recorded after a text-only reply and the next request carries it; the run stops at the call budget with status `budget_exceeded`; `MODEL_ONLY_INSTRUCTIONS` is the base of the loop-only prompt; anatomy shows Tools Off and never highlights it; `preset()` is `Loop only`; `comparableRuns` and `ladderTable` exclude it; evaluation grouping separates it.
- `tests/builder-system.test.mjs` (server on ports **4438/4439**, scripted loopback provider on **4440**): `POST /api/model/task-only` makes exactly one request with no tools and writes a record; `GET /api/model-only` lists it; `GET /api/builder` returns 404 without a recording and the parsed file with `present` when `HARNESS_BUILDER_RECORDING` points at a temporary file; `/builder-assets/` serves a PNG from the temp dir and rejects other names; a loop-only run over HTTP ends at its budget and the dashboard state shows `Loop only`.
- Existing tests keep passing (update expectations where `preset()` or grouping changed).

## Work package B: the builder page

Owner of `public/builder.html`, `public/builder.mjs`, `public/builder.css` (optional; prefer reusing `public/styles.css`), and `tests/builder-page.test.mjs`. Does not edit `server.mjs` (package A serves the files).

### B1. Look

The page says **Harness Lab** and uses the existing theme: the brand mark, topbar, `page-heading`, `surface`, anatomy card, phone-shell and activity-list styles from `public/styles.css`. It is a separate page at `/builder.html`, not a dashboard mode. It must work at 1280×720 and 1440×900 without horizontal scroll. Keyboard: Left/Right arrows move between steps; the URL hash `#step-N` selects a step on load.

### B2. Layout per step

Header: step number of 7, step title, a seven-segment progress bar. Then three panels, always in the same order:

1. **The problem.** One or two plain sentences. Fixed text per step (see the table of steps). No jargon.
2. **What we add.** The seven-box diagram (Agent loop, Tools and sandbox, Instructions and policies, Context management, Verification, Memory and state, Guardrails): boxes added so far are blue (enabled card style), the one added at this step is outlined, the rest gray. Below it, a short real code excerpt (5 to 12 lines, verbatim from `lib/runner.mjs`, `lib/store.mjs` or `lib/browser.mjs`, with the file name) that implements the component.
3. **Proof it is there.** From the recorded run for this step: the request box (the first `prompt` event's instructions plus the task, with the text that is new since the previous step highlighted), an activity excerpt (the relevant events, each with its time), and the phones. Footer line: run id, date, model, status, calls, and `Recorded run. Not live.`

Below the three panels: the two phones. If `/api/builder` reports the run as `present`, the phones are live iframes to `/preview/<id>/index.html` and `/production/<id>/index.html` with the existing banner logic (`productionBanner` from `lesson.mjs`). Otherwise they show the recorded screenshots from `/builder-assets/`.

Step 6 shows two activity lists side by side (without memory, with memory) and the handoff text (the `memory` event `Saved handoff included in request` of session 2). Step 7 shows the production banner before approval (from the recording's pre-approval screenshot) and after, the diff summary (files changed), and the approval event.

### B3. Derivations (pure, tested)

`public/builder.mjs` exports pure functions that take the recording object and return render data; the DOM code calls them. At least:

- `STEPS`: the static step definitions (id, title, problem, component id, code excerpt, which recording key).
- `requestText(run)`: instructions plus task from the first `prompt` event (reuse the shape of `promptInputs` in `lesson.mjs`).
- `requestDelta(current, previous)`: splits the current request into segments `{ text, added }` where `added` marks lines not present in the previous request (line-based diff; the feature sections recorded as `instructions`/`context`/`memory` events are always marked added at the step that introduced them).
- `activityExcerpt(run, step)`: the events to show, filtered per step (step 1: `model`, `assistant`, `observation`, `budget`; step 2: `tool`, `edit`, `tool_error`, `permission` probe; step 5: `tool` run_checks, `verification`, `gate`, `completion`; and so on), each `{ at, kind, title, detail }`, bounded (first N and the last line when longer, with a count of elided lines).
- `proofSummary(step, recording)`: the footer facts and the per-step highlight list.
- Nothing is invented: if a recording key is missing, the panel says `Not recorded yet` and the step still renders.

### B4. Tests for package B

- `tests/builder-page.test.mjs`: unit tests for the derivations on a small fixture recording built from excerpts of real exports (for example `live-validation/v4/runs/minimal-verification-draft-…-d017cd57….json`; copy the needed events into `tests/support/builder-recording.mjs`, never the whole file), and a real-browser test that starts the server (ports **4448/4449**, no provider needed) with `HARNESS_BUILDER_RECORDING` pointing at a temporary recording built from that fixture, opens `/builder.html`, walks all eight steps with the keyboard and the buttons, checks the request highlight, the activity excerpt, the `Not recorded yet` fallback, the screenshot fallback for the phones, no horizontal overflow at 1280×720 and 1440×900, and no browser errors.

## Work package C: the recorder

Owner of `scripts/record-builder.mjs` and `tests/record-builder.test.mjs`. Reuses `localApi` from `scripts/evaluate.mjs` and `evaluateStoppedRun` from `scripts/evaluation-client.mjs`.

### C1. Command

`node scripts/record-builder.mjs [--url ORIGIN] [--out DIR] [--reset-after N] [--phase record|finish]`

- Defaults: `--url http://127.0.0.1:4318`, `--out live-validation/builder`, `--reset-after 5`, `--phase record`. `--help` prints usage without contacting the server. Invalid arguments fail before any call (class `UsageError`).
- Every phase `record` call makes **real, billable model calls** and says so before starting. It refuses to start when no provider is configured.
- `--steps LIST` (phase `record` only) re-records just the listed steps (0 to 7) into an existing recording. The earlier entries move to a top-level `superseded` array with a timestamp and reason, their screenshots are renamed with a `superseded-<time>-` prefix, and their exports stay on disk: earlier evidence is immutable. Re-recording step 6 updates the recording's `resetAfterCalls`; re-recording step 7 clears `complete`.

### C2. Phase `record`

In order, writing `<out>/recording.json` after every step so a failure leaves a partial recording:

1. Step 0: `POST /api/model/task-only`; store the returned record under `steps.step0`.
2. Steps 1 to 5 and the two step-6 runs and step 7: `POST /api/runs` with the configuration from the steps table (step 6 and only step 6 passes `resetAfterCalls`), `POST /api/runs/:id/start`, poll until the run is not `running`/`pausing` and has no `activeSessionStartedAt` (15-minute cap per run, then pause and stop with an error), then `evaluateStoppedRun` (presenter evaluation, both tiers, labelled as presenter action in the run), then for step 2 only `POST /api/runs/:id/probe`. Export each run with `GET /api/runs/:id/export` to `<out>/runs/step<N>-<label>-<runId>.json` and store `{ runId, status, calls, export: <relative path> }` under `steps.step<N>` (`steps.step6.withoutMemory` and `steps.step6.withMemory`).
3. Screenshots with Playwright (viewport 390×760, same browser context rules as `lib/browser.mjs`: only the preview origin is allowed): `<out>/screens/step<N>-sandbox.png` from `/preview/<id>/index.html` and `step<N>-production.png` from `/production/<id>/index.html`, after each run stops. For step 7 the production screenshot at this phase is the pre-approval build (`step7-production-before.png`).
4. Stop after step 7 is `awaiting_approval` with the message: `Step 7 is waiting for approval. Read its diff in the dashboard, approve it, then run --phase finish.` The script never approves.

### C3. Phase `finish`

Requires `recording.json` with step 7 recorded. Checks the step-7 run is `completed` with `appliedRevision`; otherwise exits with an error and changes nothing. Re-exports step 7, captures `step7-production-after.png`, sets `complete: true` and `finishedAt`.

### C4. Recording file

```
{
  "note": "Recorded real runs for the harness builder page. Nothing scripted; failures kept.",
  "recordedAt": "<ISO>", "finishedAt": null | "<ISO>", "complete": false | true,
  "model": "<model>", "baseUrl": "<url>", "protocol": "<protocol>", "origin": "<dashboard origin>",
  "resetAfterCalls": 5, "scenario": "draft",
  "steps": {
    "step0": { <model-only record> },
    "step1": { "runId", "status", "calls", "export", "screens": { "sandbox", "production" }, "run": <the export object> },
    ...,
    "step6": { "withoutMemory": {...}, "withMemory": {...} },
    "step7": { ..., "screens": { "sandbox", "productionBefore", "productionAfter" } }
  }
}
```

`run` embeds the export so the page needs one request. Keys never appear (exports already exclude them); the recorder additionally fails if any value contains the string `sk-` followed by 8 or more non-space characters.

### C5. Tests for package C

`tests/record-builder.test.mjs`: argument validation and usage; the step plan (configurations, reset only on step 6, approval never granted); the `record` phase against a fake `api` function and fake screenshot/export functions, asserting the request bodies, the order, the probe on step 2 only, the partial file after a failure, and the stop at `awaiting_approval`; the `finish` phase refusing a step 7 that is not completed. No network, no browser.

## Honesty rules for this page

- Every run shown is a real, recorded run with its id and date on screen. The page never animates a made-up run and never pools runs.
- A missing step says `Not recorded yet`. A failed run is shown as failed.
- The presenter probe (step 2) and the presenter evaluation are labelled as presenter actions, never as model actions.
- Supplying rules or context proves inclusion, not compliance.
- Loop-only runs and model-only requests are builder evidence. They are never compared with Minimal or Engineered in the dashboard's comparison or ladder.

## Process rules

- Work only inside `C:/Projects/harness-lab` on branch `harness-builder`. Never modify the original checkout under `C:/Users/Shubham/Documents/Codex`.
- Make no live model calls and consume no provider quota. Do not call the running server on 4318. Do not read `.env`.
- Run one test command at a time: `node --test tests/<file>` for focused runs. Integration tests reserve ports and launch Chromium.
- Do not commit. Leave changes in the working tree and report what you changed, what you tested with results, and anything left undone.

## Work package D: reset after the first edit

Owner of `lib/store.mjs`, `lib/runner.mjs`, `server.mjs`, `public/lesson.mjs`, `public/app.js` (labels only), `scripts/record-builder.mjs`, `AGENTS.md` invariant 15, and the tests named below.

Why: with a capable model the fix is written at call 5 to 7 and completion follows one or two calls later, so a reset by call count lands either before the fix (an empty handoff) or after the run has finished (no reset). Three recorded pairs show this. A reset triggered by progress cuts both runs at the same point in their work.

- `createRun({ resetAfterFirstEdit })`: boolean, default `false`, stored as `run.resetAfterFirstEdit` (always a boolean on new runs); `POST /api/runs` passes it through. Anything other than a boolean or absent returns HTTP 400 `resetAfterFirstEdit must be true, false or omitted.` Setting it together with `resetAfterCalls` returns HTTP 400 `Use resetAfterCalls or resetAfterFirstEdit, not both.`
- Semantics in the runner loop: after the model call whose tool executions produced the run's first successful `write_file` (the first `edit` event), and only while `run.session === 1`, `run.status === 'running'`, no pause in progress and no forced reset before, record the same `reset` event as today with detail `Configured forced reset after the first file edit (model call N; resetAfterFirstEdit = true); every preset resets at this same point in its work. This is a harness setting that simulates a context limit, not a provider error. ...` (the rest of the sentence as today) and the fields `{ call: N, session: 1, resetAfterFirstEdit: true, memory }`; set `run.forcedReset = { afterCall: N, afterFirstEdit: true, session: 1, at }`; then end session 1 and start session 2 exactly as the call-count reset does. A run that never edits never resets. At most one forced reset per run. A loop-only run never edits, so it never resets.
- Grouping and comparison: `evaluationSummary` adds `resetAfterFirstEdit` to the key and to each group; `comparableRuns` requires equal `resetAfterFirstEdit`; `ladderFilterKey` and `ladderFilters` include it (label it "reset after first edit" next to the reset setting in `public/app.js` where the filter label and run details show `resetAfterCalls`).
- Recorder: `--reset-after-edit` (flag, phase record only, mutually exclusive with `--reset-after`) makes both step 6 runs use `resetAfterFirstEdit: true` and records `resetAfterFirstEdit: true` and `resetAfterCalls: null` at the top level of the recording. The step plan's step 6 bodies then carry `resetAfterFirstEdit: true` instead of `resetAfterCalls`.
- Docs: AGENTS.md invariant 15 becomes "A forced reset happens at the same call (`resetAfterCalls`) or at the same point in the work (`resetAfterFirstEdit`, right after the first file edit) for every preset and is part of the evaluation grouping." Add two sentences to ARCHITECTURE.md's memory section and to README's forced-reset paragraph.
- Tests: in `tests/builder-runner.test.mjs` (or a new `tests/reset-after-edit.test.mjs`, in process, mocked transport): validation; both presets reset right after their first write even when that write happens at different call numbers; a handoff only with memory and it contains the edited file; a run that never writes never resets; a loop-only run with the flag never resets; grouping and comparison separate the setting. In `tests/builder-system.test.mjs` or `tests/v4-system.test.mjs`: the flag over HTTP with the scripted provider for both presets, the event detail, and `/api/evals` grouping. In `tests/record-builder.test.mjs`: the flag, the exclusivity error and the step 6 bodies. Existing tests keep passing.

## Work package E: live mode on the builder page

Owner of `public/builder.html`, `public/builder.mjs`, `public/builder.css`, `tests/builder-page.test.mjs`, `tests/support/builder-recording.mjs` and a new `tests/builder-live.test.mjs`. No server changes: every needed route exists (`POST /api/runs` with `loopOnly`, `features`, `resetAfterCalls` or `resetAfterFirstEdit`; `POST /api/runs/:id/start|pause|checks|probe|approve`; `GET /api/runs/:id` and `/diff`; `POST /api/model/task-only`; `GET /api/state`).

- Every step gets a button **Run this step live** in the proof panel. It creates a fresh run with exactly that step's configuration (the steps table; step 6 creates two runs, without memory first and then with memory, both with `resetAfterFirstEdit: true`; step 0 calls the model-only endpoint) and starts it. The page polls `GET /api/runs/:id` every 1.5 s and re-renders the same three panels from the live run object: the request box from the real `prompt` event, the activity list growing, the diagram unchanged, the phones live. Show a visible status line: status, call N of 24, reported tokens, elapsed seconds, and the run id. The button is disabled while the step's live run is active, and hidden with a note when `/api/state` reports no configured provider.
- A live run replaces the recorded one for that step until the page is reloaded (keep them in memory only; never write to the recording). The request highlight compares against the previous step's live run when one exists, otherwise the recorded one. The footer says `Live run. Started at <time>.` instead of `Recorded run. Not live.` and the page's top badge switches from "Recorded runs · Not live" to "Live run in progress" while any run is active.
- After the run stops, the page runs presenter evaluation (`POST /api/runs/:id/checks`, with the same bounded retry as `evaluateStoppedRun` for the busy conflict) and shows both tiers, labelled as a presenter action. Step 2 then shows a button **Test the sandbox boundary** that calls `/probe` and renders the rejection, labelled as your action, not the model's. Step 7, when the live run is `awaiting_approval`, shows **View diff** (renders `GET /api/runs/:id/diff` before and after in a dialog, reuse the dashboard's diff styles) and **Approve and publish**, which asks for confirmation and calls `/approve`; the production phone and its banner update after it.
- Errors: a failed create or start shows the server's message in the proof panel and keeps the recorded run. A run that ends `failed` shows the error event. A pause from elsewhere shows `paused`. Nothing is retried silently.
- All derivations stay pure: add `liveStepConfig(stepId)` (the create body per step, the same values the recorder uses), `mergeLiveRun(recording, stepId, slot, run)` (returns a new recording-shaped object with the live run in place and a `live` marker), and `liveStatusLine(run)`; test them without a browser.
- `tests/builder-live.test.mjs`: server on ports **4458/4459** with the scripted loopback provider on **4460** (copy the pattern of `tests/builder-system.test.mjs`), `HARNESS_BUILDER_RECORDING` pointing at a temporary recording built from the fixture; in Chromium: run step 1 live (loop-only, the provider script returns text only) and watch the activity list grow and the budget stop appear; run step 5 live to completion and see the presenter evaluation; run step 7 live to `awaiting_approval`, open the diff, approve, and see the production banner change; the step 2 probe button; no provider configured hides the buttons; zero page errors and no external requests.
