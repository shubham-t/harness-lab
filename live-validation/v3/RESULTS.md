# Harness v3: reliability and audience clarity

Reviewed on **26 October 2026 (Asia/Calcutta)**. This report separates implementation checks from real model trials. The [v2 rehearsal](../revised-cards/RESULTS.md) remains separate historical evidence. Current v3 runtime changes were committed as `033d5d852305b8b47231af5368894718da8d765f`; the subsequent evaluation-client fix and evidence updates are described below.

## Fresh real-provider rehearsals

All rows below used real OpenRouter Chat Completions calls, real file edits and browser checks. No patch or model answer was injected. Every uninterrupted trial used the same Draft task, fixture and shared budgets. The fresh-session trials are separate experiments.

| Model | Harness / run prefix | Observed result | Source checks | Calls |
| --- | --- | --- | --- | --- |
| `nvidia/nemotron-3.5-super-vl:free` | Minimal `2772de84` | Request timed out; not applied | 6/6 | 11 |
| Same | Engineered `4c4fe064` | HTTP 502; no edits; not applied | 4/6 | 2 |
| Same | Engineered fresh session `fed6ccda` | Session 2 received a 404-byte handoff; request timed out; not applied | 6/6 | 3 |
| `cohere/north-mini-code:free` | Minimal `e25d301f` | Completed and applied automatically in 73.080 seconds | 6/6 | 20 |
| Same | Engineered `0b75acc7` | Passed and waited for approval in 89.012 seconds; subsequently reviewed, approved and applied | 6/6 | 13 |
| Same | Minimal fresh session `7bc9ac11` | Session 2 retained files, no handoff; call budget reached; not applied | 3/6 | 24 |
| Same | Engineered fresh session `c599c57b` | Session 2 received a 766-byte handoff; next-request token reservation exceeded remaining budget; not applied | 6/6 | 23 |

The first model also returned HTTP 502 on the initial connection test; one retry succeeded. Each failed run has one request with unreported token usage. The fallback model was selected after checking the public catalog for zero input/output pricing and tool support: [catalog evidence](fallback-catalog.json). Availability and pricing must be checked again before another rehearsal.

The successful pair demonstrates **different completion requirements even when both fixes work**. Minimal changed storage and the editor placeholder apostrophe; Engineered changed only storage. This incidental edit is not a failed acceptance criterion or proof of a reliability difference. Both published copies passed separate browser checks for navigation, refresh, Unicode/multiline text, literal markup, saving, draft clearing and original-note preservation, with no observed uncaught browser errors.

[Actual comparison before Engineered approval](comparison-fallback-before-approval.png) · [Original-model pair](matrix.json) · [Fallback pair before approval](fallback-matrix.json) · [Original-model memory result](memory-results.json) · [Visible provider-failure explanation](passing-source-provider-failure.png)

[Published-copy validation](published-results.json) · [Failure-explanation UI validation](failure-ui-check.json)

[Fallback fresh-session results](memory-fallback-results.json) record both paused-after-edit runs. The one unreported request in each fallback memory trial was the request interrupted by the presenter pause, not a confirmed provider failure. Minimal's final checks failed navigation, original-note preservation and distinct-note behavior. Engineered re-read files, reran checks and made further manual browser calls before its budget stop; the handoff did not prevent redundant work. Passing source is not successful completion. Keep this optional demonstration focused on the actual restored information, and do not promise completion or attribute the outcome difference to memory alone.

Public run exports use each row's full ID in the filename. The Engineered fallback export records its final approved status; the matrix and comparison screenshot intentionally preserve its earlier approval boundary. The two model groups must not be combined as a matched comparison.

### Rehearsal and test-runner fixes

The first fallback evaluation script encountered the runner's busy lock just after Minimal completed publication. This did not undo publication. `evaluateStoppedRun` now waits briefly for that exact conflict and preserves other errors; two regression tests cover the race and bounded waiting. The original run was evaluated afterward, without rerunning its model or changing its source.

A full test run while live rehearsals and multiple test Chromium processes were active hit a 30-second test deadline in the first system scenario. Its dependent scenarios then failed because the earlier test run remained active (74 pass, 6 fail including the parent). The npm test command now runs test files sequentially. Assertions and deadlines were not loosened. Run the suite with live rehearsals idle; final results are recorded below.

