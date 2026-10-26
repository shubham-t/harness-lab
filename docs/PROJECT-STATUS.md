# Current state and continuation priorities

Last reviewed **26 October 2026 (Asia/Calcutta)**. Read this after [AGENTS.md](../AGENTS.md) and before following [the machine setup handoff](HANDOFF.md).

This is a handoff snapshot, not a promise that the next run will have the same outcome. The v3 implementation checks are complete; fresh live-provider testing is now in progress. Latest saved runtime metadata was compared with the committed exports; no newer model runs were found in the original development data directory.

## Delivered state

- Current implementation: **harness v3** adds atomic publication/recovery, bounded snapshot retries, compact frozen session handoffs and audience explanations/comparison. See [the v3 report](../live-validation/v3/RESULTS.md). The original v2 runtime baseline was `5c1ca82d28ba001d8ac73ecb513a928295f71622`; its real trials are retained separately.
- Local application, real provider adapters, file/browser tools, seven anatomy cards, independent presenter evaluation, saved progress and revision-bound approval are implemented.
- Minimal enables exactly Agent loop and Tools & sandbox. Engineered enables all seven cards. Instructions and context have separate payload evidence. Orchestration is outside this demo; observability remains in traces/evals rather than a toggled card.
- The 33-slide PowerPoint, editable source, screenshot assets, speaker notes, setup instructions and presenter runbook are committed.
- The updated development server was started at `127.0.0.1:4318`, browser readiness verified, and the user saved the OpenRouter connection. Verify process and credentials again on the target laptop; UI keys are memory-only.
- Fresh clones contain historical exports, not the previous laptop's live workspaces. Runtime files and credentials are deliberately excluded from Git.

## Earlier real model runs · v2 evidence

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

| Evidence | Result and scope |
| --- | --- |
| Current Windows suite | 78 passed, 0 failed, 0 skipped; final UI/explanation subset 13 passed. Node 24.19.0. Unit, fault-injection, HTTP, filesystem and real browser/UI tests, using scripted providers only inside tests. |
| Local readiness | 16 checks passed; Chromium 156.0.4314.42. |
| Initial Linux CI | [Successful run for 5c1ca82](https://github.com/shubham-t/harness-codex/actions/runs/40219471643): clean npm install, Playwright install, doctor and test suite. |
| Earlier CI baseline | [Successful run for 8077664](https://github.com/shubham-t/harness-codex/actions/runs/40254492380), the handoff-only commit. |
| Real provider | Authentication, tool calls, file edits, separate instructions/context, card evidence, approval, publication and fresh-session state with the OpenRouter model above. |
| Dashboard | Real browser interaction with model setup, Run/Pause/New session, review, approval, exports, checks, dialogs and Focus demo. Layout checked at 1440×900, 1280×720 and 390×844. |
| Enforcement | Deterministic tests cover failing-check completion rejection, stale approval, tool availability, protected-file writes, origin/path restrictions, restart accounting and private-state exclusion from exports. |
| Presentation | 33 slides opened and exported by native PowerPoint on 26 October; exports visually inspected. Earlier package/layout/font checks and first-party re-import passed. Five tables and slide text are editable. Screenshots remain recorded v2 evidence. |

The [validation record](../VALIDATION.md) contains detailed coverage. Tests prove behavior for their exercised inputs, not arbitrary model quality or production security.

## What the evidence establishes

- The enabled components perform observable operations; the cards correspond to actual recorded events. Supplying instructions proves inclusion, not model compliance.
- Minimal can solve this task. The strongest repeatable contrast is what the runtime supplies and requires: project inputs, saved handoff, current verification and approval.
- Engineered's three scenario trials passed and reached an approval boundary. Minimal's draft trial regressed one behavior, while its other two scenario trials passed.
- Both presets retain edited files across fresh sessions. Only Engineered supplied saved progress in these trials. Memory restoration worked even though the interrupted runs did not finish.
- Verification can detect important regressions, but a finite acceptance suite cannot establish universal correctness.

## Not yet established or tested

- **New v3 real-model behavior:** deterministic tests pass; see the v3 report for fresh-provider rehearsal status. Do not present v2 outcomes as proof of v3 effectiveness.
- **Organization laptop:** installation, corporate proxy/certificates, browser launch and complete rehearsal remain to be tested there. Linux CI is not a substitute for that machine.
- **Internal model and other providers:** no real trials with the intended internal model or OpenAI API. Both adapters were exercised through test-only HTTP providers; that is not live provider certification. Current OpenRouter model availability/quota also needs checking.
- **Live failure-repair loop:** no recorded Engineered scenario trial demonstrated a failed final verification gate followed by a successful repair. The gate itself is covered by deterministic tests.
- **Live unauthorized action:** no recorded model attempted an unauthorized host write. A separate explicit boundary probe and automated tests show rejection; do not attribute that probe to model behavior.
- **Reliable memory completion:** checkpoint restoration is observed; a completed interrupted model run within the current budget is not established by the latest memory rehearsals.
- **Comparative reliability or causality:** one run per scenario/preset is not enough for a success-rate claim. No repeated multi-model benchmark or controlled component-by-component ablation has established which extra component caused a better patch.
- **Presentation room:** native PowerPoint opening/export and visual inspection are complete on this laptop. The target projector, interactive slideshow controls and timed spoken full-hour rehearsal still require checking.
- **Broader environments:** no macOS end-to-end validation, mobile-device testing, or production/multi-user deployment validation. This is a local teaching application.

## Remaining work, in order

1. **Set up the organization laptop.** Follow HANDOFF.md; verify keyless behavior before credentials. Record OS, Node/browser versions, commit, commands and results. Completion means the actual UI works and local tests pass, with blockers explicitly listed.
2. **Rehearse with the presentation provider.** Once the user confirms live testing, run a fresh matched Minimal/Engineered pair. Export outcomes and verify approved published apps. Keep the passing Minimal branch in the narration; do not depend on a predetermined failure.
3. **Verify fixes through the chosen live provider.** Atomic publication, persistence retries, truthful postcommit errors and recovery now have fault-injection tests. The original historical OS trigger remains unknown; preserve diagnostics if any recurrence appears.
4. **Rehearse v3 memory.** The duplicated full-checkpoint inputs were replaced by a compact, frozen handoff and concise check context. Full evidence stays on disk and budgets remain equal. Keep memory optional until a fresh edit/pause/resume rehearsal completes; distinguish restoration from completion.
5. **Rehearse the audience flow.** Use Explain & compare to show observed checks, agent status, completion requirements and publication. Native PowerPoint renders have been inspected and in-app timing now matches the 25/20/15-minute schedule. The remaining room-specific polish is projector readability and a timed spoken rehearsal.
6. **Optional evidence expansion.** If the user wants stronger reliability claims, agree on repeated comparable trials and a quota budget. Test one component change at a time where practical. Preserve failures, latency, usage and unreported usage; do not select only favorable runs.

These are continuation priorities, not authorization to consume unlimited API quota or redesign the application. Setup and rehearsal come first. Avoid speculative runtime changes when the evidence points only to a presentation or environment issue.

## Keep this handoff current

After further work, append new evidence and update this snapshot. Record the tested commit, environment, exact provider/model, scenario, run IDs, session numbers, completion status, checks, approval/publication and remaining limitations. Distinguish automated fixtures, live model runs and presenter-triggered actions. Link CI runs and public exports; never commit credentials or private runtime history. Keep older failed traces intact and label superseded snapshots instead of rewriting their outcomes.
