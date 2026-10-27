# Speaker notes

**Status.** The PowerPoint deck predates harness v4. Its rebuild is pending. Notes 21 to 32 below describe the v4 demo flow for the rebuilt deck. Until the rebuild, the current deck's slides 21 to 32 still show historical v2 and v3 screens. Their original notes are kept in the appendix at the end, labeled historical. The first live v4 ladder is recorded in live-validation/v4/RESULTS.md. `presentation/build.mjs` still generates this file from the pre-v4 deck source; running it now would overwrite these notes.

## 1. Agent harness & harness engineering

Welcome. This session is for engineers, architects and leaders who work on mobile applications. The objective is to understand why a production agent needs more than a capable model and a prompt. We will use a real model fixing a real Notes app, then inspect what the harness adds. No company-internal data or model claims are involved. Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab.

## 2. The session

Spend 5 minutes on the problem, 20 on concepts, 20 on the live demonstration, 10 on results and discussion, and keep 5 minutes for questions or a slow provider. Some concept slides can be covered quickly for an experienced audience. The optional memory demonstration can use recorded evidence if time is short.

## 3. Harness and harness engineering

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slides 2 and 3. A harness is the working software around the model. Harness engineering is the discipline of designing and improving it. Teams can build a small harness or configure an existing coding agent. Avoid treating these as interchangeable nouns.

## 4. Model and harness

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slides 3 and 4. The model proposes language and tool requests. Runtime code executes actions, manages state and enforces boundaries. A model API alone does not execute a local file write or persist a task handoff. Providers may offer stateful features, but some external system still manages that state.

## 5. Prompt, context and harness

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 5. These are useful scopes, not universally standardized product boundaries. Prompt engineering chooses wording. Context engineering chooses what information the model receives. Harness engineering includes the execution lifecycle around those inputs. A better prompt can help but cannot itself enforce a filesystem allowlist.

## 6. Related terms

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 6. Terminology varies across vendors. Use these definitions consistently for this session rather than claiming a formal industry standard. An agent framework may implement much of a runtime; a team still chooses policies, integrations and checks.

## 7. Seven components in this demo

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 7, revised to match the agreed demo anatomy. Instructions & policies replaces Observability as a card; orchestration is outside the live example. Observability and orchestration remain important topics later. These seven are the presentation vocabulary, not a universal taxonomy.

## 8. The agent loop

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 8. The visible trace shows requests, tool actions and observations, not private model reasoning. A completion signal does not prove success. Shared call/token budgets and a pause mechanism stop unbounded activity. The model can request several tools, but this runtime executes them serially.

## 9. Tools & sandbox

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 9. In Harness Lab the model can list/read/write allowlisted source files and operate a real browser. It cannot edit protected checks or use an arbitrary shell. Browser preview and dashboard have separate origins. Both presets share this boundary. A local teaching sandbox is not a production service for hostile code.

## 10. Instructions & policies and context

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Expands source slides 5, 7 and 10. Both are model inputs and can be included together. Instructions & policies supplies project conventions; Context management supplies the repository map and current revision. The recorded request evidence shows exact payloads. Basic task/conversation context stays present in Minimal, and the model can read PROJECT.md manually. In harness v4, Context management also supplies the PN-142 ticket thread: knowledge from outside the repository that no tool can read.

## 11. Context beyond a project map

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 10. The reference describes compaction, offloading and just-in-time loading. Our demo only supplies a project map, revision and selected observations. It does not implement general retrieval, automatic summarization or production compaction. Keep that scope distinction explicit. Large context can waste tokens and hide useful details.

## 12. Memory & state

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 11. Distinguish persistent files from saved handoff and API conversation history. In both presets the edited source remains. Engineered saves observed checkpoints and can save model-written progress. A fresh session clears API history and includes supported memory. None of this guarantees the model will make the right next decision.

