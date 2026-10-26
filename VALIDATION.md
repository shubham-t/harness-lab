# Validation record

For the latest run outcomes, CI revisions and remaining work, see [Project status](docs/PROJECT-STATUS.md). This record covers both API-free checks and separately identified live-provider evidence.

Validated on this laptop on **25 October 2026**.

**Full suite: 66 passed, 0 failed, 0 skipped** (`npm.cmd test`, approximately 65 seconds).
**Local readiness: 15 checks passed** (`npm.cmd run doctor`). Node 24.19.0; Chromium 156.0.4314.42.

## What was verified

| Area | Observed result |
| --- | --- |
| Original Notes defect | Real browser reproduces lost drafts on navigation and refresh: 4/6 acceptance checks pass. |
| File edits and verification | An explicit test repair changes actual source and passes 6/6 checks, including Unicode, literal markup, and multiline text. |
| Incomplete repair | A patch that discards a saved note's body fails verification. Saving must preserve full text across refresh. |
| Independent completion gate | Engineered completion is blocked by failing checks. Version 2 Minimal has no acceptance-test tool or automatic completion assessment; a separate presenter evaluation can expose failures after publication. |
| Harness anatomy | Seven cards use the slide terminology. Recorded model/tool/checkpoint/gate events drive highlights. Presenter checks highlight no agent component. Minimal has exactly two blue Enabled cards; other cards are gray and Off. Instructions and context have distinct payload evidence and independent controls. |
| Reduced Minimal | Acceptance-test and memory tools are absent and rejected if requested anyway. No progress checkpoints are saved. Presenter results are excluded from its model context. Basic task context, file/browser tools, sandbox boundaries and budgets remain. |
| Human approval | Opening the dialog does not publish. Confirmation copies the exact checked revision. Stale revisions are rejected. |
| Dashboard | Setup, visible disabled Run button, keyless checks, feature controls, scenarios, dialogs, evidence links, export, history, guide and evals work. |
| Connected dashboard controls | Test endpoint drives Run, Pause, fresh-session confirmation, edits, review, approval and the published app through actual UI clicks. |
| Presentation layout | Run controls remain visible in Focus mode at 1440×900 and 1280×720. Mobile at 390×844 has no horizontal page overflow. Screenshots inspected. |
| API adapters | Responses and standard Chat Completions carry tool calls/results through real local HTTP. Invalid and duplicate call fields are rejected. |
| Credentials and configuration | Keys excluded from public state/exports. Endpoint changes do not reuse a retained key. Active runs pin settings. A settings change invalidates an in-flight connection test. |
| Memory and restart | Fresh sessions clear conversation history; memory is restored only when enabled. Files survive. Abrupt process death preserves attempted-call counts and flags unknown usage exactly once. |
| Boundaries | Protected-file write probe, cross-origin controls, preview isolation and path traversal checks pass. |
| Evaluation integrity | Ready workspaces and manual checks excluded. Outcomes grouped by scenario, model, endpoint, protocol and exact feature configuration. |
| Browser errors | Tested dashboard flows produce no uncaught application errors or unexpected external browser requests. |

## Test evidence versus model evidence

**The revised cards and inputs passed automated testing and six fresh real-model scenario trials have completed.** Engineered passed 6/6 checks in all three scenarios and required approval. Minimal passed two scenarios; its first run had a 5/6 regression and reached its budget. All five successful proposals were tested in their published apps. See [the current live rehearsal report](live-validation/revised-cards/RESULTS.md), including separate fresh-session tests and exact limitations. These individual runs do not establish a reliability improvement.

Earlier version 1 trials remain available as [legacy evidence](live-validation/RESULTS.md) and are grouped separately in evaluations.

The application has **no simulated agent mode**. Demo runs require a real provider.

Automated provider tests use mocks or explicitly scripted loopback HTTP endpoints **inside test files only**. They exercise the actual runner, files, browser and dashboard. They do not establish model quality, and their isolated temporary records never enter the demo's run history. The test repair is not available to the production agent.

## Next live rehearsal

1. Start the latest server using `start.cmd` (restart any previously running version first).
2. Open `http://127.0.0.1:4318`, choose **Connect a model**, and enter the key, exact model ID, endpoint and supported protocol.
3. Select **Save & test**. This is the first real billable provider request; it checks connection access.
4. Create a fresh **Minimal** workspace and run the agent. If it completes, observe automatic publication without acceptance checks. Then click **Evaluate outcome** to inspect the actual result separately.
5. Create a fresh **Engineered** workspace with the same model. Run it, inspect the diff and checks, approve if appropriate, and try the published app.
6. Rehearse pause/new session while a request is in progress, then compare the recorded context and memory. A fast run may finish before you pause it.

The final clean-install run passed all 66 tests with no skips, and all 15 readiness checks passed. An earlier run intermittently returned a completion tool result without `accepted` in the Minimal HTTP test. An isolated rerun and the full rerun passed; the cause was not established. The assertion now includes the returned result to make a recurrence diagnosable. This is a remaining test stability concern, not evidence of a model failure.

Actual authentication, tool calling, new input payloads and controls were exercised with `nvidia/nemotron-3.5-super-vl:free` using the revised harness. Other providers and models remain unvalidated. Minimal may still fix the bug: demonstrate the missing enforced checks, approval and saved handoff without promising a predetermined failure.

## Repeat the local checks

From this project directory:

```powershell
npm.cmd run doctor
npm.cmd test
```

Run one test command at a time. Tests reserve loopback ports 4328–4329, 4338–4340, 4348–4349, 4358–4360, and 4378–4379, and leave the demo on 4318–4319 untouched.
