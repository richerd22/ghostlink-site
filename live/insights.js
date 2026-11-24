'use strict';
// THE NIGHT IN NUMBERS (PLAYED view): everything we can work out from what went on air. Pace, mixing, keys, genres,
// decks, pitch, repeats, each DJ, tracks per hour, and every night on file added up.
// Read-only: it only reads the played list, /api/history/meta (key, genre, length per track), /api/stats and
// /api/insights (#64: MIXING, ENERGY, THE DECKS and a richer DJS card, worked out on the box from the mix log).
// Lives in its own file; if anything here throws, the rest of the dashboard carries on.
const Insights = (() => {
  const box = $('insights');
  let meta = {}, metaFor = null, metaLen = -1, allTime = null, allAt = 0, busy = false;

  const k = t => t.at + '|' + t.player;
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '--';
  const dur = ms => { const m = Math.round(ms / 60000); return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min'; };
  const name = t => esc(t.title) + (t.artist ? ' <span>' + esc(t.artist) + '</span>' : '');
  const count = arr => { const c = {}; arr.forEach(x => { if (x) c[x] = (c[x] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };

  async function loadMeta(night, len) {
    if (busy || (metaFor === night && metaLen === len)) return;
    busy = true;
    try {
      const r = await (await fetch('/api/history/meta' + (viewNight ? '?night=' + encodeURIComponent(viewNight) : ''))).json();
      meta = {}; (r || []).forEach(m => { meta[m.at + '|' + m.player] = m; });
      metaFor = night; metaLen = len;
    } catch (e) { metaFor = night; metaLen = len; }
    busy = false;
    draw();
  }
  async function loadAll() {
    if (Date.now() - allAt < 120000) return;
    allAt = Date.now();
    try { allTime = await (await fetch('/api/stats')).json(); draw(); } catch (e) {}
  }

  // The box's own numbers (#64, /api/insights): mixes from the mix log (two decks out loud at once), cuts vs blends,
  // energy, loops, pitch, silences. Asked again when the list grows, or every 30 s for tonight (a mix in progress).
  let srv = null, srvFor = null, srvLen = -1, srvAt = 0, srvBusy = false;
  async function loadServer(night, len) {
    if (srvBusy) return;
    if (srvFor === night && srvLen === len && (viewNight || Date.now() - srvAt < 30000)) return;
    srvBusy = true;
    try {
      const r = await fetch('/api/insights' + (viewNight ? '?night=' + encodeURIComponent(viewNight) : ''));
      if (r.ok) srv = await r.json();
    } catch (e) {}
    srvFor = night; srvLen = len; srvAt = Date.now(); srvBusy = false;
    draw();
  }
  const secs = s => s == null ? '--' : s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + ' s';
  const STYLE = { CUT: 'CUTS', QUICK: 'QUICK MIXES', BLEND: 'BLENDS', LONG: 'LONG BLENDS' };
  const hour = h => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');

  /** A small line of the night's tempo, a quarter hour a step; the mood (HIGH / MID / LOW) as the bar under it. */
  function energySvg(en) {
    const pts = en.filter(e => e.bpm);
    if (pts.length < 2) return '';
    const lo = Math.min(...pts.map(e => e.bpm)) - 1, hi = Math.max(...pts.map(e => e.bpm)) + 1, W = 300, H = 60;
    const x = i => Math.round(i / (en.length - 1) * W), y = b => Math.round(H - (b - lo) / (hi - lo) * H);
    const line = en.map((e, i) => e.bpm ? x(i) + ',' + y(e.bpm) : null).filter(Boolean).join(' ');
    const op = { HIGH: 1, MID: .55, LOW: .2 };
    const moods = en.map((e, i) => e.mood ? `<rect x="${x(i)}" y="${H + 6}" width="${Math.max(2, Math.round(W / en.length) - 1)}" height="6" fill="currentColor" opacity="${op[e.mood] || .4}"/>` : '').join('');
    const first = new Date(en[0].at + S.skew), last = new Date(en[en.length - 1].at + S.skew);
    return `<svg viewBox="-2 -2 ${W + 4} ${H + 16}" style="width:100%;height:auto;display:block;color:var(--fg)" role="img" aria-label="Tempo through the night">` +
      `<polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>${moods}</svg>` +
      `<div class="ins-row"><span>${hour(first.getHours())} → ${hour(last.getHours())}</span><b>${lo + 1 | 0}-${hi - 1 | 0} BPM${en.some(e => e.mood) ? ' · bar = mood' : ''}</b></div>`;
  }

  function serverCards() {
    const s = srv && srv.summary;
    if (!s) return [];
    const out = [];
    if (srv.hasMixLog && s.mixes) {
      const st = s.styles || {};
      const styleBars = Object.keys(STYLE).filter(k => st[k]).map(k => [STYLE[k], st[k]]);
      const lm = s.longestMix, qm = s.quickestMix;
      const nm = m => m && m.to && m.to.title ? esc(m.to.title) : 'deck ' + (m && m.to ? m.to.deck : '?');
      out.push(card('MIXING', rows([
        ['Mixes', s.mixes],
        ['Typical mix', secs(s.medianMixSec) + (s.avgMixSec != null ? ' (avg ' + secs(s.avgMixSec) + ')' : '')],
        lm ? ['Longest blend', secs(lm.sec) + (lm.bars ? ' · ' + Math.round(lm.bars) + ' bars' : '') + ' · into ' + nm(lm)] : null,
        qm && qm !== lm ? ['Quickest', secs(qm.sec) + ' · into ' + nm(qm)] : null,
        s.inKeyPct != null ? ['Mixes in key', s.inKey + ' of ' + s.keyPairs + ' (' + s.inKeyPct + '%)'] : null,
        s.avgBpmChange != null ? ['Tempo change at a mix', '±' + s.avgBpmChange + ' BPM'] : null,
      ]) + bars(styleBars, s.mixes) + '<small>TWO DECKS OUT LOUD: CUT UNDER 3 S · QUICK UNDER 16 S · BLEND UNDER 64 S</small>'));
    }
    const en = srv.energy || [];
    const svg = energySvg(en);
    if (svg) out.push(card('ENERGY', svg));
    out.push(card('THE DECKS', rows([
      srv.hasMixLog ? ['Loops', s.loops + (s.loopSec ? ' · ' + secs(s.loopSec) + ' looping' : '') + (s.loopsPerHour ? ' · ' + s.loopsPerHour + ' an hour' : '')] : null,
      s.pitchLow != null ? ['Pitch range used', (s.pitchLow > 0 ? '+' : '') + s.pitchLow + '% to ' + (s.pitchHigh > 0 ? '+' : '') + s.pitchHigh + '%'] : null,
      srv.hasMixLog ? ['Gaps in the music (5 s+)', s.silences ? s.silences + ' · longest ' + secs(s.longestSilenceSec) : 'none'] : null,
      s.peakHour != null ? ['Busiest hour', hour(s.peakHour) + ' · ' + s.peakHourTracks + ' tracks'] : null,
    ])));
    return out;
  }

  // TRANSITIONS (#74, /api/transitions): how well the decks sat together while two or more were out loud, from the
  // players' beat timing. Tonight's best and worst, the night's gallop index, a link to the HALL OF FAME / WILD RIDES.
  let tr = null, trFor = null, trAt = 0, trBusy = false;
  async function loadTrans(night) {
    if (trBusy || (trFor === night && (viewNight || Date.now() - trAt < 30000))) return;
    trBusy = true;
    try {
      const r = await fetch('/api/transitions' + (viewNight ? '?night=' + encodeURIComponent(viewNight) : ''));
      tr = r.ok ? await r.json() : null;
    } catch (e) {}
    trFor = night; trAt = Date.now(); trBusy = false;
    draw();
  }
  const FACE = gi => gi == null ? 'oo' : gi < 1 ? '^^' : gi < 3 ? 'oo' : gi < 6 ? '..' : 'xx';
  const boo = eyes => ['  .--.  ', ' / ' + eyes + ' \\ ', '|      |', ' \\/\\/\\/ '].join('\n');
  /** The bars of a transition: grey = clean (under 4 % of a beat), amber = a flam, red = over 12 %. */
  function strip(list) {
    if (!list || !list.length) return '';
    const cells = list.map((v, i) => v == null ? '' : `<rect x="${i * 5}" y="0" width="4" height="10" style="fill:${Math.abs(v) <= 4 ? 'var(--grey)' : Math.abs(v) <= 12 ? 'var(--warn)' : 'var(--air)'}"/>`).join('');
    return `<svg viewBox="0 0 ${list.length * 5} 10" width="${list.length * 5}" height="10" style="display:block;max-width:100%" role="img" aria-label="Each bar of the blend">${cells}</svg>`;
  }
  const clock = at => { const d = new Date(at + S.skew); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const into = r => r.to && r.to.title ? ' · into ' + esc(r.to.title) : '';
  const who = r => r.dj ? ' · ' + esc(r.dj) : '';
  function transCard() {
    const t = tr;
    if (!t || !t.count) return '';
    const c = t.cleanest, l = t.longest, m = t.mostDecks, w = t.worstDrift || t.worst;
    const head = `<div class="ins-row"><span><pre style="margin:0;font-size:9px;line-height:9px;color:var(--fg)">${boo(FACE(t.gallopIndex))}</pre></span>` +
      `<b>${t.gallopIndex != null ? 'GALLOP INDEX ' + t.gallopIndex + ' / 10' : t.graded ? 'NOT ENOUGH TO SCORE YET' : 'NOTHING RATED YET'}</b></div>`; // #144: rated but too short / noisy to score
    return card('TRANSITIONS', head + rows([
      ['Overlaps (2+ decks out loud)', t.count + (t.graded ? ' · ' + t.graded + ' rated · ' + t.clean + ' clean' : '') + (t.sync ? ' · ' + t.sync + ' on sync' : '')],
      c ? ['Cleanest blend', c.cleanPct + '% clean · ' + Math.round(c.bars) + ' bars' + into(c) + who(c) + (c.sync ? ' · SYNC' : '')] : null,
      l && (!c || l.at !== c.at) ? ['Longest blend', Math.round(l.bars) + ' bars (' + secs(Math.round(l.sec)) + ')' + into(l) + who(l)] : null,
      m ? ['Most decks at once', m.maxDecks + ' decks · ' + secs(Math.round(m.chopSec)) + who(m)] : null,
      w ? ['Wildest ride', clock(w.at) + ' · ' + w.longestDrift + ' bars off · worst ' + w.worstPct + '% (' + w.worstMs + ' ms)' + who(w)] : null,
    ]) + (c ? '<small>CLEANEST</small>' + strip(c.strip) : '') + (w ? '<small>WILDEST RIDE</small>' + strip(w.strip) : '') +
      '<small>CLEAN = UNDER 4% OF A BEAT · FLAM 4-12% · GALLOP = OVER 12% FOR 4 BARS+</small>' +
      (rec && rec.enabled === false ? '' : '<a class="btn" href="transitions.html" style="display:inline-block;margin-top:6px;text-decoration:none">HALL OF FAME</a>'));
  }

  // BOX RECORDS (#74, /api/records): this box's all-time records, held until beaten. Records that fell tonight first.
  let rec = null, recAt = 0, recBusy = false;
  async function loadRecords() {
    if (recBusy || Date.now() - recAt < 60000) return;
    recBusy = true;
    try { const r = await fetch('/api/records'); rec = r.ok ? await r.json() : null; } catch (e) {}
    recAt = Date.now(); recBusy = false;
    draw();
  }
  const HEADLINE = ['fastest', 'pitchDown', 'longestBlend', 'mostDecks', 'cleanestBlend', 'mostTracksNight'];
  function recordsCard() {
    if (!rec || rec.enabled === false || !(rec.records || []).length) return '';
    const fresh = rec.records.filter(r => r.beat), rest = rec.records.filter(r => !r.beat && HEADLINE.includes(r.id)).slice(0, 5 - Math.min(5, fresh.length));
    const line = r => [esc(r.name.charAt(0) + r.name.slice(1).toLowerCase()), esc(r.text) + (r.title ? ' · ' + esc(r.title.length > 40 ? r.title.slice(0, 39) + '…' : r.title) : '') + (r.dj ? ' · ' + esc(r.dj) : '') + (r.beat ? ' · NEW TONIGHT' : '')];
    return card('BOX RECORDS', `<div class="ins-row"><span><pre style="margin:0;font-size:9px;line-height:9px;color:var(--fg)">${boo(fresh.length ? '**' : '^^')}</pre></span>` +
      `<b>${rec.records.length} RECORDS · ${rec.nights} ${rec.nights === 1 ? 'NIGHT' : 'NIGHTS'}${fresh.length ? ' · ' + fresh.length + ' NEW TONIGHT' : ''}</b></div>` +
      rows(fresh.concat(rest).map(line)) +
      '<a class="btn" href="transitions.html" style="display:inline-block;margin-top:6px;text-decoration:none">BOX RECORDS + HALL OF FAME</a>');
  }

  /** Per DJ from the box: tracks, time, BPM, and (with the mix log) how they mix. */
  function djCard() {
    const list = srv && srv.djs;
    if (!list || !list.length || (list.length === 1 && list[0].dj.charAt(0) === '(')) return null;
    return card('DJS', list.map(d => {
      const st = d.styles || {}, main = Object.keys(STYLE).sort((a, b) => (st[b] || 0) - (st[a] || 0))[0];
      const bits = [d.tracks + (d.tracks === 1 ? ' track' : ' tracks'), d.from && d.to ? dur(d.to - d.from) : '', d.avgBpm ? Math.round(d.avgBpm) + ' BPM' : '',
        d.mixes ? 'mixes ' + secs(d.medianMixSec) + (st[main] ? ', mostly ' + STYLE[main].split(' (')[0].toLowerCase() : '') : '',
        d.inKeyPct != null ? d.inKeyPct + '% in key' : '', d.loops ? d.loops + ' loops' : ''].filter(Boolean);
      return `<div class="ins-row"><span>${esc(d.dj)}</span><b>${bits.join(' · ')}</b></div>`;
    }).join(''));
  }

  /** One labelled block: a heading and rows, or bars. */
  const card = (title, body) => body ? `<div class="ins"><h3>${title}</h3>${body}</div>` : '';
  const rows = list => list.filter(Boolean).map(([a, b]) => `<div class="ins-row"><span>${a}</span><b>${b}</b></div>`).join('');
  const bars = (list, total) => list.map(([label, n]) =>
    `<div class="ins-bar"><span>${esc(label)}</span><i style="--w:${Math.max(2, Math.round(n / total * 100))}%"></i><b>${n}</b></div>`).join('');

  function draw() {
    if (!box) return;
    const list = playedList();
    if (list.length < 2) { loadAll(); box.innerHTML = allCard(); return; }
    const night = viewNight || (S.status && S.status.night) || '';
    if (metaFor !== night || metaLen !== list.length) loadMeta(night, list.length);
    loadServer(night, list.length);
    loadAll();
    const fromBox = srv && srv.night === (viewNight || (S.status && S.status.night)) ? srv : null;
    const out = [];

    // PACE: time each track held the air = until the next one went on (breaks over 20 min don't count).
    const held = [];
    for (let i = 0; i < list.length - 1; i++) {
      const g = list[i + 1].at - list[i].at;
      if (g > 0 && g < 20 * 60000) held.push([g, list[i]]);
    }
    const span = list[list.length - 1].at - list[0].at;
    if (held.length) {
      const sorted = held.map(h => h[0]).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
      const long = held.reduce((a, b) => b[0] > a[0] ? b : a), short = held.reduce((a, b) => b[0] < a[0] ? b : a);
      out.push(card('PACE', rows([
        // #144: an hour's rate from the first few minutes read like 54.8 an hour; wait for 20 minutes of music.
        ['Tracks an hour', span >= 20 * 60000 ? (list.length / (span / 3600000)).toFixed(1) : 'after 20 min'],
        ['Typical track on air', mmss(med)],
        held.length > 1 ? ['Longest on air', mmss(long[0]) + ' · ' + name(long[1])] : null,
        // #144: this is the shortest time a track held the air, not a mix (MIXING's "Quickest" is the mix).
        held.length > 1 ? ['Shortest on air', mmss(short[0]) + ' · ' + name(short[1])] : null,
      ])));
    }

    // TEMPO
    let jump = null;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1].bpm, b = list[i].bpm;
      if (a > 0 && b > 0 && (!jump || Math.abs(b - a) > Math.abs(jump.d))) jump = { d: b - a, from: list[i - 1], to: list[i] };
    }
    const third = Math.max(1, Math.floor(list.length / 3));
    const avgOf = l => { const b = l.map(t => t.bpm).filter(x => x > 0); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : 0; };
    const early = avgOf(list.slice(0, third)), late = avgOf(list.slice(-third));
    const metas = list.map(t => meta[k(t)]).filter(Boolean);
    const pitches = metas.map(m => Math.abs(m.pitch || 0));
    out.push(card('TEMPO', rows([
      early && late ? ['First third → last third', early.toFixed(1) + ' → ' + late.toFixed(1) + ' BPM'] : null,
      jump && Math.abs(jump.d) >= 0.5 ? ['Biggest jump', (jump.d > 0 ? '+' : '') + jump.d.toFixed(1) + ' BPM into ' + name(jump.to)] : null,
      pitches.length ? ['Pitch, typical / most', '±' + (pitches.reduce((a, b) => a + b, 0) / pitches.length).toFixed(1) + '% / ±' + Math.max(...pitches).toFixed(1) + '%'] : null,
    ])));
    if (fromBox) try { out.push(...serverCards()); } catch (e) { console.warn('insights', e); }
    loadTrans(night);
    try { const tc = transCard(); if (tc) out.push(tc); } catch (e) { console.warn('transitions', e); }
    loadRecords();
    try { const rc = recordsCard(); if (rc) out.push(rc); } catch (e) { console.warn('records', e); }

    // KEYS: needs the extras file (key per track).
    const keys = list.map(t => camelot(meta[k(t)] && meta[k(t)].key));
    const known = keys.filter(Boolean);
    if (known.length >= 2) {
      let pairs = 0, clean = 0, streak = 0, best = 0;
      for (let i = 1; i < keys.length; i++) {
        if (!keys[i] || !keys[i - 1]) { streak = 0; continue; }
        pairs++;
        if (keysMix(keys[i - 1], keys[i])) { clean++; streak++; best = Math.max(best, streak); } else streak = 0;
      }
      const top = count(known).slice(0, 4);
      out.push(card('KEYS', rows([
        pairs ? ['Mixes in key', clean + ' of ' + pairs + ' (' + pct(clean, pairs) + ')'] : null,
        best > 1 ? ['Longest run in key', best + ' mixes'] : null,
      ]) + bars(top, known.length)));
    }

    // GENRES
    const genres = count(metas.map(m => m.genre && m.genre.trim()));
    if (genres.length) out.push(card('GENRES', bars(genres.slice(0, 5), metas.filter(m => m.genre).length)));

    // DECKS
    const decks = count(list.map(t => 'DECK ' + t.player)).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    if (decks.length > 1) out.push(card('DECKS', bars(decks, list.length)));

    // HOURS: tracks started in each clock hour.
    const hours = [];
    for (const t of list) {
      const h = new Date(t.at + S.skew).getHours(), lab = (h % 12 || 12) + (h < 12 ? 'A' : 'P');
      const last = hours[hours.length - 1];
      if (last && last[0] === lab) last[1]++; else hours.push([lab, 1]);
    }
    if (hours.length > 1) out.push(card('BY THE HOUR', bars(hours, Math.max(...hours.map(h => h[1])))));

    // ARTISTS + REPEATS
    const artists = count(list.map(t => t.artist && t.artist.trim())).filter(a => a[1] > 1).slice(0, 5);
    const reps = count(list.map(t => (t.title || '') + '\u0000' + (t.artist || ''))).filter(r => r[1] > 1);
    out.push(card('ARTISTS', (artists.length ? bars(artists, list.length) : '') + rows([
      ['Different artists', new Set(list.map(t => t.artist && t.artist.trim().toLowerCase()).filter(Boolean)).size],
      reps.length ? ['Played twice or more', reps.map(([r, n]) => esc(r.split('\u0000')[0]) + ' x' + n).join(', ')] : null,
    ])));

    // DJS: once the lineup is in use (the box's version when it has one: adds how each DJ mixes).
    const boxDjs = fromBox && list.some(t => t.dj) ? djCard() : null;
    if (boxDjs) out.push(boxDjs);
    else if (list.some(t => t.dj)) {
      const by = {};
      list.forEach((t, i) => {
        const d = t.dj || 'NO DJ SET';
        (by[d] = by[d] || { n: 0, first: t.at, last: t.at, bpm: [] }).n++;
        by[d].last = i < list.length - 1 ? list[i + 1].at : t.at;
        if (t.bpm > 0) by[d].bpm.push(t.bpm);
      });
      out.push(card('DJS', Object.entries(by).map(([d, v]) =>
        `<div class="ins-row"><span>${esc(d)}</span><b>${v.n} tracks · ${dur(v.last - v.first)}${v.bpm.length ? ' · ' + (v.bpm.reduce((a, b) => a + b, 0) / v.bpm.length).toFixed(0) + ' BPM' : ''}</b></div>`).join('')));
    }

    out.push(allCard());
    box.innerHTML = out.join('');
  }

  function allCard() {
    const a = allTime;
    if (!a || !a.nights) return '';
    return card('EVERY NIGHT ON THIS BOX', rows([
      ['Nights', a.nights + (a.since ? ' since ' + a.since : '')],
      ['Tracks', a.tracks + ' (' + a.unique + ' different)'],
      ['Hours of music', a.hours],
    ]) + (a.topTracks.length ? '<small>MOST PLAYED TRACKS</small>' + bars(a.topTracks.slice(0, 5).map(t => [t.name, t.count]), a.topTracks[0].count) : '')
      + (a.topArtists.length ? '<small>MOST PLAYED ARTISTS</small>' + bars(a.topArtists.slice(0, 5).map(t => [t.name, t.count]), a.topArtists[0].count) : ''));
  }

  // Redraw with the played list; skip while PLAYED isn't on screen (it redraws when you open it).
  const orig = renderPlayed;
  renderPlayed = function () {
    orig.apply(this, arguments);
    try { if (!$('played').hidden) draw(); } catch (e) { console.warn('insights', e); }
  };
  addEventListener('hashchange', () => { try { if (location.hash === '#played') { allAt = 0; draw(); } } catch (e) {} });
  return { draw };
})();