## 13. Guardrails

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 12. Instructions ask; enforcement restricts. Both demo presets retain the file allowlist and execution budgets. This card represents the additional human approval gate. Minimal applies only to its isolated published demo copy, never a real production deployment. Tokens are reported by the provider; the runtime also reserves space conservatively before the next request.

## 14. Verification

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 13. Tests, builds, type checks and linters provide executable evidence. LLM judges can add semantic review but require their own validation. Passing a finite suite is not universal correctness. In this demo checks are protected from agent edits and tied to a revision. Failure feedback can return to the model for another attempt. In harness v4 there are two tiers: six visible checks the agent can run, and five held-out checks only the presenter runs. A patch can pass every check it was shown and still fail one it was not.

## 15. Guides and sensors

Adapted from Birgitta Böckeler, Harness engineering for coding agent users, 2 April 2026: https://martinfowler.com/articles/harness-engineering.html . Guides shape behavior before an action. Sensors inspect the result and can help the agent correct it. The computational/inferential distinction is separate from before/after. This table uses our own concise examples. Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 16.

## 16. Observability and orchestration

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slides 14 and 15. They remain part of the broader subject even though they are not toggled cards here. Traces make comparisons auditable; evals require repeated comparable tasks. Orchestration assigns responsibility and coordinates handoffs across agents. A single focused workflow often does not require multiple agents.

## 17. Harness engineering as a practice

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 17. Use actual failure evidence to identify the missing capability. A stronger system may require an input, a tool or an enforced check, not a longer prompt. Re-run representative evaluations and remove changes that add cost without improving the intended behavior.

## 18. Examples from engineering teams

Sources: Anthropic, Effective harnesses for long-running agents, 26 Nov 2025, https://www.anthropic.com/research/effective-harnesses-for-long-running-agents . OpenAI, Ryan Lopopolo, Harness engineering: leveraging Codex in an agent-first world, 11 Feb 2026, https://openai.com/index/harness-engineering/ . Both are reports by their authors, not controlled comparisons or guarantees for our organization. Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slides 18 and 19.

## 19. Failures and useful controls

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 20. These are diagnostic hypotheses, not proof that every failure is caused by the harness. Model capability, provider availability and the task itself also matter. Start by checking the trace.

## 20. Design principles

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 21. These are practical guidelines rather than a promise of optimal design. Prefer the smallest system that covers observed failures. A deterministic check can also be wrong; the earlier Notes trial exposed a test gap around seed-note text, so check quality matters.

## 21. Demo: the disappearing draft and four traps

v4 demo flow. The first live v4 ladder is recorded in live-validation/v4/RESULTS.md; this slide has no screenshot until the deck is rebuilt. Use the live app. Pocket Notes now has three screens: Draft, My notes and Backup. On the SANDBOX phone, type a draft, switch to My notes and back, then refresh: the draft is gone both times. Open Backup: it lists saved notes as JSON and says unsaved drafts are never included. Before any model runs, name four ways a correct-looking patch is wrong. The backup leaks the draft. Existing users lose their notes after a storage change. Typed markup comes back as HTML. Test ids that QA automation uses disappear. These are held-out checks. No agent ever sees them. Each trap is a property real codebases have; nothing here tricks the model.

## 22. Minimal: two enabled components and what it was told

Live step 1. Create a fresh Minimal workspace with the same model and scenario you will use for Engineered. Blue means enabled, gray means off. Agent loop and Tools & sandbox are on. Every preset gets the same task text, starting files, tool schemas and budgets. Save a note on the PRODUCTION phone first, so you are an existing user. Start the run. Open Explain & compare and show what each agent was told. Minimal's column is short by nature. It can read PROJECT.md with a tool if it decides to. It cannot read the PN-142 ticket thread, which lives outside the workspace.

## 23. Production updates by itself

Live step 2. Production shows the original build until something is published. If Minimal declares completion, its patch is published at once and the banner says it was updated automatically by the agent, with no review. No check was required and nobody approved it. Production here is the run's isolated published copy, not a real deployment. If Minimal does not complete, say so and show the status instead.

