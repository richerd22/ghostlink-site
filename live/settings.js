'use strict';
/*
 * SETTINGS · NIGHT PRESETS (DECISIONS #114): STATUS -> SETTINGS. One tap sets a bundle (CLUB NIGHT, LAPTOP NIGHT,
 * HOME PRACTICE, PRE-DOORS, your own); the list of exactly what changes comes first, then APPLY, then UNDO for 10
 * minutes. ALL SETTINGS: every owner setting in one searchable list (value, CHANGED, BACK TO DEFAULT), plus THIS
 * PHONE's own. MOVE SETTINGS TO ANOTHER UNIT: a settings file (never passwords, Wi-Fi passwords, keys, tokens, share
 * links or the box id). A venue remembers its preset and offers it once a night: never by itself.
 * Own file; uses app.js globals ($, post, unlocked, needUnlock, S, pref, applyDisplay, toggleBuzz). Text nodes only:
 * venue and preset names are the owner's typing.
 */
const NightSettings = (() => {
  const host = $('presetsBox');
  if (!host) return {};
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const row = (...b) => { const r = el('div', 'buttons'); r.append(...b.filter(Boolean)); return r; };
  const offerHost = el('div', 'st-offer-host');
  const vb = $('venueBox');
  if (vb) vb.after(offerHost);

  let data = null, err = '', saving = false, sheet = null, lastVenue;
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  const venueNow = () => (S.status && S.status.venue) || null;
  const phoneMixer = v => (typeof Gear !== 'undefined' && v && v.id) ? Gear.store.get(v.id) : null;
  const mixerName = id => { try { const x = Gear.byId(id); return x ? (x.short || x.name) : id; } catch (e) { return id; } };
  const left = until => Math.max(0, Math.ceil((until - Date.now()) / 60000));

  async function load() {
    try {
      const r = await fetch('/api/settings', { cache: 'no-store' });
      if (r.status === 401) { data = null; err = 'locked'; }
      else if (!r.ok) { const j = await r.json().catch(() => ({})); data = null; err = j.mustChange ? 'new' : 'Couldn\'t read the settings: ' + glWhy(r.status); }
      else { data = await r.json(); err = ''; if (!data || !Array.isArray(data.list) || !Array.isArray(data.presets)) { data = null; err = 'locked'; } } // the website's demo answers {}
    } catch (e) { err = 'The box didn\'t answer.'; }
    render();
    if (sheet && sheet.kind === 'all') renderAll();
    try { if (typeof renderNightsPlan === 'function') renderNightsPlan(); } catch (e) {} // #116: the nights' preset names
  }

  // ---------- STATUS -> SETTINGS ----------
  function render() {
    host.textContent = '';
    offerHost.textContent = '';
    if (err === 'locked') {
      host.append(el('div', 'note', 'NIGHT PRESETS and ALL SETTINGS: unlock with the owner password.'), row(btn('UNLOCK', null, needUnlock)));
      return;
    }
    if (err === 'new') { host.append(el('div', 'note', 'New box: pick your own password first (the lock, above).')); return; }
    if (err || !data) { host.append(el('div', 'note warn', err || 'Loading...')); return; }
    const own = data.owner;
    if (data.offer) { offerHost.append(offerCard(data.offer)); host.append(offerCard(data.offer)); }
    if (data.undo) host.append(undoBar(data.undo));
    host.append(el('small', 'st-h', 'NIGHT PRESETS'));
    const ps = el('div', 'buttons st-presets');
    data.presets.forEach(p => {
      const b = btn(p.name + (p.count === 0 ? ' ✓' : ''), p.count === 0 ? 'st-same' : '', () => preview({ preset: p.id }, p));
      b.title = p.what || '';
      b.disabled = !own;
      b.setAttribute('aria-label', p.name + (p.count === 0 ? ', already set' : ''));
      ps.append(b);
    });
    host.append(ps);
    host.append(el('div', 'note', own ? 'Shows what changes first. UNDO for 10 minutes. ✓ = already like that.'
      : 'Owner password to use presets. The crew code can look.'));
    host.append(own ? saveRow() : row(btn('ALL SETTINGS', null, openAll)));
    const mine = data.presets.filter(p => !p.builtin);
    if (own && mine.length) host.append(yours(mine));
    fillNightPick();
    if (own) host.append(el('small', 'st-h', 'MOVE SETTINGS TO ANOTHER UNIT'), moveRow(),
      el('div', 'note', 'A file with your settings, presets and venues. Never passwords, Wi-Fi passwords, keys, tokens, share links or the box id.'));
  }

  function moveRow() {
    const a = el('a', 'btn', 'SAVE SETTINGS FILE');
    a.href = '/api/settings/export';
    a.setAttribute('download', '');
    const lab = el('label', 'btn', 'LOAD A SETTINGS FILE');
    const f = el('input');
    f.type = 'file'; f.accept = '.json,application/json'; f.hidden = true;
    f.onchange = async () => {
      const file = f.files[0];
      f.value = '';
      if (!file) return;
      if (file.size > 2_000_000) return say('That file is too big to be a settings file.');
      let j;
      try { j = JSON.parse(await file.text()); } catch (e) { return say('That isn\'t a GHOST LINK settings file.'); }
      preview({ file: j }, { name: 'SETTINGS FILE', what: 'From ' + file.name });
    };
    lab.append(f);
    return row(a, lab);
  }

  function saveRow() {
    const wrap = el('div', 'st-save');
    const open = btn('+ SAVE AS PRESET', null, () => { form.hidden = !form.hidden; if (!form.hidden) name.focus(); });
    const form = el('form', 'row');
    form.hidden = true;
    const name = el('input');
    name.placeholder = 'NAME: FRIDAY RINK'; name.maxLength = 30; name.autocapitalize = 'characters';
    name.setAttribute('aria-label', 'Preset name');
    const note = el('div', 'note');
    form.append(name, btn('SAVE', null, () => form.requestSubmit()));
    form.onsubmit = async e => {
      e.preventDefault();
      if (saving) return;
      saving = true;
      const r = await post('/api/settings/presets', { action: 'save', name: name.value, mixer: phoneMixer(venueNow()) || undefined });
      saving = false;
      const j = await r.json().catch(() => ({}));
      if (r.ok) { name.value = ''; form.hidden = true; await load(); say(j.text || 'Saved.'); }
      else if (r.status !== 401) note.textContent = j.error || 'Didn\'t save.';
    };
    wrap.append(row(btn('ALL SETTINGS', null, openAll), open), form, note);
    return wrap;
  }

  // ---------- #116 YOUR PRESETS: RENAME / DELETE ----------
  let openYours = false;
  function yours(mine) {
    const d = el('details', 'st-yours');
    d.open = openYours;
    d.ontoggle = () => { openYours = d.open; };
    d.append(el('summary', null, 'YOUR PRESETS · RENAME OR DELETE (' + mine.length + ')'));
    mine.forEach(p => d.append(ownRow(p)));
    return d;
  }

  /** Nights that name this preset (app.js `nights`), for the DELETE words. */
  const nightsUsing = id => (typeof nights !== 'undefined' ? nights : []).filter(n => n.preset === id && (!S.status || !S.status.night || n.date >= S.status.night));

  function ownRow(p, after) {
    const r = el('div', 'st-own');
    const name = el('b', null, p.name);
    const msg = el('div', 'note');
    const ren = btn('RENAME', 'mini', () => {
      r.textContent = '';
      const f = el('form', 'row');
      const inp = el('input');
      inp.value = p.name; inp.maxLength = 30; inp.autocapitalize = 'characters';
      inp.setAttribute('aria-label', 'New name for ' + p.name);
      f.append(inp, btn('SAVE', 'mini', () => f.requestSubmit()), btn('CANCEL', 'mini', () => { load(); }));
      f.onsubmit = async e => {
        e.preventDefault();
        const rr = await post('/api/settings/presets', { action: 'rename', id: p.id, name: inp.value });
        const j = await rr.json().catch(() => ({}));
        if (rr.ok) { await load(); if (after) after(); try { if (typeof renderNightsPlan === 'function') renderNightsPlan(); } catch (x) {} }
        else if (rr.status !== 401) { msg.textContent = j.error || 'Didn\'t rename.'; msg.classList.add('warn'); }
      };
      r.append(f, msg);
      inp.focus(); inp.select();
    });
    const del = btn('DELETE', 'mini', async () => {
      if (del.dataset.armed !== '1') {
        del.dataset.armed = '1';
        const used = nightsUsing(p.id).length;
        del.textContent = used ? 'TAP AGAIN: ' + used + (used === 1 ? ' NIGHT NAMES IT' : ' NIGHTS NAME IT') : 'TAP AGAIN TO DELETE';
        setTimeout(() => { del.dataset.armed = ''; del.textContent = 'DELETE'; }, 4000);
        return;
      }
      const rr = await post('/api/settings/presets', { action: 'delete', id: p.id });
      if (rr.ok) { await load(); if (after) after(); try { if (typeof renderNightsPlan === 'function') renderNightsPlan(); } catch (x) {} }
      else if (rr.status !== 401) { msg.textContent = 'Didn\'t delete: ' + glWhy(rr.status); msg.classList.add('warn'); }
    });
    r.append(name, row(ren, del), msg);
    return r;
  }

  // ---------- #116 a planned night can name a preset (NIGHTS form) ----------
  const nForm = $('nightForm'), nNotes = $('nNotes');
  let pick = null;
  if (nForm && nNotes) {
    const r = el('div', 'row st-nightpick');
    r.append(el('span', 'lbl', 'PRESET'));
    pick = el('select');
    pick.id = 'nPreset';
    pick.setAttribute('aria-label', 'Night preset to offer');
    r.append(pick);
    r.append(el('span', 'note', 'Offered once on the night, never by itself.'));
    nNotes.after(r);
  }
  function fillNightPick() {
    if (!pick) return;
    const keep = pick.value || pick.dataset.want || '';
    pick.textContent = '';
    const none = el('option', null, '(none)'); none.value = ''; pick.append(none);
    ((data && data.presets) || []).forEach(p => { const o = el('option', null, p.name); o.value = p.id; pick.append(o); });
    if (keep && ![...pick.options].some(o => o.value === keep)) { const o = el('option', null, '(a deleted preset)'); o.value = keep; pick.append(o); }
    pick.value = keep;
  }
  /** app.js openNightForm: the night's preset in the form. */
  function setNightPick(id) {
    if (!pick) return;
    pick.dataset.want = id || '';
    pick.value = '';
    fillNightPick();
    pick.value = id || '';
  }
  /** undefined = not loaded (locked phone), null = not on the box any more. */
  const presetName = id => { if (!data) return undefined; const p = data.presets.find(x => x.id === id); return p ? p.name : null; };

  function say(text) {
    const n = el('div', 'note', text);
    host.append(n);
    setTimeout(() => n.remove(), 6000);
  }

  function undoBar(u) {
    const b = el('div', 'st-undo');
    b.append(el('span', null, u.label + ' · ' + u.count + (u.count === 1 ? ' change' : ' changes') + ' · UNDO for ' + left(u.until) + ' min'));
    b.append(btn('UNDO', null, () => undo(u.id)));
    return b;
  }

  async function undo(id) {
    const r = await post('/api/settings/undo', { id });
    const j = await r.json().catch(() => ({}));
    if (r.ok) showResult({ label: j.label, done: j.done, failed: j.failed, extras: [], undo: null });
    else if (r.status !== 401) showResult({ label: 'UNDO', done: [], failed: [j.error || 'Couldn\'t undo.'], extras: [], undo: null });
    load();
  }

  function offerCard(o) {
    const c = el('div', 'st-offer');
    const night = o.from === 'night'; // #116: tonight's plan names it (it wins over the venue's)
    c.append(el('b', null, night ? 'USE ' + o.preset.name + '?' : 'USE ' + o.preset.name + ' LIKE LAST TIME?'));
    c.append(el('div', 'note', night ? 'Tonight\'s plan names it. Nothing changes unless you say so:'
      : 'Last time at ' + o.venue.name + '. Nothing changes unless you say so:'));
    c.append(linesList(o.lines.filter(l => !l.blocked)));
    if (o.mixer && !phoneMixer(o.venue)) c.append(el('div', 'note', 'THIS PHONE · WHICH MIXER?: ' + mixerName(o.mixer)));
    c.append(row(btn('USE ' + o.preset.name, null, () => preview({ preset: o.preset.id }, o.preset)),
      btn('NOT TONIGHT', null, async () => { await post('/api/settings/offer', { answer: 'no' }); load(); })));
    return c;
  }

  function linesList(lines) {
    const ul = el('ul', 'st-lines');
    lines.forEach(l => {
      const li = el('li', l.blocked ? 'st-blocked' : '');
      li.append(el('b', null, l.name), document.createTextNode(': ' + l.from + ' → ' + l.to));
      if (l.care && !l.blocked) li.append(el('span', 'st-care', l.care));
      if (l.blocked) li.append(el('div', 'st-why', l.blocked));
      ul.append(li);
    });
    return ul;
  }

  // ---------- the preview sheet ----------
  function openSheet(kind) {
    closeSheet();
    const s = el('div', 'share st-sheet');
    s.addEventListener('click', e => { if (e.target === s) closeSheet(); });
    const box = el('div', 'share-box st-box');
    box.setAttribute('role', 'dialog');
    s.append(box);
    document.body.append(s);
    sheet = { el: s, box, kind };
    return box;
  }
  function closeSheet() { if (sheet) { sheet.el.remove(); sheet = null; } }
  addEventListener('keydown', e => { if (e.key === 'Escape' && sheet) closeSheet(); });

  async function preview(body, p) {
    if (!unlocked) return needUnlock();
    const box = openSheet('preview');
    box.setAttribute('aria-label', p.name);
    box.append(head(p.name), el('div', 'note', 'Looking...'));
    let r, j;
    try { r = await post('/api/settings/preview', body); j = await r.json().catch(() => ({})); } catch (e) { j = { error: 'The box didn\'t answer.' }; }
    if (r && r.status === 401) return closeSheet();
    box.textContent = '';
    box.append(head(j.label || p.name));
    if (p.what) box.append(el('div', 'note', p.what));
    if (!r || !r.ok) { box.append(el('div', 'note warn', j.error || 'Didn\'t work.'), row(btn('CLOSE', null, closeSheet))); return; }
    const go = j.lines.filter(l => !l.blocked), stay = j.lines.filter(l => l.blocked);
    const v = j.venue, mx = j.mixer && v && phoneMixer(v) !== j.mixer ? j.mixer : null;
    const any = go.length || (j.extras || []).length || mx;
    if (any) box.append(el('small', null, 'WHAT CHANGES'));
    if (go.length) box.append(linesList(go));
    if ((j.extras || []).length) { const ul = el('ul', 'st-lines'); j.extras.forEach(t => ul.append(el('li', null, t))); box.append(ul); }
    if (mx) { const ul = el('ul', 'st-lines'); ul.append(el('li', null, 'THIS PHONE · WHICH MIXER? at ' + v.name + ': ' + mixerName(mx))); box.append(ul); }
    if (!any) box.append(el('div', 'note', 'Already set like that: nothing to change.'));
    if (stay.length) { box.append(el('small', null, 'STAYS AS IT IS')); box.append(linesList(stay)); }
    if ((j.skipped || []).length) {
      const d = el('details', 'st-skip');
      d.append(el('summary', null, 'NOT ON THIS BOX (' + j.skipped.length + ')'));
      const ul = el('ul', 'st-lines');
      j.skipped.forEach(t => ul.append(el('li', null, t)));
      d.append(ul);
      box.append(d);
    }
    if (go.some(l => l.care)) box.append(el('div', 'note warn', 'Lines marked in amber reach outside the screen. Check them before APPLY.'));
    if (body.preset && body.preset.startsWith('my-')) { // #116: RENAME or DELETE it right here too
      const mine = ((data && data.presets) || []).find(x => x.id === body.preset);
      if (mine) box.append(ownRow(mine, closeSheet));
    }
    const apply = btn(any ? 'APPLY' : 'OK', any ? 'on' : '', async () => {
      if (!any) return closeSheet();
      apply.disabled = true;
      if (mx) Gear.store.set(v.id, mx);
      const mixer = phoneMixer(v) || undefined;
      const ra = await post('/api/settings/apply', { token: j.token, mixer });
      const ja = await ra.json().catch(() => ({}));
      if (ra.status === 409 && ja.again) return preview(body, p);
      if (ra.status === 401) return closeSheet();
      if (!ra.ok) { box.append(el('div', 'note warn', ja.error || 'Didn\'t work.')); apply.disabled = false; return; }
      if (mx) ja.extras = (ja.extras || []).concat(['THIS PHONE · WHICH MIXER?: ' + mixerName(mx)]);
      showResult(ja);
      load();
      try { renderHeader(); } catch (e) {}
    });
    box.append(row(apply, any ? btn('CANCEL', null, closeSheet) : null));
  }

  function head(t) {
    const h = el('div', 'st-head');
    h.append(el('h3', 'sell-h', t));
    const x = btn('×', 'mini', closeSheet);
    x.setAttribute('aria-label', 'Close');
    h.append(x);
    return h;
  }

  function showResult(a) {
    const box = openSheet('result');
    box.append(head(a.label));
    const n = (a.done || []).length + (a.extras || []).length;
    box.append(el('div', 'note', n ? 'Done: ' + n + (n === 1 ? ' change.' : ' changes.') : 'Nothing changed.'));
    if ((a.done || []).length) box.append(linesList(a.done));
    if ((a.extras || []).length) { const ul = el('ul', 'st-lines'); a.extras.forEach(t => ul.append(el('li', null, t))); box.append(ul); }
    (a.failed || []).forEach(t => box.append(el('div', 'note warn', t)));
    box.append(row(a.undo ? btn('UNDO', null, () => undo(a.undo.id)) : null, btn('OK', 'on', closeSheet)));
    if (a.undo) box.append(el('div', 'note', 'UNDO stays on STATUS -> SETTINGS for 10 minutes.'));
  }

  // ---------- ALL SETTINGS ----------
  const PHONE = [
    { key: 'theme', name: 'THEME', what: 'NIGHT, DIM BOOTH or DAYLIGHT.', def: 'night', choices: [['night', 'NIGHT'], ['dim', 'DIM BOOTH'], ['day', 'DAYLIGHT']],
      get: () => ls('theme') || 'night', set: v => { pref('theme', v); applyDisplay(); } },
    { key: 'size', name: 'TEXT SIZE', what: 'How big the words are on this phone.', def: 'm', choices: [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']],
      get: () => ls('size') || 'm', set: v => { pref('size', v); applyDisplay(); } },
    { key: 'fun', name: 'GHOST MOODS', what: 'The ghost reacts to the music.', def: 'on', choices: [['on', 'ON'], ['off', 'OFF']],
      get: () => ls('fun') === '0' ? 'off' : 'on', set: v => clickTill('[data-fun]', () => (ls('fun') === '0' ? 'off' : 'on') === v) },
    { key: 'ghostMode', name: 'GHOST', what: 'A little ghost goes to the MASTER deck, or stays up top.', def: 'roam', choices: [['roam', 'GOES TO THE DECKS'], ['corner', 'STAYS UP TOP']],
      get: () => ls('ghostMode') === 'corner' ? 'corner' : 'roam', set: v => clickTill('[data-roam]', () => (ls('ghostMode') === 'corner' ? 'corner' : 'roam') === v) },
    { key: 'ghostSize', name: 'GHOST SIZE', what: 'S, M, L or XL.', def: 'M', choices: [['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL']],
      get: () => ['S', 'L', 'XL'].includes(ls('ghostSize')) ? ls('ghostSize') : 'M', set: v => clickTill('[data-gsize]', () => (ls('ghostSize') || 'M') === v) },
    { key: 'rips', name: 'GHOST SMELLS RIPS', what: 'The ghost looks unimpressed at ripped files on air.', def: 'off', choices: [['off', 'OFF'], ['on', 'ON']],
      get: () => ls('rips') === '1' ? 'on' : 'off', set: v => clickTill('[data-rips]', () => (ls('rips') === '1' ? 'on' : 'off') === v) },
    { key: 'buzzDrop', name: 'BUZZ BEFORE THE DROP', what: 'This phone buzzes 3 s before THE DROP (NOW).', def: 'off', choices: [['off', 'OFF'], ['on', 'ON']],
      get: () => ls('buzzDrop') === '1' ? 'on' : 'off', set: v => { if ((ls('buzzDrop') === '1' ? 'on' : 'off') !== v && typeof toggleBuzz === 'function') toggleBuzz(); } },
    { key: 'layout', name: 'NOW LAYOUT', what: 'The blocks on NOW, per role (NOW -> LAYOUT).', def: 'std', choices: [['std', 'STANDARD'], ['own', 'YOUR OWN']], resetOnly: true,
      get: () => layoutKeys().length ? 'own' : 'std', set: () => { layoutKeys().forEach(k => ls(k, null)); try { Object.keys(layoutCache).forEach(k => delete layoutCache[k]); } catch (e) {} } },
  ];
  function layoutKeys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('layout:')) out.push(k); } } catch (e) {} return out; }
  function clickTill(sel, done) { const b = document.querySelector(sel); for (let i = 0; i < 5 && b && !done(); i++) b.click(); }

  let q = '', moreOpen = false;
  function openAll() {
    if (!data) return needUnlock();
    const box = openSheet('all');
    box.classList.add('st-all');
    box.setAttribute('aria-label', 'All settings');
    renderAll();
  }

  function renderAll() {
    if (!sheet || sheet.kind !== 'all') return;
    const box = sheet.box, own = data && data.owner;
    const keepFocus = document.activeElement && document.activeElement.classList.contains('st-q');
    box.textContent = '';
    box.append(head('ALL SETTINGS'));
    const s = el('input', 'st-q');
    s.type = 'search'; s.placeholder = 'SEARCH: ear, wifi, ghost...'; s.value = q; s.maxLength = 30;
    s.setAttribute('aria-label', 'Search the settings');
    s.oninput = () => { q = s.value; fill(); };
    box.append(s);
    if (!own) box.append(el('div', 'note', 'Read only: the owner password changes these. THIS PHONE is yours.'));
    const list = el('div', 'st-list');
    box.append(list);
    const nchanged = data.list.filter(x => x.changed).length;
    box.append(el('div', 'note', nchanged + (nchanged === 1 ? ' setting' : ' settings') + ' changed from the default (●).'));
    function fill() {
      list.textContent = '';
      const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const hit = (...t) => { const h = t.join(' ').toLowerCase(); return words.every(w => h.includes(w)); };
      let group = null, shown = 0;
      if (typeof Calm !== 'undefined' && Calm.sheet) return fillCalm(words, hit); // #145 CALM: most-used first, MORE folded
      data.list.forEach(x => {
        if (!hit(x.name, x.what.replace(/GHOST LINK/g, ''), x.group, x.valueText || '', x.key)) return;
        if (x.group !== group) { group = x.group; list.append(el('h4', 'st-g', group)); }
        list.append(boxRow(x, own));
        shown++;
      });
      const ph = PHONE.filter(p => hit(p.name, p.what, 'this phone display'));
      if (ph.length) list.append(el('h4', 'st-g', 'THIS PHONE'));
      ph.forEach(p => { list.append(phoneRow(p)); shown++; });
      if (!shown) list.append(el('div', 'note', 'Nothing called that. Try fewer letters.'));
    }
    // #145 CALM: TONIGHT, THIS VENUE, WHO SEES WHAT, THE BOX, THIS PHONE; then MORE (shut unless searching), whose
    // line names its sections and how many are changed. Searching shows every match, MORE's too.
    function fillCalm(words, hit) {
      let shown = 0;
      const secs = Calm.sheet(data.list).map(sec => ({ name: sec.name, more: sec.more,
        items: sec.items.filter(x => hit(x.name, x.what.replace(/GHOST LINK/g, ''), x.group, sec.name, x.valueText || '', x.key)) })).filter(sec => sec.items.length);
      const put = (host, sec) => { host.append(el('h4', 'st-g', sec.name)); sec.items.forEach(x => { host.append(boxRow(x, own)); shown++; }); };
      secs.filter(sec => !sec.more).forEach(sec => put(list, sec));
      const ph = PHONE.filter(p => hit(p.name, p.what, 'this phone display'));
      if (ph.length) list.append(el('h4', 'st-g', 'THIS PHONE'));
      ph.forEach(p => { list.append(phoneRow(p)); shown++; });
      const rest = secs.filter(sec => sec.more);
      if (rest.length) {
        let host = list;
        if (!words.length) {
          const d = el('details', 'st-more');
          d.open = moreOpen;
          d.ontoggle = () => { moreOpen = d.open; };
          const n = rest.reduce((a, sec) => a + sec.items.filter(x => x.changed).length, 0);
          const sm = el('summary');
          sm.append(el('span', 'st-more-t', 'MORE'));
          sm.append(el('small', null, rest.map(sec => sec.name).join(' · ') + (n ? ' · ' + n + ' CHANGED ●' : '')));
          d.append(sm);
          list.append(d);
          host = d;
        }
        rest.forEach(sec => put(host, sec));
      }
      if (!shown) list.append(el('div', 'note', 'Nothing called that. Try fewer letters.'));
    }
    fill();
    if (keepFocus) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }

  function rowShell(name, changed, what, careText) {
    const r = el('div', 'st-row' + (changed ? ' st-changed' : ''));
    const t = el('div', 'st-name');
    t.append(el('b', null, name));
    if (changed) { const d = el('span', 'st-dot', '●'); d.title = 'Changed from the default'; d.setAttribute('aria-label', 'changed'); t.append(d); }
    if (careText) t.append(el('span', 'st-care', careText));
    r.append(t, el('div', 'st-what', what));
    const c = el('div', 'st-ctl');
    r.append(c);
    return [r, c];
  }

  async function setBox(x, body, c) {
    const r = await post('/api/settings/set', Object.assign({ key: x.key }, body));
    const j = await r.json().catch(() => ({}));
    if (r.ok) { data.list = j.list; renderAll(); load(); return; }
    if (r.status === 401) return;
    c.append(el('div', 'note warn', j.error || 'Didn\'t save.'));
  }

  function boxRow(x, own) {
    const [r, c] = rowShell(x.name, x.changed, x.what, x.care);
    const can = own && x.settable && x.available;
    if (x.kind === 'bool') {
      const on = x.value === true;
      const b = btn(on ? 'ON' : 'OFF', on ? 'on' : '', () => setBox(x, { value: !on }, c));
      b.setAttribute('aria-pressed', String(on));
      b.disabled = !can || (x.guarded && !on); // the careful ones turn ON in their own section (it asks there)
      c.append(b);
    } else if (x.kind === 'choice') {
      const sel = el('select');
      sel.setAttribute('aria-label', x.name);
      (x.choices || []).forEach(o => { const op = el('option', null, o.label); op.value = o.value; sel.append(op); });
      sel.value = x.value;
      sel.disabled = !can;
      sel.onchange = () => setBox(x, { value: sel.value }, c);
      c.append(sel);
    } else if (x.kind === 'text') {
      const big = (x.max || 0) > 80;
      const inp = el(big ? 'textarea' : 'input');
      if (big) inp.rows = 2;
      inp.value = x.value || ''; inp.maxLength = x.max || 200; inp.disabled = !can;
      inp.setAttribute('aria-label', x.name);
      const sv = btn('SAVE', 'mini', () => setBox(x, { value: inp.value }, c));
      sv.hidden = true;
      inp.oninput = () => { sv.hidden = inp.value === (x.value || ''); };
      c.append(inp, sv);
    } else {
      c.append(el('span', 'st-val', x.valueText || '-'));
    }
    if (!x.available) { c.textContent = ''; c.append(el('span', 'st-val', 'NOT ON THIS BOX')); }
    if (x.changed && can && x.kind !== 'info') c.append(btn('BACK TO DEFAULT', 'mini', () => setBox(x, { reset: true }, c)));
    if (x.go) c.append(btn('OPEN', 'mini', () => { closeSheet(); location.hash = '#' + x.go; }));
    if (x.guarded && x.available && x.value !== true && own) r.append(el('div', 'st-why st-left', 'Turns on in its own section (OPEN): it asks first there.'));
    return r;
  }

  function phoneRow(p) {
    const v = p.get(), changed = v !== p.def;
    const [r, c] = rowShell(p.name, changed, p.what, null);
    if (p.resetOnly) c.append(el('span', 'st-val', (p.choices.find(o => o[0] === v) || [v, v])[1]));
    else {
      const sel = el('select');
      sel.setAttribute('aria-label', p.name);
      p.choices.forEach(o => { const op = el('option', null, o[1]); op.value = o[0]; sel.append(op); });
      sel.value = v;
      sel.onchange = () => { p.set(sel.value); renderAll(); };
      c.append(sel);
    }
    if (changed) c.append(btn('BACK TO DEFAULT', 'mini', () => { p.set(p.def); renderAll(); }));
    return r;
  }

  // ---------- keeping up ----------
  const sect = $('go-presets');
  if (sect) sect.addEventListener('toggle', () => { if (sect.open) load(); });
  // A venue picked (here, on another phone or by tonight's plan): look for its "like last time?" once.
  setInterval(() => {
    const v = venueNow(), id = v && v.id;
    if (id !== lastVenue) { const first = lastVenue === undefined; lastVenue = id; if (!first || id) load(); return; }
    if (data && data.undo && sect && sect.open) render(); // the minutes left
  }, 3000);
  setInterval(() => { if (curView() === 'status' && unlocked) load(); }, 60000);
  if (typeof setUnlocked === 'function') { // load again when this phone unlocks or locks
    let was = unlocked;
    setInterval(() => { if (unlocked !== was) { was = unlocked; load(); } }, 1000);
  }
  load();
  return { load, open: openAll, setNightPick, presetName, list: () => (data && data.list) || null }; // list: #145 CALM's ON marks
})();
