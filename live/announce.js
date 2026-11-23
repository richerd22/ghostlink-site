'use strict';
// ANNOUNCEMENTS (STATUS -> TONIGHT, DECISIONS #96; GHOST DECK way B). The box plays a saved announcement ("LAST CALL",
// "LIGHTS ON IN 10") or a 1 kHz TEST TONE out of the USB sound card's OUTPUT into a spare mixer channel.
// - Off until the owner turns it on (owner password). Nothing new shows on DECKS / NOW unless something is playing.
// - PLAY and TEST TONE: crew code or owner, tap then hold 1 s (like DECK CONTROLS). One at a time.
// - STOP: anyone here, any view, while something plays (the bar under the header).
// - Adding one: record here (where the browser allows the microphone) or upload a voice memo / file. The page
//   decodes it, makes it 48 kHz 16-bit mono WAV, trims the silence at the ends, evens the level, max 30 s; the box
//   checks it again.
// Names go into the page as text only. Own file: if anything here throws, the rest of the dashboard carries on.
const Announce = (() => {
  const MAX_SECS = 120, RATE = 48000; // #100: 2 minutes a sound
  let kind = 'pa';
  let items = [], itemsSig = '', listAt = 0, wavBlob = null, previewUrl = null, rec = null, playingAudio = null;
  const A = () => S.status && S.status.announce;
  const boxNow = () => Date.now() - (S.skew || 0);
  const secs = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // The STOP bar on every view, only while the box is playing something (which only happens once switched on).
  const bar = document.createElement('div');
  bar.className = 'alert ann-bar local-only'; bar.id = 'annBar'; bar.hidden = true;
  const barText = document.createElement('span');
  const barStop = document.createElement('button');
  barStop.type = 'button'; barStop.className = 'mini'; barStop.textContent = '■ STOP';
  bar.append(barText, barStop);
  ($('curfewBar') || $('link')).insertAdjacentElement('afterend', bar);

  async function stop() {
    const r = await fetch('/api/announce/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    note('annNote', j.text || (r && r.ok ? 'Stopped.' : 'Not sent.'), !(r && r.ok));
  }
  barStop.addEventListener('click', stop);
  $('annStop').addEventListener('click', stop);

  // #101: who started it, when it wasn't someone on this board: "PA: LAST CALL · by MAIN BAR panel".
  function byText(p) {
    if (!p.by || !p.byKind || p.byKind === 'box') return '';
    return ' · by ' + (p.byKind === 'panel' ? p.by + ' panel' : p.byKind === 'link' ? 'link "' + p.by + '"'
      : p.byKind === 'auto' ? 'AUTO CALL' : p.byKind === 'app' ? 'HARD STOP app' : p.by);
  }
  function playingText(p) {
    const away = p.byKind && p.byKind !== 'box';
    return '▶ ' + (p.tone ? 'TEST TONE' : (away ? 'PA: ' : 'ANNOUNCEMENT · ') + p.name) + byText(p) + ' · ' + secs((boxNow() - p.since) / 1000) + ' / ' + secs(p.secs);
  }
  function tick() {
    const a = A(), p = a && a.playing;
    bar.hidden = !p;
    $('annNow').hidden = !p;
    if (!p) return;
    barText.textContent = playingText(p);
    $('annNowText').textContent = playingText(p);
  }
  setInterval(() => { try { if (A() && A().playing) tick(); } catch (e) {} }, 500);

  function render() {
    const a = A();
    const sect = $('go-announce'); // STATUS folds each section into a <details id="go-<k>">
    // demo / WATCH FROM HOME: no box behind it. #100: and only while a sound card's output is plugged in.
    if (sect) sect.hidden = !a || !a.card;
    $('annBox').hidden = !a || !a.card;
    if ($('sbNoCard')) $('sbNoCard').hidden = !a || !!a.card;
    tick();
    if (!a) return;
    $('annToggle').textContent = a.on ? 'TURN OFF' : 'TURN ON';
    $('annToggle').classList.toggle('on', !!a.on);
    $('annBody').hidden = !a.on;
    $('annCard').hidden = !a.on || !!a.card;
    if (a.on && !a.card) $('annCard').textContent = "No sound card output. Plug the UCA222 (or UCA202)'s USB into the box, then its OUTPUT (RCA) into a spare LINE channel or the AUX / booth input on the mixer.";
    $('annTone').disabled = !a.card || !!a.playing;
    if (a.on && !$('status').hidden && (!sect || sect.open) && Date.now() - listAt > 20000) loadList();
  }

  async function loadList() {
    listAt = Date.now();
    try {
      const r = await fetch('/api/announce');
      if (!r.ok) return;
      const j = await r.json();
      try { if (window.Soundboard) Soundboard.got(j); } catch (e) {}
      items = (j.builtin || []).concat(j.items || []);
      const sig = JSON.stringify(items.map(i => [i.id, i.name, i.secs])) + '|' + j.used;
      if (sig === itemsSig) return;
      itemsSig = sig;
      drawList(j);
    } catch (e) {}
  }

  function drawList(j) {
    const ul = $('annList');
    ul.textContent = '';
    if (!(j.items || []).length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'None saved yet. ADD AN ANNOUNCEMENT below.';
      ul.appendChild(li);
    }
    items.forEach(it => {
      const li = document.createElement('li');
      const what = document.createElement('span');
      what.className = 'what';
      const b = document.createElement('b'); b.textContent = it.name;
      const sm = document.createElement('small'); sm.textContent = it.secs + ' s';
      what.append(b, sm);
      const acts = document.createElement('span');
      acts.className = 'acts';
      const play = document.createElement('button');
      play.type = 'button'; play.className = 'hold'; play.textContent = 'PLAY';
      holdable(play, () => send('play', { id: it.id }));
      const hear = document.createElement('button');
      hear.type = 'button'; hear.className = 'mini'; hear.textContent = 'LISTEN HERE';
      hear.addEventListener('click', () => listen(it, hear));
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'mini'; del.textContent = 'DELETE';
      del.addEventListener('click', async () => {
        if (!unlocked) { pending = null; return needUnlock(); }
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'SURE? TAP AGAIN'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'DELETE'; }, 3000); return; }
        const r = await post('/api/announce/delete', { id: it.id });
        note('annNote', r.ok ? 'Deleted ' + it.name + '.' : 'Not deleted.', !r.ok);
        listAt = 0; loadList();
      });
      if (it.builtin) { sm.textContent = it.secs + ' s · built in'; acts.append(play, hear); }
      else acts.append(play, hear, del);
      li.append(what, acts);
      ul.appendChild(li);
    });
    if (j && j.maxBytes) { // before #100 (no cap now: the SOUNDBOARD shows the room)
      const li = document.createElement('li');
      li.className = 'room';
      li.textContent = (j.items || []).length + ' of ' + j.maxItems + ' saved · ' + Math.round(j.used / 104857.6) / 10 + ' of ' + Math.round(j.maxBytes / 1048576) + ' MB';
      ul.appendChild(li);
    }
  }

  // Hear it on this phone only (nothing goes to the room). Crew code or owner: it's the venue's sound.
  function listen(it, btn) {
    if (!unlocked) { pending = null; return needUnlock(); }
    if (playingAudio) { playingAudio.pause(); playingAudio = null; btn.textContent = 'LISTEN HERE'; return; }
    playingAudio = new Audio('/api/announce/file?id=' + encodeURIComponent(it.id));
    btn.textContent = 'STOP LISTENING';
    playingAudio.addEventListener('ended', () => { playingAudio = null; btn.textContent = 'LISTEN HERE'; });
    playingAudio.play().catch(() => { playingAudio = null; btn.textContent = 'LISTEN HERE'; });
  }

  async function send(cmd, body) {
    if (!unlocked) { pending = null; return needUnlock(); }
    $('annAsk').hidden = true;
    const r = await post('/api/announce/' + cmd, body || {});
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.ask) {
      $('annAskText').textContent = j.text;
      $('annAsk').hidden = false;
      $('annAskYes').onclick = () => send(cmd, Object.assign({}, body, { over: true }));
      return;
    }
    if (r.status !== 401) note('annNote', j.text || j.error || (r.ok ? 'Playing.' : 'Not played.'), !r.ok);
  }
  $('annAskNo').addEventListener('click', () => { $('annAsk').hidden = true; note('annNote', 'Cancelled.'); });
  holdable($('annTone'), () => send('tone'));

  $('annToggle').addEventListener('click', async () => {
    if (!unlocked) { pending = null; return needUnlock(); }
    const a = A();
    const r = await post('/api/announce', { on: !(a && a.on) });
    if (r.status === 403) note('annNote', "Turning ANNOUNCEMENTS on or off needs the owner's password, not tonight's crew code.", true);
    else if (r.ok) { listAt = 0; itemsSig = ''; }
  });

  // ---------- adding one: record or upload, made into 48 kHz 16-bit mono WAV here ----------
  const canRecord = !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  $('annRec').hidden = !canRecord;
  if (canRecord) $('annHow').textContent = 'Up to 2 minutes each. RECORD here, or PICK FILES: one or several (voice memos, mp3, wav), named from the file names.';
  // #100: what it is on the board. Remembered on this phone; + ADD A SOUND sets it from the tab you're on.
  function setKind(k) {
    if (k) { kind = k; try { localStorage.setItem('annKind', k); } catch (e) {} }
    document.querySelectorAll('#annKind button').forEach(b => { const on = b.dataset.kind === kind; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.setAttribute('role', 'radio'); });
    return kind;
  }
  try { const k = localStorage.getItem('annKind'); if (k === 'sfx' || k === 'pa' || k === 'piece') kind = k; } catch (e) {}
  document.querySelectorAll('#annKind button').forEach(b => b.addEventListener('click', () => setKind(b.dataset.kind)));
  setKind();

  function clearDraft() {
    wavBlob = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    $('annPreview').hidden = $('annSave').hidden = $('annDiscard').hidden = true;
    $('annPreview').removeAttribute('src');
  }
  $('annDiscard').addEventListener('click', () => { clearDraft(); note('annNote', 'Discarded.'); });

  function decode(buf) {
    const C = window.AudioContext || window.webkitAudioContext;
    const ctx = new C();
    return new Promise((ok, no) => {
      let over = false; // older Safari answers by callback, newer browsers by promise (and some both)
      const shut = () => { if (over) return false; over = true; try { const c = ctx.close(); if (c && c.catch) c.catch(() => {}); } catch (e) {} return true; };
      const done = b => { if (shut()) ok(b); };
      const fail = e => { if (shut()) no(e); };
      const p = ctx.decodeAudioData(buf, done, fail);
      if (p && p.then) p.then(done, fail);
    });
  }

  async function convert(buf) {
    const decoded = await decode(buf);
    if (decoded.duration > MAX_SECS + 20) throw new Error("That's " + Math.round(decoded.duration) + ' s. Sounds are 2 minutes at most: trim it first.');
    const O = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new O(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start(0);
    const out = await off.startRendering();
    let d = out.getChannelData(0);
    // trim the quiet at both ends (a voice memo starts with a tap and ends with one), keep 0.1 s each side
    const th = 0.003, pad = RATE / 10;
    let a = 0, b = d.length - 1;
    while (a < b && Math.abs(d[a]) < th) a++;
    while (b > a && Math.abs(d[b]) < th) b--;
    if (b - a < RATE / 5) throw new Error('Nothing to hear in that one. Try again a bit closer to the mic.');
    d = d.subarray(Math.max(0, a - pad), Math.min(d.length, b + pad));
    const len = d.length / RATE;
    if (len > MAX_SECS) throw new Error("That's " + Math.round(len) + ' s. Sounds are 2 minutes at most: trim it first.');
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const gain = Math.min(0.5 / peak, 16); // peaks at -6 dBFS: near the TEST TONE's level, never a blast
    const pcm = new DataView(new ArrayBuffer(44 + d.length * 2));
    const str = (o, s) => { for (let i = 0; i < 4; i++) pcm.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); pcm.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); pcm.setUint32(16, 16, true); pcm.setUint16(20, 1, true); pcm.setUint16(22, 1, true);
    pcm.setUint32(24, RATE, true); pcm.setUint32(28, RATE * 2, true); pcm.setUint16(32, 2, true); pcm.setUint16(34, 16, true);
    str(36, 'data'); pcm.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) pcm.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.round(d[i] * gain * 32767))), true);
    return { blob: new Blob([pcm.buffer], { type: 'audio/wav' }), secs: len };
  }

  async function draft(buf) {
    clearDraft();
    note('annNote', 'Getting it ready…');
    try {
      const c = await convert(buf);
      wavBlob = c.blob;
      previewUrl = URL.createObjectURL(c.blob);
      $('annPreview').src = previewUrl;
      $('annPreview').hidden = $('annSave').hidden = $('annDiscard').hidden = false;
      note('annNote', Math.round(c.secs * 10) / 10 + ' s, ready. Listen, give it a name, then SAVE ON THE BOX.');
    } catch (e) {
      note('annNote', (e && e.message && /\d+ s|Nothing/.test(e.message)) ? e.message
        : "Couldn't read that file. Try a voice memo (m4a), mp3 or wav.", true);
    }
  }

  // #100: several files at once: each is converted here and saved straight away, named from its file name.
  const nameOf = f => f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).toUpperCase();
  async function saveMany(files) {
    if (!unlocked) { pending = null; return needUnlock(); }
    clearDraft();
    let ok = 0;
    const bad = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i], name = nameOf(f) || 'SOUND ' + (i + 1);
      note('annNote', 'Saving ' + (i + 1) + ' of ' + files.length + ': ' + name + '…');
      try {
        if (f.size > 80e6) throw new Error('too big');
        const c = await convert(await f.arrayBuffer());
        const r = await fetch('/api/announce/upload?kind=' + kind + '&name=' + encodeURIComponent(name), { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: c.blob });
        if (r.status === 401) { setUnlocked(false); return needUnlock(); }
        const j = await r.json().catch(() => ({}));
        if (r.ok) ok++; else bad.push(name + ' (' + (j.error || 'not saved') + ')');
      } catch (e) {
        bad.push(name + (e && e.message && /\d+ s|Nothing/.test(e.message) ? ' (' + e.message + ')' : " (couldn't read it)"));
      }
    }
    note('annNote', 'Saved ' + ok + ' of ' + files.length + ' as ' + (kind === 'piece' ? 'PIECES' : kind.toUpperCase()) + '.' + (bad.length ? ' Not saved: ' + bad.join('; ') : ' They are on the board under MINE.'), !!bad.length);
    listAt = 0; loadList();
    try { if (window.Soundboard) Soundboard.refresh(true); } catch (e) {}
  }

  $('annFile').addEventListener('change', async () => {
    const all = Array.from($('annFile').files || []);
    const f = all[0];
    $('annFile').value = '';
    if (!f) return;
    if (all.length > 1) return saveMany(all);
    if (f.size > 80e6) return note('annNote', 'That file is too big for a 2 minute sound.', true);
    if (!$('annName').value.trim()) $('annName').value = f.name.replace(/\.[^.]+$/, '').slice(0, 40).toUpperCase();
    draft(await f.arrayBuffer());
  });

  $('annRec').addEventListener('click', async () => {
    if (rec) { rec.stop(); return; }
    clearDraft();
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { return note('annNote', "The microphone isn't allowed here. Make a voice memo and UPLOAD A FILE instead.", true); }
    const chunks = [], t0 = Date.now();
    rec = new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const timer = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      $('annRec').textContent = '■ STOP RECORDING ' + secs(s);
      if (s >= MAX_SECS && rec) rec.stop();
    }, 250);
    rec.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach(t => t.stop());
      rec = null;
      $('annRec').textContent = '● RECORD';
      $('annRec').classList.remove('rec-on');
      draft(await new Blob(chunks, { type: chunks[0] && chunks[0].type }).arrayBuffer());
    };
    rec.start(250);
    $('annRec').classList.add('rec-on');
    $('annRec').textContent = '■ STOP RECORDING 0:00';
  });

  $('annSave').addEventListener('click', async () => {
    if (!wavBlob) return;
    if (!unlocked) { pending = null; return needUnlock(); }
    const name = $('annName').value.trim();
    if (!name) { $('annName').focus(); return note('annNote', 'Give it a name first (LAST CALL, COAT CHECK...).', true); }
    note('annNote', 'Saving…');
    const r = await fetch('/api/announce/upload?kind=' + kind + '&name=' + encodeURIComponent(name), { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wavBlob }).catch(() => null);
    if (r && r.status === 401) { setUnlocked(false); return needUnlock(); }
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r && r.ok) {
      clearDraft();
      $('annName').value = '';
      note('annNote', 'Saved ' + (j.item ? j.item.name : name) + '. It is on the board under MINE.');
      listAt = 0; loadList();
      try { if (window.Soundboard) Soundboard.refresh(true); } catch (e) {}
    } else note('annNote', j.error || 'Not saved.', true);
  });

  setTimeout(() => { const d = $('go-announce'); if (d) d.addEventListener('toggle', () => { if (d.open) { listAt = 0; render(); } }); });

  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { render(); } catch (e) { console.warn('announce', e); }
  };
  addEventListener('hashchange', () => { try { if (location.hash.startsWith('#status')) { listAt = 0; render(); } } catch (e) {} });
  return { render, kind: k => setKind(k), byText };
})();
