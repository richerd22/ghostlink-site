'use strict';
// SET NOTES (DECISIONS #131) on the dashboard. Loaded after app.js and stageclock.js. Text nodes only.
//  - NOW: the next act's note in the last 15 min of a set and the changeover: "NEXT: LIL TICK · NEEDS TT + MIC"
//    (HARD STOP's lineup[].nt when its lineup is tonight's, else the note typed in NIGHTS). From /api/stageclock.
//  - NIGHTS: a note is typed after the name, "22:00 LIL TICK // NEEDS TT + MIC"; the form puts saved notes back.
const SetNotesUi = (() => {
  /** A lineup's lines with each DJ's saved note put back after the name (the form's text). */
  function withNotes(lines, notes) {
    const by = {};
    Object.keys(notes || {}).forEach(k => { by[k.toLowerCase()] = notes[k]; });
    return lines.map(l => {
      const dj = String(l.dj || '').trim().replace(/\s+/g, ' ').toLowerCase();
      return l.text + (by[dj] ? ' // ' + by[dj] : '');
    });
  }
  /** #132: one DJ's saved note for a night ('' = none), names compared as the box does (case, spaces). */
  function noteOf(all, date, dj) {
    const n = (all || {})[date];
    if (!n) return '';
    const want = String(dj || '').trim().replace(/\s+/g, ' ').toLowerCase();
    for (const k of Object.keys(n)) if (k.trim().replace(/\s+/g, ' ').toLowerCase() === want) return String(n[k] || '');
    return '';
  }
  if (typeof document === 'undefined') return { withNotes, noteOf };

  // #132: the NIGHTS list shows each act's note too ("23:30  LIL TICK · NEEDS TT + MIC"), not only EDIT.
  let saved = {};
  async function load() {
    try { const r = await fetch('/api/setnotes', { cache: 'no-store' }); if (r.ok) saved = await r.json(); } catch (e) {}
  }
  /** The list's words after a DJ's name: ' · NOTE' or ''. Plain text; app.js escapes it. */
  const suffix = (date, dj) => { const t = noteOf(saved, date, dj); return t ? ' · ' + t : ''; };
  // the list may have drawn before this file loaded: draw it again once the notes are in
  if (document.getElementById('nightsList') && typeof renderNightsPlan === 'function')
    load().then(() => { if (Object.keys(saved).length && document.getElementById('nightsList').children.length) renderNightsPlan(); });

  /** NIGHTS EDIT: the lines app.js wrote, with this night's notes after the names. */
  async function fill(n) {
    if (!n || !n.lineup || !n.lineup.length) return;
    let all = {};
    try { all = await (await fetch('/api/setnotes', { cache: 'no-store' })).json(); } catch (e) { return; }
    const notes = all[n.date];
    const ta = document.getElementById('nLineup');
    if (!notes || !ta) return;
    const untimed = s => !s.start || s.start === '12:00'; // as app.js
    const before = n.lineup.map(s => (untimed(s) ? '' : s.start + ' ') + s.dj).join('\n');
    if (ta.value !== before) return; // someone's already typing: leave it be
    ta.value = withNotes(n.lineup.map(s => ({ text: (untimed(s) ? '' : s.start + ' ') + s.dj, dj: s.dj })), notes).join('\n');
  }

  const box = document.getElementById('setNoteNow');
  if (box && typeof StageClockView !== 'undefined') {
    const css = document.createElement('style');
    css.textContent = `.setnote-now { border-left: 3px solid var(--warn, #ffb000); padding: 6px 10px; margin: 10px 0 4px; font-weight: 600; letter-spacing: .04em; overflow-wrap: anywhere; }
      .setnote-now[hidden] { display: none !important; }
      body.fit-decks .setnote-now { font-size: 12px; padding: 2px 8px; margin: 6px 0 2px; }`;
    document.head.appendChild(css);
    let feed = null, skew = 0;
    async function load() {
      const t0 = Date.now();
      try {
        const r = await fetch('/api/stageclock', { cache: 'no-store' });
        if (!r.ok) return;
        const f = await r.json(), t1 = Date.now();
        skew = (t0 + t1) / 2 - f.at; feed = f;
      } catch (e) {}
    }
    function draw() {
      const t = StageClockView.noteLine(feed, Date.now() - skew);
      box.hidden = !t;
      if (box.textContent !== t) box.textContent = t;
    }
    load(); setInterval(() => { if (!document.hidden) load(); }, 15000);
    setInterval(draw, 2000);
  }
  return { fill, withNotes, noteOf, load, suffix };
})();
if (typeof module !== 'undefined') module.exports = SetNotesUi;
