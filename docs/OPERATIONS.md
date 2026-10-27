# Setup and operation

## Fresh checkout

```powershell
git clone -b v4-redesign https://github.com/shubham-t/harness-lab.git
cd harness-lab
npm ci
npx playwright install chromium
$env:HARNESS_DATA_DIR = Join-Path $PWD '.data'
npm start
```

Open http://127.0.0.1:4318. Keep the terminal open. On Windows, `start.cmd` is another way to launch; if you want data under the checkout, set HARNESS_DATA_DIR in `.env` first. On macOS/Linux use `export HARNESS_DATA_DIR="$PWD/.data"` and `npm start`.

The app also tries installed Microsoft Edge if bundled Chromium is unavailable. Run `npm run doctor` before rehearsal. Ports 4318 and 4319 must be free, or configure distinct PORT and PREVIEW_PORT values.

## Model setup

In **Connect a model**, enter the provider's base URL, protocol, exact model ID and key. **Save connection** stores the key in process memory. **Save & test** makes a real provider request. A successful connection test verifies access, not bug-fixing capability.

The verified live configuration was OpenRouter, base URL `https://openrouter.ai/api/v1`, Chat Completions, model `nvidia/nemotron-3.5-super-vl:free`. Availability, quota and response times can change. Use the exact model supported by your account. Internal models need compatible tool-calling behavior; an arbitrary chat endpoint is insufficient.

Alternatively copy `.env.example` to `.env` and fill values locally. Never commit or share `.env`. UI-entered keys vanish on restart. Provider settings are pinned when a run starts; restore those settings before resuming an older run.

## Presenting

Use [the walkthrough](../ANATOMY-DEMO.md) and [the presenter runbook](PRESENTER.md). **Focus demo** hides navigation and emphasizes the phone, component cards and agent trace. Exit focus for New workspace or Runs & evals.

Create fresh workspaces for comparisons. Existing historical runs show what happened previously; they do not replay or simulate execution. Exported evidence in the repository is a fallback for discussion and is not automatically imported into live history on a new machine.

## Restart and persistence

Pause active agents and wait for the operation to finish. Stop the owning terminal with Ctrl+C and restart. Saved source, traces and checkpoints remain in HARNESS_DATA_DIR. A process interrupted during a model request records uncertain usage rather than inventing token counts. You may need to re-enter a memory-only key.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Run button disabled | Configure a key and model. Confirm the browser readiness indicator. Keyless Evaluate outcome still works. |
| Browser unavailable | Run `npx playwright install chromium`, then doctor. Check Edge installation on Windows. |
| HTTP 401/403 | Check provider account/key and endpoint; do not paste the key into chat or logs. |
| HTTP 429 | Provider quota/rate limit. Wait or use a permitted model; do not mask the failure. |
| HTTP 502 or timeout | Inspect the trace. Resume once if the provider is healthy; this makes a new session and more real calls. |
| Budget reached | Inspect the partial patch and evaluate it. Create a new run if needed; do not present a partial result as completion. |
| Checks fail | Inspect individual failures and the source diff. Engineered must repair and re-request completion before approval. |
| Approval disabled | Confirm current source revision and current suite passed. Older checks cannot authorize the new revision. |
| Port already in use | Use the existing server or stop only the verified Harness Lab process. Do not kill all Node processes. |
| Old cards after refresh | Confirm the terminal runs this checkout, then hard-refresh. Server code changes require a restart. |

## Backup

Stop active runs, then copy HARNESS_DATA_DIR to a local backup location. It includes source and API conversation state, so treat it as private. Public run exports are more appropriate for sharing; review them for application data before distribution.
