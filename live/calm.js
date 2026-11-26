'use strict';
/*
 * CALM (DECISIONS #145, Nov 24). Two days of feature rounds put a lot on the screens; Richard: "cover every use case
 * ... without being annoying or losing the plot", "it's a lot rn". This file holds the show-when rules, in one place:
 *
 *  - STATUS order: the most-used sections first (TONIGHT, THIS VENUE, WHO SEES WHAT, THE BOX); the specialist ones
 *    (LIGHTS, SHOW CONTROL, OSC, DECK CONTROLS, ANNOUNCEMENTS, API KEYS, HARD STOP HUB, ROOMS, GET READY TO SELL) in one
 *    MORE fold, shut by default. Its line names what's inside and which are ON, so nothing is lost. GO TO, the
 *    #status/<k> links and ALL SETTINGS' OPEN still land on them (the fold opens by itself). FIRST RUN's YOUR NIGHTS
 *    (#136) still lifts the sections for the owner's kinds of nights up front, out of MORE too. A section this file
 *    doesn't know yet goes in MORE (CalmJsTest names it so someone decides).
 *  - ALL SETTINGS (settings.js) uses the same names: TONIGHT, THIS VENUE, WHO SEES WHAT, THE BOX, THIS PHONE, then MORE
 *    (shut unless you search). A setting this box doesn't have (no sound card, no lights part) goes in MORE as
 *    NOT ON THIS BOX instead of a row of its own up top.
 *  - NOW: a block with nothing to say hides (ON NOW with no plan and no DJ, the LINEUP with none, SHOW CONTROL all
 *    off, ROOM without a panel mic, SOUND IN without a card). EDIT still lists and shows every block.
 *    SHOW STOP / HOLD sit on NOW for a phone with the crew code or the owner password (or while the box's HOLD is on:
 *    RESUME); a locked phone doesn't get two big buttons it can't use. #152: the owner's WHO SEES SHOW STOP / HOLD
 *    (ALL SETTINGS -> TONIGHT) can put them on EVERY PHONE; pressing still needs the code. The picker and WEATHER's
 *    HOLD? are unchanged.
 * Nothing here turns anything on or off, sends or records: it only orders, folds and hides empty cards.
 * Loaded after app.js, settings.js, firstrun.js and safetyctl.js; the pure parts load under Node for the tests.
 */
