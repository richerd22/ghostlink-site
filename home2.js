// GHOST LINK home, round 3 (DECISIONS #96): the desk window you can drag and size, and BOO'S ARCADE teasers.
// Separate from home.js so each stays readable. No JavaScript: the window sits in the corner, the games read as text.
(function () {
  'use strict';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // ---------- 04 THE DESK WINDOW: drag by the bar, pull the corner, S / M / L / RESET, arrow keys ----------
  // Real pixels, so the dashboard inside reflows and its own AUTO picks CORNER or SIDE for the size. On touch only the
  // bar and the grip take the finger (touch-action: none on those two), so the page still scrolls everywhere else.
  var scr = $('.mon-screen'), win = $('#deskWin'), bar = $('#deskBar'), grip = $('#deskGrip'), wh = $('#deskWH'), btns = $('#deskBtns');
  if (scr && win && bar && grip) {
    var BAR = 25, MINW = 240, MINH = 150 + BAR, SIZES = { S: [320, 200], M: [480, 300], L: [760, 420] };
    var st = { x: 0, y: 0, w: 0, h: 0 };
    scr.classList.add('free');
    btns.hidden = false;
    bar.tabIndex = 0;
    var box = function () { return { W: scr.clientWidth, H: scr.clientHeight }; };
    var apply = function () {
      var b = box();
      st.w = clamp(st.w, Math.min(MINW, b.W), b.W); st.h = clamp(st.h, Math.min(MINH, b.H), b.H);
      st.x = clamp(st.x, 0, b.W - st.w); st.y = clamp(st.y, 0, b.H - st.h);
      win.style.left = Math.round(st.x) + 'px'; win.style.top = Math.round(st.y) + 'px';
      win.style.width = Math.round(st.w) + 'px'; win.style.height = Math.round(st.h) + 'px';
      wh.textContent = Math.round(st.w - 2) + ' x ' + Math.round(st.h - BAR - 2);
    };
    var size = function (k) {
      var b = box(), s = SIZES[k];
      st.w = Math.min(s[0] + 2, b.W - 20); st.h = Math.min(s[1] + BAR + 2, b.H - 20);
      st.x = b.W - st.w - 10; st.y = b.H - st.h - 10; apply();
    };
    var reset = function () { size('M'); };
    reset();
    btns.addEventListener('click', function (e) {
      var k = e.target.closest('button'); if (!k) return;
      if (k.dataset.size === 'reset') reset(); else size(k.dataset.size);
    });
    // one pointer at a time: dragging moves (bar) or sizes (grip)
    var hook = function (el, mode) {
      var start = null;
      el.addEventListener('pointerdown', function (e) {
        if (e.button > 0 || e.target.closest('button')) return;
        e.preventDefault();
        start = { px: e.clientX, py: e.clientY, x: st.x, y: st.y, w: st.w, h: st.h, id: e.pointerId };
        try { el.setPointerCapture(e.pointerId); } catch (x) {}
        scr.classList.add('dragging');
      });
      el.addEventListener('pointermove', function (e) {
        if (!start || e.pointerId !== start.id) return;
        var dx = e.clientX - start.px, dy = e.clientY - start.py;
        if (mode === 'move') { st.x = start.x + dx; st.y = start.y + dy; }
        else { st.w = start.w + dx; st.h = start.h + dy; }
        apply();
      });
      var end = function () { start = null; scr.classList.remove('dragging'); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };
    hook(bar, 'move');
    hook(grip, 'size');
    bar.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || e.target !== bar) return;
      e.preventDefault();
      if (e.shiftKey) { st.w += d[0] * 16; st.h += d[1] * 16; } else { st.x += d[0] * 16; st.y += d[1] * 16; }
      apply();
    });
    window.addEventListener('resize', apply);
  }

  // ---------- BOO'S ARCADE teasers, on a 124 BPM clock of their own, only while on screen ----------
  var arc = $('#arcade');
  if (!arc) return;
  var SPB = 60 / 124, t0 = performance.now();
  var beatsNow = function () { return (performance.now() - t0) / 1000 / SPB; };

  // RIDE THE WAVE: hold to rise, let go to fall, stay on the dotted line. Nobody holding: BOO rides it by himself.
  var ride = $('#gRide'), cv = ride && $('canvas', ride), score = ride && $('.g-score', ride);
  var boo = { y: 55, vy: 0, hold: false, lastHand: -1e9, on: 0, n: 0, shown: 0 };
  var path = function (s, H) { return H * 0.5 + Math.sin(s * 1.1) * H * 0.22 + Math.sin(s * 0.37 + 1) * H * 0.12; };
  var level = function (s) { var b = s / SPB, ph = ((b % 1) + 1) % 1; return ph < 0.1 ? 0.95 : 0.25 + 0.3 * Math.abs(Math.sin(s * 37.1) * Math.sin(s * 11.3)) + (ph > 0.48 && ph < 0.56 ? 0.18 : 0); };
  function drawRide(now) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var g = cv.getContext('2d'), s0 = (now - t0) / 1000, px = 60, bx = Math.round(W * 0.3);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    for (var x = 0; x < W; x += 3) {                      // the track under him, quiet
      var s = s0 + (x - bx) / px, v = level(s) * (H / 2 - 4), b = (((s / SPB) % 1) + 1) % 1 < 0.1;
      g.fillStyle = b ? 'rgba(214,140,124,.45)' : 'rgba(80,190,170,.35)'; g.fillRect(x, H / 2 - v, 2, v * 2);
    }
    g.fillStyle = '#fff';                                  // the dotted line
    for (var x2 = 0; x2 < W; x2 += 6) g.fillRect(x2, Math.round(path(s0 + (x2 - bx) / px, H)), 2, 2);
    var target = path(s0, H), hand = now - boo.lastHand < 5000;
    if (!hand) boo.y += (target - boo.y) * 0.12;          // BOO rides by himself
    else { boo.vy += boo.hold ? -0.45 : 0.4; boo.vy = clamp(boo.vy, -5, 5); boo.y = clamp(boo.y + boo.vy, 8, H - 8); }
    if (hand) { boo.n++; if (Math.abs(boo.y - target) < 9) boo.on++; }
    if (hand && score && now - boo.shown > 400) { boo.shown = now; score.textContent = 'ON THE LINE ' + Math.round(100 * boo.on / Math.max(1, boo.n)) + '%'; }
    g.font = '600 7px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'top';
    var rows = [' .--. ', '/ oo \\', '|    |', ' \\/\\/ '];
    for (var i = 0; i < rows.length; i++) g.fillText(rows[i], bx - 12, boo.y - 15 + i * 7);
  }
  if (cv) {
    var try_ = $('.g-try', ride); if (try_) try_.hidden = still;
    cv.tabIndex = 0;
    var down = function () { if (performance.now() - boo.lastHand > 5000) { boo.on = 0; boo.n = 0; } boo.hold = true; boo.lastHand = performance.now(); };
    var up = function () { boo.hold = false; boo.lastHand = performance.now(); };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
    cv.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!boo.hold) down(); } });
    cv.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') up(); });
  }

  // ON THE ONE: the squares count the bar; tap on the 1 and it says how close you were.
  var one = $('#gOne'), sq = one ? one.querySelectorAll('.g-beats i') : [], tap = one && $('.g-tap', one), said1 = one && $('.g-said', one);
  if (tap) {
    tap.hidden = false;
    tap.addEventListener('click', function () {
      var b = beatsNow(), nearest = Math.round(b / 4) * 4, ms = Math.round((b - nearest) * SPB * 1000);
      said1.textContent = Math.abs(ms) <= 70 ? 'ON THE ONE. NICE.' : (ms < 0 ? 'EARLY ' + -ms + ' MS' : 'LATE ' + ms + ' MS');
    });
  }
  var eq = $('#gEq'), drop = $('#gDrop'), go = $('#gGo'), lastB = -1;
  function beatTeasers(b) {
    var beat = Math.floor(b), inBar = beat % 4;
    for (var i = 0; i < sq.length; i++) sq[i].className = i === inBar ? 'on' : '';
    if (eq) {                                             // 8 bars: bass out for the last 2, back on the drop
      var c = beat % 32, low = $('.low', eq), bars = eq.querySelectorAll('.g-eq i');
      low.classList.toggle('killed', c >= 24);
      $('.g-said', eq).textContent = c >= 24 ? 'BASS KILLED' : c < 4 ? 'DROP: BASS BACK IN' : 'BASS IN';
      bars[0].style.height = (inBar % 2 ? 55 : 80) + '%'; bars[1].style.height = (inBar % 2 ? 70 : 60) + '%';
    }
    if (drop) {                                           // 4 3 2 1, dark, DROP
      var bar = Math.floor(beat / 4) % 6, big = $('.g-big', drop), s = $('.g-said', drop);
      big.className = 'g-big' + (bar === 4 ? ' dark' : '');
      big.textContent = bar < 4 ? String(4 - bar) : bar === 4 ? '1' : 'DROP';
      s.textContent = bar < 4 ? 'BARS TO THE DROP' : bar === 4 ? 'TAP ON THE 1' : 'DOUBLE POINTS';
    }
    if (go) {                                             // 3 2 1, dark, GO
      var k = beat % 8, gb = $('.g-big', go);
      gb.className = 'g-big' + (k >= 3 && k < 5 ? ' dark' : k === 5 ? ' go' : '');
      gb.textContent = k < 3 ? String(3 - k) : k < 5 ? '1' : k === 5 ? 'GO' : '';
    }
  }
  var seen = false, running = false;
  function frame(now) {
    if (cv) drawRide(now);
    var b = beatsNow();
    if (Math.floor(b) !== lastB) { lastB = Math.floor(b); beatTeasers(b); }
    running = seen && !document.hidden && !still;
    if (running) requestAnimationFrame(frame);
  }
  if (still) { if (cv) requestAnimationFrame(function (n) { drawRide(n); }); return; }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen && !running) { running = true; requestAnimationFrame(frame); } }).observe(arc);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && seen && !running) { running = true; requestAnimationFrame(frame); } });
  }
})();
