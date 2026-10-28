# Setup handoff for another laptop

Use this document as the receiving agent's task. Complete local setup and verification, then help the presenter rehearse. Preserve existing checkout changes and configuration.

**Current state (28 October 2026):** the repository is `https://github.com/shubham-t/harness-lab`. Branch `harness-builder` holds the current presentation: the step-by-step **harness builder** page described in [the builder design](BUILDER.md), with its recorded runs, live mode and a recorded video. `v4-redesign` is the default branch with the earlier v4 work; `main` is the v3 baseline. The full suite passes 201 tests and the doctor 18 checks on the development laptop. [PROJECT-STATUS.md](PROJECT-STATUS.md) is authoritative for what is established, what is open and the state of the deck.

## Copy-and-paste prompt for the receiving agent

The complete prompt lives in [NEXT-MACHINE-PROMPT.md](NEXT-MACHINE-PROMPT.md). Give that file to the agent on the new machine as its first message. It covers context gathering, keyless setup and verification, downloading the videos from the GitHub release, connecting the organization's internal model, the live rehearsal procedure, what is and is not established, and the completion report.

**Read [Current state and continuation priorities](PROJECT-STATUS.md) first.** Do not infer readiness from the setup instructions alone.

## What the presentation is

Harness Lab supports a one-hour workshop for mobile software engineers, architects and leaders. The takeaway: production agents need more than a model and a prompt. The builder page shows this one component at a time: a model alone, then the agent loop, tools and sandbox, instructions, context, verification, memory and finally approval. Every step has the same three panels: the problem, what we add, and proof from a real run (the request text with the new part highlighted, the activity list, the two phones). Nothing is scripted; a step without a recording says so.

- **Recorded mode** (default): the page reads `live-validation/builder/recording.json`. On a machine without those runs the phones show recorded screenshots.
- **Live mode**: with a model connected, "Run this step live" creates a fresh run with that step's configuration and fills the panels as the calls arrive. The presenter runs the evaluation, the sandbox probe and the step 7 approval on the page.
- **The video**: `presentation/video/harness-builder-live.trimmed.webm` (13:05) and the untouched original (23:26) were recorded from live mode on 27 October 2026. They are release assets, not Git files; the prompt says how to download them. [The video cue card](BUILDER-CUE-CARD.md) gives the presenter's sequence and narration.

The dashboard's older failure-first flow ([ANATOMY-DEMO.md](../ANATOMY-DEMO.md), [the dashboard cue card](DEMO-CUE-CARD.md), [the runbook](PRESENTER.md)) still works and is kept as a secondary demo.

## Internal model

The work laptop uses the organization's internal LLM API. The app's two adapters (`responses` and `chat-completions`) need real tool calling. The prompt tells the agent what to put in `.env`, when a small adapter is needed in `lib/provider.mjs`, and to keep keys out of chat, events, exports and logs. Rate-limited endpoints need `MODEL_MIN_INTERVAL_MS`.

## Slides

The 48-slide deck in `presentation/` is the earlier v4 deck and has not been rebuilt around the builder. The decision is open; see PROJECT-STATUS.

## Completion report

The prompt's last section lists what the receiving agent must report: checkout and branch, URLs, start, stop and restart commands, test counts, what was verified in the browser, whether the videos play, live-run outcomes with ids, blockers, and a rehearsal sequence adjusted to the machine. Do not push machine-specific settings or secrets.
