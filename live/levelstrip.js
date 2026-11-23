'use strict';
// LEVEL STRIP (DECISIONS #116): one small strip per set recording, from the side file's "levels" (one point per 10 s:
// the loudest peak and the loudness in dBFS, and how many 100 ms blocks clipped). Loudness in white, peaks in grey
// behind it, a clip moment as an amber mark on top. Older recordings have no levels: no strip. Pure parts (cols) are
// checked by src/test/js/levelstrip.test.js; svg() builds the drawing with createElementNS only (no markup strings).
const LevelStrip = (() => {
  const FLOOR = -60;                                   // the strip's bottom (a REC OUT idles far under this)
  const h = db => Math.max(0, Math.min(1, (Number(db) - FLOOR) / -FLOOR));

  /** Up to `max` columns: each the loudest peak and loudness of its points (0..1) and whether any of them clipped. */
  function cols(lv, max) {
    if (!lv || !Array.isArray(lv.peak) || !lv.peak.length) return [];
    const n = lv.peak.length, w = Math.max(1, Math.min(max || 240, n)), out = [];
    for (let c = 0; c < w; c++) {
      const a = Math.floor(c * n / w), b = Math.max(a + 1, Math.floor((c + 1) * n / w));
      let peak = 0, loud = 0, clip = 0;
      for (let i = a; i < b && i < n; i++) {
        peak = Math.max(peak, h(lv.peak[i]));
        loud = Math.max(loud, h((lv.loud || [])[i]));
        clip += Number((lv.clip || [])[i]) || 0;
      }
      out.push({ peak, loud: Math.min(loud, peak || loud), clip });
    }
    return out;
  }

  /** "12 min in" for a column (for the tooltip on a clip mark). */
  function at(c, w, lv) {
    const secs = Math.round(c / w * lv.peak.length * (lv.every || 10));
    return secs < 60 ? secs + ' s in' : Math.round(secs / 60) + ' min in';
  }

  /** The strip as an <svg> (null without levels). Centred like a waveform: louder = taller. */
  function svg(lv) {
    const cs = cols(lv, 240);
    if (!cs.length) return null;
    const NS = 'http://www.w3.org/2000/svg', w = cs.length, H = 24, mid = H / 2;
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + H);
    s.setAttribute('preserveAspectRatio', 'none');
    s.setAttribute('class', 'rec-strip');
    s.setAttribute('role', 'img');
    const clips = cs.filter(c => c.clip).length;
    s.setAttribute('aria-label', 'Level over the set' + (clips ? ', clipped in ' + clips + (clips === 1 ? ' place' : ' places') : ''));
    const bars = (key, cls) => {
      let d = '';
      cs.forEach((c, i) => { const y = Math.max(0.5, c[key] * (mid - 1)); d += 'M' + i + ' ' + (mid - y).toFixed(1) + 'h1V' + (mid + y).toFixed(1) + 'h-1Z'; });
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); s.appendChild(p);
    };
    bars('peak', 'rs-peak');
    bars('loud', 'rs-loud');
    cs.forEach((c, i) => {
      if (!c.clip) return;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', Math.max(0, i - 0.5)); r.setAttribute('y', 0); r.setAttribute('width', Math.max(1.5, w / 160)); r.setAttribute('height', 3);
      r.setAttribute('class', 'rs-clip');
      const t = document.createElementNS(NS, 'title'); t.textContent = 'Clipped ' + at(i, w, lv); r.appendChild(t);
      s.appendChild(r);
    });
    return s;
  }

  return { cols, svg, FLOOR };
})();
if (typeof module !== 'undefined') module.exports = LevelStrip;
