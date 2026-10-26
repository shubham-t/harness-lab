# Twenty-minute demo cue card

Keep the main story to one bug: **a draft disappears when the user changes screens or refreshes**. Saving must still preserve the whole note and the existing notes. Use the same model and the Draft scenario for both presets.

| Step | What to do on screen | What to say | Concept |
| --- | --- | --- | --- |
| 1. Show the bug | In a fresh workspace, type a title and body. Click My notes, then Draft. | “The unfinished text disappeared. A repair must preserve it without breaking saving or existing notes.” | Define the task and acceptance behavior |
| 2. Run Minimal | Prepare Minimal. Point to its two blue cards. Click Run coding agent. Open an actual file/tool event. | “The model can request actions, and the harness executes them. The other five components are off in this configuration.” | Agent loop; Tools & sandbox |
| 3. Measure Minimal | After it stops, click Evaluate outcome, then Explain & compare. | “This check is our measurement after the run. Minimal did not have to pass it to declare completion.” | Evaluation versus enforced verification |
| 4. Run Engineered | Prepare Engineered with the same scenario and model. During a request, open Instructions & policies, then its recorded evidence. Do the same for Context management. | “The rules say preserve existing notes. The project facts identify the storage module and current revision. These are different inputs, and we can inspect what was actually sent.” | Instructions versus context |
| 5. Inspect completion | Show the actual check results and waiting-for-approval state. Review the diff before approving. Open the published app. | “Passing checks is a requirement here. Even then, the agent stops for a human decision before applying the patch.” | Verification; Guardrails |
| 6. Compare | Click Explain & compare and select the corresponding opposite-preset run. Read observed checks, agent status, requirements and application. | “A good patch, a completed run and an approved change are separate facts. The harness makes the requirements explicit.” | Harness engineering |

Memory is an optional separate demonstration: pause after a real edit, inspect Memory, then choose New session. Show the **Saved handoff included in request** event. Say: “Both retain files. Engineered also supplies a compact record of prior progress. The previous conversation is cleared.” Do not promise that this guarantees completion.

## Branches to rehearse

- **Both fix the bug:** “The model solved both. Now compare what each runtime required before completion and application.”
- **A check fails:** Open the failed check and its screenshot. Describe only the observed failure. Do not generalize from one trial.
- **Budget reached with passing source:** “The partial patch passed these tests, but the agent did not finish. We report those separately.”
- **Provider error or long delay:** Explain the actual error, then switch to labeled real rehearsal screenshots in the deck. Keep the live run's status visible; do not describe recordings as live.
- **No matching comparison:** Verify the same task, scenario, provider/model, harness version and session count. Fresh-session trials are separate from uninterrupted trials. Do not pick an incompatible favorable result.

The protected-file probe is optional and outside the main story. Label it explicitly as a presenter-triggered sandbox test; it is not a model-generated attack or a difference between the two presets' shared sandbox boundaries.
