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

  // Each mixer's rear panel, from Pioneer DJ's published specs / manuals (read 2026-11-21). Same table on the public
  // help page (help/how-to/record-with-a-sound-card.html) and docs/wiki/sound-in.md: keep the three in step.
  const RCA = 'An RCA to RCA cable (red and white, both ends).';
  const JACK = 'A 2 x 1/4-inch jack to 2 x RCA cable (BOOTH is two 1/4-inch jacks, L and R).';
  const DJM = {
    use: 'REC OUT', where: 'the pair of RCA jacks marked REC OUT on the back',
    cable: RCA,
    why: "REC OUT is there for recording: it carries the mix and nobody else is using it, most nights.",
    taken: 'REC OUT already used (a venue recorder)? MASTER 2 (RCA) works too. Both busy: a Y splitter on REC OUT.',
    level: "REC OUT has no knob of its own. The loud parts sit wherever the DJ's mix sits; that's normal.",
    loud: "Red on the loud parts: the DJ's mix is running hot (check the mixer's MASTER meter). A few flashes are fine. Steady red: move the cable to BOOTH (2 x 1/4-inch to 2 x RCA) and set it with the BOOTH level knob, only if the booth monitors aren't on BOOTH.",
    quiet: 'Quiet: check the mixer is really sending (channel faders up, crossfader). REC OUT follows the mix, not a knob. A quiet recording is still usable; it can be turned up after.'
  };
  const MIXERS = [
    { id: 'DJM-A9', name: 'DJM-A9', ...DJM },
    { id: 'DJM-V10', name: 'DJM-V10', ...DJM },
    { id: 'DJM-900NXS2', name: 'DJM-900NXS2', ...DJM },
    { id: 'XDJ-XZ', name: 'XDJ-XZ', use: 'MASTER 2', where: 'the pair of RCA jacks marked MASTER 2 on the back (MASTER 1 is the big XLR pair)',
      cable: RCA,
      why: 'The XDJ-XZ has no REC OUT. MASTER 2 is the RCA copy of the master.',
      taken: 'MASTER 2 already used? BOOTH (2 x 1/4-inch to 2 x RCA) works too, with its own BOOTH level knob.',
      level: 'MASTER 2 follows the MASTER LEVEL knob: turning the room up turns the recording up.',
      loud: 'Red on the loud parts: turn MASTER LEVEL down a little, or move to BOOTH and set the recording with the BOOTH level knob on its own.',
      quiet: 'Quiet: turn MASTER LEVEL up, or move to BOOTH and turn the BOOTH level knob up (the room stays the same).' },
    { id: 'OTHER', name: 'OTHER', use: 'REC OUT', where: 'REC OUT on the back if it has one (it is made for recording). No REC OUT: a spare RCA master out (MASTER 2), or BOOTH',
      cable: RCA + ' For BOOTH (1/4-inch jacks): 2 x 1/4-inch to 2 x RCA.',
      why: "Never the headphone jack: it carries whatever the DJ cues, not the mix.",
      taken: 'Everything busy: a Y splitter on REC OUT or the RCA master.',
      level: 'REC OUT usually has no knob. A master or booth out follows its own level knob.',
      loud: 'Red on the loud parts: turn the level knob for the output you used down a little (BOOTH, or MASTER if you used a master out). REC OUT has no knob: a few flashes are fine.',
      quiet: 'Quiet: turn the level knob for that output up (BOOTH, or MASTER). REC OUT follows the mix; a quiet recording is still usable.' }
  ];
  const OTHER = MIXERS[MIXERS.length - 1];
  const seen = () => {
    const m = (S.devices || []).find(d => d.kind === 'MIXER');
    if (!m || !m.name) return null;
    const n = String(m.name).toUpperCase().replace(/\s+/g, '');
    return { name: m.name, model: MIXERS.find(x => x.id !== 'OTHER' && n.startsWith(x.id)) || OTHER };
  };
  const model = () => MIXERS.find(x => x.id === pick) || (seen() || {}).model || null;

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
    const pickRow = el('div', 'ssu-pick');
    MIXERS.forEach(m => {
      const b = btn(m.name, () => { pick = m.id; render(); }, 'mini');
      if (model() === m) b.classList.add('on');
      pickRow.append(b);
    });
    inner.append(p(s ? 'Mixer on the DJ network: ' + s.name + (pick ? '' : ' (picked for you).') : 'Which mixer? (None on the DJ network right now: pick it.)'), pickRow);
    const m = model();
    if (!m) { inner.append(p('Pick the mixer above and the guide says which plug to use.')); return; }
    const ol = el('ol', 'ssu-steps');
    ol.append(el('li', null, 'On the ' + (m.id === 'OTHER' ? 'mixer' : m.name) + ': use ' + m.where + '.'));
    ol.append(el('li', null, m.cable));
    ol.append(el('li', null, 'Other end into the sound card\'s INPUT (the RCA pair marked INPUT). Never OUTPUT. Red = R, white = L.'));
    inner.append(ol, p(m.why), p(m.taken, 'ssu-dim'));
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
    inner.append(p('Recording a set: ask the DJ first. Nothing records until someone taps ● RECORD <DJ>, it records only that DJ, and it stops when the DJ changes. The next DJ is asked again.', 'ssu-warn'));
    inner.append(p('This guide won\'t pop up again. It\'s always under NETWORK > SOUND IN > SET UP GUIDE.', 'ssu-dim'));
  }

  // SET UP GUIDE button in NETWORK -> SOUND IN, always there.
  const again = btn('SET UP GUIDE', () => open(1), 'mini ssu-again local-only');
  if ($('sndNote')) $('sndNote').insertAdjacentElement('afterend', again);

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
      // Redraw only when what the guide shows changed (card, reading, the mixer seen): never under a finger or a playing clip.
      const k = JSON.stringify([a && a.card, a && a.live, (seen() || {}).name]);
      if (!box.hidden && k !== shownKey && step !== 3) { shownKey = k; render(); }
    } catch (e) { console.warn('soundsetup', e); }
  };
  addEventListener('hashchange', () => { try { renderLine(); } catch (e) {} });
  return { open, close, levels, MIXERS };
})();
