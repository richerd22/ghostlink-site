'use strict';
/*
 * SOUNDBOARD (DECISIONS #100), part of ANNOUNCEMENTS (#96). Richard: "soundboard with the ones that'll actually get used
 * at the top. allow ppl to add, customize, their own. pa announcements too - p much full scripts on each ... soundboard
 * style for the sfx. all easy to use. easy to access" / "only show if poss when there is audio card".
 *  - Only while ANNOUNCEMENTS is on AND the box sees a sound card's output: the SOUNDBOARD button in the tab strip,
 *    the full-screen view (also GO TO "soundboard" / "sfx" / "pa", #status/soundboard), and the board inside STATUS ->
 *    ANNOUNCEMENTS. Nothing on DECKS / NOW otherwise. Appears and goes live as the card is plugged in or pulled.
 *  - Tabs TOP · SFX · PA · TEST · MINE (the last one is remembered on this phone). SFX = big square pads; ARM (this
 *    session only) = a tap plays at once, otherwise hold 1 s. PA = cards by category with the full script, TAKE 1 / 2,
 *    hold 1 s. EMERGENCY: last, red, hold 2 s, then a confirm (STOP THE DECKS FIRST when DECK CONTROLS is on).
 *  - EDIT: pin, rename, hide, colour, default take, goofy, kind, script. BUILD: chain PA / MINE / PIECES into one.
 *  - Laptop: 1-9 play the first 9 pads while ARMED and the view is open; Esc = STOP (or close when nothing plays).
 * Round 2 (#100): THIS PHONE (the board plays on the phone itself: no card needed, no switch, still crew code; a
 * banner says so; with a card a PLAY ON: PA / THIS PHONE switch, PA by default, this tab only), DROPS (DJ SMOKEY),
 * PRESETS (ALL, CLEAN, PA ONLY, FESTIVAL + SAVE AS PRESET), QUICK TIME CALL from PIECES, TIME CALLS as compact chips.
 * Findable only where needed: the tab-strip button only with a card; GO TO and one line in SOUND IN otherwise.
 * Own file: if anything here throws, the rest of the dashboard carries on. Text from the box goes in as text only.
 * Uses app.js globals ($, S, post, unlocked, needUnlock, pending, note, renderStatus) and announce.js (Announce).
 */
