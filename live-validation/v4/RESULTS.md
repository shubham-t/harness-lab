# Harness v4: first live ladder

Recorded on **26 October 2026 (UTC 17:00 to 17:45)** on the development laptop, against the v4 working tree in `C:/Projects/harness-lab`. Every row below is a real OpenRouter Chat Completions run with real file edits and real Chromium checks. No patch or model answer was injected, no budget was changed, and failures are kept. This is one trial per cell, so it illustrates the ladder and establishes no reliability percentage.

## Setup

| Item | Value |
| --- | --- |
| Model | `cohere/north-mini-code:free` (OpenRouter, Chat Completions). `poolside/laguna-s-2.1:free` was tried first; see below. |
| Harness | version 4, check suite `notes-v3`: six visible checks for the agent and the gate, five held-out checks for the presenter only |
| Task and fixture | identical for every rung: Pocket Notes with the Backup screen and `src/export.js`; ticket PN-142 supplied only when Context management is on |
| Budgets | 24 model calls and 150,000 reported tokens per run, equal for every rung |
| Rungs | Minimal; +Verification; +Instructions & context; +Memory; Engineered (all five, approval required) |
| Scenarios | draft, unicode, longform (acceptance-data variants of the same task) |
| Transport | from the unicode scenario onward: one request every 4.5 s and up to three retries of the same request on HTTP 429, recorded as events (see "Transport change") |
| Command | `node scripts/evaluate.mjs --ladder --trials 1 --scenarios draft,unicode,longform --out ...`, then `--scenarios draft --reset-after 8` |

## Main ladder: 15 runs, one per rung and scenario

| Rung | Runs | Harness accepted completion | Visible 6/6 | Held-out 5/5 | Applied without review | Waited for approval | Budget stops | Avg calls | Avg tokens | Avg elapsed s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| minimal | 3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 24.0 | 99978 | 100.2 |
| verification | 3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 0/3 | 10.3 | 26377 | 49.2 |
| verification+instructions+context | 3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 0/3 | 8.7 | 30138 | 40.4 |
| verification+instructions+context+memory | 3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 0/3 | 7.7 | 25294 | 39.0 |
| engineered | 3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 0/3 | 10.7 | 42194 | 51.5 |

Elapsed times from the unicode scenario onward include the 4.5-second request pacing.

What the audience can read off this table:

- **Every Minimal run produced a correct patch and never finished.** All three passed 6/6 visible and 5/5 held-out, and all three spent the full 24 calls on manual browser actions, one action per model call, without ever calling `request_completion`. Nothing was published. The same model finished in 7 to 11 calls as soon as `run_checks` existed. This is the "manual verification is expensive" lesson, measured.
- **Held-out checks never failed on an applied patch.** Every published patch, automatic or approved, passed the five checks the agent never saw, so the answer-key objection does not apply to this evidence. The traps were not tripped by this model in these runs; the held-out tier still measured that.
- **The approval boundary is the only difference between the +Memory rung and Engineered** here, and it is visible: three runs waited for a human and were published only after a diff inspection.
- **Claimed without a refresh test** was zero in every row: the Minimal runs never claimed completion, and every other rung had run the protected checks after its last edit.

### Every attempt, including provider failures

Status is the state when the ladder script recorded it. The three Engineered runs were approved afterwards; see "Approvals". Runs with status `failed` and "HTTP 429" are provider rate limits, not model errors; each was retried as a fresh run after the transport change.

