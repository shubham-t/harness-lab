import { readNotes } from './storage.js';

// Backup JSON, schema version 1. Read by the Backup screen and by the release checker.
export function buildBackup(notes = readNotes()) {
  return JSON.stringify({
    version: 1,
    notes: notes.map(({ id, title, body, date }) => ({ id, title, body, date }))
  }, null, 2);
}