## Changes and evidence

| Change | Verification |
| --- | --- |
| Atomic publication | Files and a revision manifest are staged before the complete directory is made available. Injected copy failure leaves no partial published app, and retry succeeds. |
| Temporary file locks | Atomic JSON writes retry transient EPERM/EACCES/EBUSY rename errors a bounded number of times. Tests confirm the previous good snapshot remains intact until replacement succeeds. Permanent errors remain errors. |
| Failure after application | An injected evidence-storage error after publication retains the applied status, reports a warning and still returns an accurate accepted completion/HTTP approval result. |
| Restart recovery | A committed publication manifest is validated against copied-file hashes before recovering completed status. Readable runs remain visible with warnings when recovery state cannot be persisted. This is process-interruption recovery, not power-loss durability. |
| Compact handoff | New v3 sessions capture a frozen, bounded summary of edited files, current revision, check results, saved note and recent action names. Tests ensure long browser payloads and new current-session checkpoints are not repeatedly restored as old memory. Full audit checkpoints remain intact. |
| Shared budgets | Both presets retain 24 calls and 150,000 reported-token budget with conservative next-request reservation. Both receive the remaining budget in v3 requests. No budget increase or automatic completion was introduced. |
| Explain & compare | Shows measured source checks, agent status, completion requirements, approval and application separately. Matching requires real calls, opposite standard presets, identical task/scenario/provider/harness version/session count. Unmeasured or stale checks are never shown as current success. |
| Component evidence | Instructions and context retain their line breaks in readable dialogs; raw event JSON is expandable. Memory opens its own handoff evidence. Shared budget stops highlight Agent loop, and the explicit sandbox probe maps to Tools & sandbox. Disabled components never light up. |
| Presenter flow | The in-app guide now matches 25 minutes of concepts, 20 minutes of live comparison and 15 minutes of discussion/buffer. Memory is optional; no model failure is scripted for contrast. |

## Checks performed

- Final full local automated suite with sequential test files: **80 passed, 0 failed, 0 skipped** in 125.123 seconds. The earlier 78-test suite passed before the two evaluation-client regression tests were added.
- GitHub Actions on Linux passed for code/evidence revision **`b17a89726c137a0aa1a785f1c12a079d589c795d`**: [CI run 40339519642](https://github.com/shubham-t/harness-codex/actions/runs/40339519642). Subsequent handoff-only updates leave that code unchanged.
- After the comparison layout/session-filter and visible stopping-reason changes: focused dashboard and explanation tests **13 passed**. The actual provider-failure dialog also passed a separate browser inspection with zero observed uncaught errors.
- Readiness: **16 checks passed**, Node 24.19.0, Chromium 156.0.4314.42.
- Real browser inspection of the updated UI using existing v2 run records: no observed application errors. Screenshots below show prior real model outcomes in the new interface, not new v3 model activity.
- The updated **35-slide deck** passed package, layout, font-policy and first-party re-import checks. Native Microsoft PowerPoint opened and exported all 35 slides; changed slides were visually inspected, following the earlier full inspection of the original 33. Two new slides show v3 evidence separately; older screenshots remain labeled v2. See [the presentation notes](../../presentation/README.md).
- Read-only code review found no additional concrete correctness defect in the final changed persistence, publication, handoff and comparison paths.

[Comparison of recorded v2 draft runs](comparison-of-recorded-v2-runs.png) · [Readable recorded instruction payload](readable-recorded-instructions.png)

## Limits and next required evidence

The historical intermittent Windows completion failure did not preserve its original OS error. Review identified and fault-injected a concrete mechanism: publication succeeded, then logging failed and the tool incorrectly appeared unsuccessful. That mechanism is fixed and tested; its role in the original incident remains unproven.

The memory changes remove observed handoff payload duplication, and fresh requests demonstrate restoration. They have not made interrupted completion reliable: the original endpoint timed out, and both fallback fresh-session trials hit budgets. The uninterrupted fallback pair completed successfully. No live failed-final-check repair cycle, unauthorized model action, reliability percentage or guaranteed outcome is claimed.

The organization laptop, internal model, presentation projector and timed spoken rehearsal still require their own checks. Free-provider capacity and model behavior remain external dependencies.
