'use strict';
// SET TIMES FROM A SHEET (STATUS -> TONIGHT -> NIGHTS, DECISIONS #126). Crew code or owner. Paste set times (CSV, or
// cells copied straight out of Sheets / Excel) or a published Google Sheet link, PREVIEW, USE THESE TIMES, UNDO. A
// link is read again every 5 minutes that night. With HARD STOP's lineup tonight, HARD STOP wins: the import hides
// behind one quiet line. Own file; uses app.js globals ($, post, note, unlocked, needUnlock, loadNightsPlan, S).
// Everything from the sheet goes in as text nodes.
const SheetTimes = (() => {
  const box = $('sheetTimes');
  if (!box) return {};
  const st = document.createElement('style');
  st.textContent = `
    #sheetTimes { margin: 8px 0 4px; }
    #sheetTimes details > summary { cursor: pointer; font-weight: 600; letter-spacing: .04em; padding: 6px 0; }
    #sheetTimes .stx-body { display: grid; gap: 10px; padding: 6px 0 4px; }
    #sheetTimes .stx-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    #sheetTimes .stx-tabs button.on { background: var(--fg); color: var(--bg); }
    #sheetTimes textarea, #sheetTimes input[type=url] { width: 100%; box-sizing: border-box; font: inherit; font-size: 14px; }
    #sheetTimes .stx-preview, #sheetTimes .stx-live { border: 1px solid var(--dim); padding: 10px 12px; display: grid; gap: 8px; }
    #sheetTimes table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
    #sheetTimes td { padding: 4px 8px 4px 0; border-top: 1px solid var(--dim); vertical-align: top; overflow-wrap: anywhere; }
    #sheetTimes td.t { white-space: nowrap; width: 1%; }
    #sheetTimes .stx-skip { color: var(--grey); font-size: 13px; display: grid; gap: 2px; }
    #sheetTimes .stx-quiet { color: var(--grey); font-size: 14px; padding: 4px 0; }`;
  document.head.appendChild(st);

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const quiet = el('div', 'stx-quiet', 'Set times come from HARD STOP tonight.');
  quiet.hidden = true;
  const det = el('details');
  det.id = 'go-sheet-times';
  const sum = el('summary', null, 'SET TIMES FROM A SHEET');
  const body = el('div', 'stx-body');
  const intro = el('div', 'note', 'Start, end (optional) and DJ, from a sheet. Paste the cells, or a published Google Sheet link (File → Share → Publish to web → CSV): the box reads it again every 5 minutes that night.');
  const nightRow = el('div', 'row');
  const nightLbl = el('span', 'lbl', 'NIGHT OF');
  const night = el('input'); night.type = 'date'; night.setAttribute('aria-label', 'Night the set times are for');
  nightRow.append(nightLbl, night);
  const tabs = el('div', 'stx-tabs');
  const tPaste = el('button', 'mini on', 'PASTE'); tPaste.type = 'button';
  const tLink = el('button', 'mini', 'SHEET LINK'); tLink.type = 'button';
  tabs.append(tPaste, tLink);
  const paste = el('textarea'); paste.rows = 5; paste.setAttribute('aria-label', 'Set times to paste');
  paste.placeholder = 'START, END, DJ\n22:00, 23:30, TICK\n23:30, 01:00, LIL TICK\n(or copy the cells straight from the sheet)';
  const link = el('input'); link.type = 'url'; link.hidden = true; link.setAttribute('aria-label', 'Published sheet link');
  link.placeholder = 'https://docs.google.com/spreadsheets/d/e/.../pub?output=csv'; link.autocomplete = 'off'; link.maxLength = 2000;
  const go = el('div', 'buttons');
  const pv = el('button', null, 'PREVIEW'); pv.type = 'button';
  go.append(pv);
  const msg = el('div', 'note'); msg.id = 'stxNote';
  const preview = el('div', 'stx-preview'); preview.hidden = true;
  const live = el('div', 'stx-live'); live.hidden = true;
  body.append(intro, nightRow, tabs, paste, link, go, msg, preview, live);
  det.append(sum, body);
  box.append(quiet, det);

  let mode = 'paste', state = null, last = null;
  const say = (t, warn) => note('stxNote', t || '', warn);
  const ago = ms => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; };
  const tonight = () => (state && state.tonight) || (S.status && S.status.night) || '';

  function setMode(m) {
    mode = m;
    tPaste.classList.toggle('on', m === 'paste'); tLink.classList.toggle('on', m === 'link');
    paste.hidden = m !== 'paste'; link.hidden = m !== 'link';
  }
  tPaste.addEventListener('click', () => setMode('paste'));
  tLink.addEventListener('click', () => setMode('link'));

  async function load() {
    let r;
    try { r = await fetch('/api/sheet', { cache: 'no-store' }); } catch (e) { return; }
    if (!r.ok) { state = null; render(); return; }
    state = await r.json();
    render();
  }

  function render() {
    const hs = !!(state && state.hardstop) && (!night.value || night.value === tonight());
    quiet.hidden = !hs;
    det.hidden = hs; // HARD STOP wins: nothing to import tonight
    if (!night.value && tonight()) night.value = tonight();
    live.textContent = '';
    live.hidden = true;
    if (!state) { if (unlocked === false) say('Unlock (crew code or password) to bring in set times.'); return; }
    const s = state;
    if (s.night && (s.live || s.canUndo || s.lastError)) {
      live.hidden = false;
      const from = s.source === 'link' ? 'a sheet link' : 'a pasted sheet';
      live.append(el('b', null, (s.live ? 'IN USE: ' : 'LAST IMPORT: ') + (s.applied || []).length + ' sets from ' + from + ' · ' + nightName(s.night)));
      if (s.source === 'link') {
        live.append(el('small', null, s.follow ? 'Following: read ' + (s.readAt ? ago(s.readAt) : 'not yet') + ', again every 5 minutes that night.' + (s.changedAt && s.changedAt !== s.appliedAt ? ' Last change ' + ago(s.changedAt) + '.' : '')
          : 'Not following the link any more.'));
      }
      if (s.lastError) { const w = el('div', 'note warn', s.lastError); live.append(w); }
      const row = el('div', 'buttons');
      if (s.canUndo) { const u = el('button', null, 'UNDO'); u.type = 'button'; u.addEventListener('click', undo); row.append(u); }
      if (s.follow) { const f = el('button', null, 'STOP FOLLOWING'); f.type = 'button'; f.addEventListener('click', stop); row.append(f); }
      if (row.children.length) live.append(row);
    }
  }

  function nightName(d) {
    if (d === tonight()) return 'TONIGHT';
    try { return new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase(); } catch (e) { return d; }
  }

  pv.addEventListener('click', async () => {
    if (!unlocked) { pending = null; return needUnlock(); }
    const b = { night: night.value || tonight() };
    if (mode === 'link') { if (!link.value.trim()) { say('Paste the sheet link first.', true); return; } b.url = link.value.trim(); }
    else { if (!paste.value.trim()) { say('Paste the set times first.', true); return; } b.csv = paste.value; }
    say(mode === 'link' ? 'Reading the sheet...' : '');
    pv.disabled = true;
    let r;
    try { r = await post('/api/sheet/preview', b); } finally { pv.disabled = false; }
    if (r.status === 401) return;
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.hardstop) { state = Object.assign({}, state, { hardstop: true }); render(); return; }
    if (!r.ok && !j.rows) { say(j.error || "Couldn't read that: " + glWhy(r.status, j), true); preview.hidden = true; return; }
    say('');
    last = j;
    showPreview(j);
  });

  function showPreview(j) {
    preview.textContent = '';
    preview.hidden = false;
    preview.append(el('b', null, 'PREVIEW · ' + nightName(j.night) + ' · ' + (j.rows || []).length + ' sets'));
    if (j.error) preview.append(el('div', 'note warn', j.error));
    if ((j.rows || []).length) {
      const t = el('table'); const tb = el('tbody');
      j.rows.forEach(x => {
        const tr = el('tr');
        tr.append(el('td', 't', x.start + (x.end ? '–' + x.end : '')), el('td', null, x.dj));
        tb.append(tr);
      });
      t.append(tb); preview.append(t);
    }
    if (j.twelveHour && (j.rows || []).length) preview.append(el('small', null, 'No am / pm in the sheet: read as a night (6-11 evening, 12 midnight, 1-5 after midnight). Check the times above.'));
    if (j.otherNights) preview.append(el('small', null, j.otherNights + (j.otherNights === 1 ? ' row' : ' rows') + ' for other nights left out.'));
    if (j.skippedCount) {
      const sk = el('div', 'stx-skip');
      sk.append(el('span', null, j.skippedCount + (j.skippedCount === 1 ? ' row' : ' rows') + ' left out:'));
      (j.skipped || []).slice(0, 8).forEach(s => sk.append(el('span', null, 'row ' + s.row + ': ' + s.why + ' (' + s.text + ')')));
      preview.append(sk);
    }
    if ((j.replaces || []).length) preview.append(el('small', null, 'Replaces this night\'s lineup (' + j.replaces.length + ' sets). UNDO brings it back.'));
    if (j.link) preview.append(el('small', null, 'Reads ' + j.link));
    const row = el('div', 'buttons');
    if (j.previewId) {
      const use = el('button', null, 'USE THESE TIMES'); use.type = 'button';
      use.addEventListener('click', () => apply(j.previewId));
      row.append(use);
    }
    const c = el('button', null, 'CANCEL'); c.type = 'button';
    c.addEventListener('click', () => { preview.hidden = true; last = null; });
    row.append(c);
    preview.append(row);
  }

  async function apply(id) {
    const r = await post('/api/sheet/apply', { previewId: id });
    if (r.status === 401) return;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { say(j.error || "Didn't save: " + glWhy(r.status, j), true); return; }
    preview.hidden = true; last = null;
    say('Saved. The lineup is in NIGHTS.');
    if (typeof loadNightsPlan === 'function') loadNightsPlan();
    load();
  }
  async function undo() {
    const r = await post('/api/sheet/undo', {});
    if (r.status === 401) return;
    say(r.ok ? 'Back to the lineup before the import.' : 'Nothing to undo.', !r.ok);
    if (typeof loadNightsPlan === 'function') loadNightsPlan();
    load();
  }
  async function stop() {
    const r = await post('/api/sheet/stop', {});
    if (r.ok) { say('The times stay; the link isn\'t read any more.'); load(); }
  }
  night.addEventListener('change', render);

  let was = null;
  setInterval(() => {
    if (document.body.classList.contains('remote')) { box.hidden = true; return; }
    const now = curView() === 'status' ? 'on' + unlocked : 'off';
    if (now !== 'off' && now !== was) load(); // STATUS came into view, or the phone was unlocked / locked
    was = now;
  }, 1000);
  setInterval(() => { if (curView() === 'status' && !document.hidden && unlocked) load(); }, 60000);
  return { load };
})();
