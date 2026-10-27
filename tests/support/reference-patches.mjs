// TEST-ONLY reference patches. They exist solely to prove what the protected
// checks measure. Never copy them into fixtures/, lib/ or a demo run, and never
// present them as model output.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FIXTURE_DIR = path.join(ROOT, 'fixtures/notes');

function replaceOnce(source, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Reference patch expected exactly one match in the fixture for: ${before}`);
  return source.replace(before, () => after);
}
function apply(source, replacements) {
  for (const [before, after] of replacements) source = replaceOnce(source, before, after);
  return source;
}

// A correct fix: the draft gets its own key under the existing path prefix.
// Notes keep their key and shape, so backups and existing users are unaffected.
export function correctStorage(storage) {
  return apply(storage, [
    ["return { title: '', body: '' };", "try { return JSON.parse(localStorage.getItem(prefix + 'draft')) || { title: '', body: '' }; } catch { return { title: '', body: '' }; }"],
    ['// Draft storage is not implemented yet.', "localStorage.setItem(prefix + 'draft', JSON.stringify(draft));"],
    ['// Clear the draft once a note has been saved.', "localStorage.removeItem(prefix + 'draft');"]
  ]);
}

// A plausible wrong fix: the draft is stored as a flagged entry inside the saved
// notes array, and only the visible list filters it out. Every visible check
// passes, but the Backup screen (which reads notes through readNotes) leaks it.
export function draftInNotesStorage(storage) {
  return apply(storage, [
    ["return { title: '', body: '' };", "const entry = readNotes().find(note => note.draft); return entry ? { title: entry.title, body: entry.body } : { title: '', body: '' };"],
    ['// Draft storage is not implemented yet.', "writeNotes([...readNotes().filter(note => !note.draft), { id: 'draft', draft: true, title: draft.title, body: draft.body, date: 'Draft' }]);"],
    ['// Clear the draft once a note has been saved.', 'writeNotes(readNotes().filter(note => !note.draft));']
  ]);
}
export function draftInNotesApp(app) {
  return apply(app, [['const notes = readNotes();', 'const notes = readNotes().filter(note => !note.draft);']]);
}

export async function fixtureSource(name) { return fs.readFile(path.join(FIXTURE_DIR, name), 'utf8'); }

// Writes a reference patch into a run workspace (never into fixtures/).
export async function applyReferencePatch(workspaceDir, kind) {
  if (path.resolve(workspaceDir).startsWith(path.resolve(ROOT, 'fixtures'))) throw new Error('Reference patches must never be written into fixtures/.');
  const storage = await fixtureSource('src/storage.js');
  if (kind === 'correct') {
    await fs.writeFile(path.join(workspaceDir, 'src/storage.js'), correctStorage(storage));
    await fs.writeFile(path.join(workspaceDir, 'src/app.js'), await fixtureSource('src/app.js'));
  } else if (kind === 'draft-in-notes') {
    await fs.writeFile(path.join(workspaceDir, 'src/storage.js'), draftInNotesStorage(storage));
    await fs.writeFile(path.join(workspaceDir, 'src/app.js'), draftInNotesApp(await fixtureSource('src/app.js')));
  } else throw new Error(`Unknown reference patch: ${kind}`);
}
