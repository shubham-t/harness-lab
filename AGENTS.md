# Working on Harness Lab

This repository is a local teaching application about agent harness engineering. Read [README.md](README.md), [architecture](docs/ARCHITECTURE.md) and [testing](docs/TESTING.md) before changing behavior. The presenter flow is in [ANATOMY-DEMO.md](ANATOMY-DEMO.md).

For continuation work, first read [current project status](docs/PROJECT-STATUS.md): it distinguishes tested behavior, latest real runs, unresolved issues and next priorities. Update it when new evidence or implementation changes alter those conclusions.

## Commands

- Node.js 22 or newer. Install with `npm ci`, then `npx playwright install chromium`.
- `npm start` serves the dashboard on 127.0.0.1:4318 and the application preview on 4319.
- `npm run doctor` checks local readiness without calling a model.
- `npm test` runs isolated automated tests sequentially. Run one test command at a time with live rehearsals idle; integration tests reserve fixed ports and launch real Chromium processes.
- `node scripts/evaluate.mjs --trials 1 --scenarios draft,unicode,longform` makes six real model trials against the running server. `--ladder`, `--rungs`, `--reset-after N` and `--out FILE` run and record the v4 ladder (`--help` lists them). Every trial consumes provider quota. Use only when live testing is requested.

## Design invariants

1. Production agent execution must use real provider calls, real file operations and real browser observations. Scripted responses belong only in tests.
2. Do not deliberately sabotage Minimal or prewrite a successful Engineered patch. Preserve the identical task, starting files and shared budgets.
3. Minimal enables only Agent loop and Tools & sandbox. Optional instructions, project context, saved handoff, approval and acceptance verification are off. It still has basic task/conversation context, file/browser tools and shared sandbox limits. It can discover PROJECT.md using read_file.
4. Engineered supplies separate instructions and context evidence, saves progress, requires current passing checks and waits for explicit approval.
5. Instructions are model guidance. Guardrails are runtime enforcement. Do not label supplied rules as proven model compliance.
6. Cards show Enabled/Off independently of current action. Blue means enabled, gray means off, orange outline means activity. Never highlight a disabled component. Presenter evaluation is outside the agent workflow.
7. Never fake telemetry, model reasoning, timings, success or causality. Keep model failures and unreported usage visible. Earlier evidence is immutable; record new assessments separately.
8. Keep protected checks outside agent-editable paths. Preserve revision-bound approval, allowlisted tools, preview-origin isolation and loopback binding.
9. Keep API keys out of source, logs, exports, screenshots and commits. Do not inspect private API history unnecessarily. UI keys live only in server memory.
10. Restarting the server clears a memory-only key. Check for active runs first, preserve run directories, and explain the effect. Never kill unrelated processes.
11. Harness v4 (see [the v4 design](docs/REDESIGN-V4.md)): every preset gets the same task text, starting files, budgets and tool schemas. Only what the harness supplies and requires differs.
12. The PN-142 ticket thread is harness-owned and outside the agent-readable files. Only Context management supplies it. PROJECT.md stays readable by every preset.
13. Held-out checks are presenter-only. Never return them to the agent in a tool result, prompt or handoff. `run_checks` and the completion gate use the visible tier only.
14. Production is the published copy when one exists, otherwise the pristine fixture. Nothing reaches it except through `publish()`.
15. A forced reset (`resetAfterCalls`) happens at the same call for every preset and is part of the evaluation grouping. Runs from v1 to v3 keep their recorded behavior and labels. No live v4 evidence exists until a real run records it; never pool v2/v3 evidence with v4.
16. The harness builder page (see [the builder design](docs/BUILDER.md)) shows how a harness is built one component at a time from recorded real runs. Loop-only runs (`loopOnly: true`, no tools) and model-only requests (`POST /api/model/task-only`) are builder evidence: same task text and budgets, never compared with Minimal or Engineered in the dashboard comparison or ladder. The page never animates an invented run; a missing step says so.

## Verification and evidence

Run tests appropriate to a change, then the full suite for runner, transport, approval or browser changes. Use real API rehearsals only after automated checks pass. Distinguish test-only loopback fixtures from real-provider evidence. Compare several runs before making reliability claims.

The deliberately buggy `fixtures/notes` is the starting point, not a defect to fix as part of maintenance. Agent patches belong in runtime workspaces. Do not weaken acceptance checks to accommodate a generated patch.

## Files and delivery

- `lib/`: store, provider adapters, agent runner and browser checks.
- `public/`: dashboard, event-derived anatomy cards and evidence-based audience comparison.
- `tests/`: isolated unit, HTTP and real-browser tests.
- `live-validation/`: recorded live evidence, not injected into the demo's live history. `v4/` holds the first v4 ladder and `builder/` the recorded runs behind the builder page (`scripts/record-builder.mjs`). Earlier folders are historical; leave recorded evidence untouched and add new sets in new folders.
- `presentation/`: workshop deck, generated speaker notes and rebuild source (`build.mjs` with pptxgenjs, `capture-v4.mjs` for dashboard screenshots of recorded runs). Rebuilt for v4 on 27 October 2026; edit notes in `build.mjs`.
- `docs/`: operator and developer documentation.

Harness v3 freezes compact memory on session reset. Keep budgets equal and retain full checkpoints as evidence. Publication must remain atomic; a later logging failure must not falsely imply that applied files were rolled back. Preserve the manifest recovery and fault-injection tests.

Terminal run status can precede release of the runner lock. Rehearsal scripts use `evaluateStoppedRun` for bounded retries of that exact busy conflict; never swallow actual browser-check errors or treat a retry as another model trial.

Keep this file short. Put detailed decisions in linked documents. Update the guide, deck and evidence notes when terminology or behavior changes. Do not commit `.env`, runtime API histories, node_modules, build caches or temporary logs.
