# Harness builder: recorded runs

Recorded on **27 October 2026 (UTC 15:47 to 16:02)** on the development laptop against the `harness-builder` working tree in `C:/Projects/harness-lab`, with `node scripts/record-builder.mjs --out live-validation/builder` and then `--phase finish`. Every row is a real OpenRouter Chat Completions run with real file edits and real Chromium checks. No patch or model answer was injected, no budget was changed, and failures are kept. One run per step; this illustrates the mechanism of each component and establishes no reliability percentage.

These runs feed the builder page (`/builder.html`, see [the builder design](../../docs/BUILDER.md)). They are builder evidence: loop-only runs and the model-only request are grouped separately in the dashboard and never compared with Minimal or Engineered.

## Setup

| Item | Value |
| --- | --- |
| Model | `cohere/north-mini-code:free` (OpenRouter, Chat Completions), request pacing 4.5 s |
| Harness | version 4, check suite `notes-v3`; presenter evaluation of both tiers after every run |
| Task and fixture | the draft scenario only; identical task text, starting files and budgets (24 calls, 150,000 reported tokens) for every run |
| Forced reset | step 6 only: `resetAfterCalls = 5` for both runs |
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
| 6 | Memory, without | `2d0aed2a` | completed | 16 | 55,049 | 93 s | 6/6 | 5/5 | Session 1 read five files, then the forced reset. Session 2 started from the task: listed and re-read four files, ran checks, wrote the fix, ran checks twice more, completed. Applied automatically. |
| 6 | Memory, with | `25145ab5` | completed | 12 | 37,624 | 63 s | 6/6 | 5/5 | Session 1 read five files, then the forced reset. Session 2 received the frozen handoff, re-read three files, wrote the fix, ran checks once, completed. Applied automatically. |
| 7 | Guardrails: approval | `5bf747f1` | awaiting_approval, then completed | 6 | 18,177 | 35 s | 6/6 | 5/5 | Read, wrote `src/storage.js`, ran checks, requested completion, stopped at the approval boundary. The presenter read the diff (storage only, a separate `draft` key, notes untouched) and approved at 16:02:14 UTC. |

Tokens are reported input plus output; no request went unreported. Elapsed times include the 4.5-second pacing. The step 0 request took no run and reports no elapsed time.

## What this shows, and what it does not

- **Steps 0 and 1:** without tools the model can only write. In the loop it wrote 21,395 output tokens of plans and diffs across five rounds, nothing changed, and the shared budget ended the run. This is the mechanism of a loop without actions, not a measure of the model.
- **Steps 2 to 4:** with tools the model fixed the bug every time (6/6 and 5/5 after the presenter evaluation) and never declared completion. It tested by hand until the budget ended. Adding the rules (step 3) and the project context (step 4) proves those inputs were sent; it did not change this outcome. Supplying a rule proves inclusion, not compliance.
- **Step 5:** the first run that finished. With `run_checks` available and completion gated, the same model wrote the fix, checked it and stopped in 9 calls. No completion request was rejected by the gate in this run; the automated tests cover the rejection path.
- **Step 6:** both runs reset after call 5, which in both cases was before any edit. The frozen handoff therefore carried only the source revision, an empty note, no edited files and no check result. Session 2 with memory used fewer calls (12 against 16), but with an almost empty handoff that difference cannot be attributed to memory. The page says so. A reset placed after the first edit would give the handoff something to carry; that is a separate recording.
- **Step 7:** the only run that stopped before publishing. Production stayed on the original build until the presenter approved. The approval is a presenter action and is recorded as such.
- **Held-out checks** passed on every applied patch and on the unpublished patches of steps 2 to 4. The traps were measured, not demonstrated, as in the v4 ladder.
- Nothing here is a reliability percentage. One run per step with a free model.

## Presenter actions in the recording

- Presenter evaluation (both check tiers) after every run, recorded as `checks` events with `origin: 'presenter'`.
- The permission probe after step 2, recorded as "Protected-file boundary tested" with a note that it is a presenter action, not a model action.
- The approval of step 7 after reading the diff.

API keys never appear in exports; a search of the recording for key-like strings found none.
