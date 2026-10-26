# One-hour presenter runbook

## Timing

| Minutes | Segment |
| --- | --- |
| 0–5 | Why this matters for mobile bug fixing |
| 5–25 | Harness terminology, components and engineering practices |
| 25–45 | Live Pocket Notes comparison and optional fresh-session test |
| 45–55 | Actual results, limitations and team practices |
| 55–60 | Questions and buffer |

Use the speaker notes in `presentation/Agent-Harness-Workshop.pptx`. The reference deck's concepts remain covered, with seven demo components and separate discussion of orchestration, observability and evals.

## Before the session

Start the app, confirm browser readiness, save/test the real provider, and rehearse one fresh run of each preset. Keep the source diff and browser evidence available. Check projector zoom and Focus demo at the presentation resolution. Keep the deck screenshots available if provider latency or quota interrupts the live segment.

## Main demonstration

1. In a fresh Minimal workspace, type a draft, switch to My notes, then return. Explain the lost text.
2. Point to exactly two blue cards. Say: “It can call the model and use tools. It has no automatic project briefing, saved handoff, acceptance gate or approval.” Mention the shared sandbox once.
3. Run the real agent. Show an actual file read/edit and the model-call trace. Do not infer private reasoning from a highlighted card.
4. If it finishes, point to automatic application. Click Evaluate outcome. Explain that the presenter is now measuring the result after the agent's decision.
5. Create a fresh Engineered workspace using the same model/task. Point to the seven blue cards.
6. During a request, open Instructions & policies and its evidence. Show the existing-notes rule. Open Context management separately and show the storage module map. Rules guide behavior; project information helps locate work.
7. Show browser verification. Failing checks, if they occur, block completion and return feedback. Passing checks lead to approval, not immediate publication.
8. Inspect the exact diff and revision, approve, then try the published app.
9. Click **Explain & compare**. Pair the corresponding Minimal/Engineered runs and read the rows: observed checks, agent status, completion requirement, approval requirement and application. If both pass, point to the different requirements rather than claiming Minimal failed.
10. If time permits, use a separate run for Pause / New session. Show the actual **Saved handoff included in request** event. In v3 the compact handoff stays fixed throughout that fresh session. Otherwise use the recorded memory screenshot and label it as a previous real trial.

## Useful narration

- Minimal succeeds: “The model solved this one. The difference is what the runtime required before allowing completion.”
- Minimal fails: “This is the observed failure in this run. We need repeated trials before claiming a general improvement.”
- Both pass: “We can still see the rules, saved state, verification requirement and approval boundary.”
- Budget reached: “The source may work, but the agent did not complete. Those are separate outcomes.”
- HTTP 502: “This is a provider failure. Files and trace remain. A fresh session can restore supported state, but recovery still consumes budget.”

## Fallback

Switch to the deck's real-run screenshots and results. State that they were captured during rehearsal. Do not click a fake replay or imply screenshots are a live model run. Keep the task, run ID and exact result attached to evidence.

## Close

Ask the audience to name one recurring bug-fixing failure and the missing input, tool, check or approval that would address it. The practical takeaway is to make useful project knowledge explicit, enforce objective checks and measure changes to the whole workflow.
