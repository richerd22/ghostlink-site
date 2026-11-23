'use strict';
/*
 * SET TIME (DECISIONS #121). Own file; uses app.js globals (S, $, post, clock, FIT, viewNight, nights, loadNightsPlan).
 * Text nodes only. From status `setTime` (the box works everything out, core/SetTime):
 *  - One calm line on NOW and in the corner window (DECKS), only in the last 10 minutes before MUSIC OFF or the
 *    set's end: "This track ends 1:20 after MUSIC OFF" / "DECK 2 FITS" / "DECK 2 RUNS 1:20 OVER". Tap = gone for
 *    this track. Never a sound, never a buzz, never a flash.
 *  - After MUSIC OFF with music still on air: "+0:42 PAST MUSIC OFF" (same line, same calm).
 *  - RUNNING LATE: "RUNNING 10 MIN LATE" in that line. On GHOST LINK's own plan (no HARD STOP lineup) PLAYED gets
 *    +5 / +10 / custom and UNDO; with HARD STOP's lineup it's only HARD STOP's word, read-only.
 *  - PLAYED: every set mark reads "TICK → LIL TICK" with NOT A NEW SET (one tap; PUT THE MARK BACK for a minute
 *    after), and the downloads (TEXT, MIXCLOUD / 1001, CSV, PLAYLIST) for the whole night or one DJ.
 * Pure parts (line, marks) run under Node (src/test/js/settime.test.js).
 */
