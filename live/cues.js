'use strict';
/*
 * CUES (DECISIONS #163): the night's production cues (CO2, LASER, CONFETTI ...). The box keeps the clock and the drops
 * (core/Cues.java); this file only shows them and sends a person's taps. Nothing here fires anything: a person fires
 * the CO2. A night with no cues shows nothing at all.
 *   Cues.start('dash')   one block on every dashboard view (THE LINE RULE key 'cue', #cueLine): production phones get
 *                        CONFIRM / NOT TONIGHT / +10 MIN, IN 30 S / IN 1 MIN / NOW, THIS DROP / NEXT DROP, the picked
 *                        drop's CONFIRM / NEXT ONE / CANCEL; the DJ's phone (role DJ) only "CO2 IN 4 - CONFIRMED".
 *                        Plus the NIGHTS form's CUES rows, and the marker on the deck's waveform (Cues.marks).
 *   Cues.start('stage')  STAGE CLOCK: one line (the crew's)
 *   Cues.start('crew')   CREW SCREEN: a CUE row
 *   Cues.start('tv')     TV: the DJ's CONFIRMED line, only when the owner's CUES ON THE TV is on
 * Text nodes only: names come from the network. Pure parts run under Node (src/test/js/cues.test.js).
 */
const Cues = (() => {
  const two = n => String(n).padStart(2, '0');
  const hm = ms => { const d = new Date(ms); return two(d.getHours()) + ':' + two(d.getMinutes()); };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? Math.floor(s / 60) + ':' + two(s % 60) : s + ' S'; };
  const mins = ms => Math.max(1, Math.ceil(ms / 60000));
  const bars = d => d && d.bars != null ? d.bars + (d.bars === 1 ? ' BAR' : ' BARS') : '';
  const HOW = { at: '', around: 'AROUND ', drop: 'DROP AFTER ' };

  /**
   * The words for one cue: {t (the line), sub (small), tone ('' | 'soon' | 'now' | 'done'), acts: [[label, act, in?]]}.
   * dj = the DJ's phone (only a confirmed cue, never the asks). drops = how many drops the box sees ahead. Pure.
   */
  function words(c, now, dj, drops) {
    if (!c || !c.n) return null;
    const left = c.at - now, when = HOW[c.how] + hm(c.at);
    if (dj) {
      if (c.dj) return { t: c.dj, sub: '', tone: 'soon', acts: [] };
      if (c.st === 'called' && c.goAt) return { t: c.n + (c.drop ? ' AT THE DROP · ' + bars(c.drop) : ' IN ' + mmss(c.goAt - now)), sub: '', tone: 'now', acts: [] };
      return null;
    }
    const calls = [['NOW', 'call', 0], ['IN 30 S', 'call', 30], ['IN 1 MIN', 'call', 60]];
    if (drops > 0) calls.push(['THIS DROP', 'thisdrop'], ['PICK A DROP', 'pick']);
    if (drops > 1) calls.splice(4, 0, ['NEXT DROP', 'nextdrop']);
    const push = ['+10 MIN', 'push'];
    switch (c.st) {
      case 'plan': return null;
      case 'prep': return { t: 'PREP ' + c.n + ' · ' + when, sub: 'IN ' + mins(left) + ' MIN', tone: '', acts: [['CONFIRM', 'ok'], ['NOT TONIGHT', 'skip'], push] };
      case 'soon': return { t: c.n + ' IN ' + mins(left) + ' · CONFIRM?', sub: when, tone: 'soon', acts: [['CONFIRM', 'ok'], ['NOT TONIGHT', 'skip'], push] };
      case 'ok': {
        const a = c.how === 'at' ? [['NOT TONIGHT', 'skip'], push] : c.how === 'around' ? calls.concat([['NOT TONIGHT', 'skip'], push]) : [['NOT TONIGHT', 'skip'], push];
        return { t: c.n + (c.how === 'around' ? ' AROUND ' + mins(left) + ' MIN' : ' IN ' + mins(left)) + ' · CONFIRMED', sub: when + (c.by ? ' · ' + c.by : '') + (c.how === 'at' ? ' · COUNTS IN BY ITSELF' : c.how === 'drop' ? ' · AT THE FIRST DROP AFTER' : ''), tone: '', acts: a };
      }
      case 'now': return { t: c.n + ' NOW', sub: when, tone: 'now', acts: [] };
      case 'due': return { t: c.n + ' · CALL IT', sub: (c.why || (c.ok ? 'CONFIRMED' : 'NOT CONFIRMED')) + ' · ' + when, tone: 'now', acts: calls.concat([['NOT TONIGHT', 'skip'], push]) };
      case 'pick': return { t: c.n + ' AT THE DROP? · DECK ' + c.pick.deck + ' · ' + bars(c.pick) + ' · ' + mmss(c.pick.goAt - now), sub: 'ON THE WAVEFORM', tone: 'soon', acts: [['CONFIRM', 'go'], ['NEXT ONE', 'nextone'], ['CANCEL', 'cancel']] };
      case 'called': return c.drop
        ? { t: c.n + ' AT THE DROP · DECK ' + c.drop.deck + ' · ' + bars(c.drop) + ' · ' + mmss(c.goAt - now), sub: 'CALLED', tone: 'now', acts: [['NEXT ONE', 'nextone'], ['CANCEL', 'cancel']] }
        : { t: c.n + ' GO IN ' + mmss(c.goAt - now), sub: 'CALLED', tone: 'now', acts: [['CANCEL', 'cancel']] };
      case 'fired': return { t: c.n + ' · GONE', sub: '', tone: 'done', acts: [] };
      case 'skipped': return { t: c.n + ' · NOT TONIGHT', sub: '', tone: 'done', acts: [] };
      case 'missed': return { t: c.n + ' · MISSED', sub: 'NOBODY CALLED IT', tone: 'done', acts: [] };
      default: return null;
    }
  }
  /** The waveform markers for a deck: [{ms, label}] (a picked or called drop on that deck's track). Pure. */
  function marksFor(list, player, trackKey, now) {
    const out = [];
    (list || []).forEach(c => {
      const d = c.st === 'called' ? c.drop : c.st === 'pick' ? c.pick : null;
      if (d && d.deck === player && (!trackKey || d.track === trackKey)) out.push({ ms: d.ms, label: c.n + ' ' + mmss(d.goAt - now), called: c.st === 'called' });
    });
    return out;
  }
  /** The most pressing cue for a crew row / the stage line (called, pick, due, soon, ok, prep). Pure. */
  function pressing(list) {
    const rank = { called: 0, pick: 1, due: 2, now: 2, soon: 3, ok: 4, prep: 5 };
    return (list || []).filter(c => c.st in rank).sort((a, b) => rank[a.st] - rank[b.st] || a.at - b.at)[0] || null;
  }
  if (typeof document === 'undefined') return { words, marksFor, pressing, hm, mmss };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const css = document.createElement('style');
  css.textContent = `
    .cue-line[hidden], .cue-row[hidden], .cue-ed[hidden] { display: none !important; }
    .cue-line { margin: 8px 16px 0; }
    .cue-one { padding: 4px 10px; border-left: 3px solid var(--fg, #fff); margin-top: 4px; font-variant-numeric: tabular-nums; }
    .cue-one.soon { border-left-color: #ffb000; }
    .cue-one.now { border-left-color: #ff3b30; }
    .cue-one.done { opacity: .6; }
    .cue-one b { font-weight: 700; letter-spacing: .06em; }
    .cue-one small { color: var(--grey, #9a9a9a); margin-left: .8em; letter-spacing: .03em; }
    .cue-one .acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .cue-one .acts button { font: inherit; font-size: 12px; letter-spacing: .06em; padding: 4px 10px; min-height: 32px; background: transparent; color: var(--fg, #fff); border: 1px solid var(--line, #444); cursor: pointer; }
    .cue-one .acts button.go { border-color: var(--fg, #fff); font-weight: 700; }
    .cue-one .why { display: block; color: #ffb000; font-size: 12px; }
    body.ln-small .cue-line { margin: 3px 10px 0; }
    body.ln-small .cue-one { padding: 1px 8px; font-size: 12px; line-height: 16px; }
    body.ln-small .cue-one:nth-child(n+2) { display: none; }
    body.ln-small .cue-one small { display: none; }
    body.ln-small .cue-one .acts { gap: 4px; margin-top: 2px; }
    body.ln-small .cue-one .acts button { min-height: 24px; padding: 1px 7px; font-size: 11px; }
    .cue-stage { font-size: 4.2cqh; font-weight: 600; letter-spacing: .06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
    .cue-stage small { color: var(--grey, #9a9a9a); font-size: .7em; font-weight: 400; margin-left: 1.2cqw; }
    .cue-tv { position: fixed; top: 6.4vh; right: 2vw; z-index: 2147479000; font-size: 2.6vh; font-weight: 600; letter-spacing: .06em; color: #fff; background: #000;
      border: 2px solid #ffb000; padding: .3vh 1vw; white-space: nowrap; font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    .cue-ed { margin: 6px 0; }
    .cue-ed .cue-r { display: grid; grid-template-columns: minmax(0, 1fr) 9.5em 2.8em; gap: 6px; margin: 8px 0; align-items: stretch; }
    .cue-ed .cue-r > * { width: 100%; min-width: 0; max-width: none; margin: 0; box-sizing: border-box; }
    .cue-ed .cue-r input[type=text] { text-transform: uppercase; }
    .cue-ed .cue-r select { grid-column: 1 / 3; }
    .cue-ed .cue-r .cue-add { grid-column: 3; grid-row: 1; }
    @media (min-width: 700px) { .cue-ed .cue-r { grid-template-columns: minmax(0, 1fr) 9.5em 12em 2.8em; } .cue-ed .cue-r select { grid-column: 3; } .cue-ed .cue-r .cue-add { grid-column: 4; } }
    .cue-ed label { display: inline-flex; align-items: center; gap: .4em; white-space: nowrap; }
    .cue-ed label input { width: auto; margin: 0; }
    .cue-ed .opts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 6px 0; }
    .cue-ed .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
    .cue-ed .chips button, .cue-add { font: inherit; font-size: 12px; letter-spacing: .06em; padding: 3px 10px; min-height: 30px; background: transparent; color: var(--fg, #fff); border: 1px solid var(--line, #444); cursor: pointer; }
    .cue-ed label { font-size: 12px; letter-spacing: .06em; margin-right: 12px; }`;
  document.head.appendChild(css);

  // ---------- the feed ----------
  let feed = null, skew = 0, getList = null;
  async function load() {
    const t0 = Date.now();
    try {
      const r = await fetch('/api/cues', { cache: 'no-store' });
      if (!r.ok) return;
      const f = await r.json(), t1 = Date.now();
      if (typeof f.now === 'number') skew = (t0 + t1) / 2 - f.now;
      feed = f;
    } catch (e) { /* keep the last reading */ }
  }
  const status = () => (typeof S !== 'undefined' && S.status) || (typeof Live !== 'undefined' && Live.S && Live.S.status) || null;
  const list = () => { const s = status(); return (s && s.cues) || (s ? [] : (feed && feed.tonight) || []); };
  const boxNow = () => { const s = status(); const sk = typeof S !== 'undefined' && S.status ? S.skew : typeof Live !== 'undefined' && Live.S && Live.S.status ? Live.S.skew : skew; return Date.now() - (sk || 0); };
  const drops = () => { const s = status(); return s && typeof s.cuesDrops === 'number' ? s.cuesDrops : 0; };

  /** For waves.js (app.js's waveOpt): the markers on this deck's scrolling waveform. */
  function marks(player, trackKey) { const l = list(); return l.length ? marksFor(l, player, trackKey, boxNow()) : null; }

  // ---------- the dashboard ----------
  function dash() {
    const box = el('div', 'cue-line'); box.id = 'cueLine'; box.hidden = true; box.setAttribute('aria-live', 'polite');
    const at = document.getElementById('crewCalls');
    if (at) at.after(box); else document.body.prepend(box);
    let key = '';
    const busy = new Set();
    async function tap(c, act, inS) {
      if (typeof unlocked !== 'undefined' && !unlocked) { if (typeof needUnlock === 'function') needUnlock(); return; }
      if (busy.has(c.k)) return;
      busy.add(c.k);
      try {
        const from = typeof role !== 'undefined' && typeof ROLES !== 'undefined' && ROLES[role] ? ROLES[role].label : 'PRODUCTION';
        const r = await post('/api/cues/act', { k: c.k, act, in: inS || 0, min: 10, from: from === 'DJ' ? 'BOOTH' : from });
        const j = await r.json().catch(() => ({}));
        if (!r.ok && r.status !== 401) { key = 'x'; why.set(c.k, j.error || (typeof glWhy === 'function' ? glWhy(r.status, j) : 'That didn\'t go through.')); }
      } catch (e) { /* the next status shows the truth */ }
      busy.delete(c.k); if (key !== 'x') key = '';
    }
    const why = new Map(); // the box's words for a tap that didn't go (shown under that cue until it changes)
    setInterval(() => {
      const l = list(), now = boxNow(), dj = typeof role !== 'undefined' && role === 'dj';
      const rows = l.map(c => [c, words(c, now, dj, drops())]).filter(x => x[1]);
      const k = rows.map(([c, w]) => c.k + w.t + w.sub + w.acts.map(a => a[0]).join()).join('|') + dj;
      if (k === key) return;
      if (key && key !== 'x') why.clear(); // the cue moved on: its old answer goes
      key = k;
      box.replaceChildren(...rows.map(([c, w]) => {
        const d = el('div', 'cue-one' + (w.tone ? ' ' + w.tone : ''));
        d.append(el('b', null, w.t));
        if (w.sub) d.append(el('small', null, w.sub));
        if (w.acts.length) {
          const a = el('div', 'acts');
          w.acts.forEach(([label, act, inS]) => {
            const b = el('button', act === 'ok' || act === 'go' ? 'go' : null, label); b.type = 'button';
            b.addEventListener('click', () => tap(c, act, inS));
            a.append(b);
          });
          d.append(a);
          if (why.has(c.k)) d.append(el('span', 'why', why.get(c.k)));
        }
        return d;
      }));
      box.hidden = !rows.length;
    }, 500);
  }

  // ---------- the NIGHTS form ----------
  function nightsField() {
    const form = document.getElementById('nightForm'), date = document.getElementById('nDate');
    const after = document.getElementById('nMomentsNote') || document.getElementById('nNotes');
    if (!form || !date || !after || document.getElementById('nCues')) return;
    const add = el('button', 'cue-add', '+ CUES (CO2, LASER ...)'); add.type = 'button'; add.hidden = true;
    const ed = el('div', 'cue-ed'); ed.id = 'nCues'; ed.hidden = true;
    const rowsBox = el('div'), chips = el('div', 'chips'), opts = el('div', 'opts'), msg = el('div', 'note');
    const offL = el('label'), off = el('input'); off.type = 'checkbox'; offL.append(off, document.createTextNode(' OFF TONIGHT'));
    const copy = el('button', 'cue-add', 'COPY TO NEXT NIGHT'); copy.type = 'button';
    opts.append(offL, copy);
    ed.append(el('small', null, 'CUES · production is told PREP and asked CONFIRM before each; nothing fires by itself'), rowsBox, chips, opts, msg);
    after.after(add, ed);
    function row(c) {
      const r = el('div', 'cue-r');
      const n = el('input'); n.type = 'text'; n.maxLength = 16; n.value = c.n || ''; n.placeholder = 'NAME'; n.setAttribute('aria-label', 'Cue name');
      const t = el('input'); t.type = 'time'; t.value = c.t || ''; t.setAttribute('aria-label', 'Cue time');
      const h = el('select'); h.setAttribute('aria-label', 'When');
      [['at', 'AT'], ['around', 'AROUND'], ['drop', 'NEXT DROP AFTER']].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; h.append(o); });
      h.value = c.how || 'at';
      const x = el('button', 'cue-add', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove this cue');
      x.addEventListener('click', () => r.remove());
      r.append(n, t, h, x);
      rowsBox.append(r);
      return r;
    }
    let presets = ['CO2', 'LASER', 'CONFETTI', 'PYRO', 'SPARKLERS'];
    function drawChips() {
      chips.replaceChildren(...presets.concat(['+ OWN']).map(p => {
        const b = el('button', null, p); b.type = 'button';
        b.addEventListener('click', () => { const r = row({ n: p === '+ OWN' ? '' : p, how: p === 'CO2' ? 'around' : 'at' }); (p === '+ OWN' ? r.children[0] : r.children[1]).focus(); });
        return b;
      }));
    }
    let loadedFor = null, shown = false;
    async function fill() {
      const d = date.value;
      if (!d || d === loadedFor) return;
      loadedFor = d;
      try {
        const r = await fetch('/api/cues?date=' + encodeURIComponent(d), { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        shown = !!j.show;
        if (j.presets) presets = j.presets;
        drawChips();
        rowsBox.replaceChildren();
        (j.list || []).forEach(row);
        off.checked = !!j.off;
        add.hidden = !shown || (j.list || []).length > 0;
        ed.hidden = !shown || !(j.list || []).length;
        msg.textContent = '';
      } catch (e) {}
    }
    add.addEventListener('click', () => { add.hidden = true; ed.hidden = false; if (!rowsBox.children.length) drawChips(); });
    new MutationObserver(() => { if (!form.hidden) { loadedFor = null; fill(); } }).observe(form, { attributes: true, attributeFilter: ['hidden'] });
    date.addEventListener('change', () => { loadedFor = null; fill(); });
    const listNow = () => [...rowsBox.children].map(r => ({ n: r.children[0].value, t: r.children[1].value, how: r.children[2].value }));
    async function save() {
      const r = await fetch('/api/cues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: date.value, list: listNow(), off: off.checked }) });
      const j = await r.json().catch(() => ({}));
      msg.textContent = r.ok ? '' : r.status === 401 ? 'Cues not saved: unlock, then SAVE again.' : (j.error || 'Cues not saved: ' + glWhy(r.status, j));
      return r.ok ? j : null;
    }
    form.addEventListener('submit', async () => {
      if (!date.value || (!shown && !rowsBox.children.length)) return;
      try { await save(); } catch (e) { msg.textContent = 'Cues not saved: no answer from the box.'; }
    });
    copy.addEventListener('click', async () => {
      try {
        if (!(await save())) return;
        const r = await fetch('/api/cues/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: date.value }) });
        const j = await r.json().catch(() => ({}));
        msg.textContent = r.ok ? 'Copied to ' + j.copiedTo + '.' : r.status === 401 ? 'Unlock first.' : (j.error || glWhy(r.status, j));
      } catch (e) { msg.textContent = 'No answer from the box.'; }
    });
  }

  // ---------- the other screens ----------
  function line(cls) {
    const box = el('div', cls); box.hidden = true; box.setAttribute('role', 'status');
    const b = el('b'), small = el('small');
    box.append(b, small);
    return { box, set(t, s) { box.hidden = !t; if (b.textContent !== (t || '')) b.textContent = t || ''; if (small.textContent !== (s || '')) small.textContent = s || ''; small.hidden = !s; } };
  }
  function crewWords(now) {
    const c = pressing(list());
    if (!c) return null;
    if (c.dj) return { t: c.dj, sub: c.by ? 'BY ' + c.by : '' };
    const w = words({ ...c, why: null }, now, false, 0); // the long reasons stay on production's phones
    return w ? { t: w.t, sub: w.sub } : null;
  }
  function poll() { if (!status()) load(); }

  function start(m) {
    if (m === 'dash') { dash(); nightsField(); return; }
    poll(); setInterval(() => { if (!document.hidden) poll(); }, 5000);
    if (m === 'stage') {
      const l = line('cue-stage');
      const at = document.getElementById('calls');
      if (at) at.before(l.box);
      setInterval(() => { const w = crewWords(boxNow()); l.set(w && w.t, w && w.sub); }, 500);
    } else if (m === 'crew') {
      const row = el('div', 'row cue-row'); row.hidden = true;
      const b = el('b'), sp = el('span');
      row.append(el('small', null, 'CUE'), b, sp);
      const at = document.getElementById('dropRow');
      if (at) at.after(row);
      setInterval(() => { // the name big (the row's column is narrow), the rest under it, like the MOMENT row
        const c = pressing(list()), w = crewWords(boxNow());
        row.hidden = !w;
        const name = w ? c.n : '', rest = w ? (w.t.startsWith(c.n) ? w.t.slice(c.n.length).replace(/^ · /, '').trim() : w.t) + (w.sub && !w.sub.includes('.') ? ' · ' + w.sub : '') : '';
        if (b.textContent !== name) b.textContent = name;
        if (sp.textContent !== rest) sp.textContent = rest;
      }, 500);
    } else if (m === 'tv') {
      const l = line('cue-tv');
      document.body.append(l.box);
      setInterval(() => {
        const s = status(), on = s ? !!s.cuesTv : !!(feed && feed.tv);
        const c = on ? list().find(x => x.dj) : null;
        l.set(c ? c.dj : '', '');
      }, 1000);
    }
  }
  return { words, marksFor, pressing, marks, start };
})();
if (typeof module !== 'undefined') module.exports = Cues;
