# Current state and continuation priorities

Last reviewed **26 October 2026 (Asia/Calcutta)**. Read this after [AGENTS.md](../AGENTS.md) and before following [the machine setup handoff](HANDOFF.md).

This is a handoff snapshot, not a promise that the next run will have the same outcome.

## Harness v4: implemented, no live evidence yet

- **Implemented in the working tree** per [the v4 design](REDESIGN-V4.md): the Backup screen and `src/export.js`, the harness-owned PN-142 ticket thread supplied only by Context management, two check tiers (suite `notes-v3`: six visible, five held-out and presenter-only), the production route and `appliedAt`, the optional forced reset (`resetAfterCalls`), `heldOutVerified` and the reset setting in evaluation groups, and the evaluation ladder in `scripts/evaluate.mjs` (`--ladder`, `--rungs`, `--reset-after`, `--out`). The dashboard work (production phone, held-out checks, claims versus evidence, what each agent was told, ladder scoreboard) is implemented and covered by `tests/v4-dashboard.test.mjs`.
- **Covered by automated tests.** The backend package's full suite result was **99 passed** at the time of writing. The evaluation-script tests (`tests/evaluate.test.mjs`, `tests/evaluate-ladder.test.mjs`) pass on their own. The integrated suite with all three packages passed **131 tests, 0 failed, 0 skipped** on 26 October 2026 (Windows, Node 24.19.0, 167 seconds), and **136 tests, 0 failed** after the transport pacing and retry change later that day, and `npm run doctor` passed 18 checks. These tests use scripted test-only providers and fake APIs. They establish implementation behavior, not model behavior.
- **First live v4 evidence (26 October 2026):** a five-rung ladder across draft, unicode and longform (15 runs) and a forced-reset ladder on draft (5 runs) with `cohere/north-mini-code:free` through OpenRouter. Every Minimal run produced a patch that passed 6/6 visible and 5/5 held-out checks and never requested completion within the 24-call budget; every rung with `run_checks` completed in 7 to 13 calls; the three Engineered runs waited for approval and were published after diff inspection; held-out checks passed on every applied patch; the one memory run that reset restored a handoff and still stopped at its budget. Provider HTTP 429 rate limits caused every failed attempt and led to request pacing and bounded retries in `lib/provider.mjs`. See [the v4 live report](../live-validation/v4/RESULTS.md). One trial per cell: this is not a reliability percentage and must not be pooled with v2 or v3.
- **The deck predates v4.** Its demo slides show v2 and v3 screens. The PowerPoint rebuild is pending; [speaker-notes.md](../presentation/speaker-notes.md) already describes the v4 flow.
- **Next steps:** repeat the ladder with at least three trials per rung and a paid model, and with a second model, before any reliability claim; rebuild the deck with v4 screenshots from these runs; rehearse the failure-first flow in [ANATOMY-DEMO.md](../ANATOMY-DEMO.md) on the presentation laptop. Free-tier endpoints need `MODEL_MIN_INTERVAL_MS` set; 4500 ms kept `cohere/north-mini-code:free` under its limit of 15 requests per minute.

## Delivered state before v4 (historical)

- **Harness v3** added atomic publication/recovery, bounded snapshot retries, compact frozen session handoffs and audience explanations/comparison. See [the v3 report](../live-validation/v3/RESULTS.md). The original v2 runtime baseline was `5c1ca82d28ba001d8ac73ecb513a928295f71622`; its real trials are retained separately.
- Local application, real provider adapters, file/browser tools, seven anatomy cards, independent presenter evaluation, saved progress and revision-bound approval were implemented then and remain.
- Minimal enables exactly Agent loop and Tools & sandbox. Engineered enables all seven cards. Instructions and context have separate payload evidence. Orchestration is outside this demo; observability remains in traces/evals rather than a toggled card.
- The PowerPoint, editable source, screenshot assets, setup instructions and presenter runbook include separately labeled v2 and v3 evidence. See [the presentation guide](../presentation/README.md).
- The earlier development server's saved OpenRouter connection was changed to `cohere/north-mini-code:free` after repeated failures from the earlier free model. Verify availability and credentials again on the target laptop; UI keys are memory-only.
- Fresh clones contain historical exports, not the previous laptop's live workspaces. Runtime files and credentials are deliberately excluded from Git.

