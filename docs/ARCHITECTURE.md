# Architecture

Harness Lab runs on one laptop. The browser dashboard controls a Node server. That server calls the configured model, executes allowlisted tools, and records measured results. A separate loopback origin serves the model's working copy of Pocket Notes, its published copy and the production view. The v4 design contract is [REDESIGN-V4.md](REDESIGN-V4.md).

## Modules

| Module | Responsibility |
| --- | --- |
| `server.mjs` | Dashboard/API on 4318; preview, published and production routes on 4319; origin checks, explicit run actions and evaluation groups |
| `lib/store.mjs` | Fixture copying, allowed paths, atomic persistence, revisions, public run snapshots, source diffs and validation of the forced-reset settings (`resetAfterCalls`, `resetAfterFirstEdit`) |
| `lib/provider.mjs` | Responses and Chat Completions adapters, tool continuation, aborts, timeouts, token accounting, memory-only credentials, optional request pacing (`MODEL_MIN_INTERVAL_MS`) and bounded HTTP 429 retries (`MODEL_RETRY_429`, default 3) that apply equally to every preset and are recorded as events |
| `lib/runner.mjs` | Context assembly (including the ticket thread), actual model/tool loop, feature-dependent tools, checkpoints, budgets, forced reset, completion and approval |
| `lib/browser.mjs` | Playwright operations and the two protected check tiers: six visible and five held-out checks |
| `public/anatomy.mjs` | Maps recorded events and feature flags to component states; no timed playback or invented stages |
| `public/lesson.mjs` | Evidence-based audience explanations, compatible-run comparison and the claims versus evidence derivation |
| `public/app.js` | Polls state, renders cards, both phones, evidence and the ladder scoreboard, controls run/pause/resume/approval and model setup |
| `scripts/evaluate.mjs` | Repeated live trials and the ladder against a running server; summaries derived from recorded events |

## Request lifecycle

1. A fresh run copies the deliberately buggy fixture `fixtures/notes` into an isolated directory. In harness v4 the file set is `index.html`, `src/app.js`, `src/export.js`, `src/storage.js` and `src/styles.css`, plus a readable PROJECT.md.
2. The runner assembles basic task instructions and enabled project inputs. Instructions & policies receives conventions and completion rules from PROJECT.md. Context management receives its repository map, file metadata and revision, and in v4 the PN-142 ticket thread. Each input gets a separate event with the exact payload for that request.
3. The provider receives instructions, the current session history and permitted tool schemas. The model requests an action or responds with text.
4. The runner validates and executes requested tools serially, appends observations to API history, and records visible evidence.
5. If a forced reset is configured and its trigger is reached (a call count, or the first file edit), the runner ends session 1 and starts session 2 (see below).
6. Completion either publishes directly or runs visible verification and waits for approval, depending on configuration. Revision hashes prevent approval of changed source.

## Tool access

Every preset has the same tool schemas: list_files, read_file, write_file, browser_action and request_completion. run_checks is present only when Verification is on, and save_memory only when Memory is on. The runner rejects an unavailable tool even if a model requests it anyway. `browser_action` can reload, inspect, fill the title and body, and click the editor, notes, backup and save controls. No shell or arbitrary host/network tool exists.

Minimal can inspect PROJECT.md manually and can exercise the browser. Turning off automatic project inputs does not erase knowledge discoverable through tools. Turning off verification removes the protected acceptance tool and completion gate, not all possible manual testing.

## Ticket thread

`fixtures/ticket/PN-142.md` is harness-owned knowledge outside the workspace. It is never copied into a run, never listed, and `read_file` rejects any path to it. When Context management is on and the run's harness version is 4 or later, the runner appends it to the context section under "Related ticket thread PN-142, supplied by the harness:", bounded to 6000 characters. The `context` event records it as part of the exact payload. Minimal receives nothing new. The task text is unchanged.

## Check tiers

Suite `notes-v3` has two tiers that share one tested revision.

- **Visible (6):** draft navigation, refresh, complete saving, clearing the saved draft, original-note preservation and distinct notes. `run_checks` and the final assessment in `request_completion` run only this tier. The completion and approval gates read only visible results.
- **Held-out (5):** backup lists saved notes and never a draft; an existing user's notes survive the upgrade; a restored draft stays literal; automation test ids are intact; the character count matches the restored draft. These use fixed harness data, not fixture data.

Only presenter evaluation (`POST /api/runs/:id/checks`) runs the held-out tier. It stores `run.checks` as the visible result with `run.checks.heldOut` attached. Agent tool results, prompts, compact checks and handoffs never contain held-out results. Tests belong to the harness, outside the model-editable fixture.

Presenter evaluation can run after a model stops. It does not retroactively enforce completion and does not undo publication. Verification-disabled model context excludes its results. A later agent `run_checks` replaces `run.checks` with a visible-only result; the earlier held-out result stays in its `checks` event.

