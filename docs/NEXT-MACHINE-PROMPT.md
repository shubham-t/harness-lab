# Prompt for the agent on the organization laptop

Copy everything below the line into the coding agent on the work laptop. It gathers context from the repository, sets the project up with the internal model API, verifies it without a model, and then, only when the owner says so, runs the builder page live. Written 28 October 2026 against branch `harness-builder`.

---

You are setting up **Harness Lab**, a local teaching application about agent harness engineering, on this machine, and preparing it for a presentation. The repository is `https://github.com/shubham-t/harness-lab` (private; `gh auth status` should show account `shubham-t`). Work on branch **`harness-builder`**, which holds the current state; `v4-redesign` is the default branch with the earlier v4 work and `main` is an older baseline. Do not merge, rebase or force-push anything. Never modify any other checkout of this project you may find on this machine.

## 1. Gather context before changing anything

Read these files in this order and do not skip any:

1. `AGENTS.md`: the project rules and the design invariants. They override your defaults.
2. `docs/PROJECT-STATUS.md`: the authoritative record of what exists, what was tested, what live evidence established and what is open. It wins over any other document that disagrees.
3. `docs/BUILDER.md`: the design of the current presentation, **the harness builder**: a page that shows how a harness is built one component at a time, with real recorded runs and a live mode. Read all work packages (A to E).
4. `docs/BUILDER-CUE-CARD.md`: how the presenter walks through the recorded video or the live page.
5. `live-validation/builder/RESULTS.md`: the recorded runs behind the page, including the three superseded step 6 pairs and why they were re-recorded.
6. `README.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/OPERATIONS.md`: how the app, checks, tests, ports and the recorder work.
7. `presentation/README.md`: the deck (not yet rebuilt around the builder), the video recorder and the trimmer.
8. `ANATOMY-DEMO.md` and `docs/DEMO-CUE-CARD.md`: the dashboard's older failure-first flow, kept as a secondary demo.

Then give me a short summary in your own words of: what the builder page shows and why the lesson changed from "Minimal versus Engineered" to "build a harness step by step"; what each of the eight steps proves; what the recorded runs established and did not; and the open items in PROJECT-STATUS. If your summary disagrees with the documents, say so instead of smoothing it over.

## 2. Set the project up (no model needed)

- Node.js 22 or newer is required; Node 24.19 was tested. Run `npm ci`, then `npx playwright install chromium`. On Windows use `npm.cmd` and `npx.cmd` if PowerShell blocks scripts. If a corporate proxy or certificate policy blocks the install, explain the exact blocker and use the approved configuration; never disable TLS verification. If Chromium cannot be installed, the app also tries an installed Microsoft Edge.
- Copy `.env.example` to `.env`. Set `HARNESS_DATA_DIR` to the absolute path of this checkout's `.data` directory. Leave the key empty for now. Keep ports 4318 and 4319 unless occupied; never stop unrelated processes. Never print, paste or commit `.env`.
- Run `npm run doctor` (18 checks expected) and `npm test` (201 tests expected, about four to five minutes, one test command at a time; the test files reserve fixed ports and launch real Chromium). Report the exact counts. If anything fails, investigate rather than retrying until green.
- Start the app with `npm start` and open `http://127.0.0.1:4318`. In a real browser confirm the dashboard: both phones with the banner "Original build. No change applied.", the draft bug (type a draft, switch to My notes and back, it is gone), **Run browser checks without a key** reporting 4/6 visible and 3/5 held-out on the unfixed app, and Focus demo.
- Open `http://127.0.0.1:4318/builder.html`. Walk all eight steps with the arrow keys. Every step must show its recorded run; the phones show recorded screenshots here because those runs are not on this machine. The "Run this step live" buttons are hidden until a model is connected; a note says so.
- Download the recorded videos: they are too large for Git and are published as release assets. From the repository root run `gh release download builder-video-2026-10-27 --dir presentation/video --pattern "*.webm"`. Expect `harness-builder-live.webm` (the untouched original, 23:26), `harness-builder-live.trimmed.webm` (13:05, idle waiting cut) and `harness-builder-live.take1.webm` (an earlier full take kept as a backup). The matching `.notes.txt` and `.trim.json` files are already in the checkout. Open the trimmed video once and confirm it plays (any browser or VLC plays WebM).

Finish everything in this section before asking me for credentials.

## 3. Connect the internal model (only when I authorize it)

The laptop uses the organization's internal LLM API instead of OpenRouter. Ask me for the details and have me put them in `.env` myself; never ask me to paste a key into chat.

