# Harness Lab

A local, interactive workshop about agent harness engineering. A real model edits a real mobile-style Notes application. Protected browser checks measure what actually works.

[PowerPoint workshop](presentation/Agent-Harness-Workshop.pptx) · [Presenter guide](docs/PRESENTER.md) · [Setup and troubleshooting](docs/OPERATIONS.md) · [Architecture](docs/ARCHITECTURE.md) · [Testing](docs/TESTING.md) · [Agent instructions](AGENTS.md)

## Start

Requires Node.js 22+ and a Chromium browser.

```powershell
git clone https://github.com/shubham-t/harness-codex.git
cd harness-codex
npm.cmd ci
npx.cmd playwright install chromium
$env:HARNESS_DATA_DIR = Join-Path $PWD '.data'
npm.cmd start
```

Open **http://127.0.0.1:4318**. You can also double-click `start.cmd`.

Use **Focus demo** (or press **F** outside an input) for a compact presentation layout. The model connection remains visible. **Browser proof** jumps to the measured acceptance checks. Exit focus to access the full navigation and create another workspace.

The seven **Harness anatomy** cards match the presentation: Agent loop, Tools & sandbox, Instructions & policies, Context management, Memory & state, Guardrails, and Verification. Orchestration is omitted; the activity log remains part of the demo interface. Blue cards are Enabled and gray cards are Off. Minimal has exactly two enabled cards. An orange outline marks recorded activity, red indicates a block, and the current-action strip explains the consequence. Instructions and context can be highlighted together while their actual contents are included in a model request; each card opens its own recorded payload. Click a card for its meaning and latest evidence. Fast actions remain in the Recent trail. The display never claims to reveal internal model thinking.

On another machine, run `npm install` and `npx playwright install chromium` first. The workbench and application preview use separate loopback ports, 4318 and 4319. No hosted service is required for the UI or browser checks.

## API setup

Use the dashboard's model setup screen. Enter your API key, exact model ID, and endpoint. OpenAI uses `https://api.openai.com/v1` with the Responses protocol. An internal server can use the Chat Completions-compatible adapter if it implements tool calling with that protocol. Other internal protocols need a custom adapter.

Keys entered in the screen live only in the server process memory and disappear when the server stops. The key is never returned to the UI, included in events, or written in run files. Alternatively, copy `.env.example` to `.env` and enter your configuration there. `.env` is ignored by Git. Model settings are pinned when each run starts.

There is **no simulated agent mode**. Without a key and model ID, you can reproduce the real bug, inspect the application, and run real browser checks. The model runner stays locked. Connection tests and agent runs make real API calls and incur provider usage.

The **Run coding agent** button stays visible but disabled until a key and model ID are configured. Next to it, **Run browser checks without a key** exercises the real app immediately. The separate **Connect a model** control opens API setup. You cannot run the minimal or engineered agent scenarios without a model connection. For a short walkthrough, see [the anatomy demo guide](ANATOMY-DEMO.md).

## The scenario

1. In Pocket Notes, enter a title and draft text.
2. Select **My notes**, then **Draft**. The unfinished draft disappears.
3. Refreshing also loses the draft.
4. Ask the agent to preserve drafts across both actions, keep saving correct, clear saved drafts, and preserve existing notes.

The defect is deliberately present in the starter application. Each new run receives an identical fresh copy. The patch comes from the model, never from a scripted solution.

## Presenting the workshop

1. Create an engineered or minimal workspace. Interact with the phone preview to demonstrate the bug.
2. Click **Evaluate outcome** to measure the original bug. This is presenter evaluation, outside the agent workflow. The initial navigation and refresh checks should fail while save-related checks pass.
3. Configure the model. Start a fresh Minimal run. Its agent has file/browser tools and the task, but no acceptance-test or memory tool. If it declares completion, it applies its patch without acceptance checks or approval. Click **Evaluate outcome** afterward to inspect whether it actually worked.
4. Create a new workspace with the same task and model. Choose engineered, or toggle one feature for an ablation.
5. Watch the anatomy cards. Engineered supplies project rules and context separately, saves progress, makes checks available to the agent, and requires passing verification before completion. Inspect actual context, tool results, screenshots and file changes. An agent can still make mistakes; more components do not guarantee a better patch.
6. Pause at a safe tool boundary and resume as a **fresh model session**. Memory-enabled runs reconstruct context from saved memory and observed progress. The minimal configuration receives the task again but retains its working files. This is a session reset, not a claim that the operating-system process was killed.
7. Review the revision-bound browser results. When approval is enabled, approve the exact patch to copy it into the isolated main-demo directory.
8. Inspect **Runs & evals**. Export traces if needed. No benchmark scores are pre-populated.

## What the controls mean

