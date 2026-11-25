'use strict';
// GHOST WRAPPED (DECISIONS #146): "your nights" as swipeable cards, like a year in review, for one night or every
// night on the box (ALL NIGHTS), and the same as a 1080 x 1920 picture to post (drawn on a canvas in the phone, never
// sent anywhere). From GET /api/wrapped (a tracklist read, like PLAYED) and, for the owner, the box's MILESTONES.
// Venue names stay off the cards and the picture unless VENUES is switched on (per phone); track titles can be left
// off the picture with TITLES. Its own page: nothing here touches the DJ's screens. Text nodes only.
// The card model (cards(), clock(), hours()) runs under Node too (src/test/js/fun146.test.js).
const Wrapped = (() => {
  const GHOST = eyes => ['  .--.  ', ' / ' + (eyes || 'oo') + ' \\ ', '|      |', '|      |', ' \\/\\/\\/ '];

  /** 3.6 -> "3.6"; whole numbers without .0 */
  const num = v => v == null ? '--' : Number.isInteger(+v) ? Number(v).toLocaleString('en-US') : String(v);
  /** ms on air -> "3 H 35 MIN" (under an hour: "42 MIN") */
  function hours(ms) {
    const m = Math.round((ms || 0) / 60000), h = Math.floor(m / 60);
    return h ? h.toLocaleString('en-US') + ' H ' + String(m % 60).padStart(2, '0') + ' MIN' : m + ' MIN';
  }
  /** "03:40" -> "3:40 AM" (the box sends 24 h) */
  function clock(t) {
    const m = /^(\d{2}):(\d{2})$/.exec(t || '');
    if (!m) return '--';
    const h = +m[1];
    return ((h + 11) % 12 + 1) + ':' + m[2] + (h < 12 ? ' AM' : ' PM');
  }
  const hourWord = h => h == null ? '--' : ((h + 11) % 12 + 1) + (h < 12 ? ' AM' : ' PM');
  const secs = s => s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' MIN' : s + ' S';
  const name = (t, a) => (t || '') + (a ? ' - ' + a : '');
  const nightWord = n => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(n || ''); if (!m) return n || ''; return ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][+m[2] - 1] + ' ' + (+m[3]) + ' ' + m[1]; };

  /**
   * The cards, as plain words: [{id, kicker, big, lines: [[label, value], ...], eyes?}]. A card with nothing to say
   * is left out. opts: {venues: false, titles: true}. Pure.
   */
  function cards(w, opts) {
    const o = Object.assign({ venues: false, titles: true }, opts || {});
    const out = [];
    if (!w || !w.tracks) return [{ id: 'empty', kicker: 'GHOST WRAPPED', big: 'NOTHING YET', lines: [['', w && w.scope === 'year' ? 'No show nights in ' + w.year + ' on this box.'
      : w && w.scope === 'all' ? 'No nights on this box yet.' : 'Nothing went on air that night.']] }];
    // #154: 'year' (YOUR 2026) and 'dj' (one DJ's nights) read like ALL NIGHTS
    const all = w.scope === 'all' || w.scope === 'year' || w.scope === 'dj';
    const title = (t, a) => o.titles ? name(t, a) : null;
    const big = w.scope === 'year' ? 'YOUR ' + w.year : w.scope === 'dj' ? String(w.dj || 'THE DJ').toUpperCase() : all ? 'YOUR NIGHTS' : 'YOUR NIGHT';
    const cover = { id: 'cover', kicker: 'GHOST WRAPPED', big, lines: [] };
    cover.lines.push(['', all ? (w.nights === 1 ? nightWord(w.from) : nightWord(w.from) + ' - ' + nightWord(w.to)) : 'NIGHT OF ' + nightWord(w.night)]);
    if (w.scope === 'dj') cover.lines.push(['', 'AT THIS GHOST LINK']);
    if (w.home) cover.lines.push(['', 'PRACTICE NIGHT']);
    cover.lines.push(['', (all ? num(w.nights) + (w.nights === 1 ? ' NIGHT · ' : ' NIGHTS · ') : '') + num(w.tracks) + (w.tracks === 1 ? ' TRACK' : ' TRACKS')]);
    if (o.venues && w.venues && w.venues.length) cover.lines.push(['', w.venues.map(v => v.name.toUpperCase()).slice(0, 3).join(' · ')]);
    out.push(cover);

    const nums = { id: 'numbers', kicker: 'THE NUMBERS', big: hours(w.onAirMs), lines: [['', 'ON AIR']] };
    if (all) nums.lines.push(['NIGHTS', num(w.nights)]);
    nums.lines.push(['TRACKS', num(w.tracks)]);
    if (w.unique !== w.tracks) nums.lines.push(['DIFFERENT TRACKS', num(w.unique)]);
    if (w.djs && w.djs.length > 1) nums.lines.push(['DJS', num(w.djs.length)]);
    if (all && w.venueCount > 1) nums.lines.push(['VENUES', num(w.venueCount)]);
    out.push(nums);

    if (w.topTrack || w.topArtist) {
      const c = { id: 'repeat', kicker: 'ON REPEAT', big: w.topTrack ? w.topTrack.count + 'X' : w.topArtist.count + 'X', lines: [] };
      if (w.topTrack) c.lines.push(['MOST PLAYED', title(w.topTrack.title, w.topTrack.artist) || 'ONE TRACK, ' + w.topTrack.count + ' TIMES']);
      if (w.topArtist && (o.titles || !w.topTrack)) c.lines.push(['MOST PLAYED ARTIST', o.titles ? w.topArtist.name + ' · ' + w.topArtist.count + ' TRACKS' : w.topArtist.count + ' TRACKS BY ONE ARTIST']);
      if (!w.topTrack) c.big = w.topArtist.count + ' TRACKS';
      out.push(c);
    }

    if (w.fastest) {
      const c = { id: 'tempo', kicker: 'TEMPO', big: num(w.avgBpm) + ' BPM', lines: [['', 'ON AVERAGE']] };
      c.lines.push(['FASTEST', num(w.fastest.bpm) + (title(w.fastest.title, w.fastest.artist) ? ' · ' + title(w.fastest.title, w.fastest.artist) : '')]);
      if (w.slowest && w.slowest.bpm !== w.fastest.bpm) c.lines.push(['SLOWEST', num(w.slowest.bpm) + (title(w.slowest.title, w.slowest.artist) ? ' · ' + title(w.slowest.title, w.slowest.artist) : '')]);
      out.push(c);
    }

    if (w.favKey) out.push({ id: 'key', kicker: 'YOUR KEY', big: w.favKey.key, key: w.favKey.key,
      lines: [['', w.favKey.pct + '% OF THE TRACKS WITH A KEY'], ['', w.favKey.count + ' OF ' + w.favKey.of]] });

    if (w.mixes) {
      const c = { id: 'mix', kicker: 'THE MIX', big: num(w.mixes) + ' MIXES', lines: [['BLENDS', num(w.blends)], ['QUICK CUTS', num(w.cuts)]] };
      if (w.inKeyPct != null) c.lines.push(['IN KEY', w.inKeyPct + '%']);
      if (w.longestBlend) c.lines.push(['LONGEST BLEND', secs(w.longestBlend.sec) + (o.titles && w.longestBlend.from ? ' · ' + w.longestBlend.from + ' > ' + w.longestBlend.to : '')]);
      out.push(c);
    }

    if (w.latest && w.latest.time) {
      const c = { id: 'clock', kicker: all ? 'LATEST FINISH' : 'LAST TRACK ENDED', big: clock(w.latest.time), lines: [] };
      if (all && w.nights > 1) c.lines.push(['', nightWord(w.latest.night)]);
      if (w.earliest && w.earliest.time) c.lines.push([all ? 'EARLIEST START' : 'FIRST TRACK', clock(w.earliest.time)]);
      if (w.peakHour != null) c.lines.push(['BUSIEST HOUR', hourWord(w.peakHour)]);
      if (all && w.longestNight && w.nights > 1) c.lines.push(['LONGEST NIGHT', hours(w.longestNight.ms) + ' · ' + nightWord(w.longestNight.night)]);
      out.push(c);
    }

    if (w.milestones && w.milestones.length) {
      const l = w.milestones.slice(-6).reverse().map(m => [nightWord(m.night), m.title]);
      out.push({ id: 'milestones', kicker: 'MILESTONES', big: w.milestones.length + (w.milestones.length === 1 ? ' MOMENT' : ' MOMENTS'), lines: l, owner: true });
    }

    if (w.personality) out.push({ id: 'you', kicker: 'THE GHOST SAYS YOU ARE', big: w.personality.name, eyes: w.personality.eyes, lines: [['', w.personality.line]] });
    return out;
  }

  /** Camelot -> the same colour as SET DNA (colour that carries data: the key). */
  function keyColour(cam) {
    const m = /^(\d+)([AB])$/.exec(cam || '');
    return m ? 'hsl(' + ((+m[1] - 1) * 30) + ', 85%, ' + (m[2] === 'A' ? 52 : 66) + '%)' : '#777';
  }

  /**
   * #154 YOUR 2026: the years ALL NIGHTS offers as a pick, newest first. This year only from Dec 1 (a year's wrap
   * belongs at its end); an earlier year with nights on the box always. No pop-up anywhere: just the option.
   */
  function years(nights, now) {
    const d = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    const y = d.getFullYear(), dec = d.getMonth() === 11;
    const have = new Set((nights || []).map(n => +String(n).slice(0, 4)).filter(n => n > 2000));
    return [...have].filter(x => x < y || (x === y && dec)).sort((a, b) => b - a);
  }
  /** "ghost-wrapped-2026.png" / "ghost-wrapped-lil-tick.png" / "...-all-nights" / "...-2026-11-21". */
  function fileName(w) {
    const slug = s => String(s || 'dj').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dj';
    return 'ghost-wrapped-' + (w.scope === 'year' ? String(w.year) : w.scope === 'dj' ? slug(w.dj) : w.scope === 'all' ? 'all-nights' : w.night) + '.png';
  }

  if (typeof document === 'undefined') return { cards, hours, clock, hourWord, nightWord, keyColour, years, fileName };

  // ---------------- the page ----------------
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pref = (k, d) => { try { const v = localStorage.getItem('wrapped.' + k); return v == null ? d : v === '1'; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem('wrapped.' + k, v ? '1' : '0'); } catch (e) {} };
  let data = null, list = [], at = 0;
  const opts = () => ({ venues: pref('venues', false), titles: pref('titles', true) });
  const sheet = () => document.documentElement.classList.contains('ghost-mode');

  function render() {
    list = cards(data, opts());
    const row = $('cards');
    row.replaceChildren(...list.map((c, i) => {
      const card = el('section', 'card c-' + c.id);
      card.setAttribute('aria-label', c.kicker + ' ' + (i + 1) + ' of ' + list.length);
      const g = el('pre', 'boo', GHOST(c.eyes).join('\n')); g.setAttribute('aria-hidden', 'true');
      if (c.id === 'cover' || c.id === 'you') { g.dataset.ghostmode = '1'; card.append(g); }
      card.append(el('div', 'kicker', c.kicker), el('div', 'big', c.big));
      if (c.key) { const dot = el('i', 'keydot'); dot.style.background = keyColour(c.key); dot.setAttribute('aria-hidden', 'true'); card.append(dot); }
      const ul = el('ul');
      c.lines.forEach(([k, v]) => { const li = el('li'); if (k) li.append(el('small', null, k)); li.append(el('b', null, v)); ul.append(li); });
      card.append(ul);
      if (c.owner) card.append(el('div', 'own', 'ONLY YOU SEE THIS CARD'));
      card.append(el('div', 'foot', (i + 1) + ' / ' + list.length));
      return card;
    }));
    const dots = $('dots');
    dots.replaceChildren(...list.map((c, i) => { const b = el('button', null, ''); b.type = 'button'; b.setAttribute('aria-label', c.kicker); b.addEventListener('click', () => go(i)); return b; }));
    go(Math.min(at, list.length - 1), true);
  }
  function go(i, instant) {
    at = Math.max(0, Math.min(list.length - 1, i));
    const row = $('cards'), c = row.children[at];
    if (c) row.scrollTo({ left: c.offsetLeft - row.offsetLeft, behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    [...$('dots').children].forEach((d, k) => d.classList.toggle('on', k === at));
  }

  // ---- the picture: 1080 x 1920, every card stacked, the GHOST LINK look ----
  function image() {
    const W = 1080, H = 1920, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const inv = sheet(), BG = inv ? '#fff' : '#000', FG = inv ? '#000' : '#fff', GR = inv ? '#555' : '#9a9a9a', LN = inv ? '#ccc' : '#2a2a2a';
    const F = (w, px) => w + ' ' + px + 'px "JetBrains Mono", monospace';
    const fit = (s, max) => { s = String(s); if (g.measureText(s).width <= max) return s; while (g.measureText(s + '…').width > max && s.length > 2) s = s.slice(0, -1); return s + '…'; };
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    g.textBaseline = 'top';
    const cs = cards(data, opts()).filter(c => !c.owner); // the milestones card is the owner's: never on the picture
    const cover = cs.shift(), you = cs.find(c => c.id === 'you');
    const body = cs.filter(c => c.id !== 'you');
    g.fillStyle = FG; g.font = F(600, 26);
    GHOST(you && you.eyes).forEach((l, i) => g.fillText(l, 72, 80 + i * 26));
    g.font = F(600, 64); g.fillText('GHOST WRAPPED', 260, 92);
    g.fillStyle = GR; g.font = F(400, 28);
    cover.lines.forEach((l, i) => g.fillText(fit(l[1], W - 330), 262, 172 + i * 36));
    let y = 300;
    const slot = Math.floor((H - y - 380) / Math.max(1, body.length));
    body.forEach(c => {
      g.fillStyle = LN; g.fillRect(72, y, W - 144, 2);
      g.fillStyle = GR; g.font = F(400, 24); g.fillText(c.kicker, 72, y + 22);
      g.fillStyle = c.key ? keyColour(c.key) : FG; g.font = F(600, Math.min(64, slot / 3)); g.fillText(fit(c.big, W - 144), 72, y + 56);
      g.font = F(400, 26);
      let ly = y + 56 + Math.min(64, slot / 3) + 14;
      c.lines.slice(0, Math.max(1, Math.floor((slot - (ly - y) - 10) / 34))).forEach(([k, v]) => {
        g.fillStyle = GR; const kw = k ? g.measureText(k + '  ').width : 0; if (k) g.fillText(k, 72, ly);
        g.fillStyle = FG; g.fillText(fit(v, W - 144 - kw), 72 + kw, ly); ly += 34;
      });
      y += slot;
    });
    if (you) {
      g.fillStyle = LN; g.fillRect(72, y, W - 144, 2);
      g.fillStyle = GR; g.font = F(400, 24); g.fillText(you.kicker, 72, y + 26);
      g.fillStyle = FG; g.font = F(600, 72); g.fillText(fit(you.big, W - 144), 72, y + 66);
      g.fillStyle = GR; g.font = F(400, 30); g.fillText(fit(you.lines[0][1], W - 144), 72, y + 160);
    }
    g.fillStyle = inv ? '#777' : '#555'; g.font = F(400, 22);
    g.fillText('GHOST LINK · made with <3 in Boston, MA by Third Polar Arch', 72, H - 80);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }

  async function load(which) {
    $('msg').hidden = false; $('msg').textContent = 'Adding it all up...';
    try {
      // #154: 'dj:NAME' = one DJ's own WRAPPED (crew code or owner: /api/night/dj); 'year:2026' = YOUR 2026
      const dj = /^dj:/.test(which) ? which.slice(3) : null, yr = /^year:(\d{4})$/.exec(which);
      const url = dj ? '/api/night/dj?dj=' + encodeURIComponent(dj) : yr ? '/api/wrapped?night=all&year=' + yr[1] : '/api/wrapped?night=' + encodeURIComponent(which);
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (dj && r.status === 401) { $('msg').textContent = "A DJ's WRAPPED is for the crew: open their DJ page and enter the password or tonight's crew code."; return; }
      if (!r.ok) { $('msg').textContent = j.tracklist === 'private' ? 'The DJ hasn\'t shared the tracklist, so there\'s nothing to wrap from here.' : (j.error || 'Couldn\'t add that up.'); return; }
      data = dj ? j.wrapped : j;
    } catch (e) { $('msg').textContent = 'Couldn\'t reach GHOST LINK.'; return; }
    $('msg').hidden = true;
    at = 0;
    render();
  }

  async function nights(sel, want, dj) {
    let ns = [];
    try { const r = await fetch('/api/nights'); if (r.ok) ns = await r.json(); } catch (e) {}
    const opt = (v, t) => { const o = el('option', null, t); o.value = v; return o; };
    sel.replaceChildren(...(dj ? [opt('dj:' + dj, 'DJ · ' + dj.toUpperCase())] : []), opt('all', 'ALL NIGHTS'),
      ...years(ns).map(y => opt('year:' + y, 'YOUR ' + y)), // #154 YOUR 2026 (from Dec 1)
      ...ns.slice(0, 200).map((n, i) => opt(n, (i === 0 ? 'LATEST · ' : '') + nightWord(n))));
    if (dj) want = 'dj:' + dj;
    sel.value = want && [...sel.options].some(o => o.value === want) ? want : (ns.length ? 'all' : 'all');
  }

  function toggles() {
    const set = (id, k, label) => {
      const b = $(id);
      const show = () => { const v = pref(k, k === 'titles'); b.textContent = label + ': ' + (v ? 'ON' : 'OFF'); b.setAttribute('aria-pressed', String(v)); };
      b.addEventListener('click', () => { setPref(k, !pref(k, k === 'titles')); show(); if (data) render(); });
      show();
    };
    set('venuesBtn', 'venues', 'VENUES');
    set('titlesBtn', 'titles', 'TITLES');
  }

  async function page() {
    const q = new URLSearchParams(location.search);
    const sel = $('which');
    await nights(sel, q.get('night'), q.get('dj')); // #154 ?dj=NAME: that DJ's own WRAPPED
    sel.addEventListener('change', () => {
      const v = sel.value;
      history.replaceState(null, '', /^dj:/.test(v) ? '?dj=' + encodeURIComponent(v.slice(3)) : '?night=' + encodeURIComponent(v));
      load(v);
    });
    toggles();
    $('prev').addEventListener('click', () => go(at - 1));
    $('next').addEventListener('click', () => go(at + 1));
    document.addEventListener('keydown', e => { if (e.target.closest && e.target.closest('select')) return; if (e.key === 'ArrowRight') go(at + 1); if (e.key === 'ArrowLeft') go(at - 1); });
    let t = 0;
    $('cards').addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => {
      const row = $('cards'), x = row.scrollLeft + row.clientWidth / 2;
      const i = [...row.children].findIndex(c => c.offsetLeft - row.offsetLeft <= x && c.offsetLeft - row.offsetLeft + c.offsetWidth > x);
      if (i >= 0 && i !== at) { at = i; [...$('dots').children].forEach((d, k) => d.classList.toggle('on', k === at)); }
    }, 80); }, { passive: true });
    try { await document.fonts.load('600 20px "JetBrains Mono"'); } catch (e) {}
    $('save').addEventListener('click', async () => {
      if (!data) return;
      const b = await image(), a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = fileName(data); a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    const sh = $('share');
    if (navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })) {
      sh.hidden = false;
      sh.addEventListener('click', async () => { if (!data) return; try { await navigator.share({ files: [new File([await image()], fileName(data), { type: 'image/png' })], title: 'GHOST WRAPPED' }); } catch (e) { /* cancelled */ } });
    }
    load(sel.value);
  }

  return { cards, hours, clock, hourWord, nightWord, keyColour, page, image };
})();
if (typeof module !== 'undefined') module.exports = Wrapped;