## Production route

The preview origin serves `/production/<runId>/<file>`. When the run has an `appliedRevision` and the published file exists, it serves the published copy; otherwise it serves the pristine fixture, never the sandbox workspace. It uses the same host check and content policy as `/preview` and `/published`. Its page path differs, so its browser storage is separate from the sandbox phone's. `publish()` records `run.appliedAt`. Nothing reaches production except through `publish()`.

## Memory, state and the forced reset

Working files survive in all presets. With Memory on, the runner records observed checkpoints and optionally model-written handoff text. A fresh session clears API conversation history. From v3, a compact handoff is frozen at session start: latest edited files and revisions, a concise check summary, a bounded model-written note and recent action names. Full checkpoints remain in the audit trail. Saved memory does not guarantee task completion.

A run may be created with `resetAfterCalls`, an integer from 2 to 23. After that model call and its tool executions, while still in session 1 and running, the runner records a `reset` event titled "Context limit reached: fresh session required" and sets `run.forcedReset`. It then starts session 2 through the same path that Resume uses. The handoff is supplied only when Memory is on. There is at most one forced reset per run, and the status stays `running` during the transition. A pause during the transition settles as paused. `resetAfterCalls` is part of the evaluation grouping key.

A run may instead be created with `resetAfterFirstEdit: true` (not together with `resetAfterCalls`): the same reset happens right after the model call whose tool executions produced the run's first successful `write_file`, so every preset is cut at the same point in its work rather than at the same call number, and the event and `run.forcedReset` record that call with `resetAfterFirstEdit: true`/`afterFirstEdit: true`. A run that never edits (a loop-only run, for example) never resets, and `resetAfterFirstEdit` is part of the evaluation grouping key, the comparison pairing and the ladder filter.

## Evaluation

## Builder page and loop-only runs

`public/builder.html` is a separate page (`/builder.html`) that shows how a harness is built one component at a time. It reads one recording of real runs from `GET /api/builder` (the file named by `HARNESS_BUILDER_RECORDING`, by default `live-validation/builder/recording.json`, written by `scripts/record-builder.mjs`) and the recorded phone screenshots from `/builder-assets/<name>.png`. When a recorded run still exists on the server, the page shows live preview and production iframes; otherwise it shows the recorded screenshots. The derivations in `public/builder.mjs` are pure functions over the recording. See [the builder design](BUILDER.md).

Two builder-only runtime pieces support the first steps. `POST /api/model/task-only` makes one real model request with the task and no tools and records it under `<data>/model-only/`; no run or workspace is involved. A run created with `loopOnly: true` (mode minimal, every optional feature off) has no tools at all: each text reply is answered with a recorded `observation` event stating that nothing changed, and the run ends at the shared budget. Both are grouped separately in evaluations and excluded from the comparison and the ladder.

Evaluation groups separate model, endpoint, protocol, feature configuration, scenario, harness version, test-suite version and forced-reset setting. `verified` counts runs whose visible tier passed on the current revision. `heldOutVerified` counts runs whose held-out tier passed in full on the current revision. A passing patch, a completed run and an approved publication are different outcomes.

`scripts/evaluate.mjs` creates runs through the same API, waits for each to stop, then runs presenter evaluation. Its `--ladder` mode runs five rungs per trial and its `--out` summary derives "applied without review" and "claimed without a refresh test" from recorded events only.

## Publication and evidence storage

Publication stages all allowlisted files and a harness-owned revision manifest in a new sibling directory, then renames the complete directory into place. Failed staging leaves no partial published app. Atomic JSON snapshots retry bounded transient rename failures without deleting the previous snapshot. If publication succeeds but later event persistence fails, the UI reports a storage warning while retaining the applied status. On restart the manifest is checked against published-file hashes to recover that fact and `appliedAt`. This covers process interruption, not a claim of power-loss durability.

## Data and boundaries

Runtime data defaults to `../../work/harness-lab-runtime` relative to this repository root for compatibility with the original workshop workspace. Set `HARNESS_DATA_DIR` to an absolute directory such as `<checkout>/.data` when running a fresh clone. Never commit this directory. Public exports exclude private API history and credentials.

The server binds to loopback, enforces local control headers and separates preview/dashboard origins. File access uses an allowlist; browser context network requests are restricted to the preview origin. These are teaching-workbench boundaries, not a hardened service for hostile repositories. Keep the ports local.

## Versioning

Version 1 runs retain historical behavior. Version 2 introduced the reduced Minimal tool/completion policy. Version 3 added atomic publication and frozen compact handoffs. Version 4 adds `src/export.js` and the Backup screen, the ticket thread, the two check tiers, the production route and the forced reset. Workspaces created before v4 have no `src/export.js`; revision hashing, diffs, listings and publication skip it, so their recorded revisions stay valid. Historical traces are not retroactively relabeled.
