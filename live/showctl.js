// SHOW CONTROL (DECISIONS #60, #64): Ableton Link, MIDI clock, and ready-made OSC for RESOLUME / GRANDMA3 / QLAB /
// MADMAPPER / CHAMSYS MAGICQ / MILLUMIN / SYNESTHESIA / TOUCHDESIGNER.
// Loaded after app.js; uses its globals: $, esc, post(), unlocked, pending, needUnlock(), note().
// One row per output: a big ON / OFF, a dot that's filled while it sends, and a TEST for the OSC ones.
(() => {
  if (!$('scRows')) return;
  const ROWS = [
    { k: 'link', name: 'ABLETON LINK', help: 'For Resolume, Ableton Live, Traktor, VJ and lighting apps with Link. Turn Link on in the app too; it follows the DJ\'s tempo and bar. Same Wi-Fi as the box.' },
    { k: 'midi', name: 'MIDI CLOCK', help: 'A USB MIDI interface in the box\'s USB port, its MIDI OUT to the desk\'s MIDI IN. Starts on the DJ\'s "1". Never sent to a Pioneer mixer or deck.' },
    { k: 'resolume', name: 'RESOLUME', osc: true, help: 'Resolume Arena / Avenue 7: Preferences > OSC > turn on OSC Input (port 7000). Sends the tempo and a resync once a phrase (every 8 bars). Optional: launch a column on the drop or on a new track. With ABLETON LINK on, Link sets the tempo and this row only fires the columns, so both can be on.',
      fields: [['host', 'COMPUTER ADDRESS', 'text', '192.168.1.20'], ['port', 'PORT', 'number'], ['dropColumn', 'COLUMN ON THE DROP (0 = OFF)', 'number'], ['trackColumn', 'COLUMN ON A NEW TRACK (0 = OFF)', 'number']] },
    { k: 'grandma3', name: 'GRANDMA3', osc: true, help: 'In MA: Menu > In & Out > OSC: Enable Input, a line with this box\'s port, Receive Command = Yes. Sets a speed master to the DJ\'s BPM. Optional: Go+ an executor on the drop.',
      fields: [['host', 'CONSOLE / ONPC ADDRESS', 'text', '192.168.1.30'], ['port', 'PORT (SAME AS IN MA)', 'number'], ['prefix', 'PREFIX (IF SET IN MA)', 'text', 'none'], ['master', 'SPEED MASTER 3.', 'number'], ['exec', 'GO+ EXEC ON THE DROP', 'text', 'off']] },
    { k: 'qlab', name: 'QLAB', osc: true, help: 'QLab 5 (port 53000). Number your cues "drop" (one bar before the chorus), "track" (a new track on air) and "test". Workspace Settings > Network: give this box a passcode with Control.',
      fields: [['host', 'COMPUTER ADDRESS', 'text', '192.168.1.40'], ['port', 'PORT', 'number'], ['passcode', 'PASSCODE (4 DIGITS)', 'password', '']] },
    // #64: more presets, each from the maker's own docs (DECISIONS #64).
    { k: 'madmapper', name: 'MADMAPPER', osc: true, help: 'MadMapper: Preferences > OSC / MIDI, turn on OSC input (usually port 8000). Sets the Global BPM to the DJ\'s tempo and resyncs it on every bar. If MadMapper follows ABLETON LINK above, leave this off.',
      fields: [['host', 'COMPUTER ADDRESS', 'text', '192.168.1.20'], ['port', 'PORT', 'number']] },
    { k: 'magicq', name: 'CHAMSYS MAGICQ', osc: true, help: 'MagicQ (unlocked PC or console, not MQ40): in its network settings turn OSC on with OSC Rx Port 8000 (or type yours). Goes a playback on the drop and / or on a new track. MagicQ takes no tempo over OSC: use MIDI CLOCK for that. TEST goes the drop playback.',
      fields: [['host', 'CONSOLE / PC ADDRESS', 'text', '192.168.1.30'], ['port', 'OSC RX PORT', 'number'], ['dropColumn', 'PLAYBACK ON THE DROP (0 = OFF)', 'number'], ['trackColumn', 'PLAYBACK ON A NEW TRACK (0 = OFF)', 'number']] },
    { k: 'millumin', name: 'MILLUMIN', osc: true, help: 'Millumin: add an OSC input in its Devices panel and type the same port here. Launches a column on the drop and / or on a new track. TEST sends a ping (Millumin answers on its own OSC out). For tempo use ABLETON LINK.',
      fields: [['host', 'COMPUTER ADDRESS', 'text', '192.168.1.20'], ['port', 'PORT (SAME AS IN MILLUMIN)', 'number'], ['dropColumn', 'COLUMN ON THE DROP (0 = OFF)', 'number'], ['trackColumn', 'COLUMN ON A NEW TRACK (0 = OFF)', 'number']] },
    { k: 'synesthesia', name: 'SYNESTHESIA', osc: true, help: 'Synesthesia: turn on OSC input in its settings and type the same port here. Changes scene on the drop (the scene name in lower case, no spaces) and / or goes to the next playlist scene on a new track. For tempo use ABLETON LINK.',
      fields: [['host', 'COMPUTER ADDRESS', 'text', '192.168.1.20'], ['port', 'PORT (SAME AS IN SYNESTHESIA)', 'number'], ['scene', 'SCENE ON THE DROP', 'text', 'off'], ['trackColumn', 'NEXT SCENE ON A NEW TRACK', 'check']] },
    { k: 'touchdesigner', name: 'TOUCHDESIGNER', osc: true, help: 'An OSC In CHOP (or DAT) on the port you type here. One number per message: /gl/bpm, /gl/beat (1-4, every beat), /gl/downbeat, /gl/drop and /gl/track (1 then 0, good for Pulse mode). The prefix is yours to change.',
      fields: [['host', 'COMPUTER ADDRESS', 'text', '192.168.1.20'], ['port', 'PORT (SAME AS THE CHOP)', 'number'], ['prefix', 'PREFIX', 'text', 'gl']] },
  ];
  // SHOW CUES (#88): one more cue at a CREW CALL's GO and at MUSIC OFF, per app. Blank = off (the default).
  const CUES = {
    resolume: [['crewCue', 'COLUMN ON A CREW CALL GO (BLANK = OFF)', 'text', 'off'], ['offCue', 'COLUMN AT MUSIC OFF (BLANK = OFF)', 'text', 'off']],
    grandma3: [['crewCue', 'GO+ EXEC ON A CREW CALL GO', 'text', 'off'], ['offCue', 'GO+ EXEC AT MUSIC OFF', 'text', 'off']],
    qlab: [['crewCue', 'CUE NUMBER ON A CREW CALL GO', 'text', 'off (e.g. crew)'], ['offCue', 'CUE NUMBER AT MUSIC OFF', 'text', 'off (e.g. musicoff)']],
    magicq: [['crewCue', 'PLAYBACK ON A CREW CALL GO', 'text', 'off'], ['offCue', 'PLAYBACK AT MUSIC OFF', 'text', 'off']],
    millumin: [['crewCue', 'COLUMN ON A CREW CALL GO', 'text', 'off'], ['offCue', 'COLUMN AT MUSIC OFF', 'text', 'off']],
    synesthesia: [['crewCue', 'SCENE ON A CREW CALL GO', 'text', 'off'], ['offCue', 'SCENE AT MUSIC OFF', 'text', 'off']],
    touchdesigner: [['crewCue', '/GL/CREW ON A CREW CALL GO', 'check'], ['offCue', '/GL/MUSICOFF AT MUSIC OFF', 'check']],
  };
  ROWS.forEach(r => { if (CUES[r.k]) r.fields = r.fields.concat(CUES[r.k]); });
  let S = null;
  const ago = t => t ? Math.round((Date.now() - t) / 1000) : null;

  $('scRows').innerHTML = ROWS.map(r => `
    <div class="sc-row" data-sc="${r.k}">
      <div class="sc-head">
        <div class="sc-name"><span class="sc-dot" data-dot></span>${r.name}<small data-state>OFF</small></div>
        ${r.osc ? '<button type="button" data-open aria-expanded="false">SET UP</button><button type="button" data-test>TEST</button>' : ''}
        <button type="button" class="sc-power" data-power>TURN ON</button>
      </div>
      <div data-body ${r.osc ? 'hidden' : ''}>
      ${r.k === 'midi' ? '<div class="sc-fields"><label>MIDI INTERFACE<select data-f="midiDevice"></select></label></div>' : ''}
      ${r.fields ? `<div class="sc-fields">${r.fields.map(([f, l, type, ph]) =>
        type === 'check' ? `<label>${l}<input data-f="${f}" type="checkbox"></label>` :
        `<label>${l}<input data-f="${f}" type="${type}" ${ph !== undefined ? `placeholder="${esc(ph)}"` : ''} autocomplete="off" ${type === 'number' ? 'inputmode="numeric"' : ''}></label>`).join('')}</div>
      <div class="buttons"><button type="button" data-save>SAVE</button></div>` : ''}
      <div class="note">${esc(r.help)}</div>
      </div>
      <div class="note" data-note></div>
    </div>`).join('');
  // OSC presets that aren't set up stay folded (eight of them is a lot on a phone): SET UP opens one. One that's on
  // or has an address opens by itself the first time the settings arrive.
  let unfolded = false;
  function fold(k, open) {
    const el = row(k), b = el.querySelector('[data-open]');
    el.querySelector('[data-body]').hidden = !open;
    if (b) { b.setAttribute('aria-expanded', open); b.textContent = open ? 'CLOSE' : 'SET UP'; }
  }

  function row(k) { return document.querySelector(`[data-sc="${k}"]`); }
  function isOn(k) {
    if (!S) return false;
    return k === 'link' ? S.link.on : k === 'midi' ? S.midi.on : S.targets[k].on;
  }
  function fieldsOf(k) {
    const o = {};
    row(k).querySelectorAll('input[data-f]').forEach(i => {
      if (i.dataset.f === 'passcode' && i.value === '') return; // empty = keep the saved one
      if (i.type === 'checkbox') { o[i.dataset.f] = i.checked ? 1 : 0; return; }
      o[i.dataset.f] = i.type === 'number' ? Number(i.value || 0) : i.value.trim();
    });
    return o;
  }
  async function change(k, body, btn, msg) {
    if (!unlocked) { pending = btn; return needUnlock(); }
    const r = await post('/api/showctl', body);
    const j = await r.json().catch(() => ({}));
    const n = row(k).querySelector('[data-note]');
    n.textContent = r.ok ? msg : (j.error || 'Not saved.');
    n.classList.toggle('warn', !r.ok);
    if (!r.ok && row(k).querySelector('[data-open]')) fold(k, true); // e.g. "type the address first": show the boxes
    if (r.ok) { S = j; render(true); }
  }

  ROWS.forEach(r => {
    const el = row(r.k);
    el.querySelector('[data-power]').addEventListener('click', e => {
      const on = !isOn(r.k);
      let body;
      if (r.k === 'link') body = { link: on };
      else if (r.k === 'midi') body = { midi: on, midiDevice: el.querySelector('[data-f="midiDevice"]').value || 'auto' };
      else body = { targets: { [r.k]: Object.assign(fieldsOf(r.k), { on }) } };
      change(r.k, body, e.currentTarget, on ? r.name + ' is on.' : r.name + ' is off.');
    });
    const open = el.querySelector('[data-open]');
    if (open) open.addEventListener('click', () => fold(r.k, el.querySelector('[data-body]').hidden));
    const save = el.querySelector('[data-save]');
    if (save) save.addEventListener('click', e => change(r.k, { targets: { [r.k]: fieldsOf(r.k) } }, e.currentTarget, 'Saved.'));
    const sel = el.querySelector('[data-f="midiDevice"]');
    if (sel) sel.addEventListener('change', e => change('midi', { midiDevice: sel.value }, e.currentTarget, 'Saved.'));
    const test = el.querySelector('[data-test]');
    if (test) test.addEventListener('click', async e => {
      const btn = e.currentTarget;
      if (!unlocked) { pending = btn; return needUnlock(); }
      // Save what's typed first so TEST goes where the screen says.
      const s = await post('/api/showctl', { targets: { [r.k]: fieldsOf(r.k) } });
      const n = el.querySelector('[data-note]');
      if (!s.ok) { const j = await s.json().catch(() => ({})); n.textContent = j.error || 'Not saved.'; n.classList.add('warn'); return; }
      S = await s.json();
      const t = await post('/api/showctl/test', { target: r.k });
      const j = await t.json().catch(() => ({}));
      n.textContent = t.ok ? 'Sent: ' + (j.sent || []).join(' · ') : (j.error || 'Not sent.');
      n.classList.toggle('warn', !t.ok);
      render(true);
    });
  });

  function state(k) {
    if (k === 'link') {
      const l = S.link;
      if (l.included === false) return ['NOT IN THIS BUILD', false, false];
      if (!l.on) return ['OFF', false, false];
      if (l.problem) return [l.problem, false, true];
      if (!l.peers) return ['ON · looking for Link apps on the network', false, false];
      return [`ON · ${l.peers} app${l.peers === 1 ? '' : 's'} locked · ${l.sessionBpm.toFixed(1)} BPM`, true, false];
    }
    if (k === 'midi') {
      const m = S.midi;
      if (!m.on) return ['OFF', false, false];
      if (m.problem) return ['ON · ' + m.problem, false, true];
      return [`ON · ${m.port || 'MIDI'} · ${S.bpm ? S.bpm.toFixed(1) + ' BPM' : ''}${m.sending ? ' · SENDING' : ''}`, m.sending, false];
    }
    const t = S.targets[k];
    if (!t.on) return [t.host ? 'OFF · ' + t.host + ':' + t.port : 'OFF', false, false];
    const a = ago(t.lastSend);
    return [`ON · ${t.host}:${t.port}${t.sending ? ' · SENDING' : a != null ? ' · last sent ' + a + ' s ago' : ' · waiting for music'}`, t.sending, false];
  }

  function render(force) {
    if (!S) return;
    if (!unfolded) {
      unfolded = true;
      ROWS.forEach(r => { if (r.osc && S.targets[r.k] && (S.targets[r.k].on || S.targets[r.k].host)) fold(r.k, true); });
    }
    ROWS.forEach(r => {
      const el = row(r.k);
      const [text, live, warn] = state(r.k);
      el.querySelector('[data-state]').textContent = text;
      el.querySelector('[data-dot]').classList.toggle('live', live);
      el.querySelector('[data-dot]').classList.toggle('warn', warn);
      const p = el.querySelector('[data-power]');
      p.textContent = isOn(r.k) ? 'ON' : 'OFF';
      p.classList.toggle('on', isOn(r.k));
      p.setAttribute('aria-pressed', isOn(r.k));
      if (r.fields) {
        const t = S.targets[r.k];
        el.querySelectorAll('input[data-f]').forEach(i => {
          if (document.activeElement === i || (!force && i.dataset.touched)) return;
          delete i.dataset.touched;
          const v = t[i.dataset.f];
          if (i.dataset.f === 'passcode') { i.value = ''; i.placeholder = v ? 'saved (type to change)' : 'none'; return; }
          if (i.type === 'checkbox') { i.checked = v === 1 || v === '1'; return; }
          // 0 shows as blank (port 0 = not typed yet; columns / playbacks 0 = off), except MA's speed master.
          i.value = (i.type === 'number' && (v === 0 || v === undefined) && i.dataset.f !== 'master') ? '' : (v ?? '');
        });
      }
      if (r.k === 'midi') {
        const sel = el.querySelector('[data-f="midiDevice"]');
        const opts = [['auto', 'FIRST ONE PLUGGED IN', false]].concat(S.midi.devices.map(d => [d.id, d.name + (d.excluded ? ' (Pioneer: never)' : ''), d.excluded]));
        const html = opts.map(([v, n, x]) => `<option value="${esc(v)}" ${x ? 'disabled' : ''}>${esc(n)}</option>`).join('');
        if (sel.dataset.html !== html && document.activeElement !== sel) { sel.innerHTML = html; sel.dataset.html = html; }
        if (document.activeElement !== sel) sel.value = S.midi.device;
      }
    });
  }

  document.addEventListener('input', e => { if (e.target.closest && e.target.closest('.sc-row')) e.target.dataset.touched = '1'; });

  async function load() {
    try {
      const r = await fetch('/api/showctl');
      if (r.ok) { S = await r.json(); render(false); }
    } catch (e) { /* offline */ }
  }
  load();
  // Quick while STATUS is on screen (the SENDING dots), slow otherwise.
  setInterval(() => {
    if (document.hidden) return;
    if ($('showctl').offsetParent !== null) load();
  }, 1500);
})();
