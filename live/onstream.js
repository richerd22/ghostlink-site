'use strict';
/*
 * ON STREAM (DECISIONS #120) on the dashboard: while HIDE IDS is on, each PLAYED row gets a small HIDE button, so an
 * unreleased track goes out on the stream as ID - ID (remembered for every night). HIDE IDS off (the default): PLAYED
 * is exactly as before. Own file, wraps renderPlayed like archive.js / insights.js.
 */
(() => {
  if (typeof renderPlayed !== 'function') return;
  let on = false, keys = new Set(), seen = '';
  const key = t => String(t.artist || '').trim().toLowerCase() + '\n' + String(t.title || '').trim().toLowerCase();

  async function refresh() {
    try {
      const r = await fetch('/api/onstream', { cache: 'no-store' });
      if (!r.ok) return; // WATCH FROM HOME: not here
      const j = await r.json();
      const sig = j.hideIds + '|' + (j.hidden || []).join('\u0001');
      on = !!j.hideIds; keys = new Set(j.hidden || []);
      if (sig !== seen) { seen = sig; renderPlayed(); }
    } catch (e) { /* next time */ }
  }

  function decorate() {
    if (!on || $('played').hidden) return;
    const list = playedList().slice().reverse();
    const rows = [...$('playedList').children].filter(li => !li.classList.contains('dj-sep') && !li.classList.contains('empty-note'));
    rows.forEach((li, i) => {
      const t = list[i];
      if (!t) return;
      const hidden = keys.has(key(t));
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mini' + (hidden ? ' on' : '');
      b.textContent = hidden ? 'HIDDEN' : 'HIDE';
      b.title = hidden ? 'Shows as ID - ID on the stream. Tap to show it again.' : 'Show this track as ID - ID on the stream';
      b.addEventListener('click', async () => {
        const r = await post('/api/onstream/hide', { title: t.title || '', artist: t.artist || '', hide: !hidden });
        if (r.ok) { seen = ''; refresh(); }
      });
      li.style.gridTemplateColumns = '6ch 3ch 1fr 6ch auto';
      li.append(b);
    });
  }

  const orig = renderPlayed;
  renderPlayed = function () {
    orig.apply(this, arguments);
    try { decorate(); } catch (e) { /* PLAYED stays as it was */ }
  };
  refresh();
  setInterval(refresh, 15000);
})();

/*
 * #128 HIDE NEXT on NOW: only while HIDE IDS is on, one quiet line per loaded deck that isn't on air ("the next
 * track"), so an unreleased track can be hidden before it ever shows on the stream. Same list as the builder's HIDE
 * (artist + title, every night). Titles go in as text nodes. Off (the default): nothing on NOW at all.
 */
const HideNext = (() => {
  /** The lines to show for one /api/onstream answer: [{deck, title, artist, listed, says}], next decks only. */
  function lines(st) {
    if (!st || !st.hideIds || !Array.isArray(st.decks)) return [];
    return st.decks.filter(d => d && d.deck !== st.now && String(d.title || '').trim()).slice(0, 3);
  }
  /** The words: [button text or null, line text]. */
  function words(d) {
    const t = String(d.title || '').trim();
    if (d.says && !d.listed) return [null, 'DECK ' + d.deck + ' GOES OUT AS ID · ' + t];
    return d.listed ? ['SHOW IT', 'NEXT IS HIDDEN ON STREAM · DECK ' + d.deck + ' · ' + t] : ['HIDE NEXT', 'DECK ' + d.deck + ' · ' + t];
  }
  if (typeof document === 'undefined' || typeof $ !== 'function') return { lines, words };
  const body = $('nowBody');
  if (!body) return { lines, words };
  const bar = document.createElement('div');
  bar.className = 'hide-next';
  bar.id = 'hideNext';
  bar.hidden = true;
  body.after(bar);
  let sig = '';
  async function tick() {
    const nowView = $('now');
    if (document.hidden || !nowView || nowView.hidden) return;
    let st = null;
    try { const r = await fetch('/api/onstream', { cache: 'no-store' }); if (r.ok) st = await r.json(); } catch (e) { return; }
    const ls = lines(st);
    const s = JSON.stringify(ls);
    if (s === sig) return;
    sig = s;
    bar.replaceChildren();
    ls.forEach(d => {
      const [btnText, text] = words(d);
      const row = document.createElement('div');
      row.className = 'hn-row' + (d.listed ? ' on' : '');
      const span = document.createElement('span');
      span.textContent = text;
      row.append(span);
      if (btnText) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mini' + (d.listed ? ' on' : '');
        b.textContent = btnText;
        b.title = d.listed ? 'Show this track on the stream again' : 'Show this track as ID - ID on the stream (every night)';
        b.addEventListener('click', async () => {
          if (typeof unlocked !== 'undefined' && !unlocked) { pending = b; return needUnlock(); }
          const r = await post('/api/onstream/hide', { title: d.title || '', artist: d.artist || '', hide: !d.listed });
          if (r.ok) { sig = ''; tick(); }
        });
        row.append(b);
      }
      bar.append(row);
    });
    bar.hidden = !ls.length;
  }
  tick();
  setInterval(tick, 3000);
  return { lines, words };
})();
if (typeof module !== 'undefined') module.exports = HideNext;
