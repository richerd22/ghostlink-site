'use strict';
// SET INSIGHTS live tags (DECISIONS #147). Two quiet words on a loaded deck, from the "played before?" answer the
// dashboard already asks once per load (/api/track, app.js lookupTrack). The owner's switches (ALL SETTINGS -> PLAYED)
// come from GET /api/hints (booleans only), asked at most once a minute:
//   SAME TRACK TONIGHT (on by default)  "PLAYED 23:14": the deck tile has said it since #55; the STACKED rows now
//                                       too, there only while the deck isn't on air yet (the moment it matters).
//   PLAYED HERE BEFORE (off by default) "HERE NOV 12": a loaded deck not on air yet, the track went out at this venue
//                                       on an earlier show night (the box leaves practice nights out).
// No sound, no pop-up, no colour change beyond the word. Screen only; nothing is sent; the players are never touched.
// Pure helpers (of / words / day) are tested in src/test/js/setinsights.test.js. Text only: app.js escapes what it shows.
const Hints = (() => {
  let cfg = { again: true, here: false }, at = 0;
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const pad = n => String(n).padStart(2, '0');

  function load() {
    if (typeof fetch === 'undefined' || Date.now() - at < 60000) return;
    at = Date.now();
    fetch('/api/hints', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
      if (j && typeof j.again === 'boolean') cfg = { again: j.again, here: j.here === true };
    }).catch(() => {}); // the box's defaults stay
  }

  /** "2026-11-12" -> "NOV 12". */
  function day(n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(n || ''));
    return m ? MON[+m[2] - 1] + ' ' + (+m[3]) : '';
  }

  /**
   * The hint for a loaded deck, or null. {kind: 'again', at, dj} or {kind: 'here', night, dj}.
   * opt: {again, here} (the switches); lk: the /api/track answer for this load.
   */
  function of(d, lk, opt) {
    const o = opt || cfg;
    if (!d || d.load !== 'LOADED' || !lk) return null;
    const t = Array.isArray(lk.tonight) ? lk.tonight : [];
    if (o.again && t.length) { const l = t[t.length - 1]; return { kind: 'again', at: l.at, dj: l.dj || null }; }
    if (o.here && lk.here && lk.here.night && !d.onAir) return { kind: 'here', night: lk.here.night, dj: lk.here.dj || null };
    return null;
  }

  /** The words: "PLAYED 23:14" / "HERE NOV 12". skew = the box-to-this-device clock offset (S.skew). */
  function words(h, skew) {
    if (!h) return '';
    if (h.kind === 'again') { const x = new Date(h.at + (skew || 0)); return 'PLAYED ' + pad(x.getHours()) + ':' + pad(x.getMinutes()); }
    return 'HERE ' + day(h.night);
  }

  const skew = () => (typeof S !== 'undefined' && S.skew) || 0;

  /** Is SAME TRACK TONIGHT on? (app.js keeps its own PLAYED tag on the tile behind this.) */
  function again() { load(); return cfg.again; }

  /** The tile's extra word: PLAYED HERE BEFORE only (the tile's PLAYED tag is app.js's); none while MUSIC AT THIS VENUE says it. */
  function tile(d, lk) {
    load();
    if (typeof S !== 'undefined' && S.status && S.status.venueMusic) return []; // its PLAYED HERE line already shows
    const h = of(d, lk, { again: false, here: cfg.here });
    return h ? [words(h, skew())] : [];
  }

  /** The STACKED row's extra flags: either word, only while the deck isn't on air. */
  function flags(d, lk) {
    load();
    if (!d || d.onAir) return [];
    const h = of(d, lk);
    return h ? [words(h, skew())] : [];
  }

  return { of, words, day, again, tile, flags, _set: c => { cfg = c; at = Date.now(); } };
})();
// PLAYED's SET INSIGHTS link follows the night picked there (like the NIGHT REPORT's, nightnote.js)
if (typeof document !== 'undefined') addEventListener('DOMContentLoaded', () => {
  const pick = document.getElementById('nightPick'), a = document.getElementById('insightsLink');
  if (!pick || !a) return;
  const follow = () => { const v = pick.value; a.href = 'setinsights.html' + (/^\d{4}-\d{2}-\d{2}$/.test(v) ? '?night=' + v : ''); };
  pick.addEventListener('change', follow);
  follow();
});
if (typeof module !== 'undefined') module.exports = Hints;