const SetTimeUI = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /** The words for the line, or null: [what, kind] with kind over | fits | past | late. dismissed = trackKey tapped away. */
  function line(st, dismissed) {
    if (!st) return null;
    const bits = [];
    if (st.pastOff && st.pastOff.say) bits.push([st.pastOff.say, 'past']);
    else if (st.check && st.check.say && st.check.say.length && st.check.trackKey !== dismissed) {
      st.check.say.forEach(s => bits.push([s, /OVER$|after/.test(s) ? 'over' : 'fits']));
    }
    if (st.late && st.late.say) bits.push([st.late.say, 'late']);
    return bits.length ? bits : null;
  }

  /**
   * #129: the loaded deck's own tag: {deck, text: 'FITS' | 'RUNS 1:20 OVER', over} or null. Only while the line says
   * it too (the on-air track still fits; not tapped away), so the tile and the line never disagree.
   */
  function tag(st, dismissed) {
    const c = st && !st.pastOff && st.check;
    if (!c || !c.next || c.trackKey === dismissed || !(c.say || []).some(s => /^DECK \d+ /.test(s))) return null;
    const so = Number(c.next.secsOver) || 0;
    return { deck: c.next.deck, text: so > 0 ? 'RUNS ' + mss(so) + ' OVER' : 'FITS', over: so > 0 };
  }
  const mss = s => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0');

  /**
   * The corner window's line without the "DECK 2 FITS" piece when that deck's own tile / row shows the tag (one place
   * for each fact; NOW keeps the whole line, it has no tiles). bits from line().
   */
  function withoutTagged(bits, t) {
    if (!bits || !t) return bits;
    const out = bits.filter(([s]) => !s.startsWith('DECK ' + t.deck + ' '));
    return out.length ? out : null;
  }

  /** PLAYED's set marks, oldest first: [{at, from, to}] where the DJ changes (never the first track). */
  function marks(list) {
    const out = [];
    const k = d => (d || '').trim().toLowerCase(); // #129: the same set rule as core/NightTracks (case, spaces at the ends)
    for (let i = 1; i < list.length; i++) if (k(list[i].dj) !== k(list[i - 1].dj)) out.push({ at: list[i].at, from: list[i - 1].dj || null, to: list[i].dj || null });
    return out;
  }

  /** "TICK → LIL TICK". */
  const change = (from, to) => (from || 'NO DJ SET') + ' → ' + (to || 'NO DJ SET');

  /** The DJs in the list, in the order they first played. */
  const djs = list => [...new Set(list.map(t => t.dj).filter(Boolean))];

  /**
   * #132: PLAYED's download picker, the same choices as the royalty picker (#129): WHOLE NIGHT, each DJ (all their
   * sets), then each set on its own when the night had more than one ("SET 3 · LIL TICK → TICK · 01:00 (12)").
   * list = oldest first. Pure: [[label, value]] with value '' | dj | 'set:n'. Sets split at the marks (marks()).
   */
  function tlChoices(list, hm) {
    const out = [['WHOLE NIGHT', '']];
    const seen = new Set(); // one row a DJ: "tick " and "TICK" are the same DJ (core/NightTracks.same)
    for (const d of djs(list || [])) { const k = d.trim().toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push([d, d]); } }
    const ms = marks(list || []);
    if (!list || !list.length || !ms.length) return out;
    const sets = [{ n: 1, from: null, dj: list[0].dj || null, at: list[0].at, tracks: 0 }];
    ms.forEach((m, i) => sets.push({ n: i + 2, from: m.from, dj: m.to, at: m.at, tracks: 0 }));
    let j = 0;
    for (const t of list) { while (j + 1 < sets.length && t.at >= sets[j + 1].at) j++; sets[j].tracks++; }
    const f = hm || (ms2 => { const d = new Date(ms2); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); });
    for (const x of sets) out.push(['SET ' + x.n + ' · ' + (x.n > 1 ? change(x.from, x.dj) : (x.dj || 'NO DJ SET')) + ' · ' + f(x.at) + ' (' + x.tracks + ')', 'set:' + x.n]);
    return out;
  }

  /** #132: the query for one choice: '' | '&dj=TICK' | '&set=2'. */
  const tlQuery = v => !v ? '' : v.startsWith('set:') ? '&set=' + encodeURIComponent(v.slice(4)) : '&dj=' + encodeURIComponent(v);

  /** #129 NOW's RUNNING LATE shortcut: [[label, body]] or null (only when the box offers the button / an undo). */
  function nowLate(st) {
    if (!st || !(st.lateButton || st.lateUndo)) return null;
    const out = [];
    if (st.lateButton) out.push(['+5 MIN', { min: 5 }], ['+10 MIN', { min: 10 }]);
    if (st.lateUndo) out.push(['UNDO', { undo: true }]);
    return out;
  }

  if (typeof document === 'undefined') return { line, marks, change, djs, tag, withoutTagged, nowLate, tlChoices, tlQuery };

  // ------------------------------------------------------------ NOW + corner window line
  let dismissed = null, lastSig = '';
  const shown = e => !!(e && !e.hidden && e.offsetParent !== null);
  /** #129: put the tag on deck p's tile (top line) and its STACKED row, take it off every other deck. True if seen. */
  function placeTag(t) {
    let seen = false;
    document.querySelectorAll('.st-fit').forEach(s => {
      if (!t || +s.dataset.deck !== t.deck) s.remove();
    });
    if (!t) return false;
    const spots = [];
    const tile = typeof tiles !== 'undefined' && tiles[t.deck] && tiles[t.deck].root;
    const top = tile && tile.querySelector('.top');
    if (top) spots.push([top, null]);
    const row = document.querySelector('#stack .srow[data-player="' + t.deck + '"] .st');
    if (row) spots.push([row, row.querySelector('.stt')]);
    for (const [host, before] of spots) {
      let s = host.querySelector('.st-fit');
      if (!s) { s = el('span', 'tag st-fit'); s.dataset.deck = t.deck; host.insertBefore(s, before); }
      if (s.textContent !== t.text) s.textContent = t.text;
      s.classList.toggle('over', t.over);
      s.title = t.over ? 'Played next, this deck runs past the end of the set' : 'Played next, this deck ends before the end of the set';
      if (shown(host)) seen = true;
    }
    return seen;
  }
  function render() {
    const st = S.status && S.status.setTime;
    const bits = line(st, dismissed);
    const t = tag(st, dismissed);
    const onTile = placeTag(t);
    const deckBits = onTile ? withoutTagged(bits, t) : bits;
    const sig = (bits ? bits.map(b => b[0]).join('|') : '') + '#' + (deckBits ? deckBits.length : 0);
    if (sig === lastSig) return;
    lastSig = sig;
    [['setTimeNow', bits], ['setTimeDecks', deckBits]].forEach(([id, bs]) => {
      const box = $(id);
      if (!box) return;
      box.replaceChildren(...(bs || []).map(([tx, k]) => el('span', 'st-' + k, tx)));
      box.hidden = !bs;
    });
    if (typeof FIT !== 'undefined') FIT.sig = ''; // the corner window refits its rows round the line
  }
  ['setTimeNow', 'setTimeDecks'].forEach(id => {
    const box = $(id);
    if (box) box.addEventListener('click', () => {
      const st = S.status && S.status.setTime;
      if (st && st.check) { dismissed = st.check.trackKey; lastSig = '?'; render(); } // gone for this track
    });
  });
  setInterval(render, 1000);

  // ------------------------------------------------------------ RUNNING LATE (GHOST LINK's own plan only)
  let lateErr = '';
  function renderLate() {
    const box = $('lateBox');
    if (!box) return;
    const st = S.status && S.status.setTime;
    const show = !!(st && (st.lateButton || st.lateUndo));
    box.hidden = !show;
    if (!show) return;
    const sig = [st.lateButton, st.lateUndo, st.late && st.late.say, lateErr].join('|');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    const head = el('small', null, st.late ? st.late.say : 'RUNNING LATE?');
    const row = el('div', 'buttons');
    if (st.lateButton) {
      [5, 10].forEach(m => { const b = el('button', 'mini', '+' + m + ' MIN'); b.type = 'button'; b.onclick = () => late({ min: m }); row.append(b); });
      // any other number: type it, MOVE
      const f = el('form', 'st-custom');
      const inp = el('input'); inp.type = 'number'; inp.min = '1'; inp.max = '120'; inp.placeholder = 'MIN'; inp.setAttribute('aria-label', 'Minutes late');
      const go = el('button', 'mini', 'MOVE'); go.type = 'submit';
      f.append(inp, go);
      f.onsubmit = e => { e.preventDefault(); const n = parseInt(inp.value, 10); if (n > 0) late({ min: n }); };
      row.append(f);
    }
    if (st.lateUndo) { const u = el('button', 'mini', 'UNDO'); u.type = 'button'; u.onclick = () => late({ undo: true }); row.append(u); }
    const parts = [head, row, el('div', 'note', 'Moves the sets that haven\'t started. MUSIC OFF stays.')];
    if (lateErr) parts.push(el('div', 'note warn', lateErr));
    box.replaceChildren(...parts);
  }
  async function late(body) {
    lateErr = '';
    const r = await post('/api/schedule/late', body);
    if (r.status === 401) return;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) lateErr = j.error || 'Didn\'t move (' + r.status + ').';
    if (r.ok && j.schedule && typeof nights !== 'undefined') { nights = j.schedule; if (typeof renderNightsPlan === 'function') renderNightsPlan(); if (typeof renderPlanNow === 'function') renderPlanNow(); }
    $('lateBox').dataset.sig = '';
    renderLate();
  }
  setInterval(renderLate, 1000);

  // #129: the same RUNNING LATE on NOW, as a shortcut: only on GHOST LINK's own plan (the box says lateButton /
  // lateUndo; never with HARD STOP's lineup, which moves its own times). +5 / +10 / UNDO; any other number is in PLAYED.
  function renderNowLate() {
    const box = $('lateNow');
    if (!box) return;
    const st = S.status && S.status.setTime;
    const bs = nowLate(st);
    box.hidden = !bs;
    if (!bs) return;
    const sig = bs.map(b => b[0]).join('|') + '|' + lateErr + '|' + !!st.late;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    // once late, the line above already says "RUNNING 10 MIN LATE": no second label
    const parts = st.late ? [] : [el('small', null, 'RUNNING LATE?')];
    for (const [t, body] of bs) {
      const b = el('button', 'mini', t); b.type = 'button';
      b.title = body.undo ? 'Undo the last move' : 'Move the sets that haven\'t started ' + body.min + ' min later (MUSIC OFF stays)';
      b.onclick = async () => { await late(body); box.dataset.sig = ''; renderNowLate(); };
      parts.push(b);
    }
    if (lateErr) parts.push(el('span', 'note warn', lateErr));
    box.replaceChildren(...parts);
  }
  setInterval(renderNowLate, 1000);

  // #129 MIXCLOUD CHECK while a set records: one calm line on NOW from status `mixcloudNow` {line, ok} (the box checks
  // the recording so far against Mixcloud's rules; no names in status). Never a pop-up, never a sound.
  function renderMixcloud() {
    const box = $('mixcloudNow');
    if (!box) return;
    const m = S.status && S.status.mixcloudNow;
    const t = m && m.line ? m.line : '';
    if (box.textContent !== t) box.textContent = t;
    box.hidden = !t;
    box.classList.toggle('warn', !!(m && m.ok === false));
  }
  setInterval(renderMixcloud, 2000);

  // ------------------------------------------------------------ PLAYED: marks + downloads
  let putBack = null; // {at, dj, until, night}: the mark just taken off, for a minute (night null = tonight)
  /** #129: a past night has no live broadcast: read it again and redraw PLAYED. */
  async function reloadPast(n) {
    if (typeof viewNight === 'undefined' || viewNight !== n) return;
    try {
      const j = await (await fetch('/api/history?night=' + encodeURIComponent(n), { cache: 'no-store' })).json();
      if (viewNight === n && j && Array.isArray(j.tracks)) { pastTracks = j.tracks; renderPlayed(); }
    } catch (e) { /* keep what's shown */ }
  }
  async function mark(body, night) {
    const r = await post('/api/history/mark', night ? Object.assign({ night }, body) : body);
    if (r.ok && night) await reloadPast(night);
    return r;
  }
  function played(list) {
    // #129: past nights get NOT A NEW SET too (that night's file; the report and exports follow)
    const night = typeof viewNight !== 'undefined' && viewNight ? viewNight : null;
    const ms = marks(list);
    const byAt = new Map(ms.map(m => [String(m.at), m]));
    document.querySelectorAll('#playedList li.dj-sep[data-mark]').forEach(li => {
      const m = byAt.get(li.dataset.mark);
      if (!m || li.querySelector('.st-undo')) return;
      const b = el('button', 'mini st-undo local-only', 'NOT A NEW SET');
      b.type = 'button';
      b.title = 'Take this mark off: these tracks join ' + (m.from || 'the set before');
      b.onclick = async () => {
        // set putBack first: a past night redraws inside mark()
        const was = putBack;
        putBack = { at: m.at, dj: m.to, until: Date.now() + 60000, night };
        const r = await mark({ at: m.at, join: true }, night);
        if (!r.ok) { putBack = was; if (night) renderPlayed(); }
      };
      li.append(' ', b);
    });
    if (putBack && putBack.until > Date.now() && putBack.dj && putBack.night === night) {
      const first = document.querySelector('#playedList li:not(.dj-sep):not(.empty-note)');
      if (first && !document.getElementById('stPutBack')) {
        const li = el('li', 'dj-sep st-back');
        li.id = 'stPutBack';
        const b = el('button', 'mini local-only', 'PUT THE MARK BACK');
        b.type = 'button';
        b.onclick = async () => {
          const pb = putBack;
          putBack = null;
          const r = await mark({ at: pb.at, join: false, dj: pb.dj }, pb.night);
          if (!r.ok) putBack = pb;
          if (pb.night) renderPlayed();
        };
        li.append(el('span', null, 'Mark taken off. '), b);
        $('playedList').prepend(li);
      }
    }
    // downloads: the whole night, one DJ or (#132) one set, like the royalty picker
    const pick = $('tlDj');
    if (pick) {
      const ch = tlChoices(list), want = pick.value;
      const sig = ch.map(c => c[0]).join('|');
      if (pick.dataset.sig !== sig) {
        pick.dataset.sig = sig;
        pick.replaceChildren(...ch.map(([label, v]) => { const o = el('option', null, label); o.value = v; return o; }));
        pick.value = ch.some(c => c[1] === want) ? want : '';
      }
      pick.hidden = ch.length < 3; // the whole night and one more choice: nothing to pick
      links();
    }
  }
  function links() {
    const pick = $('tlDj');
    const night = typeof viewNight !== 'undefined' && viewNight ? '&night=' + encodeURIComponent(viewNight) : '';
    const q = tlQuery(pick ? pick.value : '');
    const set = (id, fmt) => { const a = $(id); if (a) a.href = '/api/history?format=' + fmt + night + q; };
    set('txtLink', 'txt'); set('mixLink', 'mixcloud'); set('csvLink', 'csv'); set('m3uLink', 'm3u8');
  }
  if ($('tlDj')) $('tlDj').addEventListener('change', links);
  // #132: a COPY · SAVE menu (any .more-menu) opens where it fits: under its button, never off the screen's edges.
  document.addEventListener('toggle', e => {
    const m = e.target;
    if (!m || !m.classList || !m.classList.contains('more-menu') || !m.open) return;
    const b = m.querySelector('.more-box');
    if (!b) return;
    b.style.left = ''; b.style.right = '';
    const s = m.getBoundingClientRect(), w = b.offsetWidth, W = document.documentElement.clientWidth;
    const left = Math.min(Math.max(8, s.right - w), W - 8 - w);
    if (Math.abs(left - (s.right - w)) > 0.5) { b.style.right = 'auto'; b.style.left = Math.round(left - s.left) + 'px'; }
  }, true);

  return { line, marks, change, djs, tag, withoutTagged, nowLate, tlChoices, tlQuery, played, render };
})();
if (typeof module !== 'undefined') module.exports = SetTimeUI;
