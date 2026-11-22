// GHOST LINK home (DECISIONS #102): a SET DNA you can try. A made-up night drawn the way the box draws a real one
// (src/main/resources/web/setdna.js: a ring from 12 o'clock, one slice a track, farther out = faster, colour = key,
// a tick for each mix). ANOTHER NIGHT makes a new one. No data from anywhere; made-up DJs only. Own file.
(function () {
  'use strict';
  var cv = document.getElementById('dnaTry'), btn = document.getElementById('dnaAgain');
  if (!cv || !cv.getContext) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DJS = ['TICK', 'LIL TICK', 'TICK JR'], STYLE = { CUT: 10, QUICK: 18, BLEND: 28, LONG: 40 };
  function night() {
    var n = 22 + Math.floor(Math.random() * 22), bpm = 112 + Math.random() * 10, key = Math.floor(Math.random() * 12), t = 0, segs = [], mixes = [];
    for (var i = 0; i < n; i++) {
      bpm = Math.max(100, Math.min(145, bpm + (Math.random() * 3.4 - 1.1)));
      var r = Math.random(); key = (key + (r < 0.35 ? 0 : r < 0.7 ? 1 : r < 0.85 ? 11 : 5)) % 12;
      var len = 200 + Math.random() * 200;
      segs.push({ at: t, end: t + len, bpm: bpm, cam: (key + 1) + (Math.random() < 0.7 ? 'A' : 'B') });
      if (i) { var s = Math.random(); mixes.push({ at: t, style: s < 0.2 ? 'CUT' : s < 0.5 ? 'QUICK' : s < 0.85 ? 'BLEND' : 'LONG' }); }
      t += len;
    }
    var b = segs.map(function (s) { return s.bpm; });
    return { segs: segs, mixes: mixes, from: 0, to: t, low: Math.min.apply(null, b), high: Math.max.apply(null, b), dj: DJS[Math.floor(Math.random() * 3)] };
  }
  function colour(cam) { var m = /^(\d+)([AB])$/.exec(cam); return 'hsl(' + ((+m[1] - 1) * 30) + ', 85%, ' + (m[2] === 'A' ? 52 : 66) + '%)'; }
  function draw(m, upto) {
    var S = 540, C = S / 2, k = S / 1080, g = cv.getContext('2d'), r = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== S * r) { cv.width = S * r; cv.height = S * r; }
    g.setTransform(r, 0, 0, r, 0, 0);
    var ang = function (t) { return -Math.PI / 2 + 2 * Math.PI * Math.min(1, (t - m.from) / (m.to - m.from)); };
    var rad = function (b) { return (250 + 180 * (b - m.low) / Math.max(1, m.high - m.low)) * k; };
    var F = function (px, b) { return (b ? '600 ' : '400 ') + px + 'px "JetBrains Mono", ui-monospace, Menlo, monospace'; };
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#1c1c1c'; g.lineWidth = 1;
    [250, 340, 430].forEach(function (x) { g.beginPath(); g.arc(C, C, x * k, 0, Math.PI * 2); g.stroke(); });
    var shown = m.segs.filter(function (s) { return s.at <= upto; });
    shown.forEach(function (s) {
      var a0 = ang(s.at), a1 = Math.max(a0 + 0.004, ang(Math.min(s.end, upto)) - 0.004);
      g.beginPath(); g.arc(C, C, rad(s.bpm), a0, a1); g.arc(C, C, 200 * k, a1, a0, true); g.closePath();
      g.globalAlpha = 0.85; g.fillStyle = colour(s.cam); g.fill(); g.globalAlpha = 1;
    });
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
    shown.forEach(function (s, i) {
      var a0 = ang(s.at), a1 = ang(Math.min(s.end, upto)), R = rad(s.bpm);
      if (i === 0) g.moveTo(C + R * Math.cos(a0), C + R * Math.sin(a0)); else g.lineTo(C + R * Math.cos(a0), C + R * Math.sin(a0));
      g.arc(C, C, R, a0, a1);
    });
    g.stroke();
    g.lineWidth = 1.5;
    m.mixes.forEach(function (x) {
      if (x.at > upto) return;
      var a = ang(x.at), l = STYLE[x.style] * k;
      g.beginPath(); g.moveTo(C + 450 * k * Math.cos(a), C + 450 * k * Math.sin(a)); g.lineTo(C + (450 * k + l) * Math.cos(a), C + (450 * k + l) * Math.sin(a)); g.stroke();
    });
    g.fillStyle = '#000'; g.beginPath(); g.arc(C, C, 196 * k, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = F(13, true);
    ['  .--.  ', ' / oo \\ ', '|      |', '|      |', ' \\/\\/\\/ '].forEach(function (l, i) { g.fillText(l, C, C - 56 + i * 12); });
    g.font = F(15, true); g.fillText('SET DNA', C, C + 20);
    g.font = F(11, false); g.fillStyle = '#bdbdbd';
    g.fillText(m.segs.length + ' TRACKS · ' + Math.round(m.low) + '-' + Math.round(m.high) + ' BPM', C, C + 40);
    g.fillText(m.dj + ' (MADE UP)', C, C + 56);
    g.textAlign = 'left';
  }
  var cur = null, raf = 0;
  function go() {
    cur = night();
    cancelAnimationFrame(raf);
    if (still) { draw(cur, cur.to); return; }
    var t0 = performance.now(), D = 1400;
    (function step(now) {
      var p = Math.min(1, (now - t0) / D);
      draw(cur, cur.from + (cur.to - cur.from) * (1 - Math.pow(1 - p, 2)));
      if (p < 1) raf = requestAnimationFrame(step);
    })(t0);
  }
  if (btn) btn.addEventListener('click', go);
  var ready = document.fonts && document.fonts.load ? document.fonts.load('600 15px "JetBrains Mono"').catch(function () {}) : Promise.resolve();
  // draw when it scrolls into view, so the ring grows where someone can see it
  ready.then(function () {
    if (!('IntersectionObserver' in window)) { go(); return; }
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); go(); } }, { threshold: 0.3 });
    io.observe(cv);
  });
})();