const Calm = (() => {
  // ---------- STATUS ----------
  const TOP = ['presets'];
  const GROUPS = [
    ['g-tonight', 'TONIGHT', ['nights', 'night-safety']],
    ['g-venue', 'THIS VENUE', ['venue', 'wifi']],
    ['g-screens', 'WHO SEES WHAT', ['screens', 'song-id', 'ask-dj', 'wantlist', 'share', 'watch']],
    ['g-box', 'THE BOX', ['controls', 'backup', 'updates', 'setup', 'account', 'box', 'tools']],
  ];
  const MORE = ['lights', 'show-control', 'osc', 'deck-controls', 'announce', 'api-keys', 'hardstop-hub', 'rooms', 'sell'];
  const KNOWN = new Set([...TOP, ...GROUPS.flatMap(g => g[2]), ...MORE]);

  /** Where each STATUS section goes: {top, groups: [{id, title, keys}], more}. Unknown keys go in MORE, in page order. */
  function statusPlan(keys) {
    const have = new Set(keys);
    return {
      top: TOP.filter(k => have.has(k)),
      groups: GROUPS.map(([id, title, ks]) => ({ id, title, keys: ks.filter(k => have.has(k)) })),
      more: MORE.filter(k => have.has(k)).concat(keys.filter(k => !KNOWN.has(k))),
    };
  }

  /** Which MORE sections are switched on, from ALL SETTINGS' list (the owner's or crew's read). */
  function onSections(list) {
    const on = new Set();
    (list || []).forEach(x => {
      const yes = x.kind === 'bool' ? x.value === true : x.kind === 'text' ? !!String(x.value || '').trim() : false;
      if (!yes || x.available === false) return;
      const k = x.key || '';
      if (k === 'ghostdeck.on') on.add('deck-controls');
      else if (k === 'announce.on') on.add('announce');
      else if (k === 'lights.on') on.add('lights');
      else if (k === 'osc.targets') on.add('osc');
      else if (k === 'rooms.self') on.add('rooms');
      else if (k.startsWith('showctl.') && x.kind === 'bool') on.add('show-control');
    });
    return on;
  }

  /** The MORE fold's line: what's inside, the ones ON first. */
  function moreLine(sections) {
    const on = sections.filter(s => s.on), off = sections.filter(s => !s.on);
    return on.map(s => s.name + ' (ON)').concat(off.map(s => s.name)).join(' · ');
  }

  // ---------- ALL SETTINGS ----------
  const SHEET = [
    ['TONIGHT', false, k => ['tonight.home', 'tonight.nudge', 'ear', 'ear.mode', 'rec.autoMp3', 'crew.autoDrop', 'safety.phones', 'moments.crewCall'].includes(k) || k.startsWith('cues.') || k.startsWith('safety.') || k.startsWith('hints.')], // #152: WHO SEES SHOW STOP / HOLD, A MOMENT SENDS ITS CREW CALL; #163 CUES
    ['THIS VENUE', false, k => k === 'wifi.mode'],
    ['WHO SEES WHAT', false, k => ['songid', 'stream.hideIds', 'wantlist', 'fun.tvGhost', 'watch.olderNights'].includes(k) || k.startsWith('requests.') || k.startsWith('transitions.')],
    ['THE BOX', false, k => k === 'unit' || k === 'password' || k === 'fun.milestones'],
    ['LIGHTS', true, k => k.startsWith('lights.')],
    ['SHOW CONTROL', true, k => k.startsWith('showctl.') || k.startsWith('osc.')],
    ['DECK CONTROLS', true, k => k.startsWith('ghostdeck.') || k.startsWith('autostop.') || k.startsWith('house.')],
    ['ANNOUNCEMENTS', true, k => k.startsWith('announce.') || k.startsWith('pa.') || k.startsWith('soundboard.')],
    ['WEATHER', true, k => k.startsWith('weather.')],
    ['HARD STOP', true, k => k.startsWith('goodnight.') || k === 'hsapp.banner'], // #162 USE IN THE HARD STOP APP
    ['ROOMS', true, k => k.startsWith('rooms.')],
  ];
  const NOT_HERE = 'NOT ON THIS BOX';

  /** The section a setting goes in: [name, more]. A key no rule knows: its own group, in MORE. */
  function sheetSection(x) {
    if (x.available === false) return [NOT_HERE, true];
    const k = x.key || '';
    const hit = SHEET.find(s => s[2](k));
    return hit ? [hit[0], hit[1]] : [x.group || 'OTHER', true];
  }
  const knownKey = k => SHEET.some(s => s[2](k));

  /** ALL SETTINGS in sections: [{name, more, items}], the main ones first, then MORE's, NOT ON THIS BOX last. */
  function sheet(list) {
    const order = SHEET.map(s => s[0]), by = new Map();
    (list || []).forEach(x => {
      const [name, more] = sheetSection(x);
      if (!by.has(name)) by.set(name, { name, more, items: [] });
      by.get(name).items.push(x);
    });
    const rank = s => s.name === NOT_HERE ? 1e4 : (s.more ? 1000 : 0) + (order.includes(s.name) ? order.indexOf(s.name) : 500);
    return [...by.values()].sort((a, b) => rank(a) - rank(b));
  }

  // ---------- NOW ----------
  /** True when a NOW block has nothing to say and hides. c: what the page knows now. */
  function quietBlock(block, c) {
    switch (block) {
      case 'night': return !c.dj && c.left == null && !c.next && !c.off && !c.lineup && !c.musicOff;
      case 'lineup': return !c.lineup && !c.musicOff;
      case 'showctl': return !!c.scLoaded && !c.scOn;
      case 'room': return !c.room;
      case 'sound': return !c.card;
      default: return false;
    }
  }
  /**
   * SHOW STOP / HOLD on NOW. c: {unlocked, hold, holdSrc, phones}. A phone with the crew code or the password always
   * (it can press them). #152 phones 'all' (EVERY PHONE, the owner's choice): every phone. While a HOLD is on its RESUME
   * shows to whoever can use it: the box's own HOLD on any phone (pressing asks for the code); a HARD STOP HOLD ends in
   * HARD STOP, so a locked phone doesn't get a button it can't use. hold true without holdSrc = the box's (as before).
   */
  const safetyRowShown = c => !!(c.unlocked || c.phones === 'all' || (c.hold && (c.holdSrc == null || c.holdSrc === 'box')));

  const pure = { statusPlan, onSections, moreLine, sheet, sheetSection, knownKey, quietBlock, safetyRowShown, KNOWN, NOT_HERE };
  if (typeof document === 'undefined') return pure;

  // ================= on the page =================
  const $id = id => document.getElementById(id);
  const status = $id('status');
  let more = null, moreNames = null;

  function arrangeStatus() {
    if (!status) return;
    // By element (the folds app.js built). #152: PLAYED's WANTLIST list is #go-played-wantlist, so ids are unique now.
    const secs = [...status.querySelectorAll(':scope > details.sect[id^="go-"]')];
    const byKey = new Map(secs.map(d => [d.id.slice(3), d]));
    const sec = k => byKey.get(k);
    const p = statusPlan([...byKey.keys()]);
    const top = p.top.length ? sec(p.top[p.top.length - 1]) : null;
    let last = top || $id('lock');
    p.groups.forEach(g => {
      const h = $id(g.id);
      if (!h || !g.keys.length) return;
      if (h.textContent !== g.title) h.textContent = g.title;
      last.after(h); last = h;
      g.keys.forEach(k => { const d = sec(k); if (d) { last.after(d); last = d; } });
    });
    if (!p.more.length) return;
    more = document.createElement('details');
    more.className = 'sect calm-more';
    more.id = 'go-more';
    const sm = document.createElement('summary');
    const t = document.createElement('span'); t.className = 'calm-more-t'; t.textContent = 'MORE';
    moreNames = document.createElement('small'); moreNames.className = 'calm-more-names';
    sm.append(t, moreNames);
    more.append(sm);
    last.after(more);
    p.more.forEach(k => { const d = sec(k); if (d) more.append(d); });
    try { more.open = localStorage.getItem('calmMoreOpen') === '1'; } catch (e) {}
    more.addEventListener('toggle', () => { try { localStorage.setItem('calmMoreOpen', more.open ? '1' : '0'); } catch (e) {} });
    refreshMore();
  }

  /** MORE's line: the sections still in it (FIRST RUN may have lifted some up front), the ones ON first. */
  function refreshMore() {
    if (!more || !moreNames) return;
    const list = typeof NightSettings !== 'undefined' && NightSettings.list ? NightSettings.list() : null;
    const on = onSections(list);
    const remote = document.body.classList.contains('remote');
    const secs = [...more.querySelectorAll(':scope > details.sect')]
      .filter(d => !d.hidden && !(remote && d.classList.contains('local-only')))
      .map(d => {
        const k = d.id.slice(3), s = d.querySelector(':scope > summary');
        const name = (s ? s.dataset.calmName || s.textContent : k).trim();
        if (s && !s.dataset.calmName) s.dataset.calmName = name;
        if (s) { const want = name + (on.has(k) ? ' · ON' : ''); if (s.textContent !== want) s.textContent = want; }
        return { name: name.replace(/\s*\(.*\)$/, ''), on: on.has(k) };
      });
    const txt = moreLine(secs);
    if (moreNames.textContent !== txt) moreNames.textContent = txt;
    more.hidden = !secs.length;
  }

  /** Something inside MORE was asked for (GO TO, a #status/<k> link, ALL SETTINGS' OPEN): open MORE first. */
  function openFor(el) {
    if (!more || !el || !more.contains(el) || el === more || more.open) return;
    more.open = true;
    requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }
  /** A #status/<k> link: MORE and the section around a part (#status/gdHouse is inside DECK CONTROLS) open too. */
  function fromHash() {
    const [v, sub] = location.hash.slice(1).split('/');
    if (v !== 'status' || !sub || !status) return;
    const el = status.querySelector('#go-' + CSS.escape(sub)) || $id(sub);
    if (!el || !status.contains(el)) return;
    for (let n = el.parentElement; n && n !== status; n = n.parentElement) if (n.tagName === 'DETAILS' && n !== more && !n.open) n.open = true;
    openFor(el);
  }

  arrangeStatus();
  fromHash();
  addEventListener('hashchange', fromHash);
  document.addEventListener('toggle', e => { if (e.target !== more && e.target.open) openFor(e.target); }, true);
  setInterval(refreshMore, 2000);

  // ---------- NOW ----------
  const CELLS = [['night', '.n-set'], ['lineup', '.n-lineup'], ['showctl', '.n-sc'], ['room', '.n-room'], ['sound', '.n-snd']];
  function nowContext() {
    const s = S.status, L = S.live, plan = S.plan;
    let on = null;
    try { on = onNow(); } catch (e) {}
    let planned = false;
    try { planned = (typeof nights !== 'undefined' ? nights : []).some(n => s && n.date === s.night && n.lineup && n.lineup.length); } catch (e) {}
    const c = S.sc;
    const scOn = !!c && (!!(c.link && c.link.on) || !!(c.midi && c.midi.on) || Object.values(c.targets || {}).some(t => t && t.on));
    return {
      dj: (on && on.dj) || (s && s.dj) || '', left: on ? on.left : null, next: on && on.next, off: on && on.off,
      lineup: !!(plan && plan.lineup && plan.lineup.length) || planned,
      musicOff: !!((plan && plan.musicOff) || (L && L.plan && L.plan.musicOff)),
      scLoaded: !!c, scOn, room: !!(s && s.room), card: !!(s && s.audio && s.audio.card),
    };
  }
  /** app.js frameNight calls this after it fills the blocks (20 times a second while NOW is up). */
  function now(q) {
    const all = typeof editing !== 'undefined' && editing;
    let c = null;
    CELLS.forEach(([b, sel]) => {
      const e = q(sel), cell = e && e.closest('.cell');
      if (!cell) return;
      if (!c && !all) c = nowContext();
      const quiet = !all && quietBlock(b, c);
      if (cell.classList.contains('calm-quiet') !== quiet) cell.classList.toggle('calm-quiet', quiet);
    });
    const row = document.querySelector('#safetyNow .sfc-row');
    if (row) {
      let hold = false, holdSrc = null, phones = 'crew';
      try { const sn = Safety.now(); hold = !!(sn && sn.hold); holdSrc = hold ? sn.hold.src || null : null; phones = (sn && sn.phones) || 'crew'; } catch (e) {}
      const hide = !safetyRowShown({ unlocked: typeof unlocked !== 'undefined' && unlocked, hold, holdSrc, phones });
      if (row.hidden !== hide) row.hidden = hide;
    }
  }

  return Object.assign({ now, refreshMore }, pure);
})();
if (typeof module !== 'undefined') module.exports = Calm;
