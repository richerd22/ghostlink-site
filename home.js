// GHOST LINK home (DECISIONS #95). The hero is two decks running made-up tracks (the demo's), drawn on canvases the
// way the dashboard draws them; the ghost dances on their beat (a few of dances.js's moves) and jumps when tapped;
// the signal-path strip lights the stage you're on; the crew call counts down. Nothing loads, nothing is sent.
// prefers-reduced-motion: one still frame, no dancing, no counting. No JavaScript: the page reads the same.
(function () {
  'use strict';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- the tracks (made up, same as the dashboard demo) ----------
  var TRACKS = [
    ['Harbour Lights', 'Tessa Quill', '8A', '#2fb8ff'], ['Second Wind', 'Arlo Venn', '9A', '#ffb000'],
    ['Copper Wire', 'Noor Fallon', '8B', '#ff2a2a'], ['Saltwater Radio', 'June Ashby', '7A', '#3cd070'],
    ['Late Shift', 'Corran', '9B', '#b36bff'], ['Tin Roof', 'Mae Ostrow', '8A', '#ff7ab6']];
  var BPM = 124, SPB = 60 / BPM, KINDS = ['INTRO', 'UP', 'CHORUS', 'DOWN', 'UP', 'CHORUS', 'OUTRO'];
  var PH_BEATS = 64, DUR = KINDS.length * PH_BEATS * SPB, RATE = 60; // waveform samples per second
  var next = 0;

  function makeTrack() {
    var t = TRACKS[next++ % TRACKS.length], n = Math.ceil(DUR * RATE), h = new Float32Array(n), col = new Array(n);
    var seed = next * 7919 + 13;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < n; i++) {
      var s = i / RATE, beat = s / SPB, ph = beat % 1, k = KINDS[Math.min(KINDS.length - 1, Math.floor(beat / PH_BEATS))];
      var e = k === 'CHORUS' ? 1 : k === 'UP' ? 0.8 : k === 'DOWN' ? 0.42 : 0.6;
      var kick = k !== 'DOWN' && ph < 0.1, hat = ph > 0.48 && ph < 0.56;
      var v, r, g, b;
      if (kick) { v = 0.78 + rnd() * 0.22; r = 190 + rnd() * 40; g = 120 + rnd() * 50; b = 110 + rnd() * 40; }
      else { v = (0.2 + rnd() * 0.38) * e + (hat ? 0.16 : 0) + (beat % 2 > 1.5 ? 0.1 : 0); r = 60 + rnd() * 60; g = 170 + rnd() * 60; b = hat ? 240 : 120 + rnd() * 120; }
      if (k === 'INTRO' || k === 'OUTRO') v *= ph < 0.1 ? 1 : 0.75;
      h[i] = Math.min(1, v);
      col[i] = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
    }
    return { title: t[0], artist: t[1], key: t[2], color: t[3], h: h, col: col };
  }

  // ---------- the two decks ----------
  var decksEl = $('#decks');
  var D = $$('.h-deck').map(function (el) {
    return { el: el, cv: $('canvas', el), title: $('.h-title', el), left: $('.h-left', el),
      key: $('.h-key', el), beats: $$('.h-beats i', el), track: null, pos: 0, playing: false, master: false, lastBeat: -1 };
  });
  if (D.length === 2) {
    D[0].track = makeTrack(); D[0].pos = DUR - PH_BEATS * SPB - 22; D[0].playing = true; D[0].master = true;
    D[1].track = makeTrack(); D[1].pos = 0;
  }

  function fmt(s) { s = Math.max(0, Math.ceil(s)); return '-' + Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function label(d) {
    var tg = d.playing ? '<span class="h-tag air">ON AIR</span>' : '<span class="h-tag cue">CUED</span>';
    if (d.master) tg += '<span class="h-tag m">MASTER</span>';
    var row = $('.h-row', d.el), num = $('.h-num', row);
    $$('.h-tag', row).forEach(function (x) { x.remove(); });
    num.insertAdjacentHTML('afterend', tg);
    d.title.innerHTML = '<i class="h-col" style="background:' + d.track.color + '"></i><b>' + esc(d.track.title) + '</b> <span>' + esc(d.track.artist) + '</span>';
    d.key.textContent = d.track.key;
  }

  function step(dt) {
    var a = D[0], b = D[1];
    D.forEach(function (d) { if (d.playing) d.pos += dt; });
    // The mix: when the playing deck reaches its outro, the cued one starts on the phrase; after 32 beats it takes
    // MASTER; the old one plays out to the end, then loads the next track and waits.
    var on = D.filter(function (d) { return d.playing; });
    if (on.length === 1) {
      var p = on[0], o = p === a ? b : a, outro = (KINDS.length - 1) * PH_BEATS * SPB;
      if (p.pos >= outro) { o.playing = true; o.pos = p.pos - outro; label(o); }
    } else if (on.length === 2) {
      var older = a.pos > b.pos ? a : b, newer = older === a ? b : a;
      if (!newer.master && newer.pos >= 32 * SPB) { newer.master = true; older.master = false; label(newer); label(older); }
      if (older.pos >= DUR) { older.playing = false; older.master = false; older.track = makeTrack(); older.pos = 0; label(older); }
    }
  }

  function master() { return D[0].master ? D[0] : D[1]; }

  function draw(d, cv) {
    cv = cv || d.cv;
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    var pps = W < 600 ? 70 : 110, mid = H / 2, cx = Math.round(W * 0.5), t = d.track, n = t.h.length;
    g.globalAlpha = d.playing ? 1 : 0.55;
    for (var x = 0; x < W; x++) {
      var s = d.pos + (x - cx) / pps, i = Math.floor(s * RATE);
      if (i < 0 || i >= n) continue;
      var v = t.h[i] * (mid - 4);
      g.fillStyle = t.col[i];
      g.fillRect(x, mid - v, 1, v * 2);
    }
    // beat ticks, a line on every bar, brighter at a new phrase
    var first = Math.ceil((d.pos - cx / pps) / SPB), last = Math.floor((d.pos + (W - cx) / pps) / SPB);
    for (var k = Math.max(0, first); k <= last; k++) {
      var bx = Math.round(cx + (k * SPB - d.pos) * pps) + 0.5;
      if (k % PH_BEATS === 0) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(bx, 0, 1, H); }
      else if (k % 4 === 0) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx, 0, 1, H); }
      g.fillStyle = '#666'; g.fillRect(bx, 0, 1, 4); g.fillRect(bx, H - 4, 1, 4);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#fff'; g.fillRect(cx - 1, 0, 2, H);
  }

  function readouts(d) {
    d.left.textContent = fmt(DUR - d.pos);
    var beat = Math.floor(d.pos / SPB);
    if (beat !== d.lastBeat) {
      d.lastBeat = beat;
      d.beats.forEach(function (b, i) { b.className = d.playing && i === beat % 4 ? 'on' + (i === 0 ? ' one' : '') : ''; });
      if (d.master && d.playing) onBeat(beat);
    }
  }

  // ---------- the ghost ----------
  // Two of him: the big one by the name (#ghost) and the one on the waveform floor further down. Same moves, same beat.
  var gEls = $$('.dancer'), gBtn = $('.h-ghost');
  var BODY = { n: ['|      | ', '|      | '], hr: ['|      | ', ' |      |'], hl: [' |      |', '|      | '],
    up: ['|      |/', '|      | '], out: ['|      |-', '|      | '], dn: ['|      | ', '|      |\\'], pt: ['|      |`', '|      | '] };
  var HEM = { n: ' \\/\\/\\/  ', f: ' /\\/\\/\\  ', r: '  \\/\\/\\/ ', l: '\\/\\/\\/   ', k: ' \\/\\/\\/\\_', w: ' \\_/\\_/  ' };
  var MOVES = {
    low: [[{ y: 1 }, {}, {}, {}], [{ r: -4, x: -1 }, { r: 4, x: 1 }], [{ y: -1, sy: 1.04 }, {}, { y: -1, sy: 1.04 }, {}],
      [{ x: -2, h: 'r' }, { x: -1 }, { x: 2, h: 'l' }, { x: 1 }]],
    mid: [[{ x: -2, b: 'hr', h: 'r' }, { x: 2, b: 'hl', h: 'l' }], [{ b: 'up' }, { b: 'out' }, { b: 'up' }, { b: 'dn' }],
      [{ y: -3 }, { y: 0, h: 'w' }, { y: -3 }, { y: 0, h: 'w' }], [{ r: -5, b: 'out' }, {}, { r: 5, b: 'out', m: 1 }, {}]],
    high: [[{ y: -8, h: 'f' }, { y: 0, h: 'k' }], [{ b: 'pt', r: -6, y: -4 }, {}, { b: 'pt', r: -6, y: -4, m: 1 }, {}],
      [{ b: 'out' }, { b: 'up' }, { b: 'dn' }, { b: 'out', m: 1 }], [{ x: -3, h: 'r', r: -3, b: 'hr' }, { x: 3, h: 'l', r: 3, b: 'hl' }],
      [{ y: -6, sy: 1.08, h: 'f' }, { sy: 0.92, h: 'k' }, { y: -6, sy: 1.08, h: 'f', m: 1 }, { sy: 0.92, h: 'w' }]]
  };
  var move = null, lastMove = null, lean = 0, hop = 0;

  function pose(p) {
    p = p || {};
    var b = BODY[p.b || 'n'];
    var rows = ['  .--.   ', ' / oo \\  ', b[0], b[1], HEM[p.h || 'n']];
    if (p.m) rows = rows.map(function (r) { return r.split('').reverse().join('').replace(/[\/\\]/g, function (c) { return c === '/' ? '\\' : '/'; }).replace(/`/g, '\''); });
    gEls.forEach(function (g) {
      g.textContent = rows.join('\n');
      var f = parseFloat(getComputedStyle(g).fontSize) / 10;
      g.dataset.x = (p.x || 0) * f; g.dataset.y = (p.y || 0) * f; g.dataset.r = p.r || 0; g.dataset.sy = p.sy || 1;
    });
    place();
  }
  function place() {
    gEls.forEach(function (g) {
      var f = parseFloat(getComputedStyle(g).fontSize) / 10;
      var x = +g.dataset.x || 0, y = (+g.dataset.y || 0) - hop * f, r = (+g.dataset.r || 0) + lean, sy = +g.dataset.sy || 1;
      g.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + r.toFixed(1) + 'deg) scaleY(' + sy + ')';
    });
  }
  function sectionAt(d) { return KINDS[Math.min(KINDS.length - 1, Math.floor(d.pos / SPB / PH_BEATS))]; }
  function onBeat(beat) {
    var k = sectionAt(master()), tier = k === 'CHORUS' ? 'high' : k === 'UP' ? 'mid' : 'low';
    if (!move || beat % 16 === 0 || move.tier !== tier) {
      var bag = MOVES[tier], pick;
      do { pick = bag[Math.floor(Math.random() * bag.length)]; } while (bag.length > 1 && pick === lastMove);
      lastMove = pick; move = { tier: tier, poses: pick, at: beat };
    }
    if (floorSec) floorSec.textContent = (k === 'DOWN' ? 'BREAKDOWN' : k) + (tier === 'high' ? ' · BIG MOVES' : tier === 'low' ? ' · CALM' : '');
    if (!gEls.length || still) return;
    pose(move.poses[(beat - move.at) % move.poses.length]);
  }
  if (gBtn && !still) gBtn.addEventListener('click', function () {
    hop = 8; place();
    move = { tier: 'tap', poses: MOVES.high[Math.floor(Math.random() * MOVES.high.length)], at: master().lastBeat + 1 };
    setTimeout(function () { hop = 0; place(); }, 180);
  });
  // He leans into a fast scroll, then straightens up.
  var lastY = window.scrollY, leanT = null;
  if (!still) window.addEventListener('scroll', function () {
    var dy = window.scrollY - lastY; lastY = window.scrollY;
    lean = Math.max(-9, Math.min(9, dy * 0.25)); place();
    clearTimeout(leanT); leanT = setTimeout(function () { lean = 0; place(); }, 120);
  }, { passive: true });

  // ---------- run the decks only while they're on screen ----------
  // (and the floor further down: the master deck's waveform under the second ghost)
  var floorCv = $('#floorWave'), floorSec = $('#floorSec');
  var heroSeen = true, floorSeen = false, running = false, last = 0;
  function frame(ts) {
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
    step(dt);
    D.forEach(function (d) { if (heroSeen || still) draw(d); readouts(d); });
    if (floorCv && (floorSeen || still)) draw(master(), floorCv);
    running = (heroSeen || floorSeen) && !still && !document.hidden;
    if (running) requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!running && (heroSeen || floorSeen) && !still && !document.hidden) { running = true; requestAnimationFrame(frame); } }
  if (D.length === 2) {
    D.forEach(label);
    running = true; requestAnimationFrame(frame);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { heroSeen = es[0].isIntersecting; wake(); }).observe(decksEl);
      if (floorCv) new IntersectionObserver(function (es) { floorSeen = es[0].isIntersecting; wake(); }).observe(floorCv);
    } else floorSeen = true;
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('resize', function () { if (still) { D.forEach(function (d) { draw(d); }); if (floorCv) draw(master(), floorCv); } });
  }

  // ---------- the signal path strip ----------
  var links = $$('.path a');
  if (links.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.dataset.s === e.target.id;
          a.classList.toggle('on', on);
          if (on) a.parentNode.scrollLeft = Math.max(0, a.offsetLeft - a.parentNode.offsetLeft - 16); // keep it in sight on a phone
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    links.forEach(function (a) { var s = document.getElementById(a.dataset.s); if (s) io.observe(s); });
  }

  // ---------- the crew call counts down while you look at it ----------
  var ct = $('#callT');
  if (ct && !still && 'IntersectionObserver' in window) {
    var left = 120, tmr = null;
    var tick = function () {
      left--;
      if (left < 0) { ct.textContent = 'GO'; if (left < -3) left = 120; else return; }
      ct.textContent = Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2);
    };
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { if (!tmr) tmr = setInterval(tick, 1000); } else { clearInterval(tmr); tmr = null; }
    }).observe(ct);
  }
})();
