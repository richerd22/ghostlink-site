'use strict';
// TONIGHT ISN'T SET UP (DECISIONS #162). BIJOU Nov 25: the box was up at 21:31, the night set up at 22:58 (when the
// HARD STOP app was first opened). Richard: "useful without being annoying". One calm card, from the box's own answer
// (GET /api/tonight, core/Tonight): "GHOST LINK is on at <venue>. Tonight isn't set up yet." SET UP TONIGHT /
// NOT A SHOW (both put it away for the night, for every phone; crew code or owner) and × (this phone, tonight).
//  - NOW (#tonightCard): only while the box says `due` and no music is on (`showRunning`): never over a show.
//  - STATUS (#tonightReady, under READY FOR TONIGHT): while `due`, music or not (you went there to look).
//  - SET UP TONIGHT: marks it, then opens PLAN TONIGHT (STATUS -> NIGHTS) for times; with HARD STOP seen, also the
//    START NIGHT link into the HARD STOP app (phone browsers only: HsApp.link).
// The owner's switch: ALL SETTINGS -> TONIGHT -> SAY WHEN TONIGHT ISN'T SET UP. Venue words are the box's own (text).
const TonightCard = (() => {
  /** Pure: which cards show. t = /api/tonight, away = this phone put it away tonight. */
  function shown(t, away) {
    const due = !!(t && t.due) && !away;
    return { now: due && !t.showRunning, status: due };
  }
  /** Pure: the card's line. */
  function line(t) {
    const v = t && t.venue ? t.venue : '';
    return (v ? 'GHOST LINK is on at ' + v + '.' : 'GHOST LINK is on.') + " Tonight isn't set up yet.";
  }
  if (typeof document === 'undefined') return { shown, line };

  const $ = id => document.getElementById(id);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const css = el('style');
  css.textContent = `
    .tonight-card { border: 1px solid var(--fg, #fff); padding: 10px 12px; margin: 8px 0 12px; display: grid; gap: 8px; }
    .tonight-card[hidden] { display: none !important; }
    .tonight-card .tn-head { display: flex; gap: 10px; align-items: flex-start; }
    .tonight-card .tn-head b { flex: 1; font-weight: 600; }
    .tonight-card .tn-x { font: inherit; background: none; color: var(--grey, #9a9a9a); border: 0; padding: 0 4px; cursor: pointer; }
    .tonight-card .tn-btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .tonight-card .tn-note { color: var(--grey, #9a9a9a); font-size: 13px; }
    .tonight-card .tn-note:empty { display: none; }
    body.ln-small .tonight-card { margin: 4px 0; padding: 6px 8px; gap: 4px; }`;
  document.head.appendChild(css);

  const KEY = 'gl-tonight-away';
  const awayTonight = night => { try { return localStorage.getItem(KEY) === night; } catch (e) { return false; } };
  let last = null;

  function card(where) {
    const c = el('div', 'tonight-card local-only'); c.hidden = true; c.setAttribute('role', 'status');
    const head = el('div', 'tn-head'), b = el('b');
    const x = el('button', 'tn-x', '×'); x.type = 'button'; x.title = 'Not on this phone tonight'; x.setAttribute('aria-label', 'Close for tonight');
    head.append(b, x);
    const btns = el('div', 'tn-btns');
    const setup = el('button', 'go', 'SET UP TONIGHT'); setup.type = 'button';
    const not = el('button', null, 'NOT A SHOW'); not.type = 'button';
    const hs = el('a', 'btn', 'START NIGHT IN THE HARD STOP APP'); hs.hidden = true;
    btns.append(setup, not, hs);
    const note = el('div', 'tn-note');
    c.append(head, btns, note);
    x.addEventListener('click', () => { try { if (last) localStorage.setItem(KEY, last.night); } catch (e) {} draw(); });
    const act = (what, btn) => async () => {
      if (typeof unlocked !== 'undefined' && !unlocked) { pending = btn; return needUnlock(); }
      const r = await post('/api/tonight', { do: what });
      if (!r.ok) { if (r.status !== 401) note.textContent = typeof glWhy === 'function' ? glWhy(r.status, await r.json().catch(() => ({}))) : "Didn't save."; return; }
      last = await r.json().catch(() => last);
      draw();
      if (what === 'setup') location.hash = '#status/nights';
    };
    setup.addEventListener('click', act('setup', setup));
    not.addEventListener('click', act('notashow', not));
    c._fill = t => {
      b.textContent = TonightCard.line(t);
      note.textContent = where === 'now' ? 'Times, lineup and MUSIC OFF go under PLAN TONIGHT.' : '';
      const link = typeof HsApp !== 'undefined' && HsApp.link('start-night');
      hs.hidden = !link; if (link) hs.href = link;
    };
    return c;
  }

  const nowCard = card('now'), statusCard = card('status');
  nowCard.id = 'tonightCard'; statusCard.id = 'tonightReady';
  const nowView = $('now'), ready = $('ready');
  if (nowView) nowView.insertBefore(nowCard, nowView.firstChild);
  if (ready) ready.after(statusCard);

  function draw() {
    const s = shown(last, last && awayTonight(last.night));
    if (last) { nowCard._fill(last); statusCard._fill(last); }
    nowCard.hidden = !s.now;
    statusCard.hidden = !s.status;
  }
  async function load() {
    try { const r = await fetch('/api/tonight', { cache: 'no-store' }); if (r.ok) last = await r.json(); } catch (e) { /* offline: keep */ }
    draw();
  }
  load();
  setInterval(load, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  return { shown, line, load, get: () => last };
})();
if (typeof module !== 'undefined') module.exports = TonightCard;
