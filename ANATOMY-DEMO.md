# Presenting the updated demo

Open http://127.0.0.1:4318 and create **fresh** workspaces for this comparison. Older runs show a Legacy label and keep their original behavior. Use **Focus demo** for the presentation layout.

## 1. Show the bug

In the phone preview, type a draft. Switch to My notes, then back to Draft: the unfinished text disappears. Refresh also loses it. The task is to preserve drafts while keeping normal saving and existing notes working.

## 2. Show Minimal's components

Choose Minimal. Point to **Agent loop** and **Tools & sandbox**. It can ask the model what to do, read/edit files, use the browser, and repeat. Project support, saved handoff, acceptance verification and approval are off.

It still needs basic task/conversation context. Sandbox boundaries and budgets always remain. The activity log records both runs for the audience; it is not an enabled harness component. The cards show blue for Enabled and gray for Off, with no qualifying text. An orange outline means current activity.

## 3. Run Minimal

Click **Run coding agent** after configuring a real provider. Watch the cards highlight actual events. Click a card or recent event to inspect the evidence.

If it declares completion, the patch is applied to its isolated demo copy immediately. The strip says **Applied automatically**. No acceptance check or human approval was required. It may have fixed the bug, or it may have missed something.

## 4. Evaluate what Minimal delivered

Click **Evaluate outcome**. Real browser tests measure the result, with no model call. The strip says **Presenter evaluation**, and no agent component highlights. This happens outside the agent workflow and does not undo an already applied patch.

Say: “Now we are checking what the agent delivered. Its harness did not require this before completion.” Show the actual results, including successes.

## 5. Run Engineered on the same task

Create a fresh Engineered workspace with the same scenario and model. Point to the extra enabled components, then run it.

- **Instructions & policies:** project rules are supplied, such as preserving existing notes and user text. Click the card to see the actual rules included in the request.
- **Context management:** the repository map, accessible files and source revision are supplied. Click the card to inspect that separate payload. Both input cards can highlight during the same real request; no artificial stage or delay is introduced.
- **Memory & state:** observed progress is saved for a fresh session.
- **Verification:** browser checks are available to the agent; completion requires passing checks. If a check fails, the model receives the failure and can try again within its budget.
- **Guardrails:** even after checks pass, the agent waits for human approval. Inspect the diff and evidence, then approve to apply the patch.

Fast actions remain in the recent-event trail. A card describes a recorded action, not the model's private thinking. A failure or repair retry is shown only when it actually occurs.

## 6. Optional memory demonstration

Pause an active run and choose a fresh model session. Working files remain in both presets. Engineered also restores saved progress; Minimal has no saved handoff and must rediscover progress. Inspect the context/memory evidence to show the difference. A short run may finish before you pause it.

## The takeaway

“Both models may write a correct fix. The harness determines what information they receive, what progress survives, what must be checked, and who can apply the result.”

The seven cards use the revised slide names, including Instructions & policies in place of Observability. Orchestration is omitted. The new workflow has passed automated tests; rehearse both versions with real model calls before presenting and report the actual outcomes.
