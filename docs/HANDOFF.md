# Setup handoff for another laptop

Use this document as the receiving agent's task. Complete local setup and verification, then help the presenter rehearse. Preserve existing checkout changes and configuration.

**Read [Current state and continuation priorities](PROJECT-STATUS.md) first.** It records the latest runs, tested revisions, established behavior, untested areas and remaining improvements. Do not infer readiness from the setup instructions alone.

## Purpose and behavior

Harness Lab supports a one-hour workshop for mobile software engineers, architects and leaders. The takeaway is that production agents need more than a model and a prompt.

A real LLM fixes Pocket Notes, a browser-based app whose unfinished drafts disappear when switching screens or refreshing. Each workspace begins with the same buggy source. The repair must preserve saving, existing notes and appearance.

- **Minimal** enables Agent loop and Tools & sandbox only. It still has task/conversation context and shared sandbox limits. It may solve the bug successfully. Completion can publish to its isolated demo copy without acceptance checks or approval.
- **Engineered** additionally enables Instructions & policies, Context management, Memory & state, Guardrails and Verification. It supplies separate project inputs, restores saved progress across sessions, requires passing checks and waits for explicit approval.
- Blue cards mean enabled, gray means off, and an orange outline indicates recorded activity. Cards expose evidence, not private model reasoning. Presenter evaluation is separate from agent verification.

Do not manufacture a contrast, add simulated execution, prewrite a repair or weaken checks. The starter fixture is intentionally buggy and must remain so.

## Read before setup

1. [Agent instructions](../AGENTS.md) and [README](../README.md).
2. [Operations](OPERATIONS.md), [architecture](ARCHITECTURE.md) and [testing](TESTING.md).
3. [Presenter guide](PRESENTER.md) and [demo walkthrough](../ANATOMY-DEMO.md).
4. [Validation record](../VALIDATION.md), [current v3 evidence](../live-validation/v3/RESULTS.md) and [demo cue card](DEMO-CUE-CARD.md).

## Set up this machine

1. Find or clone `https://github.com/shubham-t/harness-codex` into a suitable development directory. The repository is private. Use existing GitHub authentication or guide the user through sign-in. Preserve any existing checkout and local work.
2. Check Git and Node.js. Node 22+ is required; Node 24 was tested. Install project dependencies with `npm ci`, then run `npx playwright install chromium`. Use `npm.cmd` and `npx.cmd` on Windows if PowerShell execution policy blocks the scripts. Adapt commands to the actual operating system.
3. If organizational proxy, certificate or installation policy blocks setup, explain the exact blocker and use approved configuration. Do not disable security controls or TLS verification.
4. Create `.env` from `.env.example` if needed, without overwriting existing settings or credentials. Set `HARNESS_DATA_DIR` to the absolute path of this checkout's `.data` directory. This makes local persistence explicit instead of using the original development-folder default. Keep ports 4318 and 4319 unless occupied; do not stop unrelated processes.
5. Run `npm run doctor` and `npm test`, one test command at a time, with live rehearsals idle. The v3 update passed 16 readiness checks and 80 tests on Windows. The npm command runs test files sequentially to avoid competing Chromium processes. Consult PROJECT-STATUS.md for the latest CI revision. The historical intermittent completion failure led to tested persistence/publication fixes, but its original OS error was not retained. Investigate any recurrence rather than repeatedly retrying until green.
6. Start with `npm start` and open `http://127.0.0.1:4318`. Check the actual dashboard and phone preview using browser interactions. Confirm the draft bug, the two versus seven enabled cards, keyless browser checks, model setup, evidence dialogs and Focus demo layout.

Complete all keyless work before requesting credentials. Leave the local app running when practical, and provide exact start, stop and restart commands for this laptop.

## Configure and rehearse a real model

Ask the user for provider details only when needed. Have them enter the key directly in the local setup screen or local `.env`; never ask them to paste it into chat. Do not print keys in logs or screenshots. UI-entered keys live in server memory and disappear on restart.

The latest successful v3 pair used `https://openrouter.ai/api/v1`, Chat Completions, and `cohere/north-mini-code:free`. The earlier `nvidia/nemotron-3.5-super-vl:free` endpoint repeatedly timed out or returned HTTP 502 in this rehearsal. Both are dated observations, not guarantees of current availability. Check the provider catalog and pricing again before selecting a model. An internal endpoint must implement the adapter's tool-calling protocol; a generic chat endpoint is insufficient.

Once the user confirms the connection is ready for live testing:

1. Run Save & test. This makes a real provider request and consumes quota.
2. Run one fresh Minimal and one fresh Engineered workspace with the same model and scenario. Observe actual file edits, tool events, browser results and component evidence.
3. Evaluate Minimal's resulting source separately after the agent stops. Success is possible and must be reported honestly.
4. For Engineered, inspect the diff and current verification results. Present the patch for the user's approval before publishing its isolated demo copy, then test that copy.
5. Optionally rehearse Pause / New session. Both retain files; only the enabled memory workflow supplies saved handoff information. Saved state does not guarantee completion.

Do not claim success for unperformed tests. Report provider failures, budget stops and unresolved errors separately from source correctness. The previous real trials included successful Minimal runs, one Minimal regression, and memory runs that hit budgets. They are individual observations, not a reliability benchmark.

## Slides and history

Open [the PowerPoint](../presentation/Agent-Harness-Workshop.pptx) directly. It contains speaker notes and real rehearsal screenshots, with older and latest evidence separately labeled. [Plain-text speaker notes](../presentation/speaker-notes.md) are also available. The optional presentation-authoring runtime is not required to run the app or use the existing deck.

The repository contains historical exports and screenshots, not the previous laptop's live runtime history or credentials. A fresh checkout starts without those workspaces. Do not import recordings as live runs or describe screenshots as current execution. No private runtime-data migration is needed for setup.

## Completion report

Give the user the checkout path, dashboard URL, start/stop/restart commands, test results, any remaining blockers, and a short rehearsal sequence. List any local changes and why they were needed. Do not push machine-specific settings or secrets.
