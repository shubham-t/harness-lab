# Revised anatomy: real-model rehearsal

Recorded 2026-10-25T17:53:27.323Z.

Provider: OpenRouter Chat Completions, `nvidia/nemotron-3.5-super-vl:free`. The trials used real model responses, real source edits and real browser checks. No application repair was scripted or supplied manually.

## Scenario matrix

| Scenario | Harness | Agent outcome before review | Browser checks | Model calls | Run evidence |
| --- | --- | --- | --- | --- | --- |
| draft | minimal | budget_exceeded | 5/6 | 13 | [7b1550a9](minimal-draft-7b1550a9-12fd-4778-a148-312819f26cbd.json) |
| draft | engineered | awaiting_approval | 6/6 | 5 | [cf25feae](engineered-draft-cf25feae-cd17-4bfa-a052-d9771d84c848.json) |
| unicode | minimal | completed | 6/6 | 11 | [3a4e2825](minimal-unicode-3a4e2825-049a-46a2-9a18-38828ffe12f4.json) |
| unicode | engineered | awaiting_approval | 6/6 | 5 | [3ae861e2](engineered-unicode-3ae861e2-4243-4869-847f-8a3076098682.json) |
| longform | minimal | completed | 6/6 | 12 | [fba0c680](minimal-longform-fba0c680-9f8b-421d-b1bb-9358a9ffc298.json) |
| longform | engineered | awaiting_approval | 6/6 | 4 | [64eed9f8](engineered-longform-64eed9f8-51fe-4a32-89fb-113b9cb28635.json) |

Checks in this table were measured independently after the agent stopped. A passing browser result is not the same as successful completion or approval. These are individual trials, not a reliability benchmark.

## Component behavior

- Minimal displayed exactly two blue Enabled cards. Instructions, context, memory, approval and verification cards stayed gray and Off. There were no automatic project input events, memory checkpoints or agent acceptance-check events. Basic task context, tools and shared sandbox/budgets remained.
- Engineered displayed all seven blue cards. Each real request recorded separate policies and project-map payloads. Clickable card evidence was checked in the browser. The orange outline identified inputs included in an in-flight request, without claiming the model complied with them.
- Independent presenter evaluation did not light up an agent component. Both runs remained visible in the activity log.
- Automated regression testing: 66 tests passed, plus the focused browser suite for card colors and separate input evidence passed. Local readiness: 15 checks passed.

## Live failures and limits

- minimal/draft (7b1550a9): budget_exceeded, 5/6. Inspect its exported checks and trace for exact failures and budget accounting.

## Fresh-session rehearsal

- **minimal**: pause after real edit observed; session 2; final status budget_exceeded; checks 6/6; 15 actual model requests. [Trace](memory-minimal-b92338fb-410c-43c4-90ee-5d03f37c9457.json).
- **engineered**: pause after real edit observed; session 2; final status failed; checks 6/6; 4 actual model requests. [Trace](memory-engineered-da5cf49c-67e0-4e43-9a1b-f24623ad5e94.json).

A fresh session clears the prior API conversation. Working files remain in both presets. Engineered restores measured checkpoints; Minimal does not receive that saved handoff. An intentionally aborted request may have unreported provider usage, which remains flagged rather than estimated.

Engineered recovery after the recorded HTTP 502: session 3 restored the checkpoint, then stopped with **budget_exceeded**, 6/6 checks, and 11 cumulative calls. The passing patch was not published. [Recovery trace](memory-engineered-da5cf49c-67e0-4e43-9a1b-f24623ad5e94-recovery.json).

## Approval and published app

- engineered (cf25feae): completed; independent published-app check **passed**; 0 uncaught browser errors. [Full trace](../engineered-cf25feae-cd17-4bfa-a052-d9771d84c848.json).
- engineered (64eed9f8): completed; independent published-app check **passed**; 0 uncaught browser errors. [Full trace](../engineered-64eed9f8-51fe-4a32-89fb-113b9cb28635.json).
- minimal (fba0c680): completed; independent published-app check **passed**; 0 uncaught browser errors. [Full trace](../minimal-fba0c680-9f8b-421d-b1bb-9358a9ffc298.json).
- minimal (3a4e2825): completed; independent published-app check **passed**; 0 uncaught browser errors. [Full trace](../minimal-3a4e2825-049a-46a2-9a18-38828ffe12f4.json).
- engineered (3ae861e2): completed; independent published-app check **passed**; 0 uncaught browser errors. [Full trace](../engineered-3ae861e2-4243-4869-847f-8a3076098682.json).

The published-app check exercised actual navigation, refresh, Unicode/literal markup, complete saved text, original-note preservation and clearing the draft. Engineered patches were reviewed before approval. Opening the confirmation dialog was separately checked not to publish. [Machine-readable results](published-results.json).

Failed checks, budgets, or provider failures must remain visible during presentation; no predetermined contrast is promised.
