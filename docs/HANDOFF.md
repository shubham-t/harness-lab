# Setup handoff for another laptop

Use this document as the receiving agent's task. Complete local setup and verification, then help the presenter rehearse. Preserve existing checkout changes and configuration.

**Current state (27 October 2026):** the repository is `https://github.com/shubham-t/harness-lab`. Branch `v4-redesign` holds harness v4 as described in [the v4 design](REDESIGN-V4.md); `main` is the older v3 baseline kept for history. The integrated suite passes 136 tests and the doctor 18 checks on the development laptop. The first live v4 ladder is recorded in [the v4 live report](../live-validation/v4/RESULTS.md). [PROJECT-STATUS.md](PROJECT-STATUS.md) is authoritative for what is established, what is open and the state of the deck.

## Copy-and-paste prompt for the receiving agent

The complete prompt lives in [NEXT-MACHINE-PROMPT.md](NEXT-MACHINE-PROMPT.md). Give that file to the agent on the new machine as its first message. It covers context gathering, keyless setup and verification, the live ladder procedure, what is and is not established, and the completion report.

**Read [Current state and continuation priorities](PROJECT-STATUS.md) first.** It records the latest runs, tested revisions, established behavior, untested areas and remaining improvements. Do not infer readiness from the setup instructions alone.

## Purpose and behavior

Harness Lab supports a one-hour workshop for mobile software engineers, architects and leaders. The takeaway is that production agents need more than a model and a prompt: a harness supplies what the model cannot know, cannot check, cannot keep and should not decide alone.

A real LLM fixes Pocket Notes, a browser-based app whose unfinished drafts disappear when switching screens or refreshing. In v4 the app also has a Backup screen backed by `src/export.js`, and a harness-owned ticket thread (`fixtures/ticket/PN-142.md`) that only Context management supplies. Each workspace begins with the same buggy source. The repair must preserve saving, existing notes, the backup and appearance.

- **Minimal** enables Agent loop and Tools & sandbox only. It still has task/conversation context, can read PROJECT.md with `read_file`, and shares the sandbox limits and budgets. Completion publishes to its production copy without acceptance checks or approval.
- **Engineered** additionally enables Instructions & policies, Context management (including the ticket), Memory & state, Guardrails and Verification. It can run the six visible checks, must pass them to complete, and waits for explicit approval.
- **Two check tiers:** the agent and the gate use six visible checks; the presenter evaluation adds five held-out checks the agent never sees. Both presets are graded on both.
- **Two phones:** SANDBOX is where the agent works; PRODUCTION shows the published copy or the original build, with a banner saying whether a change was applied automatically, after approval, or is waiting.
- Blue cards mean enabled, gray means off, and an orange outline indicates recorded activity. Cards expose evidence, not private model reasoning. Presenter evaluation is separate from agent verification.

Do not manufacture a contrast, add simulated execution, prewrite a repair or weaken checks. The starter fixture is intentionally buggy and must remain so.

## Read before setup

1. [Agent instructions](../AGENTS.md) and [README](../README.md).
2. [Project status](PROJECT-STATUS.md) and [the v4 design](REDESIGN-V4.md).
3. [Operations](OPERATIONS.md), [architecture](ARCHITECTURE.md) and [testing](TESTING.md).
4. [Presenter guide](PRESENTER.md), [demo walkthrough](../ANATOMY-DEMO.md) and [demo cue card](DEMO-CUE-CARD.md).
5. [Validation record](../VALIDATION.md) and [the v4 live report](../live-validation/v4/RESULTS.md). The v2 and v3 reports under `live-validation/` are historical.

## Set up this machine

