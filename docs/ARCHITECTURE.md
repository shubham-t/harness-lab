# Architecture

Harness Lab runs on one laptop. The browser dashboard controls a Node server. That server calls the configured model, executes allowlisted tools, and records measured results. A separate loopback origin serves the model's working copy of Pocket Notes.

## Modules

| Module | Responsibility |
| --- | --- |
| `server.mjs` | Dashboard/API on 4318, preview on 4319, origin checks, explicit run actions and evaluation groups |
| `lib/store.mjs` | Fixture copying, allowed paths, atomic persistence, revisions, public run snapshots and source diffs |
| `lib/provider.mjs` | Responses and Chat Completions adapters, tool continuation, aborts, timeouts, token accounting and memory-only credentials |
| `lib/runner.mjs` | Context assembly, actual model/tool loop, feature-dependent tools, checkpoints, budgets, completion and approval |
| `lib/browser.mjs` | Playwright operations and six protected acceptance checks |
| `public/anatomy.mjs` | Maps recorded events and feature flags to component states; no timed playback or invented stages |
| `public/lesson.mjs` | Evidence-based audience explanations and compatible-run comparison |
| `public/app.js` | Polls state, renders cards/evidence, controls run/pause/resume/approval and model setup |

## Request lifecycle

1. A fresh run copies the deliberately buggy fixture into an isolated directory.
2. The runner assembles basic task instructions and enabled project inputs. Instructions & policies receives conventions and completion rules from PROJECT.md. Context management receives its repository map, file metadata and revision. Each input gets a separate event with the exact payload for that request.
3. The provider receives instructions, the current session history and permitted tool schemas. The model requests an action or responds with text.
4. The runner validates and executes requested tools serially, appends observations to API history, and records visible evidence.
5. Completion either publishes directly to the isolated demo copy or runs verification and waits for approval, depending on configuration. Revision hashes prevent approval of changed source.

## Tool access

Both presets have list_files, read_file, write_file, browser_action and request_completion. Version 2 exposes run_checks only when verification is enabled, and save_memory only when memory is enabled. The runner rejects an unavailable tool even if a model requests it anyway. No shell or arbitrary host/network tool exists.

Minimal can inspect PROJECT.md manually and can exercise the browser. Turning off automatic project inputs does not erase knowledge discoverable through tools. Turning off verification removes the protected acceptance tool and completion gate, not all possible manual testing.

## Memory and state

Working files survive in both presets. Engineered additionally records observed checkpoints and optionally model-written handoff text. A fresh session clears API conversation history. Harness v3 freezes a compact handoff at session start: latest edited files/revisions, a concise check summary, a bounded model-written note and recent action names. It does not re-insert full browser payloads or current-session checkpoints as prior-session memory. The full checkpoints remain in the audit trail. Older runs retain their earlier prompt policy. Saved memory does not guarantee task completion: live rehearsals include budget exhaustion and a provider 502.

## Verification and evaluation

The six checks measure draft navigation, refresh, complete saving, clearing the saved draft, original-note preservation and distinct notes. Tests belong to the harness, outside the model-editable fixture. `notes-v2` compares original notes with fixed expected content rather than whatever content the patch happens to provide.

Presenter evaluation can run after a model stops. It does not retroactively enforce Minimal completion and does not undo publication. Verification-disabled model context excludes these results. Evaluation groups separate model, endpoint, protocol, feature configuration, scenario, harness version and test-suite version. A passing patch, a completed run and an approved publication are different outcomes.

## Publication and evidence storage

Publication stages all allowlisted files and a harness-owned revision manifest in a new sibling directory, then renames the complete directory into place. Failed staging leaves no partial published app. Atomic JSON snapshots retry bounded transient rename failures without deleting the previous snapshot. If publication succeeds but later event persistence fails, the UI reports a storage warning while retaining the applied status. On restart the manifest is checked against published-file hashes to recover that fact. This covers process interruption, not a claim of power-loss durability.

## Data and boundaries

Runtime data defaults to `../../work/harness-lab-runtime` relative to this repository root for compatibility with the original workshop workspace. Set `HARNESS_DATA_DIR` to an absolute directory such as `<checkout>/.data` when running a fresh clone. Never commit this directory. Public exports exclude private API history and credentials.

The server binds to loopback, enforces local control headers and separates preview/dashboard origins. File access uses an allowlist; browser context network requests are restricted to the preview origin. These are teaching-workbench boundaries, not a hardened service for hostile repositories. Keep the ports local.

## Versioning

Version 1 runs retain historical behavior. Version 2 introduced the reduced Minimal tool/completion policy. The later card redesign preserves this policy while separating project input evidence and replacing Observability with Instructions & policies. Historical traces lacking specific input events are not retroactively relabeled as having them.