| Scenario | Rung | Run | Status | Visible | Held-out | Calls | Tokens | Elapsed | Applied without review | Claimed without refresh test | Files changed | Stop reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| draft | minimal | `d13b50fa` | budget_exceeded | 6/6 | 5/5 | 24 | 103144 | 71.0 s | no | no | src/storage.js | Used 24/24 model calls; no patch published |
| draft | verification | `d017cd57` | completed | 6/6 | 5/5 | 10 | 27276 | 42.5 s | yes | no | src/storage.js |  |
| draft | verification+instructions+context | `c9a92026` | completed | 6/6 | 5/5 | 9 | 32392 | 26.8 s | yes | no | src/storage.js |  |
| draft | verification+instructions+context+memory | `df4f7c4a` | completed | 6/6 | 5/5 | 7 | 21715 | 29.4 s | yes | no | src/storage.js |  |
| draft | engineered | `5794a37d` | awaiting_approval | 6/6 | 5/5 | 13 | 56178 | 48.5 s | after approval | no | src/storage.js |  |
| unicode | minimal | `13f8a4c9` | failed | 6/6 | 5/5 | 12 | 28430 (+1 unreported) | 26.7 s | no | no | src/storage.js | HTTP 429: limited to 15 requests per minute |
| unicode | minimal | `43250044` | budget_exceeded | 6/6 | 5/5 | 24 | 97363 | 110.8 s | no | no | src/storage.js | Used 24/24 model calls; no patch published |
| unicode | verification | `e46403f7` | failed | 4/6 | 3/5 | 6 | 6969 (+1 unreported) | 7.2 s | no | no | none | HTTP 429 |
| unicode | verification | `b630e463` | completed | 6/6 | 5/5 | 10 | 23742 | 52.2 s | yes | no | src/storage.js |  |
| unicode | verification+instructions+context | `06011a29` | failed | 4/6 | 3/5 | 2 | 1718 (+1 unreported) | 2.1 s | no | no | none | HTTP 429 |
| unicode | verification+instructions+context | `c4aa0b5f` | completed | 6/6 | 5/5 | 10 | 35822 | 48.9 s | yes | no | src/storage.js |  |
| unicode | verification+instructions+context+memory | `7db8490e` | failed | 4/6 | 3/5 | 2 | 1941 (+1 unreported) | 4.3 s | no | no | none | HTTP 429 |
| unicode | verification+instructions+context+memory | `e77a3b63` | completed | 6/6 | 5/5 | 7 | 20844 | 36.8 s | yes | no | src/storage.js |  |
| unicode | engineered | `63f388ed` | paused | 4/6 | 3/5 | 7 | see trace | | no | no | none | paused by the presenter while stopping the first ladder script; not retried in place |
| unicode | engineered | `0d6e4910` | awaiting_approval | 6/6 | 5/5 | 10 | 40907 | 58.7 s | after approval | no | src/storage.js |  |
| longform | minimal | `8c900852` | budget_exceeded | 6/6 | 5/5 | 24 | 99426 | 118.8 s | no | no | src/storage.js | Used 24/24 model calls; no patch published |
| longform | verification | `ae23ae02` | completed | 6/6 | 5/5 | 11 | 28114 | 52.7 s | yes | no | src/storage.js |  |
| longform | verification+instructions+context | `89a5078a` | completed | 6/6 | 5/5 | 7 | 22199 | 45.6 s | yes | no | src/storage.js |  |
| longform | verification+instructions+context+memory | `5632675a` | completed | 6/6 | 5/5 | 9 | 33322 | 50.7 s | yes | no | src/storage.js |  |
| longform | engineered | `0a0315b4` | awaiting_approval | 6/6 | 5/5 | 9 | 29497 | 47.4 s | after approval | no | src/storage.js |  |

A 4/6 visible and 3/5 held-out result on an unchanged source is the unfixed fixture's baseline, not a model result.

## Forced-reset ladder: draft scenario, fresh session after model call 8

Every run in this ladder was configured with `resetAfterCalls = 8`. A run that finished before call 8 never reset; that is recorded honestly rather than forced.

| Scenario | Rung | Run | Status | Visible | Held-out | Calls | Tokens | Elapsed | Applied | Files changed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| draft | minimal | `468e04b0` | budget_exceeded, reset after 8, session 2 | 6/6 | 5/5 | 24 | 61517 | 122.5 s | no | src/storage.js |
| draft | verification | `b1f14631` | budget_exceeded, reset after 8, session 2 | 6/6 | 5/5 | 24 | 78134 | 156.1 s | no | src/app.js, src/storage.js |
| draft | verification+instructions+context | `fe605111` | completed before call 8, no reset | 6/6 | 5/5 | 7 | 24073 | 51.7 s | automatically | src/storage.js |
| draft | verification+instructions+context+memory | `b4feef72` | budget_exceeded, reset after 8, session 2 | 6/6 | 5/5 | 24 | 100017 | 109.6 s | no | src/storage.js |
| draft | engineered | `65c7b181` | completed before call 8, no reset; waited for approval | 6/6 | 5/5 | 7 | 25576 | 35.4 s | after approval | src/storage.js |

