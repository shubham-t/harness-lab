# Harness builder: recorded runs

Recorded on **27 October 2026 (UTC 15:47 to 16:02)** on the development laptop against the `harness-builder` working tree in `C:/Projects/harness-lab`, with `node scripts/record-builder.mjs --out live-validation/builder` and then `--phase finish`. Step 6 was re-recorded three times: at **16:16 to 16:19 UTC** with `--steps 6 --reset-after 8`, at **16:23 to 16:27 UTC** with `--steps 6 --reset-after 7`, and at **16:59 to 17:08 UTC** with `--steps 6 --reset-after-edit` (the reset-after-first-edit setting added for this purpose). The three earlier step-6 pairs are kept under `superseded` in `recording.json` (their screenshots carry a `superseded-` prefix) and are described below. Every row is a real OpenRouter Chat Completions run with real file edits and real Chromium checks. No patch or model answer was injected, no budget was changed, and failures are kept. One run per step; this illustrates the mechanism of each component and establishes no reliability percentage.

These runs feed the builder page (`/builder.html`, see [the builder design](../../docs/BUILDER.md)). They are builder evidence: loop-only runs and the model-only request are grouped separately in the dashboard and never compared with Minimal or Engineered.

## Setup

| Item | Value |
| --- | --- |
| Model | `cohere/north-mini-code:free` (OpenRouter, Chat Completions), request pacing 4.5 s |
| Harness | version 4, check suite `notes-v3`; presenter evaluation of both tiers after every run |
| Task and fixture | the draft scenario only; identical task text, starting files and budgets (24 calls, 150,000 reported tokens) for every run |
| Forced reset | step 6 only: `resetAfterFirstEdit = true` for both runs, so each run loses its conversation right after its first file write (the superseded pairs used `resetAfterCalls` 5, 8 and 7) |
| Files | `recording.json` (manifest with every export embedded), `runs/` (one export per run, step 7 before and after approval), `screens/` (sandbox and production phones per step) |

## The steps

| Step | Adds | Run | Status | Calls | Tokens | Elapsed | Visible | Held-out | What happened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | A model alone | model-only `e894133e` | completed | 1 | 4,448 | | | | One request with the task and no tools. The reply is a 16,885-character plan that says the repository is not available to it. No file changed. |
| 1 | Agent loop | `76063d7f` (loop-only) | budget_exceeded | 5 | 48,805 | 230 s | 4/6 | 3/5 | Five rounds of request, prose reply, observation. The first reply hit the output limit; the fourth proposed a diff for a file that does not exist. The loop stopped when the conservative reservation for the next request exceeded the token budget. The checks are the unfixed baseline. |
| 2 | Tools and sandbox | `83905aa6` | budget_exceeded | 24 | 103,388 | 125 s | 6/6 | 5/5 | Read the files, wrote `src/storage.js` once, then spent the remaining calls on 15 manual browser actions without declaring completion. After the run, the presenter probe's out-of-workspace write was rejected (`Invalid path argument.`). |
| 3 | Instructions and policies | `b4bd1f75` | budget_exceeded | 24 | 82,988 | 110 s | 6/6 | 5/5 | Same shape as step 2 with the PROJECT.md rules in every request: one correct write, 17 browser actions, no completion. |
| 4 | Context management | `984306d5` | budget_exceeded | 21 | 102,367 | 92 s | 6/6 | 5/5 | Same shape with the repository map, file list, revision and ticket in every request: one correct write, 14 browser actions, stopped by the token budget. |
| 5 | Verification | `8692eebb` | completed | 9 | 30,766 | 51 s | 6/6 | 5/5 | Wrote the fix, ran the visible checks (6/6), ran them again, requested completion; the gate's independent assessment passed and the patch was applied automatically (no approval in this configuration). |
| 6 | Memory, without | `72ef06fd` | failed | 19 | 74,078 | 241 s | 6/6 | 5/5 | Session 1 read five files, ran checks (4/6) and wrote the fix at call 7; the reset followed at once. Session 2 started from the task only: re-read all five files, rewrote `src/app.js` and `src/storage.js` several times, tested by hand, ran checks (6/6), rewrote `src/app.js` again, and then the provider connection ended (`terminated`), a transport failure recorded as the run's error. The final source passes both tiers; nothing was published. |
| 6 | Memory, with | `061a9acc` | budget_exceeded | 18 | 79,559 | 219 s | 0/6 | 0/5 | Session 1 read five files and wrote the fix at call 7; the reset followed at once, before any check. The frozen handoff carried the edited file and no check result. Session 2 re-read four files, ran checks (6/6), then rewrote `src/app.js` three times, checking 6/6 after the first two rewrites, and stopped at the token budget right after the third rewrite, which it never checked. That last edit broke the app: the presenter checks on the final revision fail 0/6 and 0/5 because the editor no longer renders. Nothing was published. |
| 7 | Guardrails: approval | `5bf747f1` | awaiting_approval, then completed | 6 | 18,177 | 35 s | 6/6 | 5/5 | Read, wrote `src/storage.js`, ran checks, requested completion, stopped at the approval boundary. The presenter read the diff (storage only, a separate `draft` key, notes untouched) and approved at 16:02:14 UTC. |

