# Harness Lab v4 redesign specification

Status: build contract for the v4 redesign. Written 26 October 2026. This document is the shared contract for the three work packages below. Read [AGENTS.md](../AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [TESTING.md](TESTING.md) first; they still apply unless this document says otherwise.

## Why v4 exists

The v3 demo compares a Minimal harness (agent loop and tools only) with an Engineered harness (all seven components) on a bug-fixing task in Pocket Notes. Real rehearsals showed the problem: both presets usually fix the bug, so the audience only sees "one of them asked for approval". The task is too small and too local, the comparison is one bit (all off versus all on), Engineered is graded by the same six checks it is allowed to run, and there is no visible consequence when Minimal publishes without review.

The existing evidence already contains the lessons, buried in table rows:

- v3 Minimal `e25d301f`: the completion summary says "survives page refresh" and "all requirements verified through manual testing". The trace contains zero reload actions.
- v2 Minimal `7b1550a9`: a full-file rewrite turned a seed note's line break into a literal backslash-n, and the run burned its token budget on manual browser testing.
- v3 fresh-session Minimal `7bc9ac11`: after a session reset with no handoff, the app no longer rendered.

v4 makes those lessons legible without sabotaging Minimal and without faking anything.

## Thesis

A harness does not make the model smarter. It supplies four things the model structurally lacks, regardless of how capable it is:

1. Knowledge it cannot know (information outside the repository).
2. Observation it cannot make (the regression surface it never looked at).
3. State it cannot keep (across a session reset).
4. Authority it should not have (shipping to the user).

Every new element below maps to one of those four. Nothing in v4 tricks the model; every trap is a property real codebases have.

## Invariants (all existing ones remain, these are added)

- Same task text, same starting files, same budgets, same tool schemas for both presets. The only differences are what the harness supplies and what it requires.
- The ticket thread is harness-owned knowledge outside the agent-readable file set. Engineered's context manager supplies it; Minimal receives the task only. PROJECT.md stays readable by both presets through `read_file`, as before.
- Checks have two tiers. The agent-facing `run_checks` tool and the completion gate use only the visible tier. Held-out checks are presenter-only and are never returned to the agent in any tool result, prompt section or handoff.
- The production copy is the published directory when a publication exists and the pristine fixture otherwise. Nothing is ever applied to production except through the existing `publish()` path.
- A forced session reset, when configured, happens at the same model-call count for both presets and is recorded in the run and in the evaluation grouping key.
- Harness version 4 applies to new runs only. Runs with version 1 to 3 keep their recorded behavior and labels.
- No scripted model output outside tests. No live provider calls during this build. No invented numbers anywhere in the UI or docs; an unmeasured cell stays empty.

## Work package A: backend (fixture, checks, context, production route, forced reset)

### A1. Make the fixture a realistic codebase

Edit `fixtures/notes`:

- Add `src/export.js`. It exports `buildBackup(notes)` which returns a JSON string with the schema `{ "version": 1, "notes": [{ "id", "title", "body", "date" }] }`. Keep it under 20 lines. It must read notes through the existing storage module (`readNotes`), never through a private key of its own.
- Add a third screen to `src/app.js`: a **Backup** tab with `data-testid="backup-tab"`. The screen renders a readonly `<textarea data-testid="backup-output">` containing `buildBackup(readNotes())` and a line `<span data-testid="backup-count">N notes</span>` followed by the words "Unsaved drafts are never included." Keep all existing `data-testid` attributes and the existing behavior and bug exactly as they are. The draft bug stays in `src/storage.js` untouched.
- Add minimal styles for the backup screen to `src/styles.css`.
- Update `fixtures/notes/PROJECT.md`: the repository map lists `src/export.js` ("backup JSON, schema version 1, read by the Backup screen and by the release checker"). Conventions add: backups never include unsaved drafts; keep existing storage keys and value shapes so current users' notes survive an upgrade, add new keys rather than renaming; `data-testid` attributes are used by QA automation; user text stays literal. Keep PROJECT.md concise.
- In `lib/store.mjs`, add `src/export.js` to `FILES` so it is copied, editable, hashed into the revision and included in diffs and publication.

Add harness-owned knowledge outside the workspace at `fixtures/ticket/PN-142.md`, roughly 40 lines, written as a real ticket thread:

- Title: "Draft disappears when switching tabs or refreshing".
- Reporter description of the bug with steps.
- QA comment: automation locates elements by `data-testid`; the Backup screen is part of the release checker; please do not rename or drop test ids.
- Incident reference INC-37: a storage refactor earlier this year renamed the notes key and existing users lost their notes; the rule since then is to keep existing keys and shapes and add new keys for new data.
- Product comment: backups must never include unsaved drafts (privacy decision after INC-37).
- Deployment note: the app is served from more than one path, which is why storage keys carry the path prefix.

This file is never copied into a workspace, never in `READABLE`, and `read_file` must reject it as it rejects any unlisted path.

### A2. Two check tiers, suite `notes-v3`

Edit `lib/browser.mjs`:

- `CHECK_SUITE_VERSION = 'notes-v3'`.
- `runChecks(run, { tier = 'visible' })` where `tier` is `'visible'`, `'heldOut'` or `'all'`.
- Visible tier: the existing six checks, unchanged in meaning.
- Held-out tier, with harness-owned fixed data (never from the fixture):
  1. **Backup lists saved notes and never a draft.** Fill a draft without saving, open the Backup tab, parse the textarea as JSON: `version` is 1, `notes` has exactly the two seed notes, no note contains the draft text. Then save the draft and reopen Backup: three notes, including the saved one with its exact body.
  2. **An existing user's notes survive the upgrade.** Load the page, write a harness-owned note array containing one custom note under the current key `pocket-notes:<pathname>:notes` with `page.evaluate`, reload, open My notes: the custom note is listed. Save a new note and refresh: the custom note is still listed.
  3. **A restored draft stays literal.** Fill the body with text containing `<b>bold</b>`, an ampersand, quotes and a `<script>` tag, switch to My notes and back: `inputValue` equals the text exactly, no `<b>` or `<script>` element exists inside the editor section, and no page error occurred.
  4. **Automation test ids are intact.** `editor-tab`, `notes-tab`, `backup-tab`, `note-title`, `note-body`, `save-note` exist on the editor screen; `notes-list` on the notes screen; `backup-output` and `backup-count` on the backup screen.
  5. **The character count matches the restored draft.** Fill a body, switch screens and back, `#character-count` reads `<length> characters`.
- Result shape for the visible tier stays what it is today so that `run.checks.passed`, `run.checks.total`, `run.checks.revision` and `compactChecks` keep their meaning. Add `tier: 'visible'` to it. A held-out result has the same shape with `tier: 'heldOut'`.
- Presenter evaluation (`POST /api/runs/:id/checks`) runs both tiers and stores `run.checks = visibleResult` with `run.checks.heldOut = heldOutResult`. The presenter event detail lists both tiers separately.
- The agent tool `run_checks` and the final assessment in `request_completion` run the visible tier only. Their results must not contain `heldOut`. The completion gate uses visible results only. `compactChecks` and `buildHandoff` must strip `heldOut` if it is ever present.
- `evaluationSummary` in `server.mjs` adds `heldOutVerified` (runs whose held-out result matches the current revision and passed in full) next to `verified`.

### A3. Supply the ticket thread through context management

Edit `lib/runner.mjs`:

- In `assembleModelInput`, when `run.features.context` is on and `run.harnessVersion >= 4`, append to `sections.context` a block headed "Related ticket thread PN-142, supplied by the harness:" followed by the ticket file content, bounded to 6000 characters. The existing `context` event therefore records the ticket as part of the exact payload sent.
- Minimal receives nothing new. Do not change the task text in `lib/store.mjs`.
- `createRun` sets `harnessVersion = 4`. Keep every `harnessVersion` branch for 1 to 3 intact.
- Anything in the base prompt that enumerates files should be generated from `READABLE`, so `src/export.js` appears automatically.

### A4. Production route

Edit `server.mjs` (preview server):

- Add `/production/<runId>/<file>`: serves the file from the run's `published` directory when `run.appliedRevision` is set and the published file exists, otherwise from the pristine fixture. Same host and CSP rules as `/preview` and `/published`.
- In `publish()` set `run.appliedAt` (ISO time). `publicRun` already exposes run fields.

### A5. Forced session reset at an equal point

- `createRun` accepts `resetAfterCalls` (integer between 2 and 23, or absent). Store it as `run.resetAfterCalls`. `POST /api/runs` passes it through.
- In the runner loop, after the model call number `resetAfterCalls` and its tool executions finish, and only while `run.session === 1` and the run is still `running`: record an event of kind `reset` titled "Context limit reached: fresh session required" with detail explaining that the previous API conversation is cleared and that the configured memory policy decides what is restored. Then end the session and start session 2 exactly as `resumeRun` does (handoff only when memory is enabled). Exactly one automatic reset per run.
- Map kind `reset` to the Agent loop card in `public/anatomy.mjs` (work package B does the UI; A adds the event kind and documents it in the handoff to B).
- Include `resetAfterCalls` in the evaluation grouping key and in `comparableRuns` matching (B owns `lesson.mjs`; A documents the field).

### A6. Tests for package A

Add to the existing suites or new files under `tests/`:

- `run_checks` results and completion assessment contain no `heldOut`; presenter checks do; the gate ignores held-out results.
- Context section includes the ticket only when context is enabled and the harness version is 4; `read_file` of `../ticket/PN-142.md` and of `PN-142.md` is rejected.
- Production route serves the fixture before publication and the published copy after.
- The buggy fixture's Backup screen renders and lists the two seed notes.
- Held-out checks are meaningful: using a test-only reference patch kept inside `tests/` (never in `fixtures/` or `lib/`), assert the held-out tier passes on a correct fix and fails the backup check on a wrong fix that stores the draft inside the notes array. This proves the checks measure something.
- Forced reset: with the test-only scripted provider, both presets reset at the same call; Minimal's session 2 prompt has no handoff; Engineered's does.
- All existing tests keep passing (update suite-version expectations).

## Work package B: dashboard

Edit `public/` and the dashboard tests. Keep the current visual language.

### B1. Production phone

A second phone next to the sandbox phone, labeled PRODUCTION. Its iframe loads `/production/<id>/index.html?rev=<appliedRevision or original>`. A banner above it states one of:

- "Original build. No change applied." while ready or running.
- "Original build. One change is waiting for your approval." while awaiting approval.
- "Updated automatically by the agent at <time>. No review." when completed without the approval feature.
- "Updated after your approval at <time>." when completed with approval.

The sandbox phone is labeled SANDBOX. Both phones must fit in Focus mode at 1280×720 and 1440×900.

### B2. Held-out checks in the verification card

Two groups: "Checks the agent can run" and "Held-out checks (presenter only)". The summary reads like "6/6 visible · 5/5 held-out" and shows "not measured" for an absent tier. Explain & compare adds a held-out row.

### B3. Claims versus evidence

A panel (or dialog opened from the activity toolbar) titled "What it claimed, what was observed", available once a run contains a `request_completion` tool event. Left column: the summary text verbatim. Right column: a table with one row per behavior (switch screens, refresh, save, clear draft, preserve existing notes, distinct notes, backup, literal text) and three columns:

- Agent exercised in browser: derived only from recorded `browser_action` tool events after the last `write_file`. Refresh means a `reload`; switch means `notes-tab` then `editor-tab` after a `fill`; save means a `save-note` click; backup means a `backup-tab` click; literal means a `fill` whose value contains `<`.
- Agent ran acceptance checks: count of `run_checks` after the last edit, or "tool not available" when verification is off.
- Harness result: the matching visible or held-out check result, or "not measured".

Footer text: "Claims are the model's words. Observations are recorded tool actions. This panel does not interpret model reasoning." Implement the derivation as a pure function `claimsEvidence(run)` in `public/lesson.mjs` with unit tests.

### B4. What each agent was told

In Explain & compare, add a section showing, for the selected run and its compared run, the first `prompt` event's assembled instructions plus the task, side by side in two scrollable monospace columns with character counts. Minimal's column is short by nature; do not pad it.

### B5. Ladder scoreboard

In Runs & evals, add a table ordered Minimal, +Verification, +Instructions & context, +Memory, Engineered (then any other custom configuration), built from the existing evaluation groups filtered to one model, scenario, harness version and reset setting. Columns: trials, completed, visible pass, held-out pass, applied without review, claimed without a refresh test (completed runs with a `request_completion` event and no `reload` and no `run_checks` after the last edit), average calls, average tokens. Empty cells where nothing is measured. No invented values.

### B6. Card text and legend

Update the Context management card to mention the ticket thread and the Verification card to mention visible versus held-out tiers. Map event kind `reset` to the Agent loop card; a disabled Memory card must never highlight on a reset.

### B7. Tests

Dashboard tests for the production banner states, held-out rendering, the claims panel built from a recorded run fixture, the inputs comparison and the ladder table. Unit tests for `claimsEvidence` and for `comparableRuns` with `resetAfterCalls`.

## Work package C: evaluation ladder and documentation

### C1. `scripts/evaluate.mjs`

- `--ladder` runs these rungs for each trial, alternating order between trials: `minimal`; `verification`; `verification,instructions,context`; `verification,instructions,context,memory`; `engineered`.
- `--rungs` accepts a custom comma-separated list of feature sets.
- `--reset-after N` passes `resetAfterCalls` to every run in the ladder, so the memory rung is a real interrupted task and every rung is interrupted equally.
- `--out <file>` writes a JSON summary with, per run: rung, scenario, status, visible and held-out results, calls, tokens, elapsed, applied without review, claimed without a refresh test.
- Keep the existing `--trials` and `--scenarios` behavior. The script still makes real, billable calls and still says so.
- Tests cover rung generation and argument validation without any live call.

### C2. Documentation

Update so that the documents describe v4 truthfully:

- `README.md`: the scenario (Backup screen, ticket thread), the two phones, two check tiers, the ladder, harness version 4.
- `ANATOMY-DEMO.md`: rewrite as the failure-first flow: feel the bug; four ways a correct-looking patch is wrong; run Minimal and show what it was told; production updates by itself; try the traps on production; claims versus evidence; run Engineered and show its inputs; the gate and repair loop; approval; held-out grading; optional forced reset; ladder; closing line "the model did not get smarter".
- `docs/DEMO-CUE-CARD.md`, `docs/PRESENTER.md`: the same flow with what to say and which component each step proves, including the branch where Minimal passes everything.
- `docs/ARCHITECTURE.md`, `docs/TESTING.md`: tiers, ticket, production route, forced reset, new tests.
- `docs/PROJECT-STATUS.md`: v4 implemented and covered by automated tests; no live v4 evidence yet; the next step is running the ladder with a reliable paid model; v2 and v3 evidence stays historical and must not be pooled with v4.
- `AGENTS.md`: add the new invariants from this document, keep it short.
- `presentation/speaker-notes.md`: rewrite the demo slides' notes for the new flow and mark the deck rebuild as pending.
- Leave `live-validation/` untouched.

## Process rules for everyone working on this

- Work only inside `C:/Projects/harness-lab`. Never modify the original repository under `C:/Users/Shubham/Documents/Codex`.
- Make no live model calls and consume no provider quota.
- Do not commit. Leave changes in the working tree.
- Run one test command at a time; integration tests reserve ports and launch Chromium. Use `node --test tests/<file>` for a focused run and `npm test` for the full suite at the end.
- Set `HARNESS_DATA_DIR` to `C:/Projects/harness-lab/.data` if you start the server manually.
- Report what you changed, what you tested with results, and anything left undone.

## Implementation notes from package A

Written by the package A implementer for packages B and C. Everything below is implemented in the working tree and covered by automated tests (no live provider calls were made). Field names are exact.

### Fixture and file set

- `fixtures/notes/src/export.js` exports `buildBackup(notes = readNotes())`, returning `JSON.stringify({ version: 1, notes: [{ id, title, body, date }] }, null, 2)`. It imports `readNotes` from `./storage.js`.
- `src/app.js` has a third tab `<button data-testid="backup-tab">Backup</button>` after My notes. The backup screen is `<section class="backup">` with `<textarea data-testid="backup-output" readonly>` containing `buildBackup(readNotes())` and `<p class="backup-note"><span data-testid="backup-count">2 notes</span> Unsaved drafts are never included.</p>` (the count reads "1 note" for one note). The draft bug in `src/storage.js` is untouched.
- `lib/store.mjs`: `FILES = ['index.html', 'src/app.js', 'src/export.js', 'src/storage.js', 'src/styles.css']`; `READABLE = [...FILES, 'PROJECT.md']`. New exports: `TICKET`, `HARNESS_VERSION` (4), `V4_FILES` (`['src/export.js']`), `presentFiles(dir, names)`, `RESET_AFTER_CALLS` (`{ min: 2, max: 23 }`).
- Workspaces created before v4 have no `src/export.js`. Revision hashing, `diff`, `publish`, `list_files` and the context file listing skip a missing `V4_FILES` entry, so v1 to v3 revisions keep the exact formula and value they had (tested).
- `browser_action` accepts `click` on `backup-tab` (targets are now `['', 'editor-tab', 'notes-tab', 'backup-tab', 'save-note', 'note-title', 'note-body']`, exported from `lib/browser.mjs` as `BROWSER_CLICK_TARGETS` and `BROWSER_FILL_TARGETS`). The schema is identical for every preset. For B3, a backup action appears in recorded `tool` events as `{ tool: 'browser_action', arguments: { action: 'click', target: 'backup-tab', value: '' } }`.

### Ticket thread (A3)

- File: `fixtures/ticket/PN-142.md` (about 2.6 KB). It is outside `fixtures/notes`, so it is never copied into a workspace; it is not in `READABLE`; `read_file` rejects `../ticket/PN-142.md`, `PN-142.md` and similar paths with "Invalid path argument." (schema enum), and `filePath` rejects them with "Permission denied".
- When `run.features.context` is on and `run.harnessVersion >= 4`, `assembleModelInput` appends to `sections.context` (after the file list, revision and any "Latest observed checks" line):

  ```
  \n\nRelated ticket thread PN-142, supplied by the harness:\n<ticket text, CRLF normalized to LF, sliced to 6000 characters>
  ```

  The existing `context` event (`kind: 'context'`, `content`) therefore records the ticket inside the exact payload sent. Minimal (context off) receives nothing new. Versions 1 to 3 never get the ticket.

### Check tiers (A2), suite `notes-v3`

- `runChecks(run, { tier })` with `tier` `'visible'` (default), `'heldOut'` or `'all'`; any other value throws "Unknown check tier". `'all'` returns the visible result with the held-out result attached as `heldOut`. Both tiers share one tested revision.
- `CHECK_NAMES` (visible, 6) is unchanged. `HELD_OUT_CHECK_NAMES` (5): "Backup lists saved notes and never a draft", "An existing user's notes survive the upgrade", "A restored draft stays literal", "Automation test ids are intact", "The character count matches the restored draft". `/api/state` now returns `heldOutCheckNames` next to `checkNames`.
- Visible result shape (same as before plus `tier`):

  ```
  { suiteVersion: 'notes-v3', tier: 'visible', revision: '<12 hex>', at: '<ISO>', passed: 4, total: 6,
    results: [{ name, passed, detail, durationMs, screenshot, screenshotError? }],
    scenario: 'draft', screenshot: '<last screenshot url>', origin: 'agent' | 'presenter',
    heldOut?: <held-out result, presenter only> }
  ```

- Held-out result shape: identical keys with `tier: 'heldOut'`, `total: 5`, the held-out names and `origin: 'presenter'`. `scenario` is copied from the run for shape compatibility only; held-out data is fixed harness data and does not vary by scenario. Held-out screenshot filenames contain `-h<index>-`.
- Agent path: `run_checks` and the final assessment in `request_completion` run `tier: 'visible'` and pass the result through `withoutHeldOut`; agent-produced `run.checks` and tool results never contain `heldOut`. The completion gate and the approval gate read only `run.checks.passed/total/revision/suiteVersion` (a failing `heldOut` does not block approval; tested). `compactChecks` builds explicit fields only; `buildHandoff` uses `compactChecks`; the v1/v2 prompt paths strip `heldOut` too.
- Presenter path: `POST /api/runs/:id/checks` stores `run.checks = visible` with `run.checks.heldOut = heldOut`, both with `origin: 'presenter'`. The `checks` event keeps `kind: 'checks'`, `phase: 'end'`, `origin: 'presenter'`, the title `"<visible passed>/<visible total> checks passed"`, and `result` (the visible result including `heldOut`). Its detail is:

  ```
  Presenter evaluation of source revision <rev>. This did not change the agent's completion decision.

  Checks the agent can run (visible tier): 4/6 passed.
  FAIL Draft survives switching screens: ...
  ...

  Held-out checks (presenter only, never shown to the agent): 3/5 passed.
  PASS Backup lists saved notes and never a draft: ...
  ...
  ```

- Observed on the unfixed fixture: visible `[false, false, true, true, true, true]` (4/6), held-out `[true, true, false, true, false]` (3/5). The literal and character-count checks fail there because the draft is lost.
- Only the presenter route produces a held-out result. An agent `run_checks` after a presenter evaluation replaces `run.checks` with a visible-only result, so the earlier held-out result is then no longer on `run.checks` (it remains in that `checks` event's `result`).

### Evaluation summary (`GET /api/evals`)

- The grouping key adds `resetAfterCalls` (`run.resetAfterCalls ?? null`, so runs without it group as `null`). Each group gains `resetAfterCalls` and `heldOutVerified`.
- `heldOutVerified` counts runs whose `run.checks.heldOut` has `suiteVersion === 'notes-v3'`, `revision === run.revision`, and `passed === total` with `total > 0`. `verified` is unchanged (visible tier, current suite, current revision). `checkSuiteVersion` is `'notes-v3'`.
- B still needs `comparableRuns` in `public/lesson.mjs` to match `(other.resetAfterCalls ?? null) === (run.resetAfterCalls ?? null)`; package A did not edit `public/`.

### Production route and publication time (A4)

- Preview origin only (`http://127.0.0.1:4319`): `GET /production/<runId>/<file>` for `file` in `FILES`. If `run.appliedRevision` is set and `<runDir>/published/<file>` exists, it serves the published file; otherwise it serves `fixtures/notes/<file>` (the pristine fixture, never the sandbox workspace). Same host check and CSP as `/preview` and `/published`; unknown runs or files return 404 JSON. The dashboard origin does not serve it.
- Because the page path differs, production has its own storage prefix `pocket-notes:/production/<id>/index.html:`. Notes typed into the sandbox phone do not appear in the production phone and vice versa.
- `publish()` sets `run.appliedAt` (ISO), equal to the `at` value written in `published/.publication.json`; restart recovery restores it from the manifest. New runs start with `appliedAt: null`. B1's banners can use `status`, `features.permissions`, `appliedRevision` and `appliedAt`; the iframe can use `?rev=<appliedRevision or 'original'>` as specified.

### Forced session reset (A5)

- `createRun({ resetAfterCalls })` and the `POST /api/runs` body field `resetAfterCalls`: an integer from 2 to 23, or absent/`null`. Anything else (including the string `"2"`) returns HTTP 400 "resetAfterCalls must be an integer from 2 to 23, or omitted." Stored as `run.resetAfterCalls` (`null` when absent) and exposed by `publicRun`.
- After model call number `resetAfterCalls` and all of its tool executions, and only while `run.session === 1`, `run.status === 'running'`, no pause is in progress and no forced reset happened before, the runner records:

  ```
  { kind: 'reset', title: 'Context limit reached: fresh session required',
    detail: 'Configured forced reset after model call N (resetAfterCalls = N); every preset resets at this same call count. This is a harness setting that simulates a context limit, not a provider error. The previous API conversation is cleared. The configured memory policy decides what is restored: <memory sentence>. Workspace files remain as they are.',
    call: N, session: 1, resetAfterCalls: N, memory: true | false }
  ```

  and sets `run.forcedReset = { afterCall: N, session: 1, at: '<ISO>' }`. The memory sentence says either that a frozen handoff is supplied (memory on) or that no handoff is supplied (memory off).
- The session-1 loop then ends normally (its `finally` releases the controller). Only after it settles does the runner start session 2, through the same function `resumeRun` uses (`sessionHandoff` only when memory is enabled, history cleared, `session` incremented). Session 2 begins with the usual `run` event "Fresh model session started" and, with memory, "Saved progress restored into this session". `run.status` stays `'running'` throughout the transition, so pollers never see a false terminal state.
- Pause during the transition: the run settles as `paused` with one "Paused at a safe tool boundary" event (kind `memory`; when the pause lands after the loop released its controller, the detail says "Paused during the forced session reset"). No session starts behind the pause; Resume starts session 2. If the automatic start is refused (for example because the provider settings changed), the run becomes `paused` with an `error` event "Fresh session could not start". There is at most one forced reset per run.
- B6: `public/anatomy.mjs` currently maps unknown kinds to no component, so `reset` highlights nothing until B maps it to `['loop']`. Never map it to Memory.

### Tests and helpers

- `tests/support/reference-patches.mjs` (not matched by the `tests/*.test.mjs` glob): TEST-ONLY `correctStorage`, `draftInNotesStorage`, `draftInNotesApp`, `fixtureSource` and `applyReferencePatch(workspaceDir, 'correct' | 'draft-in-notes')`. It refuses to write under `fixtures/`. The draft-in-notes patch passes all 6 visible checks and fails only held-out check 1 (`[false, true, true, true, true]`); the correct patch passes 6/6 and 5/5.
- `tests/v4-runner.test.mjs` (in process, mocked transport): harness version 4 and the export file, `resetAfterCalls` validation, the ticket only with context on v4, the ticket unreadable, held-out results never in prompts, compact checks or handoffs, the Backup tab target, the forced reset for both presets at the same call (Minimal without handoff, Engineered with), a pause at two points during the reset, a refused automatic start, and legacy workspaces without `src/export.js`.
- `tests/v4-system.test.mjs` (server on ports 4418/4419, scripted loopback provider on 4420, real Chromium): the Backup screen of the unfixed fixture, the production route before and after publication, held-out meaning with both reference patches, the forced reset over HTTP for both presets, `appliedAt`, and `heldOutVerified` and `resetAfterCalls` in `/api/evals`.
- Updated: `tests/integration.test.mjs` (presenter held-out shape and detail, no `heldOut` in `run_checks` or completion results, approval ignores a failing held-out result, `appliedAt`), `tests/system.test.mjs`, `tests/runner.test.mjs` and `tests/check-version.test.mjs` (harness version 4, `src/export.js`), and `tests/storage.test.mjs` (`appliedAt` restored after restart).
- `scripts/doctor.mjs` also checks that the ticket file exists.
