# Reference content coverage

Reference: the user's 24-slide **Agent-Harness-and-Harness-Engineering.pptx**. Its concepts informed the content; its dark template was not reused.

| Reference slides | Concepts retained | Workshop slides |
| --- | --- | --- |
| 1–4 | Harness vs engineering, model plus harness, action/state/checks | 1, 3–4 |
| 5–6 | Prompt/context/harness and neighboring terms | 5–6 |
| 7 | Anatomy | 7, 22, 26 |
| 8–9 | Agent loop, tools and sandbox | 8–9 |
| 10 | Context management, compaction, offloading, selective loading | 10–11 |
| 11 | Memory, state and durable artifacts | 12, 30 |
| 12–13 | Guardrails, budgets, approval and verification | 13–14, 23, 27–29 |
| 14–15 | Orchestration, observability and evaluations | 16, 25, 31 |
| 16 | Guides/sensors and deterministic/model-based controls | 15 |
| 17 | Observe, diagnose, encode and measure | 17 |
| 18–19 | Anthropic and OpenAI case examples | 18 |
| 20 | Failure modes and candidate controls | 19 |
| 21–22 | Design principles, reassessing harnesses as models change | 20, 33 |
| 23–24 | Takeaway and primary reading | 32, 34–35 |

Changes made for this workshop:

- The demo uses seven cards. Instructions & policies is separate from Context management. Observability remains a cross-cutting log/evaluation capability, and orchestration remains a concept outside the single-agent demo.
- Vendor case studies retain the engineering patterns without repeating headline productivity numbers as if they predict this organization's results.
- Claims about memory and safety are phrased as responsibilities of external software, avoiding absolute claims about every model product or API.
- Slides 21–32 show the harness v4 flow with the first live ladder (26 October 2026, OpenRouter `cohere/north-mini-code:free`, one trial per rung and scenario): the Backup screen and the four traps, Minimal's two enabled cards and its short brief, automatic publication to the production phone, the presenter's trap checks, claims versus evidence, the PN-142 ticket inside Engineered's context, the visible-check gate, approval, held-out grading, the forced session reset and the ladder scoreboard. Every demo slide names its run id, the run date and the screenshot date (27 October 2026). Minimal never completed in that ladder, so the automatic-publication banner comes from the +Verification rung and is labeled as such.
- The pre-v4 demo slides are kept unchanged as a labeled historical appendix (slides 36–48): the v2 rehearsal of 25 October 2026 with `nvidia/nemotron-3.5-super-vl:free` and the v3 Draft pair of 26 October 2026 with `cohere/north-mini-code:free` (Minimal `e25d301f` 6/6, applied automatically, 20 calls, 73.080 seconds; Engineered `0b75acc7` 6/6, waited for review, 13 calls, 89.012 seconds; the screenshot predates approval and the timings exclude human review). They use an earlier fixture and a single check tier and must not be pooled with v4 or with each other.
- The final deck includes notes for narration, source links, live transitions and honest fallback behavior.

Primary source links checked for the case examples and control model:

- https://www.anthropic.com/research/effective-harnesses-for-long-running-agents
- https://openai.com/index/harness-engineering/
- https://martinfowler.com/articles/harness-engineering.html
