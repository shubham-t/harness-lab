# Testing and evidence

Read [Project status](PROJECT-STATUS.md) for the latest evidence snapshot and remaining environment-specific checks.

Run `npm run doctor`, then `npm test`. On Windows PowerShell use `npm.cmd` if execution policy prevents npm.ps1. Run only one test command at a time, with live rehearsals idle. The npm command runs test files sequentially so their separate Chromium processes do not compete with each other on presentation laptops. Acceptance assertions and timeout limits remain unchanged.

The current full suite has 80 passing tests; doctor has 16 passing checks. It covers pure anatomy mapping, provider parsing, tool access, actual HTTP adapters, real filesystem/browser behavior, revision-bound approval, exports, fresh sessions, abrupt restart, eval grouping, evaluation-lock timing and responsive dashboard controls.

Tests use isolated temporary data directories and explicit test-only HTTP providers. They never populate the demo history. The test repair exists only inside test code. A passing test suite proves implementation behavior under those inputs; it does not prove a live model will fix the bug.

## Live tests

With the server and real connection configured:

```powershell
node scripts/evaluate.mjs --trials 1 --scenarios draft,unicode,longform
```

This makes six real model trials and consumes provider quota. It evaluates each final source after the agent stops. It never approves proposals. Review passing Engineered diffs before approving through the UI, then test the published copy.

For memory, pause after a real edit, inspect Memory, and choose New session. Check the next assembled prompt and recorded restored checkpoint. Files survive both presets. Confirm that Minimal has no saved handoff. A fast model can finish before the pause; report that honestly.

## Recorded evidence

- [Current v3 live results and fixes](../live-validation/v3/RESULTS.md)
- [Earlier v2 card redesign and live results](../live-validation/revised-cards/RESULTS.md)
- [Earlier harness trials](../live-validation/RESULTS.md)
- [Validation details](../VALIDATION.md)

The six v2 scenario trials are individual samples, not an experiment large enough to claim a reliability percentage. The draft Minimal trial changed existing note text and exhausted its budget. Two other Minimal trials succeeded. All three Engineered trials passed and waited for approval. Both v2 interrupted memory trials retained a passing patch but failed to complete within the budget; Engineered also saw an HTTP 502 before recovery. The newer v3 report separately records a successful pair, provider failures and two fallback memory budget stops.

No live model happened to attempt an unauthorized host write in these trials. The separate permission probe and deterministic tests establish rejection of that action. Do not describe the probe as model misconduct. Similarly, successful Engineered trials establish verification and approval operation, not a live failed-check repair loop unless such an event actually appears in the trace.

## Harness v3 verification

See [the v3 report](../live-validation/v3/RESULTS.md). New tests inject transient and permanent disk errors, failed file staging, post-publication logging failures, restart recovery and HTTP approval response behavior. Handoff tests check size, frozen state, edit retention and verification-disabled exclusions. Audience tests distinguish current checks from completion/publication and reject mismatched comparisons. These are deterministic implementation tests, not real-provider rehearsals.

## Maintenance

Preserve failure evidence. When changing checks, increment CHECK_SUITE_VERSION if meaning changes. Keep historical results separate from current verification. When changing available tools or completion policy, consider harness versioning so old results remain interpretable. Never patch fixture code to make model tests pass.
