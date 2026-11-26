'use strict';
// NO DECKS NIGHT (DECISIONS #160). a club Nov 25: no DJ Link after 21:52 (the box's network port never saw a link
// again), four hours on SOUND IN only. A night with no decks is still a full night:
// - TONIGHT BY EAR (NOW and DECKS, under THE EAR's card): music on / off, how long, the BPM by ear (one decimal when
//   steady), big drops, the line's loudness, the room, the part of the night, and the last drop's place in the
//   recording. status.byEar. Never a title: there are none by ear.
// - VENUE FROM WI-FI (a line, THE LINE RULE 'venue'): "YOU'RE AT X (Wi-Fi "N") - SWITCH TONIGHT?" / WHICH ONE TONIGHT /
//   SAVE THIS WI-FI FOR X. status.venueHint; one tap; NOT TONIGHT = silent for that network tonight. The box never
//   switches HARD STOP's night.
// The DJ CABLE words live in easy.js (READY FOR TONIGHT, NO DECKS YET) and app.js (the header). Text nodes only.
const NoDecks = (() => {
  const css = document.createElement('style');
  css.textContent = `
.byear-card { border: 1px solid var(--line); padding: 8px 12px; margin: 8px 0; }
.byear-card[hidden] { display: none; }
.byear-card .be-head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.byear-card .be-head b { letter-spacing: .12em; font-size: 12px; color: var(--grey); font-weight: 400; }
.byear-card .be-head span { font-weight: 600; }
.byear-card .be-facts { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 4px; font-variant-numeric: tabular-nums; }
.byear-card .be-facts span small { color: var(--grey); letter-spacing: .08em; margin-right: 4px; }
.byear-card .be-note { color: var(--grey); font-size: 12px; margin-top: 4px; }
.byear-card .be-note a { color: var(--fg); }
@media (max-height: 340px) { .byear-card { padding: 4px 8px; margin: 4px 0; } .byear-card .be-note, .byear-card .be-facts .be-more { display: none; } }
.venue-hint { margin: 8px 10px 0; padding: 4px 10px; font-size: .85em; border: 1px solid var(--fg); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.venue-hint[hidden] { display: none; }
.venue-hint span { flex: 1; min-width: 12em; }`;
  document.head.appendChild(css);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hm = ms => { const d = new Date(ms + (S.skew || 0)); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const into = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  /** A fact; tap = where it comes from and how it was decided (Richard: "clicking anything like that should give u more"). */
  const fact = (k, v, more, how, note) => {
    const sp = el('span', more ? 'be-more' : null); sp.append(el('small', null, k), document.createTextNode(v));
    if (how) { sp.tabIndex = 0; sp.setAttribute('role', 'button'); sp.title = how; sp.onclick = () => { note.textContent = k + ': ' + how; note.dataset.held = String(Date.now() + 15000); }; }
    return sp;
  };
  /** BPM by ear as this phone wants it: whole numbers, or one decimal once steady (never two: the ear isn't that exact). */
  const earBpm = e => (typeof glBpmDp === 'function' && glBpmDp() === 0) || !e.steady ? '~' + Math.round(e.bpm) : e.bpm.toFixed(1);

  // ---------- TONIGHT BY EAR ----------
  function card() {
    const c = el('div', 'byear-card'); c.hidden = true;
    const head = el('div', 'be-head'), facts = el('div', 'be-facts'), note = el('div', 'be-note');
    c.append(head, facts, note);
    c._ = { head, facts, note, sig: '' };
    return c;
  }
  const decksCard = card(), nowCard = card();
  const earDecks = document.querySelector('#decks .ear-card'), earNow = document.querySelector('#now .ear-card');
  if (earDecks) earDecks.after(decksCard); else { const bar = document.querySelector('#decks .deckbar'); if (bar) bar.after(decksCard); }
  const nowBody = document.getElementById('nowBody');
  if (earNow) earNow.after(nowCard); else if (nowBody) nowBody.before(nowCard);

  /** What the card says, or null: by-ear music tonight, and no DJ Link deck in focus. Pure enough to test. */
  function view(s, decksInFocus) {
    const b = s && s.byEar;
    if (!b || !b.minutes || decksInFocus) return null;
    const m = s.music || {}, e = s.ear;
    const out = { head: 'TONIGHT BY EAR', state: m.on && m.src === 'ear' ? 'MUSIC ON' : b.on ? 'MUSIC ON' : 'MUSIC OFF', facts: [], note: '' };
    out.facts.push(['MUSIC', b.hours]);
    const bpmNow = e && e.bpm ? earBpm(e) : null;
    const conf = e && e.conf != null ? ' Sure: ' + Math.round(e.conf * 100) + '%.' : '';
    if (bpmNow) out.facts.push(['BPM', bpmNow, false, 'by ear from the sound card, a comb over the last ' + (s.earMode === 'fast' ? '8' : '12')
      + ' s of kicks; one decimal once 8+ readings agree within 0.3 BPM, else ~.' + conf]);
    if (b.bpmLow != null) out.facts.push(['RANGE', Math.round(b.bpmLow) === Math.round(b.bpmHigh) ? String(Math.round(b.bpmLow)) : Math.round(b.bpmLow) + '-' + Math.round(b.bpmHigh), !!bpmNow,
      'the steady minutes tonight' + (b.avgBpm != null ? ', average ' + b.avgBpm : '') + '. Unsure minutes never count.']);
    out.facts.push(['DROPS', String(b.drops || 0) + (b.lastDrop ? ' · last ' + hm(b.lastDrop.at) : ''), false,
      'big drops: the low end back after 8+ bars without it (' + (b.dropsAll || 0) + ' drops of any length).'
      + (b.lastDrop && b.lastDrop.recAt != null ? ' The last one is ' + into(b.lastDrop.recAt) + ' into the recording.' : '')]);
    if (b.energy && b.energy.mood) out.facts.push(['ENERGY', b.energy.mood, true, 'this quarter hour against tonight\'s others: loudness, bass and big drops'
      + (b.energy.bpm != null ? ', ~' + Math.round(b.energy.bpm) + ' BPM' : '') + '.']);
    if (m.lufs != null || b.lufs != null) out.facts.push(['LINE', (m.lufs != null ? Math.round(m.lufs) : Math.round(b.lufs)) + ' LUFS' + (b.hot ? ' HOT' : ''), true,
      'the mixer output the sound card is on (not the room), short-term loudness now' + (b.lufs != null ? '; tonight ' + b.lufs + ' LUFS' : '')
      + (b.range != null ? ', range ' + b.range + ' LU' : '') + (b.peakDb != null ? ', peak ' + b.peakDb + ' dBFS' : '') + (b.clipsPerHour ? ', ' + b.clipsPerHour + ' clips an hour' : '') + '.']);
    if (m.roomDb != null) out.facts.push(['ROOM', Math.round(m.roomDb) + ' dB', false, "a HARD STOP panel's mic" + (b.roomPeak != null ? '; tonight\'s peak ' + Math.round(b.roomPeak) + ' dB' : '') + '.']);
    else if (b.roomPeak != null) out.facts.push(['ROOM PEAK', Math.round(b.roomPeak) + ' dB', true, "a HARD STOP panel's mic, tonight."]);
    if (b.part && b.parts > 1) out.facts.push(['PART ' + b.part.n, 'since ' + hm(b.part.from), true,
      { silence: 'started after a silence of 30 s or more', tempo: 'the tempo moved and stayed', lineup: "the lineup's set times changed who's on", start: 'the start of the music' }[b.part.why]
      + (b.part.avgBpm != null ? ', ~' + Math.round(b.part.avgBpm) + ' BPM' : '') + (b.part.dj ? ', ' + b.part.dj : '') + '.']);
    const notes = [];
    const dc = s.djCable;
    if (dc && dc.problem) notes.push('No DJ Link (' + dc.head + '): the night is kept by sound.');
    if (b.lastDrop && b.lastDrop.recAt != null) notes.push('Last drop ' + into(b.lastDrop.recAt) + ' into the recording.');
    out.note = notes.join(' ');
    out.night = b.night;
    return out;
  }

  function paint(c, v) {
    c.hidden = !v;
    if (!v) return;
    const sig = JSON.stringify(v);
    if (sig === c._.sig) return;
    c._.sig = sig;
    c._.head.replaceChildren(el('b', null, v.head), el('span', null, v.state));
    c._.facts.replaceChildren(...v.facts.map(([k, x, more, how]) => fact(k, x, more, how, c._.note)));
    if (+(c._.note.dataset.held || 0) > Date.now()) return; // a tapped fact's details stay 15 s
    c._.note.replaceChildren(document.createTextNode(v.note ? v.note + ' ' : ''));
    const a = el('a', null, 'THE NIGHT BY EAR'); a.href = 'endnight.html?night=' + encodeURIComponent(v.night || ''); a.target = '_blank'; a.rel = 'noopener';
    c._.note.append(a);
  }

  function render() {
    const s = S.status;
    let focus = false;
    try { focus = typeof focusDeck === 'function' && !!focusDeck(); } catch (x) { /* no decks */ }
    const v = S.demo ? null : view(s, focus);
    paint(decksCard, v);
    paint(nowCard, v);
    renderHint(s);
  }

  // ---------- VENUE FROM WI-FI ----------
  const line = el('div', 'venue-hint'); line.id = 'venueHintLine'; line.hidden = true; line.setAttribute('role', 'status');
  const eon = document.getElementById('eonReady');
  if (eon) eon.before(line); else document.body.prepend(line);
  let hintSig = '';
  /** The words and buttons for status.venueHint, or null (nothing to ask). Pure enough to test. */
  function hintView(h) {
    if (!h) return null;
    if (h.learn) return { say: 'SAVE Wi-Fi "' + h.learn.ssid + '" FOR ' + h.learn.venue + '? Next time the box knows where it is.',
      buttons: [['SAVE', { learn: true }, 'Save the Wi-Fi "' + h.learn.ssid + '" for ' + h.learn.venue + '?'], ['NOT TONIGHT', { no: true }]] };
    if (!h.ask) return null;
    const hs = h.tonightFrom === 'hardstop' && h.tonight ? ' HARD STOP has ' + h.tonight + '.' : h.tonight ? ' The box has ' + h.tonight + '.' : '';
    if (h.venues.length === 1) return { say: "YOU'RE AT " + h.venues[0] + ' (Wi-Fi "' + h.ssid + '") - SWITCH TONIGHT?' + hs,
      buttons: [['YES, ' + h.venues[0], { id: h.ids[0] }], ['NOT TONIGHT', { no: true }]] };
    return { say: 'WHICH ONE TONIGHT? (Wi-Fi "' + h.ssid + '" is saved for ' + h.venues.length + ' venues.)' + hs,
      buttons: h.venues.map((n, i) => [n, { id: h.ids[i] }]).concat([['NOT TONIGHT', { no: true }]]) };
  }
  function renderHint(s) {
    const v = S.demo ? null : hintView(s && s.venueHint);
    line.hidden = !v;
    if (!v) { hintSig = ''; return; }
    const sig = JSON.stringify(v);
    if (sig === hintSig) return;
    hintSig = sig;
    const btns = v.buttons.map(([label, body, ask]) => {
      const b = el('button', 'mini', label); b.type = 'button';
      b.onclick = async () => {
        if (ask && !confirm(ask)) return;
        let r;
        try { r = await post('/api/venues/wifi-tonight', body); } catch (x) { return; }
        if (r.ok && S.status) { S.status.venueHint = await r.json().catch(() => null); render(); }
        else if (!r.ok && r.status !== 401) { const j = await r.json().catch(() => ({})); line.replaceChildren(el('span', null, "Didn't change: " + glWhy(r.status, j))); hintSig = ''; }
      };
      return b;
    });
    line.replaceChildren(el('span', null, v.say), ...btns);
  }

  // ---------- DISPLAY (THIS PHONE): BPM AS 137 / 136.9 / 136.90 ----------
  const dispRow = document.querySelector('#status .buttons [data-tour]');
  if (dispRow) {
    const b = el('button'); b.type = 'button'; b.dataset.bpmdp = '';
    const label = () => { b.textContent = 'BPM: ' + ['137', '136.9', '136.90'][typeof glBpmDp === 'function' ? glBpmDp() : 1]; };
    b.onclick = () => { const n = ((typeof glBpmDp === 'function' ? glBpmDp() : 1) + 1) % 3; try { localStorage.setItem('gl-bpm-dp', String(n)); } catch (x) { /* private mode */ } label(); };
    b.title = 'How decks show their BPM on this phone. 2 decimals only from the decks; by ear it stays at 1 at most.';
    label();
    dispRow.parentElement.append(b);
  }

  setInterval(render, 1000);
  render();
  return { view, hintView };
})();
