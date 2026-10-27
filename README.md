# Harness Lab

A local, interactive workshop about agent harness engineering. A real model edits a real mobile-style Notes application. Protected browser checks measure what actually works, including checks the agent never sees.

[PowerPoint workshop](presentation/Agent-Harness-Workshop.pptx) · [Presenter guide](docs/PRESENTER.md) · [Setup and troubleshooting](docs/OPERATIONS.md) · [Architecture](docs/ARCHITECTURE.md) · [Testing](docs/TESTING.md) · [Agent instructions](AGENTS.md) · [v4 design](docs/REDESIGN-V4.md)

## Start

Moving to another laptop? Give its coding agent [the setup handoff](docs/HANDOFF.md).

For the latest tested state, real-run outcomes, limitations and next work, read [Project status](docs/PROJECT-STATUS.md).

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

Use **Explain & compare** for a plain-language outcome summary and a comparison of matching runs. It separates source checks, agent status, completion requirements, approval and application. It also shows **what each agent was told**: the assembled instructions and task of both runs, side by side. Only actual runs with the same task, scenario, provider, harness version, forced-reset setting and session count can be paired.

The seven **Harness anatomy** cards match the presentation: Agent loop, Tools & sandbox, Instructions & policies, Context management, Memory & state, Guardrails, and Verification. Orchestration is omitted; the activity log remains part of the demo interface. Blue cards are Enabled and gray cards are Off. Minimal has exactly two enabled cards. An orange outline marks recorded activity, red indicates a block, and the current-action strip explains the consequence. Click a card for its meaning and latest evidence. The display never claims to reveal internal model thinking.

On another machine, run `npm install` and `npx playwright install chromium` first. The workbench and application preview use separate loopback ports, 4318 and 4319. No hosted service is required for the UI or browser checks.

## API setup

Use the dashboard's model setup screen. Enter your API key, exact model ID, and endpoint. OpenAI uses `https://api.openai.com/v1` with the Responses protocol. An internal server can use the Chat Completions-compatible adapter if it implements tool calling with that protocol. Other internal protocols need a custom adapter.

Keys entered in the screen live only in the server process memory and disappear when the server stops. The key is never returned to the UI, included in events, or written in run files. Alternatively, copy `.env.example` to `.env` and enter your configuration there. `.env` is ignored by Git. Model settings are pinned when each run starts. Rate-limited endpoints, including free OpenRouter models, need `MODEL_MIN_INTERVAL_MS` (milliseconds between request starts) and optionally `MODEL_RETRY_429`; both apply equally to every preset and every retry is recorded as an event.

There is **no simulated agent mode**. Without a key and model ID, you can reproduce the real bug, inspect the application, and run real browser checks. The model runner stays locked. Connection tests and agent runs make real API calls and incur provider usage.

The **Run coding agent** button stays visible but disabled until a key and model ID are configured. Next to it, **Run browser checks without a key** exercises the real app immediately. The separate **Connect a model** control opens API setup. For a short walkthrough, see [the anatomy demo guide](ANATOMY-DEMO.md).

## The scenario

Pocket Notes has three screens: **Draft**, **My notes** and **Backup**. The Backup screen shows the saved notes as JSON (schema version 1) and states that unsaved drafts are never included.

1. Enter a title and draft text.
2. Select **My notes**, then **Draft**. The unfinished draft disappears.
3. Refreshing also loses the draft.
4. The task asks the agent to preserve drafts across both actions, keep saving correct, clear saved drafts, and preserve existing notes.

The defect is deliberately present in the starter application. Each new run receives an identical fresh copy. The patch comes from the model, never from a scripted solution.

The codebase also has properties real codebases have. QA automation uses the `data-testid` attributes. Existing users already have notes under the current storage key. Backups must never contain a draft. User text must stay literal. A patch can fix the visible bug and still break one of these.

A support **ticket thread, PN-142**, records why those rules exist. For example, incident INC-37 was a storage refactor that renamed the notes key and hid existing users' notes. The ticket is harness-owned. It lives outside the workspace, no tool can read it, and only Context management supplies it to the model. PROJECT.md remains readable by every preset through `read_file`.

## The two phones

The workbench shows two phones side by side.

