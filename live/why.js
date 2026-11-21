// SAY WHY (#93): plain reasons on the dashboard. Richard, Nov 20: "lost GHOST LINK a few times and it never says why ...
// no waveform on a deck, no option to reload / reason why". Two things, both from what the box already knows:
//  1. A deck missing its title or waveform (or a player that dropped off) says why on its own waveform strip, how long,
//     and, after 10 s, offers RELOAD (asks the player again for the details; crew code or owner; once per 10 s a deck).
//  2. When this page loses the box, the alert says which kind of lost: this phone offline, the box restarting, or the
//     box not answering, and that it's retrying.
// Own file, own CSS block (app.css "#93 SAY WHY"); app.js only calls Why.lostAlert() and passes the `bye` message.
'use strict';
const Why = (() => {
  const SHOW_AFTER_MS = 5000; // a normal load takes a second or two: say nothing until it's been a while
  let byeAt = 0, lostAt = 0, probe = null, probeT = 0;
  const notes = {}; // player -> {text, until}: what the last RELOAD tap said

  const boxNow = () => Date.now() - ((S && S.skew) || 0);
  const ago = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 90 ? s + ' s' : Math.round(s / 60) + ' min'; };

  function entries() {
    const w = S.status && S.status.why;
    return (w && Array.isArray(w.decks)) ? w.decks : [];
  }

  /** The text for one deck, or null when it's too early to say anything. */
  function line(e) {
    const age = boxNow() - e.since;
    if (!e.lost && age < SHOW_AFTER_MS) return null;
    const head = e.lost ? 'LOST ' + ago(age) + ' AGO' : e.missing === 'details' ? 'NO TITLE YET' : 'NO WAVEFORM';
    const tail = e.lost ? 'listening for it' : e.trying ? ago(age) + ', retrying' : ago(age);
    return { head, why: e.why, tail, reload: !!e.reload && !e.lost, warn: !e.lost && !e.trying };
  }

  function overlay(host, canvas, key) {
    let o = host.querySelector(':scope > .why-o');
    if (!o) {
      host.classList.add('why-host');
      o = document.createElement('div');
      o.className = 'why-o';
      o.innerHTML = '<span class="why-h"></span><span class="why-t"></span><span class="why-a"></span><button type="button" class="mini why-r">RELOAD</button>';
      o.querySelector('.why-r').addEventListener('click', ev => { ev.stopPropagation(); reload(+o.dataset.player, o); });
      host.appendChild(o);
    }
    o.dataset.player = key;
    if (canvas) {
      o.classList.remove('why-line');
      const st = o.style, px = v => v + 'px';
      if (st.left !== px(canvas.offsetLeft)) st.left = px(canvas.offsetLeft);
      if (st.top !== px(canvas.offsetTop)) st.top = px(canvas.offsetTop);
      if (st.width !== px(canvas.offsetWidth)) st.width = px(canvas.offsetWidth);
      if (st.height !== px(canvas.offsetHeight)) st.height = px(canvas.offsetHeight);
      o.classList.toggle('roomy', canvas.offsetHeight >= 64); // a tall strip: the whole reason, wrapped
    } else {
      o.classList.add('why-line'); // an empty tile (a lost player): a line under its state, in the flow
      o.removeAttribute('style');
    }
    return o;
  }

  function fill(o, l, p) {
    const n = notes[p] && notes[p].until > Date.now() ? notes[p].text : '';
    const set = (sel, t) => { const x = o.querySelector(sel); if (x.textContent !== t) x.textContent = t; };
    set('.why-h', l.head);
    set('.why-t', n || l.why); // text nodes only
    set('.why-a', n ? '' : l.tail);
    o.title = l.head + ': ' + l.why;
    o.classList.toggle('warn', l.warn);
    o.querySelector('.why-r').hidden = !l.reload;
  }

  function clearAll(keep) {
    document.querySelectorAll('.why-o').forEach(o => { if (!keep.has(o)) o.remove(); });
  }

  /** Once a second and on every status: put each deck's reason on its waveform strip (tiles and STACKED rows). */
  function render() {
    if (!S.status) return;
    const keep = new Set();
    for (const e of entries()) {
      const l = line(e);
      if (!l) continue;
      const p = e.n;
      const t = typeof tiles !== 'undefined' && tiles[p];
      if (t && t.root && !t.root.hidden) {
        const c = t.root.querySelector('canvas.detail');
        const visible = c && c.offsetWidth > 0 && c.offsetHeight > 0;
        if (visible || t.shape === 'empty') {
          const o = overlay(t.root, visible ? c : null, p);
          fill(o, l, p);
          keep.add(o);
        }
      }
      const row = document.querySelector(`#stack .srow[data-player="${p}"]`);
      const rc = row && !row.hidden && row.querySelector('canvas');
      if (rc && rc.offsetWidth > 0 && rc.offsetHeight > 0) {
        const o = overlay(row, rc, p);
        fill(o, l, p);
        keep.add(o);
      }
    }
    clearAll(keep);
  }

  async function reload(p, o) {
    const b = o.querySelector('.why-r');
    b.disabled = true;
    try {
      const r = await post('/api/reload/' + p);
      if (r.status === 401) return; // post() asked for the password; RELOAD stays there to tap again
      const j = await r.json().catch(() => ({}));
      notes[p] = { text: r.ok ? 'Asked the player again...' : (j.error || "Couldn't ask (" + r.status + ")"), until: Date.now() + 6000 };
    } catch (e) {
      notes[p] = { text: "Couldn't reach the box.", until: Date.now() + 6000 };
    } finally {
      setTimeout(() => { b.disabled = false; }, 10000); // the box takes one RELOAD per deck per 10 s
      render();
    }
  }

  // ---------- the connection ----------

  /** Is the box there? A quick look while the live feed is down: answers, refuses at once, or says nothing. */
  function check() {
    clearTimeout(probeT);
    if (typeof sock !== 'undefined' && sock && sock.readyState === 1) { probe = null; return; }
    if (!navigator.onLine) { probe = 'offline'; say(); probeT = setTimeout(check, 3000); return; }
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t0 = Date.now();
    const timer = setTimeout(() => ctl && ctl.abort(), 3500);
    fetch('/api/hardstop', { cache: 'no-store', signal: ctl && ctl.signal })
      .then(r => { probe = r.ok ? 'answers' : 'refuses'; })
      .catch(() => { probe = Date.now() - t0 < 1500 ? 'refuses' : 'silent'; })
      .finally(() => { clearTimeout(timer); say(); probeT = setTimeout(check, 4000); });
  }

  function say() {
    if (typeof sock !== 'undefined' && sock && sock.readyState === 1) return;
    setAlert(lostAlert());
  }

  /** The alert while this page has lost the box: what kind of lost, how long, and that it's retrying. */
  function lostAlert() {
    if (!lostAt) { lostAt = Date.now(); setTimeout(check, 300); }
    const since = ' Lost ' + ago(Date.now() - lostAt) + ' ago; retrying every few seconds.';
    if (!navigator.onLine || probe === 'offline')
      return { title: "This phone is offline", fix: "Its Wi-Fi is off or dropped. Turn Wi-Fi on and join the box's network again." + since, sticky: true };
    if (Date.now() - byeAt < 120000)
      return { title: 'GHOST LINK is restarting', fix: 'Back in about 20 seconds; this page reconnects by itself.' + since, sticky: true };
    if (probe === 'answers')
      return { title: 'Reconnecting to GHOST LINK', fix: 'The box answers; the live feed is coming back.' + since, sticky: true };
    if (probe === 'refuses')
      return { title: "GHOST LINK isn't answering", fix: 'The box may be restarting (back in about 20 s). If this stays, check it has power.' + since, sticky: true };
    if (probe === 'silent')
      return { title: "The box isn't answering", fix: 'Out of Wi-Fi range, unplugged, or this phone moved to another Wi-Fi. Check you are on the same Wi-Fi as the box.' + since, sticky: true };
    return { title: 'Lost connection to GHOST LINK', fix: 'Reconnecting. Check this phone is on the same Wi-Fi as the box.' + since, sticky: true };
  }

  function bye() { byeAt = Date.now(); }

  // Connected again: forget the last loss.
  setInterval(() => {
    if (typeof sock !== 'undefined' && sock && sock.readyState === 1) { if (lostAt) { lostAt = 0; probe = null; clearTimeout(probeT); } }
    else if (lostAt) say();
    try { render(); } catch (e) { /* reasons are extras: never break the dashboard */ }
  }, 1000);
  addEventListener('offline', () => { if (lostAt) { probe = 'offline'; say(); } });

  return { render, lostAlert, bye };
})();
