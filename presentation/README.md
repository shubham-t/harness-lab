# Workshop presentation

Open **Agent-Harness-Workshop.pptx** in PowerPoint. It contains 48 editable slides with speaker notes: 20 concept slides, the harness v4 demo on slides 21 to 32, three closing slides, and a labeled historical appendix on slides 36 to 48 that keeps the earlier v2 and v3 demo slides. The same notes are in [speaker-notes.md](speaker-notes.md), which `build.mjs` generates; edit notes in `build.mjs`, not in the Markdown file.

**Rebuilt for harness v4 on 27 October 2026.** The demo slides show the first live v4 ladder, recorded on 26 October 2026 with OpenRouter `cohere/north-mini-code:free`, one trial per rung and scenario (see [the v4 live report](../live-validation/v4/RESULTS.md)). Their images are screenshots of those recorded runs taken from the dashboard on 27 October 2026. They live in `assets/v4/`, and `assets/v4/manifest.json` names the run behind every file. Each demo slide states its run id, the run date and the screenshot date. The screenshots are recorded evidence, not current live execution: present the demo from the live app and [ANATOMY-DEMO.md](../ANATOMY-DEMO.md), and narrate the outcome you actually get.

| Slide | Run(s) shown | What the screenshot is |
| --- | --- | --- |
| 21 | `d13b50fa` (Minimal, draft) | The Backup screen of the starting app on the production phone (original build) |
| 22 | `d13b50fa` | Anatomy board with two enabled cards; the Minimal column of "What each agent was told" |
| 23 | `d13b50fa`, `d017cd57` (+Verification, draft) | Both phones of each run; production banners "Original build" and "Updated automatically by the agent. No review." |
| 24 | `d017cd57` | The production phone after the presenter's own trap checks on 27 October 2026 |
| 25 | `d017cd57` | The claims versus evidence panel |
| 26 | `d13b50fa`, `5794a37d` (Engineered, draft) | "What each agent was told" side by side; the Context management evidence scrolled to ticket PN-142; the seven-card board |
| 27 | `d017cd57` | The activity list at the agent's first `run_checks` call |
| 28 | `5794a37d` | Both phones after approval; the activity list at the approval boundary; the diff's AFTER panel |
| 29 | `5794a37d` | The Browser verification card with both tiers after presenter evaluation |
| 30 | `b4feef72` (+Memory, forced reset after call 8) | The reset event and the next prompt; the frozen handoff supplied to session 2 |
| 31 | the draft-scenario ladder | The ladder scoreboard filtered to `cohere/north-mini-code:free · draft · harness v4 · no forced reset` |
| 32 | none | Text only |

Honesty notes for the presenter:

- No Minimal run completed in the ladder, so the automatic-publication banner on slide 23 comes from the +Verification rung (`d017cd57`), the first rung that finished. The slide and its notes say so.
- The trap checks on slide 24 are presenter actions on the published production copy of `d017cd57`, not agent actions.
- No completion request was rejected by the gate in these runs. Slide 27 shows the agent's own `run_checks` calls (4/6 before editing, 6/6 after) and says a repair loop should be shown only if one appears.
- The ladder slide shows one scenario, as the dashboard does. The three-scenario totals quoted beside it come from the v4 report.
- Times inside screenshots are local to the laptop that recorded them (Asia/Calcutta). One trial per cell is illustrative, not a reliability rate.

The appendix slides keep their original text and labels. Slides 44 and 45 show the historical v3 Draft pair from 26 October 2026 (`cohere/north-mini-code:free`, both 6/6; the comparison screenshot captures Engineered before approval; the 73.080/89.012-second timings exclude human review). Slides 37 to 43, 46 and 47 keep the v2 rehearsal of 25 October 2026 with `nvidia/nemotron-3.5-super-vl:free`. Do not pool these versions with each other or with v4.

The deck uses the demo's cream, green, blue and orange palette. [Coverage mapping](SOURCE-COVERAGE.md) explains the adaptation of the reference deck. [Presenter runbook](../docs/PRESENTER.md) gives setup, timing and fallback instructions.

## Live recording of the builder page

`record-builder-video.mjs` opens `/builder.html` on the running server at 1440×900 with Playwright's video capture on, presses **Run this step live** on each of the eight steps, waits for each real run and its presenter evaluation, triggers the sandbox probe on step 2, opens the diff on step 7 and approves it only when the diff changes `src/storage.js` alone, keeps the notes key and adds a draft key. It writes `presentation/video/harness-builder-live.webm` (ignored by Git, never changed afterwards), a `.trim.json` with the moments where something changed on screen, and a `.notes.txt` timeline with mm:ss marks and the run ids. A one-second title card marks every step boundary. Every step makes real, billable model calls; a dropped provider connection is shown, noted, and the step is started again. With the free model the whole recording takes about twenty-five minutes. The video is silent.

`trim-video.mjs` then writes `<name>.trimmed.webm` with the idle waiting cut out, keeping every moment where the screen changed plus a little context, and leaves the original untouched. It uses a full ffmpeg when one is available (on PATH or the `ffmpeg-static` package) for exact cuts; otherwise headless Chromium replays the kept intervals of the original while Playwright records them, which needs nothing beyond the project's dependencies and lands cut points within about half a second.

```powershell
npm start
node presentation/record-builder-video.mjs --pause 8
node presentation/trim-video.mjs
```


## Rebuild

`build.mjs` writes the deck and `speaker-notes.md` with [pptxgenjs](https://www.npmjs.com/package/pptxgenjs); the Codex artifact runtime is no longer needed (the earlier source that needed it is in git history before this rebuild). pptxgenjs is an authoring dependency only and is not part of the application's `package.json`.

```powershell
npm install --no-save pptxgenjs
node presentation/build.mjs
```

Alternatively set `DECK_NODE_MODULES` to any `node_modules` directory that contains pptxgenjs. `--out <file>` writes the deck elsewhere.

`capture-v4.mjs` takes the dashboard screenshots. Start the server with `npm start`, then run `node presentation/capture-v4.mjs` (optionally `--origin` and `--out`). It is read-only against the server and never starts a model run; the only writes are the presenter's trap checks typed into a run's published production copy, inside the script's throwaway browser profile. It selects the runs by id prefix at the top of the file; to use newer runs, change those prefixes, then update the run ids and dates named in `build.mjs`.

Checks performed on 27 October 2026: the OOXML package validator passed with no findings; native Microsoft PowerPoint opened the deck, reported 48 notes pages and exported all 48 slides as PNG, which were inspected for title fit, text overflow and image placement; `slide_text` extraction found no leftover placeholders and no key-like strings in slide text, notes or the manifest. Projector readability and a timed spoken rehearsal with the rebuilt deck still need checking in the presentation room.

`assets/` holds the v2 and v3 screenshots used by the appendix; `assets/v4/` holds the v4 screenshots and their manifest. `preview.png` is slide 21. The original reference deck remains in the user's Downloads folder and is not copied into this repository.
