'use strict';
// This sheet must be shared as Anyone with the link: Viewer.
const SHEET_ID = '1cz4AIOPt9hX4tljThkxCWzfNwv1LPP5CkxMKavsZO8c';
const SHEET_GID = '0'; // Set this to the tab's gid if tours are on another tab.
const endpoint = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${SHEET_GID}&headers=1&tqx=out:json`;
const messages = document.querySelector('#messages');
const statusEl = document.querySelector('#status');
const input = document.querySelector('#question');
let busy = false;
let previousMatches = [];
let sourceLabel = 'live sheet';
function field(row, key) { return row.find(c => c.header.toLowerCase() === key)?.value ?? ''; }
function numeric(row, key) { const value = field(row, key).replace(/[^0-9.-]/g, ''); return value === '' ? NaN : Number(value); }
function addMessage(text, type = '') {
  const el = document.createElement('div');
  el.className = `message ${type}`;
  el.textContent = text; // Sheet contents and questions are always rendered as text.
  messages.append(el);
  messages.scrollTop = messages.scrollHeight;
}
function normalize(text) { return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9€£]+/g, ' ').trim(); }
function rowIdentity(row) { return row.find(c => c.value.trim())?.value || ''; }
function parseSheet(raw) {
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Unexpected sheet response.');
  const data = JSON.parse(raw.slice(start, end + 1));
  if (data.status === 'error' || !data.table) throw new Error('The sheet could not be read.');
  const headers = data.table.cols.map((c, i) => c.label?.trim() || `Column ${i + 1}`);
  const rows = data.table.rows.map(r => headers.map((header, i) => ({header, value: String(r.c?.[i]?.f ?? r.c?.[i]?.v ?? '')}))).filter(r => r.some(c => c.value.trim()));
  return rows;
}
async function loadLiveTours() {
  statusEl.textContent = 'Checking the latest tour details…';
  const response = await fetch(`${endpoint}&_=${Date.now()}`, {cache:'no-store', signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Sheet returned HTTP ${response.status}.`);
  const rows = parseSheet(await response.text());
  if (!rows.length) throw new Error('The tour sheet has no tour rows.');
  statusEl.textContent = `Tour details updated ${new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;
  return rows;
}
async function loadTours() {
  try { const rows = await loadLiveTours(); sourceLabel = 'live sheet'; return rows; }
  catch (error) {
    if (!globalThis.TOUR_SNAPSHOT) throw error;
    sourceLabel = `saved snapshot (${TOUR_SNAPSHOT.captured}) — live sheet unavailable`;
    statusEl.textContent = `Saved tour details · Not live`;
    return TOUR_SNAPSHOT.rows.map(row => TOUR_SNAPSHOT.headers.map((header, i) => ({header, value:String(row[i] ?? '')})));
  }
}
async function ask(question) {
  if (busy || !question.trim()) return;
  busy = true;
  document.querySelector('#send').disabled = true;
  addMessage(question, 'user');
  input.value = '';
  try { addMessage(answer(question, await loadTours())); }
  catch (e) {
    statusEl.textContent = 'Live updates unavailable';
    addMessage('I can’t check the tour sheet right now, so I can’t confirm prices or availability. Please try again shortly.', 'error');
    console.error('Tour data lookup failed:', e.message);
  } finally { busy = false; document.querySelector('#send').disabled = false; input.focus(); }
}
document.querySelector('#chat-form').addEventListener('submit', e => {e.preventDefault(); ask(input.value);});
document.querySelectorAll('.suggestions button').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
document.querySelector('#refresh').addEventListener('click', () => ask('Show all tours'));
addMessage('Welcome to Atlantic Tours! ☘ Let’s find your kind of Irish adventure. Where are you exploring, and would you prefer food, a walk, cycling or time on the water? You can also give me a budget.');
loadTours().catch(() => { statusEl.textContent = 'Tour sheet unavailable · Try again shortly'; });
