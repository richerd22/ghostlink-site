'use strict';
// NIGHT SAFETY on the dashboard (DECISIONS #127). Loaded after app.js and safety.js; uses app.js globals ($, post,
// unlocked, pending, needUnlock, role, ROLES). createElement + textContent only.
//  - NOW: SHOW STOP (pick the message, confirm: every GHOST LINK screen goes red until ALL CLEAR) and HOLD (pick the
//    reason; RESUME ends it). Crew code or owner. Neither touches the players: the DJ stops the music.
//  - STATUS -> NIGHT SAFETY: CURFEW LADDER (steps before MUSIC OFF, TEST each), HEARING CARD, SHOW STOP's PA line,
//    DOOR COUNT. Changes are the owner's; the crew code can read them.
(() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const who = () => { const r = typeof role === 'string' ? role : 'dj'; return r === 'dj' ? 'BOOTH' : ((ROLES[r] && ROLES[r].label) || 'CREW'); };
  const css = document.createElement('style');
  css.textContent = `
    .sfc { display: grid; gap: 8px; margin: 14px 0 6px; }
    .sfc .sfc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .sfc .sfc-row > button { margin: 0; min-height: 48px; font-weight: 600; letter-spacing: .08em; }
    .sfc .sfc-stop { border-color: var(--air); color: var(--air); }
    .sfc .sfc-hold { border-color: var(--warn); color: var(--warn); }
    .sfc .sfc-pick { display: grid; gap: 6px; border: 1px solid var(--line); padding: 10px; }
    .sfc .sfc-pick[hidden] { display: none; }
    .sfc .sfc-opts { display: flex; flex-wrap: wrap; gap: 6px; }
    .sfc .sfc-opts .mini.on { background: var(--fg); color: var(--bg); }
    .sfc .sfc-pick input[type=text] { width: 100%; }
    .sfc .sfc-go { background: var(--air); border-color: var(--air); color: #fff; font-weight: 600; min-height: 44px; }
    .sfc .sfc-pick.hold .sfc-go { background: var(--warn); border-color: var(--warn); color: #000; }
    .sfc-card .sfc-step { display: grid; grid-template-columns: 76px 1fr; gap: 6px 8px; align-items: center; border-top: 1px solid var(--line); padding: 8px 0; }
    .sfc-card .sfc-step label { color: var(--grey); font-size: .8em; letter-spacing: .08em; }
    .sfc-card .sfc-step input, .sfc-card .sfc-step select { width: 100%; min-width: 0; }
    .sfc-card .sfc-step .sfc-acts { grid-column: 1 / -1; display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
    .sfc-card .sfc-step .sfc-acts small { margin-right: auto; color: var(--grey); }
    .sfc-card .sfc-min { display: flex; gap: 4px; align-items: center; }
    .sfc-card .sfc-step .sfc-min input { width: 72px; flex: none; }
    .sfc-card h4 { margin: 14px 0 4px; letter-spacing: .1em; font-size: .85em; }
    .sfc-card .sfc-line { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .sfc-card .sfc-line input[type=text] { flex: 1 1 200px; min-width: 0; }
    @media (min-width: 900px) { .sfc-card .sfc-step { grid-template-columns: 76px 1fr 76px 1fr; } }`;
  document.head.appendChild(css);

  // ================= NOW: SHOW STOP + HOLD =================
  const now = $('safetyNow');
  if (now) {
    const box = el('div', 'sfc');
    const row = el('div', 'sfc-row');
    const stopB = btn('SHOW STOP', 'sfc-stop');
    const holdB = btn('HOLD', 'sfc-hold');
    row.append(stopB, holdB);
    const note = el('div', 'note');

    function picker(kind, presets, placeholder, goText) {
      const p = el('div', 'sfc-pick' + (kind === 'hold' ? ' hold' : '')); p.hidden = true;
      const head = el('small', null, kind === 'stop' ? 'SHOW STOP · every GHOST LINK screen goes red until ALL CLEAR. The DJ stops the music.'
        : 'HOLD · the stage clock freezes the set\'s countdown. MUSIC OFF stays. RESUME ends it.');
      const opts = el('div', 'sfc-opts');
      let pick = presets[0];
      const marks = [];
      const txt = el('input'); txt.type = 'text'; txt.maxLength = kind === 'stop' ? 40 : 24; txt.placeholder = placeholder; txt.autocomplete = 'off';
      txt.setAttribute('aria-label', placeholder);
      presets.concat(['CUSTOM']).forEach(v => {
        const b = btn(v, 'mini', () => { pick = v; marks.forEach(x => x.classList.toggle('on', x === b)); txt.hidden = v !== 'CUSTOM'; if (v === 'CUSTOM') txt.focus(); });
        if (v === pick) b.classList.add('on');
        marks.push(b); opts.append(b);
      });
      txt.hidden = true;
      const pa = el('label', 'cs-check'); const paBox = el('input'); paBox.type = 'checkbox'; const paTxt = el('span');
      pa.append(paBox, paTxt); pa.hidden = true;
      const go = btn(goText, 'sfc-go'); const cancel = btn('CANCEL', 'mini', () => { p.hidden = true; });
      const acts = el('div', 'sfc-opts'); acts.append(go, cancel);
      p.append(head, opts, txt, pa, acts);
      const choose = v => { const b = marks.find(x => x.textContent === v); if (b) b.click(); }; // #131 WEATHER's HOLD? opens it on WEATHER / LIGHTNING
      return { p, go, pa, paBox, paTxt, choose, get: () => pick === 'CUSTOM' ? { preset: 'CUSTOM', msg: txt.value.trim(), why: txt.value.trim() } : { preset: pick } };
    }
    const sp = picker('stop', ['STOP THE MUSIC', 'CLEAR THE FLOOR', 'MEDICAL'], 'Your message (40 letters)', 'SHOW IT ON EVERY SCREEN');
    const hp = picker('hold', ['WEATHER', 'LIGHTNING', 'STAGE FIX', 'SAFETY'], 'The reason (24 letters)', 'HOLD THE SHOW');
    box.append(row, sp.p, hp.p, note);
    now.append(box);

    stopB.addEventListener('click', async () => {
      hp.p.hidden = true; sp.p.hidden = !sp.p.hidden;
      if (sp.p.hidden) return;
      try { // the PA line, when the owner picked one and ANNOUNCEMENTS is on
        const s = await (await fetch('/api/safety/settings', { cache: 'no-store' })).json();
        sp.pa.hidden = !(s.paClipName && s.announcements);
        sp.paTxt.textContent = ' ALSO PLAY ON THE PA: ' + (s.paClipName || '');
      } catch (e) { sp.pa.hidden = true; }
    });
    holdB.addEventListener('click', () => {
      sp.p.hidden = true;
      const h = Safety.now() && Safety.now().hold;
      if (h && h.src === 'box') { resume(); return; }
      hp.p.hidden = !hp.p.hidden;
    });
    sp.go.addEventListener('click', async () => {
      const v = sp.get();
      if (v.preset === 'CUSTOM' && !v.msg) { note.textContent = 'Type the message first.'; return; }
      if (!unlocked) { pending = sp.go; return needUnlock(); }
      const r = await post('/api/safety/showstop', { preset: v.preset, msg: v.msg || '', pa: !sp.pa.hidden && sp.paBox.checked, confirm: true, from: who() });
      const j = await r.clone().json().catch(() => ({}));
      if (r.ok) { sp.p.hidden = true; note.textContent = 'SHOW STOP is on every screen.' + (j.pa ? ' ' + j.pa : ''); }
      else if (r.status !== 401) note.textContent = j.error || 'SHOW STOP didn\'t go through. Try again.';
    });
    hp.go.addEventListener('click', async () => {
      const v = hp.get();
      if (v.preset === 'CUSTOM' && !v.why) { note.textContent = 'Type the reason first.'; return; }
      if (!unlocked) { pending = hp.go; return needUnlock(); }
      const r = await post('/api/safety/hold', { preset: v.preset, why: v.why || '', from: who() });
      const j = await r.clone().json().catch(() => ({}));
      if (r.ok) { hp.p.hidden = true; note.textContent = 'HOLD on the screens. RESUME ends it.'; }
      else if (r.status !== 401) note.textContent = j.error || 'HOLD didn\'t go through.';
    });
    async function resume() {
      if (!unlocked) { pending = holdB; return needUnlock(); }
      const r = await post('/api/safety/resume', {});
      if (r.ok) note.textContent = 'Resumed.';
    }
    // #131 WEATHER: its HOLD? button opens this picker on WEATHER or LIGHTNING. A person still taps HOLD THE SHOW.
    window.SafetyCtl = {
      openHold(preset) {
        sp.p.hidden = true;
        const h = Safety.now() && Safety.now().hold;
        if (h) { note.textContent = 'The show is already on HOLD.'; return false; }
        hp.choose(preset === 'LIGHTNING' ? 'LIGHTNING' : 'WEATHER');
        hp.p.hidden = false;
        hp.p.scrollIntoView && hp.p.scrollIntoView({ block: 'nearest' });
        return true;
      }
    };
    Safety.on(s => {
      const h = s.hold;
      holdB.textContent = h && h.src === 'box' ? 'RESUME' : h ? 'HOLD (HARD STOP)' : 'HOLD';
      holdB.disabled = !!h && h.src !== 'box';
    });
  }

  // ================= STATUS -> NIGHT SAFETY =================
  const card = $('safetyCard');
  if (!card) return;
  card.classList.add('sfc-card');
  const CREW = [['', 'NO CREW CALL'], ['wrap5', 'WRAP IT UP IN 5 MIN'], ['wrap1', 'WRAP IT UP IN 1 MIN'], ['wrapnow', 'WRAP IT UP NOW'], ['custom', 'MY OWN CALL']];
  const LIGHT = [['', 'NO COLOUR'], ['amber', 'AMBER'], ['orange', 'ORANGE'], ['red', 'RED']];
  let S = null, steps = [];
  const msg = el('div', 'note');
  const body = el('div');
  card.append(body, msg);

  function say(t, warn) { msg.textContent = t || ''; msg.classList.toggle('warn', !!warn); }
  async function load() {
    try {
      const r = await fetch('/api/safety/settings', { cache: 'no-store' });
      if (r.status === 401) { body.replaceChildren(el('div', 'note', 'Unlock (the lock above) to see the CURFEW LADDER, the HEARING card, SHOW STOP\'s PA line and the DOOR COUNT.')); return; }
      if (!r.ok) return;
      S = await r.json();
      steps = S.ladder.steps.map(s => ({ ...s }));
      render();
    } catch (e) {}
  }
  async function send(path, b, ok) {
    if (!unlocked) { return needUnlock(); }
    const r = await post(path, b);
    const j = await r.clone().json().catch(() => ({}));
    if (r.status === 403) { say('That needs the owner\'s password, not tonight\'s crew code.', true); return null; }
    if (!r.ok) { if (r.status !== 401) say(j.error || 'Didn\'t save.', true); return null; }
    if (j.ladder) { S = j; steps = S.ladder.steps.map(s => ({ ...s })); }
    render();
    if (ok) say(j.said || ok);
    return j;
  }
  const hm = ms => ms == null ? '--:--' : Safety.hhmm(ms);

  function select(opts, val) {
    const s = el('select');
    opts.forEach(([v, l]) => { const o = el('option', null, l); o.value = v; s.append(o); });
    s.value = val; return s;
  }

  function stepRow(st, i) {
    const r = el('div', 'sfc-step');
    const min = el('input'); min.type = 'number'; min.min = 0; min.max = 120; min.value = st.min; min.inputMode = 'numeric';
    min.setAttribute('aria-label', 'Minutes before MUSIC OFF');
    min.addEventListener('change', () => { st.min = Number(min.value); });
    const mw = el('div', 'sfc-min'); mw.append(el('span', null, '−'), min, el('small', null, 'MIN'));
    const tv = el('input'); tv.type = 'text'; tv.maxLength = 40; tv.value = st.tv || ''; tv.placeholder = 'e.g. 30 MIN TO GO';
    tv.addEventListener('input', () => { st.tv = tv.value; });
    const isCustom = st.crew && !['wrap5', 'wrap1', 'wrapnow'].includes(st.crew);
    const crew = select(CREW, isCustom ? 'custom' : (st.crew || ''));
    const crewTxt = el('input'); crewTxt.type = 'text'; crewTxt.maxLength = 60; crewTxt.value = isCustom ? st.crew : ''; crewTxt.placeholder = 'The crew call';
    crewTxt.hidden = !isCustom;
    crew.addEventListener('change', () => { crewTxt.hidden = crew.value !== 'custom'; st.crew = crew.value === 'custom' ? crewTxt.value : crew.value; });
    crewTxt.addEventListener('input', () => { st.crew = crewTxt.value; });
    const crewW = el('div'); crewW.append(crew, crewTxt);
    const paOpts = [['', 'NO PA'], ['auto', 'THE AUTO CALLS CARD (10 / 5 / 0 MIN)']].concat((S.ladder.paChoices || []).map(c => [c.id, c.name]));
    const pa = select(paOpts, st.pa || '');
    pa.addEventListener('change', () => { st.pa = pa.value; });
    const osc = el('input'); osc.type = 'text'; osc.maxLength = 61; osc.value = st.osc || ''; osc.placeholder = '/your/osc/address';
    osc.addEventListener('input', () => { st.osc = osc.value.trim(); });
    const li = select(LIGHT, st.lights || '');
    li.addEventListener('change', () => { st.lights = li.value; });
    const lab = t => el('label', null, t);
    r.append(lab('WHEN'), mw, lab('TV LINE'), tv, lab('CREW'), crewW, lab('PA'), pa, lab('OSC'), osc, lab('LIGHTS'), li);
    const acts = el('div', 'sfc-acts');
    acts.append(el('small', null, st.done ? 'DONE TONIGHT · ' + hm(st.at) : st.at ? 'AT ' + hm(st.at) : 'NO MUSIC OFF YET'));
    acts.append(btn('TEST', 'mini', () => send('/api/safety/ladder/test', { id: String(st.id) }, 'Tested.')));
    acts.append(btn('REMOVE', 'mini', () => { steps.splice(i, 1); render(); say('Removed: SAVE to keep it.'); }));
    r.append(acts);
    return r;
  }

  function sw(on, label, fn) {
    const b = btn(on ? label + ': ON' : label + ': OFF', on ? 'on' : '', fn); // #132: full-size, like every card's switches
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    return b;
  }

  function render() {
    if (!S) return;
    const L = S.ladder;
    const parts = [];
    // ---- CURFEW LADDER ----
    parts.push(el('h4', null, 'CURFEW LADDER'));
    const top = el('div', 'sfc-line');
    top.append(sw(L.on, 'LADDER', () => send('/api/safety/ladder', { on: !L.on }, L.on ? 'CURFEW LADDER off.' : 'CURFEW LADDER on: each step once tonight.')));
    top.append(el('small', null, 'MUSIC OFF ' + hm(L.musicOffAt) + (L.musicOffFrom === 'hardstop' ? ' (HARD STOP)' : L.musicOffAt ? ' (NIGHTS)' : ' · set it in NIGHTS')));
    parts.push(top);
    parts.push(el('div', 'note', 'Each step fires once, its minutes before MUSIC OFF. A PA clip plays only with ANNOUNCEMENTS on, never over another one or a crew call.'));
    if (L.appAutoCalls) parts.push(el('div', 'note', 'HARD STOP\'s app is doing AUTO CALLS: the ladder stays off the PA (no doubles).'));
    else if (!L.announcements && steps.some(s => s.pa)) parts.push(el('div', 'note warn', 'PA steps need ANNOUNCEMENTS on (STATUS -> ANNOUNCEMENTS).'));
    steps.forEach((s, i) => parts.push(stepRow(s, i)));
    const sa = el('div', 'sfc-line');
    sa.append(btn('+ ADD A STEP', 'mini', () => {
      if (steps.length >= 8) { say('At most 8 steps.', true); return; }
      const used = new Set(steps.map(s => Number(s.min)));
      const m = [20, 15, 3, 2, 0, 45, 60].find(x => !used.has(x));
      steps.push({ id: String(m), min: m, tv: '', crew: '', pa: '', osc: '', lights: '' }); render();
    }));
    sa.append(btn('SAVE THE LADDER', null, () => send('/api/safety/ladder', { steps: steps.map(s => ({ min: Number(s.min), tv: s.tv || '', crew: s.crew === 'custom' ? '' : (s.crew || ''), pa: s.pa || '', osc: s.osc || '', lights: s.lights || '' })) }, 'Ladder saved.')));
    parts.push(sa);

    // ---- HEARING CARD ----
    const H = L.hearing;
    parts.push(el('h4', null, 'HEARING CARD'));
    const hl = el('div', 'sfc-line');
    hl.append(sw(H.on, 'ON THE TV', () => send('/api/safety/ladder', { hearing: { on: !H.on } }, H.on ? 'HEARING card off.' : 'HEARING card on.')));
    const every = select([['15', 'EVERY 15 MIN'], ['30', 'EVERY 30 MIN'], ['45', 'EVERY 45 MIN'], ['60', 'EVERY HOUR']], String(H.every));
    every.addEventListener('change', () => send('/api/safety/ladder', { hearing: { every: Number(every.value) } }, 'Saved.'));
    hl.append(every);
    const ht = el('input'); ht.type = 'text'; ht.maxLength = 60; ht.value = H.text; ht.setAttribute('aria-label', 'Hearing card words');
    ht.addEventListener('change', () => send('/api/safety/ladder', { hearing: { text: ht.value } }, 'Saved.'));
    hl.append(ht);
    parts.push(hl);
    parts.push(el('div', 'note', 'A small calm card on the TV for 15 s. Blank = the usual words.'));

    // ---- SHOW STOP's PA line ----
    parts.push(el('h4', null, 'SHOW STOP · PA LINE'));
    const pl = el('div', 'sfc-line');
    const ps = select([['', 'NONE']].concat((S.paLines || []).map(c => [c.id, c.name + (c.category === 'EMERGENCY' ? ' (EMERGENCY)' : '')])), S.paClip || '');
    ps.addEventListener('change', () => send('/api/safety/showstop/settings', { paClip: ps.value }, 'Saved.'));
    pl.append(ps);
    parts.push(pl);
    parts.push(el('div', 'note', 'Offered as a tick when someone presses SHOW STOP. Plays only with ANNOUNCEMENTS on. GHOST LINK is not a fire alarm: the venue\'s alarm and PA come first.'));

    // ---- DOOR COUNT ----
    const D = S.door;
    parts.push(el('h4', null, 'DOOR COUNT'));
    const dl = el('div', 'sfc-line');
    dl.append(sw(D.on, 'DOOR COUNT', () => send('/api/door/settings', { on: !D.on }, D.on ? 'DOOR COUNT off.' : 'DOOR COUNT on: open the door page on the door phone.')));
    const cap = el('input'); cap.type = 'number'; cap.min = 0; cap.max = 99999; cap.value = D.cap || ''; cap.placeholder = 'CAPACITY'; cap.inputMode = 'numeric';
    cap.setAttribute('aria-label', 'Capacity');
    cap.addEventListener('change', () => send('/api/door/settings', { cap: Number(cap.value) || 0 }, 'Capacity saved.'));
    dl.append(cap);
    const a = el('a', 'btn mini', 'OPEN THE DOOR PAGE'); a.href = 'door.html';
    dl.append(a);
    parts.push(dl);
    parts.push(el('div', 'note', D.from === 'hardstop' ? 'HARD STOP is counting tonight: ' + Safety.doorText(D) + '.'
      : 'The door phone taps + / − (crew code). The TV and stage clock show IN 412 / 450: yellow at 90 %, red when full.'));
    body.replaceChildren(...parts);
  }
  const fold = $('go-night-safety');
  if (fold) fold.addEventListener('toggle', () => { if (fold.open) load(); });
  setTimeout(load, 1500);
  // reload after an unlock (the lock's own form): cheap, once
  document.getElementById('unlockForm') && document.getElementById('unlockForm').addEventListener('submit', () => setTimeout(load, 800));
})();
