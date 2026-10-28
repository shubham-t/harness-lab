> **Note (28 October 2026).** This is the dashboard's failure-first flow, kept as a secondary demo. The current presentation lesson is the step-by-step harness builder: see [the builder design](BUILDER.md) and [the video cue card](BUILDER-CUE-CARD.md).

Keep the story to one bug: **a draft disappears when the user changes screens or refreshes**. Use the same model and the Draft scenario for every run. Create fresh workspaces; they use harness version 4. The full flow with more detail is in [ANATOMY-DEMO.md](../ANATOMY-DEMO.md).

The thesis: the harness supplies **knowledge** the model cannot know, **observation** it did not make, **state** it cannot keep, and **authority** it should not have. Each step names which one it shows.

The first live v4 ladder is in [the v4 live report](../live-validation/v4/RESULTS.md); in it every Minimal run produced a correct patch and never finished. Narrate what you observe, not what this card expects.

| Step | What to do on screen | What to say | What it shows |
| --- | --- | --- | --- |
| 1. Feel the bug | On the SANDBOX phone, type a title and body. Click My notes, then Draft. Refresh. Open Backup. | "The unfinished text disappeared. The fix must keep it without breaking saving, existing notes or the backup." | The task |
| 2. Name the traps | Point at Backup, My notes and the editor. | "Four ways a correct-looking patch is wrong: the backup leaks the draft, existing users lose notes, typed markup becomes HTML, test ids disappear. The agent will never see the checks for these." | Held-out checks exist |
| 3. Run Minimal | Prepare Minimal. Point to the two blue cards. Save a note on the PRODUCTION phone. Click Run coding agent. | "The model can request actions and the harness executes them. Nothing else is on." | Agent loop; Tools & sandbox |
| 4. What it was told | Open Explain & compare, then what each agent was told. | "This is everything Minimal received. It can read PROJECT.md if it chooses. It cannot read the ticket." | Knowledge it lacks |
| 5. Production updates | When Minimal completes, point to the production banner. | "It shipped. No check was required and nobody approved it." | Authority it should not have |
| 6. Try the traps | On production: refresh and look for your saved note; type a draft and open Backup; type `<b>bold</b>` and switch screens. | Describe only what you see. | What production users get |
| 7. Claims versus evidence | Open What it claimed, what was observed. | "The left side is the model's words. The right side is what it actually did after its last edit. Look for a reload behind any refresh claim." | Observation it did not make |
| 8. Run Engineered | Prepare Engineered with the same scenario and model. Open Instructions & policies, then Context management, then what each agent was told. | "Same task, same files, same tools. It also got the project rules and the ticket thread: INC-37, the test ids, the backup privacy rule." | Knowledge; Instructions & policies; Context management |
| 9. Gate | Show the visible checks and any blocked completion. | "Completion requires all six visible checks on this revision. A failure goes back to the model." Only mention a repair loop if one happened. | Verification |
| 10. Approval | Show the waiting banner, open the diff, approve. Try the traps on production again. | "Even with passing checks, a person decides what ships." | Guardrails; authority |
| 11. Held-out grading | Click Evaluate outcome on both runs. Read both tiers. | "These five checks were never shown to either agent. Engineered can fail them too." | Evaluation is separate from the agent |
| 12. Ladder | Open Runs & evals, ladder scoreboard. | "Each row adds one component. Empty cells were not measured. A few runs are illustrative, not a rate." | Harness engineering as measurement |

Close with: **"The model did not get smarter."**

## Optional forced reset

Prepare a pair of workspaces with the same **Forced session reset** call number (`resetAfterCalls`). Show the **Context limit reached: fresh session required** event and the next prompt. Say: "The conversation is gone in both. Files remain in both. Only the run with Memory gets a handoff." This shows **state it cannot keep**. Do not promise that a handoff guarantees completion.

## Branches to rehearse

- **Minimal passes everything:** "The model handled every trap this time. It still shipped with no check required and no review. One run does not tell us how often that works." Move to the ladder if you have measured one.
- **Engineered fails a held-out check:** "It had the ticket, but it never saw this check. This is why held-out checks exist." Do not hide it.
- **Both fail the same held-out check:** Show it. The harness made the failure visible; it did not prevent it.
- **A visible check fails:** Open the failed check and its screenshot. Describe only the observed failure.
- **Budget reached with passing source:** "The patch passes these checks, but the agent did not finish. Those are separate outcomes."
- **Provider error or long delay:** Explain the actual error. Do not present historical v2 or v3 screenshots as v4 runs.
- **No matching comparison:** Check task, scenario, provider and model, harness version, forced-reset setting and session count. Do not pick an incompatible favorable result.

The protected-file probe is optional and outside the main story. Label it as a presenter-triggered sandbox test, not a model action.