## 24. Try the traps on production

Live step 3. On the production phone, check each trap by hand. Is the note you saved still listed after a refresh? Type a draft and open Backup: is the draft in the JSON? Type text with a bold tag and an ampersand, switch screens and back: is it still literal? Describe only what you see. The model may have handled every trap.

## 25. Claims versus evidence

Live step 4. Open the panel titled What it claimed, what was observed. The left column is the agent's completion summary, word for word. The right column lists each behavior with what the agent exercised in the browser after its last edit, whether it ran acceptance checks, and the harness result. If the summary claims the draft survives a refresh, look for a reload after the last edit. Claims are the model's words; observations are recorded tool actions. The panel does not interpret reasoning. This is observation the model did not make.

## 26. Engineered: knowledge it cannot know

Live step 5. Create a fresh Engineered workspace with the same model, scenario and task. Seven cards are blue. Open Instructions & policies to show the project rules. Open Context management to show the repository map, revision and the PN-142 ticket thread. The ticket explains incident INC-37 (a renamed storage key hid users' notes), the QA test ids, the backup privacy rule and the path-prefixed storage keys. Then show what each agent was told, side by side. Supplying a rule proves inclusion, not compliance; judge compliance from the diff and the checks.

## 27. The gate and the repair loop

Live step 6. With Verification on, the agent can run the six visible checks, and completion requires all six to pass on the current revision. A failure goes back to the model, which can try again within the shared budget. Show a repair loop only if one appears in the trace. Automated tests cover the rejection path. The held-out checks are never part of this gate.

## 28. Approval

Live step 7. After the visible checks pass, Engineered waits. The production banner says one change is waiting for approval. Open the diff and the tested revision. Approve. The banner changes to say it was updated after your approval. Try the traps on production again. This is authority the model should not have.

## 29. Held-out grading

Live step 8. Click Evaluate outcome on both runs. This is presenter evaluation, outside the agent workflow, with no model call. It runs both tiers. The Verification card shows the checks the agent can run and the held-out checks separately; Explain & compare adds a held-out row. Engineered can also fail a held-out check: it had the ticket, but it never saw these checks. Read the actual results. On the unfixed starter app the automated tests observe 4/6 visible and 3/5 held-out.

## 30. Optional: forced session reset

Optional live step. Prepare two workspaces with the same Forced session reset call number (resetAfterCalls). After that model call, the harness records Context limit reached: fresh session required, clears the conversation and starts session 2. Files remain in both runs. Only the run with Memory receives a frozen handoff. Show the reset event and the next prompt. This is state the model cannot keep. Restored state does not guarantee completion; the historical v3 memory trials stopped at their budgets.

## 31. The ladder

Open Runs & evals and the ladder scoreboard: Minimal, +Verification, +Instructions & context, +Memory, Engineered. Each rung adds one thing. Columns include trials, completed, visible pass, held-out pass, applied without review, claimed without a refresh test, average calls and average tokens. The ladder comes from node scripts/evaluate.mjs --ladder, which makes real, billable calls. No v4 ladder has been run yet. Show it only if you have measured one; empty cells mean not measured. A few trials per rung are illustrative, not a reliability rate.

## 32. What the demo establishes

Say only what the live runs and the automated tests show. The automated tests establish that the ticket reaches the model only through Context management, that held-out checks never reach the agent, that a draft-in-notes patch passes all six visible checks and fails the backup held-out check, that production changes only through publication, and that a forced reset happens at the same call for every preset. They do not establish model behavior. If Minimal passes everything, say so: it still shipped with no evidence required and no review. Close with: the model did not get smarter. The harness supplied what it could not know, checked what it did not look at, kept what it would forget, and held back what it should not decide alone.

## 33. Applying this to existing coding agents

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slides 21 and 22. You do not need to replace Claude Code, Codex or another coding environment to practice harness engineering. Maintain clear repository instructions, runnable checks, scoped access and a review process. Avoid version-specific command claims here. Reassess instructions and scaffolding when model capability changes; extra constraints can add cost or distract the model.

## 34. Discussion

Close with the original goal: production agents need an engineered environment around the model. Ask engineers for a recurring failure, architects for an enforceable boundary, and leaders for evidence they would require before expanding access. Keep the discussion anchored to a real workflow rather than choosing the largest component list. Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 23.

## 35. Sources and further reading

Reference supplied by the user: Agent-Harness-and-Harness-Engineering.pptx, all 24 slides reviewed. External primary sources checked on 25 October 2026. URLs below support the case examples and guides/sensors framing; local real-run evidence supports demo outcomes. The source deck also lists a Thoughtworks podcast and a community collection as optional reading, but no claims here depend on them.

## Appendix: notes for the current deck's historical slides (v2 and v3)

These notes belong to the current, pre-v4 deck. They describe historical v2 and v3 evidence with an earlier fixture and a single check tier. Do not pool them with v4 results.

### Current deck slide 21: Demo: the disappearing draft (v2)

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. We use a browser-based mobile app so no emulator is needed. In a fresh workspace type a draft title and text, click My notes and return to Draft. The text disappears; refresh also loses it. The requested repair must also preserve saving, existing notes and distinct notes. This is one task with three acceptance-data variants, not three unrelated applications.

### Current deck slide 22: Minimal: two enabled components (v2)

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. Live step 1. Create a fresh Minimal workspace and choose the same model and scenario you will use for Engineered. Blue means enabled; gray means off. Basic task context and sandbox protection remain. Minimal can manually inspect files, read PROJECT.md and use the browser. The disabled cards refer to automatic project support, handoff, acceptance enforcement and approval.

### Current deck slide 23: Engineered: inputs in a real request (v2)

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. Live step 2. Start Engineered. The orange outline identifies active components; it does not reveal private reasoning. This screenshot records an actual request with Agent loop, Instructions & policies and Context management active together. Open either input card to inspect its separate payload. The model is the same as Minimal. Image source: actual run cf25feae-cd17-4bfa-a052-d9771d84c848, draft scenario.

### Current deck slide 24: Two different project inputs (v2)

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. Live step 3. Show the exact rules and map, not just this summary. The instructions payload says to preserve existing notes and literal text. The context payload identifies src/storage.js as notes and draft storage, with file sizes and source revision. Both appear in the actual model request. Rule compliance must be judged from the diff and tests. Image sources: corresponding instructions and context evidence screenshots from run cf25feae.

### Current deck slide 25: Evaluation after Minimal stops (v2)

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. Live step 4. Minimal can publish when it declares completion, without acceptance checks. Evaluate outcome is a separate presenter action. In this captured draft trial the model hit its budget before completing and never published. The independent checks found 5/6, including a regression to existing note text. Do not describe this specific run as an automatically published bad patch.

### Current deck slide 26: Verification before Engineered completes (v2)

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. Live step 5. The harness runs protected tests when requested and independently when completion is requested. All six must pass on the current revision. If they fail, the gate returns failures to the model. In these three successful Engineered trials no final failed-check gate occurred; do not invent one during narration. Automated tests cover that rejection path.

### Current deck slide 27: Review and approval (v2)

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. Live step 6. Open the source diff, inspect it and compare the tested revision. Engineered waits for approval rather than applying immediately. Opening the approval dialog does not publish. Confirmation publishes only the checked current revision into the isolated demo copy. Try the published app afterwards. Image source: reviewed storage.js diff from cf25feae.

### Current deck slide 28: v3 comparison (historical)

Historical v3 evidence: live-validation/v3/comparison-fallback-before-approval.png, fallback-matrix.json and the exported runs e25d301f-60f1-46a2-aadf-93f595e3221c and 0b75acc7-f595-4277-a1ce-082f685acff0. Actual OpenRouter calls on 26 October 2026 with cohere/north-mini-code:free. Same Draft task, starting fixture and shared budgets. These are two individual trials, not a reliability benchmark. This screenshot records the state BEFORE human approval. Minimal completed and applied automatically. Engineered passed 6/6 and waited for approval, so the screenshot correctly says its patch has not been applied. The presenter subsequently reviewed the storage.js-only diff and approved it. Do not narrate this screenshot as the final post-approval state. Both fixed the task in this pair. The observed contrast is runtime enforcement and publication control, without a claim that a harness guarantees a better patch.

### Current deck slide 29: v3 results (historical)

Historical v3 evidence: live-validation/v3/comparison-fallback-before-approval.png, fallback-matrix.json and the exported runs e25d301f-60f1-46a2-aadf-93f595e3221c and 0b75acc7-f595-4277-a1ce-082f685acff0. Actual OpenRouter calls on 26 October 2026 with cohere/north-mini-code:free. Same Draft task, starting fixture and shared budgets. These are two individual trials, not a reliability benchmark. Minimal e25d301f completed automatically with 6/6, 20 real model calls and recorded elapsed time 73.080 seconds. Engineered 0b75acc7 reached approval with 6/6, 13 calls and recorded elapsed time 89.012 seconds. These elapsed values come from the comparison snapshot before human approval and do not include subsequent review time. The presenter reviewed the source diff, which changed only src/storage.js for Engineered, then approved it. Independent browser validation of both published apps passed with zero observed uncaught errors. Minimal changed src/app.js and src/storage.js. A smaller diff and fewer calls in one pair do not establish causality or comparative reliability. Keep these v3 outcomes separate from v2 and from other model/provider failures. Fresh v3 memory trials remain separate and are not represented as completed here.

### Current deck slide 30: Historical v2 outcomes

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. Six runs, one per preset and acceptance variant. The task and fixture were identical. All successful patches subsequently passed independent published-app checks. This is illustrative evidence, not a statistical reliability claim. The first Minimal trial used 13 calls and hit budget with 5/6. Engineered draft used 5 calls; Unicode 5; long-form 4. Minimal Unicode 11; long-form 12. Do not pool these trials with the latest v3 pair, which used a different harness version and model.

### Current deck slide 31: Fresh sessions: v2 evidence

Historical v2 evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026 with nvidia/nemotron-3.5-super-vl:free. Individual trials, not a reliability benchmark. Optional step 7, using this historical recorded trial. Both presets paused after an actual edit and started a fresh session. Minimal had zero saved checkpoints. Engineered supplied the saved source revision/checkpoint in the actual next prompt. The Engineered trial then encountered HTTP 502; one recovery restored the checkpoint again. Both ultimately hit their budgets with a 6/6 patch and did not publish. Memory helps carry state; it does not guarantee completion. Harness v3 now freezes a compact handoff at session reset, while retaining the full checkpoints as evidence. This screenshot does not establish v3 memory completion. Latest separate v3 memory trials on 26 October: Minimal 7bc9ac11 in session 2 had no saved handoff, stopped at its 24-call budget with 3/6 and did not publish. Engineered c599c57b in session 2 restored a 766-byte compact frozen handoff, stopped after 23 calls due to conservative next-request reservation with 6/6 and did not publish. These trials show restoration, while successful interrupted-task completion remains unestablished. Keep memory optional.

### Current deck slide 32: What the demo establishes (historical v2 and v3)

Evidence sources: historical v2 live-validation/revised-cards/RESULTS.md and latest v3 live-validation/v3/RESULTS.md plus the exported runs. The v2 set contains six scenario trials plus two interrupted runs. Its recovery belongs to the same Engineered interrupted run. The latest v3 matched Draft pair shows two passing patches with different completion and publication requirements. Do not pool model versions or harness versions into a success percentage. A provider error is distinct from a code defect. Shared budgets can stop a working patch before completion. Screenshots record real rehearsal, not current live execution.
