'use strict';
// NIGHT SAFETY (DECISIONS #127) on every GHOST LINK screen: polls GET /api/safety (open on the LAN) and shows
//  - SHOW STOP: a full-screen red message until ALL CLEAR (dashboards, TV, stage clock, crew screen, what's on). The
//    stream overlays (mode 'hide') go blank instead: nothing about it reaches a stream. Steady, never flashing.
//  - HOLD: an amber bar "HOLD: WEATHER · ALL CLEAR IN 23:10" (the stage clock shows it in its own digits).
//  - the CURFEW LADDER's TV line, the DOOR COUNT ("IN 412 / 450", yellow at 90 %, red at 100 %) and the HEARING card
//    (TV / stage clock only, each only when the owner turned it on).
// Safety.start(mode): 'dash' | 'tv' | 'stage' | 'crew' | 'plain' | 'hide' | 'crowd' (#131 NEXT UP: SHOW STOP only). Text nodes only: messages come from the network.
const Safety = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const two = n => String(n).padStart(2, '0');
  const hhmm = ms => { const d = new Date(ms); return two(d.getHours()) + ':' + two(d.getMinutes()); };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + two(s % 60); };
  let S = null, skew = 0, mode = 'plain';
  const listeners = [];

  /** Pure words for the hold bar (tested): "HOLD: WEATHER · ALL CLEAR IN 23:10". */
  function holdText(h, now) {
    if (!h) return '';
    let t = 'HOLD: ' + h.why;
    if (h.allClearAt != null) t += h.allClearAt > now ? ' · ALL CLEAR IN ' + mmss(h.allClearAt - now) : ' · ALL CLEAR · RESUME WHEN READY';
    else t += ' · SINCE ' + hhmm(h.since);
    return t;
  }
  /** "IN 412 / 450" + the tone's word: NEAR FULL at 90 %, FULL at 100 %. */
  function doorText(d) {
    if (!d) return '';
    return 'IN ' + d.n + (d.cap ? ' / ' + d.cap : '') + (d.tone === 'full' ? ' · FULL' : d.tone === 'near' ? ' · NEAR FULL' : '');
  }
  if (typeof document === 'undefined') return { holdText, doorText, mmss, hhmm }; // node tests: the words only

  const css = `
  .sf-stop { position: fixed; inset: 0; z-index: 2147483000; background: #c40000; color: #fff; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; padding: 4vh 5vw; gap: 2.5vh; font-family: "JetBrains Mono", ui-monospace, monospace; }
  .sf-stop[hidden], .sf-hold[hidden], .sf-line[hidden], .sf-door[hidden], .sf-ear[hidden] { display: none !important; }
  .sf-stop small { font-size: clamp(14px, 3.2vh, 40px); letter-spacing: .2em; font-weight: 600; }
  .sf-stop b { font-size: clamp(34px, 13vmin, 200px); line-height: 1.02; font-weight: 600; overflow-wrap: anywhere; }
  .sf-stop span { font-size: clamp(13px, 2.6vh, 32px); letter-spacing: .06em; }
  .sf-stop button { font: inherit; font-size: clamp(14px, 2.6vh, 28px); font-weight: 600; letter-spacing: .1em; background: #fff; color: #c40000;
    border: 0; padding: 1.4vh 4vw; min-height: 44px; cursor: pointer; }
  .sf-stop .sf-note { font-size: clamp(12px, 2vh, 22px); min-height: 1em; }
  .sf-hold { position: fixed; left: 0; right: 0; top: 0; z-index: 2147482000; background: #ffb000; color: #000; display: flex; gap: 12px;
    align-items: center; justify-content: center; padding: 6px 12px; font-weight: 600; letter-spacing: .08em; font-family: "JetBrains Mono", ui-monospace, monospace;
    font-variant-numeric: tabular-nums; flex-wrap: wrap; text-align: center; }
  .sf-hold button { font: inherit; background: #000; color: #ffb000; border: 0; padding: 6px 14px; min-height: 36px; cursor: pointer; }
  body.sf-tv .sf-hold, body.sf-crew .sf-hold { font-size: 4.2vh; padding: 1.4vh 2vw; }
  body.sf-held.sf-tv .crew-calls { top: 11vh; }
  body.sf-dash .sf-hold { font-size: 13px; padding: 4px 10px; gap: 8px; }
  body.sf-dash .sf-hold button { min-height: 30px; padding: 2px 12px; }
  .sf-line { position: fixed; left: 50%; transform: translateX(-50%); bottom: 4vh; z-index: 2147481000; border: .6vmin solid #ffb000; color: #ffb000;
    background: #000; font-size: 7vh; font-weight: 600; padding: 1vh 3vw; white-space: nowrap; letter-spacing: .06em; font-family: "JetBrains Mono", ui-monospace, monospace; }
  .sf-door { position: fixed; left: 2vw; bottom: 2vh; z-index: 2147480000; font-size: 3vh; font-weight: 600; color: #fff; background: #000;
    border: 2px solid #555; padding: .6vh 1.2vw; font-variant-numeric: tabular-nums; letter-spacing: .06em; font-family: "JetBrains Mono", ui-monospace, monospace; }
  .sf-door.near { border-color: #ffd400; color: #ffd400; }
  .sf-door.full { border-color: #ff2a2a; color: #000; background: #ff2a2a; }
  .sf-ear { position: fixed; right: 3vw; bottom: 3vh; z-index: 2147480000; max-width: 44vw; font-size: 3.2vh; color: #fff; background: #000;
    border: 2px solid #8a8a8a; padding: 1.4vh 1.6vw; letter-spacing: .04em; line-height: 1.3; font-family: "JetBrains Mono", ui-monospace, monospace; }
  html.sf-blank, html.sf-blank body { visibility: hidden !important; }
  .crew-call.urgent { border: 2px solid #ff2a2a; color: #ff2a2a; font-size: 1.3em; font-weight: 600; }
  .crew-call.urgent .who { color: inherit; }
  .crew-call.urgent.go { background: #ff2a2a; color: #fff; }
  .crew-call .marks { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: .7em; color: #9a9a9a; letter-spacing: .06em; }
  .crew-call.go .marks { color: inherit; }
  .crew-call .marks:empty { display: none; }
  .crew-call .marks .mini { margin: 0; min-height: 32px; padding: 2px 12px; }
  .crew-call .marks .mini { font-size: 12px; letter-spacing: .08em; }
  body.fit-decks .crew-call.urgent { font-size: 12px; border-width: 1px; }
  body.fit-decks .crew-call .marks { grid-column: auto; flex-wrap: nowrap; font-size: 11px; }
  body.fit-decks .crew-call .marks .mini { min-height: 20px; padding: 0 8px; font-size: 11px; }
  .crew-call.nudge { animation: sf-nudge 1.4s ease-in-out 1; }
  @keyframes sf-nudge { 50% { opacity: .3; } }
  @media (prefers-reduced-motion: reduce) { .crew-call.nudge { animation: none; outline: 3px solid #ffb000; } }`;

  const stop = el('div', 'sf-stop'); stop.hidden = true; stop.setAttribute('role', 'alert');
  const stopLbl = el('small', null, 'SHOW STOP');
  const stopMsg = el('b');
  const stopSub = el('span');
  const clearBtn = el('button', null, 'ALL CLEAR'); clearBtn.type = 'button';
  const stopNote = el('div', 'sf-note');
  stop.append(stopLbl, stopMsg, stopSub);
  const hold = el('div', 'sf-hold'); hold.hidden = true; hold.setAttribute('role', 'status');
  const holdTxt = el('span');
  const resumeBtn = el('button', null, 'RESUME'); resumeBtn.type = 'button';
  hold.append(holdTxt);
  const line = el('div', 'sf-line'); line.hidden = true;
  const door = el('div', 'sf-door'); door.hidden = true;
  const ear = el('div', 'sf-ear'); ear.hidden = true;

  // #137: a page with the box's socket open gets NIGHT SAFETY in the 1/s status (status.safety); it polls only while
  // that hasn't come for 4 s (the socket dropped, or an older box without it).
  let pushedAt = 0;
  function push(j) {
    if (!j || typeof j !== 'object' || typeof j.at !== 'number') return;
    pushedAt = Date.now();
    skew = pushedAt - j.at;
    S = j;
    draw();
    listeners.forEach(f => { try { f(S); } catch (e) {} });
  }

  async function poll() {
    if (Date.now() - pushedAt < 4000) return;
    const t0 = Date.now();
    try {
      const r = await fetch('/api/safety', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json(), t1 = Date.now();
      skew = (t0 + t1) / 2 - j.at;
      S = j;
      draw();
      listeners.forEach(f => { try { f(S); } catch (e) {} });
    } catch (e) { /* keep the last reading: a SHOW STOP stays up while the box is out of reach */ }
  }

  function post(path, body) {
    if (typeof window.post === 'function') return window.post(path, body); // the dashboard's (handles the lock)
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }
  const isUnlocked = () => typeof unlocked === 'undefined' || unlocked;

  let hidden = false; // locked: the message steps aside for 20 s so the crew code can go in, then comes back
  clearBtn.addEventListener('click', async () => {
    if (!isUnlocked()) {
      hidden = true; draw();
      setTimeout(() => { hidden = false; draw(); }, 20000);
      if (typeof needUnlock === 'function') { pending = clearBtn; needUnlock(); }
      return;
    }
    hidden = false;
    const r = await post('/api/safety/allclear', {});
    if (r.ok) { stopNote.textContent = ''; poll(); }
    else if (r.status !== 401) stopNote.textContent = 'ALL CLEAR didn\'t go through. Try again.';
  });
  resumeBtn.addEventListener('click', async () => {
    if (!isUnlocked()) { if (typeof needUnlock === 'function') { pending = resumeBtn; needUnlock(); } return; }
    const r = await post('/api/safety/resume', {});
    if (r.ok) poll();
  });

  function draw() {
    if (!S) return;
    const now = Date.now() - skew;
    const s = S.showStop;
    if (mode === 'hide') { document.documentElement.classList.toggle('sf-blank', !!s); return; }
    stop.hidden = !s || hidden;
    if (s) {
      if (stopMsg.textContent !== s.msg) stopMsg.textContent = s.msg;
      stopSub.textContent = 'SINCE ' + hhmm(s.since) + (mode === 'dash' ? ' · THE DJ STOPS THE MUSIC' : '');
    }
    const h = S.hold;
    const showHold = !!h && mode !== 'stage' && mode !== 'crowd'; // #131 NEXT UP says its own friendly "A SHORT PAUSE"
    hold.hidden = !showHold;
    document.body.classList.toggle('sf-held', showHold);
    if (mode === 'dash' || mode === 'plain') { // the page moves down under the bar instead of hiding behind it
      const pad = showHold ? hold.offsetHeight + 'px' : '';
      if (document.body.style.paddingTop !== pad) document.body.style.paddingTop = pad;
    }
    if (showHold) {
      holdTxt.textContent = holdText(h, now);
      if (mode === 'dash' && h.src === 'box') { if (!resumeBtn.isConnected) hold.append(resumeBtn); }
      else if (resumeBtn.isConnected) resumeBtn.remove();
    }
    const big = mode === 'tv' || mode === 'stage';
    const tl = big && S.tvLine;
    line.hidden = !tl;
    if (tl && line.textContent !== tl) line.textContent = tl;
    const d = big && S.door && S.door.show ? S.door : null;
    door.hidden = !d;
    if (d) { door.textContent = doorText(d); door.className = 'sf-door ' + d.tone; }
    const e = mode === 'tv' && S.hearing && S.hearing.showing ? S.hearing.text : null;
    ear.hidden = !e;
    if (e && ear.textContent !== e) ear.textContent = e;
  }

  function start(m) {
    mode = m || 'plain';
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.body.classList.add('sf-' + mode);
    if (mode === 'dash') stop.append(clearBtn, stopNote);
    if (mode !== 'hide') document.body.append(stop, hold, line, door, ear);
    poll();
    setInterval(() => { if (!document.hidden || mode !== 'dash') poll(); }, 1500);
    setInterval(draw, 500);
  }
  function on(f) { listeners.push(f); }
  const now = () => S;
  return { start, on, now, push, holdText, doorText, mmss, hhmm, post };
})();
if (typeof module !== 'undefined') module.exports = Safety;
