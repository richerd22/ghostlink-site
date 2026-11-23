'use strict';
/*
 * ON STREAM (DECISIONS #120): the overlay's link builder (stream.html). Pick, see it in the preview, COPY LINK; no
 * typing addresses. Also HIDE IDS + the HIDE list, START STREAM CLOCK and the setlist so far. Track text goes in as text
 * nodes only. Changes need the crew code or the owner (unlocked on the dashboard); reads are open on the venue Wi-Fi.
 */
(() => {
  const $ = id => document.getElementById(id);
  const KEEP = 'gl-stream-builder';
  let P = Object.assign(Overlay.parse(''), { scale: 1 });
  try { const s = JSON.parse(localStorage.getItem(KEEP) || 'null'); if (s) P = Object.assign(P, Overlay.parse(Overlay.build(s))); } catch (e) { /* defaults */ }
  P.demo = false;
  let size = '1920', pvMode = 'auto', st = null, np = null;

  const say = (t, warn) => { $('msg').textContent = t || ''; $('msg').classList.toggle('warn', !!warn); };

  /** A row of choice buttons. opts: [[value, LABEL]]; get() the current value, set(v) on a tap. */
  function seg(id, opts, get, set) {
    const el = $(id);
    el.replaceChildren();
    opts.forEach(([v, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => { set(v); draw(); });
      b._v = v;
      el.append(b);
    });
    el._get = get;
  }
  function mark() {
    document.querySelectorAll('.seg').forEach(el => {
      if (!el._get) return;
      const cur = el._get();
      [...el.children].forEach(b => { const on = Array.isArray(cur) ? cur.includes(b._v) : b._v === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    });
  }

  seg('style', [['lower', 'LOWER THIRD'], ['ticker', 'CORNER TICKER'], ['card', 'BIG CARD'], ['none', 'NONE']], () => P.style, v => {
    if ((v === 'ticker') !== (P.style === 'ticker')) P.pos = v === 'ticker' ? 'tr' : 'bl';
    P.style = v;
  });
  seg('pos', [['tl', 'TOP LEFT'], ['tr', 'TOP RIGHT'], ['bl', 'BOTTOM LEFT'], ['br', 'BOTTOM RIGHT']], () => P.pos, v => { P.pos = v; });
  seg('hold', [[0, 'ALWAYS'], [10, '10 S'], [20, '20 S'], [30, '30 S']], () => P.hold, v => { P.hold = v; });
  seg('chip', [['', 'OFF'], ['tl', 'TOP LEFT'], ['tr', 'TOP RIGHT'], ['bl', 'BOTTOM LEFT'], ['br', 'BOTTOM RIGHT']], () => P.chip, v => { P.chip = v; });
  seg('keyAs', [['', 'AS REKORDBOX'], ['musical', 'MUSICAL · Am'], ['camelot', 'CAMELOT · 8A']], () => P.keyAs, v => { P.keyAs = v; }); // #128
  seg('prev', [['', 'OFF'], ['top', 'ALONG THE TOP'], ['bottom', 'ALONG THE BOTTOM']], () => P.prev, v => { P.prev = v; });
  seg('bar', [['', 'OFF'], ['line', 'LINE'], ['wave', 'WAVEFORM']], () => P.bar, v => { P.bar = v; });
  seg('scale', [[0.8, 'SMALL'], [1, 'MEDIUM'], [1.3, 'LARGE']], () => P.scale, v => { P.scale = v; });
  seg('show', [['dj', 'DJ NAME'], ['art', 'COVER']], () => [P.dj && 'dj', P.art && 'art'].filter(Boolean), v => { P[v] = !P[v]; });
  seg('bg', [['none', 'SEE-THROUGH'], ['green', 'GREEN SCREEN'], ['black', 'BLACK']], () => P.bg, v => { P.bg = v; });
  seg('size', [['1920', '1920 x 1080'], ['1280', '1280 x 720']], () => size, v => { size = v; });
  seg('pvMode', [['auto', 'PREVIEW: LIVE WHEN ON AIR'], ['sample', 'PREVIEW: SAMPLE TRACKS']], () => pvMode, v => { pvMode = v; });

  // the chip's "corner" can't be the main piece's: overlay.js moves it; show the builder the same
  function draw() {
    const fixed = Overlay.parse(Overlay.build(P));
    P.chip = fixed.chip;
    try { localStorage.setItem(KEEP, JSON.stringify(P)); } catch (e) { /* private window */ }
    $('posRow').hidden = P.style === 'card' || P.style === 'none';
    $('holdRow').hidden = P.style === 'none';
    $('barRow').hidden = P.style === 'none' || P.style === 'ticker';
    mark();
    const q = Overlay.build(P);
    $('link').value = location.href.replace(/[^/]*$/, '') + 'overlay.html' + q;
    const w = size === '1280' ? 1280 : 1920, h = size === '1280' ? 720 : 1080;
    $('howW').textContent = w; $('howH').textContent = h;
    const live = pvMode === 'auto' && np && np.on;
    const src = 'overlay.html' + Overlay.build(Object.assign({}, P, { demo: !live }));
    const f = $('pvFrame');
    if (f.getAttribute('src') !== src) f.setAttribute('src', src);
    if (+f.width !== w) { f.width = w; f.height = h; }
    fitPreview();
  }
  function fitPreview() {
    const f = $('pvFrame');
    f.style.transform = 'scale(' + ($('pv').clientWidth / f.width) + ')';
  }
  addEventListener('resize', fitPreview);

  $('copy').addEventListener('click', async () => {
    const t = $('link').value;
    try { await navigator.clipboard.writeText(t); }
    catch (e) { $('link').select(); document.execCommand('copy'); }
    $('copy').textContent = 'COPIED';
    setTimeout(() => { $('copy').textContent = 'COPY LINK'; }, 1500);
  });
  $('copySet').addEventListener('click', async () => {
    const t = $('setlist').textContent;
    try { await navigator.clipboard.writeText(t); } catch (e) { /* select it by hand */ }
    $('copySet').textContent = 'COPIED';
    setTimeout(() => { $('copySet').textContent = 'COPY SETLIST'; }, 1500);
  });

  async function post(path, body) {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 401 || r.status === 403) {
        const j = await r.json().catch(() => ({}));
        say(r.status === 401 ? 'Unlock first: on the dashboard, STATUS, the lock (crew code or password). Then try again.' : (j.error || 'Not from here.'), true);
        return null;
      }
      if (!r.ok) { say("Didn't save (" + r.status + '). Try again.', true); return null; }
      say('');
      return await r.json();
    } catch (e) { say("Can't reach the box. Same Wi-Fi?", true); return null; }
  }

  const clock = ms => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const FROM = { clock: 'the stream clock', recording: 'the recording', night: 'the first track tonight' };

  function renderState() {
    if (!st) return;
    $('titles').textContent = st.titles
      ? 'Titles go out: SONG ID is on.'
      : "Titles are off: the overlay shows the DJ's name and the BPM only. SONG ID turns titles on (it's also the crowd's song page). Only if the DJ is OK with IDs going out.";
    $('titles').classList.toggle('warn', !st.titles);
    $('songId').textContent = st.titles ? 'TURN OFF SONG ID' : 'TURN ON SONG ID';
    const hb = $('hideIds');
    hb.textContent = st.hideIds ? 'HIDE IDS: ON' : 'HIDE IDS: OFF';
    hb.classList.toggle('on', st.hideIds);
    $('hideNote').textContent = st.hideIds
      ? 'Tracks marked HIDE, or that say unreleased (title, artist or comment), go out as ID - ID. HIDE is remembered for every night.'
      : 'Off: every track shows as it is. Turn it on to show unreleased tracks as ID - ID.';
    const ul = $('tracks');
    ul.hidden = !st.hideIds;
    const sig = JSON.stringify([st.decks, st.played]);
    if (ul._sig !== sig) { ul._sig = sig; tracks(ul); } // rebuilt only when something changed (keeps the scroll)
    renderClock();
  }
  function tracks(ul) {
    ul.replaceChildren();
    const row = (t, label) => {
      const li = document.createElement('li');
      const w = document.createElement('span'); w.className = 'w'; w.textContent = t.title;
      if (t.artist) { const a = document.createElement('small'); a.textContent = t.artist; w.append(a); }
      const lab = document.createElement('small'); lab.textContent = label; lab.style.color = 'var(--grey)'; lab.style.flex = 'none';
      li.append(lab, w);
      if (t.says && !t.listed) { const g = document.createElement('span'); g.className = 'tag'; g.textContent = 'SAYS UNRELEASED'; li.append(g); }
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t.listed || t.says ? 'HIDDEN' : 'HIDE';
      b.classList.toggle('on', !!(t.listed || t.says));
      b.disabled = t.says && !t.listed;
      b.addEventListener('click', async () => {
        const r = await post('/api/onstream/hide', { title: t.title, artist: t.artist, hide: !t.listed });
        if (r) { st = r; renderState(); }
      });
      li.append(b);
      ul.append(li);
    };
    const sep = text => { const li = document.createElement('li'); li.className = 'sep'; li.textContent = text; ul.append(li); };
    if (st.decks.length) { sep('ON THE DECKS NOW'); st.decks.forEach(t => row(t, 'DECK ' + t.deck)); }
    if (st.played.length) { sep('PLAYED TONIGHT'); st.played.slice().reverse().slice(0, 40).forEach(t => row(t, clock(t.at))); }
    if (!st.decks.length && !st.played.length) sep('Nothing loaded or played yet.');
  }
  function renderClock() {
    $('clockNote').textContent = st.start
      ? 'The setlist counts from ' + clock(st.start.at) + ' (' + FROM[st.start.from] + '). Tap START STREAM CLOCK when the stream goes live, so the times line up with the video.'
      : 'Nothing to count from yet. Tap START STREAM CLOCK when the stream goes live; without it the setlist counts from the recording, or the first track.';
    $('clockClear').hidden = !st.clockSet;
    // #128 NUDGE: for a delayed stream (OBS delay, the platform's lag); + = every chapter later
    const n = st.nudged || 0;
    $('nudgeNote').textContent = !st.start ? '' : n ? 'Nudged ' + (n > 0 ? '+' : '') + n + ' s: chapters ' + (n > 0 ? 'later' : 'earlier') + '.' : 'Stream delayed? +5 S moves every chapter 5 s later.';
    $('nudgeLess').disabled = $('nudgeMore').disabled = !st.start;
  }
  async function nudge(by) {
    const r = await post('/api/onstream/clock', { nudge: by });
    if (r) { st = r; renderState(); loadSet(); }
  }
  $('nudgeLess').addEventListener('click', () => nudge(-5));
  $('nudgeMore').addEventListener('click', () => nudge(5));

  $('songId').addEventListener('click', async () => {
    const r = await post('/api/songid', { on: !(st && st.titles) });
    if (r) load();
  });
  $('hideIds').addEventListener('click', async () => {
    const r = await post('/api/onstream/hideids', { on: !(st && st.hideIds) });
    if (r) { st = r; renderState(); }
  });
  $('clockStart').addEventListener('click', async () => {
    if (st && st.clockSet && !confirm('Start the stream clock again from now?')) return;
    const r = await post('/api/onstream/clock', { start: true });
    if (r) { st = r; renderState(); loadSet(); }
  });
  $('clockClear').addEventListener('click', async () => {
    const r = await post('/api/onstream/clock', { start: false });
    if (r) { st = r; renderState(); loadSet(); }
  });

  async function loadSet() {
    try {
      const r = await fetch('/api/setlist.txt', { cache: 'no-store' });
      $('setlist').textContent = r.ok ? (await r.text()) || 'Nothing played yet.' : "The DJ hasn't shared tonight's tracklist.";
    } catch (e) { /* next time */ }
  }
  async function load() {
    try {
      const [a, b] = await Promise.all([fetch('/api/onstream', { cache: 'no-store' }), fetch('/api/nowplaying.json', { cache: 'no-store' })]);
      if (a.ok) st = await a.json();
      if (b.ok) np = await b.json();
      renderState();
      draw();
    } catch (e) { /* the box is restarting: next time */ }
  }
  draw();
  load();
  loadSet();
  setInterval(load, 5000);
  setInterval(loadSet, 20000);
})();
