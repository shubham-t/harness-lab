# Real OpenRouter trials — 25 October 2026

These are actual API calls to `nvidia/nemotron-3.5-super-vl:free` through OpenRouter's Chat Completions endpoint. The model read and edited real files. The browser checks exercised the actual app. No scripted responses or manual application repairs were used.

## First comparison

| | Minimal | Engineered |
| --- | --- | --- |
| Run ID | `3177359d-554a-408c-81b5-f4d2215cecc1` | `037226ec-6786-46c6-9f69-38a41728f9b5` |
| Model calls | 5 | 5 |
| Reported input tokens | 18,299 | 22,595 |
| Reported output tokens | 2,047 | 8,000 |
| Recorded agent time | 121 seconds | 157 seconds |
| Changed files | `src/storage.js` | `src/storage.js` |
| Initial protected browser result | 6/6 | 6/6 |
| Strengthened browser reassessment | 6/6 | 5/6 |
| Publication | Automatically applied to isolated demo copy | Awaiting approval; deliberately not approved |

Minimal fixed the three draft-storage functions cleanly. A separate Playwright pass exercised its published app: navigation, refresh, saving Unicode and literal markup, preserving the complete saved body, and clearing the saved draft all passed. No uncaught browser errors were observed.

Engineered fixed draft persistence, but also changed the original release-checklist note's newline escape into literal backslash-n text. Code review caught this unintended edit. The old suite preserved whatever seed content appeared in the edited app; it did not compare that content with the original expected notes. The strengthened check compares exact original titles and full text, including line breaks, and correctly rejects this patch.

One Engineered response also reached its output-token limit. The run continued and completed its proposal. This accounts for a substantial part of its output usage; it is not evidence of greater quality.

## What this establishes

- OpenRouter authentication and actual tool calling work with the selected free model.
- File inspection, file replacement, tool continuation, browser verification, and the review state work end to end.
- Minimal's published result works in a separate browser check.
- Engineered's approval boundary held: its proposal was not automatically published.
- Verification is only as good as the checks. Real model output revealed an omission in our suite, which was fixed and regression-tested.

This is one trial per configuration. It does **not** establish that Engineered produces better patches. In this comparison, Minimal produced the cleaner patch.

## Changes made after these trials

- Protected browser checks now compare original note content independently of the model's edited source.
- OpenRouter-specific reasoning continuation is retained privately between requests; it is excluded from visible transcripts and exports.
- OpenRouter's connection test has a larger, still-small output allowance and requests reasoning disabled; a reasoning-only result is not reported as a successful connection test.

The first two trials predate those changes. Their original exported evidence is retained alongside the separate stronger-check reports. Further trials must be identified separately rather than presented as the same experiment.

## Updated runtime verification

The full automated suite passed **58/58** after the fixes. The server was restarted with check suite `notes-v2`, and both actual model patches were reassessed through its normal API: Minimal 6/6; Engineered 5/6. No model calls were needed for this reassessment.

A real dashboard browser pass confirmed that Engineered's Approve button is disabled. A direct approval request was also rejected by the server, and its published app still returns 404. This is enforcement by the harness, not merely a warning in the UI. Versioned exports (`*-v2.json`) preserve the updated results separately.

Historical results now retain their check-suite version and cannot count as current verification or permit gated publication until rechecked.

## Updated-harness launch attempt

Run `96e63813-a5c3-429c-ad90-cad214430d7e` failed on its first attempted request with `fetch failed`, before any model output or file edits. The server had been launched inside a network-restricted tool environment. A separate public-catalog request confirmed a forbidden socket there and HTTP 200 outside it. The server was then relaunched outside that restriction. This is an environment failure, not evidence of model capability. The failed run remains recorded, with unreported token usage rather than an invented zero-cost claim.

## Successful updated Engineered trial

Run `1910840b-d83e-4b7c-9391-a5406293b8d4` used the updated provider adapter and `notes-v2` checks. It completed in 102 seconds using 6 model calls, with 36,385 reported input tokens and 1,771 output tokens. The model read source, changed only `src/storage.js`, ran checks, interacted through the real browser tool and requested completion. All 6 checks passed. Review confirmed the original note text was preserved.

The patch was approved through the actual dashboard confirmation dialog. A separate Playwright session exercised the published app: navigation, refresh, saving full Unicode/literal-markup text, clearing the saved draft, and preserving original note content all passed. No uncaught browser errors were observed. Screenshots and the real evidence export are saved with the run ID in their filenames.

The updated OpenRouter connection-test endpoint was also called successfully: 23 input tokens and 2 output tokens reported. This connection test is separate from agent-run accounting.

This successful trial demonstrates a working end-to-end configuration. It does not erase the earlier failed patch or establish a statistical reliability advantage.

## Live pause, memory and budget trial

Run `32129a78-d311-4617-9e22-fc5fb3339a31` used Engineered with the Unicode check variant. Actual dashboard clicks started and paused it after its first edit checkpoint. The pause preserved its source. The New session confirmation started session 2, whose recorded instructions included the measured checkpoint and its exact source revision; the previous conversation was discarded.

OpenRouter returned HTTP 502 on the next request. After a short wait, one explicit resume started session 3. The model continued from the existing work and passed all six Unicode checks. It then continued browser interactions instead of requesting completion. One response reached its output limit.

The harness stopped the run at its conservative token budget: 11 attempted calls, 74,649 reported tokens, and an estimated 82,527-token reservation for another request exceeded the 150,000-token total allowance. Reported usage was 62,589 input and 12,060 output tokens, with usage unknown for two requests (the intentional pause and the provider error). Active runtime was approximately 257 seconds. The source remained available, and nothing was published.

**What passed:** actual pause, fresh-session confirmation, durable checkpoint restoration, recovery after a provider error, Unicode acceptance checks, and budget enforcement. **What did not complete:** the agent's completion request and publication in this separate recovery trial. It is recorded as budget-limited, not a completed success.

For the presentation, use the successful fresh run to demonstrate approval/publication. The recovery trial is useful evidence for memory, failure handling and budgets. Free-provider latency and availability are variable; do not promise a fixed duration or repeatable result.