- **SANDBOX** is the agent's working copy. It changes as the agent edits files.
- **PRODUCTION** is what users get. It serves the published copy once a change has been applied, and the original build before that. Nothing reaches production except through the existing publication path. A banner states whether production is the original build, is waiting for approval, was updated automatically with no review, or was updated after approval.

Production keeps its own browser storage, so notes typed into the sandbox phone do not appear there. You can save a note on production before a run and check after an update whether it survived.

## Two check tiers

Checks belong to the harness and live outside agent-editable paths. Suite `notes-v3` has two tiers.

- **Visible checks (6).** The agent can run them with `run_checks` when Verification is on, and the completion gate requires them to pass. They cover switching screens, refresh, saving, clearing the saved draft, preserving existing notes and distinct notes.
- **Held-out checks (5, presenter only).** They are never returned to the agent in any tool result, prompt or handoff. They cover: the backup lists saved notes and never a draft; an existing user's notes survive the upgrade; a restored draft stays literal; automation test ids are intact; the character count matches the restored draft.

**Evaluate outcome** runs both tiers after the agent stops. The Verification card shows them as two groups. A run can pass every visible check and fail a held-out one. That is the point: the agent's own checks are finite. On the unfixed starter app, the automated tests observe 4/6 visible and 3/5 held-out.

## Presenting the workshop

The full flow is in [the anatomy demo guide](ANATOMY-DEMO.md) and [the cue card](docs/DEMO-CUE-CARD.md). In short:

1. Show the bug on the sandbox phone. Name the four traps a correct-looking patch can fall into.
2. Run Minimal. Show what it was told. If it completes, production updates by itself with no review.
3. Try the traps on the production phone. Open **What it claimed, what was observed** to compare the agent's summary with its recorded tool actions.
4. Run Engineered on the same task and model. Show its extra inputs, including the ticket thread. Show the gate and approval.
5. Click **Evaluate outcome** on both runs to grade the held-out tier.
6. Optionally show a forced session reset, then the **ladder scoreboard**.

Minimal may pass everything. Report that honestly. The difference is then what each runtime supplied and required, not a manufactured failure.

## What the controls mean

| Feature | Actual behavior |
| --- | --- |
| Instructions & policies | Automatically includes project rules and conventions from PROJECT.md, separately from its repository map |
| Context management | Supplies a focused repository map, file sizes, current revision and, in harness v4, the PN-142 ticket thread; presenter check results stay out of verification-disabled model context |
| Memory & state | Exposes save_memory, saves measured checkpoints and restores progress into a fresh session; off means no handoff or checkpoints, while working files remain |
| Verification | Exposes run_checks for the visible tier and requires passing visible checks before completion; held-out checks are never available to the agent |
| Guardrails: approval | Requires human approval before publishing to production; off means the agent's completion publishes immediately |

All presets share the task text, starting files, tool schemas, the agent loop, file/browser tools, workspace isolation and execution budgets. Minimal has basic task/conversation context. The agent cannot edit the harness, protected checks, credentials, or other host files. "Production" here is the run's isolated published directory, not a real deployment. A permission probe is explicitly labeled as a user-triggered boundary test, never as something the model attempted.

### Forced session reset

A run can be created with a forced reset: the optional **Forced session reset** field when preparing a workspace, the API field `resetAfterCalls`, or `--reset-after` in the evaluation script. The value is a model call number from 2 to 23. After that model call and its tool executions, the harness records a **Context limit reached: fresh session required** event and starts session 2. The previous API conversation is cleared. Working files remain. With Memory on, a frozen handoff is supplied; with Memory off, nothing is. The reset happens at the same call count for every preset, and it is part of the evaluation grouping. It simulates a context limit; it is not a provider error.

### Harness versions

New runs use **harness version 4**: the Backup screen and `src/export.js`, the ticket thread in context, two check tiers, the production route and the optional forced reset. Runs from versions 1 to 3 keep their recorded behavior and labels. Earlier live outcomes are historical and are not evidence of version 4 behavior.

## Evaluations

Run the same configuration several times before claiming a reliability improvement. Three scenario variants cover normal text, Unicode/literal markup, and longer multiline drafts. These are variants of one task, not a broad benchmark.

Every command below makes **real, billable model calls** against the running server. The script refuses to start when no provider is configured. It never approves a proposal.