const Soundboard = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const A = () => S.status && S.status.announce;
  const live = () => { const a = A(); return !!(a && a.on && a.card); };
  const secsTxt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const TABS = [['top', 'TOP'], ['sfx', 'SFX'], ['drops', 'DROPS'], ['pa', 'PA'], ['test', 'TEST'], ['mine', 'MINE']];
  // THIS PHONE: no card, or the switch says so. The switch (with a card) is for this browser tab only, PA by default.
  let playOn = 'pa';
  try { if (sessionStorage.getItem('sbPlayOn') === 'phone') playOn = 'phone'; } catch (e) {}
  const phone = () => !live() || playOn === 'phone';
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const sess = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };

  let data = null, byId = {}, fetchedAt = 0, tab = store('sbTab') || 'top', armed = sess('sbArm') === '1', showAll = false,
    editing = false, editId = null, build = null, takePick = {}, audio = null, ask = null;
  if (!TABS.some(t => t[0] === tab)) tab = 'top';

  // ---------- the parts ----------
  const root = el('div', 'sb'); root.id = 'sb';
  const bar = el('div', 'sb-bar');
  const tabsEl = el('div', 'sb-tabs'); tabsEl.setAttribute('role', 'tablist');
  const armBtn = btn('ARM', 'sb-arm', () => { armed = !armed; sess('sbArm', armed ? '1' : '0'); draw(); });
  armBtn.title = 'ARMED: a tap plays at once (this phone, until you close the tab). Off: hold 1 s.';
  const editBtn = btn('EDIT', 'sb-editbtn', () => { editing = !editing; editId = null; draw(); });
  const addBtn = btn('+ ADD A SOUND', 'sb-add', () => openAdd());
  bar.append(tabsEl, armBtn, editBtn, addBtn);
  // THIS PHONE banner + PLAY ON switch, and the PRESETS row: always at the top of the board.
  const modeEl = el('div', 'sb-mode');
  const presetsEl = el('div', 'sb-presets');
  const nowEl = el('div', 'sb-now'); nowEl.hidden = true;
  const nowText = el('span');
  nowEl.append(nowText, btn('■ STOP', 'stop', () => stop()));
  const askEl = el('div', 'sb-ask'); askEl.hidden = true;
  const tools = el('div', 'sb-tools');
  const body = el('div', 'sb-body');
  const panel = el('div', 'sb-panel'); panel.hidden = true;   // EDIT one sound, or BUILD
  const foot = el('div', 'sb-foot');
  const noteEl = el('div', 'note'); noteEl.id = 'sbNote'; noteEl.setAttribute('aria-live', 'polite');
  root.append(modeEl, presetsEl, bar, nowEl, askEl, panel, tools, body, foot, noteEl);
  root.addEventListener('pointerdown', () => { try { ac(); } catch (e) {} }, true); // phones only start sound on a touch
  const say = (t, warn) => { noteEl.textContent = t || ''; noteEl.classList.toggle('warn', !!warn); };

  // Home in STATUS -> ANNOUNCEMENTS (above the add panel); the full-screen view borrows it while open.
  const home = $('annBody');
  if (home) home.insertBefore(root, home.firstChild);
  const view = el('div', 'sb-view'); view.id = 'soundboard'; view.hidden = true;
  view.setAttribute('role', 'dialog'); view.setAttribute('aria-label', 'SOUNDBOARD');
  const viewHead = el('div', 'sb-view-head');
  viewHead.append(el('b', null, 'SOUNDBOARD'), btn('✕ CLOSE', 'mini', () => close()));
  view.append(viewHead);
  document.body.appendChild(view);

  // The tab-strip button, only while it's usable.
  const head = btn('', 'sb-head', () => open());
  head.append(el('span', 'nav-l', 'SOUNDBOARD'), el('span', 'nav-s', '\u266A\uFE0E'));
  head.hidden = true;
  head.title = 'SOUNDBOARD: SFX, PA announcements, test sounds';
  head.setAttribute('aria-label', 'SOUNDBOARD');
  const nav = document.querySelector('header nav');
  if (nav) nav.insertBefore(head, nav.querySelector('a[data-view="help"]')); // before HELP: on screen in the corner window

  function open() {
    if (!A()) return; // demo / WATCH FROM HOME: no box behind it
    const add = $('annAdd');
    view.append(root);
    if (add) view.append(add);
    view.hidden = false;
    document.body.classList.add('sb-open');
    refresh(true);
  }
  function close() {
    if (view.hidden) return;
    view.hidden = true;
    document.body.classList.remove('sb-open');
    if (home) { home.insertBefore(root, home.firstChild); const add = $('annAdd'); if (add) home.insertBefore(add, $('annNote')); }
    if (location.hash === '#status/soundboard') history.replaceState(null, '', '#status/announce');
    if (audio) { audio.pause(); audio = null; }
    phoneStop();
  }
  const isOpen = () => !view.hidden;
  const shown = () => isOpen() || (home && !home.hidden && home.offsetParent !== null);

  function locked() {
    if (unlocked) return false;
    close();
    pending = null;
    needUnlock();
    return true;
  }

  // ---------- data ----------
  async function refresh(force) {
    if (!force && Date.now() - fetchedAt < 15000) return;
    fetchedAt = Date.now();
    try {
      const r = await fetch('/api/announce', { cache: 'no-store' });
      if (r.ok) got(await r.json());
    } catch (e) {}
  }
  let sig = '';
  function got(j) {
    if (!j || !j.board) return;
    const s = JSON.stringify(j.board) + '|' + j.used + '|' + j.free;
    data = j;
    byId = {};
    j.board.sounds.forEach(x => byId[x.id] = x);
    if (s === sig) return;
    sig = s;
    draw();
  }

  // ---------- sending ----------
  async function send(cmd, b) {
    if (locked()) return null;
    const r = await post('/api/announce/' + cmd, b || {});
    const j = await r.json().catch(() => ({}));
    return { r, j };
  }
  async function stop() {
    if (here) { phoneStop(); say('Stopped (this phone).'); if (!(A() && A().playing)) return; }
    const r = await fetch('/api/announce/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    say(j.text || (r && r.ok ? 'Stopped.' : 'Not sent.'), !(r && r.ok));
  }
  // ---------- THIS PHONE: Web Audio, same takes and sequences (the box renders a sequence with its gap) ----------
  let actx = null, here = null; const bufs = new Map();
  function ac() {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; actx = new C(); }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function decodeHere(ctx, buf) {
    return new Promise((ok, no) => { const p = ctx.decodeAudioData(buf, ok, no); if (p && p.then) p.then(ok, no); });
  }
  function phoneStop() {
    if (!here) return;
    const h = here; here = null;
    try { h.src.onended = null; h.src.stop(); } catch (e) {}
    tick();
  }
  async function phonePlay(id, url, kind, name, secs) {
    if (locked()) return;
    if (here && here.kind !== 'sfx' && kind === 'sfx') return say('Something is playing here (' + here.name + '). STOP it first.', true);
    if (here && here.kind !== 'sfx') return say('Something is playing here (' + here.name + '). STOP it first.', true);
    const ctx = ac();
    if (!ctx) return say("This browser can't play sound here.", true);
    let b = bufs.get(url);
    try {
      if (!b) {
        const r = await fetch(url, { cache: 'no-store' });
        if (r.status === 401) { setUnlocked(false); return locked(); }
        if (!r.ok) { const j = await r.json().catch(() => ({})); return say(j.error || "Couldn't get that sound from the box.", true); }
        b = await decodeHere(ctx, await r.arrayBuffer());
        bufs.set(url, b);
        if (bufs.size > 40) bufs.delete(bufs.keys().next().value);
      }
    } catch (e) { return say("Couldn't play that one here.", true); }
    if (here) phoneStop(); // an SFX playing here: the new sound cuts it
    const src = ctx.createBufferSource();
    src.buffer = b; src.connect(ctx.destination);
    const h = { src, id, kind, name, secs: b.duration, since: Date.now() };
    src.onended = () => { if (here === h) { here = null; tick(); } };
    here = h;
    src.start();
    say('Playing ' + name + ' on this phone.');
    tick();
    if (id) post('/api/announce/heard', { id }).catch(() => {}); // counts for TOP; nothing reached the room
  }

  async function play(x, extra) {
    if (!x) return;
    hideAsk();
    if (phone()) {
      const em = x.warn === 'emergency';
      if (em && !(extra && extra.confirm)) return emergencyAsk(x);
      return phonePlay(x.id, fileUrl(x, takePick[x.id]), x.kind === 'sfx' ? 'sfx' : 'pa', x.name, x.secs);
    }
    const b = Object.assign({ id: x.id }, extra || {});
    if (takePick[x.id]) b.take = takePick[x.id];
    const res = await send('play', b);
    if (!res) return;
    const { r, j } = res;
    if (r.status === 409 && j.ask === 'EMERGENCY') return emergencyAsk(x, b, j.text);
    if (r.status === 409 && j.ask) {
      return showAsk(j.text, [['PLAY IT', () => play(x, Object.assign({}, extra, { over: true }))]]);
    }
    if (r.status !== 401) say(j.text || j.error || (r.ok ? 'Playing.' : 'Not played.'), !r.ok);
    if (r.ok) setTimeout(() => refresh(true), 600); // the play count moves the order
  }
  function emergencyAsk(x, b, text) {
    const rule = (data && data.board.emergencyRule) || 'GHOST LINK is not a fire alarm or evacuation system. The venue\'s alarm and PA come first.';
    const acts = [[phone() ? 'PLAY IT ON THIS PHONE' : 'PLAY IT NOW', () => play(x, { confirm: true, over: true })]];
    if (!phone() && S.status && S.status.ghostDeck) acts.unshift(['STOP THE DECKS FIRST', async () => {
      const r = await post('/api/ghostdeck/stop', {});
      if (!r.ok) { const j = await r.json().catch(() => ({})); say(j.text || j.error || "Couldn't stop the decks. Playing anyway is still up to you.", true); }
      play(x, { confirm: true, over: true });
    }]);
    showAsk(x.name + ' · ' + rule, acts, true);
  }
  function showAsk(text, acts, danger) {
    askEl.textContent = '';
    askEl.classList.toggle('danger', !!danger);
    askEl.append(el('span', null, text));
    const row = el('div', 'buttons');
    acts.forEach(([t, fn]) => row.append(btn(t, danger ? 'danger' : '', () => { hideAsk(); fn(); })));
    row.append(btn('CANCEL', '', () => { hideAsk(); say('Cancelled.'); }));
    askEl.append(row);
    askEl.hidden = false;
    askEl.scrollIntoView({ block: 'nearest' });
  }
  function hideAsk() { askEl.hidden = true; }

  // Hear it on this phone only (nothing goes to the room).
  function listen(url, b) {
    if (locked()) return;
    const label = b.textContent;
    if (audio) { audio.pause(); const was = audio.btn; audio = null; if (was) was.textContent = was.dataset.l; if (was === b) return; }
    audio = new Audio(url);
    audio.btn = b; b.dataset.l = label; b.textContent = '■ STOP LISTENING';
    const done = () => { if (audio && audio.btn === b) audio = null; b.textContent = b.dataset.l; };
    audio.addEventListener('ended', done);
    audio.play().catch(done);
  }
  const fileUrl = (x, take) => '/api/announce/file?id=' + encodeURIComponent(x.id) + (take ? '&take=' + take : '');

  // Press and hold (ms), with a fill. 0 = a tap plays.
  function holdTo(b, ms, fire) {
    b.style.setProperty('--hold', ms + 'ms');
    let t = null, fired = false;
    const end = () => { clearTimeout(t); b.classList.remove('holding'); };
    b.addEventListener('pointerdown', e => {
      if (e.button) return;
      fired = false;
      if (!ms) return;
      b.classList.add('holding');
      t = setTimeout(() => { fired = true; end(); fire(); }, ms);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, end));
    b.addEventListener('click', () => {
      if (!ms) return fire();
      if (fired) { fired = false; return; }
      say('Hold it ' + (ms / 1000) + ' s to play' + (b.classList.contains('sb-pad') ? ' (or ARM for a tap).' : '.'));
    });
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('keydown', e => { if (e.key === 'Enter' && !ms) { e.preventDefault(); fire(); } });
  }

  // ---------- drawing ----------
  const visible = x => x && (showAll || (!x.hidden && !(data.board.hideGoofy && x.goofy)));
  function list(t) {
    const ids = (data && data.board.tabs[t]) || [];
    return ids.map(i => byId[i]).filter(Boolean);
  }
  let padsNow = [];

  function drawMode() {
    modeEl.textContent = '';
    const a = A();
    if (phone()) {
      const b = el('div', 'sb-phone');
      b.append(el('b', null, 'PLAYS ON THIS PHONE, not the PA'));
      b.append(el('span', null, live() ? ' · nothing reaches the room.' : a && a.card ? ' · ANNOUNCEMENTS is off: nothing reaches the room.' : ' · no sound card on the box: nothing reaches the room.'));
      modeEl.append(b);
    }
    if (live()) {
      const sw = el('div', 'sb-playon');
      sw.append(el('small', null, 'PLAY ON'));
      [['pa', 'PA'], ['phone', 'THIS PHONE']].forEach(([k, l]) => {
        const b = btn(l, playOn === k ? 'on' : '', () => { playOn = k; try { sessionStorage.setItem('sbPlayOn', k); } catch (e) {} draw(); });
        b.setAttribute('aria-pressed', String(playOn === k));
        sw.append(b);
      });
      modeEl.append(sw);
    }
  }
  let presetName = null;
  function drawPresets() {
    presetsEl.textContent = '';
    if (!data || !data.board.presets) return;
    const row = el('div', 'sb-chiprow');
    row.append(el('small', null, 'PRESET'));
    data.board.presets.forEach(p => {
      const b = btn(p.name, 'chip' + (p.id === data.board.preset ? ' on' : ''), async () => {
        const res = await send('preset', { action: 'apply', id: p.id });
        if (!res) return;
        say(res.j.text || '', !res.r.ok);
        if (res.r.ok) { showAll = false; await refresh(true); tab = data.board.startTab || tab; store('sbTab', tab); draw(); }
      });
      b.setAttribute('aria-pressed', String(p.id === data.board.preset));
      row.append(b);
    });
    const cur = data.board.presets.find(p => p.id === data.board.preset);
    if (presetName === null) {
      row.append(btn('SAVE AS PRESET', 'chip add', () => { presetName = ''; drawPresets(); }));
      if (cur && !cur.builtin) {
        row.append(btn('RENAME', 'chip', () => { presetName = cur.name; drawPresets(); }));
        const del = btn('DELETE', 'chip', async () => {
          if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'SURE?'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'DELETE'; }, 3000); return; }
          const res = await send('preset', { action: 'delete', id: cur.id });
          if (res) { say(res.j.text || '', !res.r.ok); refresh(true); }
        });
        row.append(del);
      }
    } else {
      const renaming = presetName !== '' && cur && !cur.builtin;
      const inp = el('input'); inp.value = presetName; inp.placeholder = 'NAME: FRIDAY'; inp.maxLength = 40;
      inp.setAttribute('aria-label', 'Preset name'); inp.autocapitalize = 'characters';
      row.append(inp);
      row.append(btn(renaming ? 'RENAME' : 'SAVE', 'chip on', async () => {
        const res = await send('preset', renaming ? { action: 'rename', id: cur.id, name: inp.value } : { action: 'save', name: inp.value, tab });
        if (!res) return;
        say(res.j.text || '', !res.r.ok);
        if (res.r.ok) { presetName = null; refresh(true); }
      }));
      row.append(btn('CANCEL', 'chip', () => { presetName = null; drawPresets(); }));
      setTimeout(() => inp.focus(), 0);
    }
    presetsEl.append(row);
    if (presetName === '') presetsEl.append(el('div', 'sb-hint', 'Saves what is pinned, hidden and goofy now, HIDE THE GOOFY ONES, the tabs and the tab you are on.'));
  }

  function draw() {
    drawMode();
    drawPresets();
    const shownTabs = (data && data.board.shownTabs) || TABS.map(t => t[0]);
    if (!shownTabs.includes(tab)) tab = (data && data.board.startTab) || shownTabs[0];
    tabsEl.textContent = '';
    TABS.filter(([k]) => shownTabs.includes(k)).forEach(([k, l]) => {
      const b = btn(l, k === tab ? 'on' : '', () => { tab = k; store('sbTab', k); editId = null; build = null; panel.hidden = true; draw(); });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(k === tab));
      tabsEl.append(b);
    });
    armBtn.textContent = armed ? 'ARMED' : 'ARM';
    armBtn.classList.toggle('on', armed);
    armBtn.setAttribute('aria-pressed', String(armed));
    editBtn.classList.toggle('on', editing);
    editBtn.textContent = editing ? 'DONE' : 'EDIT';
    body.textContent = ''; tools.textContent = ''; foot.textContent = '';
    padsNow = [];
    if (!data) { body.append(el('div', 'note', 'Loading the board…')); return; }
    const all = list(tab);
    const vis = all.filter(visible);
    const gone = all.length - vis.length;
    if (tab === 'sfx' || tab === 'top' || tab === 'drops') {
      if (tab === 'drops' && data.board.hideGoofy && !showAll) body.append(el('div', 'note', 'DROPS are hidden by HIDE THE GOOFY ONES (SFX tab). SHOW ALL brings them back for now.'));
      else if (tab === 'drops') tools.append(el('span', 'sb-hint', 'DJ SMOKEY style hype drops. On a laptop, point at a pad to read the words.'));
      if (tab === 'sfx' || tab === 'drops') {
        const g = btn(data.board.hideGoofy ? 'GOOFY ONES HIDDEN · SHOW THEM' : 'HIDE THE GOOFY ONES', 'mini' + (data.board.hideGoofy ? ' on' : ''), async () => {
          const res = await send('goofy', { hide: !data.board.hideGoofy });
          if (res) { say(res.j.text || '', !res.r.ok); refresh(true); }
        });
        tools.append(g);
      }
      if (gone > 0 || showAll) tools.append(btn(showAll ? 'HIDE THEM AGAIN' : 'SHOW ALL (' + gone + ' hidden)', 'mini', () => { showAll = !showAll; draw(); }));
      if (editing) tools.append(el('span', 'sb-hint', 'EDIT: tap a pad to change it.'));
      if (tab === 'top' && !vis.length) body.append(el('div', 'note', 'Nothing yet. The most used sounds show up here, plus the ones you PIN.'));
      const grid = el('div', 'sb-grid' + (tab === 'drops' ? ' wide' : ''));
      vis.forEach(x => grid.append(x.kind === 'sfx' ? pad(x) : (tab === 'top' ? pad(x) : card(x))));
      body.append(grid);
      if (armed) foot.append(el('div', 'sb-hint', 'ARMED: a tap plays at once. A new SFX cuts the one playing, never an announcement. Laptop: 1-9, Esc = STOP.'));
    } else if (tab === 'pa') {
      const tb = el('div', 'buttons');
      tb.append(btn('BUILD ONE', 'mini', () => openBuild(null)));
      if (gone > 0 || showAll) tb.append(btn(showAll ? 'HIDE THEM AGAIN' : 'SHOW ALL (' + gone + ' hidden)', 'mini', () => { showAll = !showAll; draw(); }));
      tools.append(tb);
      quickCall();
      let cat = null, box = null;
      vis.forEach(x => {
        if (x.category !== cat) {
          cat = x.category;
          const h = el('h3', 'sb-cat' + (cat === 'EMERGENCY' ? ' em' : ''), cat);
          body.append(h);
          if (cat === 'EMERGENCY') body.append(el('div', 'note warn', data.board.emergencyRule));
          box = el('div', cat === 'TIME CALLS' ? 'sb-chips' : 'sb-cards');
          body.append(box);
        }
        box.append(cat === 'TIME CALLS' ? chip(x) : card(x));
      });
    } else if (tab === 'test') {
      body.append(el('div', 'note', 'Fader down before any of these, then bring it up slowly. Each one says what it is for.'));
      const box = el('div', 'sb-cards');
      all.forEach(x => box.append(card(x)));
      body.append(box);
    } else {
      const tb = el('div', 'buttons');
      tb.append(btn('BUILD ONE', 'mini', () => openBuild(null)));
      tools.append(tb);
      if (!all.length) body.append(el('div', 'note', 'Nothing of your own yet. + ADD A SOUND: pick one file or several (voice memos, mp3, wav), choose SFX, PA or PIECE, and they are on the board.'));
      const box = el('div', 'sb-cards');
      all.forEach(x => box.append(card(x)));
      body.append(box);
    }
    // room, packs, problems
    const used = data.used || 0, free = data.free;
    const room = el('div', 'sb-room');
    room.textContent = 'YOURS ' + mb(used) + (free != null ? ' · ' + gb(Math.max(0, free - (data.keepFree || 0))) + ' free for sounds' : '') +
      (data.board.packs.length ? ' · PACKS: ' + data.board.packs.map(p => p.name + ' (' + p.count + ')').join(', ') : '');
    foot.append(room);
    const fb = el('div', 'buttons');
    fb.append(btn('RELOAD PACKS', 'mini', async () => {
      const res = await send('reload', {});
      if (res) { say(res.j.text || '', !res.r.ok); refresh(true); }
    }));
    foot.append(fb);
    if (data.board.problems.length) {
      const d = el('details', 'sb-problems');
      d.append(el('summary', null, data.board.problems.length + " pack sound" + (data.board.problems.length === 1 ? '' : 's') + " couldn't be read"));
      const ul = el('ul');
      data.board.problems.forEach(p => ul.append(el('li', null, p)));
      d.append(ul);
      foot.append(d);
    }
    tick();
  }
  const mb = b => (Math.round(b / 104857.6) / 10) + ' MB';
  const gb = b => b >= 1073741824 ? (Math.round(b / 107374182.4) / 10) + ' GB' : mb(b);

  function pad(x) {
    const b = el('button', 'sb-pad' + (x.colour ? ' c-' + x.colour : '') + (x.hidden ? ' is-hidden' : '') + (x.kind === 'pa' ? ' is-pa' : ''));
    b.type = 'button';
    b.dataset.id = x.id;
    const n = padsNow.length;
    padsNow.push(x);
    if (n < 9 && armed) b.append(el('i', 'sb-key', String(n + 1)));
    b.append(el('b', null, x.name));
    b.append(el('small', null, (x.pinned ? '★ ' : '') + (x.kind === 'pa' ? 'PA · ' : '') + x.secs + ' s'));
    if (x.script) b.title = x.script;
    if (editing) b.addEventListener('click', () => openEdit(x));
    else holdTo(b, x.kind === 'sfx' && armed ? 0 : 1000, () => play(x));
    return b;
  }

  // Pieces read as one announcement: a full stop where one piece ends and the next starts a new sentence.
  function sentence(bits) {
    return bits.filter(Boolean).map(t => t.trim()).reduce((acc, t) => {
      if (!acc) return t;
      return acc + (/[.!?,:;]$/.test(acc) || !/^[A-Z]/.test(t) ? ' ' : '. ') + t;
    }, '');
  }

  // TIME CALLS: one compact row of chips, not a wall of cards. Hold 1 s like any announcement.
  function chip(x) {
    const b = el('button', 'sb-chip' + (x.colour ? ' c-' + x.colour : '') + (x.hidden ? ' is-hidden' : ''));
    b.type = 'button'; b.dataset.id = x.id;
    b.append(el('b', null, x.name.replace(/^THE /, '')), el('small', null, x.secs + ' s'));
    if (x.script) b.title = x.script;
    if (editing) b.addEventListener('click', () => openEdit(x));
    else holdTo(b, 1000, () => play(x));
    return b;
  }

  // QUICK TIME CALL: [lead ▾] [time ▾] [opener ▾] [closer ▾], from the PIECES (pack and your own). PLAY or SAVE.
  const QC_KEY = 'sbQuick';
  function quickCall() {
    const pieces = data.board.sounds.filter(s => s.kind === 'piece');
    const by = r => pieces.filter(p => p.role === r);
    const leads = by('lead'), times = by('time');
    if (!leads.length || !times.length) return;
    let pick = {};
    try { pick = JSON.parse(store(QC_KEY) || '{}') || {}; } catch (e) {}
    const find = (list, re) => (list.find(p => re.test(p.name)) || list[0] || {}).id || '';
    const d = { lead: find(leads, /BAR CLOSES/), time: find(times, /FIFTEEN/), opener: find(by('opener'), /^ATTENTION PLEASE/), closer: find(by('closer'), /^THANK YOU$/) };
    const box = el('div', 'sb-quick');
    box.append(el('h3', 'sb-cat', 'QUICK TIME CALL'));
    const row = el('div', 'sb-quick-row');
    const sel = (role, list, optional, label) => {
      const s = el('select'); s.setAttribute('aria-label', label);
      if (optional) s.append(new Option('(no ' + label.toLowerCase() + ')', ''));
      list.forEach(p => s.append(new Option(p.name, p.id)));
      const want = pick[role] !== undefined ? pick[role] : d[role];
      s.value = list.some(p => p.id === want) || (optional && want === '') ? want : (optional ? '' : list[0].id);
      s.addEventListener('change', () => { pick[role] = s.value; store(QC_KEY, JSON.stringify(pick)); words(); });
      s.dataset.role = role;
      return s;
    };
    const sOpen = sel('opener', by('opener'), true, 'OPENER'), sLead = sel('lead', leads, false, 'WHAT'),
      sTime = sel('time', times, false, 'WHEN'), sClose = sel('closer', by('closer'), true, 'CLOSER');
    row.append(sLead, sTime, sOpen, sClose);
    box.append(row);
    const said = el('p', 'sb-desc');
    const parts = () => [sOpen.value, sLead.value, sTime.value, sClose.value].filter(Boolean);
    const words = () => { said.textContent = '"' + sentence(parts().map(id => byId[id] && (byId[id].script || byId[id].name))) + '"'; };
    words();
    box.append(said);
    const acts = el('div', 'sb-acts');
    const playB = el('button', 'sb-play', 'PLAY'); playB.type = 'button';
    holdTo(playB, 1000, () => quickPlay(parts()));
    acts.append(playB);
    acts.append(btn('LISTEN', 'mini', e => listen('/api/announce/preview?parts=' + parts().map(encodeURIComponent).join(',') + '&gap=' + data.board.gapMs, e.currentTarget)));
    acts.append(btn('SAVE', 'mini', async () => {
      const name = [byId[sLead.value], byId[sTime.value]].map(x => x && x.name).filter(Boolean).join(' ');
      const res = await send('seq', { name, parts: parts(), gapMs: data.board.gapMs });
      if (res) { say(res.r.ok ? 'Saved ' + name + '. It is on the PA tab under MINE.' : (res.j.text || 'Not saved.'), !res.r.ok); if (res.r.ok) refresh(true); }
    }));
    box.append(acts);
    tools.append(box);
  }
  async function quickPlay(parts) {
    if (!parts.length) return;
    hideAsk();
    const name = parts.map(id => byId[id] && byId[id].name).filter(Boolean).join(' ');
    if (phone()) return phonePlay(null, '/api/announce/preview?parts=' + parts.map(encodeURIComponent).join(',') + '&gap=' + data.board.gapMs, 'pa', name, 0);
    const go = async over => {
      const res = await send('play', { parts, gapMs: data.board.gapMs, over });
      if (!res) return;
      if (res.r.status === 409 && res.j.ask) return showAsk(res.j.text, [['PLAY IT', () => go(true)]]);
      if (res.r.status !== 401) say(res.j.text || res.j.error || (res.r.ok ? 'Playing.' : 'Not played.'), !res.r.ok);
    };
    go(false);
  }

  function card(x) {
    const em = x.warn === 'emergency';
    const c = el('div', 'sb-card' + (x.colour ? ' c-' + x.colour : '') + (em ? ' em' : '') + (x.hidden ? ' is-hidden' : ''));
    c.dataset.id = x.id;
    const top = el('div', 'sb-card-top');
    const t = el('div', 'sb-card-name');
    t.append(el('b', null, (x.pinned ? '★ ' : '') + x.name));
    const meta = [x.secs + ' s'];
    if (x.seq) meta.push((x.parts || []).length + ' parts');
    if (x.source === 'mine') meta.push(x.kind === 'piece' ? 'PIECE' : x.kind.toUpperCase());
    if (x.source === 'built') meta.push('BUILT');
    if (x.hidden) meta.push('HIDDEN');
    t.append(el('small', null, meta.join(' · ')));
    top.append(t);
    const acts = el('div', 'sb-acts');
    const playB = el('button', 'sb-play' + (em ? ' danger' : ''), em ? 'HOLD 2 s' : 'PLAY');
    playB.type = 'button';
    holdTo(playB, em ? 2000 : 1000, () => play(x));
    acts.append(playB);
    acts.append(btn('LISTEN', 'mini', e => listen(fileUrl(x, takePick[x.id]), e.currentTarget)));
    if (x.source === 'built') acts.append(btn('EDIT', 'mini', () => openBuild(x)));
    else acts.append(btn('EDIT', 'mini', () => openEdit(x)));
    top.append(acts);
    c.append(top);
    if (x.takes > 1) {
      const tk = el('div', 'sb-takes');
      const cur = takePick[x.id] || x.take;
      for (let i = 1; i <= x.takes; i++) {
        const b = btn('TAKE ' + i + (i === x.take ? ' ·' : ''), i === cur ? 'on' : '', () => { takePick[x.id] = i; draw(); });
        b.title = i === x.take ? 'The box plays this one unless you pick another' : 'Another read of the same script';
        tk.append(b);
      }
      c.append(tk);
    }
    if (x.describe) c.append(el('p', 'sb-desc', x.describe));
    if (x.credit) c.append(el('small', 'sb-credit', 'From ' + x.credit));
    if (x.script) {
      const d = el('details', 'sb-script');
      const s = el('summary', null, x.script.length > 90 ? x.script.slice(0, 88) + '… FULL SCRIPT' : x.script);
      d.append(s, el('p', null, x.script));
      if (x.script.length <= 90) d.classList.add('short');
      c.append(d);
      if (x.scriptPartial) c.append(el('small', 'sb-partial', 'Script from the file name: may be cut short. EDIT to fix it.'));
    } else if (x.kind === 'pa' && x.source === 'mine') c.append(el('small', 'sb-partial', 'No script yet: EDIT to add the words.'));
    if (x.missingParts) c.append(el('small', 'sb-partial', 'A piece of this one is gone: EDIT it in BUILD.'));
    if (editId === x.id) c.classList.add('editing');
    return c;
  }

  // ---------- EDIT one sound ----------
  function openEdit(x) {
    build = null;
    editId = x.id;
    panel.textContent = '';
    panel.hidden = false;
    panel.append(el('h3', null, 'EDIT · ' + x.name));
    const name = el('input'); name.value = x.name === x.baseName ? '' : x.name; name.placeholder = x.baseName; name.maxLength = 40;
    name.setAttribute('aria-label', 'Name on the board'); name.autocapitalize = 'characters';
    panel.append(row('NAME', name));
    const sw = el('div', 'sb-swatches');
    let colour = x.colour || '';
    const swAll = [''].concat(data.board.colours);
    swAll.forEach(cname => {
      const b = btn(cname ? '' : 'NONE', 'sw' + (cname ? ' c-' + cname : '') + (cname === colour ? ' on' : ''), () => { colour = cname; sw.querySelectorAll('.sw').forEach(e => e.classList.toggle('on', e === b)); });
      b.setAttribute('aria-label', cname || 'no colour');
      sw.append(b);
    });
    panel.append(row('COLOUR', sw));
    const flags = el('div', 'buttons');
    const f = { pinned: x.pinned, hidden: x.hidden, goofy: x.goofy };
    const tog = (k, on, off) => { const b = btn('', 'mini', () => { f[k] = !f[k]; paint(); }); const paint = () => { b.textContent = f[k] ? on : off; b.classList.toggle('on', !!f[k]); }; paint(); return b; };
    flags.append(tog('pinned', '★ PINNED', 'PIN TO TOP'), tog('hidden', 'HIDDEN', 'HIDE'));
    if (x.kind === 'sfx') flags.append(tog('goofy', 'GOOFY', 'MARK GOOFY'));
    panel.append(flags);
    let take = x.take;
    if (x.takes > 1) {
      const tk = el('div', 'sb-takes');
      for (let i = 1; i <= x.takes; i++) {
        const b = btn('TAKE ' + i, i === take ? 'on' : '', () => { take = i; tk.querySelectorAll('button').forEach(e => e.classList.toggle('on', e === b)); });
        tk.append(b);
        const l = btn('▶', 'mini', e => listen(fileUrl(x, i), e.currentTarget)); l.setAttribute('aria-label', 'Listen to take ' + i);
        tk.append(l);
      }
      panel.append(row('DEFAULT TAKE', tk));
    }
    let kind = x.kind;
    if (x.source === 'mine') {
      const kd = el('div', 'sb-takes');
      [['sfx', 'SFX'], ['pa', 'PA'], ['piece', 'PIECE']].forEach(([k, l]) => {
        const b = btn(l, k === kind ? 'on' : '', () => { kind = k; kd.querySelectorAll('button').forEach(e => e.classList.toggle('on', e === b)); });
        kd.append(b);
      });
      panel.append(row('KIND', kd));
    }
    let script = null;
    if (x.kind === 'pa' || x.kind === 'piece') {
      script = el('textarea'); script.rows = 4; script.maxLength = 2000; script.value = x.script || '';
      script.setAttribute('aria-label', 'Script');
      panel.append(row('SCRIPT', script));
      if (x.source === 'pack') panel.append(el('small', 'sb-hint', 'Saved on this box only. Empty = back to the pack\'s words.'));
    }
    const acts = el('div', 'buttons');
    acts.append(btn('SAVE', '', async () => {
      const b = { id: x.id, name: name.value.trim(), colour, pinned: f.pinned, hidden: f.hidden };
      if (x.kind === 'sfx') b.goofy = f.goofy;
      if (x.takes > 1) b.take = take;
      if (x.source === 'mine' && kind !== x.kind) b.kind = kind;
      if (script && script.value.trim() !== (x.script || '')) b.script = script.value.trim();
      const res = await send('custom', b);
      if (!res) return;
      say(res.r.ok ? 'Saved ' + (b.name || x.baseName).toUpperCase() + '.' : (res.j.text || 'Not saved.'), !res.r.ok);
      if (res.r.ok) { panel.hidden = true; editId = null; refresh(true); }
    }));
    acts.append(btn('CANCEL', '', () => { panel.hidden = true; editId = null; draw(); }));
    if (x.source === 'mine') {
      const del = btn('DELETE', 'mini', async () => {
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'SURE? TAP AGAIN'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'DELETE'; }, 3000); return; }
        if (locked()) return;
        const r = await post('/api/announce/delete', { id: x.id });
        say(r.ok ? 'Deleted ' + x.name + '.' : 'Not deleted.', !r.ok);
        panel.hidden = true; editId = null; refresh(true);
      });
      acts.append(del);
    } else if (x.source === 'pack') acts.append(el('small', 'sb-hint', 'From a sound pack: HIDE it if you never want it.'));
    panel.append(acts);
    panel.scrollIntoView({ block: 'nearest' });
  }
  function row(label, ctl) {
    const r = el('label', 'sb-row');
    r.append(el('small', null, label), ctl);
    return r;
  }

  // ---------- BUILD: chain pieces into one announcement ----------
  function openBuild(x) {
    editId = null;
    build = { id: x ? x.id : '', name: x ? x.name : '', parts: x ? (x.parts || []).filter(p => !p.missing).map(p => p.id) : [], gap: x ? x.gapMs : data.board.gapMs };
    drawBuild();
  }
  function drawBuild() {
    panel.textContent = '';
    panel.hidden = false;
    panel.append(el('h3', null, build.id ? 'BUILD · EDIT' : 'BUILD ONE'));
    panel.append(el('div', 'note', 'Pick pieces in order: they play back to back as one announcement.'));
    const name = el('input'); name.value = build.name; name.placeholder = 'NAME: DOORS AT NINE'; name.maxLength = 40; name.autocapitalize = 'characters';
    name.setAttribute('aria-label', 'Name');
    name.addEventListener('input', () => build.name = name.value);
    panel.append(row('NAME', name));
    const ol = el('ol', 'sb-parts');
    build.parts.forEach((id, i) => {
      const p = byId[id];
      const li = el('li');
      li.append(el('span', null, p ? p.name : '(gone)'));
      const mv = (d) => { const j = i + d; if (j < 0 || j >= build.parts.length) return; [build.parts[i], build.parts[j]] = [build.parts[j], build.parts[i]]; drawBuild(); };
      const up = btn('↑', 'mini', () => mv(-1)); up.setAttribute('aria-label', 'Move up');
      const dn = btn('↓', 'mini', () => mv(1)); dn.setAttribute('aria-label', 'Move down');
      const rm = btn('✕', 'mini', () => { build.parts.splice(i, 1); drawBuild(); }); rm.setAttribute('aria-label', 'Take out');
      li.append(up, dn, rm);
      ol.append(li);
    });
    if (!build.parts.length) ol.append(el('li', 'empty', 'No pieces yet.'));
    panel.append(ol);
    const pick = el('select'); pick.setAttribute('aria-label', 'Add a piece');
    pick.append(new Option('+ ADD A PIECE…', ''));
    const groups = {};
    data.board.sounds.forEach(s => {
      if (s.seq || s.warn || (s.kind !== 'pa' && s.kind !== 'piece' && !(s.source === 'mine'))) return;
      const g = s.kind === 'piece' ? 'PIECES' : s.source === 'mine' ? 'MINE' : s.category;
      (groups[g] = groups[g] || []).push(s);
    });
    Object.keys(groups).sort((a, b) => (a === 'PIECES' ? -1 : b === 'PIECES' ? 1 : 0)).forEach(g => {
      const og = document.createElement('optgroup'); og.label = g;
      groups[g].forEach(s => og.append(new Option(s.name + ' (' + s.secs + ' s)', s.id)));
      pick.append(og);
    });
    pick.addEventListener('change', () => { if (pick.value) { build.parts.push(pick.value); drawBuild(); } });
    panel.append(pick);
    const words = sentence(build.parts.map(id => byId[id] && byId[id].script));
    panel.append(el('p', 'sb-desc', words ? 'SCRIPT: ' + words : 'The script shows here as you add pieces (pieces without words: EDIT them to add the text).'));
    const gap = el('input'); gap.type = 'range'; gap.min = 0; gap.max = data.board.gapMax; gap.step = 10; gap.value = build.gap;
    const gl = el('small', null, build.gap + ' ms between pieces');
    gap.addEventListener('input', () => { build.gap = +gap.value; gl.textContent = build.gap + ' ms between pieces'; });
    gap.setAttribute('aria-label', 'Gap between pieces');
    const gr = row('GAP', gap); gr.append(gl);
    panel.append(gr);
    const acts = el('div', 'buttons');
    acts.append(btn('PREVIEW HERE', 'mini', e => {
      if (!build.parts.length) return say('Pick a piece first.', true);
      listen('/api/announce/preview?parts=' + build.parts.map(encodeURIComponent).join(',') + '&gap=' + build.gap, e.currentTarget);
    }));
    acts.append(btn('SAVE', '', async () => {
      const res = await send('seq', { id: build.id, name: build.name, parts: build.parts, gapMs: build.gap });
      if (!res) return;
      say(res.r.ok ? 'Saved ' + build.name.toUpperCase() + '. It is on the PA tab under MINE.' : (res.j.text || 'Not saved.'), !res.r.ok);
      if (res.r.ok) { build = null; panel.hidden = true; refresh(true); }
    }));
    acts.append(btn('CANCEL', '', () => { build = null; panel.hidden = true; draw(); }));
    if (build.id) {
      const del = btn('DELETE', 'mini', async () => {
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'SURE? TAP AGAIN'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'DELETE'; }, 3000); return; }
        const res = await send('seq-delete', { id: build.id });
        if (res) { say(res.r.ok ? 'Deleted.' : 'Not deleted.', !res.r.ok); build = null; panel.hidden = true; refresh(true); }
      });
      acts.append(del);
    }
    panel.append(acts);
    panel.scrollIntoView({ block: 'nearest' });
  }

  // ---------- + ADD A SOUND: the add panel (announce.js), set to this tab's kind ----------
  function openAdd() {
    const add = $('annAdd');
    if (!add) return;
    if (window.Announce && Announce.kind) Announce.kind(tab === 'pa' ? 'pa' : tab === 'mine' ? (Announce.kind() || 'sfx') : 'sfx');
    add.open = true;
    add.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------- live: what's playing, the button, the card coming and going ----------
  let wasLive = null;
  function tick() {
    const a = A(), p = a && a.playing, on = live();
    head.hidden = !on; // the tab-strip button only with a card (and the switch on): GO TO / SOUND IN otherwise
    if (on !== wasLive) {
      wasLive = on;
      if (data) draw(); // the card came or went: PA <-> THIS PHONE, the banner
      if (on) refresh(true);
    }
    nowEl.hidden = !(here || (p && isOpen())); // in STATUS the ANNOUNCEMENTS line above already shows the box's
    root.querySelectorAll('.playing').forEach(e => e.classList.remove('playing'));
    if (here) {
      nowText.textContent = '▶ THIS PHONE · ' + here.name + ' · ' + secsTxt((Date.now() - here.since) / 1000) + ' / ' + secsTxt(here.secs);
      if (here.id) root.querySelectorAll('[data-id="' + CSS.escape(here.id) + '"]').forEach(e => e.classList.add('playing'));
      return;
    }
    if (!p) return;
    nowText.textContent = '▶ ' + p.name + (typeof Announce !== 'undefined' && Announce.byText ?Announce.byText(p) : '') + ' · ' + secsTxt((Date.now() - (S.skew || 0) - p.since) / 1000) + ' / ' + secsTxt(p.secs);
    if (p.id) root.querySelectorAll('[data-id="' + CSS.escape(p.id) + '"]').forEach(e => e.classList.add('playing'));
  }
  setInterval(() => { try { tick(); } catch (e) {} }, 500);

  // Laptop keys while the view is open (or the board is on screen in STATUS): 1-9 = pads while ARMED, Esc = STOP.
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || !data) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (here || (A() && A().playing)) stop(); else close();
    } else if (e.key >= '1' && e.key <= '9') {
      e.preventDefault(); e.stopImmediatePropagation();   // not the tab keys while the board is open
      const x = padsNow[+e.key - 1];
      if (x && armed && !editing && x.kind === 'sfx') play(x);
      else if (x && !armed) say('ARM first: then 1-9 play the first 9 pads.');
    }
  }, true);

  // #status/soundboard (GO TO) opens the view.
  const fromHash = () => { if (location.hash === '#status/soundboard') open(); };
  addEventListener('hashchange', () => { try { fromHash(); } catch (e) {} });
  setTimeout(() => { try { fromHash(); } catch (e) {} }, 400);

  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { tick(); if (A() && shown()) refresh(false); } catch (e) { console.warn('soundboard', e); }
  };
  try { tick(); } catch (e) {}
  return { got, refresh, open, close };
})();