## Real model runs · v3 evidence (historical)

The first fresh pair with `nvidia/nemotron-3.5-super-vl:free` stopped on a timeout and HTTP 502, respectively. Its Engineered memory trial supplied a 404-byte handoff in session 2, then timed out despite 6/6 source checks. These are provider failures, not successful completions.

The subsequent matched Draft pair with `cohere/north-mini-code:free` succeeded: Minimal `e25d301f` passed 6/6 and applied automatically (20 calls, 73.080 seconds). Engineered `0b75acc7` passed 6/6 and waited for review (13 calls, 89.012 seconds), then was approved after diff inspection. Both published copies passed separate real browser validation with no observed uncaught browser errors. The comparison screenshot preserves the actual pre-approval boundary. This shows different requirements even when both patches work; it does not establish a reliability percentage or that Engineered is faster.

See [the v3 report](../live-validation/v3/RESULTS.md) for the fresh-session results, full exported traces, provider failures and test-runner fixes. Do not pool versions, models or session counts into one comparison.

Latest fallback fresh-session runs also stopped at budgets: Minimal `7bc9ac11` retained files without a handoff and finished with 3/6 source checks after 24 calls; Engineered `c599c57b` supplied a 766-byte saved handoff and finished with 6/6 after 23 calls. Neither published. Memory restoration is established; reliable interrupted completion is not. The main presenter flow uses the successful uninterrupted pair, with memory optional.

## Real model runs · v2 evidence (historical)

These runs occurred on **25 October 2026** using OpenRouter Chat Completions with `nvidia/nemotron-3.5-super-vl:free`. They used real requests, source edits and browser observations. The scenario names select acceptance variants for the same Notes task. Calls are actual attempted model requests, not estimates.

| Scenario | Harness / run ID prefix | Latest recorded outcome | Checks | Calls |
| --- | --- | --- | --- | --- |
| Draft | Minimal `7b1550a9` | Budget exceeded; no publication; existing-note text regressed | 5/6 | 13 |
| Draft | Engineered `cf25feae` | Passed, waited for review, then approved and published | 6/6 | 5 |
| Unicode / multiline | Minimal `3a4e2825` | Completed and published automatically | 6/6 | 11 |
| Unicode / multiline | Engineered `3ae861e2` | Passed, waited for review, then approved and published | 6/6 | 5 |
| Long-form text | Minimal `fba0c680` | Completed and published automatically | 6/6 | 12 |
| Long-form text | Engineered `64eed9f8` | Passed, waited for review, then approved and published | 6/6 | 4 |
| Fresh session | Minimal `b92338fb` | Session 2; files retained, no saved handoff; budget exceeded; no publication | 6/6 | 15 |
| Fresh session and recovery | Engineered `da5cf49c` | Session 2 restored checkpoint, then HTTP 502; resumed session 3 restored checkpoint again, then budget exceeded; no publication | 6/6 | 11 cumulative |

All five published apps received separate browser validation and passed with no observed uncaught browser errors. The latest Engineered memory status is **budget_exceeded**, not the earlier session-2 `failed` snapshot. Its recovery is the same run, not a third independent memory trial. Passing source checks and successful agent completion are separate outcomes.

See [the rehearsal report and linked full traces](../live-validation/revised-cards/RESULTS.md), [scenario matrix](../live-validation/revised-cards/matrix.json), [published-copy checks](../live-validation/revised-cards/published-results.json), and [memory recovery](../live-validation/revised-cards/memory-recovery.json). Earlier version-1 evidence is historical and must not be pooled with the revised harness as one configuration.

