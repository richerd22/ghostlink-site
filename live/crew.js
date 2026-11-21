'use strict';
// CREW CALLS (#79): live calls from HARD STOP panels / the app ("LIGHTS ON", "RELEASING CO2", THE DROP), with who
// called it and a countdown to GO. Shared by the dashboard (NOW) and the TV view. Text nodes only (never HTML).
// Crew.start(el, getCalls, getSkew, {max, goKeep}): getCalls() -> [{id, from, txt, goAt, mo}], goAt in the box's clock (ms).
const Crew = (() => {
  function fmt(ms) {
    const s = Math.ceil(ms / 1000);
    return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + 's';
  }
  // opt.max: rows shown (soonest first); opt.goKeep: how long a call stays up after GO (ms).
  function start(el, getCalls, getSkew, opt) {
    const max = (opt && opt.max) || 3, goKeep = (opt && opt.goKeep) || 10000;
    if (!el) return;
    let key = '';
    setInterval(() => {
      const now = Date.now() - (getSkew() || 0); // the box's clock
      const calls = (getCalls() || []).filter(c => now - c.goAt < goKeep).slice(0, max);
      const rows = calls.map(c => {
        const left = c.goAt - now, go = left <= 0;
        return { c, go, soon: !go && left < 10000, t: go ? 'GO' : fmt(left) };
      });
      const k = rows.map(r => r.c.id + r.t + r.c.txt).join('|');
      if (k === key) return;
      key = k;
      el.replaceChildren(...rows.map(r => {
        const d = document.createElement('div');
        d.className = 'crew-call' + (r.go ? ' go' : r.soon ? ' soon' : '');
        const who = document.createElement('span'); who.className = 'who'; who.textContent = r.c.from || 'CREW';
        const what = document.createElement('b'); what.textContent = r.c.txt;
        const when = document.createElement('span'); when.className = 'when'; when.textContent = r.t;
        d.append(who, what, when);
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
      const c = (getCalls() || []).find(x => x.mo && x.goAt - now <= 10000 && now - x.goAt < 3000);
      const t = !c ? '' : c.goAt - now > 0 ? String(Math.ceil((c.goAt - now) / 1000)) : 'GO';
      const k = c ? c.id + t : '';
      if (k === key) return;
      key = k;
      el.hidden = !c;
      if (!c) return;
      const n = document.createElement('b'); n.textContent = t;
      const w = document.createElement('span'); w.textContent = c.txt;
      el.className = 'crew-countin' + (t === 'GO' ? ' go' : '');
      el.replaceChildren(n, w);
    }, 100);
  }
  return { start, countIn };
})();
