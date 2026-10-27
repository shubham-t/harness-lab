# Prompt for the agent on the next machine

Copy everything below the line into the coding agent on the new machine. It gathers context from the repository, sets the project up, verifies it without a model, and then, only when the owner says so, tests it with a real model. Written 27 October 2026 against commit history on branch `v4-redesign`.

---

You are setting up and verifying **Harness Lab**, a local teaching application about agent harness engineering, on this machine. The repository is `https://github.com/shubham-t/harness-lab` (private; use my existing GitHub authentication, `gh auth status` should show account `shubham-t`). Work on branch **`v4-redesign`**, which holds the current state; `main` is the older v3 baseline kept for history. Do not merge, rebase or force-push anything.

## 1. Gather context before changing anything

Read these files in this order and do not skip any:

1. `AGENTS.md`: project rules and the fifteen design invariants. They override your defaults.
2. `docs/PROJECT-STATUS.md`: the exact current state, what was tested, what live evidence exists, what is established and what is still open. Treat it as authoritative over any other document that disagrees.
3. `docs/HANDOFF.md`: machine setup steps and the live-test procedure.
4. `docs/REDESIGN-V4.md`: the v4 design contract and the implementation notes with exact field names.
5. `ANATOMY-DEMO.md` and `docs/DEMO-CUE-CARD.md`: the failure-first presentation flow.
6. `live-validation/v4/RESULTS.md`: the first live ladder, 20 real runs, with every failure kept.
7. `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/OPERATIONS.md`, `README.md`.

Then give me a short summary in your own words of: what the demo is trying to show, what Minimal and Engineered are, what the visible and held-out check tiers are, what the live ladder established, and the open items listed in PROJECT-STATUS. If your summary disagrees with the documents, say so instead of smoothing it over.

## 2. Set the project up

- Node.js 22 or newer is required; Node 24.19 was tested. Run `npm ci`, then `npx playwright install chromium`. On Windows use `npm.cmd` and `npx.cmd` if PowerShell blocks scripts. Corporate proxy or certificate policy: explain the exact blocker and use approved configuration; never disable TLS verification.
- Copy `.env.example` to `.env`. Set `HARNESS_DATA_DIR` to the absolute path of this checkout's `.data` directory. Leave the key empty for now. Keep ports 4318 and 4319 unless occupied; never stop unrelated processes. Never print, paste or commit `.env`.
- Run `npm run doctor` (18 checks expected) and `npm test` (136 tests expected, about three minutes, one test command at a time; the test files reserve fixed ports and launch real Chromium). Report the exact counts. If anything fails, investigate rather than retrying until green, and report it.
- Start the app with `npm start` and open `http://127.0.0.1:4318`. Using a real browser, confirm: the SANDBOX and PRODUCTION phones with the banner "Original build. No change applied."; the draft bug (type a draft, switch to My notes and back, it is gone); the Backup tab in the phone; **Run browser checks without a key**, which on the unfixed fixture must report 4/6 visible and 3/5 held-out; **Explain & compare** with the held-out row and the "What each agent was told" section; **Runs & evals** with the ladder table showing empty cells; the **New workspace** dialog with the optional "Forced session reset" field; and **Focus demo** (press F) with both phones visible. Take screenshots and keep them outside the repository.

Everything in this section works without a model key. Finish it completely before asking me for credentials.

## 3. Live testing, only when I authorize it

Ask me for the provider details and have me put them in `.env` myself (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `LLM_PROTOCOL`). For OpenRouter use `https://openrouter.ai/api/v1` and `chat-completions`. Free OpenRouter models are rate limited; `cohere/north-mini-code:free` allows 15 requests per minute, so set `MODEL_MIN_INTERVAL_MS=4500`. `poolside/laguna-s-2.1:free` returned HTTP 429 repeatedly and spent most of its budget on reasoning tokens; avoid it. A paid model with tool calling is better for repeated trials. Restart with `npm start` after editing `.env` and confirm `/api/state` reports the provider as configured; run Save & test once.

Then run, from the repository root:

```
node scripts/evaluate.mjs --ladder --trials 1 --scenarios draft,unicode,longform --out live-validation/<machine-name>/ladder.json
```

This makes 15 real, billable runs, about 50 minutes with pacing. The five rungs are Minimal, +Verification, +Instructions & context, +Memory and Engineered, each with the same task, files, tools and budgets. After each run the script runs the presenter evaluation, both check tiers. Engineered runs stop at the approval boundary: open each one in the dashboard, read the diff (the correct fix changes only `src/storage.js` and adds a separate `prefix + 'draft'` key without touching the notes key or seed notes), and approve only if it is sound. Optionally run the forced-reset ladder: `--scenarios draft --reset-after 8`.

Record the outcome the way `live-validation/v4/RESULTS.md` does: model, endpoint, date, machine, every run including failures, approvals, and what the numbers do and do not establish. Export each run from the dashboard or `GET /api/runs/<id>/export` into `live-validation/<machine-name>/runs/`. Keys never appear in exports; check anyway with a search for your key prefix before committing.

## 4. What is already established, and what is not

Established on the development laptop on 26 October 2026 (details in PROJECT-STATUS and the v4 report):

- The v4 runtime, dashboard and evaluation script work end to end with a real provider. 136 automated tests pass.
- With `cohere/north-mini-code:free`, every Minimal run produced a patch that passed all 6 visible and all 5 held-out checks and never requested completion within the 24-call budget, because it spent its calls on manual browser testing. Every rung with the `run_checks` tool completed in 7 to 13 calls. Engineered waited for approval every time.
- Held-out checks passed on every applied patch. Publication revisions matched the measured revisions.
- A forced reset restored a handoff when memory was on; completion still did not happen in that single trial.

Not established, and to be stated as such in anything you write:

- Any reliability percentage. There is one trial per cell with one free model.
- That the traps (backup leaking a draft, lost user notes, HTML interpreted, test ids dropped) are tripped by a model: this model tripped none of them. They are measured, not demonstrated.
- Whether the 24-call budget is fair to Minimal on the v4 fixture. It is equal for every rung, and Minimal chose manual testing, but a presenter should say so plainly rather than imply Minimal cannot fix the bug.
- The HTTP 429 retry path has unit tests and never fired in a live run after pacing was enabled.
- The workshop deck: check PROJECT-STATUS for whether the v4 rebuild has landed. If it has not, the deck still shows v2 and v3 screens.
- Behavior with a paid model, with a second model, on macOS, behind a corporate proxy, or on the presentation projector.

## 5. Rules

- Keep all execution real. Never prewrite a repair, script a model answer outside tests, weaken a check, change budgets to favor a preset, or describe a screenshot as live.
- Never pool v4 evidence with v2 or v3, or results from different models, into one number.
- Record failures, provider errors and budget stops separately from source correctness.
- Do not commit `.env`, `.data`, logs or anything with a key. Commit on a branch named after this machine, for example `setup/<machine-name>`, and tell me before pushing.
- Update `docs/PROJECT-STATUS.md` with this machine's operating system, Node version, tested commit, test counts, the dashboard checks you performed, any live runs with their IDs, blockers, and exact start, stop and restart commands.

## 6. Completion report

Give me: the checkout path and branch, dashboard URL, start/stop/restart commands, doctor and test counts, what you verified in the browser, any live-run outcomes with run IDs, every blocker or deviation, and a short rehearsal sequence from `docs/DEMO-CUE-CARD.md` tailored to what actually works on this machine.
