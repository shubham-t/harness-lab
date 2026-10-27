# Presenting the v4 demo: failure first

Open http://127.0.0.1:4318 and create **fresh** workspaces for this comparison. Runs from harness versions 1 to 3 show their own labels and keep their original behavior. Use **Focus demo** for the presentation layout. Use the same model and scenario for every run you compare.

The story has one idea. A harness does not make the model smarter. It supplies four things the model structurally lacks: knowledge it cannot know, observation it did not make, state it cannot keep, and authority it should not have.

The first live v4 ladder is recorded in [the v4 live report](live-validation/v4/RESULTS.md): one trial per rung and scenario with a free model, in which every Minimal run produced a correct patch and never finished. Rehearse with your own provider before presenting, and narrate the outcome you actually get.

## 1. Feel the bug

On the **SANDBOX** phone, type a title and a draft. Switch to My notes, then back to Draft: the text is gone. Refresh: gone again. Open **Backup** and show the JSON of the saved notes and the line "Unsaved drafts are never included."

Say: "The task is to keep the draft. Saving, existing notes and the backup must keep working."

## 2. Four ways a correct-looking patch is wrong

Name the traps before any model runs. Each one is a property real codebases have.

1. **The backup leaks the draft.** An easy fix stores the draft inside the notes list. Now the backup contains unsaved private text.
2. **Existing users lose their notes.** Renaming or reshaping the storage key hides notes that users already have. This happened once before (INC-37 in the ticket thread).
3. **Restored text becomes markup.** A draft with `<b>` or `<script>` comes back as HTML instead of the text the user typed.
4. **Automation breaks.** Renamed or dropped `data-testid` attributes break QA's release checker.

These are four of the five **held-out checks**. The fifth checks that the character count matches the restored draft. The agent never sees held-out checks, in any preset.

## 3. Run Minimal and show what it was told

Choose Minimal. Point to the two blue cards, **Agent loop** and **Tools & sandbox**. Everything else is off. The task, starting files, tool schemas and budgets are the same as Engineered's.

Click **Run coding agent**. While it runs, open **Explain & compare** and show **what each agent was told**: the assembled instructions and the task. Minimal's column is short. It can still read PROJECT.md with `read_file` if it chooses to. It cannot read the ticket.

## 4. Production updates by itself

Before or during the run, save a note on the **PRODUCTION** phone. You are now an existing user.

If Minimal declares completion, the patch is published at once. The production banner changes to "Updated automatically by the agent at <time>. No review." Nobody checked it and nobody approved it.

## 5. Try the traps on production

On the production phone, try each trap by hand. Is your saved note still listed after a refresh? Type a draft, then open Backup: is the draft in the JSON? Type a draft with `<b>bold</b>` and switch screens: does it stay literal? Show only what you actually observe.

## 6. Claims versus evidence

Open **What it claimed, what was observed**. The left column is the agent's completion summary, word for word. The right column shows, per behavior, what the agent exercised in the browser after its last edit, whether it ran acceptance checks, and the harness result.

Say: "If the summary says the draft survives a refresh, look for a reload after the last edit. Claims are the model's words. Observations are recorded tool actions." The panel does not interpret model reasoning.

## 7. Run Engineered and show its inputs

Create a fresh Engineered workspace with the same scenario and model. Point to the seven blue cards. Run it.

- **Instructions & policies:** the project rules from PROJECT.md. Click the card to see the exact text sent.
- **Context management:** the repository map, file sizes, revision and the **PN-142 ticket thread**. The ticket explains INC-37, the test ids, the backup privacy rule and the path-prefixed storage keys. This is knowledge outside the repository.
- Return to **what each agent was told** and show both columns side by side.

Supplying a rule proves inclusion, not compliance. Judge compliance from the diff and the checks.

## 8. The gate and the repair loop

With Verification on, the agent can run the six **visible checks**, and completion requires all six to pass on the current revision. If a check fails, the gate returns the failure to the model and it can try again within its budget. Show a repair loop only if one actually appears in the trace.

## 9. Approval

Even after the visible checks pass, Engineered stops. The production banner reads "Original build. One change is waiting for your approval." Open the diff, inspect it, then approve. The banner changes to "Updated after your approval at <time>." Try the traps on production again.

## 10. Held-out grading

Click **Evaluate outcome** on both runs. This is presenter evaluation, outside the agent workflow. It runs both tiers. The Verification card shows "Checks the agent can run" and "Held-out checks (presenter only)" separately. Explain & compare adds a held-out row.

Engineered can also fail a held-out check. It had the ticket, but it never saw these checks. Report what you measure.

## 11. Optional: forced reset

Prepare two workspaces with the same **Forced session reset** call number (the API field `resetAfterCalls`). Each run gets a **Context limit reached: fresh session required** event after that model call. The conversation is cleared and files remain. With Memory on, a frozen handoff is supplied; with Memory off, the agent starts again from the task. Show the reset event, then the next prompt. Restored state does not guarantee completion.

## 12. The ladder

Open **Runs & evals** and the **ladder scoreboard**: Minimal, +Verification, +Instructions & context, +Memory, Engineered. Each row adds one thing. The columns include visible pass, held-out pass, applied without review and claimed without a refresh test. Fill it beforehand with `node scripts/evaluate.mjs --ladder` (real, billable calls). Empty cells mean nothing was measured. Small samples are illustrative.

## If Minimal passes everything

This can happen. Say: "The model handled every trap this time. It still shipped to production with no review, and nothing required evidence first. One run does not tell us how often that works." Then move to the ladder, if you have measured one.

## The closing line

"The model did not get smarter. The harness supplied what it could not know, checked what it did not look at, kept what it would forget, and held back what it should not decide alone."
