'use strict';
/*
 * MAKE IT EASIER (#87, Nov 19: "improve everything we have now. make it all easier. think about every piece.").
 * One file so it merges cleanly; uses app.js globals (S, $, esc, nights, venues, openNightForm, players, curView,
 * clock, untimed, nightLabel, GOTO, Demo). Text from the network goes in as text (esc / textContent).
 *  - READY FOR TONIGHT (top of STATUS): one verdict - READY, or FIX FIRST and the one thing to do, then anything else
 *    worth a look, each with what to do and a button that goes there. BOOTH CHECK below keeps every detail.
 *  - NO DECKS YET (DECKS, also in the corner window): what to plug in, instead of an empty screen.
 *  - Plan tonight faster: PLAN TONIGHT, NOW's "TAP TO PLAN", the lineup read back as you type, SAME LINEUP AS last
 *    time at this venue, and a new plan never quietly replaces a night that's already planned.
 *  - Laptop keys: R = READY, P = plan tonight (with 1-6, arrows, / from app.js).
 */
const Easy = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let plan = null, planAt = 0;

  async function loadPlan(force) {
    if (!force && Date.now() - planAt < 20000) return;
    planAt = Date.now();
    try { const r = await fetch('/api/plan', { cache: 'no-store' }); if (r.ok) plan = await r.json(); } catch (e) { /* offline: keep it */ }
  }
  const tonight = () => (S.status && S.status.night) || '';
  const tonightPlan = () => (typeof nights !== 'undefined' ? nights : []).find(n => n.date === tonight());

  /** Go to tonight's plan: open it (or a new one for tonight). Asks for the password first when locked. */
  function planTonight() {
    go('#status/nights');
    setTimeout(() => {
      if (!unlocked && !tonightPlan()) pending = $('nightNewBtn'); // the form opens by itself once the password is in
      openNightForm(tonightPlan() || null);
    }, 150);
  }
  const go = h => { if (location.hash === h) showView(); else location.hash = h; };
  /** JOIN VENUE WI-FI NOW (#94): the box looks for the venue's saved Wi-Fi at once (no power pull). */
  async function joinWifi() {
    const r = await post('/api/wifi/join-now', {});
    if (!r.ok) return;
    wifiAsked = Date.now(); readySig = ''; renderReady();
  }
  let wifiAsked = 0;
  const GO = { venue: () => go('#status/venue'), controls: () => go('#status/controls'), plan: planTonight, joinwifi: joinWifi,
    quietend: () => WifiQuiet.end() }; // #104 WI-FI QUIET

  /** What to say about the venue Wi-Fi while the box isn't on it: is a saved name around, or something close to it? */
  function wifiAdvice(s) {
    const near = s.wifiNearby || [], saved = ((s.venue || {}).wifi || []).map(w => w.ssid).filter(Boolean);
    const seen = saved.map(n => near.find(x => x.ssid === n)).filter(Boolean);
    if (seen.length) return { say: '"' + seen[0].ssid + '" is in range (' + seen[0].signal + '%). Tap JOIN: your phone may drop off the GHOST LINK Wi-Fi for a moment; then join "' + seen[0].ssid + '" too and open gl.cold.fyi.', join: true };
    const norm = x => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const n of saved) {
      const k = norm(n), like = near.find(x => { const y = norm(x.ssid); return y && k && (y.includes(k) || k.includes(y) || y.split(' ').some(t => t.length > 1 && k.split(' ').includes(t))); });
      if (like) return { say: 'Saved "' + n + '" isn\'t around, but "' + like.ssid + '" is. Likely the same: VENUE -> EDIT, tap "' + like.ssid + '" under NEARBY, type its password, SAVE. The box tries it at once.', join: false };
    }
    if (saved.length) return { say: 'Saved ' + saved.map(n => '"' + n + '"').join(', ') + (near.length ? ' not in range. Around: ' + near.slice(0, 3).map(x => '"' + x.ssid + '"').join(', ') + '.' : ' not seen yet.') + ' Wrong name? VENUE -> EDIT -> pick it under NEARBY.', join: true };
    return { say: 'On its own hotspot: fine for the crew. For the venue\'s Wi-Fi: VENUE -> EDIT -> + VENUE WI-FI (pick the name under NEARBY).', join: false };
  }

  // ---------- READY FOR TONIGHT ----------
  /** Every check, in the order to fix them: st = fix (stop and fix), look (worth a look), ok, none (not in use). */
  function checks(s) {
    const out = [], add = (k, st, say, go, label) => out.push({ k, st, say, go, label });
    const probs = s.problems || [], prob = re => probs.find(p => re.test(p.title));
    const w = s.wifi || {}, v = s.venue || {}, traffic = !!(s.djLinkTraffic && s.djLinkTraffic.arriving);
    const n = s.players || 0, want = v.players || 0;
    const p = prob(/^Power low/);
    if (p) add('POWER', 'fix', p.fix);
    if (s.cable === false) add('DJ CABLE', 'fix', "Plug the DJ cable: GHOST LINK's network port to the DJ switch, or the mixer's LINK port.");
    else if (s.cable && !s.djAddress) add('DJ CABLE', 'look', 'In, no address yet. It usually sorts itself out within a minute.');
    else if (s.cable) add('DJ CABLE', 'ok', 'IN');
    if (s.link === 'LISTEN_ONLY') add('LISTEN ONLY', 'fix', 'GHOST LINK is quiet on the DJ network: decks show BPM only. Tap REJOIN when you want titles back.', 'controls', 'REJOIN');
    else if (s.link === 'BACKED_OFF') add('BACKED OFF', 'look', 'Another device used our number. GHOST LINK comes back on a free one by itself in about 30 s.');
    if (s.cable !== false && s.link !== 'LISTEN_ONLY') {
      if (!traffic && (s.uptimeSeconds || 0) > 15) add('DJ NETWORK', 'fix', "Nothing on the DJ network is talking. Players on? In LINK mode, not USB to a laptop? Cable on the switch the players use?");
      else if (traffic && !n) add('PLAYERS', 'fix', 'None yet. Turn the players on: they show up within seconds.');
      else if (n && want && n < want) add('PLAYERS', 'look', 'Seeing ' + n + ' of ' + want + '. One is off, in laptop mode, or its cable is out of the switch.');
      else if (n) add('PLAYERS', 'ok', String(n));
    }
    const dup = prob(/^Two players/);
    if (dup) add('PLAYER NUMBERS', 'fix', dup.fix);
    add('CLOCK', s.clockOk ? 'ok' : 'look', s.clockOk ? 'OK' : 'Not confirmed yet. Keep this page open a few seconds on a phone with the right time.');
    if (!v.name) add('VENUE', 'look', 'None set. VENUE -> NEW: the box remembers its Wi-Fi, gear and contacts for next time.', 'venue', 'VENUE');
    else if (!s.venueOk) add('VENUE', 'look', 'Still ' + v.name + '? Change it under VENUE if not.', 'venue', 'VENUE');
    else add('VENUE', 'ok', v.name);
    if (s.wifiQuiet && typeof WifiQuiet !== 'undefined') add('WI-FI', 'look', WifiQuiet.say(s), 'quietend', s.wifiQuiet.kind === 'off' ? 'WI-FI BACK ON' : 'BACK ON THEIR WI-FI'); // #104
    else if (typeof WifiQuiet !== 'undefined' && WifiQuiet.afterLine && WifiQuiet.afterLine(s)) add('WI-FI', 'look', WifiQuiet.afterLine(s)); // #134: just ended, no JOIN NOW
    else if (w.state === 'hotspot' || w.state === 'none') {
      const a = wifiAdvice(s);
      // #134: JOIN VENUE WI-FI NOW only when it would really do something: on its hotspot, a saved venue Wi-Fi, not in
      // the minute after STAND BY ended. Off Wi-Fi ('none') the box is already retrying every 15 s by itself.
      const join = a.join && (typeof WifiQuiet === 'undefined' || !WifiQuiet.canJoin || WifiQuiet.canJoin(s));
      if (Date.now() - wifiAsked < 60000) add('WI-FI', 'look', 'Looking for the venue Wi-Fi now (up to a minute). If it joins, this phone loses the GHOST LINK Wi-Fi: join the venue Wi-Fi and open gl.cold.fyi.');
      else if (w.state === 'none') add('WI-FI', 'look', 'Not on Wi-Fi yet: looking for saved Wi-Fi by itself every 15 s. ' + (a.join ? '' : a.say), a.join ? null : 'venue', a.join ? null : 'VENUE WI-FI');
      else add('WI-FI', 'look', 'On its own hotspot. ' + (join || !a.join ? a.say : 'Saved venue Wi-Fi has no password: VENUE -> EDIT, type it, SAVE (the box tries it at once).'), join ? 'joinwifi' : 'venue', join ? 'JOIN VENUE WI-FI NOW' : 'VENUE WI-FI');
    }
    else if (w.ssid) add('WI-FI', 'ok', w.ssid);
    const lineup = plan && plan.lineup && plan.lineup.length;
    if (!lineup && !s.dj) add('LINEUP', 'look', 'Nothing planned tonight. PLAN TONIGHT: set times switch ON THE DECKS by themselves.', 'plan', 'PLAN TONIGHT');
    else add('LINEUP', 'ok', lineup ? plan.lineup.length + (plan.lineup.length === 1 ? ' SET' : ' SETS') + (plan.lineupFrom === 'hardstop' ? ' FROM HARD STOP' : '') : 'ON THE DECKS: ' + s.dj);
    if (plan && plan.musicOff) add('MUSIC OFF', 'ok', plan.musicOff + (plan.musicOffFrom === 'hardstop' ? ' FROM HARD STOP' : ''));
    else add('MUSIC OFF', 'none', 'No time tonight. Add it to tonight\'s plan if the venue has one.', 'plan', 'PLAN TONIGHT');
    add('HARD STOP', s.hardstopAt ? 'ok' : 'none', s.hardstopAt ? 'TIMES AT ' + clock(s.hardstopAt) : 'Not heard from tonight (only if you use it).');
    const a = s.audio || {};
    add('SOUND IN', a.card ? 'ok' : 'none', a.card ? (a.recordOn ? 'RECORDING' : 'CARD IN') : 'No sound card (only needed to record sets).');
    if (n && !(S.devices || []).some(d => d.kind === 'MIXER')) add('MIXER', 'look', "Fine to play. For ON AIR, cable the mixer's LINK port to the same switch.");
    for (const re of [/^Storage almost full/, /^The box is hot/, /^Power dipped/, /^Player updates are thin/]) { const q = prob(re); if (q) add(q.title.toUpperCase(), 'look', q.fix); }
    // #115 SELF-CHECK: the card and memory lines (storage, heat and clock have their own lines above).
    // #116: a card that won't save while music is on air is a calm LOOK, not FIX FIRST: nothing is lost yet, and the
    // fix (a restart, a new card) must wait for the end of the set. Pulling the power is the one thing that loses it.
    const live = liveNow(s);
    for (const i of ((s.selfCheck && s.selfCheck.items) || [])) if ((i.k === 'CARD' || i.k === 'MEMORY') && i.st !== 'ok') {
      if (i.k === 'CARD' && i.st === 'fix' && live) add('CARD', 'look', "CARD WON'T SAVE · nothing lost yet · deal with it after this set, don't pull the power");
      else add(i.k, i.st, i.say);
    }
    if (s.blackboxGap) add('BLACK BOX', 'look', "Can't write to the card right now: it keeps the last lines in memory and catches up by itself.");
    else if (!s.blackbox) add('BLACK BOX', 'look', 'Not writing. RESTART the box after the night if it stays like this.');
    return out;
  }

  /** #116: music on air right now: a deck on air and playing, or a set being recorded (a laptop DJ on the sound card). */
  function liveNow(s) {
    const decks = (typeof S !== 'undefined' && S.decks) ? Object.values(S.decks) : [];
    return decks.some(d => d && d.onAir && d.playing) || !!(s && s.audio && s.audio.recording);
  }

  const box = $('ready') || el('div', 'ready'); // index.html: top of STATUS, before GO TO
  let readySig = '';
  function renderReady() {
    const s = S.status;
    if (!s || $('status').hidden) return;
    const all = checks(s);
    const fix = all.filter(c => c.st === 'fix'), look = all.filter(c => c.st === 'look');
    const sig = JSON.stringify(all);
    if (sig === readySig) return;
    readySig = sig;
    box.className = 'ready ' + (fix.length ? 'fix' : look.length ? 'look' : 'ok');
    box.textContent = '';
    const head = el('div', 'rd-head');
    head.append(el('b', null, fix.length ? 'FIX FIRST: ' + fix[0].k : 'READY FOR TONIGHT'),
      el('span', null, fix.length ? (fix.length + look.length > 1 ? ' · ' + (fix.length + look.length - 1) + ' MORE BELOW' : '')
        : look.length ? ' · ' + look.length + ' TO LOOK AT' : ' · EVERYTHING CHECKS OUT'));
    box.append(head);
    const list = el('ul', 'rd-list');
    [...fix, ...look].forEach((c, i) => {
      const li = el('li', 'rd-' + c.st + (i === 0 && fix.length ? ' first' : ''));
      li.append(el('b', null, c.k), el('span', null, c.say));
      if (c.go && GO[c.go]) { const b = el('button', 'mini', c.label || 'GO'); b.type = 'button'; b.onclick = GO[c.go]; li.append(b); }
      list.append(li);
    });
    if (list.children.length) box.append(list);
    const ok = all.filter(c => c.st === 'ok').map(c => c.k);
    if (ok.length) box.append(el('div', 'rd-ok', 'OK: ' + ok.join(' · ')));
  }

  // ---------- NO DECKS YET ----------
  const empty = el('div', 'deck-empty');
  empty.hidden = true;
  const bar = document.querySelector('#decks .deckbar');
  if (bar) bar.after(empty);
  let emptySig = '';
  function renderEmpty() {
    const s = S.status;
    const show = !!s && !S.demo && players().length === 0;
    empty.hidden = !show;
    if (!show) return;
    const traffic = !!(s.djLinkTraffic && s.djLinkTraffic.arriving);
    const say = s.cable === false ? "Plug the DJ cable: GHOST LINK's network port to the DJ switch, or the mixer's LINK port."
      : s.link === 'LISTEN_ONLY' ? 'LISTEN ONLY is on. STATUS -> CONTROLS -> REJOIN to see the decks.'
      : traffic ? 'Something is talking on the DJ network. Turn the players on: they show up within seconds.'
      : 'Turn the players on and cable them to the same switch as GHOST LINK. Players in LINK mode, not USB to a laptop.';
    if (say === emptySig) return;
    emptySig = say;
    empty.textContent = '';
    const demo = el('button', 'mini', 'SEE A DEMO'); demo.type = 'button';
    demo.onclick = () => { if (typeof Demo !== 'undefined') Demo.start(); };
    empty.append(el('b', null, 'NO DECKS YET'), el('span', null, say), demo);
  }

  // ---------- plan tonight faster ----------
  const newBtn = $('nightNewBtn');
  function renderPlanBtn() {
    if (newBtn) newBtn.textContent = tonightPlan() || !tonight() ? 'PLAN A NIGHT' : 'PLAN TONIGHT';
  }
  // Tonight already planned: a new plan starts on the next free night, not on top of tonight's.
  if (newBtn) newBtn.addEventListener('click', () => {
    if (!tonightPlan() || $('nightForm').hidden) return;
    const d = new Date(tonight() + 'T12:00:00');
    for (let i = 0; i < 60; i++) {
      d.setDate(d.getDate() + 1);
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!nights.some(n => n.date === iso)) { $('nDate').value = iso; break; }
    }
    formChanged();
  });
  // Saving a new plan over a night that's already planned asks first (EDIT on that night changes it in place).
  document.addEventListener('submit', e => {
    if (e.target.id !== 'nightForm' || $('nDate').disabled) return;
    const d = $('nDate').value;
    if (nights.some(n => n.date === d) && !confirm(nightLabel(d) + ' is already planned. Replace that plan with this one?')) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
  // NOW: "NO SET TIMES TONIGHT · TAP TO PLAN" goes straight to tonight's plan.
  document.addEventListener('click', e => {
    const t = e.target.closest('.n-set-end');
    if (t && /TAP TO PLAN/.test(t.textContent)) planTonight();
  });

  // The lineup read back as you type: each line's time and name, the way the box will save it.
  const lineupBox = $('nLineup');
  const preview = el('div', 'note lineup-read');
  const same = el('button', 'mini lineup-same'); same.type = 'button'; same.hidden = true;
  if (lineupBox) lineupBox.after(preview, same);
  let readFor = null, readTimer = 0;
  async function readLineup() {
    const text = lineupBox.value;
    if (text === readFor) return;
    readFor = text;
    if (!text.trim()) { preview.textContent = ''; return; }
    let j;
    try { j = await (await fetch('/api/schedule/parse?lineup=' + encodeURIComponent(text), { cache: 'no-store' })).json(); }
    catch (e) { return; }
    if (text !== lineupBox.value) return; // typed on meanwhile
    preview.textContent = '';
    preview.classList.toggle('warn', !!j.error);
    if (j.error) { preview.textContent = j.error + ' Times look like 22:00, 10pm or 10-11pm.'; return; }
    preview.append(el('small', null, 'READS AS '));
    j.lineup.forEach((s, i) => {
      if (i) preview.append(document.createTextNode(' · '));
      const odd = untimed(s) && /\d/.test(s.dj);
      const b = el('b', odd ? 'odd' : null, (untimed(s) ? 'ALL NIGHT ' : s.start + ' ') + s.dj);
      if (odd) b.title = 'No time found on this line';
      preview.append(b);
    });
    if (j.lineup.some(s => untimed(s) && /\d/.test(s.dj))) preview.append(el('div', 'odd', 'A line has no time GHOST LINK can read: put the time first, like 22:00 NAME.'));
  }
  if (lineupBox) lineupBox.addEventListener('input', () => { clearTimeout(readTimer); readTimer = setTimeout(readLineup, 300); });

  /** SAME LINEUP AS <last night at this venue>: residencies don't retype the whole lineup. New plans only. */
  function formChanged() {
    if (!lineupBox) return;
    const date = $('nDate').value, ven = $('nVenue').value;
    const last = $('nDate').disabled || !ven ? null
      : nights.filter(n => n.venue === ven && n.date < date && n.lineup.length).sort((a, b) => a.date < b.date ? 1 : -1)[0];
    same.hidden = !last;
    if (!last) return;
    same.textContent = 'SAME LINEUP AS ' + nightLabel(last.date);
    same.onclick = () => {
      lineupBox.value = last.lineup.map(s => (untimed(s) ? '' : s.start + ' ') + s.dj).join('\n');
      if (!$('nDoors').value && last.doors) $('nDoors').value = last.doors;
      if (!$('nOff').value && last.musicOff) $('nOff').value = last.musicOff;
      readLineup();
    };
  }
  ['nDate', 'nVenue'].forEach(id => $(id) && $(id).addEventListener('change', formChanged));
  let formWasOpen = false;

  // ---------- GO TO + laptop keys ----------
  if (typeof GOTO !== 'undefined') {
    GOTO.unshift(['READY FOR TONIGHT · the one thing to fix', 'status', 'ready tonight check fix doors setup ok start']);
    GOTO.push(['PLAN TONIGHT · lineup, set times, music off', 'status/nights', 'plan tonight lineup set times add show night quick']);
  }
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!$('share').hidden || !$('tour').hidden) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { e.preventDefault(); go('#status'); } // READY is the top of STATUS: open it with the tabs in view
    else if (k === 'p') { e.preventDefault(); planTonight(); }
  });

  function tick() {
    try {
      if (!$('status').hidden) loadPlan();
      renderReady(); renderEmpty(); renderPlanBtn();
      const open = !$('nightForm').hidden;
      if (open && !formWasOpen) { readFor = null; readLineup(); formChanged(); }
      formWasOpen = open;
    } catch (e) { /* the helpers must never break the dashboard */ }
  }
  addEventListener('hashchange', () => { if (curView() === 'status') { readySig = ''; loadPlan(true).then(tick); } });
  setInterval(tick, 1000);
  setTimeout(() => { loadPlan(true).then(tick); }, 300);
  return { checks, planTonight, liveNow, renderReady };
})();