| Feature | Actual behavior |
| --- | --- |
| Instructions & policies | Automatically includes project rules and conventions from PROJECT.md, separately from its repository map |
| Context management | Supplies a focused repository map, file sizes and current revision; presenter check results stay out of verification-disabled model context |
| Memory & state | Exposes save_memory, saves measured checkpoints and restores progress into a fresh session; off means no handoff or checkpoints, while working files remain |
| Verification | Exposes run_checks and independently requires passing checks before completion; off means neither the acceptance tool nor automatic completion assessment is present |
| Guardrails: approval | Requires human approval before publishing into the isolated demo copy |

Both presets share the agent loop, file/browser tools, workspace isolation and execution budgets. Minimal has basic task/conversation context. Both are recorded by the demo for fair observation; these traces do not supply Minimal a saved handoff. The agent cannot edit the harness, protected checks, credentials, or other host files. Approval off means automatic publication only inside this demo's sandbox. A permission probe is explicitly labeled as a user-triggered boundary test, never as something the model attempted.

**Harness version 2** introduces the reduced Minimal workflow. Existing version 1 runs retain their original behavior (including automatic completion assessment and legacy tools) and display a Legacy label. Evaluation groups separate harness versions as well as check suites. Create fresh workspaces to demonstrate the new comparison; earlier live outcomes are not evidence of version 2 behavior.

## Evaluations

Run the same configuration several times before claiming a reliability improvement. Three scenario variants cover normal text, Unicode/literal markup, and longer multiline drafts. These are variants of one task, not a broad benchmark.

The following command runs six **real, billable model trials** (one trial of each variant with each preset):

```powershell
node scripts/evaluate.mjs --trials 1 --scenarios draft,unicode,longform
```

Set `--trials 3` for 18 trials. After each agent stops, the script runs a separate presenter assessment with no model calls; this cannot affect that agent's decisions. Results separate models, provider endpoints, scenarios, feature configurations, harness versions and check suites. Browser checks on ready workspaces are excluded from model evaluations. Compare success, latency and tokens; this app does not invent dollar estimates. Inspect failed runs and denominator sizes. A stronger harness may add overhead and the minimal version may succeed.

## Architecture and files

- `server.mjs`: loopback-only dashboard API and separate-origin application preview.
- `lib/provider.mjs`: OpenAI Responses and compatible Chat Completions adapters.
- `lib/runner.mjs`: real model/tool loop, budgets, memory and completion control.
- `lib/store.mjs`: isolated workspaces, event records, revision hashing and persistence.
- `lib/browser.mjs`: actual browser tools and protected acceptance checks.
- `fixtures/notes/`: the deliberately buggy starting application.
- `public/`: the presentation dashboard.
- `scripts/evaluate.mjs`: repeated live trials.

Runtime records, source copies and screenshots go to `../../work/harness-lab-runtime/` by default. Set `HARNESS_DATA_DIR` to override this. Saved records include application source, provider endpoint/model metadata, model outputs, tool arguments, and browser evidence; keep them local if you use private code. API keys are excluded.

## Verification and limits

See [the revised anatomy's real-model rehearsal](live-validation/revised-cards/RESULTS.md) for actual outcomes, exported traces, and approval/published-app evidence. The results include successful Minimal runs as well as a regression; the demo does not manufacture a predetermined failure.

`npm.cmd run doctor` checks this laptop's Node runtime, source syntax, starter files and browser launch without a key. `npm.cmd test` runs the full suite in isolated temporary workspaces. `npm.cmd run check` checks core JavaScript syntax. Use one test command at a time because the integration suites reserve local ports.

The tests cover the actual dashboard, browser behavior, real file edits, completion gates, approval and publishing, session resets, restart recovery, evaluation grouping, and evidence export. Provider unit tests use mocked transport; HTTP system and dashboard-lifecycle tests use an explicitly scripted **test-only loopback endpoint**. These tests validate plumbing and control flow, not model capability. They never populate your demo's runtime records, and no scripted provider exists in the app itself.

After adding a key, use **Save & test**, then rehearse at least one fresh Minimal and one fresh Engineered run. The live endpoint, account access, tool-calling compatibility, and actual model behavior cannot be established without those real calls. The exact patch, time, token usage, and comparison outcome remain model-dependent. A successful connection test alone does not establish bug-fixing capability.

The agent has bounded file-edit and browser tools, not unrestricted shell access. Browser preview code runs on a different origin, with external requests blocked by content policy and browser automation routing. This is a local teaching workbench, not a production-grade hostile-code isolation service. Do not point it at an untrusted repository or expose its ports publicly.

The current scope demonstrates a single bug-fixing workflow. It does not benchmark native Android behavior or claim that these controls eliminate all agent errors.
