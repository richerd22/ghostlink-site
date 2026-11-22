'use strict';
/*
 * SET UP SOUND IN (#91). Richard: "super ez tutorial for how to set up ... easy as possible. never annoying." /
 * "What to do if it's detected for setting up but not annoying if u know what ur doing."
 *  - One quiet line, SOUND CARD FOUND · SET UP, when the box sees a sound card and the guide was never done or
 *    hidden. x hides it forever (on this box, every phone); DONE does the same. Never on DECKS / NOW (the corner
 *    window beside Resolume stays clean), never on WATCH FROM HOME.
 *  - The guide, 4 steps that follow what the box sees live: 1 WHICH PLUG (the mixer on the DJ network picks the model),
 *    2 PLAY SOMETHING (meter + a tick + too quiet / too loud / one side), 3 TEST (10 s, played back here; in the box's
 *    memory only), 4 DONE (ask the DJ before recording a set). Skip any step; DONE at the top ends it at once.
 *  - Always reachable: NETWORK -> SOUND IN -> SET UP GUIDE.
 * Own file: if anything here throws, the rest of the dashboard carries on. Uses app.js globals ($, S, post,
 * unlocked, needUnlock, curView, pending) and sound.js (Sound.levels). Text from the network goes in as text only.
 */
const SoundSetup = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const KEY = 'soundSetupHidden';
  let shownKey = '', boxDone = null, hiddenHere = false, step = 1, pick = null, lv = null, okSince = 0, heard = false, recent = [], testTimer = null;
  try { hiddenHere = localStorage.getItem(KEY) === '1'; } catch (e) {}

  // Which output on which mixer: gear.js (#105, the whole list, from the makers' spec pages and manuals). Same list
  // on the public help page (help/mixers/) and docs/wiki/gear.md. The pick is remembered per venue on this phone.
  const OTHER = Gear.sound(Gear.byId('OTHER'));
  const seen = () => {
    const m = (S.devices || []).find(d => d.kind === 'MIXER');
    if (!m || !m.name) return null;
    const x = Gear.fromName(m.name) || Gear.byId('OTHER');
    return { name: m.name, model: Gear.sound(x) };
  };
  const venue = () => (S.status && S.status.venue) || null;
  const model = () => {
    if (pick) return Gear.sound(Gear.byId(pick));
    const c = Gear.current(S.devices, venue());
    return c ? Gear.sound(c.entry) : null;
  };
  const MIXERS = Gear.LIST;

  // ---------- the quiet line ----------
  const line = el('div', 'ssu-line local-only');
  line.id = 'soundSetupLine';
  line.hidden = true;
  line.append(el('span', null, 'SOUND CARD FOUND'), el('span', 'ssu-dot', '·'));
  const lineGo = el('button', 'mini ssu-go', 'SET UP');
  lineGo.type = 'button';
  const lineX = el('button', 'mini ssu-x', '×');
  lineX.type = 'button';
  lineX.setAttribute('aria-label', 'Hide this for good');
  lineX.title = 'Hide for good (NETWORK > SOUND IN > SET UP GUIDE brings it back)';
  line.append(lineGo, lineX);
  ($('curfewBar') || $('alert')).insertAdjacentElement('afterend', line);
  lineGo.addEventListener('click', () => open(1));
  lineX.addEventListener('click', () => hideForGood());

  function hideForGood() {
    hiddenHere = true;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    boxDone = true;
    line.hidden = true;
    post('/api/audio/setup', { done: true }).catch(() => {});
  }

  async function loadDone() {
    try { const r = await fetch('/api/audio', { cache: 'no-store' }); if (r.ok) boxDone = !!(await r.json()).setupDone; } catch (e) {}
    renderLine();
  }

  function renderLine() {
    const a = S.status && S.status.audio, v = typeof curView === 'function' ? curView() : '';
    const role = new URLSearchParams(location.search).has('role');
    line.hidden = !(a && a.card) || hiddenHere || boxDone !== false || v === 'decks' || v === 'now' || role || !box.hidden;
  }

  // ---------- the guide ----------
  const box = el('div', 'share ssu');
  box.id = 'soundSetup';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Set up sound in');
  const inner = el('div', 'share-box ssu-box');
  box.append(inner);
  document.body.append(box);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });

  function open(n) {
    step = n || 1;
    box.hidden = false;
    line.hidden = true;
    render();
  }
  function close() {
    box.hidden = true;
    stopTestPoll();
    renderLine();
  }
  function finish() {
    hideForGood();
    close();
  }

  const btn = (text, fn, cls) => { const b = el('button', cls || null, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const p = (text, cls) => el('p', 'ssu-p' + (cls ? ' ' + cls : ''), text);

  function head() {
    const h = el('div', 'ssu-head');
    h.append(el('b', null, 'SET UP SOUND IN · ' + step + ' OF 4'));
    h.append(btn('DONE', finish, 'mini'), btn('×', close, 'mini ssu-x'));
    h.lastChild.setAttribute('aria-label', 'Close');
    return h;
  }
  function nav() {
    const n = el('div', 'ssu-nav');
    if (step > 1) n.append(btn('BACK', () => { step--; render(); }));
    if (step < 4) n.append(btn(step === 3 ? 'SKIP' : 'NEXT', () => { step++; render(); }, 'ssu-next'));
    else n.append(btn('DONE', finish, 'ssu-next on'));
    return n;
  }

  function cardLine() {
    const a = S.status && S.status.audio;
    if (a && a.live) return p('Sound card: ' + a.card + ' · reading it.', 'ssu-ok');
    if (a && a.card) return p('Sound card: ' + a.card + ' · starting to read it...', 'ssu-warn');
    return p('No sound card yet. Plug the USB sound card into one of the box\'s USB ports: it shows up within 5 seconds.', 'ssu-warn');
  }

  function render() {
    if (box.hidden) return;
    inner.replaceChildren(head());
    if (step === 1) step1();
    else if (step === 2) step2();
    else if (step === 3) step3();
    else step4();
    inner.append(nav());
  }

  function step1() {
    inner.append(el('h3', 'ssu-h', '1 · PLUG THE MIXER INTO THE CARD'), cardLine());
    const s = seen();
    const c = Gear.current(S.devices, venue());
    const cur = pick || (c && c.entry.id);
    const pickRow = GearPick.picker(cur, x => { pick = x.id; const v = venue(); Gear.store.set(v && v.id, x.id); render(); });
    inner.append(p(s ? 'Mixer on the DJ network: ' + s.name + (pick ? '' : ' (picked for you).')
      : c && c.from === 'venue' ? 'Which mixer? From this venue\'s GEAR notes: ' + c.entry.name + '. Different tonight? Tap it.'
      : c ? 'Which mixer? Last time here: ' + c.entry.name + '.' : 'Which mixer? (None on the DJ network right now: pick it.)'), pickRow);
    const m = model();
    if (!m) { inner.append(p('Pick the mixer above and the guide says which plug to use.')); return; }
    const ol = el('ol', 'ssu-steps');
    ol.append(el('li', null, 'On the ' + (m.id === 'OTHER' || m.id === 'LAPTOP' || m.id === 'NONE' ? 'mixer' : m.name) + ': use ' + m.where + '.'));
    ol.append(el('li', null, m.cable));
    ol.append(el('li', null, 'Other end into the sound card\'s INPUT (the RCA pair marked INPUT). Never OUTPUT. Red = R, white = L.'));
    inner.append(ol);
    if (m.why) inner.append(p(m.why));
    inner.append(p(m.taken, 'ssu-dim'));
  }

  // Live meter in the guide (Sound.levels is wrapped below, about 5 times a second).
  const bar = (rms, peak) => {
    const pct = db => Math.max(0, Math.min(100, (db + 60) / 60 * 100));
    const row = el('div', 'ssu-bar');
    const f = el('b');
    f.style.width = pct(rms) + '%';
    if (peak > -1) f.classList.add('hot');
    row.append(f);
    return row;
  };
  function verdict() {
    const now = Date.now(), r = recent.filter(x => now - x.t < 3000);
    const m = model() || OTHER;
    if (!r.length) return { st: 'wait', say: 'Waiting for the meter...' };
    const loud = Math.max(...r.map(x => Math.max(x.rl, x.rr))), peak = Math.max(...r.map(x => Math.max(x.pl, x.pr)));
    const l = Math.max(...r.map(x => x.rl)), rr = Math.max(...r.map(x => x.rr));
    if (loud < -50) return { st: 'none', say: 'Nothing yet. Play a track with a channel fader up. Still nothing: cable in the card\'s INPUT (not OUTPUT), and in ' + m.use + ' on the mixer.' };
    if (Math.min(l, rr) < -50) return { st: 'side', say: 'Only ' + (l < -50 ? 'R' : 'L') + ' is moving: one plug is loose or in the wrong jack.' };
    if (peak > -1) return { st: 'loud', say: m.loud };
    if (loud < -30) return { st: 'quiet', say: m.quiet };
    return { st: 'good', say: 'Good level. Aim for the loud parts around -12 dB here.' };
  }
  // Step 2 is built once; the meter, tick and hint update in place (rebuilding 5 times a second would eat taps).
  let s2 = null;
  function step2() {
    inner.append(el('h3', 'ssu-h', '2 · PLAY SOMETHING'), cardLine());
    const meter = el('div', 'ssu-meter');
    s2 = { bars: {}, vals: {} };
    ['L', 'R'].forEach(s => {
      const row = el('div', 'ssu-mrow'), b = bar(-120, -120), v = el('em', null, '--');
      s2.bars[s] = b.firstChild; s2.vals[s] = v;
      row.append(el('span', null, s), b, v);
      meter.append(row);
    });
    s2.tick = el('p', 'ssu-tick');
    s2.hint = p('');
    inner.append(meter, s2.tick, s2.hint);
    inner.append(p("The sound card has no input knob: the level is set on the mixer. " + (model() || OTHER).level, 'ssu-dim'));
    update2();
  }
  function update2() {
    if (!s2 || !s2.tick.isConnected) return;
    const d = lv || {}, pct = db => Math.max(0, Math.min(100, (db + 60) / 60 * 100));
    [['L', d.rl, d.pl], ['R', d.rr, d.pr]].forEach(([s, rms, peak]) => {
      s2.bars[s].style.width = pct(rms ?? -120) + '%';
      s2.bars[s].classList.toggle('hot', (peak ?? -120) > -1);
      s2.vals[s].textContent = rms == null || rms <= -119 ? '--' : Math.round(rms) + ' dB';
    });
    s2.tick.className = 'ssu-tick' + (heard ? ' yes' : '');
    s2.tick.textContent = heard ? '✓ SOUND IS COMING IN' : 'Play a track: the bars move when sound comes in.';
    const v = verdict();
    s2.hint.textContent = v.say;
    s2.hint.className = 'ssu-p' + (v.st === 'good' ? ' ssu-ok' : v.st === 'loud' || v.st === 'side' ? ' ssu-warn' : '');
  }

  function levels(d) {
    lv = d;
    const now = Date.now();
    recent.push({ t: now, rl: d.rl, rr: d.rr, pl: d.pl, pr: d.pr });
    recent = recent.filter(x => now - x.t < 3000);
    if (Math.max(d.rl, d.rr) > -50) { if (!okSince) okSince = now; if (now - okSince > 1500) heard = true; } else okSince = 0;
    if (!box.hidden && step === 2) update2();
  }

  // ---------- 3 · TEST ----------
  let test = null;
  function stopTestPoll() { if (testTimer) { clearInterval(testTimer); testTimer = null; } }
  async function pollTest() {
    try {
      const r = await fetch('/api/audio/test', { cache: 'no-store' });
      if (r.status === 401) { test = { state: 'locked' }; stopTestPoll(); }
      else if (r.ok) test = await r.json();
    } catch (e) {}
    if (!test || test.state !== 'recording') stopTestPoll();
    if (!box.hidden && step === 3) render();
  }
  async function startTest() {
    if (!unlocked) return unlockFirst();
    const r = await post('/api/audio/test', {});
    if (r.status === 401) return;
    if (!r.ok) { test = { state: 'error', error: ((await r.json().catch(() => ({}))).error) || 'Couldn\'t start the test.' }; render(); return; }
    test = { state: 'recording', secs: 0, of: 10 };
    render();
    stopTestPoll();
    testTimer = setInterval(pollTest, 500);
  }
  function unlockFirst() {
    close();
    // Once the password is in, app.js "clicks" pending: that brings the guide back on this step.
    pending = { click: () => open(3) };
    needUnlock();
  }
  function step3() {
    inner.append(el('h3', 'ssu-h', '3 · TEST RECORDING (10 S)'), cardLine());
    inner.append(p('Records 10 seconds, then plays it back here. Kept in the box\'s memory only: never saved, gone in 10 minutes.', 'ssu-dim'));
    const t = test || { state: 'none' };
    if (t.state === 'recording') {
      inner.append(p('Recording... ' + (t.secs || 0) + ' of ' + (t.of || 10) + ' s. Keep the music playing.', 'ssu-warn'));
    } else if (t.state === 'ready') {
      const au = el('audio');
      au.controls = true;
      au.preload = 'auto';
      au.src = '/api/audio/test.wav?t=' + Date.now();
      au.className = 'ssu-audio';
      const q = t.loud < -50 ? 'It was silent: go back to step 2.' : t.peak > -1 ? 'It hit red: listen for crackle on the loud parts (step 2 says what to turn).' : t.loud < -30 ? 'Quiet but fine; louder is better.' : 'Level looks good.';
      inner.append(p('✓ Got it. Press play and listen.', 'ssu-ok'), au, p(q, t.loud < -50 || t.peak > -1 ? 'ssu-warn' : null));
      inner.append(btn('TEST AGAIN', startTest, 'mini'));
    } else {
      if (t.state === 'error') inner.append(p(t.error, 'ssu-warn'));
      if (t.state === 'locked' || !unlocked) inner.append(p('Needs the crew password or crew code (it records sound from the room).', 'ssu-dim'));
      inner.append(btn(unlocked ? '● TEST 10 SECONDS' : 'UNLOCK TO TEST', startTest, 'ssu-test'));
    }
  }

  function step4() {
    inner.append(el('h3', 'ssu-h', '4 · DONE'));
    inner.append(p('SOUND IN is set up. The meter lives in NETWORK > SOUND IN, and the box warns on SILENCE by itself.'));
    inner.append(p('Recording a set: ask the DJ first. Nothing records until someone taps ● RECORD <DJ>, it keeps going until someone taps STOP. If the DJ changes it asks NEW FILE or KEEP GOING, it never cuts off.', 'ssu-warn'));
    inner.append(p('This guide won\'t pop up again. It\'s always under NETWORK > SOUND IN > SET UP GUIDE.', 'ssu-dim'));
  }

  // ---------- the chip (#105) ----------
  // Richard at a club: "lil too hidden when it's plugged in ... If it was just plugged in the persons prob looking for
  // it." One small row inside the header, on every view (the corner window too), never over deck data:
  //  - SOUND CARD IN · ● RECORD · SET UP: the card appeared while this page was open, or within 2 min of the page
  //    loading (status.audio.cardAt, box clock). Shows even when the guide was done before. Goes by itself after 60 s,
  //    on ×, or once recording is armed / running. Seen once per plug-in per phone.
  //  - RECORDING BUT HEARING NOTHING · CHECK THE CABLE: status.audio.deaf (#103). Stays while it's true; × hides it
  //    until the next time. CHECK THE CABLE opens the plug step for their mixer.
  const CHIP_SEEN = 'sndChipSeen', CHIP_MS = 60_000, FRESH_MS = 120_000;
  const chip = el('div', 'ssu-chip');
  chip.id = 'soundChip';
  chip.hidden = true;
  chip.setAttribute('role', 'status');
  const chipText = el('span', 'ssu-chip-t');
  const chipRec = btn('● RECORD', () => record(), 'mini ssu-chip-rec');
  const chipGo = btn('SET UP', () => open(1), 'mini');
  const chipX = btn('×', () => chipAway(), 'mini ssu-x');
  chipX.setAttribute('aria-label', 'Hide');
  chip.append(chipText, chipRec, chipGo, chipX);
  (document.querySelector('header') || document.body).append(chip);
  let chipKind = null, chipUntil = 0, chipCardAt = null, prevCard, deafAway = false, chipT = 0;
  const seenAt = () => { try { return +localStorage.getItem(CHIP_SEEN) || 0; } catch (e) { return 0; } };
  const markSeen = at => { try { localStorage.setItem(CHIP_SEEN, String(at)); } catch (e) {} };

  function record() {
    const r = $('sndRec');
    if (!r) return;
    const a = S.status && S.status.audio;
    if (a && a.recordOn) return chipAway();
    // The same arm flow as SOUND IN: the crew code / password still applies; once in, it carries on by itself.
    if (!unlocked) { pending = { click: () => { if (!(S.status && S.status.audio && S.status.audio.recordOn)) r.click(); } }; return needUnlock(); }
    r.click();
  }
  function chipAway() {
    if (chipKind === 'deaf') deafAway = true;
    if (chipKind === 'in' && chipCardAt) markSeen(chipCardAt);
    chipKind = null;
    renderChip();
  }
  const chipFor = (a, o) => Gear.chipFor(a, Object.assign({ fresh: FRESH_MS }, o));
  function updateChip() {
    const a = S.status && S.status.audio;
    if (!a) return;
    if (!a.deaf) deafAway = false;
    const now = Date.now();
    if (chipKind === 'in' && (now > chipUntil || !a.card || a.recordOn || a.recording || a.cardAt !== chipCardAt)) {
      if (chipCardAt) markSeen(chipCardAt);
      chipKind = null;
    }
    const want = chipFor(a, { deafAway, seen: seenAt(), prevCard, boxNow: now - (S.skew || 0) });
    prevCard = a.card || null;
    if (want === 'deaf') chipKind = 'deaf';
    else if (chipKind === 'deaf') chipKind = null;
    if (want === 'in' && chipKind !== 'in') { chipKind = 'in'; chipCardAt = a.cardAt; chipUntil = now + CHIP_MS; markSeen(a.cardAt); }
    renderChip();
  }
  function renderChip() {
    const remote = document.body.classList.contains('remote') || document.body.classList.contains('embed');
    chip.hidden = !chipKind || remote;
    chip.classList.toggle('warn', chipKind === 'deaf');
    if (chipKind === 'deaf') { chipText.textContent = 'RECORDING BUT HEARING NOTHING'; chipGo.textContent = 'CHECK THE CABLE'; }
    else { chipText.textContent = 'SOUND CARD IN'; chipGo.textContent = 'SET UP'; }
    chipRec.hidden = chipKind !== 'in';
    clearTimeout(chipT);
    if (chipKind === 'in') chipT = setTimeout(() => { try { updateChip(); } catch (e) {} }, Math.max(500, chipUntil - Date.now() + 50));
  }

  // SET UP GUIDE button in NETWORK -> SOUND IN, always there.
  const again = btn('SET UP GUIDE', () => open(1), 'mini ssu-again local-only');
  if ($('sndNote')) $('sndNote').insertAdjacentElement('afterend', again);
  // #105: recording but the card hears nothing (status.audio.deaf, #103), said on SOUND IN too.
  const deafRow = el('div', 'ssu-deaf');
  deafRow.hidden = true;
  deafRow.append(el('span', null, 'RECORDING BUT HEARING NOTHING. The decks are playing and the card has heard nothing for 20 s: check the cable is in the mixer\'s output and the card\'s INPUT.'),
    btn('CHECK THE CABLE', () => open(1), 'mini'));
  if ($('sndNote')) $('sndNote').insertAdjacentElement('beforebegin', deafRow);

  // ---------- hooks ----------
  if (typeof Sound !== 'undefined') {
    const o = Sound.levels;
    Sound.levels = function (d) { o.apply(this, arguments); try { levels(d); } catch (e) { console.warn('soundsetup', e); } };
  }
  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try {
      const a = S.status && S.status.audio;
      if (a && a.card && boxDone === null) { boxDone = undefined; loadDone(); }
      renderLine();
      deafRow.hidden = !(a && a.deaf);
      updateChip();
      // Redraw only when what the guide shows changed (card, reading, the mixer seen): never under a finger or a playing clip.
      const k = JSON.stringify([a && a.card, a && a.live, (seen() || {}).name]);
      if (!box.hidden && k !== shownKey && step !== 3) { shownKey = k; render(); }
    } catch (e) { console.warn('soundsetup', e); }
  };
  addEventListener('hashchange', () => { try { renderLine(); } catch (e) {} });
  return { open, close, levels, MIXERS, chipFor };
})();