1. Find or clone `https://github.com/shubham-t/harness-lab` and check out `v4-redesign`. The repository is private. Use existing GitHub authentication or guide the user through sign-in. Preserve any existing checkout and local work.
2. Check Git and Node.js. Node 22+ is required; Node 24.19 was tested. Install project dependencies with `npm ci`, then run `npx playwright install chromium`. Use `npm.cmd` and `npx.cmd` on Windows if PowerShell execution policy blocks the scripts. Adapt commands to the actual operating system.
3. If organizational proxy, certificate or installation policy blocks setup, explain the exact blocker and use approved configuration. Do not disable security controls or TLS verification.
4. Create `.env` from `.env.example` if needed, without overwriting existing settings or credentials. Set `HARNESS_DATA_DIR` to the absolute path of this checkout's `.data` directory. For rate-limited endpoints such as free OpenRouter models, set `MODEL_MIN_INTERVAL_MS` (4500 kept `cohere/north-mini-code:free` under its 15 requests per minute). Keep ports 4318 and 4319 unless occupied; do not stop unrelated processes.
5. Run `npm run doctor` and `npm test`, one test command at a time, with live rehearsals idle. Expected: 18 readiness checks and 136 tests. The npm command runs test files sequentially to avoid competing Chromium processes. Investigate any failure rather than repeatedly retrying until green.
6. Start with `npm start` (it loads `.env`) and open `http://127.0.0.1:4318`. Check the actual dashboard using browser interactions: the two phones and the production banner, the draft bug, the Backup tab, keyless browser checks (4/6 visible and 3/5 held-out on the unfixed fixture), Explain & compare, the ladder table under Runs & evals, the forced-reset field in the New workspace dialog, and Focus demo. Also open `http://127.0.0.1:4318/builder.html` and walk its eight steps; it reads the recorded runs in `live-validation/builder/` and shows recorded screenshots for the phones when those runs are not on this server.

Complete all keyless work before requesting credentials. Leave the local app running when practical, and provide exact start, stop and restart commands for this laptop.

## Configure and rehearse a real model

Ask the user for provider details only when needed. Have them enter the key in `.env` or in the local setup screen; never ask them to paste it into chat. Do not print keys in logs or screenshots. UI-entered keys live in server memory and disappear on restart; `.env` keys load on `npm start`.

The v4 ladder used `https://openrouter.ai/api/v1`, Chat Completions and `cohere/north-mini-code:free`, with request pacing. `poolside/laguna-s-2.1:free` failed on HTTP 429 and spent its budget on reasoning tokens. These are dated observations; check the catalog, limits and pricing again. A paid model with tool calling is preferable for repeated trials. An internal endpoint must implement the adapter's tool-calling protocol.

Once the user authorizes live testing:

1. Run Save & test. This makes a real provider request and consumes quota.
2. Run the ladder: `node scripts/evaluate.mjs --ladder --trials 1 --scenarios draft,unicode,longform --out live-validation/<machine>/ladder.json`. Fifteen real runs; the script runs the presenter evaluation after each. Optionally add a forced-reset ladder with `--scenarios draft --reset-after 8`.
3. For each Engineered run waiting at the approval boundary, read the diff in the dashboard before approving. The correct fix changes only `src/storage.js` and adds a separate `prefix + 'draft'` key.
4. Export the runs and write a report in the format of `live-validation/v4/RESULTS.md`, keeping failures, provider errors and budget stops separate from source correctness.

Do not claim success for unperformed tests. The v4 ladder is one trial per cell; it is not a reliability benchmark.

## Slides and history

Open [the PowerPoint](../presentation/Agent-Harness-Workshop.pptx) directly. It was rebuilt for v4 on 27 October 2026 (48 slides; the v2 and v3 demo slides are a labeled appendix), and [the speaker notes](../presentation/speaker-notes.md) match it. [PROJECT-STATUS.md](PROJECT-STATUS.md) records how it was validated. Rebuilding needs only Node and pptxgenjs (`npm install --no-save pptxgenjs`); see [the presentation guide](../presentation/README.md). Nothing in the presentation folder is required to run the app.

The repository contains historical exports and screenshots, not the previous laptop's live runtime history or credentials. A fresh checkout starts without those workspaces. Do not import recordings as live runs or describe screenshots as current execution.

## Completion report

Give the user the checkout path and branch, dashboard URL, start/stop/restart commands, test results, what was verified in the browser, any live-run outcomes with run IDs, remaining blockers, and a short rehearsal sequence. List any local changes and why they were needed. Do not push machine-specific settings or secrets.
