# Testing and evidence

Read [Project status](PROJECT-STATUS.md) for the latest evidence snapshot, the current suite count and remaining environment-specific checks.

Run `npm run doctor`, then `npm test`. On Windows PowerShell use `npm.cmd` if execution policy prevents npm.ps1. Run only one test command at a time, with live rehearsals idle. The npm command runs test files sequentially so their separate Chromium processes do not compete with each other on presentation laptops. For a focused run use `node --test tests/<file>`. Acceptance assertions and timeout limits remain unchanged.

The suite covers pure anatomy mapping, provider parsing, tool access, actual HTTP adapters, real filesystem/browser behavior, both check tiers, revision-bound approval, exports, fresh sessions, the forced reset, abrupt restart, eval grouping, evaluation-lock timing, the evaluation script and responsive dashboard controls. Doctor also checks that the ticket file exists.

Tests use isolated temporary data directories and explicit test-only HTTP providers. They never populate the demo history. Test repairs exist only inside test code. A passing test suite proves implementation behavior under those inputs; it does not prove a live model will fix the bug.

## Harness v4 tests

These are deterministic implementation tests. None of them is a real-provider rehearsal.

- `tests/v4-runner.test.mjs` (in process, mocked transport): new runs use harness version 4 and include `src/export.js`; `resetAfterCalls` validation; the ticket appears in context only with Context management on and version 4; the ticket is never copied, listed or readable; held-out results never reach prompts, compact checks or handoffs; the Backup tab target has the same schema for every preset; the forced reset happens at the same call for both presets, with a handoff only when Memory is on; a pause during the reset; a refused automatic session start; workspaces created before v4 keep their revisions.
- `tests/v4-system.test.mjs` (server on ports 4418/4419, scripted loopback provider on 4420, real Chromium): the unfixed Backup screen lists the two seed notes; production serves the pristine fixture before publication and the published copy after; the forced reset over HTTP for both presets; `appliedAt`; `heldOutVerified` and `resetAfterCalls` in `/api/evals`.
- **Held-out checks measure something.** `tests/support/reference-patches.mjs` holds two test-only patches that never touch `fixtures/` or `lib/`. A correct patch passes 6/6 visible and 5/5 held-out. A wrong patch that stores the draft inside the notes array passes all six visible checks and fails only the backup held-out check.
- `tests/integration.test.mjs`: presenter evaluation returns both tiers with the expected shape and detail; `run_checks` and completion results contain no held-out result; approval ignores a failing held-out result; on the unfixed fixture the visible tier is 4/6 and the held-out tier is 3/5.
- `tests/evaluate-ladder.test.mjs` (no network; fake API and one local `--help` process): ladder rung generation and alternating order, custom `--rungs`, `--reset-after` bounds, argument validation, the "claimed without a refresh test" and "applied without review" derivations, the per-run summary, refusal without a configured provider, and a partial summary written when a trial fails.
- `tests/evaluate.test.mjs`: the bounded retry for a run that has not yet released its operation lock.
- Dashboard tests (package B) cover the production banners, held-out rendering, the claims versus evidence panel, what each agent was told and the ladder scoreboard. See the test files under `tests/` for their exact scope.

## Live tests

## Builder tests

- `tests/builder-runner.test.mjs` (in process, mocked transport): loop-only validation, no tools in either protocol's request, a hallucinated tool call recorded as `tool_error`, the observation event, the budget stop, the Tools card Off and never highlighted, and the comparison and ladder excluding loop-only runs.
- `tests/builder-system.test.mjs` (server on ports 4438/4439, scripted loopback provider on 4440, real Chromium): the model-only endpoint and its records, loop-only runs over HTTP, separate evaluation groups, `GET /api/builder` and `/builder-assets/`, and the builder files served or a clean 404.
- `tests/builder-page.test.mjs` (server on ports 4448/4449, no provider, real Chromium): the page derivations on a fixture built from recorded exports, every step rendered, request highlights, activity excerpts, the `Not recorded yet` and screenshot fallbacks, both presentation viewports.
- `tests/record-builder.test.mjs` (no network, no browser): the recorder's arguments, step plan, key hygiene, both phases against a fake API, and the stop at the approval boundary.
- `tests/builder-live.test.mjs` (server on ports 4458/4459, scripted loopback provider on 4460, real Chromium): the page's live mode: a loop-only step 1 run growing in the activity list to its budget stop, step 5 to completion with the presenter evaluation, step 7 to the approval boundary with the diff dialog and the approval, the step 2 probe, hidden buttons without a provider, the recording file unchanged, no page errors.
- The reset-after-first-edit setting is covered in `tests/builder-runner.test.mjs` (both presets reset right after their first write, a handoff only with memory, a run that never writes never resets) and over HTTP in `tests/builder-system.test.mjs`.

