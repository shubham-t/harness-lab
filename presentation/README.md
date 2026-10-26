# Workshop presentation

Open **Agent-Harness-Workshop.pptx** in PowerPoint. It contains 35 editable slides with speaker notes. The demo screenshots are embedded images from real local runs. Supporting notes are also available in [speaker-notes.md](speaker-notes.md).

The deck uses the demo's cream, green, blue and orange palette. It covers the source presentation's concepts, then the seven-component demo, real results and limitations. [Coverage mapping](SOURCE-COVERAGE.md) explains the adaptation. [Presenter runbook](../docs/PRESENTER.md) gives setup, timing and fallback instructions.

The screenshots are recorded evidence. Do not present them as current live execution. Real runs require the app and a provider connection. The results include successful Minimal runs and failures; the deck makes no statistical reliability claim.

Slides 28–29 show the latest v3 Draft pair from 26 October 2026 using OpenRouter `cohere/north-mini-code:free`. Both passed 6/6. The comparison screenshot captures Engineered **before approval**. The following slide records the later reviewed approval and successful independent validation of both published apps. The 73.080/89.012-second timings describe the recorded pre-approval runs and exclude subsequent human review. Slides 21–27 and 30–31 retain explicitly labelled historical v2 evidence from 25 October, using a different model. Do not pool these versions. Slide 31's memory trial is historical and does not claim successful v3 memory completion.

## Rebuild

The 35-slide update passed package, layout, font-policy and first-party re-import checks with no findings. Native Microsoft PowerPoint opened and exported all slides; changed slides were visually inspected, following the earlier inspection of the original deck. Projector readability and a timed spoken rehearsal still need checking in the presentation room.

`build.mjs` uses `@oai/artifact-tool` from the Codex artifact runtime. It is an optional presentation authoring dependency, not required to run Harness Lab. Set ARTIFACT_NODE_MODULES to that runtime's node_modules directory and DECK_BUILD_DIR to a private build folder. Run the script with the corresponding Node runtime. It writes a candidate PPTX, individual slide PNGs and speaker notes. The final delivered deck has additionally passed the presentation package/layout validation workflow.

```powershell
$env:ARTIFACT_NODE_MODULES = 'C:/path/to/artifact-runtime/node_modules'
$env:DECK_BUILD_DIR = Join-Path $PWD 'presentation/.build'
node presentation/build.mjs
```

All screenshot assets used for the deck are in `assets/`. The original reference file remains in the user's Downloads folder and is not copied into this repository.
