const prefix = `pocket-notes:${location.pathname}:`;
const seedNotes = [
  { id: 'welcome-1', title: 'Release checklist', body: 'Check the new onboarding flow.\nVerify dark mode on smaller screens.', date: 'Today' },
  { id: 'welcome-2', title: 'A thought for later', body: 'Small details make software feel considered.', date: 'Yesterday' }
];

export function readNotes() {
  try { return JSON.parse(localStorage.getItem(prefix + 'notes')) ?? seedNotes; }
  catch { return seedNotes; }
}

export function writeNotes(notes) {
  localStorage.setItem(prefix + 'notes', JSON.stringify(notes));
}

export function readDraft() {
  return { title: '', body: '' };
}

export function writeDraft(draft) {
  // Draft storage is not implemented yet.
}

export function clearDraft() {
  // Clear the draft once a note has been saved.
}
