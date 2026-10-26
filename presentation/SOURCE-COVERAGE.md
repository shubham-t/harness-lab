# Reference content coverage

Reference: the user's 24-slide **Agent-Harness-and-Harness-Engineering.pptx**. Its concepts informed the content; its dark template was not reused.

| Reference slides | Concepts retained | Workshop slides |
| --- | --- | --- |
| 1–4 | Harness vs engineering, model plus harness, action/state/checks | 1, 3–4 |
| 5–6 | Prompt/context/harness and neighboring terms | 5–6 |
| 7 | Anatomy | 7, 22–24 |
| 8–9 | Agent loop, tools and sandbox | 8–9 |
| 10 | Context management, compaction, offloading, selective loading | 10–11 |
| 11 | Memory, state and durable artifacts | 12, 31 |
| 12–13 | Guardrails, budgets, approval and verification | 13–14, 25–29 |
| 14–15 | Orchestration, observability and evaluations | 16, 28–30 |
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
- Slides 21–32 add the actual Pocket Notes workflow and measured results, including budget exhaustion, a provider error and successful Minimal runs.
- Slides 28–29 add the matched v3 Draft pair from 26 October 2026 with OpenRouter `cohere/north-mini-code:free`: Minimal `e25d301f` passed 6/6 and applied automatically (20 calls, 73.080 seconds); Engineered `0b75acc7` passed 6/6 and waited for review (13 calls, 89.012 seconds). The screenshot captures the state before approval. The later reviewed approval and independent published-browser validation passed for both apps with zero observed errors. Timings exclude subsequent human review. This pair illustrates enforcement without a claim that a harness guarantees a better patch.
- Historical v2 screenshots on slides 21–27 and results/memory on slides 30–31 carry visible version/date labels. They remain separate evidence from the new model and harness version. The v2 memory result does not establish v3 completion.
- The final deck includes notes for narration, source links, live transitions and honest fallback behavior.

Primary source links checked for the case examples and control model:

- https://www.anthropic.com/research/effective-harnesses-for-long-running-agents
- https://openai.com/index/harness-engineering/
- https://martinfowler.com/articles/harness-engineering.html
