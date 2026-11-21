'use strict';
/*
 * DECK VIEWS (DECISIONS #90, Nov 21). a club Nov 20, a tall narrow window beside MagicQ (~300 x 480, STACKED): the
 * on-air row took most of the window, so its waveform turned into giant blocky bars showing about two beats
 * ("waveforms r massive", "can't tell what's going on"); titles were cut at the end, mid-word, and no deck showed its
 * artist. This file holds the pieces app.js calls for that:
 *   - Views.label(artist, title, n): artist + title shortened to n characters, keeping the remix / edit name.
 *   - Views.windowS(d): the scrolling waveform's width in time = LAYOUT -> ZOOM bars at the track's own tempo.
 *   - Views.spec / Views.sized: the most height a STACKED row may take (its waveform capped by its width), and the
 *     whole-track strip under the on-air deck's waveform when the row has room for it.
 *   - Views.after: draws that strip. Views.title: puts the shortened label on a row (text node only).
 * Loaded before app.js; only reads app.js's globals (DV, FIT, drawOverview) inside functions.
 */
const Views = (() => {
  // ---------- titles ----------
  // Tags that say nothing on a DJ deck: dropped first when space is short (never when there's room).
  const NOISE = /^(original|original mix|extended|extended mix|extended version|original version|main mix|album version|(clean|dirty|explicit)( version)?)$/i;
  const FEAT = /^(feat\.?|ft\.?|featuring|with)\s/i;
  const VERSION = /\b(mix|remix|edit|dub|rework|bootleg|flip|vip|version|refix|remake|re-?edit|extended|original)$/i;
  const ELL = '…';

  /** "Opus (Eric Prydz Private Remix) (Extended Mix)" -> core "Opus" + groups [{t, noise, feat}]. Repeats dropped. */
  function parse(title) {
    let core = String(title || '').replace(/\s+/g, ' ').trim();
    const groups = [], seen = new Set();
    const add = t => {
      t = t.trim();
      const k = t.toLowerCase();
      if (!t || seen.has(k)) return;
      seen.add(k);
      groups.push({ t, noise: NOISE.test(t), feat: FEAT.test(t) });
    };
    core = core.replace(/\s*[([]([^()[\]]*)[)\]]/g, (m, t) => { add(t); return ' '; }).replace(/\s+/g, ' ').trim();
    const ft = core.match(/^(.*?)\s+((?:feat\.?|ft\.?|featuring)\s+.+)$/i); // "Title feat. Someone" without brackets
    if (ft && ft[1]) { core = ft[1]; groups.unshift({ t: ft[2], noise: false, feat: true }); }
    const dash = core.match(/^(.+?)\s+-\s+(.+)$/);                         // "Title - Some Remix"
    if (dash && VERSION.test(dash[2])) { core = dash[1]; add(dash[2]); }
    if (!core && groups.length) core = groups.shift().t;                  // a title that is all brackets
    return { core, groups };
  }

  /** "Fred again.., Skrillex & Four Tet" -> ["Fred again..", "Skrillex", "Four Tet"]; "A feat. B" -> ["A"]. */
  function artists(a) {
    const main = String(a || '').replace(/\s+/g, ' ').trim().split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0];
    return main.split(/\s*,\s*|\s+&\s+|\s+x\s+|\s*\/\s*|\s+vs\.?\s+/i).filter(Boolean);
  }

  /** Whole words while they fit in m characters, then the ellipsis. A single word longer than m is cut (rare). */
  function words(s, m, whole) {
    if (s.length <= m) return s;
    if (m <= 1) return m === 1 ? ELL : '';
    const ws = s.split(' ');
    let out = '';
    for (const w of ws) {
      const next = out ? out + ' ' + w : w;
      if (next.length + 1 > m) break;
      out = next;
    }
    if (!out) return whole ? '' : s.slice(0, m - 1) + ELL;
    return out.replace(/[\s,;:\-–(]+$/, '') + ELL;
  }

  const join = (artist, core, gs) => (artist ? artist + ' - ' : '') + [core].concat(gs.map(g => '(' + g.t + ')')).filter(Boolean).join(' ');

  /**
   * Artist and title in at most n characters (monospace). In order, until it fits: drop the noise tags (Original /
   * Extended Mix), drop featured artists, one artist (+2 for the rest), shorten the title's own words in the middle
   * (the remix name stays whole), drop the artist, and last of all cut the end at a word.
   */
  function label(artist, title, n) {
    n = Math.max(0, Math.floor(n));
    const { core, groups } = parse(title);
    const as = artists(artist);
    const full = join(String(artist || '').trim(), core, groups);
    if (full.length <= n || n <= 0) return n <= 0 ? '' : full;
    const keep = groups.filter(g => !g.noise), main = keep.filter(g => !g.feat);
    const a1 = as.length > 1 ? as[0] + ' +' + (as.length - 1) : as[0] || '';
    const tries = [
      join(String(artist || '').trim(), core, keep),
      join(as.join(', '), core, main),
      join(a1, core, main),
    ];
    for (const t of tries) if (t.length <= n) return t;
    // The title's own words shortened, the remix / edit name kept whole: with the artist while a few words remain.
    const tail = main.map(g => '(' + g.t + ')').join(' ');
    for (const art of [a1, '']) {
      const fixed = (art ? art + ' - ' : '').length + (tail ? tail.length + 1 : 0);
      const room = n - fixed;
      if (room >= Math.min(core.length, art ? 8 : 4)) {
        const c = words(core, room, true);
        if (c) return (art ? art + ' - ' : '') + [c, tail].filter(Boolean).join(' ');
      }
      if (!art && join('', core, main).length <= n) return join('', core, main);
    }
    return words(join('', core, main), n);
  }

  // ---------- zoom by bars ----------
  /** Seconds of track across the scrolling waveform: LAYOUT -> ZOOM bars at this track's tempo (120 if unknown). */
  function windowS(d, bars) {
    const b = +bars || 8, bpm = d && d.trackBpm > 40 && d.trackBpm < 300 ? d.trackBpm : 120;
    return b * 4 * 60 / bpm;
  }

  // ---------- STACKED rows: height caps + the whole-track strip ----------
  // A row's waveform is at most this share of its width, and never taller than the max (CSS px), by LAYOUT -> WAVE SIZE.
  const CAP = { s: [.3, 80], m: [.5, 150], l: [.7, 220], xl: [.8, 280], giant: [1, 480] };
  const BIG = { loud: 1, mix: 1, lead: 1 };
  const LINE = 17, TALL = 76, PAD = 6;
  const ovH = cw => cw > 500 ? 20 : 16;
  function roleOf(r) { const c = r.classList; for (const k of ['empty', 'loud', 'mix', 'lead', 'next']) if (c.contains(k)) return k; return 'idle'; }
  /** The wave height cap for a row of this role and canvas width (CSS px). */
  function waveCap(cw, role, wave) {
    const [k, mx] = CAP[wave] || CAP.m;
    const f = BIG[role] ? 1 : role === 'next' ? .72 : .5;
    return Math.max(18, Math.round(Math.min(mx, k * cw) * f));
  }
  /** Does this row get the whole-track strip? The deck out loud (or leading), when WHOLE TRACK is on. */
  const wantsOv = (role, show) => !!BIG[role] && !!(show && show.overview);
  /** The most height this row should take: its capped waveform, the strip, its text line(s). */
  function maxFor(role, cw, wave, show) {
    if (role === 'empty') return 0; // an empty deck is one thin line (its min)
    const wv = waveCap(cw, role, wave) + (wantsOv(role, show) ? ovH(cw) + 2 : 0);
    return wv + (wv + LINE + PAD >= TALL ? 2 * LINE : LINE) + PAD;
  }
  /** fitSpec(r) plus a max (app.js fitGeometry). Width from the row: the number column and padding come off. */
  function spec(r, s) {
    const cw = Math.max(60, r.clientWidth - 44);
    return Object.assign({}, s, { max: Math.max(s.min, maxFor(roleOf(r), cw, DV.wave, DV.show)) });
  }
  /** After the height is set: the whole-track strip shows when the row has room for it beside a usable waveform. */
  function sized(r, h) {
    const cw = Math.max(60, r.clientWidth - 44), oh = ovH(cw);
    const on = wantsOv(roleOf(r), DV.show) && !r.classList.contains('slim') && h - oh - 2 * LINE - PAD >= 34;
    r.classList.toggle('ov', on);
    r.style.setProperty('--ovh', oh + 'px');
  }
  /** Each frame, after the row's waveform: its whole-track strip (drawn once per track, redrawn when it moves a px). */
  function after(p, sc, w, pos, d) {
    const row = sc.parentNode;
    if (!row || !row.classList.contains('ov')) return;
    let ov = row._ov;
    if (!ov) { ov = row._ov = document.createElement('canvas'); ov.className = 'sov'; row.insertBefore(ov, sc.nextSibling); }
    if (ov.clientWidth && ov.clientHeight) drawOverview(ov, w, pos, d); // not laid out yet: next frame
  }

  // ---------- a row's label ----------
  const chW = {};
  function charWidth(e) {
    const cs = getComputedStyle(e), font = cs.font || cs.fontSize + ' ' + cs.fontFamily;
    if (!chW[font]) {
      const g = document.createElement('canvas').getContext('2d');
      g.font = font;
      chW[font] = g.measureText('0000000000').width / 10 || 7;
    }
    return chW[font] + (parseFloat(cs.letterSpacing) || 0);
  }
  /** The row's track line: artist + title shortened to the room it has. Re-measured on a new track or every 0.5 s. */
  function title(e, d) {
    if (!d || d.load !== 'LOADED') { e._lk = ''; return ''; }
    const show = !DV.show || DV.show.artist !== 0;
    const row = e.parentNode && e.parentNode.parentNode; // a row going tall / slim changes the room: measure again at once
    const k = d.trackKey + '|' + d.artist + '|' + d.title + '|' + show + '|' + innerWidth + '|' + (row ? row.className : ''), now = performance.now();
    if (e._lk === k && now - e._la < 500) return e._lt;
    const wpx = e.clientWidth;
    const n = wpx ? Math.floor(wpx / charWidth(e)) : 999;
    e._lk = k; e._la = now;
    e._lt = label(show ? d.artist : '', d.title || '', n);
    return e._lt;
  }

  // ---------- presets ----------
  /** The view a window of this shape gets when nobody picked one: tall + narrow = SIDE, small = CORNER, else CLASSIC. */
  function auto(w, h) {
    if (w < 620 && h >= w * 1.15) return 'side';
    if (w < 900 || h < 600) return 'corner';
    return 'classic';
  }

  return { label, parse, windowS, waveCap, maxFor, spec, sized, after, title, auto };
})();
if (typeof module !== 'undefined') module.exports = Views;
