'use strict';
/*
 * WAVEFORMS (DECISIONS #84, Nov 19; a club: "waveforms rlly are a big one"). Draws the scrolling and the whole-track
 * waveforms for the dashboard (app.js calls Waves.detail / Waves.overview) and the TV (tv.html).
 *
 * Cheap: the scrolling waveform is drawn once per track and zoom into 256-pixel strips (kept, at most 14 per deck)
 * and each frame only places two or three strips and draws the lines on top. The strips sit on a fixed grid of the
 * track, so the waveform slides instead of shimmering (each frame used to re-pick which moment every pixel showed).
 * The whole-track overview is drawn once and only redrawn when its playhead moves a pixel.
 * Easier to read: each column shows its average loudness in full colour with the peak in a dimmer shade around it,
 * beat ticks top and bottom, a full line on every bar (brighter at a new section), cue points, the loop, and the
 * playhead goes amber in the last 30 s. Before the waveform arrives: one quiet grey line, never the last track's.
 */
const Waves = (() => {
  const CH = 256;          // strip width, device pixels
  const KEEP = 14;         // strips kept per waveform
  const END_S = 30;        // playhead amber in the last 30 s (real time), like the players' end warning
  const AMBER = '#ffb000';
  const anchors = {};      // player -> { key, ms, inBar }: the last beat packet in track time (no grid, no phrases)

  /** r, g, b of segment i in colour mode (players' own, blue, mono). level 0-1 for blue. */
  function rgb(a, i, mode, level) {
    if (mode === 'blue') { const l = Math.max(0, Math.min(1, level)); return [40 + 200 * l * l | 0, 110 + 140 * l * l | 0, 255]; }
    if (mode === 'mono') return [216, 216, 216];
    return [a[i * 4 + 1], a[i * 4 + 2], a[i * 4 + 3]];
  }

  /** One strip: absolute columns k*CH .. k*CH+CH-1, column c covering segments [c*perPx, (c+1)*perPx). */
  function strip(w, k, perPx, H, mode) {
    const cv = document.createElement('canvas');
    cv.width = CH; cv.height = H;
    const g = cv.getContext('2d'), img = g.createImageData(CH, H), px = new Uint32Array(img.data.buffer);
    const a = w.detail, n = a.length / 4, mid = H / 2;
    for (let x = 0; x < CH; x++) {
      const c = k * CH + x;
      const s0 = Math.floor(c * perPx), s1 = Math.max(s0 + 1, Math.floor((c + 1) * perPx));
      if (s1 <= 0 || s0 >= n) continue;
      let max = 0, sum = 0, cnt = 0, at = Math.max(0, s0);
      for (let i = Math.max(0, s0); i < s1 && i < n; i++) { const h = a[i * 4]; sum += h; cnt++; if (h > max) { max = h; at = i; } }
      if (!cnt) continue;
      const [r, gg, b] = rgb(a, at, mode, max / 31);
      const body = (255 << 24) | (b << 16) | (gg << 8) | r;                                    // RGBA bytes, little-endian
      const edge = (255 << 24) | ((b * .5 | 0) << 16) | ((gg * .5 | 0) << 8) | (r * .5 | 0);
      const hm = Math.max(1, Math.round(max / 31 * mid)), hb = Math.round(sum / cnt / 31 * mid);
      const top = Math.max(0, Math.round(mid - hm)), bot = Math.min(H, Math.round(mid + hm));
      const bt = Math.round(mid - hb), bb = Math.round(mid + hb);
      for (let y = top; y < bot; y++) px[y * CH + x] = y >= bt && y < bb ? body : edge;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  function strips(w, perPx, H, mode) {
    const key = perPx.toFixed(5) + '|' + H + '|' + mode;
    if (!w._st || w._st.key !== key) w._st = { key, m: new Map() };
    return w._st.m;
  }

  /** Every beat between a and b (track ms): cb(ms, kind) with kind 0 beat, 1 bar, 2 new section. */
  function beatsIn(d, a, b, cb, grid, struct) {
    if (grid && grid.trackKey === d.trackKey && grid.beatMs && grid.beatMs.length) {
      const t = grid.beatMs, f = grid.firstDownbeat || 0;
      let lo = 0, hi = t.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < a) lo = m + 1; else hi = m; }
      const starts = struct && struct.trackKey === d.trackKey ? new Set(struct.phrases.map(p => p.startBeat - 1)) : null;
      for (let i = lo; i < t.length && t[i] <= b; i++) cb(t[i], starts && starts.has(i) ? 2 : ((i - f) % 4 + 4) % 4 === 0 ? 1 : 0);
      return true;
    }
    const ph = struct && struct.trackKey === d.trackKey ? struct.phrases : null;
    if (ph && ph.length && d.trackBpm > 0) {
      const dflt = 60000 / d.trackBpm;
      for (let k = -1; k < ph.length; k++) {
        const p = k < 0 ? null : ph[k], q = ph[k + 1];
        const s = p ? p.startMs : q.startMs - Math.ceil(q.startMs / (dflt * 4)) * dflt * 4; // before the first: whole bars back
        const e = q ? q.startMs : (d.durationMs || p.endMs);
        if (e < a || s > b) continue;
        const bm = p && q && q.startBeat > p.startBeat ? (q.startMs - p.startMs) / (q.startBeat - p.startBeat) : dflt;
        for (let j = Math.max(0, Math.floor((a - s) / bm)); ; j++) {
          const ms = s + j * bm;
          if (ms >= e - 1 || ms > b) break;
          if (ms >= a && ms >= 0) cb(ms, j === 0 && p ? 2 : j % 4 === 0 ? 1 : 0);
        }
      }
      return true;
    }
    const an = anchors[d.player];
    if (an && an.key === d.trackKey && d.trackBpm > 0) { // the last beat packet: we know where one beat was and which
      const bm = 60000 / d.trackBpm;
      for (let j = Math.ceil((a - an.ms) / bm); an.ms + j * bm <= b; j++) {
        const ms = an.ms + j * bm;
        if (ms >= 0) cb(ms, ((an.inBar - 1 + j) % 4 + 4) % 4 === 0 ? 1 : 0);
      }
      return true;
    }
    return false;
  }

  /** A beat packet arrived for this deck (track position at that instant): the fallback grid. */
  function beat(d, inBar, posMs) {
    if (d && d.trackKey && inBar >= 1 && inBar <= 4) anchors[d.player] = { key: d.trackKey, ms: posMs, inBar };
  }

  const ending = (d, pos) => !!d && d.playing && d.durationMs > 0 && !(d.info && d.info.looping)
    && (d.durationMs - pos) / (1 + d.pitch / 100) < END_S * 1000;

  /**
   * The scrolling waveform. opt: { fit, windowS, color, grid, struct }. fit(c) -> [g, W, H, r] sizes the canvas to
   * its CSS size x devicePixelRatio (sharp on phones / retina).
   */
  function detail(c, w, pos, d, opt) {
    const [g, W, H, r] = opt.fit(c);
    c._wait = null;
    g.clearRect(0, 0, W, H);
    const perSec = w.perSec || 150, n = w.detail.length / 4;
    if (!n || !W || !H) return;
    const perPx = opt.windowS * perSec / W;             // segments per device pixel
    const colAt = pos / 1000 * perSec / perPx;           // the playhead's absolute column
    const off = Math.round(W / 2 - colAt);               // where absolute column 0 sits on screen
    const m = strips(w, perPx, H, opt.color || 'rgb');
    const k0 = Math.floor(-off / CH), k1 = Math.floor((W - off) / CH);
    const msPx = 1000 * perPx / perSec;                  // track ms per device pixel
    const X = ms => off + ms / msPx;
    // The active loop, shaded like on the player, edges marked.
    const i = d && d.info, lp = i && i.looping && d.loop;
    if (lp) {
      const x0 = Math.max(0, X(lp[0])), x1 = Math.min(W, X(lp[1]));
      if (x1 > x0) g.fillStyle = 'rgba(255,176,0,.22)', g.fillRect(x0, 0, x1 - x0, H);
    }
    for (let k = k0; k <= k1; k++) {
      if ((k + 1) * CH * perPx < 0 || k * CH * perPx >= n) continue;
      let s = m.get(k);
      if (!s) {
        s = strip(w, k, perPx, H, opt.color || 'rgb');
        m.set(k, s);
        if (m.size > KEEP) { // drop the strip furthest from here
          let far = null, fd = -1;
          for (const kk of m.keys()) { const dd = Math.abs(kk - k); if (dd > fd) { fd = dd; far = kk; } }
          m.delete(far);
        }
      }
      g.drawImage(s, off + k * CH, 0);
    }
    const a = pos - W / 2 * msPx, b = pos + W / 2 * msPx;
    // Beat grid: ticks top and bottom on every beat, a faint full line on each bar, brighter at a new section.
    // Only when beats are at least 6 px apart (wide zoom on a small window would be a grey wash).
    const bpm = d.trackBpm || 120, pxBeat = 60000 / bpm / msPx;
    // #90: zoomed out (16 / 32 bars in a small window) the beats are too close: bar lines only, while bars are 6 px apart.
    if (pxBeat * 4 >= 6 * r) {
      const tick = Math.max(2 * r, Math.round(H * (H < 60 * r ? .14 : .1))), lw = Math.max(1, Math.round(r));
      const bars = [], secs = [], ticks = [], beatsToo = pxBeat >= 6 * r;
      beatsIn(d, a, b, (ms, kind) => { const x = Math.round(X(ms)); if (kind || beatsToo) (kind === 2 ? secs : kind === 1 ? bars : ticks).push(x); }, opt.grid, opt.struct);
      g.fillStyle = 'rgba(255,255,255,.16)';
      for (const x of bars) g.fillRect(x, 0, lw, H);
      g.fillStyle = 'rgba(255,255,255,.45)';
      for (const x of secs) g.fillRect(x, 0, lw * 2, H);
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (const x of ticks) { g.fillRect(x, 0, lw, tick); g.fillRect(x, H - tick, lw, tick); }
      g.fillStyle = '#fff';
      for (const x of bars.concat(secs)) { g.fillRect(x, 0, lw * 2, tick * 1.4); g.fillRect(x, H - tick * 1.4, lw * 2, tick * 1.4); }
    }
    // Loop edges on top of the wave.
    if (lp) {
      g.fillStyle = 'rgba(255,176,0,.95)';
      const e = Math.max(2, r * 2);
      if (X(lp[0]) >= 0 && X(lp[0]) <= W) g.fillRect(Math.round(X(lp[0])), 0, e, H);
      if (X(lp[1]) >= 0 && X(lp[1]) <= W) g.fillRect(Math.round(X(lp[1]) - e), 0, e, H);
    }
    // Cue points (hot cues and memory cues): a small marker on top and a faint line.
    if (d && d.cuesMs && d.cuesMs.length) {
      const sz = Math.max(4 * r, Math.min(8 * r, H * .12));
      for (const cue of d.cuesMs) {
        if (cue < a || cue > b) continue;
        const x = Math.round(X(cue));
        g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x, 0, Math.max(1, r), H);
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - sz, 0); g.lineTo(x + sz, 0); g.lineTo(x, sz * 1.2); g.closePath(); g.fill();
      }
    }
    // The playhead: white, amber in the last 30 s (with the words: REMAIN shows the time).
    g.fillStyle = ending(d, pos) ? AMBER : '#fff';
    g.fillRect(Math.round(W / 2 - r), 0, Math.max(2, Math.round(2 * r)), H);
  }

  const PHRASE_SHADE = k => /CHORUS|UP/.test(k) ? '#ffffff' : /DOWN|BRIDGE/.test(k) ? '#555555' : '#9a9a9a';

  /** The whole track, drawn once per track / size / colour; the playhead and played shade on top when they move. */
  function overview(c, w, pos, d, opt) {
    const [g, W, H, r] = opt.fit(c);
    c._wait = null;
    if (!W || !H) return; // not laid out yet (a canvas of 0 px can't be drawn from)
    const n = w.overview.length / 4;
    const st = opt.struct && opt.struct.trackKey === d.trackKey && d.durationMs ? opt.struct : null;
    const bh = st ? Math.max(3 * r, H * .18) : 0;
    const sig = [w.key, W, H, opt.color, st ? st.phrases.length : 0, (d.cuesMs || []).join(), d.durationMs].join('|');
    if (!c._ov || c._ov.sig !== sig) {
      const b = document.createElement('canvas');
      b.width = W; b.height = H;
      const bg = b.getContext('2d');
      for (let x = 0; n && x < W; x++) {
        const i = Math.floor(x / W * n), h = w.overview[i * 4] / 31 * (H - bh);
        const [rr, gg, bb] = rgb(w.overview, i, opt.color, h / H);
        bg.fillStyle = `rgb(${rr},${gg},${bb})`;
        bg.fillRect(x, H - h, 1, h);
      }
      if (st) for (const p of st.phrases) {
        const x0 = Math.round(p.startMs / d.durationMs * W), x1 = Math.round(p.endMs / d.durationMs * W);
        bg.fillStyle = PHRASE_SHADE(p.kind);
        bg.fillRect(x0 + r, 0, Math.max(1, x1 - x0 - r), bh);
      }
      if (d.durationMs) {
        bg.fillStyle = '#9a9a9a';
        for (const cue of d.cuesMs || []) bg.fillRect(Math.round(cue / d.durationMs * W), 0, Math.max(1, r), H * .3);
      }
      c._ov = { sig, b, drawn: '' };
    }
    const px = d.durationMs ? Math.round(pos / d.durationMs * W) : 0;
    const end = ending(d, pos), lp = d.info && d.info.looping && d.loop && d.durationMs ? d.loop : null;
    const now = px + '|' + end + '|' + (lp ? lp.join() : '');
    if (c._ov.drawn === now) return; // nothing moved by a pixel: leave it
    c._ov.drawn = now;
    g.clearRect(0, 0, W, H);
    g.drawImage(c._ov.b, 0, 0);
    if (px > 0) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, bh, px, H - bh); } // played
    if (lp) { g.fillStyle = 'rgba(255,176,0,.35)'; const x0 = lp[0] / d.durationMs * W; g.fillRect(x0, bh, Math.max(2 * r, lp[1] / d.durationMs * W - x0), H - bh); }
    if (end) { g.fillStyle = AMBER; g.fillRect(px, H - Math.max(2, 2 * r), W - px, Math.max(2, 2 * r)); }
    if (d.durationMs) { g.fillStyle = end ? AMBER : '#fff'; g.fillRect(px, 0, Math.max(2, Math.round(2 * r)), H); }
  }

  /** Loaded, waveform not here yet: one quiet line across the middle (never the previous track's waveform). */
  function wait(c, opt) {
    if (!c) return;
    const [g, W, H, r] = opt.fit(c);
    const sig = W + 'x' + H;
    if (c._wait === sig) return;
    c._wait = sig; c._ov = null; c._blank = false;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#2a2a2a';
    g.fillRect(0, Math.round(H / 2 - r / 2), W, Math.max(1, Math.round(r)));
  }

  return { detail, overview, wait, beat, beatsIn, CH };
})();
