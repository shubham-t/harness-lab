# Pocket Notes

A mobile-first notes app. Its three screens are a draft editor, a saved-notes list and a backup export.

## Repository map
- src/app.js: rendering, navigation, input and save handlers
- src/storage.js: notes and draft storage
- src/export.js: backup JSON, schema version 1, read by the Backup screen and by the release checker
- src/styles.css: appearance
- index.html: entry point

## Conventions
Use the existing storage module for persistence. Keep existing storage keys and value shapes so current users' notes survive an upgrade; add new keys rather than renaming. Backups never include unsaved drafts. Preserve the DOM data-testid attributes because QA automation uses them. Keep user text as text, not interpreted HTML. Preserve existing notes and the current appearance. No dependencies are needed.

## Verification
Use run_checks for actual browser acceptance checks. Inspect the returned failures, then rerun after editing. The protected checks are outside this repository. A passing result belongs only to the source revision it tested.

## Completion
A draft survives navigation and page refresh. Saving creates exactly one note, clears the draft, and preserves other notes. Distinct notes stay distinct. Explain the change and its verification in the final summary.