- `OPENAI_BASE_URL`: the internal endpoint's base URL (HTTPS; HTTP is accepted only on a loopback address). The adapter appends `/chat/completions` or `/responses` to it.
- `LLM_PROTOCOL`: `chat-completions` for an OpenAI-compatible Chat Completions endpoint, or `responses` for the Responses protocol. The adapter needs real tool calling (function calls with `tool_calls` or `function_call` items). An endpoint that only returns chat text cannot run the agent.
- `OPENAI_MODEL`: the exact model id.
- `OPENAI_API_KEY`: the key (set by me). It is sent as a Bearer token.
- `MODEL_MIN_INTERVAL_MS` and `MODEL_RETRY_429`: leave at 0 and 3 unless the endpoint rate-limits; OpenRouter's free tier needed 4500 ms.

If the internal API needs other headers, paths or a request shape the two adapters in `lib/provider.mjs` do not produce, write a small adapter there, keep it behind the same `callModel` interface, cover it with a transport unit test in `tests/provider.test.mjs` (mocked HTTP, no live call), and say exactly what differs. The OpenRouter-specific reasoning handling applies only when the host is `openrouter.ai`. Keys never appear in events, exports or logs; keep it that way.

Restart with `npm start` after editing `.env`, confirm `/api/state` reports the provider as configured, then run **Save & test** in the dashboard once (one real request).

## 4. Rehearse live (only when I authorize it; real, billable calls)

- Create one fresh Engineered workspace in the dashboard and run it, to see the internal model's behavior and timing on this task. Note calls, elapsed time and whether it reaches the approval boundary.
- Open `/builder.html` and press **Run this step live** on each step in order. Each step is a fresh run with that step's configuration; steps 1 to 4 run to the shared 24-call budget if the model never asks to finish. Step 7 stops at the approval boundary: open the diff, read it (the correct fix changes only `src/storage.js` and adds a separate `prefix + 'draft'` key without touching the notes key), then approve on the page. Note every run id.
- If I want a new video with the internal model: `node presentation/record-builder-video.mjs --pause 8` records all eight steps live in one continuous file (a one-second title card per step; it retries a step after a provider failure and approves step 7 only after the same diff review), then `node presentation/trim-video.mjs` writes the trimmed copy. Both leave the original untouched. With a full ffmpeg on PATH the trim is exact; without one, headless Chromium replays the kept parts. Do not install software without asking me.
- Record the outcome the way `live-validation/builder/RESULTS.md` does, in a new folder `live-validation/builder-<machine>/`, keeping failures, provider errors and budget stops separate from source correctness. Export runs from the dashboard or `GET /api/runs/<id>/export`. Never pool runs from different models into one number.

## 5. What is established, and what is not

Established on the development laptop (27 October 2026, `cohere/north-mini-code:free`, one run per step; details in PROJECT-STATUS and the builder report):

- The builder page, live mode, the recorder and the trimmer work end to end with a real provider. 201 automated tests pass.
- A model alone and a loop without tools only produce text. With tools, rules and context this model wrote a correct fix every time (6/6 visible, 5/5 held-out) and never declared completion; with the check tool it completed and published itself; with approval it stopped and waited.
- With the reset after the first edit, both step 6 runs were cut off at the same point and neither finished; the handoff carried the edited file and did not make the model stop.

Not established, and to be stated as such in anything you write:

- Any reliability rate. One run per step, one free model.
- Whether the rules or the context would change the outcome on a harder task, or with the internal model.
- Whether the internal model's behavior, timing and tool calling match. That is what section 4 measures.
- The deck (`presentation/Agent-Harness-Workshop.pptx`) is still the earlier v4 deck; it has not been rebuilt around the builder. Say so if asked, and do not rebuild it unless I ask.

## 6. Rules

- Keep all execution real. Never prewrite a repair, script a model answer outside tests, weaken a check, shorten a budget to favor a step, or describe a recording as live.
- Keep budgets equal for every run. Record failures separately from source correctness.
- Do not commit `.env`, `.data`, logs, videos or anything with a key. Commit on a branch named after this machine, for example `setup/<machine-name>`, and tell me before pushing.
- Update `docs/PROJECT-STATUS.md` with this machine's operating system, Node version, tested commit, test counts, what you verified in the browser, any live runs with their ids, blockers, and exact start, stop and restart commands.

## 7. Completion report

Give me: the checkout path and branch, the dashboard and builder URLs, start, stop and restart commands, doctor and test counts, what you verified in the browser, whether the videos play, any live-run outcomes with run ids, every blocker or deviation, and a short rehearsal sequence from `docs/BUILDER-CUE-CARD.md` adjusted to what actually works on this machine.
