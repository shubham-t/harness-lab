# Pocket Notes

A mobile-first notes app. Its two screens are a draft editor and a saved-notes list.

## Repository map
- src/app.js: rendering, navigation, input and save handlers
- src/storage.js: notes and draft storage
- src/styles.css: appearance
- index.html: entry point

## Conventions
Use the existing storage module for persistence. Preserve the DOM data-testid attributes because browser tests use them. Keep user text as text, not interpreted HTML. Preserve existing notes and the current appearance. No dependencies are needed.

## Verification
Use run_checks for actual browser acceptance checks. Inspect the returned failures, then rerun after editing. The protected checks are outside this repository. A passing result belongs only to the source revision it tested.

## Completion
A draft survives navigation and page refresh. Saving creates exactly one note, clears the draft, and preserves other notes. Distinct notes stay distinct. Explain the change and its verification in the final summary.
