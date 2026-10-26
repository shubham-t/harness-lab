'use strict';
import { COMPONENTS, anatomyState } from './anatomy.mjs';
import { outcome, comparableRuns, preset } from './lesson.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stringify = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const iconPaths = {
  layout:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M9 9h12"/>',
  chart:'<path d="M4 3v17h17M8 15v-4M13 15V7M18 15V4"/>',
  book:'<path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',
  chevronRight:'<path d="m9 5 7 7-7 7"/>',
  sliders:'<path d="M4 6h6m4 0h6M4 12h11m4 0h1M4 18h2m4 0h10"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  key:'<circle cx="8" cy="8" r="4"/><path d="m11 11 9 9m-3-3 3-3m-6 0 3-3"/>',
  arrowRight:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  arrowDown:'<path d="M12 4v16m-6-6 6 6 6-6"/>',
  maximize:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  minimize:'<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
  arrowUpRight:'<path d="M6 18 18 6M6 6h12v12"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 8a7 7 0 0 1 12-3l3 3M4 16l3 3a7 7 0 0 0 12-3"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  terminal:'<path d="m6 8 4 4-4 4m7 0h5"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  code:'<path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  play:'<path d="m8 4 12 8-12 8z"/>',
  pause:'<path d="M8 4v16M16 4v16"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  flask:'<path d="M9 3h6m-5 0v7L4 20c-.3.5 0 1 1 1h14c1 0 1.3-.5 1-1l-6-10V3M7 15h10"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  file:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  error:'<path d="m12 3 10 18H2zM12 9v5m0 3v1"/>',
  dot:'<circle cx="12" cy="12" r="3"/>',
  folder:'<path d="M3 6h7l2 3h9v12H3zM3 6V3h7l2 3h6v3"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.info}</svg>`;
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = svg(el.dataset.icon); }); }

