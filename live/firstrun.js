'use strict';
/*
 * FIRST RUN (DECISIONS #136): a new owner's walk from the GHOST LINK hotspot to "ready for my first night".
 * WELCOME -> PASSWORD -> WI-FI -> WHAT KIND OF NIGHTS DO YOU DO? -> VENUE (only when there's none yet) -> THE DECKS -> READY.
 * Shown once per box (GET /api/firstrun says when), on local phones only (never a view-only, role, embed or corner
 * window link). JUST LOOK AROUND closes it on this phone; STATUS -> SET UP THIS BOX opens it again. Watching (decks,
 * PLAYED, TV) works the whole time without any of it.
 * WHAT KIND OF NIGHTS never turns anything on: it puts the STATUS sections for the ticks up front (YOUR NIGHTS) and
 * offers to save a preset of harmless lines; LIGHTS, ASK THE DJ, ANNOUNCEMENTS, DECK CONTROLS ... stay their own switches.
 * Own file; uses app.js globals ($, esc, unlocked, refreshAuth, Tour). Network text goes in as text nodes only.
 */
const FirstRun = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const send = async (path, body) => {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GhostLink-Dashboard': '1' }, body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, j };
    } catch (e) { return { ok: false, status: 0, j: { error: "The box didn't answer. Still on its Wi-Fi?" } }; }
  };
  const get = async path => { try { const r = await fetch(path, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (e) { return null; } };

  let fr = null, sheet = null, steps = [], at = 0, msg = '', busy = false, poll = null;
  let ticks = new Set(), preview = null, saveNames = new Set(), wifiSaved = null, venueSaved = null, only = null;

  async function load() { fr = await get('/api/firstrun'); return fr; }

  /** The walk; a step that has nothing to do is passed over (password once it's yours, venue once there is one). */
  function plan() {
    const s = ['welcome'];
    if (fr.mustChange || !fr.owner) s.push('password');
    s.push('wifi', 'kinds');
    if (!fr.gigs) s.push('venue');
    s.push('decks', 'ready');
    return s;
  }
  const nothingToDo = s => (s === 'password' && fr.owner && !fr.mustChange && passDone) || (s === 'venue' && (fr.gigs > 0 || venueSaved));
  let passDone = false;

  /** Open the walk (from the start, or one step: 'kinds' from STATUS). */
  async function open(step) {
    await load();
    if (!fr) return;
    only = step || null;
    ticks = new Set(fr.kinds || []);
    preview = null; msg = '';
    steps = plan();
    at = step ? Math.max(0, steps.indexOf(step)) : 0;
    if (step && (fr.mustChange || !fr.owner)) at = steps.indexOf('password'); // the password first, always
    const t = $('tour'); if (t) t.hidden = true;
    document.body.classList.add('firstrun-on');
    send('/api/firstrun/started');
    show();
  }
  function close() {
    if (sheet) sheet.remove();
    sheet = null;
    document.body.classList.remove('firstrun-on');
    if (poll) { clearInterval(poll); poll = null; }
  }
  function later() { store.set('firstrunLater', '1'); close(); mountStatus(); }
  function next() {
    msg = '';
    if (only && steps[at] === only) { close(); mountStatus(); return; }
    do at = Math.min(steps.length - 1, at + 1); while (at < steps.length - 1 && nothingToDo(steps[at]));
    show();
  }
  function back() {
    msg = '';
    do at = Math.max(0, at - 1); while (at > 0 && nothingToDo(steps[at]));
    show();
  }

  function frame(title, lead) {
    if (sheet) sheet.remove();
    if (poll) { clearInterval(poll); poll = null; }
    sheet = el('div', 'share firstrun');
    const box = el('div', 'share-box fr-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', title);
    const shown = steps.filter(s => s !== 'welcome');
    const i = shown.indexOf(steps[at]);
    box.append(el('small', 'fr-step', only ? 'GHOST LINK · SET UP' : i < 0 ? 'GHOST LINK · NEW BOX' : 'SET UP · ' + (i + 1) + ' / ' + shown.length));
    box.append(el('h2', 'fr-h', title));
    if (lead) box.append(el('p', 'fr-lead', lead));
    sheet.append(box);
    document.body.append(sheet);
    return box;
  }
  function note(box) { if (msg) box.append(el('p', 'fr-msg', msg)); }
  function row(box, ...b) { const r = el('div', 'fr-row'); b.filter(Boolean).forEach(x => r.append(x)); box.append(r); return r; }
  function field(box, label, input) { const l = el('label', 'fr-field'); l.append(el('small', null, label), input); box.append(l); return input; }
  function input(type, ph, auto) { const i = el('input'); i.type = type; i.placeholder = ph || ''; if (auto) i.autocomplete = auto; i.spellcheck = false; i.autocapitalize = 'off'; return i; }

  function show() {
    const s = steps[at];
    ({ welcome, password, wifi, kinds, venue, decks, ready })[s]();
    const f = sheet && sheet.querySelector('input:not([type=checkbox])');
    if (f && s !== 'welcome' && matchMedia('(pointer: fine)').matches) f.focus();
  }

  // ---------- 0. WELCOME ----------
  function welcome() {
    const box = frame('THIS IS YOUR GHOST LINK', 'It reads the DJ gear: every deck, the tracklist and a TV view. Watching works already.');
    const ol = el('ol', 'fr-list');
    const left = steps.filter(s => !['welcome', 'ready'].includes(s));
    const words = { password: 'Your own password', wifi: 'The Wi-Fi it joins (or its own)', kinds: 'What kind of nights you do', venue: 'Your first venue', decks: 'Plug into the decks' };
    left.forEach(s => ol.append(el('li', null, words[s])));
    box.append(el('small', null, 'ABOUT 3 MINUTES'), ol);
    row(box, btn('JUST LOOK AROUND', 'ghostbtn', later), btn('START', 'fr-main', next));
    box.append(el('p', 'fr-foot', 'Later: STATUS -> SET UP THIS BOX.'));
  }

  // ---------- 1. PASSWORD ----------
  function password() {
    if (!fr.mustChange) return unlockStep();
    const box = frame('PICK YOUR OWN PASSWORD', 'Nobody can change anything on the box until you do.');
    const cur = field(box, 'THE PASSWORD IT CAME WITH (THE SAME AS THE GHOST LINK WI-FI)', input('password', '', 'current-password'));
    const nw = field(box, 'YOUR NEW PASSWORD (8 OR MORE)', input('password', '', 'new-password'));
    const see = el('label', 'fr-check'); const cb = el('input'); cb.type = 'checkbox';
    cb.onchange = () => { cur.type = nw.type = cb.checked ? 'text' : 'password'; };
    see.append(cb, document.createTextNode(' SHOW'));
    box.append(see);
    note(box);
    const go = btn('SAVE', 'fr-main', async () => {
      if (busy) return;
      if (nw.value.length < 8) { msg = 'Your new password needs 8 or more characters.'; return password(); }
      busy = true; go.disabled = true;
      const r = await send('/api/firstrun/password', { current: cur.value, next: nw.value });
      busy = false;
      if (r.ok) {
        cur.value = nw.value = '';
        await load(); await refreshAuth();
        msg = ''; passDone = true;
        saved('PASSWORD SAVED', 'This phone stays unlocked. Any other phone needs your new password. Write it down somewhere safe.');
        return;
      }
      msg = r.j.error || "Didn't save. Try again.";
      password();
    });
    row(box, btn('BACK', 'ghostbtn', back), go);
  }
  function unlockStep() {
    const box = frame('UNLOCK', 'Type the owner password to set the box up.');
    const pw = field(box, 'PASSWORD', input('password', '', 'current-password'));
    note(box);
    const go = btn('UNLOCK', 'fr-main', async () => {
      const r = await send('/api/unlock', { password: pw.value });
      pw.value = '';
      await refreshAuth(); await load();
      if (r.ok && fr.owner) { passDone = true; return next(); }
      msg = r.ok ? 'That is a crew code: setting up needs the owner password.' : 'Wrong password. After 5 tries, wait a minute.';
      unlockStep();
    });
    row(box, btn('BACK', 'ghostbtn', back), go);
  }
  function saved(title, text) {
    const box = frame(title, text);
    row(box, btn('NEXT', 'fr-main', next));
  }

  // ---------- 2. WI-FI ----------
  function wifi() {
    const st = (typeof S !== 'undefined' && S.status) || {};
    const box = frame('THE WI-FI IT JOINS',
      "Give it your home or venue Wi-Fi and it joins by itself, so any phone on that Wi-Fi opens it at ghostlink.local. No Wi-Fi? It makes its own GHOST LINK Wi-Fi: fine for the booth.");
    if ((fr.wifi || []).length) box.append(el('p', 'fr-ok', 'SAVED: ' + fr.wifi.join(', ')));
    const name = input('text', 'Wi-Fi name', 'off');
    const near = (st.wifiNearby || []).slice(0, 6);
    if (near.length) {
      box.append(el('small', null, 'NEARBY · TAP ONE'));
      const r = el('div', 'fr-chips');
      near.forEach(n => r.append(btn(n.ssid, 'mini', () => { name.value = n.ssid; pw.focus(); })));
      box.append(r);
    }
    field(box, 'WI-FI NAME (EXACTLY AS IT SHOWS)', name);
    const pw = field(box, 'ITS PASSWORD', input('password', '', 'off'));
    box.append(el('small', null, 'WHERE IS IT?'));
    const where = el('div', 'fr-chips');
    let home = true;
    const hb = btn('HOME', 'mini on', () => { home = true; hb.classList.add('on'); vb.classList.remove('on'); vn.hidden = true; });
    const vb = btn('A VENUE', 'mini', () => { home = false; vb.classList.add('on'); hb.classList.remove('on'); vn.hidden = false; vni.focus(); });
    where.append(hb, vb);
    box.append(where);
    const vni = input('text', 'Venue name', 'off'); vni.maxLength = 60;
    field(box, 'THE VENUE', vni);
    const vn = vni.closest('label'); vn.hidden = true;
    box.append(el('p', 'fr-foot', 'HOME: nights here are kept as practice, never counted as a show.'));
    note(box);
    const go = btn('SAVE', 'fr-main', async () => {
      const ssid = name.value.trim();
      if (!ssid) { msg = 'Type the Wi-Fi name, or tap SKIP.'; return wifi(); }
      if (pw.value && pw.value.length < 8) { msg = 'Wi-Fi passwords are at least 8 characters.'; return wifi(); }
      const vname = home ? 'HOME' : vni.value.trim();
      if (!vname) { msg = 'Name the venue (or pick HOME).'; return wifi(); }
      const r = await send('/api/venues', { name: vname, home, players: 0, wifi: [{ ssid, password: pw.value }] });
      if (!r.ok) { msg = r.j.error || "Didn't save."; return wifi(); }
      pw.value = '';
      wifiSaved = ssid;
      if (!home) venueSaved = vname;
      await load();
      next();
    });
    row(box, btn('SKIP: USE ITS OWN WI-FI', 'ghostbtn', next), go);
  }

  // ---------- 3. WHAT KIND OF NIGHTS DO YOU DO? ----------
  function kinds() {
    if (preview) return kindsPreview();
    const box = frame('WHAT KIND OF NIGHTS DO YOU DO?', 'Tick what fits. It only changes what shows up front. Nothing turns on.');
    const list = el('div', 'fr-kinds');
    const cat = fr.catalogue || [];
    const tick = k => {
      const l = el('label', 'fr-kind'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = ticks.has(k.id);
      cb.onchange = () => { if (cb.checked) ticks.add(k.id); else ticks.delete(k.id); };
      const t = el('span'); t.append(el('b', null, k.label), el('small', null, k.what));
      l.append(cb, t); return l;
    };
    const gear = el('div', 'fr-pair');
    cat.filter(k => k.id === 'cdj' || k.id === 'laptop').forEach(k => gear.append(tick(k)));
    list.append(gear);
    cat.filter(k => k.id !== 'cdj' && k.id !== 'laptop').forEach(k => list.append(tick(k)));
    box.append(list);
    note(box);
    row(box, btn('SKIP', 'ghostbtn', () => { preview = null; next(); }), btn('SEE WHAT IT DOES', 'fr-main', async () => {
      const r = await send('/api/firstrun/preview', { kinds: [...ticks] });
      if (!r.ok) { msg = r.j.error || "The box didn't answer."; return kinds(); }
      preview = r.j; saveNames = new Set((r.j.save || []).map(x => x.name));
      kindsPreview();
    }));
    box.append(el('p', 'fr-foot', 'Later: STATUS -> SET UP THIS BOX.'));
  }
  function kindsPreview() {
    const p = preview;
    const box = frame('YOUR NIGHTS', p.kinds.length ? 'Nothing changes until you tap SAVE, and nothing turns on then either.' : "Nothing ticked: STATUS stays as it is.");
    const label = k => { const s = document.querySelector('#go-' + CSS.escape(k) + ' > summary'); return s ? s.textContent : k.toUpperCase().replace(/-/g, ' '); };
    const visible = k => { const d = $('go-' + k); return d && !d.hidden; };
    const front = p.front.filter(visible).map(label).concat(p.links.map(l => l.label));
    if (front.length) { box.append(el('small', null, 'UP FRONT IN STATUS')); box.append(el('p', 'fr-line', front.join(' · '))); }
    if (p.builtins.length) { box.append(el('small', null, 'NIGHT PRESETS ALREADY THERE')); box.append(el('p', 'fr-line', p.builtins.join(' · '))); }
    (p.save || []).forEach(sg => {
      const l = el('label', 'fr-kind'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = saveNames.has(sg.name);
      cb.onchange = () => { if (cb.checked) saveNames.add(sg.name); else saveNames.delete(sg.name); };
      const t = el('span'); t.append(el('b', null, 'SAVE A PRESET: ' + sg.name), el('small', null, sg.base + ', plus ' + sg.plus.join(' · ') + '. Use it from SETTINGS · NIGHT PRESETS.'));
      l.append(cb, t); box.append(l);
    });
    if (p.stayOff.length) { box.append(el('small', null, 'STAYS OFF UNTIL YOU TURN IT ON')); box.append(el('p', 'fr-line', p.stayOff.join(' · '))); }
    if (p.hardStop) box.append(el('p', 'fr-quiet', p.hardStop));
    box.append(el('p', 'fr-foot', 'Everything else stays one tap away in STATUS. Change it any time: STATUS -> SET UP THIS BOX.'));
    note(box);
    row(box, btn('BACK', 'ghostbtn', () => { preview = null; kinds(); }), btn('SAVE', 'fr-main', async () => {
      const r = await send('/api/firstrun/kinds', { kinds: p.kinds, save: [...saveNames] });
      if (!r.ok) { msg = r.j.error || "Didn't save."; return kindsPreview(); }
      preview = null;
      await load();
      arrange();
      if (typeof NightSettings !== 'undefined' && NightSettings.load) NightSettings.load();
      next();
    }));
  }

  // ---------- 4. VENUE (only when there's none yet) ----------
  function venue() {
    const box = frame('YOUR FIRST VENUE', 'Where the next night is. The box remembers its Wi-Fi, gear and contacts there. Add more any time in STATUS -> VENUE.');
    const n = field(box, 'VENUE NAME', input('text', '', 'off')); n.maxLength = 60;
    const p = field(box, 'HOW MANY PLAYERS THERE (IF YOU KNOW)', input('number', '', 'off')); p.min = 0; p.max = 6; p.inputMode = 'numeric';
    note(box);
    row(box, btn('LATER', 'ghostbtn', next), btn('SAVE', 'fr-main', async () => {
      const name = n.value.trim();
      if (!name) { msg = 'Type the venue name, or tap LATER.'; return venue(); }
      const before = await get('/api/venues');
      const r = await send('/api/venues', { name, players: Math.max(0, Math.min(6, parseInt(p.value, 10) || 0)), wifi: [] });
      if (!r.ok) { msg = r.j.error || "Didn't save."; return venue(); }
      // Saving makes it tonight's venue; if the box is at HOME right now, keep it there (practice stays practice).
      if (before && before.current) await send('/api/venues/select', { id: before.current });
      venueSaved = name;
      next();
    }));
  }

  // ---------- 5. THE DECKS ----------
  function decks() {
    const box = frame('PLUG INTO THE DECKS', "A network cable from GHOST LINK to the DJ switch or router the players use (any free port, never straight into one player). Players in their normal LINK mode.");
    const live = el('div', 'fr-live'); box.append(live);
    const paint = st => {
      live.textContent = '';
      if (!st) { live.append(el('p', 'fr-msg', "Can't reach the box.")); return; }
      const n = st.players || 0, traffic = st.djLinkTraffic && st.djLinkTraffic.arriving;
      const add = (k, v, ok) => { const r = el('div', 'fr-fact' + (ok ? ' ok' : '')); r.append(el('small', null, k), el('b', null, v)); live.append(r); };
      add('DJ CABLE', st.cable === false ? 'NOT PLUGGED IN' : st.cable ? 'IN' : traffic ? 'IN' : 'NOT SEEN YET', st.cable || traffic);
      add('PLAYERS', n ? String(n) + ' FOUND' : traffic ? 'NONE YET: TURN THEM ON' : 'NONE YET', n > 0);
      if (n) live.append(el('p', 'fr-ok', 'Load a track: it shows on DECKS, and PLAYED keeps the night by itself.'));
      else live.append(el('p', 'fr-foot', 'Not at the decks today? That\'s fine: tap NEXT. DECKS says what to plug in when you are.'));
    };
    const tick = async () => paint(await get('/api/status'));
    tick();
    poll = setInterval(tick, 2000);
    row(box, btn('BACK', 'ghostbtn', back), btn('NEXT', 'fr-main', next));
  }

  // ---------- 6. READY ----------
  async function ready() {
    const box = frame('READY FOR YOUR FIRST NIGHT', null);
    const st = (await get('/api/status')) || {};
    await load();
    const ul = el('ul', 'fr-list fr-sum');
    const li = t => ul.append(el('li', null, t));
    li(fr.mustChange ? 'PASSWORD: still the one it came with. Pick yours before you change anything.' : 'PASSWORD: yours.');
    li((fr.wifi || []).length ? 'WI-FI: ' + fr.wifi.join(', ') + '. With none in range it makes its own GHOST LINK Wi-Fi.' : 'WI-FI: its own GHOST LINK Wi-Fi.');
    li('NIGHTS: ' + ((fr.kinds || []).length ? fr.catalogue.filter(k => fr.kinds.includes(k.id)).map(k => k.label).join(' · ') : 'not picked (STATUS shows everything as usual)'));
    if (venueSaved) li('VENUE: ' + venueSaved);
    li('DECKS: ' + (st.players ? st.players + ' players found' : 'none yet: plug in at the booth'));
    box.append(ul);
    box.append(el('p', 'fr-lead', 'On the night: STATUS says READY FOR TONIGHT, or the one thing to fix. PLAYED keeps the tracklist, TV MODE (STATUS -> SCREENS) puts it on a screen.'));
    const ssid = wifiSaved || null;
    const onIt = st.wifi && ssid && st.wifi.ssid === ssid;
    let join = null;
    if (ssid && !onIt) {
      join = btn('JOIN "' + ssid + '" NOW', 'ghostbtn', async () => {
        const r = await send('/api/wifi/join-now', {});
        box.append(el('p', 'fr-ok', r.ok ? 'Looking for "' + ssid + '". Your phone may drop off the GHOST LINK Wi-Fi: join "' + ssid + '" too, then open ghostlink.local.' : (r.j.error || "Didn't work.")));
        join.disabled = true;
      });
    }
    note(box);
    const finish = async tour => {
      if (fr.owner && !fr.mustChange) await send('/api/firstrun/done', { done: true });
      await load(); arrange();
      store.set('firstrunLater', '1');
      if (!tour) store.set('toured', '1'); // the tour stays in STATUS -> TOOLS; it doesn't pop up on the next visit
      close();
      mountStatus();
      location.hash = 'decks';
      if (tour && window.Tour) Tour.start();
    };
    if (join) row(box, join);
    row(box, btn('SHOW ME AROUND', 'ghostbtn', () => finish(true)), btn('OPEN DECKS', 'fr-main', () => finish(false)));
  }

  // ---------- STATUS: YOUR NIGHTS up front, SET UP THIS BOX ----------
  const marks = new Map(); // moved section -> the empty spot it came from
  function arrange() {
    const status = $('status');
    if (!status || !fr) return;
    marks.forEach((m, d) => { m.replaceWith(d); });
    marks.clear();
    let g = $('g-yournights'), links = $('frLinks');
    if (g) g.remove();
    if (links) links.remove();
    const front = (fr.front || []).map(k => $('go-' + k)).filter(Boolean);
    if (!front.length && !(fr.links || []).length) return;
    const anchor = $('go-presets') || $('lock');
    g = el('h3', 'group', 'YOUR NIGHTS'); g.id = 'g-yournights';
    anchor.after(g);
    let last = g;
    front.forEach(d => { const m = document.createComment('fr'); d.replaceWith(m); marks.set(d, m); last.after(d); last = d; });
    if ((fr.links || []).length) {
      links = el('div', 'buttons fr-links'); links.id = 'frLinks';
      fr.links.forEach(l => { const a = el('a', 'btn', l.label); a.href = '#' + l.go; links.append(a); });
      last.after(links);
    }
  }
  function mountStatus() {
    const host = $('setupBox');
    if (!host || !fr) return;
    host.textContent = '';
    const done = fr.done;
    host.append(el('div', 'note', done ? 'Set up. Run it again any time: password, Wi-Fi, the kind of nights, the decks.'
      : 'Not finished: the walk from a new box to the first night, about 3 minutes.'));
    if ((fr.kinds || []).length) host.append(el('div', 'note', 'YOUR NIGHTS: ' + fr.catalogue.filter(k => fr.kinds.includes(k.id)).map(k => k.label).join(' · ') + '. Their sections are up front; the rest are where they always are.'));
    const b = el('div', 'buttons');
    b.append(btn(done ? 'RUN SETUP AGAIN' : 'SET UP THIS BOX', null, () => open()), btn('WHAT KIND OF NIGHTS DO YOU DO?', null, () => open('kinds')));
    host.append(b);
  }

  async function start() {
    await load();
    if (!fr) return;
    arrange();
    mountStatus();
    const q = new URLSearchParams(location.search);
    const viewOnly = document.body.classList.contains('remote') || location.hostname.endsWith('trycloudflare.com')
      || q.has('embed') || q.has('role') || q.has('layout') || q.has('notour') || q.has('nosetup');
    if (fr.show && !viewOnly && store.get('firstrunLater') !== '1') open();
  }
  start();
  return { open, reload: async () => { await load(); arrange(); mountStatus(); } };
})();
