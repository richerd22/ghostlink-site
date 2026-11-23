'use strict';
// + NOTE (#125 NIGHT LOG): a quick timestamped note on tonight's log from NOW: MEDICAL, SECURITY, TECH, LOST & FOUND,
// OTHER, plus a few words. Crew code or owner (post() asks for the password on a 401). Kept with the night on the box
// (history/<night>.notes.jsonl); the NIGHT REPORT shows it with everything the box logged by itself. Text nodes only.
// Uses app.js globals (post, pending). Own file; index.html has <div id="nnBox"> under SEND A CREW CALL.
const NightNote = (() => {
  const PRESETS = ['MEDICAL', 'SECURITY', 'TECH', 'LOST & FOUND', 'OTHER'];
  const MAX = 280;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const box = document.getElementById('nnBox');
  if (!box) return {};

  const wrap = el('details', 'night-note');
  const sum = el('summary', null, '+ NOTE');
  sum.title = 'A timestamped note on tonight\'s NIGHT LOG';
  const body = el('div', 'nn-body');
  const picks = el('div', 'nn-picks');
  const row = el('div', 'nn-row');
  const txt = el('input', 'nn-txt'); txt.maxLength = MAX; txt.placeholder = 'What happened (optional)';
  txt.setAttribute('aria-label', 'Note'); txt.autocomplete = 'off'; txt.enterKeyHint = 'done';
  const save = el('button', 'nn-go', 'SAVE'); save.type = 'button';
  const note = el('div', 'nn-note');
  const last = el('div', 'nn-last');
  const report = el('a', 'nn-note', 'NIGHT REPORT + LOG'); report.href = 'night.html';
  let kind = 'OTHER';

  PRESETS.forEach(p => {
    const b = el('button', 'mini', p); b.type = 'button'; b.dataset.k = p;
    b.addEventListener('click', () => { kind = p; mark(); txt.focus(); });
    picks.append(b);
  });
  function mark() { picks.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === kind)); }
  mark();
  row.append(txt, save);
  body.append(picks, row, note, last, report);
  wrap.append(sum, body);
  box.append(wrap);

  function say(t, warn) { note.textContent = t; note.classList.toggle('warn', !!warn); }
  const hhmm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function shown(e) {
    const s = el('span', null, hhmm(e.at) + ' ' + e.tag + (e.text ? ' · ' + e.text : ''));
    last.prepend(s);
    while (last.children.length > 3) last.lastChild.remove();
  }

  async function send() {
    const text = txt.value.trim();
    if (!text && kind === 'OTHER') { say('Type what happened, or pick MEDICAL / SECURITY / TECH / LOST & FOUND.', true); txt.focus(); return; }
    save.disabled = true;
    try {
      const r = await post('/api/night/note', { kind, text });
      if (r.status === 401) { pending = save; return; } // runs again once the password is in
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { say(j.error || "Didn't save (" + r.status + ').', true); return; }
      txt.value = '';
      say('Saved ' + hhmm(j.entry.at) + ' on tonight\'s log.');
      shown(j.entry);
    } catch (e) {
      say("Couldn't reach the box. Try again.", true);
    } finally {
      save.disabled = false;
    }
  }
  save.addEventListener('click', send);
  txt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });

  // PLAYED's NIGHT REPORT link follows the night picked there
  const pickN = document.getElementById('nightPick'), rl = document.getElementById('reportLink');
  if (pickN && rl) {
    const follow = () => { const v = pickN.value; rl.href = 'night.html' + (/^\d{4}-\d{2}-\d{2}$/.test(v) ? '?night=' + v : ''); };
    pickN.addEventListener('change', follow);
    follow();
  }

  return { PRESETS };
})();