const concepts = {
  instructions: {name:'Instructions & policies',icon:'file',short:'Project rules for how the agent should work.',description:'Project instructions ask the model to preserve existing notes, user text and appearance, and use the existing storage module. Supplying instructions does not prove compliance; inspect the diff and tests.',example:'Open a Project rules included in request event to see the actual policies supplied. The repository map is supplied separately by Context management.'},
  context: {name:'Context management',icon:'folder',short:'Repository information for the current task.',description:'Context management supplies the project map, accessible file sizes and current revision. Basic task text and conversation remain available in both presets.',example:'Open a Project context included in request event to see the actual map and revision sent to the model.'},
  memory: {name:'Memory & state',icon:'layers',short:'Carry recorded work into a fresh model session.',description:'A fresh session starts a new conversation with the model. Durable memory can carry forward an explicit record of progress, findings and next steps. It is useful only when that record exists and is accurate.',example:'Pause a run, inspect the Memory tab, then choose New session. Compare the recorded handoff with the context loaded into the next session.'},
  verification: {name:'Verification',icon:'checkCircle',short:'Require observable behavior from a real browser.',description:'A convincing explanation is not proof that the application works. Verification executes behavioral checks in a browser and records what passed, what failed and which source revision was checked.',example:'Run checks before the fix to observe the failing behavior. After the agent edits the source, rerun the same checks and inspect their evidence.'},
  permissions: {name:'Guardrails · approval',icon:'shield',short:'Require approval before publishing to the isolated copy.',description:'The agent works inside an isolated workspace. The server always enforces its tool boundary. With this feature enabled, completion also waits for explicit human approval before publishing the source to this run’s isolated copy.',example:'When this feature is disabled, the agent can publish automatically to its isolated copy. Test permission boundary sends a harmless, explicitly labelled protected-file probe through the tool gate. Inspect the resulting permission event.'},
};
const statuses = {ready:'Ready to run',running:'Running',pausing:'Pausing',paused:'Paused',interrupted:'Interrupted',awaiting_approval:'Awaiting approval',completed:'Completed',failed:'Failed',budget_exceeded:'Budget reached'};
const scenarios = {draft:{name:'The disappearing draft',purpose:'Tab navigation and draft recovery'},unicode:{name:'Unicode & multiline',purpose:'Emoji, non-Latin text and line breaks'},longform:{name:'Long-form writing',purpose:'Preserving a substantial draft'}};
let appState = null;
let selectedRunId = sessionStorage.getItem('harness-selected-run');
let currentView = ['workbench','evals','guide'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'workbench';
let activePanel = 'activity';
let previewKey = '';
let eventSignature = '';
let memorySignature = '';
let checksSignature = '';
let evalSignature = '';
let evaluationData = null;
let evalInFlight = false;
let evalSourceSignature = '';
let featureSignature = '';
let anatomySignature = '';
let pollInFlight = false;
let initialWorkspaceAttempted = false;
let lastConnectionError = false;
let pendingAction = false;
let focusMode = sessionStorage.getItem('harness-focus-mode') === 'true';
let modalOpener = null;
let modalVersion = 0;
const currentRun = () => (appState?.runs || []).find(run => run.id === selectedRunId) || null;

async function api(path, options = {}) {
  const headers = {'X-Harness-Client':'local', ...(options.body ? {'Content-Type':'application/json'} : {})};
  const response = await fetch(path, {...options, headers:{...headers,...options.headers},body:options.body ? JSON.stringify(options.body) : undefined,cache:'no-store'});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
  return data;
}
function toast(message, error = false) {
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.innerHTML = `${svg(error ? 'error' : 'checkCircle')}<span>${escapeHTML(message)}</span>`;
  $('#toast-region').append(el);
  setTimeout(() => el.remove(), error ? 9000 : 5000);
}
function duration(ms) { if (!Number.isFinite(ms)) return '—'; const sec = Math.max(0, Math.floor(ms / 1000)); return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`; }
function time(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
function date(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Unknown time' : d.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function prettyId(id) { return String(id || '').replace(/^run[-_]?/,'').slice(0,8).toUpperCase(); }
function text(selector, value) { const el = $(selector); if (el) el.textContent = value ?? ''; }
function setButton(selector, label, icon, disabled = false) { const button = $(selector); button.innerHTML = `${svg(icon)}<span>${escapeHTML(label)}</span>`; button.disabled = disabled; }
function chooseRun(id) { selectedRunId = id; sessionStorage.setItem('harness-selected-run', id); eventSignature = memorySignature = checksSignature = featureSignature = ''; render(); }
function selectView(view, scroll = true) {
  currentView = view;
  $$('.view').forEach(el => { el.hidden = el.id !== `view-${view}`; el.classList.toggle('active-view', !el.hidden); });
  $$('.nav-item').forEach(el => { const active = el.dataset.view === view; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  text('#breadcrumb-page',{workbench:'Workbench',evals:'Runs & evals',guide:'Session guide'}[view]);
  applyFocusMode();
  history.replaceState(null,'',`#${view}`);
  if (scroll) window.scrollTo({top:0,behavior:'instant'});
  if (view === 'evals') { renderEvals(); refreshEvals(); }
}
function applyFocusMode() {
  const active = focusMode && currentView === 'workbench';
  document.body.classList.toggle('focus-mode',active);
  document.documentElement.style.setProperty('--focus-phone-scale',String(Math.max(.32,Math.min(.67,(window.innerHeight - 470) / 718))));
  $('#focus-toggle').setAttribute('aria-pressed',String(active));
  $('#focus-toggle').innerHTML = `${svg(active ? 'minimize' : 'maximize')}<span>${active ? 'Exit focus' : 'Focus demo'}</span>`;
  $('#focus-proof-button').hidden = !active;
}
async function refreshState() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    appState = await api('/api/state');
    if (!Array.isArray(appState.runs)) appState.runs = [];
    if (!currentRun() && appState.runs.length) selectedRunId = [...appState.runs].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))[0].id;
    if (lastConnectionError) toast('Local server reconnected.');
    lastConnectionError = false;
    render();
    if (currentView === 'evals') refreshEvals();
    if (!appState.runs.length && !initialWorkspaceAttempted) {
      initialWorkspaceAttempted = true;
      await createWorkspace('engineered',Object.fromEntries(Object.keys(concepts).map(key => [key,true])),'draft',false);
    }
  } catch (error) {
    if (!lastConnectionError) toast(`Cannot reach the local harness: ${error.message}`,true);
    lastConnectionError = true;
    text('#local-status','Server unavailable');
    text('#browser-health','Local server unavailable');
    if (!appState) text('#preview-placeholder','Start the local server to open this workspace.');
  } finally { pollInFlight = false; }
}
async function createWorkspace(mode, features, scenario, notify = true) {
  const result = await api('/api/runs',{method:'POST',body:{mode,features,scenario}});
  const run = result.run || result;
  if (!run.id) throw new Error('The server did not return a workspace id.');
  selectedRunId = run.id;
  sessionStorage.setItem('harness-selected-run',run.id);
  if (appState) appState.runs = [...appState.runs.filter(item => item.id !== run.id),run];
  eventSignature = memorySignature = checksSignature = featureSignature = '';
  render();
  if (notify) toast('Fresh workspace prepared. Reproduce the bug, then run the agent.');
  return run;
}
function render() {
  if (!appState) return;
  const provider = appState.provider || {};
  const connected = !!provider.configured;
  $('#setup-banner').hidden = connected;
  text('#connection-label',connected ? (provider.model || 'Model connected') : 'Connect a model');
  $('.connection-dot').classList.toggle('connected',connected);
  text('#local-status', connected ? 'Model configured' : 'Model setup needed');
  text('#browser-health',appState.browser?.available ? 'Browser checks available' : (appState.browser?.error ? 'Browser unavailable · see setup' : 'Browser checking…'));
  const run = currentRun();
  if (!run) { renderEvals(); return; }
  text('#run-number',`RUN ${prettyId(run.id)}`);
  text('#preset-badge',configurationName(run.features));
  const runStatus = $('#run-state'); runStatus.className = `run-state ${run.status}`; runStatus.innerHTML = `<span></span>${escapeHTML(statuses[run.status] || run.status)}`;
  text('#stat-calls',run.usage?.calls ?? 0);
  text('#stat-elapsed',duration(run.elapsedMs));
  text('#session-number',`Session ${run.session || 1}`);
  text('#task-copy',run.task || 'Fix the draft that disappears when you switch tabs. Preserve the user’s writing and verify the fix.');
  const featureKey = JSON.stringify([run.id,run.features]);
  if (featureSignature !== featureKey) {
    featureSignature = featureKey;
    $('#harness-features').innerHTML = Object.entries(concepts).map(([key,concept]) => `<button class="feature-chip${run.features?.[key] ? '' : ' off'}" data-concept="${key}" title="${escapeHTML(concept.name)} ${run.features?.[key] ? 'enabled' : 'disabled'} — learn more">${svg(run.features?.[key] ? 'checkCircle' : 'dot')}${escapeHTML(concept.name)}</button>`).join('');
  }
  const origin = appState.previewOrigin || 'http://127.0.0.1:4319';
  const nextPreviewKey = `${run.id}:${run.revision ?? 0}`;
  const previewURL = `${origin}/preview/${encodeURIComponent(run.id)}/index.html`;
  if (nextPreviewKey !== previewKey) {
    previewKey = nextPreviewKey;
    $('#preview-placeholder').hidden = false;
    $('#notes-frame').src = `${previewURL}?revision=${encodeURIComponent(run.revision ?? 0)}`;
    $('#open-preview').href = previewURL;
  }
  $('#activity-badge').className = `live-badge ${run.status}`;
  $('#activity-badge').innerHTML = `<span></span>${escapeHTML(({awaiting_approval:'REVIEW',budget_exceeded:'LIMIT',interrupted:'INTERRUPTED'}[run.status] || run.status || 'READY').toUpperCase())}`;
  const events = run.events || [];
  text('#event-count',events.length);
  const nextEventSignature = JSON.stringify([run.id,events]);
  if (nextEventSignature !== eventSignature) {
    eventSignature = nextEventSignature;
    renderEvents(events);
  }
  $('#empty-activity').hidden = events.length > 0;
  $('#honesty-note').innerHTML = `${svg(connected ? 'shield' : 'lock')}${connected ? 'Ready for real execution · no activity has been generated' : 'No API key · real runs locked'}`;
  renderMemory(run);
  renderChecks(run);
  renderAnatomy(run);
  const running = ['running','pausing'].includes(run.status);
  const resumable = ['paused','interrupted','failed'].includes(run.status);
  const awaiting = run.status === 'awaiting_approval';
  if (run.status === 'running') setButton('#run-button','Pause agent','pause',pendingAction);
  else if (run.status === 'pausing') setButton('#run-button','Pausing…','pause',true);
  else if (run.status === 'budget_exceeded') setButton('#run-button','Prepare a new workspace','plus',pendingAction);
  else if (awaiting) setButton('#run-button','Review proposed changes','code',pendingAction);
  else if (run.status === 'completed') setButton('#run-button','Published · inspect diff','checkCircle',pendingAction);
  else if (resumable) setButton('#run-button','Resume agent','play',pendingAction || !connected);
  else setButton('#run-button','Run coding agent','play',pendingAction || !connected);
  $('#run-requirements').hidden = connected || running || awaiting || run.status === 'completed';
  $('#run-button').title = !connected && !running && !awaiting && run.status !== 'completed' ? 'Requires an API key and model ID. Browser checks work without either.' : '';
  $('#keyless-checks').disabled = running || pendingAction || !appState.browser?.available;
  $('#new-session').disabled = !resumable || !connected || pendingAction;
  $('#new-session').title = run.status === 'ready' ? 'Run the agent, then pause to continue in a new session.' : 'Resume with a fresh model conversation and the configured memory.';
  $('#probe-button').disabled = running || pendingAction;
  $('#checks-button').disabled = running || pendingAction || !appState.browser?.available;
  setButton('#checks-button','Evaluate outcome','flask',running || pendingAction || !appState.browser?.available);
  $('#new-workspace').disabled = pendingAction;
  $('#view-diff').disabled = pendingAction;
  $('#export-button').disabled = pendingAction;
  text('#empty-activity p','Reproduce the bug on the left. Then watch a real model use tools to work on the fix.');
  $('#empty-activity .empty-sequence').innerHTML = `<span><i>1</i> Model request</span>${svg('arrowRight')}<span><i>2</i> Tool action</span>${svg('arrowRight')}<span><i>3</i> Observation</span>`;
  const note = run.status === 'awaiting_approval' ? 'Review the diff and current browser checks before you publish.' : run.status === 'running' ? 'Real model calls and tool results appear here as they happen.' : run.status === 'completed' ? (run.features?.permissions ? 'This exact revision was approved and published to its own copy.' : 'The agent published automatically to this run’s isolated copy.') : (run.features?.permissions ? 'Edits stay in this sandbox. You approve publication.' : 'Approval off: the agent may apply its patch to the isolated demo copy.');
  $('#control-note').innerHTML = `${svg('shield')}<span>${escapeHTML(note)}</span>`;
  renderEvals();
}
function renderAnatomy(run) {
  const state = anatomyState(run);
  const signature = JSON.stringify([run.id,state]);
  if (signature === anatomySignature) return;
  anatomySignature = signature;
  text('#anatomy-version',state.legacy ? 'Legacy run · earlier harness behavior' : `Harness v${run.harnessVersion} · click a component for evidence`);
  $('#anatomy-cards').innerHTML = state.cards.map(card => `<button class="anatomy-card ${card.enabled ? 'enabled' : 'limited'} ${card.highlight ? `highlight ${card.state}` : ''}" data-anatomy="${card.id}" aria-label="${escapeHTML(card.name)}: ${escapeHTML(card.badge)}${card.highlight ? '. '+escapeHTML(state.label) : ''}"><span class="anatomy-card-top"><span>${card.number}</span>${svg(card.icon)}<span class="component-mark">${card.enabled ? '✓' : '—'}</span></span><strong>${escapeHTML(card.name)}</strong><span class="anatomy-badge">${escapeHTML(card.badge)}</span>${card.highlight ? `<span class="component-state">${escapeHTML(state.state === 'active' ? 'Active now' : state.state === 'waiting' ? 'Waiting' : state.state === 'blocked' ? 'Blocked' : 'Last action')}</span>` : ''}</button>`).join('');
  $('#anatomy-now').className = `anatomy-now ${state.state}`;
  $('#anatomy-now').innerHTML = `<strong>${escapeHTML(state.label)}</strong><span>${escapeHTML(state.message)}</span>`;
  $('#anatomy-trail').innerHTML = state.trail.length ? `<span>RECENT</span>${state.trail.map(item=>`<button data-event="${item.index}" title="${escapeHTML(item.event.title)}">${escapeHTML(COMPONENTS.find(c=>c.id===item.components[0])?.name || (item.event.kind==='checks'?'Presenter evaluation':'Evidence'))} <span>· ${escapeHTML(item.event.title)}</span></button>`).join('')}` : '<span>Click a component to inspect its role and recorded evidence.</span>';
}
function showAnatomy(id) {
  const run=currentRun(), card=anatomyState(run).cards.find(c=>c.id===id);
  if (!card) return;
  openModal(card.name,'HARNESS ANATOMY',`<p>${escapeHTML(card.description)}</p><div class="concept-example"><strong>THIS WORKSPACE · ${escapeHTML(card.badge)}</strong><p>${escapeHTML(card.note)}</p></div>${card.eventIndex>=0 ? `<div class="dialog-actions"><button class="button button-primary" id="component-evidence">Inspect latest recorded action</button></div>` : '<p class="empty-dialog">No action for this component has been recorded yet.</p>'}`);
  $('#component-evidence')?.addEventListener('click',()=>showEvidence(run.events[card.eventIndex]));
}
function showLesson() {
  const run = currentRun(); if (!run) return;
  const result = outcome(run, appState.checkSuiteVersion);
  const matches = comparableRuns(run, appState.runs);
  const rows = candidate => { const r = outcome(candidate, appState.checkSuiteVersion); return [r.source, statuses[candidate.status] || candidate.status, r.required, r.approval, r.publication, `${candidate.usage?.calls || 0} real model calls`]; };
  openModal('What does this run show?', 'EXPLAIN & COMPARE', `<p class="lesson-lead">${escapeHTML(result.explanation)}</p>${matches.length ? '<details><summary>Explain the selected run</summary>' : ''}<dl class="lesson-results"><div><dt>Does the source pass the checks?</dt><dd>${escapeHTML(result.source)}</dd></div><div><dt>What did completion require?</dt><dd>${escapeHTML(result.required)}</dd></div><div><dt>Was the patch applied?</dt><dd>${escapeHTML(result.publication)}</dd></div></dl>${matches.length ? '</details>' : ''}<p class="lesson-next"><strong>Next:</strong> ${escapeHTML(result.next)}</p><h3>Compare actual runs</h3>${matches.length ? `<label for="compare-run">Other harness · same task, scenario, model, harness version and session count</label><select id="compare-run">${matches.map(r => `<option value="${escapeHTML(r.id)}">${preset(r)} · ${prettyId(r.id)} · ${escapeHTML(statuses[r.status] || r.status)}</option>`).join('')}</select><div id="lesson-comparison"></div><p>Each column is one independent run. This comparison does not establish which component caused the outcome.</p>` : '<p>No matching opposite-preset model run is available yet. Prepare and run the other preset with the same scenario and provider. Unrun workspaces and different models, harness versions or session counts are excluded.</p>'}<p class="lesson-takeaway"><strong>If both fix the bug:</strong> the contrast is still visible in what the harness required before completion and application.</p><div class="dialog-actions"><button class="button button-secondary" id="lesson-refresh">Refresh evidence</button><button class="button button-primary" id="lesson-checks">Show browser evidence</button></div>`);
  function compare() {
    const other = matches.find(r => r.id === $('#compare-run').value), pair = preset(run) === 'Minimal' ? [run, other] : [other, run];
    const values = pair.map(rows), labels = ['Observed checks','Agent status','Completion requirement','Approval requirement','Application','Model requests'];
    $('#lesson-comparison').innerHTML = `<div class="lesson-table-wrap"><table class="lesson-table"><thead><tr><th>Evidence / control</th>${pair.map(r => `<th>${preset(r)} · ${prettyId(r.id)}</th>`).join('')}</tr></thead><tbody>${labels.map((label,i) => `<tr><th>${label}</th>${values.map(v => `<td>${escapeHTML(v[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if (matches.length) { compare(); $('#compare-run').addEventListener('change', compare); }
  $('#lesson-refresh').addEventListener('click', async () => { await refreshState(); showLesson(); });
  $('#lesson-checks').addEventListener('click', () => { closeModal(); $('.verification-card').scrollIntoView({ behavior:'instant', block:'center' }); });
}
function eventIcon(kind) { return {instructions:'file',context:'folder',prompt:'folder',tool:'terminal',tool_result:'terminal',edit:'edit',checks:'checkCircle',verification:'checkCircle',browser:'layout',memory:'layers',permission:'shield',gate:'shield',budget:'clock',model:'sparkles',assistant:'sparkles',run:'play',error:'error',status:'info'}[kind] || 'info'; }
function renderEvents(events) {
  const list = $('#activity-list');
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  const scrollTop = list.scrollTop;
  list.innerHTML = events.map((event,index) => {
    const displayKind=event.title==='Paused at a safe tool boundary'?'run':event.kind;
    return `<button class="event-row" data-event="${index}" aria-label="Inspect evidence: ${escapeHTML(event.title || event.kind)}"><span class="event-icon ${escapeHTML(displayKind)}">${svg(eventIcon(displayKind))}</span><span class="event-body"><span class="event-meta"><strong>${escapeHTML(event.title || event.kind || 'Event')}</strong><time>${escapeHTML(time(event.at))}</time></span>${event.detail ? `<p>${escapeHTML(stringify(event.detail))}</p>` : ''}<span class="event-label">${escapeHTML(displayKind==='run'?'Agent loop':displayKind || 'event')} · inspect evidence</span></span></button>`;
  }).join('');
  if (nearBottom) list.scrollTop = list.scrollHeight; else list.scrollTop = scrollTop;
}
function renderMemory(run) {
  const signature = JSON.stringify([run.id,run.memory,run.checkpoints,run.features?.memory,run.session]);
  if (signature === memorySignature) return;
  memorySignature = signature;
  const checkpoints = Array.isArray(run.checkpoints) ? run.checkpoints : [];
  const memory = run.memory;
  $('#memory-content').innerHTML = `<span class="tiny-label">DURABLE HANDOFF</span><p style="margin-top:10px">${run.features?.memory ? 'A fresh conversation can load this recorded handoff. Inspect the next session’s Saved handoff included in request event to verify exactly what was supplied.' : 'Memory is disabled for this workspace. A new session will not receive a durable handoff through this feature.'}</p>${memory && (typeof memory !== 'object' || Object.keys(memory).length) ? `<div class="memory-block"><pre>${escapeHTML(stringify(memory))}</pre></div>` : '<div class="memory-block"><p>No model-written note has been saved. Observed checkpoints below are saved independently.</p></div>'}${run.sessionHandoff ? `<h3 class="memory-section-title">Handoff supplied to session ${run.session}</h3><pre class="evidence-readable">${escapeHTML(JSON.stringify(run.sessionHandoff,null,2))}</pre>` : ''}<h3 class="memory-section-title">Observed checkpoints · ${checkpoints.length}</h3>${checkpoints.length ? checkpoints.map((checkpoint,index) => `<div class="checkpoint"><strong>${escapeHTML(checkpoint.title || `Checkpoint ${index+1}`)}</strong><p>${escapeHTML(stringify(checkpoint))}</p></div>`).join('') : '<p>No checkpoints yet. This list will contain only recorded run data.</p>'}`;
}
function renderChecks(run) {
  const signature = JSON.stringify([run.id,run.checks,run.revision,run.pendingRevision,run.status,run.features?.verification,pendingAction,appState.checkNames,appState.checkSuiteVersion]);
  if (signature === checksSignature) return;
  checksSignature = signature;
  const checks = run.checks;
  const results = checks?.results || [];
  const allNames = results.length ? results.map(result => result.name) : (appState.checkNames || []).map(item => typeof item === 'string' ? item : item.name);
  const suiteVersion = checks?.suiteVersion || 'notes-v1';
  const currentSuite = checks && suiteVersion === appState.checkSuiteVersion;
  const currentRevision = checks && String(checks.revision) === String(run.revision);
  const current = currentSuite && currentRevision;
  const staleReason = !currentSuite ? 'older test suite' : 'earlier revision';
  const allPass = checks && checks.total > 0 && checks.passed === checks.total;
  const summary = $('#checks-summary');
  summary.className = `checks-summary ${checks ? (!current ? 'stale' : allPass ? 'pass' : 'fail') : ''}`;
  summary.textContent = checks ? `${checks.passed}/${checks.total} passed${current ? '' : ` · ${staleReason}`}` : 'Not run yet';
  $('#check-grid').innerHTML = allNames.length ? allNames.map((name,index) => {
    const result = results[index];
    return `<button class="check-item ${result ? (!current ? 'stale' : result.passed ? 'pass' : 'fail') : ''}" data-check="${index}" ${result ? '' : 'disabled'} title="${escapeHTML(result?.detail || name)}"><span>${svg(result ? (!current ? 'clock' : result.passed ? 'check' : 'close') : 'dot')}</span><span style="min-width:0"><strong>${escapeHTML(name)}</strong><small>${result ? `${!current ? `${escapeHTML(staleReason)} · ` : ''}${result.passed ? 'Passed' : 'Failed'}${Number.isFinite(result.durationMs) ? ` · ${result.durationMs} ms` : ''}` : 'Not run'}</small></span></button>`;
  }).join('') : '<p class="empty-dialog">The browser suite will appear when the local server reports it.</p>';
  text('#verification-note',checks ? `${checks.origin === 'presenter' ? 'Presenter evaluation · ' : 'Agent verification · '}${suiteVersion} · ${currentRevision ? 'Current' : 'Earlier'} revision · checked ${date(checks.at)}. ${!currentSuite ? `Rerun checks with ${appState.checkSuiteVersion} before treating this evidence as current. ` : ''}Select a check to inspect its evidence.` : run.features.verification ? 'The agent must pass these checks before completion. You can also evaluate independently.' : 'Not evaluated. These presenter checks are outside the agent workflow; completion does not require them.');
  $('#approve-button').hidden = run.status !== 'awaiting_approval';
  const approvalBlocked = run.features?.verification && (!allPass || !current);
  $('#approve-button').disabled = !!approvalBlocked || pendingAction;
  $('#approve-button').title = approvalBlocked ? `Passing ${appState.checkSuiteVersion} browser checks are required for the current revision.` : 'Apply the exact proposed revision to the isolated demo copy.';
}
async function refreshEvals() {
  if (!appState || evalInFlight) return;
  const sourceSignature = JSON.stringify([appState.checkSuiteVersion,appState.runs.map(run => [run.id,run.status,run.usage,run.checks,run.revision,run.elapsedMs,run.appliedRevision])]);
  if (sourceSignature === evalSourceSignature) return;
  evalInFlight = true;
  try { evaluationData = await api('/api/evals'); evalSourceSignature = sourceSignature; evalSignature = ''; renderEvals(); }
  catch(error) { toast(`Evaluation summary unavailable: ${error.message}`,true); }
  finally { evalInFlight = false; }
}
function configurationName(features) {
  const enabled = Object.keys(concepts).filter(key => features?.[key]);
  return enabled.length === 5 ? 'Engineered harness' : !enabled.length ? 'Minimal harness' : 'Custom harness';
}
function renderEvals() {
  if (!appState) return;
  const runs = [...(appState.runs || [])].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const signature = JSON.stringify([appState.checkSuiteVersion,evaluationData,runs.map(run => [run.id,run.status,run.usage,run.checks,run.revision,run.endedAt,run.appliedRevision])]);
  if (signature === evalSignature) return;
  evalSignature = signature;
  const groups = evaluationData?.groups || [];
  const count = evaluationData?.count ?? 0;
  const passing = groups.reduce((sum,group) => sum + group.verified,0);
  const published = runs.filter(run => run.status === 'completed' && run.appliedRevision != null && run.features?.permissions);
  $('#eval-summary').innerHTML = `<div class="eval-stat"><span class="tiny-label">ASSESSED AGENT RUNS</span><div class="eval-stat-value">${evaluationData ? count : '—'}</div><p>Actual model runs in a final or review state</p></div><div class="eval-stat"><span class="tiny-label">VERIFIED AGENT RUNS</span><div class="eval-stat-value">${count ? `${passing} / ${count}` : '—'}</div><p>${count ? `All ${escapeHTML(appState.checkSuiteVersion)} checks passed on the current source revision` : 'No completed agent outcomes measured yet'}</p></div><div class="eval-stat"><span class="tiny-label">APPROVED CHANGES</span><div class="eval-stat-value">${published.length}</div><p>Exact revisions explicitly approved for publication</p></div>`;
  $('#eval-matrix-body').innerHTML = groups.length ? groups.map(group => {
    const run = runs.find(item => group.runIds?.includes(item.id));
    const enabled = Object.entries(concepts).filter(([key]) => group.features?.[key]).map(([,concept]) => concept.name);
    const provider = run?.provider || {};
    const currentSuite = group.suiteVersion === appState.checkSuiteVersion;
    const resultNote = currentSuite ? `${group.failed} failed or budget-limited · inspect a run` : `${group.recordedPasses || 0} / ${group.trials} passed historical checks · rerun required`;
    return `<tr><td>${escapeHTML(configurationName(group.features))}<div class="configuration-list">${escapeHTML(enabled.length ? enabled.join(' · ') : 'All five optional features disabled')}</div></td><td>${escapeHTML(scenarios[group.scenario]?.name || group.scenario)}<div class="configuration-list">Harness v${escapeHTML(group.harnessVersion || 1)} · Check suite: ${escapeHTML(group.suiteVersion)}${currentSuite ? '' : ' · not current verification'}</div></td><td><button class="matrix-result ${group.verified === group.trials ? '' : 'fail'}" ${run ? `data-open-run="${escapeHTML(run.id)}"` : ''}><strong>${group.verified} / ${group.trials}</strong><small>${escapeHTML(resultNote)}</small></button></td><td><span class="provider-name">${escapeHTML(group.model || provider.model || 'Unreported')}</span><div class="configuration-list">${escapeHTML(provider.baseUrl || 'Provider unreported')}<br>${escapeHTML(provider.protocol || '')}</div></td></tr>`;
  }).join('') : '<tr><td colspan="4"><span class="unmeasured">— No agent outcomes measured yet. Run a coding agent to collect evidence. Preparing a workspace or checking the original bug does not count as an agent evaluation.</span></td></tr>';
  if (evaluationData?.note) text('#eval-note',evaluationData.note);
  text('#history-count',`${runs.length} workspace${runs.length === 1 ? '' : 's'}`);
  $('#run-history-list').innerHTML = runs.length ? runs.map(run => `<button class="history-row" data-open-run="${escapeHTML(run.id)}"><span class="event-icon">${svg(run.status === 'completed' ? 'checkCircle' : 'terminal')}</span><span class="history-main"><strong>${escapeHTML(configurationName(run.features))} <span style="font-weight:400;color:#a5b098">/ ${escapeHTML(prettyId(run.id))}</span></strong><p>${escapeHTML(scenarios[run.scenario || 'draft']?.name || run.scenario)} · ${escapeHTML(date(run.createdAt))}</p></span><span class="history-meta">${escapeHTML(statuses[run.status] || run.status)}<br>${run.usage?.calls ?? 0} model calls${Number.isFinite(run.elapsedMs) ? ` · ${duration(run.elapsedMs)}` : ''}${run.usage?.unreportedRequests ? '<br>Some token usage unreported' : ''}</span><span class="history-arrow">${svg('chevronRight')}</span></button>`).join('') : '<p class="history-empty">No workspaces yet. Prepare a workspace to reproduce the bug. Agent results appear only after a real model run.</p>';
}
function openModal(title,kicker,body) {
  modalVersion++;
  $('#modal').classList.toggle('lesson-modal', title === 'What does this run show?');
  modalOpener = document.activeElement;
  text('#modal-title',title); text('#modal-kicker',kicker);
  $('#modal-body').innerHTML = body;
  hydrateIcons($('#modal'));
  if (!$('#modal').open) $('#modal').showModal();
  $('#modal').scrollTop = 0;
}
function closeModal() { $('#modal').close(); modalVersion++; if (modalOpener instanceof HTMLElement) modalOpener.focus(); }
function showConcept(key) {
  const concept = concepts[key]; if (!concept) return;
  openModal(concept.name,'INSIDE THE HARNESS',`<div class="concept-icon">${svg(concept.icon)}</div><p>${escapeHTML(concept.description)}</p><div class="concept-example"><strong>IN THIS EXPERIMENT</strong><p>${escapeHTML(concept.example)}</p></div><div class="dialog-actions"><button class="button button-primary" data-close-modal>Back to the experiment</button></div>`);
}
function showSetup() {
  const provider = appState?.provider || {};
  openModal('Connect your model.','LOCAL MODEL CONNECTION',`<p>Use an API endpoint that supports the Responses or Chat Completions protocol. The agent makes real requests only when you test the connection or start a run.</p><form id="setup-form"><div class="form-field"><label for="api-base">API base URL</label><input id="api-base" name="baseUrl" type="url" required spellcheck="false" autocomplete="off" value="${escapeHTML(provider.baseUrl || 'https://api.openai.com/v1')}" placeholder="https://api.openai.com/v1"><span class="field-help">Use the API base URL, including /v1 when required by your provider.</span></div><div class="form-row"><div class="form-field"><label for="api-model">Model identifier</label><input id="api-model" name="model" required spellcheck="false" autocomplete="off" value="${escapeHTML(provider.model || '')}" placeholder="Your model's API name"></div><div class="form-field"><label for="api-protocol">API protocol</label><select id="api-protocol" name="protocol"><option value="responses"${provider.protocol !== 'chat-completions' ? ' selected' : ''}>Responses</option><option value="chat-completions"${provider.protocol === 'chat-completions' ? ' selected' : ''}>Chat Completions</option></select></div></div><div class="form-field"><label for="api-key">API key ${provider.keyPresent ? '· already stored for this server' : ''}</label><input id="api-key" name="apiKey" type="password" spellcheck="false" autocomplete="off" placeholder="${provider.keyPresent ? 'Leave blank to keep the current key' : 'Paste your API key'}"><span class="field-help">Sent only to this local server. Never written to browser storage or displayed in run evidence. Changing endpoints may require a new key.</span></div><div class="dialog-callout">${svg('key')}<span>Save configures the connection. Save &amp; test makes one small, billable model request. A coding run uses additional requests.</span></div><div class="health-line">${svg(appState?.browser?.available ? 'checkCircle' : 'info')}<span><strong>Browser verification</strong><br>${escapeHTML(appState?.browser?.available ? 'Available. You can run real checks without a model API key.' : appState?.browser?.error || 'Browser availability has not been reported yet.')}</span></div><div id="setup-feedback" role="status"></div><div class="dialog-actions"><button type="button" class="button button-secondary" data-close-modal>Cancel</button><button type="submit" class="button button-secondary" name="action" value="save">Save connection</button><button type="submit" class="button button-primary" name="action" value="test">Save &amp; test ${svg('arrowRight')}</button></div></form>`);
  $('#setup-form').addEventListener('submit',async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    values.baseUrl = values.baseUrl.trim(); values.model = values.model.trim(); values.apiKey = values.apiKey.trim();
    const test = event.submitter?.value === 'test';
    const version = modalVersion;
    $$('button',form).forEach(button => button.disabled = true);
    $('#setup-feedback').innerHTML = `<div class="form-feedback">${test ? 'Saving connection and making a real model request…' : 'Saving connection…'}</div>`;
    try {
      const result = await api('/api/config',{method:'POST',body:values});
      if (appState) appState.provider = result.provider || result;
      if (version === modalVersion) $('#api-key').value = '';
      if (test) {
        const tested = await api('/api/config/test',{method:'POST',body:{}});
        if (tested.ok === false || tested.success === false) throw new Error(tested.error || tested.message || 'The model test failed.');
        if (version === modalVersion) $('#setup-feedback').innerHTML = `<div class="form-feedback">${escapeHTML(tested.message || 'The configured endpoint returned a real response.')}${tested.response || tested.text ? ` ${escapeHTML(String(tested.response || tested.text).slice(0,400))}` : ''}</div>`;
        toast('Model connection verified. You can start a real agent run.');
      } else if (version === modalVersion) $('#setup-feedback').innerHTML = '<div class="form-feedback">Connection saved. The model has not been called.</div>';
      render();
    } catch (error) {
      if (version === modalVersion) $('#setup-feedback').innerHTML = `<div class="form-feedback error">${escapeHTML(error.message)}</div>`;
    } finally {
      if (version === modalVersion) $$('button',form).forEach(button => button.disabled = false);
      await refreshState();
    }
  });
}
function showNewWorkspace() {
  let mode = 'engineered';
  openModal('Prepare an experiment.','A FRESH, ISOLATED WORKSPACE',`<p>Every workspace begins with the original bug. Choose what surrounds the model, then compare what actually happens. Existing runs remain in the evidence trail.</p><div class="preset-selector" aria-label="Harness preset"><button class="preset-option" type="button" data-preset="minimal" aria-pressed="false"><strong>Minimal</strong><small>The task and basic tools.<br>See what the model does with less.</small></button><button class="preset-option selected" type="button" data-preset="engineered" aria-pressed="true"><strong>Engineered</strong><small>Project support, memory and checks.<br>Require evidence and approval.</small></button></div><form id="workspace-form"><span class="tiny-label">CONFIGURE THE HARNESS</span><div class="feature-options">${Object.entries(concepts).map(([key,concept]) => `<label class="feature-option" for="feature-${key}"><span>${svg(concept.icon)}</span><span><strong>${escapeHTML(concept.name)}</strong><small>${escapeHTML(concept.short)}</small></span><input type="checkbox" id="feature-${key}" name="${key}" checked></label>`).join('')}</div><div class="form-field"><label for="scenario">Evaluation scenario</label><select id="scenario" name="scenario">${Object.entries(scenarios).map(([key,scenario]) => `<option value="${key}">${escapeHTML(scenario.name)}</option>`).join('')}</select><span class="field-help">These are input variants of the same task. Unicode and long-form change the text used in the independent checks.</span></div><div class="dialog-callout">${svg('info')}<span>Preparing a workspace makes no model calls. With the approval gate off, the agent applies changes automatically to its isolated copy. With Verification off, the agent has no acceptance-test tool and completion runs no tests. Evaluate outcome is a separate presenter action. Tool access remains confined to this workspace.</span></div><div id="workspace-feedback" role="status"></div><div class="dialog-actions"><button type="button" class="button button-secondary" data-close-modal>Cancel</button><button type="submit" class="button button-primary">Prepare workspace ${svg('arrowRight')}</button></div></form>`);
  $$('[data-preset]',$('#modal-body')).forEach(button => button.addEventListener('click',() => {
    mode = button.dataset.preset;
    $$('[data-preset]',$('#modal-body')).forEach(option => { option.classList.toggle('selected',option === button); option.setAttribute('aria-pressed',String(option === button)); });
    $$('.feature-option input').forEach(input => input.checked = mode === 'engineered');
  }));
  $('#workspace-form').addEventListener('submit',async event => {
    event.preventDefault();
    const form = event.currentTarget, version = modalVersion;
    const features = Object.fromEntries(Object.keys(concepts).map(key => [key,$(`#feature-${key}`).checked]));
    const scenario = $('#scenario').value;
    $$('button',form).forEach(button => button.disabled = true);
    try { await createWorkspace(mode,features,scenario); if (version === modalVersion) closeModal(); selectView('workbench'); }
    catch(error) { if (version === modalVersion) $('#workspace-feedback').innerHTML = `<div class="form-feedback error">${escapeHTML(error.message)}</div>`; }
    finally { if (version === modalVersion) $$('button',form).forEach(button => button.disabled = false); }
  });
}
function showEvidence(event) {
  if (!event) return;
  const screenshot = screenshotURL(event.screenshot || event.result?.screenshot);
  const meaning = { instructions:'Instructions & policies: rules for how to do the work.', context:'Context management: facts about this project and its current source.', memory:'Memory & state: recorded progress available beyond one conversation.' }[event.kind];
  openModal(event.title || 'Run evidence',`${event.kind || 'RECORDED'} EVENT`,`${meaning ? `<p class="lesson-lead">${meaning}</p>` : ''}${event.detail ? `<pre class="evidence-readable">${escapeHTML(stringify(event.detail))}</pre>` : ''}<div class="evidence-meta"><span>${escapeHTML(date(event.at))}</span><span>Run ${escapeHTML(prettyId(currentRun()?.id))}</span></div>${event.instructions ? `<span class="tiny-label">ACTUAL ASSEMBLED INSTRUCTIONS</span><pre class="evidence-pre">${escapeHTML(stringify(event.instructions))}</pre>` : ''}<details><summary>Full recorded event</summary><pre class="evidence-pre">${escapeHTML(JSON.stringify(event,null,2))}</pre></details>${screenshot ? `<a class="button button-secondary" style="margin-top:17px" href="${escapeHTML(screenshot)}" target="_blank" rel="noopener">${svg('external')}Open recorded screenshot</a><img class="evidence-image" src="${escapeHTML(screenshot)}" alt="Actual browser screenshot recorded with this event" loading="lazy">` : ''}`);
}
function screenshotURL(value) {
  const run = currentRun();
  if (!run || !value) return '';
  const filename = typeof value === 'string' ? value.split(/[\\/]/).pop() : value.filename;
  return filename ? `/api/runs/${encodeURIComponent(run.id)}/screenshots/${encodeURIComponent(filename)}` : '';
}
function showCheck(index) {
  const run = currentRun(), result = run?.checks?.results?.[index]; if (!result) return;
  let screenshot = '';
  if (result.screenshot) {
    const filename = typeof result.screenshot === 'string' ? result.screenshot.split(/[\\/]/).pop() : result.screenshot.filename;
    if (filename) screenshot = `<a class="button button-secondary" style="margin-top:17px" href="/api/runs/${encodeURIComponent(run.id)}/screenshots/${encodeURIComponent(filename)}" target="_blank" rel="noopener">${svg('external')}Open recorded screenshot</a>`;
  }
  openModal(result.name,'REAL BROWSER CHECK',`<div class="evidence-meta"><span>${result.passed ? 'PASSED' : 'FAILED'}</span><span>Suite ${escapeHTML(run.checks.suiteVersion || 'notes-v1')}</span><span>Revision ${escapeHTML(run.checks.revision)}</span><span>${escapeHTML(date(run.checks.at))}</span></div><p>${escapeHTML(result.detail || 'No additional detail reported.')}</p><pre class="evidence-pre">${escapeHTML(JSON.stringify(result,null,2))}</pre>${screenshot}`);
}
async function showDiff() {
  const run = currentRun(); if (!run) return;
  openModal('Inspect the proposed change.','SOURCE BEFORE & AFTER','<p class="empty-dialog">Loading the actual source diff…</p>');
  const version = modalVersion;
  try {
    const result = await api(`/api/runs/${encodeURIComponent(run.id)}/diff`);
    if (version !== modalVersion) return;
    $('#modal-body').innerHTML = result.changes?.length ? `<p class="dialog-description">Actual source snapshots for run ${escapeHTML(prettyId(run.id))}. ${run.features?.permissions ? 'Publication requires your approval.' : 'Publication is automatic in this configuration.'} ${run.features?.verification ? 'Passing checks on the current revision are required.' : 'Failed checks do not block publication.'}</p>${result.changes.map(change => `<section class="diff-file"><h3>${escapeHTML(change.file)}</h3><div class="diff-panels"><div class="diff-panel before"><span>BEFORE</span><pre>${escapeHTML(change.before)}</pre></div><div class="diff-panel"><span>AFTER</span><pre>${escapeHTML(change.after)}</pre></div></div></section>`).join('')}` : '<p class="empty-dialog">No source changes have been recorded in this workspace.</p>';
  } catch(error) { if (version === modalVersion) $('#modal-body').innerHTML = `<p class="empty-dialog danger-label">${escapeHTML(error.message)}</p>`; }
}
function showRunDetails() {
  const run = currentRun(); if (!run) return;
  const unknown = run.usage?.unreportedRequests || 0;
  const tokenValue = value => unknown ? `${value ?? 0} reported + unknown usage` : value ?? 0;
  const rows = [['Harness version',run.harnessVersion || 1],['Task',run.task],['Run ID',run.id],['Status',statuses[run.status] || run.status],['Created',date(run.createdAt)],['Model',run.provider?.model || appState.provider?.model || 'Not configured'],['Source revision',run.revision ?? 0],['Model session',run.session || 1],['Input tokens',tokenValue(run.usage?.input)],['Output tokens',tokenValue(run.usage?.output)]];
  openModal('A traceable experiment.','RUN DETAILS',`<dl class="run-details-grid">${rows.map(([key,value]) => `<div><dt>${escapeHTML(key)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl><p>Model calls count attempted requests. Token counts include only usage reported by the provider.${unknown ? ` Usage was not reported for ${unknown} request${unknown === 1 ? '' : 's'}; total tokens and cost are unknown.` : ''} Every activity item contains recorded input or results. Export the evidence to inspect it outside the workbench.</p>${run.summary ? `<div class="memory-block"><pre>${escapeHTML(stringify(run.summary))}</pre></div>` : ''}<div class="dialog-actions"><button class="button button-secondary" id="dialog-export">${svg('download')}Export evidence</button><button class="button button-primary" data-close-modal>Done</button></div>`);
  $('#dialog-export').addEventListener('click',exportEvidence);
}
async function runAction(action, body = {}, success = '') {
  const run = currentRun(); if (!run || pendingAction) return;
  pendingAction = true; render();
  try {
    await api(`/api/runs/${encodeURIComponent(run.id)}/${action}`,{method:'POST',body});
    if (success) toast(success);
    await refreshState();
  } catch(error) { toast(error.message,true); }
  finally { pendingAction = false; checksSignature = ''; render(); }
}
function showNewSession() {
  const run = currentRun(); if (!run) return;
  openModal('Continue with a fresh session.','CONTEXT & MEMORY',`<p>A new session starts a fresh model conversation for this same workspace. Source files stay in place. ${run.features?.memory ? 'The harness will create a compact handoff from ${run.checkpoints?.length || 0} saved tool observations and any model-written note. It will keep that handoff fixed throughout the next session.' : 'Memory is disabled; no durable handoff will be supplied by that feature.'}</p><div class="memory-block"><pre>${escapeHTML(run.memory ? stringify(run.memory) : 'No model-written note exists. Saved tool observations can still form a handoff when memory is enabled.')}</pre></div><div class="dialog-callout">${svg('info')}<span>This action resumes real agent execution and makes model requests. Inspect the next assembled-instructions or saved-handoff event to see exactly what the new session received.</span></div><div class="dialog-actions"><button class="button button-secondary" data-close-modal>Cancel</button><button class="button button-primary" id="confirm-session">Start new session ${svg('arrowRight')}</button></div>`);
  $('#confirm-session').addEventListener('click',async () => { closeModal(); await runAction('resume',{},'Fresh model session requested.'); });
}
function showApprove() {
  const run = currentRun(); if (!run) return;
  openModal('Apply this proposed revision?','EXPLICIT HUMAN APPROVAL',`<p>Approve revision <strong>${escapeHTML(run.pendingRevision)}</strong> from run <strong>${escapeHTML(prettyId(run.id))}</strong>. The server confirms the source still matches the proposal${run.features?.verification ? ' and passing browser results' : ''}, then copies it into this run’s isolated demo directory.</p><div class="dialog-callout">${svg(run.features?.verification ? 'checkCircle' : 'info')}<span>${run.checks ? `${run.checks.passed}/${run.checks.total} browser checks passed.` : 'No browser evaluation recorded.'} ${run.features?.verification ? 'Review the diff before you approve.' : 'Verification enforcement is disabled: approval can apply a failing patch. This does not mark the checks as passing.'}</span></div><div class="dialog-actions"><button class="button button-secondary" id="approve-diff">Inspect diff</button><button class="button button-primary" id="confirm-approve">${svg('check')}Approve &amp; publish</button></div>`);
  $('#approve-diff').addEventListener('click',showDiff);
  $('#confirm-approve').addEventListener('click',async () => { closeModal(); await runAction('approve',{},'Approved revision applied to the isolated demo copy.'); if (currentRun()?.status === 'completed') showPublished(); });
}
function showPublished() {
  const run = currentRun(); if (!run) return;
  const url = `${appState.previewOrigin || 'http://127.0.0.1:4319'}/published/${encodeURIComponent(run.id)}/index.html`;
  const currentChecks = run.checks?.suiteVersion === appState.checkSuiteVersion && run.checks?.revision === run.revision && run.checks?.passed === run.checks?.total && run.checks?.total > 0;
  const verificationNote = !run.features?.verification ? 'Agent verification was disabled. Use Evaluate outcome to measure this patch independently; publication does not establish correctness.' : currentChecks ? 'The current revision passed the required browser checks.' : `Publication is historical. Rerun ${appState.checkSuiteVersion} checks before treating its recorded evidence as current verification.`;
  openModal('Inspect the applied change.',run.features?.permissions ? 'APPROVED & APPLIED LOCALLY' : 'AUTOMATICALLY APPLIED LOCALLY',`<p>The server copied this run’s source into its isolated demo directory. ${escapeHTML(verificationNote)} Open the app to try the result, or inspect the source diff and exported evidence.</p><div class="dialog-actions"><button class="button button-secondary" id="published-diff">${svg('code')}Inspect diff</button><a class="button button-primary" href="${escapeHTML(url)}" target="_blank" rel="noopener">Open published app ${svg('external')}</a></div>`);
  $('#published-diff').addEventListener('click',showDiff);
}
async function exportEvidence() {
  const run = currentRun(); if (!run) return;
  try {
    const data = await api(`/api/runs/${encodeURIComponent(run.id)}/export`);
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `harness-run-${run.id}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
    toast('Recorded evidence exported.');
  } catch(error) { toast(error.message,true); }
}
const guideSteps = [
  ['CONCEPTS','00–25 min','What surrounds the model?','Use the workshop slides to explain the loop, tools, instructions, context, memory, guardrails and verification. The next five steps occupy the 20-minute live segment.','The model proposes actions. Runtime code executes and checks them.'],
  ['REPRODUCE','25–27 min','The disappearing draft','Type a draft, switch to My notes and return. The text disappears. Explain that the fix must preserve saving and existing notes too.','Ask: how would we know the repair works?'],
  ['MINIMAL','27–32 min','Two enabled components','Prepare a fresh Minimal workspace and run it. Point to Agent loop and Tools & sandbox. After it stops, Evaluate outcome. Use Explain & compare to separate source checks, completion requirements and application.','If it succeeds: the model solved this one, but the harness required no acceptance evidence.'],
  ['ENGINEERED INPUTS','32–37 min','Rules and project facts','Run a fresh Engineered workspace. Open Instructions & policies: preserve existing notes and user text. Open Context management: storage.js and the current revision. Click actual recorded inputs.','Rules describe how to work. Context describes this project.'],
  ['VERIFICATION & APPROVAL','37–42 min','Evidence before application','Show the actual browser results. Engineered requires passing checks before completion. Review the diff, then approve the isolated copy and test it. If the run fails or reaches a budget, keep that result visible.','Approval is a separate decision from passing tests.'],
  ['COMPARISON','42–45 min','Compare the recorded outcomes','Use Explain & compare to select the opposite-preset run. Show measured checks, required controls and application side by side. Do not infer reliability from one pair.','Both can solve the bug. Their enforced completion conditions differ.'],
  ['OPTIONAL MEMORY','Use spare time','What survives a fresh conversation?','Pause a separate run after an edit. Open Memory and start a new session. Files survive both presets; Engineered supplies saved progress. Inspect the exact handoff. If provider latency leaves no time, use labeled rehearsal screenshots.','Restoring progress does not guarantee completion.'],
  ['DISCUSSION','45–60 min','Bring this back to our apps','Discuss one recurring failure in the team’s bug-fixing work. Identify the missing information, tool, check or approval and how you would evaluate it. Reserve time for questions and provider delays.','Change one control and measure representative tasks.'],
];
function renderGuide() {
  $('#guide-steps').innerHTML = guideSteps.map(([label,minutes,title,body,prompt],index) => `<article class="guide-step"><span class="guide-step-num">${String(index+1).padStart(2,'0')}</span><div class="guide-step-body"><div class="guide-step-meta"><span class="tiny-label">${escapeHTML(label)}</span><span class="guide-step-time">${escapeHTML(minutes)}</span></div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(body)}</p><p class="guide-prompt">${escapeHTML(prompt)}</p></div></article>`).join('');
}
function bindEvents() {
  $('#explain-run').addEventListener('click',showLesson);
  $('#focus-toggle').addEventListener('click',() => { if (currentView !== 'workbench') selectView('workbench'); focusMode = !focusMode; sessionStorage.setItem('harness-focus-mode',String(focusMode)); applyFocusMode(); window.scrollTo({top:0,behavior:'instant'}); });
  $('#focus-proof-button').addEventListener('click',() => $('.verification-card').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'center'}));
  window.addEventListener('resize',applyFocusMode);
  document.addEventListener('keydown',event => { if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey && !$('#modal').open && !event.target.closest('input,textarea,select,[contenteditable="true"]')) { event.preventDefault(); $('#focus-toggle').click(); } });
  $$('.nav-item').forEach(button => button.addEventListener('click',() => selectView(button.dataset.view)));
  ['#setup-button','#sidebar-setup','#banner-connect','#connect-run-model'].forEach(selector => $(selector).addEventListener('click',showSetup));
  $('#keyless-checks').addEventListener('click',async () => { $('.verification-card').scrollIntoView({behavior:'instant',block:'center'}); await runAction('checks',{},'Real browser checks finished. No model calls were made.'); });
  ['#new-workspace','#eval-new-run'].forEach(selector => $(selector).addEventListener('click',showNewWorkspace));
  $('#modal-close').addEventListener('click',closeModal);
  $('#modal').addEventListener('click',event => { if (event.target === $('#modal')) { const rect = $('#modal').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); } });
  $('#modal').addEventListener('cancel',event => { event.preventDefault(); closeModal(); });
  document.addEventListener('click',event => {
    if (event.target.closest('[data-close-modal]')) closeModal();
    const concept = event.target.closest('[data-concept]'); if (concept) showConcept(concept.dataset.concept);
    const component = event.target.closest('[data-anatomy]'); if (component) showAnatomy(component.dataset.anatomy);
    const evidence = event.target.closest('[data-event]'); if (evidence) showEvidence(currentRun()?.events?.[Number(evidence.dataset.event)]);
    const check = event.target.closest('[data-check]'); if (check && !check.disabled) showCheck(Number(check.dataset.check));
    const run = event.target.closest('[data-open-run]'); if (run) { chooseRun(run.dataset.openRun); selectView('workbench'); }
  });
  $$('.tab[data-panel]').forEach(tab => tab.addEventListener('click',() => {
    activePanel = tab.dataset.panel;
    $$('.tab[data-panel]').forEach(item => { const selected = item === tab; item.classList.toggle('active',selected); item.setAttribute('aria-selected',String(selected)); });
    $('#activity-content').hidden = activePanel !== 'activity'; $('#memory-content').hidden = activePanel !== 'memory';
  }));
  $('#notes-frame').addEventListener('load',() => { if ($('#notes-frame').src !== 'about:blank') $('#preview-placeholder').hidden = true; });
  $('#refresh-preview').addEventListener('click',() => { const run = currentRun(); if (!run) return; $('#preview-placeholder').hidden = false; const url = new URL($('#notes-frame').src); url.searchParams.set('refresh',String(Date.now())); $('#notes-frame').src = url.href; toast('Preview refreshed.'); });
  $('#run-button').addEventListener('click',async () => {
    const run = currentRun(); if (!run) return;
    if (run.status === 'running') return runAction('pause',{},'Pause requested. The current operation may finish first.');
    if (run.status === 'awaiting_approval') return showDiff();
    if (run.status === 'completed') return showPublished();
    if (run.status === 'budget_exceeded') return showNewWorkspace();
    if (!appState.provider?.configured) return showSetup();
    if (['paused','interrupted','failed'].includes(run.status)) return runAction('resume');
    return runAction('start');
  });
  $('#new-session').addEventListener('click',showNewSession);
  $('#view-diff').addEventListener('click',showDiff);
  $('#run-details').addEventListener('click',showRunDetails);
  $('#checks-button').addEventListener('click',() => runAction('checks',{},'Browser checks finished. Inspect the recorded results below.'));
  $('#probe-button').addEventListener('click',() => runAction('probe',{},'Permission probe recorded. Inspect the permission event.'));
  $('#approve-button').addEventListener('click',showApprove);
  $('#export-button').addEventListener('click',exportEvidence);
  $('#guide-shortcut').addEventListener('click',() => selectView('guide'));
  $('#back-to-workbench').addEventListener('click',() => selectView('workbench'));
  window.addEventListener('hashchange',() => { const view = location.hash.slice(1); if (['workbench','evals','guide'].includes(view)) selectView(view); });
}
hydrateIcons();
renderGuide();
bindEvents();
selectView(currentView,false);
refreshState();
setInterval(refreshState,1000);
