'use strict';
// GHOST MOODS: a little life in the header ghost. All of it lives in this file and only touches the ghost.
// - Nods on the master deck's downbeat while music plays (instead of the slow float).
// - Eyes go ^ ^ for a few seconds when a new track goes on air; longer on round-number tracks (25, 50, 100...).
// - Tap the ghost: a happy face. He never talks (Richard, Nov 6): expressions only, words stay for the data.
// - Reacts (see face()): eyes follow the master deck, headphones while cueing, @@ on a loop, coffee after 3 a.m.,
//   shades on the drop, an eyebrow for a repeat, a wince on a tempo drift, sparkles on a long blend (readRoom).
// - Easter eggs (DECISIONS #63 lists them all; never on the public site): see eggs() below. Faces only, inside the
//   ghost, rare, never on top of the data, and off with GHOST MOODS like everything here.
// Off: STATUS -> TOOLS -> GHOST MOODS. Remembered per phone. Reduced-motion phones get no nod.
const Fun = (() => {
  let on = true;
  try { on = localStorage.getItem('fun') !== '0'; } catch (e) {}
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const g = $('ghost');
  let happyUntil = 0, lastBeat = 0, seen = null;
  let pose = null, backT = 0; // GHOST DANCES (#92): the pose he's in (see onBeat below)
  const dancing = () => !!pose && performance.now() - lastBeat < 3000;

  // Small reactions, all inside the same 5-line ghost (one spare column on the right):
  //   eyes follow the MASTER deck (1/3 look left, 2/4 right) · ^^ new track · @@ master looping
  //   headphones while someone cues a deck that isn't on air · a sweat drop past 6% pitch · a coffee after 3 a.m.
  let shownFace = '', heldP = 0, heldAt = 0, candP = 0, candAt = 0;
  function face() {
    if (!on || !S.status || S.status.ghost !== 'linked') { shownFace = ''; roam(null); return; }
    const decks = Object.values(S.decks);
    // The XZ flips MASTER between its two decks every second or so while both play (Nov 7 box log), so hold on to
    // the last master for 4 s, and only move to a new one after it has been master for 2 s.
    const now0 = performance.now();
    const raw = decks.find(d => d.master && d.playing && d.load === 'LOADED');
    if (raw && raw.player !== heldP) { if (candP !== raw.player) { candP = raw.player; candAt = now0; } }
    else candP = 0;
    if (raw && (heldP === 0 || raw.player === heldP || now0 - candAt > 2000)) { heldP = raw.player; heldAt = now0; }
    const held = S.decks[heldP];
    if (!raw && (!held || !held.playing || held.load !== 'LOADED' || now0 - heldAt > 4000)) heldP = 0;
    const m = heldP && held && held.playing && held.load === 'LOADED' ? held : raw;
    const cueing = decks.some(d => d.onAir) && decks.some(d => d.load === 'LOADED' && d.playing && !d.onAir);
    const hour = new Date(Date.now() - S.skew).getHours();
    const L = ['  .--.   ', ' / oo \\  ', '|      | ', '|      | ', ' \\/\\/\\/  '];
    let eyes = 'oo', pad = [' / ', ' \\ '];
    const smelly = m && sniff(m);
    const vibe = readRoom(decks, m);
    const egg = eggs(m, new Date(Date.now() - (S.skew || 0)));
    if (drag && drag.moved) eyes = 'Oo';
    else if (now0 < dizzyUntil) eyes = '@@';
    else if (egg.eyes && egg.first) eyes = egg.eyes;  // a timed egg beats the happy face it came with
    else if (now0 < happyUntil) eyes = '^^';
    else if (egg.eyes) eyes = egg.eyes;
    else if (smelly) { eyes = '--'; L[0] = '  .--.  ~'; } // unimpressed, with a little stink line
    else if (vibe === 'wreck') eyes = '><';            // two tracks on air, drifting apart in tempo
    else if (vibe === 'chorus') eyes = '▀▀';           // shades on for the drop
    else if (vibe === 'repeat') { eyes = 'oO'; L[0] = "  .--. '"; } // one eyebrow up: played already tonight
    else if (vibe === 'blend') eyes = '**';            // a long, clean blend
    else if (m && m.info && m.info.looping) eyes = '@@';
    else if (m) pad = m.player % 2 ? [' /', '  \\ '] : [' /  ', '\\ '];
    L[1] = (pad[0] + eyes + pad[1]).padEnd(9);
    if (egg.hat) L[0] = HAT;
    if (egg.side) L[0] = L[0].slice(0, 8) + egg.side;
    if (egg.mid) L[2] = egg.mid;
    if (cueing) { L[0] = ' _.--._  '; L[1] = '[' + L[1].slice(1, 7) + '] '; }
    if (m && Math.abs(m.pitch) > 6) L[1] = L[1].slice(0, 8) + "'";
    if (hour >= 3 && hour < 7) L[3] = '|      |c';
    if (dancing()) Dance.dress(L, pose); // GHOST DANCES (#92): body and hem, where the moods left them plain
    const t = L.join('\n');
    if (t !== g.textContent) g.textContent = t;
    shownFace = t;
    roam(m);
  }

  // READING THE ROOM (Nov 6): more reactions from the live data, faces only, about the music and never the DJ.
  //   chorus  shades for the first 8 s of a CHORUS / UP on the MASTER deck (needs rekordbox phrase analysis)
  //   repeat  one eyebrow up, 6 s in every 30, while the MASTER track was already played earlier tonight
  //   wreck   a wince while two playing decks are both ON AIR (needs a mixer) more than 1% apart in tempo, unsynced
  //   blend   sparkle eyes for 4 s once two decks have been on air together, in tempo, for 30 s
  let blendSince = 0, blendShown = '', phraseKey = '', phraseAt = 0;
  function readRoom(decks, m) {
    if (!m) return null;
    const now = performance.now();
    const air = decks.filter(d => d.onAir && d.playing && d.load === 'LOADED');
    if (air.length === 2) {
      const [a, b] = air, off = Math.abs(a.effectiveBpm - b.effectiveBpm) / Math.max(1, b.effectiveBpm);
      const synced = (a.info && a.info.synced) || (b.info && b.info.synced);
      if (off > 0.01 && !synced) return 'wreck';
      if (off < 0.003) {
        blendSince = blendSince || now;
        const k = a.trackKey + '|' + b.trackKey;
        if (now - blendSince > 30000 && blendShown !== k) { blendShown = k; blendUntil = now + 4000; }
      } else blendSince = 0;
    } else blendSince = 0;
    if (now < blendUntil) return 'blend';
    try {
      const ph = typeof phraseNow === 'function' ? phraseNow(m, position(m)) : null;
      if (ph && ph.cur && /CHORUS|UP/.test(ph.cur.kind)) {
        const k = m.trackKey + '|' + ph.cur.startMs;
        if (k !== phraseKey) { phraseKey = k; phraseAt = now; }
        if (now - phraseAt < 8000) return 'chorus';
      }
    } catch (e) { /* no phrases: no shades */ }
    // Played earlier tonight = logged more than 15 minutes ago (this play itself gets logged within a minute).
    const boxNow = Date.now() - (S.skew || 0);
    const again = !!m.title && S.played.some(t => t.title === m.title && (t.artist || '') === (m.artist || '') && boxNow - t.at > 15 * 60000);
    if (again && (now / 1000) % 30 < 6) return 'repeat';
    return null;
  }
  let blendUntil = 0;

  // EASTER EGGS (#63). All quiet, all inside the same 5 lines. Timed ones show once per trigger:
  //   Konami code (keyboard)  party hat + ** for 8 s        10 taps on him in 5 s   dizzy @@ for 3 s
  //   1:11 / 11:11            ** (make a wish), 15 s        3:33 a.m.               OO wide awake (the ghost hour), 15 s
  //   4:20                    == with a little ~, 15 s      master at exactly 128.00 BPM   ++ dead on, 5 s (once a track)
  //   a title with ghost / boo / spooky / haunted / phantom on the master: OO and a ! for 6 s (once a track)
  //   the 100th (200th...) track tonight: party hat for 30 s
  // And all day: Oct 31 (Halloween, and GHOST LINK's birthday: day one of the project) = party hat + a grin; Friday the
  // 13th = a hockey mask; New Year's Eve: OO for the last 10 s of the year, then party hat + ** (hat until 00:15).
  const HAT = '  _/\\_   ';
  let eggT = { until: 0, eyes: '', hat: false, side: '', at: 0 }, dizzyUntil = 0, taps = [];
  const eggDone = new Set();
  function eggOnce(key, ms, eyes, o) {
    if (eggDone.has(key)) return;
    eggDone.add(key);
    if (eggDone.size > 200) eggDone.clear();
    const now = performance.now();
    eggT = { until: now + ms, eyes: eyes || '', hat: !!(o && o.hat), side: (o && o.side) || '', at: now };
  }
  const SPOOKY = /\b(ghosts?|ghostly|boo|spooky|haunt(ed|ing|s)?|phantoms?|poltergeist)\b/i;
  function eggs(m, d) {
    const now = performance.now(), h = d.getHours(), mi = d.getMinutes(), s = d.getSeconds(), h12 = h % 12 || 12;
    const mo = d.getMonth() + 1, day = d.getDate(), stamp = d.toDateString() + ' ' + h + ':' + mi;
    if (s < 15) {
      if (mi === 11 && (h12 === 1 || h12 === 11)) eggOnce('wish ' + stamp, 15000, '**');
      else if (h === 3 && mi === 33) eggOnce('ghost hour ' + stamp, 15000, 'OO');
      else if (h12 === 4 && mi === 20) eggOnce('420 ' + stamp, 15000, '==', { side: '~' });
    }
    if (m && m.playing && Math.abs((m.effectiveBpm || 0) - 128) < 0.005) eggOnce('128 ' + m.trackKey + ' ' + m.pitch, 5000, '++');
    if (m && m.title && SPOOKY.test(m.title)) eggOnce('spooky ' + m.trackKey, 6000, 'OO', { side: '!' });
    const e = { eyes: '', hat: false, side: '', mid: '', first: false };
    if (now < eggT.until) { e.eyes = eggT.eyes; e.hat = eggT.hat; e.side = eggT.side; e.first = true; }
    // the calendar
    if (mo === 10 && day === 31) { e.hat = true; e.mid = '|  ww  | '; }
    else if (d.getDay() === 5 && day === 13) e.mid = '| .  . | ';
    if (mo === 12 && day === 31 && h === 23 && mi === 59 && s >= 50) e.eyes = e.eyes || 'OO';
    if (mo === 1 && day === 1 && h === 0 && mi < 15) { e.hat = true; if (mi === 0) e.eyes = e.eyes || '**'; }
    return e;
  }
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konami = 0;
  document.addEventListener('keydown', e => {
    if (!on || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konami = k === KONAMI[konami] ? konami + 1 : k === KONAMI[0] ? 1 : 0;
    if (konami === KONAMI.length) { konami = 0; eggDone.delete('konami'); eggOnce('konami', 8000, '**', { hat: true }); face(); }
  });

  // TWO GHOSTS (Richard, Nov 8: "love how he floats down but hate the open space ... have him multiply"). The one up
  // top never leaves now. While music plays, a little copy splits off and floats down to the MASTER deck: on top of
  // its tile (tiles / waves) or in the top-right corner of its row in STACKED (the far future of the waveform), so it
  // never covers the playhead or the numbers. On rare occasions the two say hi, and now and then the little one pops
  // up to visit. Drag the little one anywhere (it parks there for a while, out of the way, then floats back); tap it
  // for a boop; drop it on the big one and they both light up. GHOST: STAYS UP TOP turns the little one off;
  // GHOST SIZE sets both. Remembered per phone.
  let mode = 'roam';
  try { mode = localStorage.getItem('ghostMode') === 'corner' ? 'corner' : 'roam'; } catch (e) {}
  const SIZES = { S: 0.8, M: 1, L: 1.4, XL: 1.9 };
  let size = 'M';
  try { const s0 = localStorage.getItem('ghostSize'); if (SIZES[s0]) size = s0; } catch (e) {}
  function applySize() {
    const k = SIZES[size];
    g.style.fontSize = 10 * k + 'px'; g.style.lineHeight = 10 * k + 'px';
    if (rover) { const f = 8 * k * roverFit; rover.style.fontSize = f + 'px'; rover.style.lineHeight = f + 'px'; }
  }
  let lastSpot = null, lastSpotAt = 0, roverFit = 1;
  // Where someone parked the little one (fractions of the window), kept across reloads: on a small desktop window
  // beside Resolume you park it once where it covers nothing. Drop it on the big one to send it back to the decks.
  const loadPark = () => { try { const p = JSON.parse(localStorage.getItem('ghostPark') || 'null'); return p && p.fx >= 0 && p.fy >= 0 ? p : null; } catch (e) { return null; } };
  const savePark = p => { try { p ? localStorage.setItem('ghostPark', JSON.stringify(p)) : localStorage.removeItem('ghostPark'); } catch (e) {} };
  let rover = null, parked = loadPark(), parkedUntil = Infinity, rdrag = null, roverFace = null, roverFaceUntil = 0;
  let visitUntil = 0, nextChat = performance.now() + 90000 + Math.random() * 120000;
  const faceWith = (t, eyes) => { const L = t.split('\n'); if (L[1]) L[1] = L[1].replace(/^(\s*[/\\]?\s*)(..)/, (m0, a) => a + eyes); return L.join('\n'); };
  function setRoverFace(eyes, ms) { roverFace = eyes; roverFaceUntil = performance.now() + ms; }

  function perch(m) {
    const onDecks = !location.hash || location.hash.startsWith('#decks');
    if (!(on && mode === 'roam' && m && onDecks)) return null;
    const w = rover ? rover.offsetWidth : 40, h = rover ? rover.offsetHeight : 35;
    const row = DV.mode === 'stack' && document.querySelector(`#stack [data-player="${m.player}"]`);
    // EVERY DECK FITS (app.js FIT): the line under each waveform is the deck's facts (he'd cover the time left), so
    // until Nov 21 he stayed home there: that's why GOES TO THE DECKS never showed in a small STACKED window (a club
    // Nov 20, switched on all night). #90: he sits in the top-left corner of the master deck's waveform, the part
    // already played (the playhead is in the middle), sized to about half its height. Under 16 px: he stays home.
    if (row && FIT.on) {
      const cv = row.querySelector('canvas');
      if (row.hidden || !row.offsetParent || !cv) return null;
      const c = cv.getBoundingClientRect();
      if (c.height < 16) return null;
      const fit = Math.max(0.3, Math.min(1, c.height * .55 / (40 * SIZES[size])));
      if (Math.abs(fit - roverFit) > 0.02) { roverFit = fit; applySize(); }
      return { left: c.left + scrollX + 1, top: c.top + scrollY };
    }
    if (row && !row.hidden && row.offsetParent) { // STACKED with its waveform row showing
      // Bottom right of its row, sitting on the status line under the waveform. a club Nov 8 (small desktop window):
      // at the top right it covered the waveform. In a short row it shrinks so it overlaps the waveform by <= 8 px.
      const r = row.getBoundingClientRect(), cv = row.querySelector('canvas');
      const free = cv ? Math.max(0, r.bottom - cv.getBoundingClientRect().bottom) : h;
      const full = 40 * SIZES[size]; // its height at this size, unshrunk
      // Home test Nov 10: it still hung over the second waveform. Now it never overlaps: it fits in the space under
      // the waveform, and when that's too small to see (under 14 px) it stays up with the big one instead.
      if (free < 14) return null;
      const fit = Math.max(0.3, Math.min(1, free / full));
      if (Math.abs(fit - roverFit) > 0.02) { roverFit = fit; applySize(); }
      return { left: r.right + scrollX - (rover ? rover.offsetWidth : w) - 4, top: r.bottom + scrollY - (rover ? rover.offsetHeight : h) - 1 };
    }
    if (roverFit !== 1) { roverFit = 1; applySize(); }
    const t = tiles[m.player];
    if (!t || t.root.hidden || !t.root.offsetParent) return null;
    const r = t.root.getBoundingClientRect();
    return { left: r.left + scrollX + r.width / 2 - w / 2, top: r.top + scrollY + 4 };
  }
  function home() { const r = g.getBoundingClientRect(); return { left: r.left + scrollX + 4, top: r.top + scrollY + 4 }; }

  function roam(m) {
    const now = performance.now();
    let spot = perch(m);
    if (spot) { lastSpot = spot; lastSpotAt = now; }
    else if (rover && now - lastSpotAt < 4000) spot = lastSpot; // a blip (master flip, a re-render): stay put
    if (!spot && !parked) {
      if (rover) {
        // float back up into the big one, then go
        const h0 = home(); rover.style.left = h0.left + 'px'; rover.style.top = h0.top + 'px'; rover.style.opacity = '0';
        const r0 = rover; rover = null; setTimeout(() => r0.remove(), 1400);
      }
      return;
    }
    if (!rover) {
      rover = el('pre', 'ghost rover'); rover.setAttribute('aria-hidden', 'true');
      const h0 = home(); rover.style.left = h0.left + 'px'; rover.style.top = h0.top + 'px'; rover.style.opacity = '0';
      document.body.appendChild(rover); applySize(); hookRover(rover);
      rover.getBoundingClientRect(); rover.style.opacity = '1';
      spot = perch(m) || spot;
    }
    // Rare moments between the two.
    if (now > nextChat && !rdrag && !parked) {
      nextChat = now + 150000 + Math.random() * 240000;
      if (Math.random() < 0.5) { setRoverFace('^^', 2500); setTimeout(() => happy(1800), 700); } // hi / hi back
      else { visitUntil = now + 3500; setRoverFace('^^', 3500); happy(3500); }        // pops up to visit
    }
    let text = g.textContent;
    if (roverFace && now < roverFaceUntil) text = faceWith(text, roverFace);
    if (rover.textContent !== text) rover.textContent = text;
    if (rdrag) return;
    const at = parked ? { left: Math.max(2, Math.min(innerWidth - rover.offsetWidth - 2, parked.fx * innerWidth)) + scrollX,
                          top: Math.max(0, Math.min(innerHeight - rover.offsetHeight - 2, parked.fy * innerHeight)) + scrollY } : (now < visitUntil ? (() => { const h0 = home(); return { left: h0.left + g.offsetWidth + 6, top: h0.top }; })() : spot);
    if (!at) return;
    rover.style.left = Math.round(at.left) + 'px';
    rover.style.top = Math.round(at.top) + 'px';
  }

  function hookRover(r) {
    r.style.touchAction = 'none';
    r.addEventListener('pointerdown', e => {
      const b = r.getBoundingClientRect();
      rdrag = { x: e.clientX, y: e.clientY, l: b.left + scrollX, t: b.top + scrollY, moved: false };
      r.style.transition = 'none';
      try { r.setPointerCapture(e.pointerId); } catch (err) {}
      e.stopPropagation();
    });
    r.addEventListener('pointermove', e => {
      if (!rdrag) return;
      const dx = e.clientX - rdrag.x, dy = e.clientY - rdrag.y;
      if (!rdrag.moved && Math.hypot(dx, dy) < 6) return;
      if (!rdrag.moved) { rdrag.moved = true; setRoverFace('Oo', 60000); }
      const maxL = document.documentElement.scrollWidth - r.offsetWidth - 2;
      r.style.left = Math.max(2, Math.min(maxL, rdrag.l + dx)) + 'px';
      r.style.top = Math.max(scrollY, rdrag.t + dy) + 'px';
    });
    const up = () => {
      if (!rdrag) return;
      const moved = rdrag.moved; rdrag = null;
      r.style.transition = '';
      if (!moved) { setRoverFace('><', 600); setTimeout(() => setRoverFace('^^', 1400), 600); return; } // boop
      const b = r.getBoundingClientRect(), hb = g.getBoundingClientRect();
      if (Math.hypot(b.left - hb.left, b.top - hb.top) < 70) { // dropped on the big one
        parked = null; savePark(null); setRoverFace('^^', 2500); happy(2500); return;
      }
      parked = { fx: b.left / innerWidth, fy: b.top / innerHeight }; savePark(parked);
      setRoverFace('^^', 1200);
    };
    r.addEventListener('pointerup', up);
    r.addEventListener('pointercancel', up);
  }
  function roamLabel() {
    document.querySelectorAll('[data-roam]').forEach(b => { b.textContent = 'GHOST: ' + (mode === 'roam' ? 'GOES TO THE DECKS' : 'STAYS UP TOP'); });
    document.querySelectorAll('[data-gsize]').forEach(b => { b.textContent = 'GHOST SIZE: ' + size; });
  }
  document.querySelectorAll('[data-roam]').forEach(b => b.addEventListener('click', () => {
    mode = mode === 'roam' ? 'corner' : 'roam';
    try { localStorage.setItem('ghostMode', mode); } catch (e) {}
    parked = null; savePark(null); roamLabel();
  }));
  document.querySelectorAll('[data-gsize]').forEach(b => b.addEventListener('click', () => {
    const k = Object.keys(SIZES); size = k[(k.indexOf(size) + 1) % k.length];
    try { localStorage.setItem('ghostSize', size); } catch (e) {}
    applySize(); roamLabel();
  }));
  roamLabel(); applySize();
  // SMELLS RIPS (off unless switched on, STATUS -> TOOLS): when the MASTER track looks ripped (free-download tags,
  // YouTube / SoundCloud rip sites, "official video" titles), he goes unimpressed for 6 s every 30 s while it plays.
  // About the file, never the DJ, and never in words. Only what the player reports: title, artist, album, label, genre,
  // the file's comment tag, and its bitrate.
  let rips = false;
  try { rips = localStorage.getItem('rips') === '1'; } catch (e) {}
  const RIP = /free\s*(download|dl)\b|\[free\]|\(free\)|klickaud|y2mate|ytmp3|yt1s|mp3juice|sclouddownloader|soundcloud(mp3|downloader)|savefrom|snapsave|ssyoutube|onlymp3|flvto|320kbps|\bkbps\b|\(official (music |lyric )?(video|audio)\)|\[official (music |lyric )?(video|audio)\]|\(lyrics?\)|\[lyrics?\]|\(audio\)|\bvisuali[sz]er\b|www\.|\.com\b/i;
  function sniff(d) {
    if (!rips) return false;
    const i = d.info || {};
    // Very low quality counts too: 160 kbps or less (a 128 kbps rip). Lossless files report 1411 and up.
    const low = i.bitRate > 0 && i.bitRate <= 160;
    if (!low && !RIP.test([d.title, d.artist, i.album, i.label, i.genre, i.comment].filter(Boolean).join(' | '))) return false;
    return (performance.now() / 1000) % 30 < 6;
  }
  function ripLabel() { document.querySelectorAll('[data-rips]').forEach(b => { b.textContent = 'GHOST SMELLS RIPS: ' + (rips ? 'ON' : 'OFF'); }); }
  document.querySelectorAll('[data-rips]').forEach(b => b.addEventListener('click', () => {
    rips = !rips;
    try { localStorage.setItem('rips', rips ? '1' : '0'); } catch (e) {}
    ripLabel(); face();
  }));
  ripLabel();

  function happy(ms) {
    happyUntil = performance.now() + ms;
    face();
  }

  // TOUCH (Richard, Nov 6): pick him up and drag him around the top bar; let go and he springs back home with a little
  // overshoot. He can't leave the top bar, so he never ends up over the decks. A tap without dragging = happy face.
  // WANDER: while nobody holds him he drifts a few pixels around his own spot now and then, and always comes home.
  let drag = null, dragged = false;
  g.style.touchAction = 'none';
  g.addEventListener('pointerdown', e => {
    if (!on) return;
    const t = g.style.translate; g.style.transition = 'none'; g.style.translate = '';
    const home = g.getBoundingClientRect(), bar = g.parentElement.getBoundingClientRect();
    g.style.translate = t;
    drag = { x: e.clientX, y: e.clientY, moved: false,
      minX: bar.left - home.left + 2, maxX: bar.right - home.right - 2, minY: bar.top - home.top, maxY: bar.bottom - home.bottom };
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
  });
  g.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; face(); }
    const cx = Math.max(drag.minX, Math.min(drag.maxX, dx)), cy = Math.max(drag.minY, Math.min(drag.maxY, dy));
    g.style.translate = cx + 'px ' + cy + 'px';
  });
  const letGo = () => {
    if (!drag) return;
    dragged = drag.moved;
    drag = null;
    g.style.transition = still ? 'none' : 'translate .7s cubic-bezier(.34,1.56,.64,1)';
    g.style.translate = '';
    if (dragged) happy(1200);
  };
  g.addEventListener('pointerup', letGo);
  g.addEventListener('pointercancel', letGo);
  setInterval(() => {
    if (!on || still || drag || document.hidden || Math.random() < 0.4) return;
    const home = Math.random() < 0.35;
    g.style.transition = 'translate 2.4s ease-in-out';
    g.style.translate = home ? '' : Math.round(Math.random() * 10 - 3) + 'px ' + Math.round(Math.random() * 4 - 2) + 'px';
  }, 6000);
  setInterval(() => { try { face(); } catch (e) {} }, 500);

  const origHeader = renderHeader;
  renderHeader = function () { origHeader.apply(this, arguments); face(); };

  const origPlayed = renderPlayed;
  renderPlayed = function () {
    origPlayed.apply(this, arguments);
    const n = S.played.length;
    if (seen !== null && n > seen && on) {
      happy(n % 25 === 0 ? 8000 : 3000);
      if (n % 100 === 0) eggOnce('track ' + n, 30000, '^^', { hat: true });
    }
    seen = n;
  };

  // GHOST DANCES (#92, dances.js): on every beat of the MASTER deck a pose from the move he's on; a new move every 4
  // bars or when the section changes, never the same twice in a row. The little one on the decks dances along.
  const dancer = Dance.make();
  function tierNow(m) {
    let kind = null;
    try { const ph = phraseNow(m, position(m)); kind = ph && ph.cur ? ph.cur.kind : null; } catch (e) { /* no phrases */ }
    return Dance.tierOf(kind, m.effectiveBpm);
  }
  function strike(t, ms) {
    const k = SIZES[size];
    g.style.transition = drag ? 'none' : `transform ${ms}ms ${pose && pose.snap ? 'steps(1, start)' : 'ease-out'}, translate 2.4s ease-in-out`;
    if (!drag) g.style.transform = t;
    if (rover) { rover.classList.add('dancing'); if (!rdrag) rover.style.transform = Dance.css(pose && !pose.back ? pose : null, k * 0.8 * roverFit); }
  }
  const origBeat = onBeat;
  onBeat = function (p, b) {
    origBeat.apply(this, arguments);
    if (!on || still) return;
    const m = Object.values(S.decks).find(d => d.master && d.playing);
    if (!m || m.player !== p) return;
    lastBeat = performance.now();
    g.style.animation = 'none';
    const next = dancer.step(b, tierNow(m), m.effectiveBpm);
    if (!next) return; // half time, or waiting for the downbeat
    pose = next;
    const ms = Dance.ease(m.effectiveBpm);
    strike(Dance.css(pose, SIZES[size]), ms);
    clearTimeout(backT);
    if (pose.back) backT = setTimeout(() => { if (!drag) g.style.transform = ''; }, Math.min(150, ms + 40));
    face();
  };
  // Music stopped: back to the slow float.
  setInterval(() => {
    if (g.style.animation && performance.now() - lastBeat > 3000) {
      g.style.animation = ''; g.style.transform = ''; pose = null; dancer.reset();
      if (rover) rover.style.transform = '';
    }
  }, 1000);

  g.addEventListener('click', () => {
    if (!on) return;
    const now = performance.now();
    taps = taps.filter(t => now - t < 5000); taps.push(now);
    if (taps.length >= 10) { taps = []; dizzyUntil = now + 3000; }
    happy(1500);
  });
  g.style.cursor = 'pointer';

  function label() { document.querySelectorAll('[data-fun]').forEach(b => { b.textContent = 'GHOST MOODS: ' + (on ? 'ON' : 'OFF'); }); }
  document.querySelectorAll('[data-fun]').forEach(b => b.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem('fun', on ? '1' : '0'); } catch (e) {}
    g.style.animation = ''; g.style.transform = ''; g.style.translate = ''; happyUntil = 0;
    g.style.cursor = on ? 'pointer' : '';
    label(); renderHeader();
  }));
  label();
  return { get on() { return on; } };
})();
