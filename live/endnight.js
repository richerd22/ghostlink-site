'use strict';
// END OF NIGHT (#82): one card per night: tracks, hours, DJs, BPM range, the night's BOX RECORDS and TRANSITIONS
// highlights, and whether the HARD STOP cutoff was kept (how many seconds before MUSIC OFF the music stopped).
// endnight.html?night=YYYY-MM-DD shows it and saves it as a 1080 x 1350 image. From GET /api/endofnight.
// The tracklist is the DJ's: track titles are only in the card when that night's tracklist was shared (the box
// leaves them out otherwise). On the dashboard: PLAYED -> END OF NIGHT, and a line on every tab once MUSIC OFF passed.
// Text nodes only.
const EndNight = (() => {
  const GHOST = ['  .--.  ', ' / oo \\ ', '|      |', '|      |', ' \\/\\/\\/ '];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const hms = ms => hm(ms) + ':' + String(new Date(ms).getSeconds()).padStart(2, '0');
  const dur = s => { s = Math.abs(s); const m = Math.floor(s / 60), x = s % 60; return m ? m + ' MIN ' + String(x).padStart(2, '0') + ' S' : x + ' S'; };
  const bpm = c => c.bpmLow == null ? '--' : Math.round(c.bpmLow) === Math.round(c.bpmHigh) ? String(Math.round(c.bpmLow)) : Math.round(c.bpmLow) + '-' + Math.round(c.bpmHigh);

  /** The HARD STOP line: {text, cls, more} or null when the night had no MUSIC OFF. */
  function cutoff(c) {
    const h = c.hardStop;
    if (!h) return null;
    const off = 'MUSIC OFF ' + h.musicOff;
    if (h.kept === true) return { text: 'KEPT · ' + dur(h.secondsBefore) + ' BEFORE MUSIC OFF', cls: 'kept', more: off + (h.stoppedAt ? ' · music stopped ' + hms(h.stoppedAt) : '') };
    if (h.kept === false) return { text: (h.playing ? 'STILL PLAYING · ' : 'RAN OVER · ') + dur(h.secondsBefore) + ' PAST MUSIC OFF', cls: 'over', more: off + (h.stoppedAt ? ' · music stopped ' + hms(h.stoppedAt) : '') };
    return { text: off, cls: 'wait', more: 'Not over yet.' };
  }

  function highlights(c) {
    const out = [];
    (c.records || []).forEach(r => out.push(['NEW BOX RECORD', r.name + ': ' + r.text + (r.title ? ' (' + r.title + ')' : '') + (r.dj ? ' · ' + r.dj : '')]));
    const t = c.transitions;
    if (t && t.count) {
      out.push(['TRANSITIONS', t.count + ' mixes' + (t.clean ? ', ' + t.clean + ' clean' : '') + (t.gallopIndex != null ? ' · GALLOP INDEX ' + t.gallopIndex : '')]);
      if (t.cleanest) out.push(['CLEANEST BLEND', Math.round(t.cleanest.bars) + ' bars, ' + t.cleanest.cleanPct + '% clean' + (t.cleanest.dj ? ' · ' + t.cleanest.dj : '') + (t.cleanest.sync ? ' · SYNC' : '')]);
      if (t.longest && (!t.cleanest || t.longest.at !== t.cleanest.at)) out.push(['LONGEST BLEND', Math.round(t.longest.bars) + ' bars' + (t.longest.dj ? ' · ' + t.longest.dj : '')]);
      if (t.worst) out.push(['WILDEST RIDE', Math.round(t.worst.bars) + ' bars' + (t.worst.dj ? ' · ' + t.worst.dj : '')]);
    }
    return out;
  }

  // ---- #160 NO DECKS NIGHT: a night heard only through SOUND IN. Hours, BPM and drops by ear; never a title. ----
  const ear = c => c.source === 'ear';
  /** The four big numbers: decks (TRACKS ...) or by ear (MUSIC, BPM BY EAR, AVG, BIG DROPS). */
  const numbers = c => ear(c)
    ? [['MUSIC', c.hours], ['BPM BY EAR', bpm(c)], ['AVG', c.avgBpm == null ? '--' : c.avgBpm], ['DROPS', c.byEar && c.byEar.drops != null ? c.byEar.drops : '--']]
    : [['TRACKS', c.tracks], ['HOURS', c.hours], ['BPM', bpm(c)], ['AVG BPM', c.avgBpm == null ? '--' : c.avgBpm]];
  const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return h + ':' + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  /** [label, text] rows for BY EAR (#160): loudness, the room, parts, drops (with where they are in the recording). */
  function byEarRows(c) {
    const b = c.byEar, out = [];
    if (!b) return out;
    if (b.lufs != null) out.push(['LINE LOUDNESS', b.lufs + ' LUFS' + (b.range != null ? ' · range ' + b.range + ' LU' : '') + (b.hot ? ' · MASTERED HOT' : '')
      + (b.peakDb != null ? ' · peak ' + b.peakDb + ' dBFS' : '') + (b.clipsPerHour ? ' · ' + b.clipsPerHour + ' clips an hour' : '')]);
    if (b.roomPeak != null) out.push(['THE ROOM', 'about ' + Math.round(b.roomAvg) + ' dB, peak ' + Math.round(b.roomPeak) + ' dB (a HARD STOP panel\'s mic)']);
    if (b.peakAt) out.push(['LOUDEST', hm(b.peakAt)]);
    (Array.isArray(b.parts) ? b.parts : []).slice(0, 8).forEach(p => out.push(['PART ' + p.n, hm(p.from) + '-' + hm(p.to)
      + (p.avgBpm != null ? ' · ~' + Math.round(p.avgBpm) + ' BPM' : '') + (p.drops ? ' · ' + p.drops + (p.drops === 1 ? ' drop' : ' drops') : '') + (p.dj ? ' · ' + p.dj : '')
      + (p.why === 'silence' ? ' (after a silence)' : p.why === 'tempo' ? ' (the tempo moved)' : '')]));
    const big = (b.dropList || []).filter(d => d.big !== false);
    if (big.length) out.push(['DROPS', big.slice(0, 6).map(d => hm(d.at) + (d.recAt != null ? ' (' + clock(d.recAt) + ' in)' : '')).join(' · ') + (big.length > 6 ? ' · +' + (big.length - 6) : '')]);
    const o = b.before;
    if (o && o.minutes) out.push(['LAST BY-EAR NIGHT', o.night + ' · ' + Math.floor(o.minutes / 60) + 'h ' + String(o.minutes % 60).padStart(2, '0') + 'm'
      + (o.avgBpm != null ? ' · ~' + Math.round(o.avgBpm) + ' BPM' : '') + (o.drops != null ? ' · ' + o.drops + ' drops' : '')]);
    return out;
  }

  function render(box, c) {
    const head = el('div', 'head');
    head.append(el('pre', 'boo', GHOST.join('\n')));
    const t = el('div');
    t.append(el('h1', null, c.home ? 'END OF NIGHT · PRACTICE' : 'END OF NIGHT'), el('div', 'sub', (c.venue ? c.venue.toUpperCase() + ' · ' : '') + 'NIGHT OF ' + c.night));
    if (ear(c)) t.append(el('div', 'line', 'HEARD BY EAR: no DJ Link decks tonight, so this is the sound card\'s night (no titles).'));
    if (c.home) t.append(el('div', 'line', 'A practice night: kept, never counted as a show or a record.'));
    head.append(t);
    const nums = el('div', 'nums');
    numbers(c)
      .concat(c.doorPeak ? [['DOOR PEAK', c.doorPeak]] : []).forEach(([k, v]) => { // #127 DOOR COUNT: only when someone counted
      const d = el('div'); d.append(el('small', null, k), el('b', null, String(v))); nums.append(d);
    });
    box.replaceChildren(head, nums);
    if (c.from) box.append(el('div', 'line', hm(c.from) + ' to ' + hm(c.to || c.from)));
    if (c.djs && c.djs.length) box.append(el('h2', null, c.djs.length === 1 ? 'DJ' : c.djs.length + ' DJS'), el('div', 'djs', c.djs.join(' · ')));
    const cut = cutoff(c);
    if (cut) { box.append(el('h2', null, 'HARD STOP')); box.append(el('div', 'cut ' + cut.cls, cut.text), el('div', 'line', cut.more)); }
    const hl = highlights(c);
    if (hl.length) {
      box.append(el('h2', null, 'HIGHLIGHTS'));
      const ul = el('ul');
      hl.forEach(([k, v]) => { const li = el('li'); li.append(el('span', null, k + '  '), el('b', null, v)); ul.append(li); });
      box.append(ul);
    }
    const be = byEarRows(c);
    if (be.length) {
      box.append(el('h2', null, 'BY EAR'));
      const ul = el('ul');
      be.forEach(([k, v]) => { const li = el('li'); li.append(el('span', null, k + '  '), el('b', null, v)); ul.append(li); });
      box.append(ul);
    }
    box.append(el('h2', null, 'TRACKLIST'));
    if (c.tracklist && c.tracklist.length) {
      const ol = el('ol', 'tl');
      let dj;
      c.tracklist.forEach(x => {
        if (x.dj !== dj && c.djs.length > 1) { ol.append(el('li', 'dj', (x.dj || 'NO DJ SET').toUpperCase())); dj = x.dj; }
        const li = el('li'); li.append(el('span', null, hm(x.at)), el('b', null, (x.artist ? x.artist + ' - ' : '') + x.title)); ol.append(li);
      });
      box.append(ol);
    } else if (ear(c)) box.append(el('div', 'private', 'No tracklist: the night was heard by ear (no DJ Link). GHOST LINK never guesses titles.'));
    else box.append(el('div', 'private', c.shared ? 'Nothing played.' : 'The DJ\'s call: the tracklist shows here only when it was shared (PLAYED -> COPY · SAVE -> TRACKLIST).'));
    box.append(el('div', 'foot', 'GHOST LINK · made with <3 in Boston, MA by Third Polar Arch'));
  }

  /** The same card as a 1080 x 1350 PNG to post. */
  function image(c) {
    const W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const F = (w, px) => w + ' ' + px + 'px "JetBrains Mono", monospace';
    const fit = (s, max) => { while (g.measureText(s).width > max && s.length > 4) s = s.slice(0, -2); return s; };
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'top'; g.fillStyle = '#fff';
    g.font = F(600, 22); GHOST.forEach((l, i) => g.fillText(l, 72, 72 + i * 22));
    g.font = F(600, 44); g.fillText(c.home ? 'END OF NIGHT · PRACTICE' : 'END OF NIGHT', 220, 84);
    g.fillStyle = '#9a9a9a'; g.font = F(400, 26);
    g.fillText(fit((c.venue ? c.venue.toUpperCase() + ' · ' : '') + 'NIGHT OF ' + c.night, W - 300), 220, 144);
    numbers(c).forEach(([k, v], i) => {
      const x = 72 + i * 240;
      g.fillStyle = '#9a9a9a'; g.font = F(400, 22); g.fillText(k, x, 240);
      g.fillStyle = '#fff'; g.font = F(600, 50); g.fillText(fit(String(v), 225), x, 272);
    });
    let y = 370;
    const head = t => { g.fillStyle = '#333'; g.fillRect(72, y, W - 144, 2); y += 16; g.fillStyle = '#9a9a9a'; g.font = F(400, 22); g.fillText(t, 72, y); y += 34; };
    if (c.djs && c.djs.length) { head(c.djs.length === 1 ? 'DJ' : c.djs.length + ' DJS'); g.fillStyle = '#fff'; g.font = F(600, 32); g.fillText(fit(c.djs.join(' · '), W - 144), 72, y); y += 58; }
    const cut = cutoff(c);
    if (cut) {
      head('HARD STOP');
      g.fillStyle = cut.cls === 'over' ? '#ff2a2a' : cut.cls === 'wait' ? '#ffb000' : '#fff'; g.font = F(600, 34); g.fillText(fit(cut.text, W - 144), 72, y); y += 46;
      g.fillStyle = '#9a9a9a'; g.font = F(400, 24); g.fillText(fit(cut.more, W - 144), 72, y); y += 52;
    }
    const be = byEarRows(c); // #160
    if (be.length) {
      head('BY EAR');
      be.slice(0, 5).forEach(([k, v]) => { g.fillStyle = '#9a9a9a'; g.font = F(400, 20); g.fillText(k, 72, y); y += 26; g.fillStyle = '#fff'; g.font = F(600, 26); g.fillText(fit(v, W - 144), 72, y); y += 42; });
    }
    const hl = highlights(c);
    if (hl.length && y < H - 300) {
      head('HIGHLIGHTS');
      hl.slice(0, 5).forEach(([k, v]) => { g.fillStyle = '#9a9a9a'; g.font = F(400, 20); g.fillText(k, 72, y); y += 26; g.fillStyle = '#fff'; g.font = F(600, 26); g.fillText(fit(v, W - 144), 72, y); y += 42; });
    }
    if (c.tracklist && c.tracklist.length && y < H - 220) {
      head('TRACKLIST');
      g.font = F(400, 24);
      const rows = Math.max(1, Math.floor((H - 150 - y) / 32));
      const list = c.tracklist.slice(0, c.tracklist.length > rows ? rows - 1 : rows);
      list.forEach(x => { g.fillStyle = '#9a9a9a'; g.fillText(hm(x.at), 72, y); g.fillStyle = '#fff'; g.fillText(fit((x.artist ? x.artist + ' - ' : '') + x.title, W - 260), 200, y); y += 32; });
      if (c.tracklist.length > list.length) { g.fillStyle = '#9a9a9a'; g.fillText('+ ' + (c.tracklist.length - list.length) + ' more', 200, y); }
    }
    g.fillStyle = '#555'; g.font = F(400, 20);
    g.fillText('GHOST LINK · made with <3 in Boston, MA by Third Polar Arch', 72, H - 72);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }

  // ---- SHARE THIS NIGHT (#111): gl.cold.fyi/<unit>/night/<date> finds the box (this Wi-Fi or WATCH FROM HOME) and
  // opens this card. Only for a night whose tracklist was shared; the box shows "not shared" for any other. ----

  /** The night's link: the short form when the unit's short links are set up, else this box's own address. */
  function nightUrl(unit, night) {
    if (unit && unit.short) return 'https://' + unit.short + '/night/' + night;
    return location.origin + '/endnight.html?night=' + encodeURIComponent(night);
  }

  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    if (btn) { const was = btn.textContent; btn.textContent = 'COPIED'; setTimeout(() => { btn.textContent = was; }, 1500); }
  }

  async function shareNight(c) {
    const btn = document.getElementById('nightLink'), priv = document.getElementById('nightPrivate'), note = document.getElementById('nightNote');
    if (!btn) return;
    let unit = null, tl = null;
    try { unit = await (await fetch('/api/unit', { cache: 'no-store' })).json(); } catch (e) {}
    try { tl = await (await fetch('/api/tracklist?night=' + encodeURIComponent(c.night), { cache: 'no-store' })).json(); } catch (e) {}
    const remote = !!(tl && tl.remote);
    const say = t => { note.textContent = t; note.hidden = !t; };
    const show = shared => {
      btn.hidden = !shared && remote; // from outside: only a shared night has a link to pass on
      btn.textContent = shared ? 'SHARE THIS NIGHT' : 'SHARE THIS NIGHT…';
      priv.hidden = !shared || remote;
      btn.dataset.shared = shared ? '1' : '';
    };
    show(!!(tl && tl.shared));
    btn.addEventListener('click', async () => {
      if (btn.dataset.shared) { copyText(nightUrl(unit, c.night), btn); say('Copied: ' + nightUrl(unit, c.night).replace(/^https?:\/\//, '')); return; }
      if (!confirm('Share this night\'s card and tracklist? Only if the DJ says yes. Anyone with the link sees it.')) return;
      const r = await fetch('/api/tracklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ night: c.night, shared: true }) }).catch(() => null);
      if (!r || !r.ok) { say(r && r.status === 401 ? 'Unlock on the dashboard first (STATUS, password or crew code), then try again.' : 'Didn\'t work.'); return; }
      location.reload(); // the card now has its tracklist
    });
    priv.addEventListener('click', async () => {
      const r = await fetch('/api/tracklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ night: c.night, shared: false }) }).catch(() => null);
      if (!r || !r.ok) { say(r && r.status === 401 ? 'Unlock on the dashboard first (STATUS), then try again.' : 'Didn\'t work.'); return; }
      location.reload();
    });
  }

  /** endnight.html */
  async function page() {
    const night = new URLSearchParams(location.search).get('night') || '';
    const msg = document.getElementById('msg'), card = document.getElementById('card');
    let c;
    try {
      const r = await fetch('/api/endofnight' + (night ? '?night=' + encodeURIComponent(night) : ''), { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { msg.textContent = j.tracklist === 'private' ? (night ? 'The DJ hasn\'t shared this night.' : 'The DJ hasn\'t shared tonight\'s tracklist.') : (j.error || 'Couldn\'t load that night.'); return; }
      c = j;
    } catch (e) { msg.textContent = 'Couldn\'t reach GHOST LINK.'; return; }
    msg.hidden = true; card.hidden = false;
    try { await document.fonts.load('600 20px "JetBrains Mono"'); } catch (e) {}
    render(card, c);
    const name = 'ghostlink-end-of-night-' + c.night + '.png';
    document.getElementById('save').addEventListener('click', async () => {
      const b = await image(c), a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    shareNight(c);
    const sh = document.getElementById('share');
    if (navigator.canShare && navigator.canShare({ files: [new File([''], name, { type: 'image/png' })] })) {
      sh.hidden = false;
      sh.addEventListener('click', async () => {
        try { await navigator.share({ files: [new File([await image(c)], name, { type: 'image/png' })], title: 'END OF NIGHT' }); } catch (e) { /* cancelled */ }
      });
    }
  }

  /** The dashboard: PLAYED -> END OF NIGHT, and the READY line on every tab after MUSIC OFF (until tapped / closed). */
  function dashboard() {
    const btn = document.getElementById('eonBtn'), ready = document.getElementById('eonReady');
    if (btn) btn.addEventListener('click', () => {
      const n = (typeof viewNight !== 'undefined' && viewNight) || (S.status && S.status.night) || '';
      location.href = 'endnight.html' + (n ? '?night=' + encodeURIComponent(n) : '');
    });
    // #111 PLAYED: SHARE THIS NIGHT beside TRACKLIST: SHARED (tonight, while it's shared): copies tonight's night link.
    const tlBtn = document.getElementById('shareTl');
    if (tlBtn && !document.getElementById('nightLinkTl')) {
      const nb = el('button', 'local-only', 'SHARE THIS NIGHT'); nb.type = 'button'; nb.id = 'nightLinkTl'; nb.hidden = true;
      nb.title = "Copies tonight's link: it opens the END OF NIGHT card, here or from anywhere";
      tlBtn.after(nb);
      let unit = null;
      fetch('/api/unit').then(r => r.json()).then(u => { unit = u; }).catch(() => {});
      nb.addEventListener('click', () => { const n = S.status && S.status.night; if (n) copyText(nightUrl(unit, n), nb); });
      setInterval(() => {
        const tonight = S.status && S.status.night;
        const viewing = (typeof viewNight !== 'undefined' && viewNight) || tonight;
        nb.hidden = !(typeof tlShared !== 'undefined' && tlShared && tonight && viewing === tonight);
      }, 1500);
    }
    if (!ready) return;
    const seen = () => { try { return localStorage.getItem('eonSeen'); } catch (e) { return null; } };
    const see = n => { try { localStorage.setItem('eonSeen', n); } catch (e) {} };
    const link = el('a', null, 'MUSIC OFF · THE END OF NIGHT CARD IS READY →');
    const x = el('button', 'mini', 'CLOSE'); x.type = 'button';
    ready.append(link, x);
    link.addEventListener('click', () => see(ready.dataset.night || ''));
    x.addEventListener('click', () => { see(ready.dataset.night || ''); ready.hidden = true; });
    setInterval(() => {
      const n = S.status && S.status.eon;
      const show = !!n && seen() !== n && new URLSearchParams(location.search).get('embed') !== '1';
      if (show && ready.dataset.night !== n) { ready.dataset.night = n; link.href = 'endnight.html?night=' + encodeURIComponent(n); }
      ready.hidden = !show;
    }, 2000);
  }
  return { page, dashboard, render, image };
})();