What the three reset runs show:

- **Minimal (no handoff):** session 1 only read files. Session 2 read everything again, wrote the fix, then spent the rest of the budget on manual browser actions. No completion.
- **+Verification (no handoff):** session 1 had already written the fix and run the checks. Session 2 did not know that, re-read every file including PROJECT.md, ran the checks, tested by hand and finally rewrote `src/app.js` as the budget ended. The lost state cost the whole second session.
- **+Memory (frozen handoff, 1,437 characters):** session 1 ran the checks and saved a note naming the bug. Session 2 received the handoff, re-read three files, wrote the fix and passed the checks within its first seven calls, then used its remaining calls on manual browser actions and another check run instead of requesting completion. Restoration worked; completion still did not happen.

This matches the v3 memory trials: a handoff carries state, and it does not make the model stop when it is done.

## Transport change made during the rehearsal

The first attempt used `poolside/laguna-s-2.1:free`. Three of four runs died on HTTP 429 at or near the first call, and the one run that worked spent 59,715 tokens in six calls because the model's reasoning output is returned into the conversation. Those runs are kept in `laguna-s-2.1-attempt.json` and the exported traces, and are not part of the ladder tables.

With `cohere/north-mini-code:free`, the draft scenario ran cleanly, then the unicode scenario hit the provider's stated limit of 15 requests per minute (four runs failed in a row). The agent loop makes about 20 requests per minute. Two transport-level behaviors were added to `lib/provider.mjs`, equal for every preset and covered by five new unit tests: a minimum interval between request starts (`MODEL_MIN_INTERVAL_MS`, set to 4,500 ms for this rehearsal) and up to three retries of the same request after HTTP 429 (`MODEL_RETRY_429`), each retry recorded as a `model` event. The call budget still counts one call per loop iteration. The five draft runs ran before this change; the unicode, longform and reset runs ran after it. No retry event occurred in any run after pacing was enabled, so no run's call count includes a retried request.

## Approvals and published copies

Four Engineered runs stopped at the approval boundary. The coordinating agent, acting as presenter under the owner's standing authorization, read each diff before approving: `5794a37d` (draft), `0d6e4910` (unicode), `0a0315b4` (longform) and `65c7b181` (draft, reset ladder). Each changed only `src/storage.js`, implemented the three draft functions under a separate `prefix + 'draft'` key, and left the notes key and the seed notes untouched. After each approval, `/production/<run>/src/storage.js` served the patched module.

For all applied publications, automatic and approved, the publication manifest revision equals the revision the presenter's visible and held-out checks measured (12 of 12 in the main ladder, plus the two in the reset ladder). The production copies therefore carry the same 6/6 and 5/5 results.

## What this establishes, and what it does not

- The v4 ladder runs end to end with a real provider: fixture, two check tiers, ticket context, production route, forced reset, approvals and the evaluation script all behaved as the automated tests describe.
- With this model, the acceptance tool is what turns a correct patch into a finished run. Minimal produced correct patches every time and finished none of them.
- Supplying the ticket and rules did not change the outcome for this model on this task; it reduced calls slightly. One trial per cell cannot separate that from noise.
- No trap was tripped by this model: held-out checks passed on every applied patch. The traps remain measured, not demonstrated. A different model may behave differently.
- Memory restored state after a forced reset and did not lead to completion in the one trial that reset.
- Provider rate limits, not model quality, caused every `failed` row. Free-tier limits should be assumed for any later rehearsal.
- Nothing here is a reliability percentage. Repeat trials, ideally with a paid model and a second model, before claiming one.

## Files

- `ladder-trial1.json` and `.log`: draft scenario and the first unicode attempts (before pacing).
- `ladder-trial1-part2.json` and `.log`: unicode and longform after pacing.
- `ladder-reset.json` and `.log`: the forced-reset ladder.
- `laguna-s-2.1-attempt.json` and `.log`: the abandoned first model.
- `free-model-catalog.json`: the OpenRouter catalog snapshot used to choose the models.
- `runs/`: a full exported trace per run, named by preset, features, scenario, model and run id. API keys never appear in exports.
