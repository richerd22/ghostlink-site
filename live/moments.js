'use strict';
/*
 * MOMENTS (DECISIONS #135): the night's timeline of named moments (SPEECHES, FIRST DANCE, CAKE ...). HARD STOP's
 * TIMELINE wins when it sent one; GHOST LINK's own list per NIGHTS date otherwise (the NIGHTS form: one a line,
 * "21:30 SPEECHES // mic 2 on").
 * The screens show only the next one, in its last 30 minutes: "SPEECHES IN 12", then "SPEECHES NOW" for 5 minutes.
 *   Moments.start('dash')   one calm line on every dashboard view (folded by THE LINE RULE, lines.js) + the NIGHTS field
 *   Moments.start('stage')  STAGE CLOCK: a line above the crew calls, with the note
 *   Moments.start('crew')   CREW SCREEN: a MOMENT row
 *   Moments.start('tv')     TV: a small line at the top right
 *   Moments.start('crowd')  NEXT UP, only with ?moments=1: the name only, never the note
 * Text nodes only: names and notes come from the network. Pure parts run under Node (src/test/js/lines.test.js).
 */
const Moments = (() => {
  const SOON_MS = 30 * 60_000, NOW_KEEP_MS = 5 * 60_000;
  /** The line, or '' outside the last 30 min (the box's Moments.say). Pure. */
  function say(m, now) {
    if (!m || !m.n || typeof m.at !== 'number') return '';
    const left = m.at - now;
    if (left > SOON_MS || left <= -NOW_KEEP_MS) return '';
    return left <= 0 ? m.n + ' NOW' : m.n + ' IN ' + Math.ceil(left / 60000);
  }
  if (typeof document === 'undefined') return { say, SOON_MS, NOW_KEEP_MS };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const css = document.createElement('style');
  css.textContent = `
    .mo-line[hidden], .mo-row[hidden] { display: none !important; }
    .mo-dash { margin: 8px 16px 0; padding: 4px 10px; border-left: 3px solid var(--fg, #fff); font-weight: 600; letter-spacing: .06em; font-variant-numeric: tabular-nums; }
    .mo-dash small { color: var(--grey, #9a9a9a); font-weight: 400; margin-left: .8em; letter-spacing: .02em; }
    body.ln-small .mo-dash { margin: 3px 10px 0; padding: 1px 8px; font-size: 12px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mo-stage { font-size: 4.2cqh; font-weight: 600; letter-spacing: .06em; color: var(--fg, #fff); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mo-stage small { color: var(--grey, #9a9a9a); font-size: .7em; font-weight: 400; margin-left: 1.2cqw; }
    .mo-tv { position: fixed; top: 1.2vh; right: 2vw; z-index: 2147479000; font-size: 2.6vh; font-weight: 600; letter-spacing: .06em; color: #fff; background: #000;
      border: 2px solid #fff; padding: .3vh 1vw; white-space: nowrap; font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    .mo-crowd { display: block; margin-top: 2cqh; font-size: 5cqh; font-weight: 600; letter-spacing: .08em; text-align: center; }`;
  document.head.appendChild(css);

  let feed = null, skew = 0, mode = 'dash';
  async function load() {
    const t0 = Date.now();
    try {
      const r = await fetch('/api/moments/next' + (mode === 'crowd' ? '?view=crowd' : ''), { cache: 'no-store' });
      if (!r.ok) return;
      const f = await r.json(), t1 = Date.now();
      if (typeof f.now === 'number') skew = (t0 + t1) / 2 - f.now;
      feed = f;
    } catch (e) { /* keep the last reading */ }
  }
  function every(fn) { load().then(fn); setInterval(() => { if (!document.hidden) load(); }, 15000); setInterval(fn, 1000); }

  function line(cls) {
    const box = el('div', 'mo-line ' + cls); box.hidden = true; box.setAttribute('role', 'status');
    const b = el('b'), small = el('small');
    box.append(b, small);
    return { box, draw(withNote) {
      const m = feed && feed.moment, t = say(m, Date.now() - skew);
      box.hidden = !t;
      if (b.textContent !== t) b.textContent = t;
      const nt = withNote && t && m.nt ? m.nt : '';
      if (small.textContent !== nt) small.textContent = nt;
      small.hidden = !nt;
    } };
  }

  /** The NIGHTS form: a MOMENTS box under the notes, loaded and saved with the night (its own route). */
  function nightsField() {
    const form = document.getElementById('nightForm'), notes = document.getElementById('nNotes'), date = document.getElementById('nDate');
    if (!form || !notes || !date || document.getElementById('nMoments')) return;
    const ta = el('textarea'); ta.id = 'nMoments'; ta.rows = 2;
    ta.placeholder = 'Moments (optional), one a line:\n21:30 SPEECHES // mic 2 on\n22:15 FIRST DANCE';
    ta.setAttribute('aria-label', 'Moments');
    const msg = el('div', 'note'); msg.id = 'nMomentsNote';
    notes.after(ta, msg);
    let loadedFor = null;
    async function fill() {
      const d = date.value;
      if (!d || d === loadedFor) return;
      loadedFor = d;
      try { const r = await fetch('/api/schedule/moments?date=' + encodeURIComponent(d), { cache: 'no-store' }); if (r.ok) ta.value = (await r.json()).text || ''; } catch (e) {}
    }
    new MutationObserver(() => { if (!form.hidden) { loadedFor = null; fill(); } }).observe(form, { attributes: true, attributeFilter: ['hidden'] });
    date.addEventListener('change', () => { loadedFor = null; fill(); });
    form.addEventListener('submit', async () => {
      const d = date.value;
      if (!d) return;
      try {
        const r = await fetch('/api/schedule/moments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: d, text: ta.value }) });
        const j = await r.json().catch(() => ({}));
        msg.textContent = r.ok ? '' : r.status === 401 ? 'Moments not saved: unlock, then SAVE again.' : (j.error || 'Moments not saved (' + r.status + ').');
        if (r.ok) load();
      } catch (e) { msg.textContent = 'Moments not saved: no answer from the box.'; }
    });
  }

  function start(m) {
    mode = m;
    if (m === 'dash') {
      const l = line('mo-dash'); l.box.id = 'momentNow';
      const at = document.getElementById('boothAsks');
      if (at) at.after(l.box);
      nightsField();
      every(() => l.draw(true));
    } else if (m === 'stage') {
      const l = line('mo-stage');
      const at = document.getElementById('calls');
      if (at) at.before(l.box);
      every(() => l.draw(true));
    } else if (m === 'crew') {
      const row = el('div', 'row mo-row'); row.hidden = true;
      const b = el('b'), sp = el('span');
      row.append(el('small', null, 'MOMENT'), b, sp);
      const at = document.getElementById('dropRow');
      if (at) at.after(row);
      every(() => {
        const mo = feed && feed.moment, t = say(mo, Date.now() - skew);
        row.hidden = !t;
        // the name big (the row's column is narrow), "IN 12 · the note" under it, like NEXT's "AT 23:30"
        const name = t ? mo.n : '', rest = t ? t.slice(mo.n.length + 1) + (mo.nt ? ' · ' + mo.nt : '') : '';
        if (b.textContent !== name) b.textContent = name;
        if (sp.textContent !== rest) sp.textContent = rest;
      });
    } else if (m === 'tv') {
      const l = line('mo-tv');
      document.body.append(l.box);
      every(() => l.draw(false));
    } else if (m === 'crowd') {
      if (!/[?&]moments=1\b/.test(location.search)) return;
      const l = line('mo-crowd');
      const at = document.getElementById('foot');
      if (at) at.after(l.box);
      every(() => l.draw(false));
    }
  }
  return { say, start };
})();
if (typeof module !== 'undefined') module.exports = Moments;
