// GHOST LINK site: a simulated ALL DECKS panel (no real data) and the waitlist form.
(function () {
  'use strict';

  // ---------- simulated decks ----------
  var BPM = 124;
  var BAR = 4 * 60 / BPM;          // seconds per bar
  var COLS = 60;                   // waveform columns per second
  var WINDOW = 8;                  // seconds across the scrolling waveform (same as the product)
  var SHADE = { INTRO: '#555', UP: '#9a9a9a', CHORUS: '#fff', DOWN: '#333', OUTRO: '#555' };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DECKS = [
    { n: 1, title: 'Night Bus', artist: 'Halden Rowe', key: 'C', genre: 'House', base: 122.0, seed: 3,
      air: true, master: true, playing: true, startBar: 65.5,
      sections: [['INTRO', 16], ['UP', 16], ['CHORUS', 16], ['DOWN', 16], ['UP', 8], ['CHORUS', 32], ['DOWN', 16], ['OUTRO', 16]] },
    { n: 2, title: 'Low Ceiling', artist: 'Mirelle', key: 'F#m', genre: 'House', base: 125.0, seed: 11,
      sync: true, playing: true, startBar: 4.5,
      sections: [['INTRO', 16], ['UP', 16], ['CHORUS', 32], ['DOWN', 16], ['UP', 16], ['CHORUS', 32], ['OUTRO', 16]] },
    { n: 3, title: 'Pressure Glass', artist: 'Okto Vale', key: 'Dm', genre: 'Tech House', base: 126.0, seed: 23,
      playing: false, startBar: 0,
      sections: [['INTRO', 32], ['UP', 16], ['CHORUS', 32], ['DOWN', 16], ['CHORUS', 32], ['OUTRO', 16]] }
  ];

  function rng(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  function build(d) {
    var t = 0;
    d.secs = d.sections.map(function (s) { var o = { name: s[0], bars: s[1], start: t }; t += s[1] * BAR; o.end = t; return o; });
    d.len = t;
    d.pos = d.startBar * BAR;
    d.pitch = d.playing ? (BPM / d.base - 1) * 100 : 0;
    // Waveform: per column height + colour (lows red, mids green, highs blue), shaped by section.
    var r = rng(d.seed), n = Math.ceil(d.len * COLS);
    d.h = new Float32Array(n); d.c = new Array(n);
    for (var i = 0; i < n; i++) {
      var ts = i / COLS, sec = secAt(d, ts).name;
      var beatPhase = (ts * BPM / 60) % 1;
      var kick = sec === 'DOWN' ? 0 : Math.max(0, 1 - beatPhase * 4.5);
      var hat = sec === 'INTRO' && ts < 8 * BAR ? 0 : Math.max(0, 1 - Math.abs(beatPhase - .5) * 9);
      var lvl = { INTRO: .55, UP: .72, CHORUS: .95, DOWN: .42, OUTRO: .5 }[sec];
      var lo = kick * .9 + r() * .15, mid = .35 + r() * .45 * lvl, hi = hat * .7 + r() * .35;
      d.h[i] = Math.min(1, lvl * (.35 + kick * .55 + r() * .3));
      var R = Math.round(60 + lo * 195), G = Math.round(70 + mid * 170), B = Math.round(90 + hi * 165);
      if (sec === 'DOWN') { R = Math.round(R * .6); B = Math.min(255, B + 30); }
      d.c[i] = 'rgb(' + R + ',' + G + ',' + B + ')';
    }
  }
  function secAt(d, t) {
    for (var i = 0; i < d.secs.length; i++) if (t < d.secs[i].end) return d.secs[i];
    return d.secs[d.secs.length - 1];
  }
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  function art(canvas, seed) {
    var g = canvas.getContext('2d'), r = rng(seed + 5), w = canvas.width;
    g.fillStyle = '#111'; g.fillRect(0, 0, w, w);
    for (var i = 0; i < 4; i++) {
      var v = Math.round(90 + r() * 160);
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      g.beginPath(); g.arc(r() * w, r() * w, w * (.12 + r() * .3), 0, 7); g.fill();
    }
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function mount(d, root) {
    var card = el('article', 'deck d' + d.n + (d.air ? ' air' : '') + (d.playing ? '' : ' paused'));
    card.setAttribute('aria-label', 'Deck ' + d.n + ': ' + d.title + ' by ' + d.artist);
    var top = el('div', 'dtop');
    top.appendChild(el('span', 'num', d.n));
    top.appendChild(el('span', 'model', 'CDJ-3000'));
    if (d.air) top.appendChild(el('span', 'tag air', 'ON AIR'));
    if (d.master) top.appendChild(el('span', 'tag master', 'MASTER'));
    if (d.sync) top.appendChild(el('span', 'tag plain', 'SYNC'));
    if (!d.playing) top.appendChild(el('span', 'tag plain', 'CUED'));
    card.appendChild(top);

    var tr = el('div', 'track'), a = el('canvas', 'art'); a.width = a.height = 128; art(a, d.seed);
    var names = el('div', 'names');
    names.appendChild(el('div', 'title', d.title)); names.appendChild(el('div', 'artist', d.artist));
    tr.appendChild(a); tr.appendChild(names); card.appendChild(tr);

    var meta = el('div', 'meta'); meta.appendChild(el('span', '', 'KEY ' + d.key)); meta.appendChild(el('span', '', d.genre));
    card.appendChild(meta);

    var nums = el('div', 'nums');
    function num(label, cls) { var b = el('div', cls); b.appendChild(el('small', '', label)); var s = el('span'); b.appendChild(s); nums.appendChild(b); return s; }
    d.$bpm = num('BPM'); d.$pitch = num('PITCH'); d.$rem = num('REMAIN', 'r');
    card.appendChild(nums);

    d.$detail = el('canvas', 'detail'); d.$over = el('canvas', 'overview');
    card.appendChild(d.$detail); card.appendChild(d.$over);

    var ph = el('div', 'phrase');
    d.$sec = el('span'); d.$beats = el('span', 'beats'); d.$next = el('span', 'next');
    for (var i = 0; i < 4; i++) d.$beats.appendChild(el('i', i === 0 ? 'one' : ''));
    ph.appendChild(d.$sec); ph.appendChild(d.$beats); ph.appendChild(d.$next);
    card.appendChild(ph);
    root.appendChild(card);
  }

  function size(c) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; c._ov = null; }
    return dpr;
  }

  function drawDetail(d) {
    var c = d.$detail, dpr = size(c), g = c.getContext('2d'), W = c.width, H = c.height, mid = H / 2;
    g.fillStyle = '#050505'; g.fillRect(0, 0, W, H);
    var step = Math.max(1, Math.round(dpr)), perPx = WINDOW / W;
    for (var x = 0; x < W; x += step) {
      var t = d.pos + (x - W / 2) * perPx, i = Math.floor(t * COLS);
      if (i < 0 || i >= d.h.length) continue;
      var h = d.h[i] * (mid - 4);
      g.fillStyle = d.c[i]; g.fillRect(x, mid - h, step, h * 2);
    }
    // bar lines along the top
    g.fillStyle = 'rgba(255,255,255,.55)';
    var first = Math.ceil((d.pos - WINDOW / 2) / BAR);
    for (var b = first; b * BAR < d.pos + WINDOW / 2; b++) {
      var bx = W / 2 + (b * BAR - d.pos) / perPx;
      g.fillRect(Math.round(bx), 0, step, 6 * dpr);
    }
    g.fillStyle = '#fff'; g.fillRect(Math.round(W / 2) - dpr, 0, 2 * dpr, H);
  }

  function drawOverview(d) {
    var c = d.$over, dpr = size(c), g = c.getContext('2d'), W = c.width, H = c.height;
    var strip = Math.round(8 * dpr), gap = Math.round(2 * dpr);
    if (!c._ov) { // the static part, drawn once per size
      var o = document.createElement('canvas'); o.width = W; o.height = H; var og = o.getContext('2d');
      og.fillStyle = '#050505'; og.fillRect(0, 0, W, H);
      d.secs.forEach(function (s) {
        var x0 = Math.round(s.start / d.len * W), x1 = Math.round(s.end / d.len * W);
        og.fillStyle = SHADE[s.name]; og.fillRect(x0, 0, Math.max(1, x1 - x0 - gap), strip);
      });
      var per = d.h.length / W, base = H;
      for (var x = 0; x < W; x++) {
        var i = Math.floor(x * per), m = 0;
        for (var k = i; k < Math.min(d.h.length, i + per); k++) m = Math.max(m, d.h[k]);
        var h = m * (H - strip - gap * 2) * .9;
        og.fillStyle = d.c[i] || '#333'; og.fillRect(x, base - h, 1, h);
      }
      c._ov = o;
    }
    g.drawImage(c._ov, 0, 0);
    var px = d.pos / d.len * W;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, strip + gap, px, H - strip - gap);
    g.fillStyle = '#fff'; g.fillRect(Math.round(px) - dpr, 0, 2 * dpr, H);
  }

  var lastText = {};
  function text(d, key, node, v) { var k = d.n + key; if (lastText[k] !== v) { node.textContent = v; lastText[k] = v; } }

  function update(d) {
    var bpm = d.base * (1 + d.pitch / 100);
    text(d, 'b', d.$bpm, bpm.toFixed(1));
    text(d, 'p', d.$pitch, (d.pitch >= 0 ? '+' : '') + d.pitch.toFixed(2) + '%');
    text(d, 'r', d.$rem, '-' + fmt(d.len - d.pos));
    var s = d.secs.indexOf(secAt(d, d.pos)), sec = d.secs[s];
    var bar = Math.min(sec.bars, Math.floor((d.pos - sec.start) / BAR) + 1);
    var secHtml = '<b>' + sec.name + '</b> ' + bar + '/' + sec.bars;
    if (lastText[d.n + 's'] !== secHtml) { d.$sec.innerHTML = secHtml; lastText[d.n + 's'] = secHtml; }
    var nx = d.secs[s + 1];
    var left = sec.end - d.pos;
    text(d, 'n', d.$next, nx ? nx.name + ' in ' + fmt(left) : 'END in ' + fmt(left));
    d.$next.classList.toggle('soon', d.playing && left <= 8.5);
    var beat = d.playing ? Math.floor(d.pos * BPM / 60) % 4 : -1;
    if (d._beat !== beat) {
      for (var i = 0; i < 4; i++) d.$beats.children[i].classList.toggle('on', i === beat);
      d._beat = beat;
    }
  }

  var root = document.getElementById('decks');
  if (root) {
    DECKS.forEach(function (d) { build(d); mount(d, root); });
    var visible = true, last = 0;
    function frame(now) {
      var dt = last ? Math.min(.25, (now - last) / 1000) : 0; last = now;
      DECKS.forEach(function (d) {
        if (d.playing) { d.pos += dt; if (d.pos >= d.len) d.pos = 16 * BAR; }
        if (d.$detail.offsetParent === null) return; // hidden at this width
        update(d); drawDetail(d); drawOverview(d);
      });
      if (!reduce && visible) requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        var was = visible; visible = es[0].isIntersecting;
        if (visible && !was && !reduce) { last = 0; requestAnimationFrame(frame); }
      }).observe(root);
    }
    requestAnimationFrame(frame);
    // Reduced motion: no scrolling, just the numbers once a second.
    if (reduce) setInterval(function () { if (visible) { var t = performance.now(); last = t - 1000; frame(t); } }, 1000);
    window.addEventListener('resize', function () { if (reduce) frame(performance.now()); });
  }

  // ---------- waitlist ----------
  var form = document.getElementById('wl-form');
  if (form) {
    var msg = document.getElementById('wl-msg'), note = form.elements.note, count = document.getElementById('wl-count');
    note.addEventListener('input', function () { count.textContent = note.value.length + ' / 500'; });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var f = form.elements;
      if (f._honey.value) return; // a bot filled the hidden field
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'SENDING...';
      msg.className = 'form-msg'; msg.textContent = '';
      var body = {
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        role: f.role.value,
        city: f.city.value.trim(),
        shows_per_month: f.shows.value,
        message: f.note.value.trim(),
        news: f.news.checked ? 'yes' : 'no',
        _subject: 'GHOST LINK waitlist',
        _template: 'table',
        _honey: ''
      };
      fetch('https://formsubmit.co/ajax/hello@thirdpolararch.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || j.success === false || j.success === 'false') throw new Error('not ok');
        });
      }).then(function () {
        var done = el('div', 'done');
        done.setAttribute('tabindex', '-1');
        done.appendChild(el('h3', '', "YOU'RE ON THE LIST."));
        done.appendChild(el('p', '', "We'll be in touch. - Third Polar Arch"));
        form.replaceWith(done); done.focus();
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'JOIN THE WAITLIST';
        msg.className = 'form-msg warn';
        msg.innerHTML = 'That didn\'t go through. Try again in a minute, or email us at ' +
          '<a href="mailto:hello@thirdpolararch.com?subject=GHOST%20LINK%20waitlist">hello@thirdpolararch.com</a>.';
      });
    });
  }
})();
