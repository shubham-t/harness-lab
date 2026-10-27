# One-hour presenter runbook

For the live segment, keep [the twenty-minute cue card](DEMO-CUE-CARD.md) open. It maps each screen action to a plain-language sentence and the concept it shows. [ANATOMY-DEMO.md](../ANATOMY-DEMO.md) has the same flow in more detail.

## Timing

| Minutes | Segment |
| --- | --- |
| 0–5 | Why this matters for mobile bug fixing |
| 5–25 | Harness terminology, components and engineering practices |
| 25–45 | Live Pocket Notes demo: failure first, then Engineered, then held-out grading |
| 45–55 | Ladder results, limitations and team practices |
| 55–60 | Questions and buffer |

The speaker notes are in `presentation/Agent-Harness-Workshop.pptx` and [speaker-notes.md](../presentation/speaker-notes.md). The deck was rebuilt for v4 on 27 October 2026: slides 21 to 32 show the first live v4 ladder with screenshots of the recorded runs (run id and dates on every slide), and the v2 and v3 demo slides are a labeled appendix. The screenshots are recorded evidence; run the live app for the demo and narrate what actually happens.

## The thesis

A harness does not make the model smarter. It supplies four things the model structurally lacks, however capable it is:

1. **Knowledge it cannot know:** the PN-142 ticket thread, supplied by Context management.
2. **Observation it did not make:** the regression surface it never looked at. Visible checks the agent can run, held-out checks it never sees, and the claims versus evidence panel.
3. **State it cannot keep:** a frozen handoff across a forced session reset, supplied by Memory & state.
4. **Authority it should not have:** shipping to production, held back by the approval guardrail.

Nothing in the demo tricks the model. Each trap is a property real codebases have.

## Before the session

- Start the app and confirm browser readiness with `npm run doctor`.
- Save and test the real provider.
- Rehearse one fresh Minimal and one fresh Engineered run on the Draft scenario with the same model. Keep the diff, both check tiers and the claims panel ready.
- If you want a ladder scoreboard, run `node scripts/evaluate.mjs --ladder` beforehand. It makes real, billable calls; agree the quota first. Optionally add `--reset-after N` and `--out FILE`.
- Check projector zoom, Focus demo and both phones at the presentation resolution.

The first live v4 ladder is in [the v4 live report](../live-validation/v4/RESULTS.md). Your rehearsal adds to it; note the run IDs.

## Main demonstration

1. **Feel the bug.** In a fresh Minimal workspace, type a draft on the SANDBOX phone, switch to My notes and back, then refresh. Open Backup.
2. **Name the traps.** The backup leaks the draft; existing users lose their notes; typed markup becomes HTML; test ids disappear. The agent never sees the checks for these.
3. **Run Minimal.** Point to exactly two blue cards. Save a note on the PRODUCTION phone first, so you are an existing user. Run the real agent. Show an actual file read or edit. Do not infer private reasoning from a highlighted card.
4. **What it was told.** In Explain & compare, open what each agent was told. Minimal received the task and basic instructions. It can read PROJECT.md through a tool; it cannot read the ticket.
5. **Production updates by itself.** If Minimal completes, its patch is published at once. The banner says it was updated automatically with no review.
6. **Try the traps on production.** Check your saved note, the backup and literal text by hand. Report what you see.
7. **Claims versus evidence.** Open What it claimed, what was observed. Compare the summary with the recorded browser actions after the last edit. The panel does not interpret reasoning.
8. **Run Engineered.** Same task, model and scenario. Point to seven blue cards. Open Instructions & policies and Context management. Show the ticket thread inside the context payload. Compare what each agent was told.
9. **The gate.** Completion requires all six visible checks on the current revision. A failure returns to the model. Mention a repair loop only if one appears.
10. **Approval.** The banner says one change is waiting. Inspect the diff and revision, approve, then try the traps on production again.
11. **Held-out grading.** Click Evaluate outcome on both runs. Read the visible and held-out tiers separately. Explain & compare has a held-out row.
12. **Ladder.** In Runs & evals, read the ladder scoreboard if you measured one. Empty cells mean not measured.
13. **Optional forced reset.** Prepare two workspaces with the same **Forced session reset** call number (`resetAfterCalls`). Show the reset event and the next prompt for each.

## Useful narration

- **Minimal passes everything:** "The model handled every trap this time. It still shipped to production with no evidence required and no review. One run does not tell us how often that works."
- **Minimal fails a held-out check:** "This is the observed failure in this run. Its own summary said it was done. We need repeated trials before claiming a general difference."
- **Engineered fails a held-out check:** "It had the ticket but never saw this check. Held-out grading found it. Approval is where a reviewer could have caught it."
- **Both pass:** "We can still see the rules, the ticket, the gate and the approval boundary. The harness changed what was required, not the model."
- **Budget reached:** "The source may work, but the agent did not complete. Those are separate outcomes."
- **Provider error:** "This is a provider failure. Files and trace remain."

## Fallback

If the provider fails, use a ready workspace with no model call: show the bug, the Backup screen and both check tiers through Evaluate outcome. On the unfixed app the automated tests observe 4/6 visible and 3/5 held-out. The deck's screenshots are historical v2 and v3 evidence with a different fixture and one check tier. Label them as such. Do not present them as v4 runs or as a live replay.

## Close

"The model did not get smarter." Ask the audience to name one recurring bug-fixing failure and the missing knowledge, observation, state or authority boundary that would address it. The practical takeaway: make project knowledge explicit, keep some checks out of the agent's reach, and measure each harness change on the whole workflow.
