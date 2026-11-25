'use strict';
// OFTEN NEXT (DECISIONS #154, RELATED TRACKS on a deck): one quiet grey word on a loaded deck tile, "OFTEN NEXT: Glass
// Hour - Pell", the track that most often came after this one on this box's show nights before tonight (2+ times).
// Off by default: ALL SETTINGS -> TONIGHT -> OFTEN NEXT (hints.next, read through Hints.next()). Only on a phone with
// the crew code or the owner's password: the words come from GET /api/night/next (locked; WATCH FROM HOME never), so a
// locked phone asks nothing and shows nothing. Never on the STACKED rows (the corner window stays as it is). Asked once
// per loaded track. Screen only: nothing is sent, the players are never touched. Text only: app.js escapes it.
const Related = (() => {
  const cache = {}; // "title|artist" -> {next} | null (asked / nothing)

  /** The words for an answer: "OFTEN NEXT: Title - Artist" / "" (nothing 2+ times). Pure. */
  function words(j) {
    const n = j && Array.isArray(j.next) ? j.next[0] : null;
    if (!n || !n.title || !(n.count >= 2)) return '';
    return 'OFTEN NEXT: ' + n.title + (n.artist ? ' - ' + n.artist : '');
  }

  /** May this phone ask? The switch is on, it is unlocked, a track is loaded. Pure on its inputs. */
  function wanted(d, on, unlockedNow) {
    return !!(on && unlockedNow && d && d.load === 'LOADED' && d.title);
  }

  /** The tile's extra word(s) for this deck (app.js shows them grey). */
  function tile(d) {
    const on = typeof Hints !== 'undefined' && Hints.next();
    const u = typeof unlocked !== 'undefined' && unlocked;
    if (!wanted(d, on, u)) return [];
    const k = String(d.title) + '|' + String(d.artist || '');
    if (!(k in cache)) {
      cache[k] = null;
      fetch('/api/night/next?title=' + encodeURIComponent(d.title) + '&artist=' + encodeURIComponent(d.artist || ''), { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(j => { cache[k] = j; if (j && words(j) && typeof renderDeck === 'function') renderDeck(d.player); })
        .catch(() => { delete cache[k]; });
    }
    const w = words(cache[k]);
    return w ? [w] : [];
  }

  return { words, wanted, tile };
})();
if (typeof module !== 'undefined') module.exports = Related;
