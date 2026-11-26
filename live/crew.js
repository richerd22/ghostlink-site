'use strict';
// CREW CALLS (#79): live calls from HARD STOP panels / the app ("LIGHTS ON", "RELEASING CO2", THE DROP), with who
// called it and a countdown to GO. Shared by the dashboard (NOW) and the TV view. Text nodes only (never HTML).
// Crew.start(el, getCalls, getSkew, {max, goKeep, held}): getCalls() -> [{id, from, txt, goAt, mo}], goAt in the box's clock (ms).
// #107 AT THE DROP: a call with at "drop" / "phrase" reads "CO2 AT THE DROP · 8 BARS" (bars from barMs); opt.held() ->
// status.dropCalls, whose WAITING ones show as "CO2 AT THE DROP · WAITING" (no countdown until a drop is in sight).
const Crew = (() => {
  const AT = { drop: ' AT THE DROP', phrase: ' AT THE NEXT PHRASE' };
  const bars = (c, left) => { const n = c.barMs > 0 ? Math.max(1, Math.ceil(left / c.barMs - 0.02)) : c.bars; return n == null ? null : n + (n === 1 ? ' BAR' : ' BARS'); };
  const label = c => c.txt + (AT[c.at] || '');
  function fmt(ms) {
    const s = Math.ceil(ms / 1000);
    return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + 's';
  }
  // #127: "SEEN 23:41 (BOOTH)" / "DONE 23:42 (LIGHTS)" back to whoever sent it.
  const two = n => String(n).padStart(2, '0');
  const hm = ms => { const d = new Date(ms); return two(d.getHours()) + ':' + two(d.getMinutes()); };
  function marks(c) {
    if (c.done) return 'DONE ' + hm(c.done.at) + ' (' + c.done.by + ')';
    if (c.seen) return 'SEEN ' + hm(c.seen.at) + ' (' + c.seen.by + ')';
    return '';
  }
  const NUDGE_MS = 60000;
  /** #127: pulse once more? Not SEEN 60 s after it arrived, or HARD STOP resent it (re went up). Pure. */
  function nudgeKey(c, now) {
    if (c.seen || c.done) return null;
    const late = c.sentAt != null && now - c.sentAt >= NUDGE_MS;
    if (!late && !c.re) return null;
    return c.id + ':' + (late ? 'late' : '') + ':' + (c.re || 0);
  }
  // opt.max: rows shown (soonest first); opt.goKeep: how long a call stays up after GO (ms); opt.marks: SEEN / DONE
  // buttons on each row (the dashboard), opt.mark(c, done) does the POST. URGENT calls go first, red and bigger.
  function start(el, getCalls, getSkew, opt) {
    const max = (opt && opt.max) || 3, goKeep = (opt && opt.goKeep) || 10000;
    if (!el) return;
    let key = '';
    const nudged = new Set();
    setInterval(() => {
      const now = Date.now() - (getSkew() || 0); // the box's clock
      // #127: a call nobody has SEEN stays up for the box's 30 s after GO (a seen one goes after goKeep, as before)
      // #163 CUES: a cue's reminder (PREP / CONFIRM? / CONFIRMED, `cuest`) is for HARD STOP's panels; the box's own
      // screens show it in the CUES line (cues.js) instead, and the TV never shows it as a call.
      const calls = (getCalls() || []).filter(c => !c.cuest && now - c.goAt < (c.seen || c.done ? goKeep : Math.max(goKeep, 30000)))
        .slice().sort((a, b) => (b.pri === 'urgent') - (a.pri === 'urgent')).slice(0, max);
      const rows = calls.map(c => {
        const left = c.goAt - now, go = left <= 0;
        return { c, go, soon: !go && left < 10000, t: go ? 'GO' : (AT[c.at] && bars(c, left)) || fmt(left) };
      });
      const held = ((opt && opt.held && opt.held()) || []).filter(h => h.state === 'WAITING');
      held.slice(0, Math.max(0, max - rows.length)).forEach(h => rows.push({ c: h, go: false, soon: false, t: 'WAITING' }));
      const pulse = new Set();
      rows.forEach(r => { const n = nudgeKey(r.c, now); if (n && !nudged.has(n)) { nudged.add(n); pulse.add(r.c.id); } });
      const k = rows.map(r => r.c.id + r.t + r.c.txt + marks(r.c) + (r.c.pri || '') + (r.c.queued ? 'q' : '')).join('|');
      if (k === key && !pulse.size) return;
      key = k;
      el.replaceChildren(...rows.map(r => {
        const d = document.createElement('div');
        d.className = 'crew-call' + (r.go ? ' go' : r.soon ? ' soon' : '') + (r.c.wrap ? ' wrap' : '') // #124 WRAP-UP CALLS: bigger
          + (r.c.pri === 'urgent' ? ' urgent' : '') + (pulse.has(r.c.id) ? ' nudge' : '');               // #127 URGENT, the nudge
        const who = document.createElement('span'); who.className = 'who'; who.textContent = (r.c.pri === 'urgent' ? 'URGENT · ' : '') + (r.c.queued ? 'QUEUED · ' : '') + (r.c.from || 'CREW'); // #162: no panel linked yet
        const what = document.createElement('b'); what.textContent = label(r.c);
        const when = document.createElement('span'); when.className = 'when'; when.textContent = r.t;
        d.append(who, what, when);
        const m = marks(r.c);
        if (m || (opt && opt.marks && r.c.goAt != null)) {
          const line = document.createElement('span'); line.className = 'marks'; line.textContent = m;
          if (opt && opt.marks && r.c.goAt != null && !r.c.done) {
            [['SEEN', false], ['DONE', true]].forEach(([t, done]) => {
              if (!done && r.c.seen) return;
              const b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.textContent = t;
              b.addEventListener('click', ev => { ev.stopPropagation(); opt.mark(r.c, done); });
              line.append(b);
            });
          }
          d.append(line);
        }
        return d;
      }));
      el.hidden = !rows.length;
    }, 250);
  }
  // COUNT-IN (mo): the last 10 s of a call go full screen, 10 ... 1, GO (TV only; el = the overlay).
  function countIn(el, getCalls, getSkew) {
    if (!el) return;
    let key = '';
    setInterval(() => {
      const now = Date.now() - (getSkew() || 0);
      const c = (getCalls() || []).find(x => x.mo && !x.cuest && x.goAt - now <= 10000 && now - x.goAt < 3000);
      const t = !c ? '' : c.goAt - now > 0 ? String(Math.ceil((c.goAt - now) / 1000)) : 'GO';
      const k = c ? c.id + t + (c.barMs > 0 ? Math.ceil((c.goAt - now) / c.barMs) : '') : '';
      if (k === key) return;
      key = k;
      el.hidden = !c;
      if (!c) return;
      const n = document.createElement('b'); n.textContent = t;
      const b = AT[c.at] && c.goAt - now > 0 ? bars(c, c.goAt - now) : null;
      const w = document.createElement('span'); w.textContent = label(c) + (b ? ' · ' + b : '');
      el.className = 'crew-countin' + (t === 'GO' ? ' go' : '');
      el.replaceChildren(n, w);
    }, 100);
  }
  return { start, countIn, label, bars, marks, nudgeKey };
})();
if (typeof module !== 'undefined') module.exports = Crew;
