'use strict';
// SET INSIGHTS (#147): setinsights.html. THE NIGHT'S JOURNEY (tempo line, a rough energy line, the key path, who was on
// air when), CHANGE-OVERS (each one's tempo change, key move and blend, in words that describe, never grade) and
// ACROSS NIGHTS (played here before, each DJ's repeats, the box's most played, the room's usual hours).
// From GET /api/night/journey + /api/night/across (crew code or owner; tonight's while the music is on: the owner).
// Read-only. Text nodes only (titles and names come from the network); the chart is SVG built node by node.
// The helpers are pure (src/test/js/setinsights.test.js).
const SetInsights = (() => {
  const pad = n => String(n).padStart(2, '0');
  function hhmm(ms) { if (ms == null) return '--:--'; const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /** "2h 05m" / "42 min". */
  function dur(min) { if (min == null) return '--'; return min >= 60 ? Math.floor(min / 60) + 'h ' + pad(min % 60) + 'm' : min + ' min'; }
  /** 23 -> "11 PM", 0 -> "12 AM". */
  function hour(h) { return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); }
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  /** "2026-11-12" -> "NOV 12". */
  function day(n) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(n || '')); return m ? MON[+m[2] - 1] + ' ' + (+m[3]) : ''; }
  const name = t => (t && t.title ? t.title : 'Unknown track') + (t && t.artist ? ' - ' + t.artist : '');

  /** The chart's frame: time from the first track to the last one's end; tempo with a little room. */
  function frame(journey) {
    const pts = (journey || []).filter(p => p.at != null);
    if (!pts.length) return null;
    const t0 = Math.min(...pts.map(p => p.at)), t1 = Math.max(...pts.map(p => Math.max(p.end || p.at, p.at)));
    const b = pts.map(p => p.bpm).filter(x => x > 40);
    const lo = b.length ? Math.floor(Math.min(...b) - 2) : 100, hi = b.length ? Math.ceil(Math.max(...b) + 2) : 140;
    return { t0, t1: t1 > t0 ? t1 : t0 + 60000, lo, hi: hi > lo ? hi : lo + 1 };
  }

  /** The tempo line as runs of [x, y] (a track with no tempo breaks it). Each track = a flat step over its time on air. */
  function steps(journey, f, x, y) {
    const runs = [];
    let cur = null;
    for (const p of journey || []) {
      if (!(p.bpm > 40)) { cur = null; continue; }
      if (!cur) { cur = []; runs.push(cur); }
      cur.push([x(p.at), y(p.bpm)], [x(Math.max(p.end || p.at, p.at)), y(p.bpm)]);
    }
    return runs;
  }

  /** Consecutive tracks by one DJ as one band: [{dj, from, to}]. */
  function bands(journey) {
    const out = [];
    for (const p of journey || []) {
      const last = out[out.length - 1], k = String(p.dj || '').trim().toLowerCase();
      if (last && last.k === k) last.to = Math.max(last.to, p.end || p.at);
      else out.push({ k, dj: p.dj || '', from: p.at, to: Math.max(p.end || p.at, p.at) });
    }
    return out.map(({ dj, from, to }) => ({ dj, from, to }));
  }

  /** "12 smooth · 3 a step · 1 a big jump" from the box's counts, biggest first, zeros left out. */
  const TEMPO = { SAME: 'same tempo', SMOOTH: 'smooth', STEP: 'a step', JUMP: 'a big jump', DOUBLE: 'double time', HALF: 'half time' };
  const KEYS = { match: 'in key', lift: 'a lift', apart: 'keys apart' };
  const BLENDS = { CUT: 'cuts', QUICK: 'quick mixes', BLEND: 'blends', LONG: 'long blends', GAP: 'short quiets', BREAK: 'breaks' };
  function countLine(counts, words) {
    return Object.entries(counts || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => n + ' ' + (words[k] || k.toLowerCase())).join(' · ');
  }

  /** ALL / HANDOVERS (a new DJ) / BIG MOVES (a big tempo jump or keys apart). */
  function pick(list, mode) {
    if (mode === 'hand') return list.filter(c => c.handover);
    if (mode === 'big') return list.filter(c => (c.tempo && c.tempo.kind === 'JUMP') || (c.key && c.key.fit === 'apart'));
    return list;
  }

  /** The room's usual hour vs tonight: "+2.1 BPM" / "same" / "" when either is missing. */
  function vs(usual, tonight) {
    if (usual == null || tonight == null) return '';
    const d = Math.round((tonight - usual) * 10) / 10;
    return Math.abs(d) < 0.5 ? 'same' : (d > 0 ? '+' : '') + d.toFixed(1) + ' BPM';
  }

  /** "last here NOV 12 · LIL TICK · 2 times" */
  function hereLine(h) {
    return ['last here ' + day(h.lastNight), h.lastDj && h.lastDj.charAt(0) !== '(' ? h.lastDj : null, h.times > 1 ? h.times + ' times' : null].filter(Boolean).join(' · ');
  }

  // ---------- the page ----------
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  function num(host, label, value) { const d = el('div'); d.append(el('small', null, label), el('b', null, value)); host.append(d); }
  function row(host, a, b) { const r = el('div', 'row'); r.append(el('span', null, a), el('b', null, b)); host.append(r); return r; }
  const q = () => new URLSearchParams(location.search);

  function chart(j, width) {
    const f = frame(j.journey);
    if (!f) return null;
    const W = Math.round(Math.max(320, Math.min(900, width || 900))), H = 230; // drawn at the card's own width: labels stay 10 px on a phone
    const L = 34, R = 34, T = 8, B = 46, ph = H - T - B;
    const x = t => L + (t - f.t0) / (f.t1 - f.t0) * (W - L - R), y = b => T + ph - (b - f.lo) / (f.hi - f.lo) * ph;
    const ye = e => T + ph - (e - 1) / 9 * ph;
    const s = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': 'Tempo and energy through the night' });
    for (const b of [f.lo + 1, Math.round((f.lo + f.hi) / 2), f.hi - 1]) {
      s.append(sv('line', { x1: L, x2: W - R, y1: y(b), y2: y(b), stroke: 'var(--line)', 'stroke-width': 1 }));
      s.append(sv('text', { x: 0, y: y(b) + 3 }, String(b)));
    }
    const hourMs = 3600000;
    for (let t = Math.ceil(f.t0 / hourMs) * hourMs; t <= f.t1; t += hourMs) {
      const d = new Date(t);
      if (d.getMinutes() !== 0) continue; // whole clock hours only (time zones with half hours: skip)
      s.append(sv('line', { x1: x(t), x2: x(t), y1: T, y2: T + ph, stroke: 'var(--line)', 'stroke-width': 1 }));
      s.append(sv('text', { x: x(t) + 2, y: T + ph + 12 }, hour(d.getHours())));
    }
    if (j.journey.some(p => p.energy)) {
      const pts = j.journey.filter(p => p.energy).map(p => x((p.at + Math.max(p.end || p.at, p.at)) / 2) + ',' + ye(p.energy)).join(' ');
      s.append(sv('polyline', { points: pts, fill: 'none', stroke: 'var(--warn)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3', opacity: .8 }));
      s.append(sv('text', { x: W - R + 4, y: T + 8 }, 'HIGH'), sv('text', { x: W - R + 4, y: T + ph }, 'LOW'));
    }
    for (const r of steps(j.journey, f, x, y)) s.append(sv('polyline', { points: r.map(p => p.join(',')).join(' '), fill: 'none', stroke: 'var(--fg)', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    // key moves that land apart: a small open ring where the track came in (a fact, not a warning: no red)
    for (const c of j.changeovers || []) if (c.key && c.key.fit === 'apart' && c.to && c.to.bpm) s.append(sv('circle', { cx: x(c.at), cy: y(c.to.bpm), r: 3.5, fill: 'var(--bg)', stroke: 'var(--fg)', 'stroke-width': 1.5 }));
    // who was on air: one band per DJ stretch
    bands(j.journey).forEach((b, i) => {
      const x0 = x(b.from), x1 = Math.max(x0 + 1, x(b.to));
      s.append(sv('rect', { x: x0, y: H - 22, width: x1 - x0, height: 8, fill: 'var(--fg)', opacity: i % 2 ? .35 : .7 }));
      if (x1 - x0 > 60) s.append(sv('text', { x: x0 + 2, y: H - 3 }, b.dj && b.dj.charAt(0) !== '(' ? b.dj.slice(0, Math.floor((x1 - x0) / 7)) : 'NO DJ SET'));
    });
    return s;
  }

  function render(j, a, rel) {
    const c = $('card');
    c.replaceChildren();
    c.append(el('h1', null, 'SET INSIGHTS'));
    c.append(el('div', 'sub', [j.night, j.practice ? 'PRACTICE' : null, j.tonight ? 'TONIGHT' : null].filter(Boolean).join(' · ')));
    const s = j.summary || {};
    if (!(j.journey || []).length) { c.append(el('div', 'line', 'Nothing went on air that night.')); return; }

    // THE NIGHT'S JOURNEY
    c.append(el('h2', null, "THE NIGHT'S JOURNEY"));
    const n = el('div', 'nums');
    num(n, 'TRACKS', String(s.tracks));
    num(n, 'CHANGE-OVERS', String(s.changeovers));
    if (s.handovers) num(n, 'DJ HANDOVERS', String(s.handovers));
    if (j.bpmLow) num(n, 'MOST OF THE NIGHT', (j.bpmLow === j.bpmHigh ? j.bpmLow : Math.round(j.bpmLow) + '-' + Math.round(j.bpmHigh)) + ' BPM');
    if (s.keysKnown) num(n, 'IN KEY', Math.round((s.keys.match || 0) * 100 / s.keysKnown) + '%');
    c.append(n);
    const ch = chart(j, c.clientWidth - 32);
    if (ch) {
      c.append(ch);
      const lg = el('div', 'legend');
      const item = (cls, t) => { const sp = el('span'); sp.append(el('i', cls), document.createTextNode(t)); lg.append(sp); };
      item('', 'tempo, each track');
      if (j.journey.some(p => p.energy)) item('en', j.hasMood ? 'energy (tempo + rekordbox mood, a rough feel)' : 'energy (from tempo only, a rough feel)');
      if ((j.changeovers || []).some(x => x.key && x.key.fit === 'apart')) item('apart', 'keys apart');
      lg.append(el('span', null, 'bars under = who was on air'));
      c.append(lg);
    }
    const kp = s.keyPath || [];
    if (kp.length) {
      c.append(el('h3', null, 'KEY PATH'));
      const k = el('div', 'keys');
      kp.forEach((p, i) => {
        const prev = kp[i - 1], mv = prev ? keyFit(prev.key, p.key) : null;
        const sp = el('span', mv || null, p.key);
        if (p.n > 1) sp.append(el('em', null, ' ×' + p.n));
        k.append(sp);
      });
      c.append(k);
      c.append(el('div', 'line', 'Camelot keys in the order they went out. A white box = a lift (two steps up, a semitone, or one step into the other mood), dashed = keys apart, grey = in key.'));
    }

    // ON AIR
    const on = (j.onAir || []).filter(d => d.ms > 0);
    if (on.length) {
      c.append(el('h2', null, 'ON AIR'));
      for (const d of on) {
        const r = row(c, d.dj && d.dj.charAt(0) !== '(' ? d.dj : 'NO DJ SET', dur(d.min) + (d.share != null ? ' · ' + d.share + '%' : '') + ' · ' + d.tracks + (d.tracks === 1 ? ' track' : ' tracks') + ' · ' + hhmm(d.from) + '-' + hhmm(d.to));
        if (djLink(d.dj)) { const a = el('a', 'djlink', d.dj); a.href = djLink(d.dj); r.firstChild.replaceWith(a); } // #154 their DJ PROFILE
        const bar = el('div', 'share'), i = el('i'); i.style.width = Math.max(1, d.share || 0) + '%'; bar.append(i); c.append(bar);
      }
      c.append(el('div', 'line', j.hasMixLog ? 'Time out loud. A blend into the next DJ counts once.' : 'Each track until the next one went on (never longer than the track).'));
    }

    // CHANGE-OVERS
    const list = j.changeovers || [];
    if (list.length) {
      c.append(el('h2', null, 'CHANGE-OVERS'));
      if (s.tempoKnown) row(c, 'Tempo', countLine(s.tempo, TEMPO));
      if (s.keysKnown) row(c, 'Keys', countLine(s.keys, KEYS));
      if (s.blendsKnown) row(c, 'Blends', countLine(s.blends, BLENDS));
      if (s.longestBlend) row(c, 'Longest blend', s.longestBlend.blend.words + ' · into ' + name(s.longestBlend.to));
      if (s.biggestTempo) row(c, 'Biggest tempo change', (s.biggestTempo.tempo.delta > 0 ? '+' : '') + s.biggestTempo.tempo.delta + ' BPM · into ' + name(s.biggestTempo.to));
      if (!j.hasMixLog) c.append(el('div', 'line', 'Blend lengths need the mix log (two decks out loud at once); this night has none, so only tempo and keys.'));
      const fl = el('div', 'filters noprint'), ul = el('ul');
      let mode = 'all', all = false;
      const draw = () => {
        ul.replaceChildren();
        const l = pick(list, mode), shown = all ? l : l.slice(0, 40);
        for (const x of shown) ul.append(change(x));
        if (!l.length) ul.append(el('li', 'line', mode === 'hand' ? 'One DJ all night: no handovers.' : 'None: every change-over stayed close in tempo and key.'));
        if (l.length > shown.length) { const li = el('li'), b = el('button', null, 'SHOW ALL ' + l.length); b.type = 'button'; b.onclick = () => { all = true; draw(); }; li.append(b); ul.append(li); }
      };
      for (const [m, t] of [['all', 'ALL'], ['hand', 'HANDOVERS'], ['big', 'BIG MOVES']]) {
        const b = el('button', m === mode ? 'on' : null, t);
        b.type = 'button';
        b.onclick = () => { mode = m; all = false; fl.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
        fl.append(b);
      }
      c.append(fl, ul);
      draw();
    }

    // ACROSS NIGHTS
    if (a) across(c, a);
    if (rel) related(c, rel); // #154 RELATED TRACKS
    c.append(el('div', 'foot', 'Read from PLAYED and the mix log on this box. Energy is a rough feel from tempo and rekordbox phrase moods, not a measurement. Practice nights never count across nights.'));
  }

  /** The key move's fit for the chip colour (the box's own words come per change-over; the path folds repeats). */
  function keyFit(a, b) {
    const pa = /^(\d+)([AB])$/.exec(a || ''), pb = /^(\d+)([AB])$/.exec(b || '');
    if (!pa || !pb) return null;
    const d = ((+pb[1] - +pa[1]) % 12 + 12) % 12, same = pa[2] === pb[2];
    if ((same && (d === 0 || d === 1 || d === 11)) || (!same && d === 0)) return null;
    if ((same && (d === 2 || d === 5 || d === 7)) || (!same && (d === 1 || d === 11))) return 'lift';
    return 'apart';
  }

  function change(x) {
    const li = el('li', 'co');
    li.append(el('div', 'tm', hhmm(x.at)));
    const tt = el('div', 'tt');
    tt.append(document.createTextNode(x.to && x.to.title ? x.to.title : 'Unknown track'));
    if (x.from && x.from.title) tt.append(el('span', null, ' after ' + x.from.title));
    li.append(tt);
    if (x.handover) li.append(el('div', 'hand', 'HANDOVER · ' + ((x.from.dj || '').charAt(0) === '(' ? 'NO DJ SET' : x.from.dj) + ' → ' + ((x.to.dj || '').charAt(0) === '(' ? 'NO DJ SET' : x.to.dj)));
    const w = el('div', 'w');
    const bit = (t, cls) => { if (w.childNodes.length) w.append(document.createTextNode(' · ')); w.append(el('b', cls || null, t)); };
    if (x.tempo) bit(x.tempo.words + (x.tempo.kind !== 'SAME' && x.tempo.kind !== 'DOUBLE' && x.tempo.kind !== 'HALF' ? ' (' + (x.tempo.delta > 0 ? '+' : '') + x.tempo.delta + ' BPM)' : ''), x.tempo.kind === 'JUMP' ? 'jump' : null);
    if (x.key) bit(x.key.from + ' → ' + x.key.to + ' ' + x.key.words);
    if (x.blend) bit(x.blend.words);
    if (!w.childNodes.length) w.textContent = 'no tempo or key on file';
    li.append(w);
    return li;
  }

  /** The first n rows, then one SHOW ALL button (calm by default, everything one tap away). */
  function more(c, list, draw, n) {
    const box = el('div');
    c.append(box);
    list.slice(0, n).forEach(x => draw(box, x));
    if (list.length <= n) return;
    const b = el('button', 'noprint', 'SHOW ALL ' + list.length);
    b.type = 'button';
    b.onclick = () => { b.remove(); list.slice(n).forEach(x => draw(box, x)); };
    box.append(b);
  }

  function across(c, a) {
    c.append(el('h2', null, 'ACROSS NIGHTS'));
    if (!a.otherNights) { c.append(el('div', 'line', a.practice ? 'A practice night: across-night numbers compare show nights only.' : 'The first show night on this box: nothing to compare with yet.')); return; }
    row(c, 'Other show nights on this box', String(a.otherNights) + (a.venueKnown ? ' · ' + a.hereNights + ' here' : ''));
    if (a.distinct) row(c, 'Tracks that went out before', a.beforeAnywhere + ' of ' + a.distinct);
    const here = a.hereBefore || [];
    c.append(el('h3', null, 'PLAYED HERE BEFORE'));
    if (!a.venueKnown) c.append(el('div', 'line', 'No venue set that night, so "here" is unknown. Pick the venue in STATUS -> VENUE.'));
    else if (!here.length) c.append(el('div', 'line', 'Nothing from that night went out here on an earlier night.'));
    else more(c, here, (box, h) => row(box, name(h), hereLine(h)), 8);
    for (const d of a.djs || []) {
      c.append(el('h3', null, d.dj + ' · OTHER NIGHTS'));
      if (!d.nightsBefore) { c.append(el('div', 'line', 'Their first night on this box.')); continue; }
      c.append(el('div', 'line', d.repeats + ' of ' + d.tracks + ' tracks also went out on their ' + d.nightsBefore + ' earlier ' + (d.nightsBefore === 1 ? 'night' : 'nights') + ' on this box.'));
      more(c, d.list || [], (box, t) => row(box, name(t), (t.nights > 1 ? t.nights + ' nights · ' : '') + 'last ' + day(t.lastNight)), 5);
    }
    const most = a.mostPlayed || [];
    if (most.length) {
      c.append(el('h3', null, 'MOST PLAYED ON THIS BOX'));
      for (const m of most) row(c, name(m), m.plays + ' plays · ' + m.nights + ' nights · usually ~' + hour(m.usualHour));
    }
    const mh = a.mostPlayedHere || [];
    if (mh.length) {
      c.append(el('h3', null, 'MOST PLAYED HERE'));
      for (const m of mh) row(c, name(m), m.plays + ' plays · ' + m.nights + ' nights · last ' + day(m.lastNight));
    }
    const hrs = a.hours || [];
    if (hrs.length && a.hoursScope) {
      c.append(el('h3', null, a.hoursScope === 'here' ? "THIS ROOM'S USUAL HOURS" : 'THE USUAL HOURS (ALL NIGHTS)'));
      const t = el('table', 'hours'), hd = el('tr');
      for (const h of ['HOUR', 'USUAL BPM', 'THIS NIGHT', '', 'TRACKS USUAL / THIS']) hd.append(el('th', null, h));
      t.append(hd);
      for (const h of hrs) {
        const r = el('tr');
        for (const v of [hour(h.hour), h.usualBpm != null ? String(h.usualBpm) : '--', h.tonightBpm != null ? String(h.tonightBpm) : '--', vs(h.usualBpm, h.tonightBpm),
          (h.usualTracks != null ? String(h.usualTracks) : '--') + ' / ' + h.tonightTracks]) r.append(el('td', null, v));
        t.append(r);
      }
      c.append(t);
      c.append(el('div', 'line', 'Average tempo of what went out in each hour, on ' + a.hoursNights + ' other ' + (a.hoursNights === 1 ? 'night' : 'nights') + (a.hoursScope === 'here' ? ' here' : '') + ', against this night.'));
    }
  }

  // ---------- #154 RELATED TRACKS: what usually follows each track here ----------
  /** The DJ page for a name, or null for "no DJ set" and the names the box made up (SOUNDCHECK, NEXT DJ, SET 2). */
  function djLink(dj) {
    const d = String(dj || '').trim();
    if (!d || d.charAt(0) === '(' || d === 'SOUNDCHECK' || d === 'NEXT DJ' || /^SET \d+$/.test(d)) return null;
    return 'dj.html?dj=' + encodeURIComponent(d);
  }
  /** "usually Glass Hour - Pell · 3 times, 2 nights" (the first follower), more after " · then ". */
  function nextLine(n) {
    if (!n) return '';
    return name(n) + ' · ' + n.count + ' times' + (n.nights > 1 ? ', ' + n.nights + ' nights' : '');
  }
  /** What followed it that night, in words: "then: X · AS USUAL" / "then: X" / "" (the night ended there). */
  function thenLine(t) {
    if (!t || !t.then) return '';
    return 'that night: ' + name(t.then) + (t.asUsual ? ' · AS USUAL' : '');
  }
  function related(c, r) {
    c.append(el('h2', null, 'RELATED TRACKS'));
    const list = r.tracks || [];
    if (!list.length) {
      c.append(el('div', 'line', r.nights < 2 ? 'Once a few show nights are on this box, this shows what usually comes after each track here.'
        : 'No track from that night has a usual follower here yet (the same next track at least ' + r.min + ' times).'));
      return;
    }
    c.append(el('div', 'line', 'What usually came next after each of that night\'s tracks, on ' + r.nights + ' show ' + (r.nights === 1 ? 'night' : 'nights') + ' here' +
      (r.asUsual ? '. ' + r.asUsual + ' went the usual way that night.' : '.')));
    more(c, list, (box, t) => {
      const li = el('div', 'rel');
      li.append(el('div', 'tt', name(t)));
      (t.next || []).forEach((n, i) => li.append(el('div', 'w', (i ? 'or ' : 'usually ') + nextLine(n))));
      const th = thenLine(t);
      if (th) li.append(el('div', 'w dim', th));
      box.append(li);
    }, 8);
  }

  async function nights(cur) {
    const p = $('pick');
    try {
      const ns = await (await fetch('/api/nights', { cache: 'no-store' })).json();
      const list = Array.isArray(ns) ? ns.slice().sort().reverse() : [];
      if (cur && !list.includes(cur)) list.unshift(cur);
      p.replaceChildren(...list.slice(0, 120).map(n => new Option(n, n, n === cur, n === cur)));
    } catch (e) { p.hidden = true; }
    p.onchange = () => { location.search = '?night=' + encodeURIComponent(p.value); };
  }

  let timer = 0;
  async function load() {
    const night = q().get('night') || '';
    const qs = night ? '?night=' + encodeURIComponent(night) : '';
    let r;
    try { r = await fetch('/api/night/journey' + qs, { cache: 'no-store' }); }
    catch (e) { $('msg').textContent = "Couldn't reach the box. Check the Wi-Fi and reload."; return; }
    if (r.status === 401 || r.status === 403) {
      const j = await r.json().catch(() => ({}));
      $('msg').hidden = false;
      $('msg').textContent = r.status === 401 ? 'SET INSIGHTS are for the crew: enter the password or tonight\'s crew code.' : (j.error || 'Not from here.');
      $('unlock').hidden = !(r.status === 401 || j.owner);
      if (!$('unlock').hidden) $('pw').focus();
      $('card').hidden = true;
      return;
    }
    if (!r.ok) { $('msg').textContent = 'Nothing on file for that night.'; return; }
    const j = await r.json();
    let a = null;
    try { const ra = await fetch('/api/night/across' + qs, { cache: 'no-store' }); if (ra.ok) a = await ra.json(); } catch (e) {}
    let rel = null; // #154 RELATED TRACKS
    try { const rr = await fetch('/api/night/related' + qs, { cache: 'no-store' }); if (rr.ok) rel = await rr.json(); } catch (e) {}
    $('msg').hidden = true;
    $('unlock').hidden = true;
    $('card').hidden = false;
    render(j, a, rel);
    if (!$('pick').options.length) nights(j.night);
    $('report').href = 'night.html?night=' + encodeURIComponent(j.night);
    document.title = 'GHOST LINK SET INSIGHTS ' + j.night;
    clearTimeout(timer);
    if (j.tonight) timer = setTimeout(load, 60000); // tonight: a quiet refresh each minute
  }

  function page() {
    $('print').addEventListener('click', () => window.print());
    $('unlock').addEventListener('submit', async e => {
      e.preventDefault();
      const r = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) }).catch(() => null);
      $('pw').value = '';
      if (r && r.ok) load();
      else $('msg').textContent = 'Wrong password or code. After 5 tries, wait a minute.';
    });
    load();
  }

  return { hhmm, dur, hour, day, frame, steps, bands, countLine, pick, vs, hereLine, keyFit, TEMPO, KEYS, BLENDS, page, djLink, nextLine, thenLine };
})();
if (typeof module !== 'undefined') module.exports = SetInsights;