Tokens are reported input plus output; no request went unreported. Elapsed times include the 4.5-second pacing. The step 0 request took no run and reports no elapsed time.

## What this shows, and what it does not

- **Steps 0 and 1:** without tools the model can only write. In the loop it wrote 21,395 output tokens of plans and diffs across five rounds, nothing changed, and the shared budget ended the run. This is the mechanism of a loop without actions, not a measure of the model.
- **Steps 2 to 4:** with tools the model fixed the bug every time (6/6 and 5/5 after the presenter evaluation) and never declared completion. It tested by hand until the budget ended. Adding the rules (step 3) and the project context (step 4) proves those inputs were sent; it did not change this outcome. Supplying a rule proves inclusion, not compliance.
- **Step 5:** the first run that finished. With `run_checks` available and completion gated, the same model wrote the fix, checked it and stopped in 9 calls. No completion request was rejected by the gate in this run; the automated tests cover the rejection path.
- **Step 6 (reset after the first edit, the current pair):** both runs were cut off at the same point in their work, right after writing the fix at call 7. Neither finished. Without memory, the fresh session rediscovered everything, rewrote both files repeatedly and was stopped by a provider transport failure with a passing source. With memory, the fresh session was told which file had been edited, still re-read the files, then kept editing `src/app.js`; its last edit came after its last check and broke the app, and the budget ended the run before it could notice. The page shows both. The lesson is the same as in the v3 and v4 memory trials, and sharper: a handoff carries state; it does not make the model stop, and a check result belongs only to the revision it tested.
- **Step 6 (superseded third pair, reset after call 7):** `cda450cc` (without memory) requested completion at call 7 and never reset; `b4048765` (with memory) reset after writing its fix, received a handoff with the edited file and a pre-edit check result, re-read every file, re-ran checks, saved notes twice, tested by hand and stopped at the token budget after 21 calls without requesting completion. Both patches 6/6 and 5/5.
- **Step 6 (superseded second pair, reset after call 8):** `7e216b2d` (without memory) requested completion at call 8 and never reset; `64bd0bca` (with memory) reset after writing and checking its fix (6/6), received a handoff with the edited file and that result, and still spent its remaining 16 calls re-reading and testing by hand until the budget ended, without requesting completion. Both patches 6/6 and 5/5.
- **Across the four pairs** the run without memory finished in 16, 8 and 7 calls and then failed at 19 after a real cut-off, while the run with memory took 12 (completed), 24, 21 and 18 (budget). Four pairs with one free model cannot say whether the memory feature, the extra `save_memory` tool or chance made the difference; do not present it as a rate or a cause.
- **Step 6 (superseded first pair, reset after call 5):** `2d0aed2a` (without memory) completed in 16 calls and `25145ab5` (with memory) in 12, both applied automatically, both 6/6 and 5/5. In both the reset came before any edit, so the handoff carried only the source revision, an empty note, no edited files and no check result; the call difference could not be attributed to memory. That pair was re-recorded for that reason and is kept as evidence.
- **Step 7:** the only run that stopped before publishing. Production stayed on the original build until the presenter approved. The approval is a presenter action and is recorded as such.
- **Held-out checks** passed on every applied patch and on the unpublished patches of steps 2 to 4. The traps were measured, not demonstrated, as in the v4 ladder.
- Nothing here is a reliability percentage. One run per step with a free model.

## Presenter actions in the recording

- Presenter evaluation (both check tiers) after every run, recorded as `checks` events with `origin: 'presenter'`.
- The permission probe after step 2, recorded as "Protected-file boundary tested" with a note that it is a presenter action, not a model action.
- The approval of step 7 after reading the diff.

API keys never appear in exports; a search of the recording for key-like strings found none.
