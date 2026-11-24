'use strict';
// MILESTONES on the dashboard (DECISIONS #146): one quiet line, the owner's only, shown ONCE per milestone per box:
// "MILESTONE · 100TH TRACK THROUGH GHOST LINK →" (tap = GHOST WRAPPED, ALL NIGHTS; CLOSE = gone). Never while a deck
// plays, never in the corner window (480 px tall or less), never inside the HARD STOP app or an embed, never on
// WATCH FROM HOME. It counts as shown after 20 s on screen or a tap. THE LINE RULE (lines.js) knows it as
// 'milestone', the least important line. Off: ALL SETTINGS -> MILESTONES. Own file; text nodes only.
(() => {
  const anchor = document.getElementById('eonReady');
  if (!anchor || /[?&](embed|app)=/.test(location.search)) return;
  const line = document.createElement('div');
  line.id = 'milestoneLine'; line.className = 'eon-ready'; line.hidden = true;
  const link = document.createElement('a'); link.href = 'wrapped.html?night=all';
  const x = document.createElement('button'); x.type = 'button'; x.className = 'mini'; x.textContent = 'CLOSE';
  line.append(link, x);
  anchor.insertAdjacentElement('afterend', line);

  let fresh = [], shownAt = 0, stop = false, busy = false;
  const playing = () => typeof S !== 'undefined' && S && S.decks && Object.values(S.decks).some(d => d && d.playing && d.load === 'LOADED');
  const quietHere = () => !document.hidden && innerHeight > 480 && !playing();

  async function seen() {
    const ids = fresh.map(m => m.id);
    fresh = []; line.hidden = true; shownAt = 0;
    if (!ids.length) return;
    try { await fetch('/api/milestones/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); } catch (e) {}
  }
  link.addEventListener('click', () => { seen(); });
  x.addEventListener('click', () => { seen(); });

  async function check() {
    if (stop || busy || fresh.length || !quietHere()) return;
    busy = true;
    try {
      const r = await fetch('/api/milestones', { cache: 'no-store' });
      if (r.status === 401 || r.status === 403 || r.status === 404) { if (r.status === 404) stop = true; return; } // not the owner (yet)
      const j = r.ok ? await r.json() : null;
      fresh = j && j.on && Array.isArray(j.fresh) ? j.fresh.slice(-3) : [];
    } catch (e) { fresh = []; } finally { busy = false; }
    draw();
  }
  function draw() {
    if (!fresh.length) { line.hidden = true; return; }
    const m = fresh[fresh.length - 1];
    link.textContent = 'MILESTONE · ' + m.title + (fresh.length > 1 ? ' · +' + (fresh.length - 1) + ' MORE' : '') + ' →';
    line.hidden = false;
  }
  setInterval(() => {
    if (!fresh.length) return;
    if (!quietHere()) { line.hidden = true; shownAt = 0; return; } // music on: away until it's quiet again (not yet "shown")
    if (line.hidden) draw();
    if (!shownAt) shownAt = Date.now();
    else if (Date.now() - shownAt > 20000) { seen(); }
  }, 1000);
  setTimeout(check, 8000);
  setInterval(check, 5 * 60000);
})();
