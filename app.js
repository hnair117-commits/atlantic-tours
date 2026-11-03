'use strict';
// This sheet must be shared as Anyone with the link: Viewer.
const SHEET_ID = '1cz4AIOPt9hX4tljThkxCWzfNwv1LPP5CkxMKavsZO8c';
const SHEET_GID = '0'; // Set this to the tab's gid if tours are on another tab.
const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`;
const endpoint = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${SHEET_GID}&headers=1&tqx=out:json`;
const messages = document.querySelector('#messages');
const statusEl = document.querySelector('#status');
const input = document.querySelector('#question');
document.querySelector('#sheet-link').href = sheetUrl;
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
  statusEl.textContent = 'Checking the live tour sheet…';
  const response = await fetch(`${endpoint}&_=${Date.now()}`, {cache:'no-store', signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Sheet returned HTTP ${response.status}.`);
  const rows = parseSheet(await response.text());
  if (!rows.length) throw new Error('The tour sheet has no tour rows.');
  statusEl.textContent = `Sheet checked ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · ${rows.length} records`;
  return rows;
}
async function loadTours() {
  try { const rows = await loadLiveTours(); sourceLabel = 'live sheet'; return rows; }
  catch (error) {
    if (!globalThis.TOUR_SNAPSHOT) throw error;
    sourceLabel = `saved snapshot (${TOUR_SNAPSHOT.captured}) — live sheet unavailable`;
    statusEl.textContent = `Snapshot ${TOUR_SNAPSHOT.captured} · Not live`;
    return TOUR_SNAPSHOT.rows.map(row => TOUR_SNAPSHOT.headers.map((header, i) => ({header, value:String(row[i] ?? '')})));
  }
}
const stopWords = new Set('a an the are is do does i we you your me my us our for to of in on at and or with from about please show list all tours tour trip trips available availability price prices cost costs much how what which can tell have any there it its this that details information want would like know cheapest expensive hi hello thanks thank many places seats remaining left'.split(' '));
function answer(question, rows) {
  const q = normalize(question);
  if (/^(hi|hello|hey|thanks|thank you)$/.test(q)) return 'Hello! Ask about a destination, tour prices, dates or available places. Try “Show all tours” to explore the sheet.';
  const commands = new Set('under below less than over above more between euros eur budget cheapest lowest most expensive highest offers offer special deals discounts discount slots week this sold out fully booked only hours hour duration long short shortest longest date dates when departure departures meeting point meet start starts where them these those they their categories category'.split(' '));
  let terms = q.split(' ').filter(t => !stopWords.has(t) && !commands.has(t) && !/^[€£]?\d+$/.test(t) && t !== '€');
  const aliases = {kayaking:'kayak',hikes:'hike',hiking:'hike',biking:'cycling',bike:'cycling',cycles:'cycling',boats:'boat',foods:'food'};
  terms = terms.map(t => aliases[t] || t);
  const followup = /\b(it|that|those|these|them|this)\b/.test(q) && previousMatches.length;
  const candidates = followup ? rows.filter(r => previousMatches.includes(rowIdentity(r))) : rows;
  if (!candidates.length) return 'The previously selected tour is no longer in the sheet. Please search again or choose “Show all tours”.';
  let matches = candidates;
  if (terms.length) {
    const scored = candidates.map(row => ({row, score:terms.reduce((s, term) => s + (normalize(row.map(c => c.value).join(' ')).includes(term) ? 1 : 0), 0)}));
    const best = Math.max(0, ...scored.map(x => x.score));
    if (!best) return 'I couldn’t match that question to the tour sheet. Try a tour name or destination, or choose “Show all tours”. I can look up tour details, prices, dates and availability.';
    matches = scored.filter(x => x.score === best).map(x => x.row);
  }
  const budget = q.match(/\b(under|below|less than|over|above|more than)\s*(?:€|eur |euros )?\s*(\d+)/);
  if (budget) matches = matches.filter(r => /under|below|less/.test(budget[1]) ? numeric(r,'price_eur') < Number(budget[2]) : numeric(r,'price_eur') > Number(budget[2]));
  const range = q.match(/\bbetween\s*(?:€\s*)?(\d+)\s+and\s*(?:€\s*)?(\d+)/);
  if (range) matches = matches.filter(r => numeric(r,'price_eur') >= Number(range[1]) && numeric(r,'price_eur') <= Number(range[2]));
  if (/\b(offers|offer|deals|discounts)\b/.test(q)) matches = matches.filter(r => field(r,'special_offer').trim());
  if (/\b(available|availability|slots|sold out|fully booked)\b/.test(q) && rows.some(r => field(r,'slots_this_week') !== '')) {
    matches = matches.filter(r => /sold out|fully booked/.test(q) ? numeric(r,'slots_this_week') === 0 : numeric(r,'slots_this_week') > 0);
  }
  const sortKey = /\b(shortest|longest)\b/.test(q) ? 'duration_hours' : 'price_eur';
  if (/\b(cheapest|lowest|expensive|highest|shortest|longest)\b/.test(q)) {
    const valid = matches.filter(r => Number.isFinite(numeric(r,sortKey)));
    const descending = /expensive|highest|longest/.test(q);
    valid.sort((a,b) => descending ? numeric(b,sortKey)-numeric(a,sortKey) : numeric(a,sortKey)-numeric(b,sortKey));
    matches = valid.filter(r => numeric(r,sortKey) === numeric(valid[0] || [],sortKey));
  }
  if (!matches.length) return `No matching tours in the ${sourceLabel}. Try another destination or budget.`;
  previousMatches = matches.map(rowIdentity);
  const price = /\b(price|prices|cost|costs|cheap|cheapest|expensive)\b/.test(q);
  const availability = /\b(available|availability|seats|places|remaining|left)\b/.test(q);
  const dates = /\b(date|dates|when|departure|departures)\b/.test(q);
  const relevant = price ? /price|cost|currency|adult|child/i : availability ? /availab|slots|seat|place|capacity|status|date|departure/i : dates ? /availab|date|departure|time|duration|day/i : null;
  const output = matches.slice(0, 12).map((row, i) => {
    const populated = row.filter(c => c.value.trim());
    const selected = relevant ? populated.filter((c, index) => index < 2 || relevant.test(c.header)) : populated;
    // If headers do not match expected fields, retain all fields instead of guessing.
    const fields = relevant && !populated.some(c => relevant.test(c.header)) ? populated : selected;
    return `${i + 1}. ${fields.map(c => `${c.header.replaceAll('_',' ')}: ${c.header === 'price_eur' ? new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(numeric(row,'price_eur')) : c.value}`).join('\n')}`;
  }).join('\n\n');
  return `Here ${matches.length === 1 ? 'is 1 matching record' : `are ${matches.length} matching records`} from the ${sourceLabel}:\n\n${output}${matches.length > 12 ? '\n\nShowing the first 12. Ask for a destination or tour name to narrow the results.' : ''}\n\nPrices are recorded values. Slots this week and operating season are separate fields; slots do not confirm a specific departure date.${sourceLabel !== 'live sheet' ? ' Snapshot prices, offers and slots may be out of date.' : ''}`;
}
async function ask(question) {
  if (busy || !question.trim()) return;
  busy = true;
  document.querySelector('#send').disabled = true;
  addMessage(question, 'user');
  input.value = '';
  try { addMessage(answer(question, await loadTours())); }
  catch (e) {
    statusEl.textContent = 'Tour sheet unavailable';
    addMessage('I can’t check the tour sheet right now, so I can’t confirm prices or availability. Please try again shortly. The sheet owner should check the sheet link and enable “Anyone with the link — Viewer”.', 'error');
    console.error('Tour data lookup failed:', e.message);
  } finally { busy = false; document.querySelector('#send').disabled = false; input.focus(); }
}
document.querySelector('#chat-form').addEventListener('submit', e => {e.preventDefault(); ask(input.value);});
document.querySelectorAll('.suggestions button').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
document.querySelector('#refresh').addEventListener('click', () => ask('Show all tours'));
addMessage('Welcome to Atlantic Tours! ☘ Ask me about tours around Ireland, prices, dates or availability. I check our Google Sheet each time you ask.');
loadTours().catch(() => { statusEl.textContent = 'Tour sheet unavailable · Try again shortly'; });
