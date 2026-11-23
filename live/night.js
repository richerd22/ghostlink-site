'use strict';
// AFTER THE NIGHT (#125): night.html. The NIGHT REPORT (planned vs actual per DJ when there was a plan, the music, what
// the box went through, the recordings), the NIGHT LOG with CSV / text, and for the owner the ROYALTY SETLIST.
// Everything from the box (GET /api/night/report, crew code or owner). Text nodes only (titles, names and notes come
// from the network). The formatting helpers are pure (src/test/js/afternight.test.js).
const NightPage = (() => {
  const pad = n => String(n).padStart(2, '0');
  /** "22:04" in the page's own time zone (the box and the booth phone share one). */
  function hhmm(ms) { if (ms == null) return '--:--'; const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /** "3:41" / "1:02:03". */
  function dur(ms) {
    if (!ms || ms <= 0) return '';
    const s = Math.round(ms / 1000);
    return s >= 3600 ? Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) : Math.floor(s / 60) + ':' + pad(s % 60);
  }
  /** "4 min late" / "2 min early" / "on time" (within a minute). */
  function late(m) {
    if (m == null) return '';
    if (Math.abs(m) < 1) return 'on time';
    return m > 0 ? m + ' min late' : -m + ' min early';
  }
  /** "7 min over" / "" when it ended in time. */
  function over(m) { return m == null || m < 1 ? '' : m + ' min over'; }
  function bpm(lo, hi) { return lo == null ? '--' : lo === hi ? String(lo) : lo + '-' + hi; }
  /** The MUSIC OFF line: {text, over} or null without one. */
  function cutoff(r) {
    if (!r.musicOff) return null;
    if (r.playing) return { text: 'MUSIC OFF ' + r.musicOff + ' · music still on', over: r.kept === false };
    if (r.stoppedAt == null) return { text: 'MUSIC OFF ' + r.musicOff, over: false };
    const m = r.minutesOver || 0;
    return { text: 'MUSIC OFF ' + r.musicOff + ' · stopped ' + hhmm(r.stoppedAt) + (r.kept ? ' · kept' : ' · ' + m + ' min over'), over: r.kept === false };
  }
  /** One set's line pieces: [[label, value, cls]]. */
  function setBits(s, schedule) {
    const out = [];
    if (schedule && s.plannedStart != null) out.push(['PLANNED', hhmm(s.plannedStart) + '-' + (s.plannedEnd != null ? hhmm(s.plannedEnd) : '?'), '']);
    if (s.noMusic) out.push(['ACTUAL', 'no music logged under this name', '']);
    else out.push(['ACTUAL', hhmm(s.actualStart) + '-' + (s.actualEnd != null ? hhmm(s.actualEnd) : 'now'), '']);
    if (schedule && s.lateMin != null) out.push(['', late(s.lateMin), s.lateMin >= 5 ? 'late' : '']);
    if (schedule && over(s.overMin)) out.push(['', over(s.overMin), 'over']);
    if (!s.noMusic) out.push(['', s.tracks + (s.tracks === 1 ? ' track' : ' tracks'), '']);
    return out;
  }
  const KIND = { 'SET': 'SET', 'CALL': 'CREW CALL', 'STAND BY': 'STAND BY', 'OVERRUN': 'OVERRUN', 'RESTART': 'RESTART', 'CARD': 'CARD',
    'WI-FI': 'WI-FI', 'DEAD AIR': 'DEAD AIR', 'MEDIA': 'MEDIA', 'WARN': 'WARNING', 'NOTE': 'NOTE', 'HARD STOP': 'HARD STOP' };
  function kind(e) { return (KIND[e.kind] || e.kind) + (e.tag ? ' · ' + e.tag : ''); }

  // ---------- the page ----------
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function num(host, label, value, cls) {
    const d = el('div', cls || null); d.append(el('small', null, label), el('b', null, value)); host.append(d); return d;
  }
  const q = () => new URLSearchParams(location.search);

  function render(r) {
    const c = $('card');
    c.replaceChildren();
    c.append(el('h1', null, 'NIGHT REPORT'));
    c.append(el('div', 'sub', [r.night, r.venue, r.home ? 'PRACTICE' : null, r.tonight ? 'TONIGHT' : null].filter(Boolean).join(' · ')));

    if (r.schedule) {
      c.append(el('h2', null, 'TIMES · PLANNED AND ACTUAL'));
      const cut = cutoff(r);
      if (cut) c.append(el('div', 'cut' + (cut.over ? ' over' : ''), cut.text));
      const ul = el('ul');
      const twice = {}; // #129: a DJ back for a second set: say which set each line is
      for (const s of r.sets || []) if (!s.noMusic) twice[s.dj || ''] = (twice[s.dj || ''] || 0) + 1;
      for (const s of r.sets || []) {
        const li = el('li', 'set');
        li.append(el('b', null, (s.dj || 'NO DJ SET') + (s.n && twice[s.dj || ''] > 1 ? ' · SET ' + s.n : '')));
        const t = el('div', 't');
        for (const [l, v, cls] of setBits(s, true)) {
          const sp = el('span', cls || null);
          if (l) { sp.append(document.createTextNode(l + ' ')); sp.append(el('b', null, v)); } else sp.textContent = v;
          t.append(sp);
        }
        li.append(t);
        ul.append(li);
      }
      if (!(r.sets || []).length) ul.append(el('li', null, 'No sets yet.'));
      c.append(ul);
    }

    const m = r.music || {};
    c.append(el('h2', null, 'MUSIC'));
    const n = el('div', 'nums');
    num(n, 'TRACKS', String(m.tracks || 0));
    num(n, 'HOURS', m.hours || '0h 00m');
    num(n, 'BPM', bpm(m.bpmLow, m.bpmHigh));
    if (r.doorPeak) num(n, 'DOOR PEAK', String(r.doorPeak)); // #127 DOOR COUNT: only when someone counted
    if (r.weather) { // #131 WEATHER: the night's worst, only when the box read the weather that night
      const w = r.weather, hm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
      num(n, 'WORST WEATHER', 'GUSTS ' + w.gust + ' ' + w.units + (w.gustAt ? ' (' + hm(w.gustAt) + ')' : '') + ' · WIND ' + w.wind
        + (w.storm ? ' · THUNDER FORECAST' + (w.stormAt ? ' ' + hm(w.stormAt) : '') : ''));
    }
    if (m.longest) {
      const l = m.longest;
      const name = (l.artist ? l.artist + ' - ' : '') + (l.title || '');
      num(n, 'LONGEST ON AIR', dur(l.playedMs) + (name ? ' · ' + name : ''), null).querySelector('b').className = 'long';
    }
    c.append(n);
    if ((m.djs || []).length > 1 || (!r.schedule && (m.djs || []).length)) {
      const ul = el('ul');
      ul.style.marginTop = '10px';
      for (const d of m.djs) ul.append(el('li', null, (d.dj || 'NO DJ SET') + ' · ' + d.tracks + (d.tracks === 1 ? ' track' : ' tracks')
        + (d.bpmLow != null ? ' · ' + bpm(d.bpmLow, d.bpmHigh) + ' BPM' : '')));
      c.append(ul);
    }

    const b = r.box || {};
    c.append(el('h2', null, 'THE BOX'));
    const bn = el('div', 'nums');
    num(bn, 'CREW CALLS', String(b.crewCalls || 0));
    num(bn, 'WI-FI DROPS', String(b.wifiDrops || 0), b.wifiDrops ? 'warn' : null);
    if (b.standBy) num(bn, 'STAND BY', String(b.standBy));
    num(bn, 'DEAD AIR', String(b.deadAir || 0), b.deadAir ? 'warn' : null);
    num(bn, 'RESTARTS', String(b.restarts || 0), b.restarts ? 'warn' : null);
    if (b.card) num(bn, 'CARD TROUBLE', String(b.card), 'warn');
    num(bn, 'WARNINGS', String(b.warnings || 0), b.warnings ? 'warn' : null);
    num(bn, 'NOTES', String(b.notes || 0));
    c.append(bn);

    if ((r.recordings || []).length) {
      c.append(el('h2', null, 'RECORDINGS'));
      const ul = el('ul');
      for (const x of r.recordings) {
        const li = el('li');
        li.append(el('b', null, (x.dj || 'SET') + ' · ' + hhmm(x.startAt) + '-' + hhmm(x.endAt) + (x.minutes != null ? ' · ' + x.minutes + ' min' : '') + (x.live ? ' · RECORDING NOW' : '')));
        const bt = el('div', 'buttons');
        const a = el('a', 'btn', 'DOWNLOAD'); a.href = '/api/audio/file?name=' + encodeURIComponent(x.name); a.setAttribute('download', '');
        const s = el('a', 'btn', 'SOUND IN'); s.href = '/#network';
        if (!x.live) bt.append(a);
        bt.append(s);
        li.append(bt);
        if (x.mixcloud && x.mixcloud.line) li.append(el('div', 'line' + (x.mixcloud.ok ? '' : ' warn'), x.mixcloud.line));
        ul.append(li);
      }
      c.append(ul);
    }

    c.append(el('h2', null, 'NIGHT LOG'));
    const log = el('ul', 'log');
    for (const e of r.log || []) {
      const li = el('li', (e.warn ? 'warn' : '') + (e.kind === 'NOTE' ? ' note' : ''));
      li.append(el('span', null, hhmm(e.at)), el('span', 'k', kind(e)), el('span', 'x', e.text + (e.from && e.kind === 'NOTE' ? ' (' + e.from + ')' : '')));
      log.append(li);
    }
    if (!(r.log || []).length) log.append(el('li', null, 'Nothing logged that night.'));
    c.append(log);
    const lb = el('div', 'buttons');
    for (const [f, t] of [['csv', 'LOG AS CSV'], ['txt', 'LOG AS TEXT']]) {
      const a = el('a', 'btn', t); a.href = '/api/night/log?night=' + encodeURIComponent(r.night) + '&format=' + f; a.setAttribute('download', ''); lb.append(a);
    }
    c.append(lb);

    if (r.royalty) royalty(c, r);
    c.append(el('div', 'foot', 'Made by GHOST LINK from what the decks and the box logged. Check it before you send it anywhere.'));
  }

  function royalty(c, r) {
    c.append(el('h2', null, 'ROYALTY SETLIST · OWNER'));
    c.append(el('div', 'line', 'The night\'s tracklist laid out for the performing-rights portals. Pick everyone, a DJ or one set, then a society.'));
    const pick = el('select', 'noprint'); pick.setAttribute('aria-label', 'DJ or set');
    for (const [label, value] of royaltyChoices(r.royalty)) pick.append(new Option(label, value));
    const pw = el('div', 'buttons'); pw.append(pick); c.append(pw);
    if (r.royalty.venue) c.append(addressBox(r));
    const host = el('div');
    c.append(host);
    function links() {
      host.replaceChildren();
      for (const s of r.royalty.societies || []) {
        const d = el('div', 'soc');
        d.append(el('b', null, s.name + (s.region ? ' · ' + s.region : '')));
        const bt = el('div', 'buttons');
        for (const [f, t] of [['csv', 'CSV'], ['txt', 'TEXT']]) {
          const u = new URLSearchParams({ night: r.night, society: s.id, format: f });
          if (pick.value.startsWith('set:')) u.set('set', pick.value.slice(4));
          else if (pick.value !== '__all') u.set('dj', pick.value);
          const a = el('a', 'btn', t); a.href = '/api/night/royalty?' + u.toString(); a.setAttribute('download', ''); bt.append(a);
        }
        d.append(bt);
        const how = el('details');
        how.append(el('summary', null, 'HOW TO SUBMIT'), el('div', null, s.how), el('div', 'cols', 'Columns: ' + (s.columns || []).join(', ')));
        d.append(how);
        host.append(d);
      }
    }
    pick.addEventListener('change', links);
    links();
  }

  /**
   * #129: the royalty picker. EVERYONE, each DJ (all their sets), then each set on its own when the night had more
   * than one ("SET 3 · LIL TICK → TICK · 01:00"), since a set is one performance. Pure: [[label, value]].
   */
  function royaltyChoices(ro) {
    const out = [['EVERYONE', '__all']];
    for (const d of (ro && ro.djs) || []) out.push([(d.dj || 'NO DJ SET') + ' (' + d.tracks + (d.sets > 1 ? ', ' + d.sets + ' sets' : '') + ')', d.dj]);
    const sets = (ro && ro.sets) || [];
    if (sets.length > 1) for (const s of sets)
      out.push(['SET ' + s.n + ' · ' + (s.n > 1 ? (s.from || 'NO DJ SET') + ' → ' : '') + (s.dj || 'NO DJ SET') + ' · ' + hhmm(s.start) + ' (' + s.tracks + ')', 'set:' + s.n]);
    return out;
  }

  /** #129: the venue's full address for PRS. The owner's only: it rides in the royalty downloads, nowhere else. */
  function addressBox(r) {
    const f = el('form', 'addr noprint');
    const lab = el('label', null, 'FULL ADDRESS OF ' + r.royalty.venue + ' (for PRS: street, town, postcode)');
    const inp = el('input'); inp.maxLength = 200; inp.autocomplete = 'off'; inp.value = r.royalty.address || '';
    inp.setAttribute('aria-label', 'Venue address');
    lab.htmlFor = inp.id = 'addrIn';
    const save = el('button', null, 'SAVE'); save.type = 'submit';
    const note = el('div', 'line', 'Only you see this. It goes in the royalty downloads, never on the DJ\'s page or anywhere public.');
    f.append(lab, el('div', 'buttons'), note);
    f.querySelector('.buttons').append(inp, save);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      save.disabled = true;
      try {
        const res = await fetch('/api/night/address', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venue: r.royalty.venue, address: inp.value }) });
        const j = await res.json().catch(() => ({}));
        note.textContent = res.ok ? (j.address ? 'Saved. The downloads carry it now.' : 'Cleared.') : (j.error || 'Didn\'t save (' + res.status + ').');
        note.classList.toggle('warn', !res.ok);
        if (res.ok) { r.royalty.address = j.address || null; inp.value = j.address || ''; }
      } catch (err) { note.textContent = 'Couldn\'t reach the box.'; note.classList.add('warn'); }
      save.disabled = false;
    });
    return f;
  }

  async function nights(cur) {
    const p = $('pick');
    try {
      const ns = await (await fetch('/api/nights', { cache: 'no-store' })).json();
      const list = Array.isArray(ns) ? ns.slice().sort().reverse() : [];
      if (cur && !list.includes(cur)) list.unshift(cur);
      p.replaceChildren(...list.slice(0, 120).map(n => new Option(n, n, n === cur, n === cur)));
    } catch (e) { p.hidden = true; }
    p.addEventListener('change', () => { location.search = '?night=' + encodeURIComponent(p.value); });
  }

  async function load() {
    const night = q().get('night') || '';
    let r;
    try { r = await fetch('/api/night/report' + (night ? '?night=' + encodeURIComponent(night) : ''), { cache: 'no-store' }); }
    catch (e) { $('msg').textContent = "Couldn't reach the box. Check the Wi-Fi and reload."; return; }
    if (r.status === 401) {
      $('msg').textContent = 'The NIGHT REPORT is for the crew: enter the password or tonight\'s crew code.';
      $('unlock').hidden = false; $('pw').focus();
      return;
    }
    if (r.status === 403) { const j = await r.json().catch(() => ({})); $('msg').textContent = j.error || 'Not from here.'; return; }
    if (!r.ok) { $('msg').textContent = 'No report for that night.'; return; }
    const j = await r.json();
    $('msg').hidden = true;
    $('unlock').hidden = true;
    $('card').hidden = false;
    render(j);
    nights(j.night);
    document.title = 'GHOST LINK NIGHT REPORT ' + j.night;
  }

  function page() {
    $('print').addEventListener('click', () => {
      document.querySelectorAll('details').forEach(d => { d.dataset.was = d.open ? '1' : ''; d.open = true; });
      window.print();
      document.querySelectorAll('details').forEach(d => { d.open = d.dataset.was === '1'; });
    });
    $('unlock').addEventListener('submit', async e => {
      e.preventDefault();
      const r = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) }).catch(() => null);
      $('pw').value = '';
      if (r && r.ok) load();
      else $('msg').textContent = 'Wrong password or code. After 5 tries, wait a minute.';
    });
    load();
  }

  return { hhmm, dur, late, over, bpm, cutoff, setBits, kind, royaltyChoices, page };
})();
if (typeof module !== 'undefined') module.exports = NightPage;
