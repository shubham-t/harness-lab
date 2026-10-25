import { readNotes, writeNotes, readDraft, writeDraft, clearDraft } from './storage.js';

let screen = 'editor';
const app = document.querySelector('#app');
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pencil = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>';

function render() {
  const draft = readDraft();
  const notes = readNotes();
  app.innerHTML = `
    <div class="statusbar"><span>9:41</span><div class="status-icons">▮▮▮ <span>◒</span> ▰</div></div>
    <header><div class="brand-icon">${pencil}</div><span>Pocket<span class="brand-light">notes</span></span><span class="avatar">S</span></header>
    <nav aria-label="Notes screens"><button data-testid="editor-tab" class="${screen === 'editor' ? 'active' : ''}">Draft</button><button data-testid="notes-tab" class="${screen === 'notes' ? 'active' : ''}">My notes <span>${notes.length}</span></button></nav>
    ${screen === 'editor' ? `
      <section class="editor"><div class="eyebrow">A LITTLE SPACE TO THINK</div><input data-testid="note-title" aria-label="Note title" placeholder="An untitled thought" maxlength="160" value="${escape(draft.title)}"><div class="date">TODAY <span>•</span> PERSONAL</div><textarea data-testid="note-body" aria-label="Note text" placeholder="What’s on your mind?">${escape(draft.body)}</textarea><div class="editor-bottom"><span id="character-count">${draft.body.length} characters</span><span>Just for you ↗</span></div><button class="save" data-testid="save-note">Save note <span>↗</span></button><div class="hint" role="status" id="hint">Your next good idea starts here.</div></section>` : `
      <section class="notes"><div class="list-heading"><h1>Your little collection.</h1><p>Thoughts worth keeping.</p></div><div data-testid="notes-list">${notes.map((n,i) => `<article class="note-card color-${i%3}" data-testid="note-card"><div class="note-meta">${escape(n.date)}<span>↗</span></div><h2 data-testid="saved-title">${escape(n.title)}</h2><p>${escape(n.body)}</p></article>`).join('')}</div></section>`}
    <footer><span class="footer-dot"></span>A quieter place for your ideas.</footer>`;
  app.querySelector('[data-testid="editor-tab"]').onclick = () => { screen = 'editor'; render(); };
  app.querySelector('[data-testid="notes-tab"]').onclick = () => { screen = 'notes'; render(); };
  if (screen === 'editor') {
    const title = app.querySelector('[data-testid="note-title"]');
    const body = app.querySelector('[data-testid="note-body"]');
    const update = () => { writeDraft({ title: title.value, body: body.value }); app.querySelector('#character-count').textContent = `${body.value.length} characters`; };
    title.oninput = update;
    body.oninput = update;
    app.querySelector('[data-testid="save-note"]').onclick = () => {
      if (!title.value.trim() && !body.value.trim()) { app.querySelector('#hint').textContent = 'Write something before saving.'; return; }
      writeNotes([{ id: crypto.randomUUID(), title: title.value.trim() || 'Untitled note', body: body.value, date: 'Just now' }, ...readNotes()]);
      clearDraft();
      screen = 'notes'; render();
    };
  }
}
render();