The recording itself (`node scripts/record-builder.mjs`) makes real, billable model calls and is a live test, not part of `npm test`.

With the server running and a real connection configured, every command below makes **real, billable model calls**. The script refuses to start without a configured provider. It never approves a proposal.

```powershell
node scripts/evaluate.mjs --trials 1 --scenarios draft,unicode,longform
node scripts/evaluate.mjs --ladder --trials 3 --reset-after 8 --out ladder-results.json
```

The first makes six trials (Minimal and Engineered per scenario). The second runs five rungs per trial for three trials: fifteen runs, each forced into a fresh session after model call 8, with a JSON summary per run. `--rungs` takes a custom list, for example `"minimal;verification+memory;engineered"`. `--help` lists all options without contacting the server. After each agent stops, the script runs presenter evaluation of both tiers. Review passing Engineered diffs before approving through the UI, then test the production phone.

For memory without the script, pause after a real edit, inspect Memory, and choose New session. Or prepare runs with the same **Forced session reset** call number (`resetAfterCalls`). Check the next assembled prompt and the restored handoff. Files survive in every preset. Confirm that a run with Memory off has no handoff. A fast model can finish before the reset point; report that honestly.

## Recorded evidence

The first live v4 ladder is recorded in [the v4 live report](../live-validation/v4/RESULTS.md). Everything below is historical. It used an earlier fixture without the Backup screen and a single check tier. Do not pool it with v4 results.

- [v3 live results and fixes (historical)](../live-validation/v3/RESULTS.md)
- [v2 card redesign and live results (historical)](../live-validation/revised-cards/RESULTS.md)
- [Earlier harness trials (historical)](../live-validation/RESULTS.md)
- [Validation details (historical)](../VALIDATION.md)

The six v2 scenario trials are individual samples, not an experiment large enough to claim a reliability percentage. The draft Minimal trial changed existing note text and exhausted its budget. Two other Minimal trials succeeded. All three Engineered trials passed and waited for approval. Both v2 interrupted memory trials retained a passing patch but failed to complete within the budget; Engineered also saw an HTTP 502 before recovery. The v3 report separately records a successful pair, provider failures and two fallback memory budget stops. The v3 suite had 80 passing tests at the time.

No live model happened to attempt an unauthorized host write in these trials. The separate permission probe and deterministic tests establish rejection of that action. Do not describe the probe as model misconduct. Similarly, successful Engineered trials establish verification and approval operation, not a live failed-check repair loop unless such an event actually appears in the trace.

## Harness v3 verification (historical)

See [the v3 report](../live-validation/v3/RESULTS.md). Those tests inject transient and permanent disk errors, failed file staging, post-publication logging failures, restart recovery and HTTP approval response behavior. Handoff tests check size, frozen state, edit retention and verification-disabled exclusions. Audience tests distinguish current checks from completion/publication and reject mismatched comparisons. They remain in the suite.

## Maintenance

Preserve failure evidence. When changing checks, increment CHECK_SUITE_VERSION if meaning changes. Keep held-out checks out of every agent-facing path, and keep a test that proves they catch a wrong patch. Keep historical results separate from current verification. When changing available tools or completion policy, consider harness versioning so old results remain interpretable. Never patch fixture code to make model tests pass.