```powershell
# One Minimal and one Engineered trial per scenario (six trials)
node scripts/evaluate.mjs --trials 1 --scenarios draft,unicode,longform

# The ladder: five rungs per trial, a forced reset after call 8, summary written to a file
node scripts/evaluate.mjs --ladder --trials 3 --reset-after 8 --out ladder-results.json
```

The ladder rungs are Minimal; +Verification; +Instructions & context; +Memory; Engineered (which adds approval). `--rungs "minimal;verification+memory;engineered"` runs a custom list. The order alternates between trials. `node scripts/evaluate.mjs --help` prints every option without contacting the server. After each agent stops, the script runs a separate presenter assessment of both tiers with no model calls; this cannot affect that agent's decisions.

`--out` writes, per run: rung, scenario, status, visible and held-out results, calls, tokens, elapsed time, **applied without review** (completed with approval off and a publication recorded) and **claimed without a refresh test** (the agent requested completion, and after its last file write it neither reloaded the page nor ran checks). Both flags come only from the run's recorded events.

**Runs & evals** groups results by model, endpoint, scenario, feature configuration, harness version, forced-reset setting and check suite. Its **ladder scoreboard** puts the rungs in order for one model, scenario, harness version and reset setting. Cells stay empty where nothing was measured. This app does not invent dollar estimates. Inspect failed runs and denominator sizes. A stronger harness may add overhead and the minimal version may succeed.

## Architecture and files

- `server.mjs`: loopback-only dashboard API and separate-origin application preview, published copy and production route.
- `lib/provider.mjs`: OpenAI Responses and compatible Chat Completions adapters.
- `lib/runner.mjs`: real model/tool loop, budgets, memory, forced reset and completion control.
- `lib/store.mjs`: isolated workspaces, event records, revision hashing and persistence.
- `lib/browser.mjs`: actual browser tools and the two protected check tiers.
- `fixtures/notes/`: the deliberately buggy starting application.
- `fixtures/ticket/PN-142.md`: harness-owned ticket thread, never copied into a workspace.
- `public/`: the presentation dashboard.
- `scripts/evaluate.mjs`: repeated live trials and the ladder.

Runtime records, source copies and screenshots go to `../../work/harness-lab-runtime/` by default. Set `HARNESS_DATA_DIR` to override this. Saved records include application source, provider endpoint/model metadata, model outputs, tool arguments, and browser evidence; keep them local if you use private code. API keys are excluded.

## Verification and limits

`npm.cmd run doctor` checks this laptop's Node runtime, source syntax, starter files, the ticket file and browser launch without a key. `npm.cmd test` runs the full suite in isolated temporary workspaces. `npm.cmd run check` checks core JavaScript syntax. Use one test command at a time because the integration suites reserve local ports.

The tests cover the actual dashboard, browser behavior, real file edits, both check tiers, the ticket boundary, the production route, completion gates, approval and publishing, forced and manual session resets, restart recovery, evaluation grouping, the evaluation script and evidence export. Provider unit tests use mocked transport; HTTP system and dashboard-lifecycle tests use an explicitly scripted **test-only loopback endpoint**. These tests validate plumbing and control flow, not model capability. They never populate your demo's runtime records, and no scripted provider exists in the app itself.

**First live v4 evidence:** [the v4 live report](live-validation/v4/RESULTS.md) records a five-rung ladder across all three scenarios and a forced-reset ladder, run on 26 October 2026 with `cohere/north-mini-code:free`, one trial per cell. Historical real-model evidence is in [the v3 report](live-validation/v3/RESULTS.md) and [the v2 report](live-validation/revised-cards/RESULTS.md). It used an earlier fixture and a single check tier, so do not pool it with v4 results.

After adding a key, use **Save & test**, then rehearse at least one fresh Minimal and one fresh Engineered run. The live endpoint, account access, tool-calling compatibility, and actual model behavior cannot be established without those real calls. The exact patch, time, token usage, and comparison outcome remain model-dependent. A successful connection test alone does not establish bug-fixing capability.

The agent has bounded file-edit and browser tools, not unrestricted shell access. Browser preview code runs on a different origin, with external requests blocked by content policy and browser automation routing. This is a local teaching workbench, not a production-grade hostile-code isolation service. Do not point it at an untrusted repository or expose its ports publicly.

The current scope demonstrates a single bug-fixing workflow. It does not benchmark native Android behavior or claim that these controls eliminate all agent errors.
