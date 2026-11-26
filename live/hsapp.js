'use strict';
// USE IN THE HARD STOP APP (DECISIONS #162). Richard, Nov 26: "having that on mobile say like USE IN THE HARD STOP APP
// when like ... all the features n stuff are actually there with the plug". One small line, only when ALL hold:
//  - a phone's own browser: touch, a small screen, not inside the HARD STOP app (?app=hardstop, AppMode), not in a
//    frame (the website's demo), not ?embed / ?demo, not WATCH FROM HOME;
//  - this box has seen HARD STOP (GET /api/hardstop/hub `seen`): a GHOST LINK-only owner never sees it;
//  - the owner's switch (ALL SETTINGS -> USE IN THE HARD STOP APP, on by default) and this phone hasn't closed it
//    (× = never again on this phone, localStorage);
//  - a page the HARD STOP app covers with the plug: NOW and DECKS (hardstop://ghostlink), PLAYED (hardstop://night).
//    Never on STATUS (the password, owner settings, Wi-Fi), NETWORK or HELP.
// A plain link, never a redirect or a timer: without the app (or before HARD STOP 1.2.2) the tap does nothing and
// the dashboard keeps working. hardstop:// is the app's own scheme (no universal links): ghostlink, panels,
// start-night, tonight, night, booth, booth-screen, music-off.
const HsApp = (() => {
  const SCHEME = 'hardstop://';
  const ROUTES = ['ghostlink', 'panels', 'start-night', 'tonight', 'night', 'booth', 'booth-screen', 'music-off'];
  const FOR_VIEW = { now: 'ghostlink', decks: 'ghostlink', played: 'night' };
  const KEY = 'gl-hsapp-off';

  /** Pure: is this a phone's own browser? e = {coarse, w, h, inApp, framed, search}. */
  function phone(e) {
    const q = new URLSearchParams(e.search || '');
    if (e.inApp || e.framed || q.has('embed') || q.has('demo') || q.get('app') === 'hardstop') return false;
    return !!e.coarse && Math.min(e.w, e.h) <= 500;
  }
  /** Pure: the link for a route, or null. */
  function url(route) { return ROUTES.includes(route) ? SCHEME + route : null; }
  /** Pure: does the line show? c = {phone, seen, on, closed, view, remote}. */
  function shows(c) { return !!(c.phone && c.seen && c.on && !c.closed && !c.remote && FOR_VIEW[c.view]); }

  const pure = { phone, url, shows, FOR_VIEW, ROUTES };
  if (typeof document === 'undefined') return pure;

  const env = () => ({
    coarse: window.matchMedia && matchMedia('(pointer: coarse)').matches,
    w: window.innerWidth || screen.width, h: window.innerHeight || screen.height,
    inApp: document.documentElement.classList.contains('app-hs'),
    framed: (() => { try { return window.top !== window; } catch (e) { return true; } })(),
    search: location.search,
  });
  let seen = false, on = false;
  const closed = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };

  /** The app link for a route on this phone (null off a phone, before HARD STOP has been seen, or once closed). */
  function link(route) { return phone(env()) && seen ? url(route) : null; }

  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const css = el('style');
  css.textContent = `
    .hsapp-bar { margin: 8px 10px 0; padding: 6px 10px; border: 1px solid var(--line, #333); display: flex; gap: 10px; align-items: center; font-size: 13px; }
    .hsapp-bar[hidden] { display: none !important; }
    .hsapp-bar a { color: var(--fg, #fff); font-weight: 600; letter-spacing: .06em; text-decoration: none; }
    .hsapp-bar span { flex: 1; color: var(--grey, #9a9a9a); min-width: 0; }
    .hsapp-bar button { font: inherit; background: none; color: var(--grey, #9a9a9a); border: 0; padding: 0 4px; cursor: pointer; }`;
  document.head.appendChild(css);
  const bar = el('div', 'hsapp-bar local-only'); bar.id = 'hsAppBar'; bar.hidden = true;
  const a = el('a', null, 'USE IN THE HARD STOP APP');
  const why = el('span', null, 'with your panels');
  const x = el('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close for good on this phone'); x.title = 'Close for good on this phone';
  bar.append(a, why, x);
  const anchor = document.getElementById('eonReady');
  if (anchor) anchor.after(bar); else document.body.prepend(bar);
  x.addEventListener('click', () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} draw(); });

  const view = () => (typeof curView === 'function' ? curView() : (location.hash.slice(1).split('/')[0] || 'decks'));
  function draw() {
    const v = view();
    const show = shows({ phone: phone(env()), seen, on, closed: closed(), view: v, remote: document.body.classList.contains('remote') });
    if (show) a.href = url(FOR_VIEW[v]);
    bar.hidden = !show;
  }
  async function load() {
    if (!phone(env())) return draw();
    try { const r = await fetch('/api/hardstop/hub', { cache: 'no-store' }); if (r.ok) seen = (await r.json()).seen === true; } catch (e) {}
    try { const r = await fetch('/api/tonight', { cache: 'no-store' }); if (r.ok) on = (await r.json()).hsBanner !== false; } catch (e) {}
    draw();
    if (typeof TonightCard !== 'undefined' && TonightCard.get()) TonightCard.load(); // its START NIGHT link
  }
  window.addEventListener('hashchange', draw);
  load();
  setInterval(load, 120000);
  return Object.assign({ link, draw }, pure);
})();
if (typeof module !== 'undefined') module.exports = HsApp;
