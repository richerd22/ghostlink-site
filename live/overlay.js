'use strict';
/*
 * ON STREAM (DECISIONS #120): the see-through now-playing overlay for OBS / any browser source (overlay.html).
 * Reads /api/nowplaying.json once a second (the box decides what may show: titles only while SONG ID is on, hidden
 * tracks as ID - ID), so it reconnects by itself: a missed answer is just the next poll. 15 s without one = nothing
 * on screen (never a stale track). Every piece is picked in the address; stream.html builds the address.
 * Text from the box goes in as text nodes only.
 */
const Overlay = (() => {
  const STYLES = ['lower', 'ticker', 'card', 'none'];
  const CORNERS = ['bl', 'br', 'tl', 'tr'];
  const num = (v, lo, hi, dflt) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };

  /**
   * The address -> settings. Older links keep working (?pos, ?bg=green, ?scale, ?bpm=0 from the first overlay).
   * style lower|ticker|card|none, pos corner, hold s (0 = stays), chip corner (1 = tr), prev top|bottom (1 = top),
   * n 1-5, bar wave|line (1 = wave), dj=0, art=0, bpm=0, scale 0.5-3, bg none|green|black, safe 0-15 (%), demo=1,
   * key camelot|musical (#128: the key as 8A or as Am; none = as rekordbox sends it), demo=ear (#128: a laptop night).
   */
  function parse(search) {
    const q = new URLSearchParams(search || '');
    const get = k => (q.get(k) || '').trim().toLowerCase();
    const style = STYLES.includes(get('style')) ? get('style') : 'lower';
    const pos = CORNERS.includes(get('pos')) ? get('pos') : style === 'ticker' ? 'tr' : 'bl';
    const chipV = get('chip');
    let chip = CORNERS.includes(chipV) ? chipV : ['1', 'yes', 'on', 'true'].includes(chipV) ? 'tr' : '';
    if (chip && chip === pos && style !== 'card' && style !== 'none') chip = { bl: 'br', br: 'bl', tl: 'tr', tr: 'tl' }[pos]; // never on top of the main piece
    const prevV = get('prev');
    const prev = prevV === 'top' || prevV === 'bottom' ? prevV : ['1', 'yes', 'on', 'true'].includes(prevV) ? 'top' : '';
    const barV = get('bar');
    const bar = barV === 'wave' || barV === 'line' ? barV : ['1', 'yes', 'on', 'true'].includes(barV) ? 'wave' : '';
    const bg = ['green', 'black'].includes(get('bg')) ? get('bg') : 'none';
    const keyAs = ['camelot', 'musical'].includes(get('key')) ? get('key') : '';
    return {
      style, pos, chip, prev, bar, bg, keyAs,
      hold: Math.round(num(q.get('hold'), 0, 600, 0)),
      n: Math.round(num(q.get('n'), 1, 5, 3)),
      dj: get('dj') !== '0', art: get('art') !== '0', bpm: get('bpm') !== '0',
      scale: num(q.get('scale'), 0.5, 3, 1),
      safe: num(q.get('safe'), 0, 15, 5),
      demo: get('demo') === '1' || get('demo') === 'ear',
      demoEar: get('demo') === 'ear',
    };
  }

  /** settings -> the address (the builder's COPY LINK): only what differs from the defaults, so links stay short. */
  function build(p) {
    const d = parse(''), out = [];
    const add = (k, v) => out.push(k + '=' + encodeURIComponent(v));
    if (p.style !== d.style) add('style', p.style);
    const defPos = p.style === 'ticker' ? 'tr' : 'bl';
    if (p.pos && p.pos !== defPos && p.style !== 'card' && p.style !== 'none') add('pos', p.pos);
    if (p.hold) add('hold', p.hold);
    if (p.chip) add('chip', p.chip);
    if (p.prev) add('prev', p.prev);
    if (p.prev && p.n !== d.n) add('n', p.n);
    if (p.bar) add('bar', p.bar);
    if (!p.dj) add('dj', 0);
    if (!p.art) add('art', 0);
    if (p.scale !== 1) add('scale', p.scale);
    if (p.bg !== 'none') add('bg', p.bg);
    if (p.safe !== d.safe) add('safe', p.safe);
    if (p.keyAs) add('key', p.keyAs);
    if (p.demo) add('demo', p.demoEar ? 'ear' : 1);
    return out.length ? '?' + out.join('&') : '';
  }

  const s = v => (v === null || v === undefined ? '' : String(v)).trim();

  /**
   * What to put on screen for one /api/nowplaying.json answer: {main, chip, prev, key} or null (nothing at all).
   * main = {label, title, sub, art, meta}: with SONG ID off it's the DJ's name only; no DJ either = no main piece.
   * Never "undefined" / "null" in a string.
   */
  const bpmText = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '') + ' BPM';
  /** #128: the key as the address asks (camelot / musical), else as rekordbox sent it. */
  function keyText(np, p) {
    const k = s(np.key);
    if (p.keyAs === 'camelot') return s(np.camelot) || k;
    if (p.keyAs === 'musical') return s(np.musical) || k;
    return k;
  }

  function view(np, p) {
    if (!np) return null;
    if (!np.on) {
      // #128 BY EAR: a laptop night (no DJ Link deck), THE EAR hears the BPM: the chip only, said honestly
      const ear = typeof np.earBpm === 'number' && np.earBpm > 0 && p.chip && p.bpm ? bpmText(np.earBpm) + ' · BY EAR' : '';
      return ear ? { main: null, prev: [], chip: ear, key: 'ear' } : null;
    }
    const title = s(np.title), artist = s(np.artist), dj = p.dj ? s(np.dj) : '';
    const bpm = typeof np.bpm === 'number' && np.bpm > 0 ? bpmText(np.bpm) : '';
    const key = keyText(np, p);
    const chipText = [bpm, key].filter(Boolean).join(' · ');
    let main = null;
    if (title) {
      main = { label: 'NOW PLAYING' + (dj ? ' · ' + dj.toUpperCase() : ''), title, sub: artist, art: p.art && np.art ? String(np.art) : '',
        meta: p.bpm && !p.chip ? chipText : '' };
    } else if (dj) {
      main = { label: 'ON THE DECKS', title: dj, sub: '', art: '', meta: p.bpm && !p.chip ? chipText : '' };
    }
    const prev = p.prev && title ? (Array.isArray(np.prev) ? np.prev : []).map(x => s(x && x.line)).filter(Boolean).slice(0, p.n) : [];
    return {
      main, prev,
      chip: p.chip && p.bpm && chipText ? chipText : '',
      key: [s(np.trackKey), title, artist, dj].join('|'),
    };
  }

  /** Where the playhead is now (ms), from the answer and how long ago it came. */
  function position(np, agoMs) {
    if (!np || typeof np.positionMs !== 'number') return 0;
    const p = np.positionMs + (np.playing ? Math.max(0, agoMs) * (1 + (np.pitch || 0) / 100) : 0);
    return np.durationMs ? Math.min(p, np.durationMs) : p;
  }

  const SAMPLE = [
    { title: 'Paper Lanterns', artist: 'Ghost Orchard', bpm: 124, key: 'Am', camelot: '8A', musical: 'Am' },
    { title: 'Night Bus Home', artist: 'Sable Fox', bpm: 126.5, key: 'Em', camelot: '9A', musical: 'Em' },
    { title: 'Sodium Lights', artist: 'Kiln', bpm: 128, key: 'D', camelot: '10B', musical: 'D' },
  ];
  /** A made-up answer for the builder's preview (demo=1): a new track every 12 s. */
  function sample(now, ear) {
    if (ear) return { on: false, title: null, artist: null, line: '', dj: null, bpm: null, key: null, camelot: null, musical: null,
      earBpm: 126, prev: [], at: now, demo: true }; // #128 a laptop night: only THE EAR's BPM
    const k = Math.floor(now / 12000), t = SAMPLE[k % SAMPLE.length];
    const prev = [1, 2, 3, 4].map(i => SAMPLE[(k - i + SAMPLE.length * 4) % SAMPLE.length]).map(x => ({ line: x.artist + ' - ' + x.title, at: 0 }));
    return { on: true, title: t.title, artist: t.artist, line: t.artist + ' - ' + t.title, hidden: false, dj: 'TICK', bpm: t.bpm,
      key: t.key, camelot: t.camelot, musical: t.musical, earBpm: null, deck: 2, playing: true, positionMs: 60000 + (now % 12000) * 4, durationMs: 300000, pitch: 0, trackKey: 'demo-' + (k % SAMPLE.length),
      art: null, titles: true, prev, at: now, demo: true };
  }

  // ---------- the page ----------
  function start() {
    const p = parse(location.search);
    const $ = id => document.getElementById(id);
    const root = document.documentElement, body = document.body;
    root.style.setProperty('--k', p.scale);
    root.style.setProperty('--safe', p.safe);
    body.classList.add('bg-' + p.bg);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) body.classList.add('calm');

    const main = $('main'), chip = $('chip'), strip = $('strip');
    main.className = 'piece hide ' + p.style + ' ' + p.pos;
    main.hidden = p.style === 'none';
    if (p.chip) chip.classList.add(p.chip);
    if (p.prev) strip.classList.add(p.prev);
    if (p.prev && p.chip && p.chip[0] === p.prev[0]) strip.classList.add('room-' + p.chip[1]); // leave the chip its corner
    if (p.style !== 'card' && p.prev && p.pos[0] === p.prev[0]) strip.classList.add(p.prev === 'top' ? 'below' : 'above');
    const bar = $('bar'), wave = $('wave'), line = $('line');
    bar.hidden = !p.bar || p.style === 'none' || p.style === 'ticker';
    wave.hidden = p.bar !== 'wave';

    let np = null, gotAt = 0, lastOk = 0, shownKey = null, swapping = false, holdT = 0, waveFor = null, waveData = null;

    const text = (el, v) => { if (el.textContent !== v) el.textContent = v; };
    function fill(v) {
      const m = v && v.main;
      text($('label'), m ? m.label : '');
      text($('title'), m ? m.title : '');
      text($('sub'), m ? m.sub : '');
      $('sub').hidden = !(m && m.sub);
      text($('meta'), m ? m.meta : '');
      $('meta').hidden = !(m && m.meta);
      const img = $('art');
      if (m && m.art && p.style !== 'ticker') { if (img.getAttribute('src') !== m.art) img.src = m.art; img.hidden = false; }
      else { img.hidden = true; img.removeAttribute('src'); }
      // the ticker: one line that scrolls only when it doesn't fit
      const tk = $('tick');
      tk.textContent = m ? (m.sub ? m.sub + ' - ' : '') + m.title : '';
      main.classList.remove('roll');
      if (p.style === 'ticker' && m && !reduce) requestAnimationFrame(() => {
        const over = tk.scrollWidth - tk.parentNode.clientWidth;
        if (over > 4) { main.classList.add('roll'); tk.style.setProperty('--over', -over + 'px'); tk.style.animationDuration = Math.max(6, over / 40 + 4) + 's'; }
      });
    }
    function showMain() {
      main.classList.remove('hide');
      clearTimeout(holdT);
      if (p.hold) holdT = setTimeout(() => main.classList.add('hide'), p.hold * 1000);
    }
    function render() {
      const v = view(np, p);
      const key = v && v.main ? v.key : null;
      if (key !== shownKey && !swapping) {
        if (shownKey === null) { fill(v); shownKey = key; if (key) showMain(); }
        else {
          // out, swap, in: a track change reads as a change on stream
          swapping = true;
          main.classList.add('hide');
          clearTimeout(holdT);
          setTimeout(() => {
            const now = view(np, p);
            shownKey = now && now.main ? now.key : null;
            fill(now);
            if (shownKey) showMain();
            swapping = false;
          }, reduce ? 300 : 650);
        }
      }
      text(chip, v ? v.chip : '');
      chip.hidden = !(v && v.chip);
      const items = v ? v.prev : [];
      const sig = items.join('\n');
      if (strip.dataset.sig !== sig) {
        strip.dataset.sig = sig;
        strip.replaceChildren();
        if (items.length) {
          const l = document.createElement('b'); l.textContent = 'BEFORE'; strip.append(l);
          items.forEach(t => { const x = document.createElement('span'); x.textContent = t; strip.append(x); });
        }
      }
      strip.hidden = !items.length;
    }

    async function waveformFor(deck, key) {
      if (waveFor === key) return;
      waveFor = key; waveData = null;
      if (!key || np.demo) return;
      try {
        const r = await fetch('/api/waveform/' + deck, { cache: 'no-store' });
        if (!r.ok) return;
        const w = await r.json();
        if (w.trackKey !== key || waveFor !== key) return;
        const bytes = b => Uint8Array.from(atob(b || ''), c => c.charCodeAt(0));
        waveData = { key: w.trackKey, detail: bytes(w.detail), perSec: w.detailPerSecond, overview: bytes(w.overview) };
      } catch (e) { /* the plain line instead */ }
    }
    const fit = c => {
      const r = Math.min(2, devicePixelRatio || 1), W = Math.round(c.clientWidth * r), H = Math.round(c.clientHeight * r);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      return [c.getContext('2d'), W, H, r];
    };
    function frame() {
      if (!bar.hidden && np && np.on && np.durationMs) {
        const pos = position(np, performance.now() - gotAt);
        const show = p.bar === 'wave' && waveData && typeof Waves !== 'undefined';
        wave.hidden = !show; line.hidden = !!show;
        if (show) {
          try {
            Waves.overview(wave, waveData, pos, { trackKey: np.trackKey, durationMs: np.durationMs, playing: np.playing, pitch: np.pitch || 0, cuesMs: [], player: np.deck },
              { fit, color: 'rgb', struct: null });
          } catch (e) { wave.hidden = true; line.hidden = false; }
        } else line.firstElementChild.style.width = (pos / np.durationMs * 100).toFixed(2) + '%';
        bar.classList.remove('none');
      } else bar.classList.add('none');
      requestAnimationFrame(frame);
    }

    async function poll() {
      try {
        if (p.demo) { np = sample(Date.now(), p.demoEar); gotAt = performance.now(); lastOk = Date.now(); }
        else {
          const ac = new AbortController(), t = setTimeout(() => ac.abort(), 4000);
          const r = await fetch('/api/nowplaying.json', { cache: 'no-store', signal: ac.signal });
          clearTimeout(t);
          if (r.ok) { np = await r.json(); gotAt = performance.now(); lastOk = Date.now(); }
        }
      } catch (e) { /* the box is restarting or the Wi-Fi blinked: the next poll */ }
      if (Date.now() - lastOk > 15000) np = null; // never a stale track on stream
      if (p.bar === 'wave' && np && np.on) waveformFor(np.deck, np.trackKey);
      render();
      setTimeout(poll, 1000);
    }
    poll();
    requestAnimationFrame(frame);
  }

  return { parse, build, view, position, sample, start, STYLES, CORNERS };
})();
if (typeof module !== 'undefined') module.exports = Overlay;
else if (document.body && document.body.hasAttribute('data-overlay')) Overlay.start(); // stream.html only borrows parse / build / view
