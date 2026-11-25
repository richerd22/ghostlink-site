'use strict';
// RECORDINGS round 2 (SOUND IN, DECISIONS #113). On the recording card: TOO HOT / TOO QUIET while it applies (the box
// says each once per recording), ROOM FOR ABOUT N H. On each saved recording: MP3 (320, made on the box when tapped,
// with track markers from PLAYED; TRIM THE QUIET AT THE ENDS is for the MP3 only, the FLAC is never touched), CUE (a
// .cue sheet for the FLAC) and, for the owner, HAND IT TO THE DJ: a QR + link to just that recording (MP3 + the
// tracklist if the DJ shared it) for 7 days or until REVOKE. sound.js draws the list and calls decorate().
// Own file: if anything here throws, the rest of the dashboard carries on. Everything from the box goes in as text.
const Recordings = (() => {
  const st = document.createElement('style');
  st.textContent = `
    .rec-pill.warn { color: var(--warn); }
    #recLvl { color: var(--warn); font-weight: 600; }
    #recRoom.warn { color: var(--warn); }
    .snd-list li { grid-template-columns: 1fr auto; }
    .snd-list .rec-more { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .snd-list .rec-more small { color: var(--grey); font-size: 11px; }
    .snd-list .rec-more .btn, .snd-list .rec-more button { font: inherit; font-size: 12px; padding: 6px 10px; margin: 0; min-height: 0; letter-spacing: .06em; }
    .snd-list .rec-more .warn { color: var(--warn); }
    .rec-opts { display: flex; gap: 8px; align-items: center; font-size: 13px; margin: 6px 0; }
    .rec-opts input, .rec-hand input[type=checkbox] { width: 18px; height: 18px; margin: 0; accent-color: var(--fg); flex: 0 0 18px; padding: 0; }
    .rec-hand { border: 1px solid var(--dim); padding: 12px; margin: 10px 0; display: grid; gap: 10px; }
    .rec-hand label { display: flex; gap: 8px; align-items: center; font-size: 14px; }
    .rec-hand .share-addr { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rec-hand .share-qr { max-width: 240px; }
    .snd-list .rec-strip { grid-column: 1 / -1; display: block; width: 100%; height: 22px; margin: 2px 0 0; }
    .rec-strip .rs-peak { fill: var(--dim); }
    .rec-strip .rs-loud { fill: var(--fg); }
    .rec-strip .rs-clip { fill: var(--warn); }
    @media (max-width: 420px) { .snd-list li { grid-template-columns: 1fr; } .snd-list .acts { flex-wrap: wrap; } .snd-list .what small { white-space: normal; overflow-wrap: anywhere; } }`;
  document.head.appendChild(st);

  const ctl = $('sndCtl');
  const lvl = document.createElement('div'); lvl.className = 'note'; lvl.id = 'recLvl'; lvl.hidden = true;
  const room = document.createElement('div'); room.className = 'note'; room.id = 'recRoom'; room.hidden = true;
  ctl.insertAdjacentElement('afterend', room);
  ctl.insertAdjacentElement('afterend', lvl);
  const opts = document.createElement('label'); opts.className = 'rec-opts'; opts.hidden = true;
  const trimBox = document.createElement('input'); trimBox.type = 'checkbox';
  opts.append(trimBox, document.createTextNode('MP3: TRIM THE QUIET AT THE START AND END'));
  $('sndList').insertAdjacentElement('beforebegin', opts);
  const hand = document.createElement('div'); hand.className = 'rec-hand'; hand.hidden = true;
  $('sndList').insertAdjacentElement('afterend', hand);

  let trim = true;
  try { trim = localStorage.getItem('recTrim') !== '0'; } catch (e) {}
  trimBox.checked = trim;
  trimBox.addEventListener('change', () => { trim = trimBox.checked; try { localStorage.setItem('recTrim', trim ? '1' : '0'); } catch (e) {} redraw(); });

  let roomNow = null, files = [];
  const busy = {};          // name|trim -> latest state while waiting / making (polled)
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hrs = m => m == null ? null : m < 60 ? m + ' min' : m < 600 ? (Math.round(m / 6) / 10) + ' h' : Math.round(m / 60) + ' h';
  const mb = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e6) + ' MB';
  const when = ms => { const d = new Date(ms); return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

  /** The recording card: level words + room left. */
  function render() {
    const a = S.status && S.status.audio, r = a && a.recording;
    lvl.hidden = !(r && r.level);
    if (r && r.level) lvl.textContent = r.level === 'hot' ? 'TOO HOT: turn REC OUT down a little. The recording is hitting the top' + (r.clips ? ' (' + r.clips + ' clips so far).' : '.')
      : 'TOO QUIET: turn REC OUT up. The loud parts should sit around -12 dB on the meter.';
    const mins = r && r.roomMins != null ? r.roomMins : roomNow && roomNow.mins;
    room.hidden = !(a && a.card) || mins == null;
    if (mins != null) {
      const low = mins < 60;
      room.textContent = (low ? 'Only room for about ' : 'Room for about ') + hrs(mins) + ' of recording on the box.'
        + (low ? ' Download and delete old recordings below to make room.' : '');
      room.classList.toggle('warn', low);
    }
  }

  function choice(f) {
    const m = f.mp3 || {}, t = trim && m.canTrim;
    return { t, s: busy[f.name + '|' + (t ? 1 : 0)] || (t ? m.trim : m.full) || { state: 'none' } };
  }

  /** Called by sound.js after it draws the list. */
  function decorate(list, j) {
    files = list;
    roomNow = j.room || null;
    opts.hidden = !list.some(f => !f.live);
    render();
    redraw();
  }

  function redraw() {
    const ul = $('sndList');
    [...ul.children].forEach((li, i) => {
      const f = files[i];
      if (!f || li.dataset.name !== f.name) return;
      // #116 LEVEL STRIP: peaks and loudness over the set, clips marked (older recordings have none)
      if (f.levels && typeof LevelStrip !== 'undefined' && !li.querySelector('.rec-strip')) {
        try { const sv = LevelStrip.svg(f.levels); if (sv) (li.querySelector('.acts') || li.lastElementChild).after(sv); } catch (e) { console.warn('strip', e); }
      }
      if (f.live) return;
      let more = li.querySelector('.rec-more');
      if (!more) { more = el('div', 'rec-more'); li.appendChild(more); }
      more.textContent = '';
      const { t, s } = choice(f);
      const n = encodeURIComponent(f.name);
      if (s.state === 'ready') {
        const a = el('a', 'btn mini', 'MP3' + (s.bytes ? ' · ' + mb(s.bytes) : ''));
        a.href = '/api/audio/mp3?name=' + n + (t ? '&trim=1' : ''); a.setAttribute('download', '');
        more.appendChild(a);
      } else {
        const b = el('button', 'mini', s.state === 'making' ? 'MAKING MP3 ' + (s.pct || 0) + '%' : s.state === 'waiting' ? 'MP3: IN THE QUEUE' : 'MAKE MP3');
        b.type = 'button';
        b.disabled = s.state === 'making' || s.state === 'waiting';
        b.addEventListener('click', () => make(f, t));
        more.appendChild(b);
      }
      const cue = el('a', 'btn mini', 'CUE'); cue.href = '/api/audio/cue?name=' + n; cue.setAttribute('download', '');
      cue.title = 'A .cue sheet for the FLAC (track markers from PLAYED)';
      more.appendChild(cue);
      const h = el('button', 'mini local-only', 'HAND IT TO THE DJ'); h.type = 'button';
      h.addEventListener('click', () => openHand(f));
      more.appendChild(h);
      if (f.clips) more.appendChild(el('small', f.levelWarn && f.levelWarn.includes('hot') ? 'warn' : '', 'CLIPPED ' + f.clips + '×'));
      else if (f.levelWarn && f.levelWarn.includes('quiet')) more.appendChild(el('small', 'warn', 'RECORDED QUIET'));
      if (s.state === 'failed' && s.error) more.appendChild(el('small', 'warn', s.error));
      if (s.state === 'ready' && t && s.trimSecs) more.appendChild(el('small', null, s.trimSecs + ' s of quiet trimmed'));
      // #116 AUTO MP3 AFTER EACH SET: say when it'll be ready by itself
      const au = s.auto || (t ? null : (f.mp3 && f.mp3.trim && f.mp3.trim.auto));
      if (s.state !== 'ready' && au) more.appendChild(el('small', null, au === 'after' ? 'MP3 MAKES ITSELF ONCE THE RECORDING NOW ENDS'
        : au === 'busy' ? 'MP3 MAKES ITSELF WHEN THE BOX IS LESS BUSY' : au === 'making' ? 'MAKING ITS MP3 BY ITSELF' : 'MP3 MAKES ITSELF NEXT'));
    });
    // locked phones: the downloads ask for the password (sound.js handles a[download] the same way)
  }

  async function make(f, t) {
    if (!unlocked) return needUnlock();
    const r = await post('/api/audio/mp3', { name: f.name, trim: t });
    if (!r.ok) return;
    busy[f.name + '|' + (t ? 1 : 0)] = await r.json().catch(() => ({ state: 'waiting' }));
    redraw();
    poll(f.name, t);
  }

  async function poll(name, t) {
    const key = name + '|' + (t ? 1 : 0);
    for (let i = 0; i < 2000; i++) {
      await new Promise(res => setTimeout(res, 2000));
      let s;
      try { s = await (await fetch('/api/audio/mp3/state?name=' + encodeURIComponent(name) + (t ? '&trim=1' : ''), { cache: 'no-store' })).json(); }
      catch (e) { continue; }
      busy[key] = s;
      redraw();
      if (s.state !== 'waiting' && s.state !== 'making') {
        delete busy[key];
        const f = files.find(x => x.name === name);
        if (f) { f.mp3 = f.mp3 || {}; f.mp3[t ? 'trim' : 'full'] = s; }
        redraw();
        return;
      }
    }
  }

  // ---- HAND IT TO THE DJ (owner) ----
  let short = '';
  async function openHand(f) {
    if (!unlocked) return needUnlock();
    hand.textContent = '';
    hand.hidden = false;
    const who = f.dj || 'the set';
    hand.appendChild(el('small', null, 'HAND IT TO THE DJ · ' + who.toUpperCase()));
    const msg = el('div', 'note');
    hand.appendChild(msg);
    let have = null;
    try {
      const r = await fetch('/api/share/recording?name=' + encodeURIComponent(f.name), { cache: 'no-store' });
      if (r.status === 403) { msg.textContent = "HAND IT TO THE DJ needs the owner's password, not tonight's crew code."; msg.classList.add('warn'); return closeBtn(); }
      if (r.status === 401) { hand.hidden = true; return needUnlock(); }
      have = (await r.json()).link;
      const s = await (await fetch('/api/share', { cache: 'no-store' })).json();
      short = s.short ? 'https://' + s.short : '';
    } catch (e) { msg.textContent = "Couldn't reach the box."; return closeBtn(); }
    if (have) return showLink(f, have);
    msg.textContent = 'A link for ' + who + ': just this recording as an MP3, and its tracklist if the DJ shared it. It ends in 7 days, or when you tap REVOKE.';
    const out = el('label');
    const ob = el('input'); ob.type = 'checkbox';
    out.append(ob, document.createTextNode('ALSO FROM OUTSIDE THE VENUE (needs WATCH FROM HOME)'));
    hand.appendChild(out);
    const row = el('div', 'buttons');
    const go = el('button', null, 'MAKE THE LINK'); go.type = 'button';
    go.addEventListener('click', async () => {
      const r = await post('/api/share/recording', { name: f.name, outside: ob.checked });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) return;
      if (!r.ok) { msg.textContent = r.status === 403 ? "That needs the owner's password." : j.error || "Didn't work: " + glWhy(r.status, j); msg.classList.add('warn'); return; }
      showLink(f, j);
    });
    const no = el('button', null, 'CANCEL'); no.type = 'button';
    no.addEventListener('click', () => { hand.hidden = true; });
    row.append(go, no);
    hand.appendChild(row);
    hand.scrollIntoView({ block: 'nearest' });
  }

  function closeBtn() {
    const b = el('button', null, 'DONE'); b.type = 'button';
    b.addEventListener('click', () => { hand.hidden = true; });
    hand.appendChild(b);
  }

  function showLink(f, l) {
    hand.textContent = '';
    hand.hidden = false;
    const url = (short || shareAddress().replace(/\/$/, '')) + l.path;
    hand.appendChild(el('small', null, 'FOR ' + (f.dj || 'THE SET').toUpperCase() + ' · UNTIL ' + when(l.exp).toUpperCase()));
    hand.appendChild(el('div', 'note', 'The DJ scans this or opens the link: the MP3 of this set' +
      (l.scopes.includes('outside') ? ', on this Wi-Fi or from anywhere while WATCH FROM HOME is on.' : ', on this Wi-Fi.')));
    const img = el('img', 'share-qr'); img.alt = 'QR code for the link';
    img.src = '/api/qr.svg?text=' + encodeURIComponent(url);
    hand.append(el('div', 'share-addr', url.replace(/^https?:\/\//, '')), img);
    const msg = el('div', 'note');
    const row = el('div', 'buttons');
    const cp = el('button', null, 'COPY'); cp.type = 'button';
    cp.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); } catch (e) { const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      cp.textContent = 'COPIED'; setTimeout(() => { cp.textContent = 'COPY'; }, 1500);
    });
    const rv = el('button', null, 'REVOKE'); rv.type = 'button';
    rv.addEventListener('click', async () => {
      if (rv.dataset.armed !== '1') { rv.dataset.armed = '1'; rv.textContent = 'TAP AGAIN TO REVOKE'; setTimeout(() => { rv.dataset.armed = ''; rv.textContent = 'REVOKE'; }, 4000); return; }
      const r = await post('/api/share/revoke', { id: l.id });
      if (r.ok) { hand.textContent = ''; hand.appendChild(el('div', 'note', 'Revoked: that link no longer opens anything.')); closeBtn(); }
      else { msg.textContent = r.status === 403 ? "REVOKE needs the owner's password." : "Didn't work: " + glWhy(r.status); msg.classList.add('warn'); }
    });
    const done = el('button', null, 'DONE'); done.type = 'button';
    done.addEventListener('click', () => { hand.hidden = true; });
    row.append(cp, rv, done);
    hand.append(row, msg);
    // #154: their GHOST WRAPPED picture, made on this phone for the owner to hand over (AirDrop, a message). The DJ's
    // link itself stays this one set (#117: never another night, never the venue).
    const dj = String(f.dj || '').trim();
    if (dj && dj.charAt(0) !== '(' && !/^(SOUNDCHECK|NEXT DJ|SET \d+)$/.test(dj)) {
      const w = el('a', 'btn mini', 'THEIR GHOST WRAPPED →');
      w.href = 'wrapped.html?dj=' + encodeURIComponent(dj);
      hand.append(el('div', 'note', 'Their nights on this box as a picture to save and send them yourself (the link above stays just this set):'), w);
    }
    hand.scrollIntoView({ block: 'nearest' });
  }

  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { render(); } catch (e) { console.warn('recordings', e); }
  };
  return { decorate, render };
})();
