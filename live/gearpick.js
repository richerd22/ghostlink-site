'use strict';
/*
 * GEAR GUIDES on the dashboard (#105): the mixer picker (short list, MORE..., NOT LISTED), the WHICH MIXER? box, and
 * "No mixer on the DJ network" made specific. Data and wording: gear.js. Own file: if anything here throws, the rest
 * of the dashboard carries on. Text nodes only: device and venue names come from the network.
 * Uses app.js globals ($, S, post, unlocked, needUnlock, pending, renderHeader, renderStatus).
 */
const GearPick = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, fn, cls) => { const b = el('button', cls || 'mini', text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const NO_MIXER = 'No mixer on the DJ network';
  const venue = () => (S.status && S.status.venue) || null;
  const now = () => Gear.current(S.devices, venue());

  /** The picker: the short list, MORE... (by maker), then NOT LISTED / LAPTOP / NO MIXER. onPick(entry). */
  function picker(currentId, onPick) {
    const g = Gear.groups(), wrap = el('div', 'gp');
    const row = el('div', 'gp-row');
    const add = (x, into, label) => {
      const b = btn(label || x.short || x.name, () => onPick(x), 'mini' + (x.id === currentId ? ' on' : ''));
      b.setAttribute('aria-pressed', String(x.id === currentId));
      into.append(b);
    };
    g.top.forEach(x => add(x, row));
    const cur = Gear.byId(currentId);
    if (cur && !cur.top && cur.kind !== 'laptop' && cur.kind !== 'none' && cur.kind !== 'other') add(cur, row);
    const more = el('div', 'gp-more');
    more.hidden = true;
    g.more.forEach(m => {
      const r = el('div', 'gp-row');
      r.append(el('span', 'gp-maker', m.maker));
      m.items.forEach(x => add(x, r));
      more.append(r);
    });
    const moreBtn = btn('MORE…', () => { more.hidden = !more.hidden; moreBtn.textContent = more.hidden ? 'MORE…' : 'LESS'; moreBtn.setAttribute('aria-expanded', String(!more.hidden)); });
    moreBtn.setAttribute('aria-expanded', 'false');
    row.append(moreBtn);
    const ends = el('div', 'gp-row');
    g.ends.forEach(x => add(x, ends));
    wrap.append(row, more, ends);
    return wrap;
  }

  // ---------- WHICH MIXER? ----------
  const box = el('div', 'share ssu gp-box');
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Which mixer');
  const inner = el('div', 'share-box ssu-box');
  box.append(inner);
  document.body.append(box);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });
  let saved = '', shownKey = '';

  function open() { box.hidden = false; saved = ''; shownKey = ''; render(); }
  function close() { box.hidden = true; try { renderHeader(); renderStatus(); } catch (e) {} }

  function choose(x) {
    const v = venue();
    Gear.store.set(v && v.id, x.id);
    render();
    try { renderHeader(); } catch (e) {}
  }

  const key = () => { const c = now(), v = venue(); return JSON.stringify([c && c.from, c && c.name, c && c.entry && c.entry.id, v && v.id, v && v.gear]); };
  function render() {
    if (box.hidden) return;
    shownKey = key();
    const c = now(), x = c && c.entry;
    const head = el('div', 'ssu-head');
    head.append(el('b', null, 'WHICH MIXER?'));
    const xb = btn('×', close, 'mini ssu-x');
    xb.setAttribute('aria-label', 'Close');
    head.append(xb);
    inner.replaceChildren(head);
    if (c && c.from === 'network') inner.append(el('p', 'ssu-p', 'On the DJ network: ' + c.name + '.'));
    else if (c && c.from === 'venue') inner.append(el('p', 'ssu-p ssu-dim', 'From this venue\'s GEAR notes. Different tonight? Tap it.'));
    // The mixer on the DJ network is the truth: no picking then (a tap would change nothing).
    if (!(c && c.from === 'network')) inner.append(picker(x && x.id, choose));
    if (!x) { inner.append(el('p', 'ssu-p ssu-dim', 'Pick it and this says what GHOST LINK can see with it, and where the sound card goes.')); return; }
    const lines = el('div', 'gp-lines');
    Gear.network(x, c.from === 'network').forEach((t, i) => lines.append(el('p', 'ssu-p' + (i ? ' ssu-dim' : ''), t)));
    const s = Gear.sound(x);
    if (s) lines.append(el('p', 'ssu-p', 'Sound card: ' + s.where + '. ' + s.cable));
    inner.append(lines);
    const acts = el('div', 'ssu-nav');
    if (typeof SoundSetup !== 'undefined') acts.append(btn('SET UP SOUND IN', () => { close(); SoundSetup.open(1); }, 'mini'));
    const v = venue(), inGear = v && Gear.fromText(v.gear);
    if (v && v.id && c.from !== 'network' && (x.kind === 'mixer' || x.kind === 'allinone') && (!inGear || inGear.id !== x.id)) {
      acts.append(btn(saved === x.id ? 'SAVED TO ' + v.name.toUpperCase() : 'SAVE TO ' + v.name.toUpperCase() + ' GEAR', () => saveToVenue(x), 'mini local-only'));
    }
    inner.append(acts);
    inner.append(el('p', 'ssu-p ssu-dim', 'Remembered on this phone for this venue.'));
  }

  /** Adds the mixer to the venue's GEAR notes (owner). Replaces another mixer's name already there. */
  async function saveToVenue(x) {
    if (!unlocked) { pending = { click: () => { open(); saveToVenue(x); } }; close(); return needUnlock(); }
    try {
      const r = await fetch('/api/venues', { cache: 'no-store' });
      const st = await r.json(), v = (st.venues || []).find(y => y.id === st.current);
      if (!v) return;
      const old = Gear.fromText(v.gear);
      let gear = String(v.gear || '');
      if (old && old.id !== x.id) {
        // the old mixer's name as written: swap it for the new one, keep the rest of the notes
        const words = [old.name].concat(old.also || []);
        const hit = words.map(w => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[- ]?'), 'i')).find(re => re.test(gear));
        gear = hit ? gear.replace(hit, x.name) : (gear ? gear + ' · ' : '') + x.name;
      } else if (!old) gear = (gear ? gear + ' · ' : '') + x.name;
      const res = await post('/api/venues', Object.assign({}, v, { gear }));
      if (res.status === 401) { pending = { click: () => { open(); saveToVenue(x); } }; close(); return needUnlock(); }
      if (res.ok) { saved = x.id; render(); }
    } catch (e) { console.warn('gear', e); }
  }

  // ---------- "No mixer on the DJ network", made specific ----------
  function rewrite(s) {
    if (!s || !s.problems) return;
    const p = s.problems.find(q => q.title === NO_MIXER);
    if (!p || p._gear) return;
    const c = now(), x = c && c.entry;
    p._gear = true;
    if (x) p.fix = Gear.network(x, false).join(' ');
    else p.fix += ' Which mixer is it? Tap WHICH MIXER? for what works with yours.';
  }
  function askBtn(into) {
    if (!into || into.querySelector('.gp-ask')) return;
    const c = now(), x = c && c.entry;
    const b = btn(x && x.kind !== 'other' ? 'MIXER: ' + (x.short || x.name) : 'WHICH MIXER?', e => { e.stopPropagation(); open(); }, 'mini gp-ask');
    into.append(b);
  }
  const oh = renderHeader;
  renderHeader = function () {
    try { rewrite(S.status); } catch (e) { console.warn('gear', e); }
    oh.apply(this, arguments);
    try {
      const a = $('alert'), b = a && a.querySelector('b');
      if (a && !a.hidden && b && b.textContent === NO_MIXER) askBtn(a);
    } catch (e) { console.warn('gear', e); }
  };
  const os = renderStatus;
  renderStatus = function () {
    try { rewrite(S.status); } catch (e) { console.warn('gear', e); }
    os.apply(this, arguments);
    try {
      const li = [...($('problems') ? $('problems').children : [])].find(l => l.querySelector('b') && l.querySelector('b').textContent === NO_MIXER);
      if (li) askBtn(li);
      // Redraw only when what the box shows changed (never under a finger, never collapsing MORE).
      if (!box.hidden && key() !== shownKey) render();
    } catch (e) { console.warn('gear', e); }
  };
  return { picker, open, close };
})();
