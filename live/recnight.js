'use strict';
// RECORDING round 3 on the dashboard (DECISIONS #159). Own file: if anything here throws, the rest carries on.
//  - ● REC everywhere: the header pill (sound.js keeps its clock) becomes a button on every tab and in the corner
//    window; it opens the REC sheet: who started it, how long, what it's recording, STOP / CHANGE. On NOW, one line.
//  - NEVER FORGET TO STOP: MUSIC'S OFF · STILL RECORDING · STOPS BY ITSELF AT 02:15 [STOP NOW] [KEEP RECORDING], on every
//    tab, from status audio.recording.stopAsk (the box decides; THE LINE RULE places it).
//  - WHAT TO RECORD / HOW TO SAVE: ● RECORD opens one plain sheet: THIS SET (default) / THE NEXT 2, 3, 4 SETS / ALL
//    NIGHT; ONE FILE PER SET / ONE FILE FOR THE NIGHT / BOTH (only when it's more than one set). One tap starts it.
// Uses app.js globals ($, S, post, unlocked, needUnlock, clock, renderStatus) and sound.js (Sound). Text nodes only.
const RecNight = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hms = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
  const BY = { OWNER: 'THE OWNER', CREW: 'CREW', 'A TOOL': 'A TOOL', 'A PHONE': 'A PHONE' };
  const SETS = [[1, 'THIS SET'], [2, 'THE NEXT 2 SETS'], [3, 'THE NEXT 3 SETS'], [4, 'THE NEXT 4 SETS'], [0, 'ALL NIGHT']];
  const SAVES = [['sets', 'ONE FILE PER SET'], ['night', 'ONE FILE FOR THE NIGHT'], ['both', 'BOTH']];

  const css = document.createElement('style');
  css.textContent = `
    .rec-pill { pointer-events: auto !important; cursor: pointer; background: none; border: 0; font: inherit; padding: 0; }
    .rec-stop { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 6px 16px 0; padding: 8px 10px; border: 1px solid var(--air, #c22); }
    .rec-stop b { color: var(--air, #c22); font-size: 12px; letter-spacing: .08em; flex: 1 1 220px; }
    .rec-stop button { font: inherit; font-size: 12px; padding: 6px 10px; margin: 0; min-height: 0; letter-spacing: .06em; }
    .rec-stop .rs-stop { border-color: var(--air, #c22); color: var(--air, #c22); }
    body.ln-small .rec-stop { margin: 3px 8px 0; padding: 4px 8px; gap: 4px 8px; }
    body.ln-small .rec-stop b { font-size: 11px; flex-basis: 160px; }
    body.ln-small .rec-stop button { padding: 3px 8px; font-size: 11px; }
    .rec-now { color: var(--grey); font-size: 12px; margin: 0 0 8px; overflow-wrap: anywhere; cursor: pointer; }
    .rec-now b { color: var(--air, #c22); font-weight: 600; }
    .rn-sheet { position: fixed; inset: 0; z-index: 55; background: rgba(0,0,0,.72); display: flex; align-items: flex-start; justify-content: center; overflow: auto; padding: 12px; }
    .rn-card { background: var(--bg, #000); color: var(--fg, #fff); border: 1px solid var(--line, #333); max-width: 520px; width: 100%; padding: 14px 16px; display: grid; gap: 10px; }
    .rn-card h3 { margin: 0; font-size: 14px; letter-spacing: .1em; }
    .rn-card small { color: var(--grey, #9a9a9a); font-size: 11px; letter-spacing: .08em; }
    .rn-card p { margin: 0; font-size: 13px; line-height: 1.4; }
    .rn-opts { display: flex; flex-wrap: wrap; gap: 6px; }
    .rn-opts button { font: inherit; font-size: 12px; padding: 7px 10px; margin: 0; min-height: 0; letter-spacing: .06em; }
    .rn-opts button[aria-pressed=true] { background: var(--fg, #fff); color: var(--bg, #000); }
    .rn-go { display: flex; flex-wrap: wrap; gap: 8px; }
    .rn-go .rn-start { border-color: var(--air, #c22); color: var(--air, #c22); font-weight: 600; }
    @media (max-height: 480px) { .rn-card { padding: 8px 10px; gap: 6px; } .rn-card p { font-size: 12px; } .rn-opts button { padding: 4px 8px; font-size: 11px; } }`;
  document.head.appendChild(css);

  const audio = () => (typeof S !== 'undefined' && S.status && S.status.audio) || null;
  const recNow = () => { const a = audio(); return a && a.recording; };

  // ---- the header pill: a button on every tab ----
  const pill = document.getElementById('recPill');
  if (pill) {
    pill.setAttribute('role', 'button');
    pill.tabIndex = 0;
    pill.title = 'Recording: tap for who, how long, STOP';
    pill.addEventListener('click', () => sheet());
    pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sheet(); } });
  }

  // ---- the stop reminder (every tab) ----
  const stop = el('div', 'rec-stop'); stop.id = 'recStop'; stop.hidden = true; stop.setAttribute('aria-live', 'polite');
  const stopText = el('b');
  const stopBtn = el('button', 'rs-stop', '■ STOP NOW'); stopBtn.type = 'button';
  const keepBtn = el('button', null, 'KEEP RECORDING'); keepBtn.type = 'button';
  stop.append(stopText, stopBtn, keepBtn);
  const anchor = document.getElementById('showAlerts');
  if (anchor) anchor.insertAdjacentElement('afterend', stop);
  stopBtn.addEventListener('click', async () => {          // stopping is always allowed (anyone here), like ■ STOP
    if (stopBtn.dataset.armed !== '1') { stopBtn.dataset.armed = '1'; stopBtn.textContent = 'TAP AGAIN TO STOP'; setTimeout(() => { stopBtn.dataset.armed = ''; stopBtn.textContent = '■ STOP NOW'; }, 4000); return; }
    stopBtn.dataset.armed = '';
    await post('/api/audio', { record: false });
  });
  keepBtn.addEventListener('click', () => post('/api/rec/keep', {}));

  // ---- the NOW line ----
  const now = el('div', 'rec-now'); now.id = 'recNow'; now.hidden = true;
  now.title = 'Tap for the recording: who, how long, STOP';
  now.addEventListener('click', () => sheet());
  const mc = document.getElementById('mixcloudNow');
  if (mc) mc.insertAdjacentElement('afterend', now);

  function who(r) { return r && r.by ? (BY[r.by] || r.by) : null; }
  function lenNow(r) { return r && r.since ? (Date.now() - S.skew - r.since) / 1000 : 0; }

  /** One line about the recording on now (NOW, the sheet). Pure enough to test by hand. */
  function line(r) {
    const parts = ['● RECORDING ' + hms(lenNow(r))];
    if (r.dj) parts.push(String(r.dj).toUpperCase());
    if (r.sets !== 1 && r.mode) parts.push(r.mode + (r.set ? ' · SET ' + r.set : ''));
    if (who(r)) parts.push('STARTED BY ' + who(r) + ' AT ' + clock(r.since));
    return parts.join(' · ');
  }

  function render() {
    const r = recNow();
    const ask = r && r.stopAsk;
    stop.hidden = !ask;
    if (ask) {
      let t = ask.line || "MUSIC'S OFF · STILL RECORDING";
      if (ask.autoAt) t = t.replace(/AT \d\d:\d\d/, 'AT ' + clock(ask.autoAt)); // the phone's own clock
      if (stopText.textContent !== t) stopText.textContent = t;
      keepBtn.textContent = ask.why === 'sets' ? 'KEEP RECORDING (ONE MORE SET)' : 'KEEP RECORDING';
    }
    now.hidden = !r;
    if (r) {
      const t = line(r);
      if (now.textContent !== t) { now.textContent = ''; const b = el('b', null, t.slice(0, 11)); now.append(b, t.slice(11)); }
    }
    if (open && open.live) open.live();
  }
  setInterval(() => { try { render(); } catch (e) {} }, 1000); // the length counts up between statuses

  // ---- the sheets ----
  let open = null;
  function close() { if (open) { open.root.remove(); open = null; } }
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  function shell(title) {
    close();
    const root = el('div', 'rn-sheet'); root.setAttribute('role', 'dialog');
    const card = el('div', 'rn-card');
    root.appendChild(card);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    card.appendChild(el('h3', null, title));
    document.body.appendChild(root);
    open = { root, card };
    return card;
  }

  function options(list, cur, onPick) {
    const row = el('div', 'rn-opts');
    list.forEach(([v, label]) => {
      const b = el('button', null, label); b.type = 'button';
      b.setAttribute('aria-pressed', String(v === cur));
      b.addEventListener('click', () => { [...row.children].forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); onPick(v); });
      row.appendChild(b);
    });
    return row;
  }

  function stopsWords(plan, sets) {
    const m = plan && plan.autoStop;
    const first = sets === 1 ? 'Stops when you tap STOP, or after 10 min of quiet. A new DJ asks NEW FILE or KEEP GOING; it never cuts the set.'
      : sets === 0 ? 'Records the whole night; a split mark at each new DJ and each long quiet.'
      : 'Records ' + sets + ' sets; a split mark at each new DJ. Once the ' + (sets === 2 ? '2nd' : sets === 3 ? '3rd' : sets + 'th') + ' set is done it stops 2 min into the next one (KEEP RECORDING for one more).';
    const off = m ? ' At MUSIC OFF it reminds you, and stops by itself ' + m + ' min after once it\'s quiet.' : ' At MUSIC OFF it reminds you to stop.';
    return first + off + ' The FLAC is always kept whole.';
  }

  /** ● RECORD: WHAT TO RECORD / HOW TO SAVE, then START. */
  function choose() {
    const a = audio() || {}, plan = a.plan || {};
    let sets = plan.sets != null ? plan.sets : 1, save = plan.save || 'sets';
    const card = shell('● RECORD');
    const dj = (S.status && S.status.dj) || '';
    card.appendChild(el('small', null, 'WHAT TO RECORD' + (dj ? ' (ON THE DECKS: ' + String(dj).toUpperCase() + ')' : '')));
    const saveH = el('small', null, 'HOW TO SAVE IT');
    const saveRow = options(SAVES, save, v => { save = v; words(); });
    const say = el('p');
    const words = () => { saveH.hidden = saveRow.hidden = sets === 1; say.textContent = stopsWords(plan, sets); };
    card.appendChild(options(SETS, sets, v => { sets = v; words(); }));
    card.append(saveH, saveRow, say);
    const go = el('div', 'rn-go');
    const start = el('button', 'rn-start', '● START RECORDING'); start.type = 'button';
    const no = el('button', null, 'CANCEL'); no.type = 'button';
    const msg = el('p');
    start.addEventListener('click', async () => {
      start.disabled = true;
      const r = await post('/api/rec/plan', { sets, save });
      if (r.ok) {
        const r2 = await post('/api/audio', { record: true });
        if (r2.ok) { close(); return; }
      }
      start.disabled = false;
      if (r.status !== 401) { const j = await r.json().catch(() => ({})); msg.textContent = j.error || "Didn't start: try again."; }
    });
    no.addEventListener('click', close);
    go.append(start, no);
    card.append(go, msg);
    words();
    start.focus();
  }

  /** The REC sheet (tap the pill / the NOW line): who, how long, what, STOP, CHANGE. */
  function sheet() {
    const r = recNow(), a = audio() || {};
    if (!r) { if (a.recordOn) { const c = shell('● RECORD IS ARMED'); c.appendChild(el('p', null, 'It starts by itself when the music does.')); closeRow(c, true); } return; }
    const card = shell('● RECORDING');
    const info = el('p');
    const lines = () => {
      const x = recNow();
      if (!x) { close(); return; }
      info.textContent = [
        'For ' + hms(lenNow(x)) + (x.dj ? ', ' + x.dj : ''),
        who(x) ? 'Started by ' + who(x) + ' at ' + clock(x.since) : 'Started at ' + clock(x.since),
        (x.mode || 'THIS SET') + (x.sets !== 1 && x.set ? ' · set ' + x.set + ' now' : '') + (x.sets !== 1 ? ' · ' + (SAVES.find(s => s[0] === x.save) || [0, 'ONE FILE PER SET'])[1] : ''),
        x.roomMins != null ? 'Room for about ' + (x.roomMins >= 60 ? Math.floor(x.roomMins / 60) + ' h' : x.roomMins + ' min') + ' more' : null,
      ].filter(Boolean).join('\n');
    };
    info.style.whiteSpace = 'pre-line';
    card.appendChild(info);
    lines();
    open.live = lines;
    const ch = el('small', null, 'CHANGE WHAT IT RECORDS (FROM NOW ON)');
    let sets = r.sets != null ? r.sets : 1;
    const row = options(SETS, sets, async v => { sets = v; await post('/api/rec/plan', { sets: v }); });
    card.append(ch, row);
    const go = el('div', 'rn-go');
    const st = el('button', 'rn-start', '■ STOP RECORDING'); st.type = 'button';
    st.addEventListener('click', async () => {
      if (st.dataset.armed !== '1') { st.dataset.armed = '1'; st.textContent = 'TAP AGAIN TO STOP'; setTimeout(() => { st.dataset.armed = ''; st.textContent = '■ STOP RECORDING'; }, 4000); return; }
      await post('/api/audio', { record: false }); close();
    });
    const snd = el('a', 'btn', 'SOUND IN'); snd.href = '#network/sound';
    snd.addEventListener('click', close);
    const done = el('button', null, 'DONE'); done.type = 'button';
    done.addEventListener('click', close);
    go.append(st, snd, done);
    card.appendChild(go);
    if (!unlocked) { ch.hidden = row.hidden = true; }
  }

  function closeRow(card, withStop) {
    const go = el('div', 'rn-go');
    if (withStop) {
      const st = el('button', null, 'DISARM'); st.type = 'button';
      st.addEventListener('click', async () => { await post('/api/audio', { record: false }); close(); });
      go.appendChild(st);
    }
    const done = el('button', null, 'DONE'); done.type = 'button';
    done.addEventListener('click', close);
    go.appendChild(done);
    card.appendChild(go);
  }

  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { render(); } catch (e) { console.warn('recnight', e); }
  };
  return { choose, sheet, render, line };
})();
