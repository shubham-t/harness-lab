# Harness v3: reliability and audience clarity

Reviewed on **26 October 2026 (Asia/Calcutta)**. This report separates implementation checks from model trials. Fresh real-provider trials are now running with the saved OpenRouter connection. The first connection test returned HTTP 502; one retry succeeded. Completed v3 outcomes will be recorded below; the [v2 rehearsal](../revised-cards/RESULTS.md) remains separate historical evidence.

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

- Full local automated suite: **78 passed, 0 failed, 0 skipped**.
- After the final comparison layout/session-filter changes: focused dashboard and explanation tests **13 passed**.
- Readiness: **16 checks passed**, Node 24.19.0, Chromium 156.0.4314.42.
- Real browser inspection of the updated UI using existing v2 run records: no observed application errors. Screenshots below show prior real model outcomes in the new interface, not new v3 model activity.
- The existing 33-slide deck opened read-only in installed Microsoft PowerPoint and exported all slides. Native exports were visually inspected. The deck's original run screenshots remain historical evidence; no new outcomes were inserted into them.
- Read-only code review found no additional concrete correctness defect in the final changed persistence, publication, handoff and comparison paths.

[Comparison of recorded v2 draft runs](comparison-of-recorded-v2-runs.png) · [Readable recorded instruction payload](readable-recorded-instructions.png)

## Limits and next required evidence

The historical intermittent Windows completion failure did not preserve its original OS error. Review identified and fault-injected a concrete mechanism: publication succeeded, then logging failed and the tool incorrectly appeared unsuccessful. That mechanism is fixed and tested; its role in the original incident remains unproven.

The memory changes remove observed payload duplication. They do not establish that the selected live model will finish an interrupted task. Once a provider connection is saved, run fresh v3 Minimal/Engineered trials and a pause/resume rehearsal. Keep their traces separate from v2 evidence. No live failed-check repair cycle, unauthorized model action, reliability percentage or guaranteed outcome is claimed.

The organization laptop, internal model, presentation projector and timed spoken rehearsal still require their own checks. Free-provider capacity and model behavior remain external dependencies.
