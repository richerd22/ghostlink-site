'use strict';
// #109 BOOTH ASKS + HOME on the dashboard. Own file; uses app.js globals (S, role, ROLES, post, unlocked, needUnlock).
// Text nodes only: asks come from panels on the network.
//
// BOOTH ASKS: a booth panel's ask (WATER / TOWEL, COME TO BOOTH) relayed to the box over the LAN shows under the crew
// calls on every tab: "BOOTH: WATER / TOWEL · 3 min ago", with OK / ON MY WAY. The first answer wins (any phone, the
// HARD STOP app, a panel); an answered ask stays 2 min with who answered, then goes. From S.status.asks.
//
// HOME: PLAYED tags practice nights (HOME) in the night list, and says so above the list, with a way to count a night
// as a show after all (or mark one as practice). From /api/nights/home and S.status.home.
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ago = (ms, now) => {
    const m = Math.floor(Math.max(0, now - ms) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' ago';
  };
  const who = () => { const r = typeof role === 'string' ? role : 'dj'; return r === 'dj' ? 'BOOTH' : ((typeof ROLES !== 'undefined' && ROLES[r] && ROLES[r].label) || 'CREW'); };

  // ---------- BOOTH ASKS ----------
  const box = $('boothAsks');
  const sending = {};
  async function answer(a, text) {
    sending[a.id] = true; key = '';
    try {
      const r = await fetch('/api/hardstop/answer', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GhostLink-Dashboard': '1' },
        body: JSON.stringify({ id: a.id, answer: text, by: who() }) });
      if (!r.ok && r.status !== 409) sending[a.id] = false; // 409: someone else got there first; the list shows their answer
    } catch (e) { sending[a.id] = false; }
    key = '';
  }
  let key = '';
  function draw() {
    if (!box) return;
    const now = Date.now() - ((typeof S !== 'undefined' && S.skew) || 0);
    const list = ((typeof S !== 'undefined' && S.status && S.status.asks) || []).slice(0, 3);
    const k = list.map(a => a.id + (a.answer || '') + ago(a.at, now) + (sending[a.id] ? 's' : '')).join('|');
    if (k === key) return;
    key = k;
    box.replaceChildren(...list.map(a => {
      const d = el('div', 'booth-ask' + (a.answer ? ' done' : ''));
      d.append(el('span', 'who', a.from || 'BOOTH'), el('b', null, a.text), el('span', 'when', ago(a.at, now)));
      if (a.answer) d.append(el('span', 'ans', a.answer + ' · ' + (a.answeredBy || 'CREW')));
      else {
        const btns = el('span', 'btns');
        ['OK', 'ON MY WAY'].forEach(t => {
          const b = el('button', 'mini', t); b.type = 'button'; b.disabled = !!sending[a.id];
          b.addEventListener('click', () => answer(a, t));
          btns.append(b);
        });
        d.append(btns);
      }
      return d;
    }));
    box.hidden = !list.length;
  }
  setInterval(draw, 1000);

  // ---------- HOME in PLAYED ----------
  const pick = $('nightPick'), bar = pick && pick.closest('.bar');
  let homeNights = [], line = null;
  if (bar) { line = el('div', 'home-night'); line.id = 'homeNight'; line.hidden = true; bar.after(line); }
  async function loadHome() {
    try { const r = await fetch('/api/nights/home', { cache: 'no-store' }); if (r.ok) homeNights = await r.json(); } catch (e) {}
    tag();
  }
  function tonight() { return (typeof S !== 'undefined' && S.status && S.status.night) || ''; }
  function isHome(n) { return n === tonight() ? !!(S.status && S.status.home) : homeNights.includes(n); }
  function tag() {
    if (!pick) return;
    [...pick.options].forEach(o => {
      const base = o.textContent.replace(/ · HOME$/, '');
      const t = base + (isHome(o.value) ? ' · HOME' : '');
      if (o.textContent !== t) o.textContent = t;
    });
    if (!line) return;
    const n = pick.value || tonight(), h = isHome(n);
    const k = n + h;
    if (line.dataset.k === k) return;
    line.dataset.k = k;
    line.replaceChildren();
    line.hidden = !n;
    if (!n) return;
    if (h) line.append(el('span', 'tag', 'HOME'), el('span', null, ' Practice night: kept here, never counts as a show or a record. '));
    const b = el('button', 'mini', h ? 'COUNT IT AS A SHOW' : 'MARK AS PRACTICE');
    b.type = 'button';
    b.addEventListener('click', async () => {
      if (typeof unlocked !== 'undefined' && !unlocked) return needUnlock();
      if (h && !confirm('Count the night of ' + n + ' as a show? Its numbers go into BOX RECORDS and the all-time totals.')) return;
      const r = await post('/api/history/home', { night: n, home: !h });
      if (r.ok) { line.dataset.k = ''; if (n === tonight() && S.status) S.status.home = !h; await loadHome(); }
    });
    if (!h) line.classList.add('quiet'); else line.classList.remove('quiet');
    line.append(b);
  }
  if (pick) {
    pick.addEventListener('change', tag);
    new MutationObserver(() => tag()).observe(pick, { childList: true });
    setInterval(tag, 2000);
    loadHome();
    setInterval(loadHome, 60000);
  }
})();