## What was tested

The rows below record the v3 state (historical) unless marked v4.

| Evidence | Result and scope |
| --- | --- |
| v4 automated tests | Backend package: 99 passed at the time of writing. Evaluation-script tests pass on their own. Final integrated count: to be recorded by the coordinator. Scripted providers and fake APIs only. |
| v4 live runs | None yet. |
| v3 Windows suite | 80 passed, 0 failed, 0 skipped in 125.123 seconds; final UI/explanation subset 13 passed. Node 24.19.0. Tests now run sequentially to avoid competing Chromium processes; earlier concurrent-run deadline failures are preserved in the v3 report. Scripted providers are used only inside tests. |
| Local readiness | 16 checks passed; Chromium 156.0.4314.42. |
| Initial Linux CI | [Successful run for 5c1ca82](https://github.com/shubham-t/harness-codex/actions/runs/40219471643): clean npm install, Playwright install, doctor and test suite. |
| Latest code CI | [Successful run for b17a897](https://github.com/shubham-t/harness-codex/actions/runs/40339519642): clean Linux dependency/browser install, doctor and full suite, including evaluation-client and test-scheduling fixes. Later handoff-only updates do not change this tested code. |
| Real provider | Authentication, tool calls, file edits, separate instructions/context, card evidence, approval, publication and fresh-session state with the exact OpenRouter models in the v2/v3 reports. Seven new v3 agent runs; successful main comparison, provider failures and memory budget stops recorded separately. |
| Dashboard | Real browser interaction with model setup, Run/Pause/New session, review, approval, exports, checks, dialogs and Focus demo. Layout checked at 1440×900, 1280×720 and 390×844. |
| Enforcement | Deterministic tests cover failing-check completion rejection, stale approval, tool availability, protected-file writes, origin/path restrictions, restart accounting and private-state exclusion from exports. |
| Presentation | Updated 35-slide deck passes package/layout/font/re-import checks. Native PowerPoint opened and exported all slides; changed slides inspected after the earlier full 33-slide inspection. Six tables and slide text remain editable; v2/v3 screenshots are labeled separately. |

The [validation record](../VALIDATION.md) contains detailed coverage. Tests prove behavior for their exercised inputs, not arbitrary model quality or production security.

## What the historical evidence establishes (v2 and v3)

None of these points has been re-measured with harness v4.

- The enabled components perform observable operations; the cards correspond to actual recorded events. Supplying instructions proves inclusion, not model compliance.
- Minimal can solve this task. The strongest repeatable contrast is what the runtime supplies and requires: project inputs, saved handoff, current verification and approval.
- In v2, Engineered's three scenario trials passed and reached an approval boundary. Minimal's draft trial regressed one behavior, while its other two scenario trials passed. In the successful v3 fallback pair, both passed and the required approval contrast remained visible.
- Both presets retain edited files across fresh sessions. Only Engineered supplied saved progress in these trials. Memory restoration worked even though the interrupted runs did not finish.
- Verification can detect important regressions, but a finite acceptance suite cannot establish universal correctness.

## Not yet established or tested

- **Any live v4 behavior:** no real model has run against the Backup screen, the ticket thread, the held-out tier, the production route or a forced reset. Whether Minimal or Engineered pass the held-out checks, how often an agent claims a behavior it never exercised, and what the ladder shows are all unmeasured. Do not predict these outcomes in the demo.
- **The v4 deck:** the PowerPoint rebuild for the v4 flow is pending.
- **Broader v3 coverage:** the fresh matched pair uses the Draft scenario. Unicode and multiline text were also exercised in published-browser checks, but separate v3 agent trials for Unicode and long-form scenario variants have not been run. The earlier six-scenario matrix is v2 evidence.
- **Organization laptop:** installation, corporate proxy/certificates, browser launch and complete rehearsal remain to be tested there. Linux CI is not a substitute for that machine.
- **Internal model and other providers:** no real trials with the intended internal model or OpenAI API. Both adapters were exercised through test-only HTTP providers; that is not live provider certification. Current OpenRouter model availability/quota also needs checking.
- **Live failure-repair loop:** no recorded Engineered scenario trial demonstrated a failed final verification gate followed by a successful repair. The gate itself is covered by deterministic tests.
- **Live unauthorized action:** no recorded model attempted an unauthorized host write. A separate explicit boundary probe and automated tests show rejection; do not attribute that probe to model behavior.
- **Reliable memory completion:** checkpoint restoration is observed; a completed interrupted model run within the current budget is not established by the latest memory rehearsals.
- **Comparative reliability or causality:** one run per scenario/preset is not enough for a success-rate claim. No repeated multi-model benchmark or controlled component-by-component ablation has established which extra component caused a better patch.
- **Presentation room:** native PowerPoint opening/export and visual inspection are complete on this laptop. The target projector, interactive slideshow controls and timed spoken full-hour rehearsal still require checking.
- **Broader environments:** no macOS end-to-end validation, mobile-device testing, or production/multi-user deployment validation. This is a local teaching application.

## Remaining work, in order

1. **Run the v4 ladder with a reliable paid model.** Only after the owner authorizes the quota. Start with `node scripts/evaluate.mjs --ladder --trials 3 --out <file>` (fifteen real runs on Draft), then decide whether a forced-reset ladder (`--reset-after N`) and other scenarios are worth the cost. Record model, endpoint, commit, run IDs, both check tiers, the two derived flags and every failure. Review passing Engineered diffs before approving.
2. **Rebuild the deck for v4.** Replace the demo slides with real v4 screens from step 1. Keep v2 and v3 slides only if labeled historical.
3. **Set up the organization laptop.** Follow HANDOFF.md; verify keyless behavior before credentials. Record OS, Node/browser versions, commit, commands and results. Completion means the actual UI works and local tests pass, with blockers explicitly listed.
4. **Rehearse with the presentation provider on that laptop.** Use the v4 failure-first flow in [ANATOMY-DEMO.md](../ANATOMY-DEMO.md) after live testing is authorized. Keep the branch where Minimal passes everything in the narration; do not depend on a predetermined failure.
5. **Verify fixes through the chosen live provider.** Atomic publication, persistence retries, truthful postcommit errors and recovery now have fault-injection tests. The original historical OS trigger remains unknown; preserve diagnostics if any recurrence appears.
6. **Optional memory improvement.** Compact handoffs were verified in real v3 session-2 requests, but both fallback interrupted runs still hit budgets. In those v3 runs, Engineered repeated file reads and browser work after receiving the handoff. A v4 forced-reset ladder would measure every rung at an equal reset point. Investigate request size and redundant actions before claiming reliable interrupted completion; preserve equal budgets and full audit evidence. The core demo does not depend on this experiment completing.
7. **Rehearse the audience flow.** Follow [the twenty-minute cue card](DEMO-CUE-CARD.md). Show both phones, claims versus evidence, what each agent was told, both check tiers and the ladder scoreboard. Check projector readability and complete a timed spoken rehearsal.
8. **Optional evidence expansion.** If the user wants stronger reliability claims, agree on repeated comparable trials and a quota budget. Test one component change at a time where practical. Preserve failures, latency, usage and unreported usage; do not select only favorable runs.

These are continuation priorities, not authorization to consume unlimited API quota or redesign the application. Setup and rehearsal come first. Avoid speculative runtime changes when the evidence points only to a presentation or environment issue.

## Keep this handoff current

After further work, append new evidence and update this snapshot. Record the tested commit, environment, exact provider/model, scenario, run IDs, session numbers, completion status, checks, approval/publication and remaining limitations. Distinguish automated fixtures, live model runs and presenter-triggered actions. Link CI runs and public exports; never commit credentials or private runtime history. Keep older failed traces intact and label superseded snapshots instead of rewriting their outcomes.
