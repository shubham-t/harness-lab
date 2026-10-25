# Speaker notes

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

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Expands source slides 5, 7 and 10. Both are model inputs and can be included together. Instructions & policies supplies project conventions; Context management supplies the repository map and current revision. The recorded request evidence shows exact payloads. Basic task/conversation context stays present in Minimal, and the model can read PROJECT.md manually.

## 11. Context beyond a project map

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 10. The reference describes compaction, offloading and just-in-time loading. Our demo only supplies a project map, revision and selected observations. It does not implement general retrieval, automatic summarization or production compaction. Keep that scope distinction explicit. Large context can waste tokens and hide useful details.

## 12. Memory & state

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 11. Distinguish persistent files from saved handoff and API conversation history. In both presets the edited source remains. Engineered saves observed checkpoints and can save model-written progress. A fresh session clears API history and includes supported memory. None of this guarantees the model will make the right next decision.

## 13. Guardrails

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 12. Instructions ask; enforcement restricts. Both demo presets retain the file allowlist and execution budgets. This card represents the additional human approval gate. Minimal applies only to its isolated published demo copy, never a real production deployment. Tokens are reported by the provider; the runtime also reserves space conservatively before the next request.

## 14. Verification

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 13. Tests, builds, type checks and linters provide executable evidence. LLM judges can add semantic review but require their own validation. Passing a finite suite is not universal correctness. In this demo checks are protected from agent edits and tied to a revision. Failure feedback can return to the model for another attempt.

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

## 21. Demo: the disappearing draft

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. We use a browser-based mobile app so no emulator is needed. In a fresh workspace type a draft title and text, click My notes and return to Draft. The text disappears; refresh also loses it. The requested repair must also preserve saving, existing notes and distinct notes. This is one task with three acceptance-data variants, not three unrelated applications.

## 22. Minimal: two enabled components

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Live step 1. Create a fresh Minimal workspace and choose the same model and scenario you will use for Engineered. Blue means enabled; gray means off. Basic task context and sandbox protection remain. Minimal can manually inspect files, read PROJECT.md and use the browser. The disabled cards refer to automatic project support, handoff, acceptance enforcement and approval.

## 23. Engineered: inputs in a real request

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Live step 2. Start Engineered. The orange outline identifies active components; it does not reveal private reasoning. This screenshot records an actual request with Agent loop, Instructions & policies and Context management active together. Open either input card to inspect its separate payload. The model is the same as Minimal. Image source: actual run cf25feae-cd17-4bfa-a052-d9771d84c848, draft scenario.

## 24. Two different project inputs

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Live step 3. Show the exact rules and map, not just this summary. The instructions payload says to preserve existing notes and literal text. The context payload identifies src/storage.js as notes and draft storage, with file sizes and source revision. Both appear in the actual model request. Rule compliance must be judged from the diff and tests. Image sources: corresponding instructions and context evidence screenshots from run cf25feae.

## 25. Evaluation after Minimal stops

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Live step 4. Minimal can publish when it declares completion, without acceptance checks. Evaluate outcome is a separate presenter action. In this captured draft trial the model hit its budget before completing and never published. The independent checks found 5/6, including a regression to existing note text. Do not describe this specific run as an automatically published bad patch.

## 26. Verification before Engineered completes

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Live step 5. The harness runs protected tests when requested and independently when completion is requested. All six must pass on the current revision. If they fail, the gate returns failures to the model. In these three successful Engineered trials no final failed-check gate occurred; do not invent one during narration. Automated tests cover that rejection path.

## 27. Review and approval

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Live step 6. Open the source diff, inspect it and compare the tested revision. Engineered waits for approval rather than applying immediately. Opening the approval dialog does not publish. Confirmation publishes only the checked current revision into the isolated demo copy. Try the published app afterwards. Image source: reviewed storage.js diff from cf25feae.

## 28. Actual rehearsal outcomes

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Six runs, one per preset and acceptance variant. The task and fixture were identical. All successful patches subsequently passed independent published-app checks. This is illustrative evidence, not a statistical reliability claim. The first Minimal trial used 13 calls and hit budget with 5/6. Engineered draft used 5 calls; Unicode 5; long-form 4. Minimal Unicode 11; long-form 12.

## 29. Fresh sessions: what survived?

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Optional live step 7, or use this recorded real trial. Both presets paused after an actual edit and started a fresh session. Minimal had zero saved checkpoints. Engineered supplied the saved source revision/checkpoint in the actual next prompt. The Engineered trial then encountered HTTP 502; one recovery restored the checkpoint again. Both ultimately hit their budgets with a 6/6 patch and did not publish. Memory helps carry state; it does not guarantee completion.

## 30. What the demo establishes

Local evidence: live-validation/revised-cards/RESULTS.md, matrix.json, memory-results.json and memory-recovery.json. Actual OpenRouter calls on 25 October 2026. Individual trials, not a reliability benchmark. Explain the limits candidly. Eight fresh runs were attempted: six scenario trials plus two interrupted runs. The recovery belongs to the same Engineered interrupted run. A provider error is distinct from a code defect. Shared budgets can stop a working patch before completion. Screenshots are evidence from real rehearsal, not a replacement pretending to be live.

## 31. Applying this to existing coding agents

Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slides 21 and 22. You do not need to replace Claude Code, Codex or another coding environment to practice harness engineering. Maintain clear repository instructions, runnable checks, scoped access and a review process. Avoid version-specific command claims here. Reassess instructions and scaffolding when model capability changes; extra constraints can add cost or distract the model.

## 32. Discussion

Close with the original goal: production agents need an engineered environment around the model. Ask engineers for a recurring failure, architects for an enforceable boundary, and leaders for evidence they would require before expanding access. Keep the discussion anchored to a real workflow rather than choosing the largest component list. Content adapted from the user-supplied Agent-Harness-and-Harness-Engineering.pptx. Theme redesigned for Harness Lab. Source slide 23.

## 33. Sources and further reading

Reference supplied by the user: Agent-Harness-and-Harness-Engineering.pptx, all 24 slides reviewed. External primary sources checked on 25 October 2026. URLs below support the case examples and guides/sensors framing; local real-run evidence supports demo outcomes. The source deck also lists a Thoughtworks podcast and a community collection as optional reading, but no claims here depend on them.
