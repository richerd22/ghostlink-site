'use strict';
// SEND A CREW CALL (#82): the dashboard makes its own crew calls (LIGHTS ON in 2, THE DROP, LAST CALL, a photo
// count-in), as the phone's role (NOW -> DJ / LIGHTS / PHOTO / MANAGER ...; DJ calls as BOOTH). Needs the crew code or
// the owner password. The box gives each one an id starting "gl-"; the HARD STOP app reads them from
// /api/hardstop/live `crew` and can pass them to its panels. Live calls can be cancelled here. Owner: THE DROP by itself.
// Lives in NOW (#crewSend); uses app.js globals (role, ROLES, unlocked, post, needUnlock, pending, S). Text nodes only.
const CrewSend = (() => {
  const PICKS = [
    { txt: 'THE DROP', in: 16, mo: true },
    { txt: 'LIGHTS ON', in: 120, mo: false },
    { txt: 'LAST CALL', in: 60, mo: false },
    { txt: 'PHOTO COUNT-IN', in: 10, mo: true },
  ];
  const TIMES = [[0, 'NOW'], [10, '10s'], [30, '30s'], [60, '1m'], [120, '2m'], [300, '5m']];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const who = () => { const r = typeof role === 'string' ? role : 'dj'; return r === 'dj' ? 'BOOTH' : ((ROLES[r] && ROLES[r].label) || 'CREW'); };
  const box = document.getElementById('crewSend');
  if (!box) return {};

  const wrap = el('details', 'crew-send');
  const sum = el('summary', null, 'SEND A CREW CALL');
  const as = el('div', 'cs-as');
  const picks = el('div', 'cs-picks');
  const txt = el('input', 'cs-txt'); txt.maxLength = 60; txt.placeholder = 'What to call (LIGHTS ON, RELEASING CO2 ...)';
  txt.setAttribute('aria-label', 'Crew call'); txt.autocomplete = 'off';
  const times = el('div', 'cs-times');
  const secs = el('input', 'cs-secs'); secs.type = 'number'; secs.min = '0'; secs.max = '3600'; secs.value = '30';
  secs.setAttribute('aria-label', 'Seconds to GO'); secs.inputMode = 'numeric';
  const ci = el('label', 'cs-check'); const ciBox = el('input'); ciBox.type = 'checkbox'; ci.append(ciBox, document.createTextNode(' COUNT-IN (the TV counts the last 10 s full screen)'));
  const send = el('button', 'cs-go', 'SEND'); send.type = 'button'; send.id = 'crewSendBtn';
  const note = el('div', 'note cs-note');
  const liveH = el('small', 'cs-liveh', 'LIVE CALLS'); const live = el('div', 'cs-live');
  const auto = el('label', 'cs-check cs-auto'); const autoBox = el('input'); autoBox.type = 'checkbox';
  auto.append(autoBox, document.createTextNode(' THE DROP BY ITSELF: 4 bars before the on-air deck\'s drop (owner; needs phrase-analysed tracks)'));

  PICKS.forEach(p => {
    const b = el('button', 'mini', p.txt); b.type = 'button';
    b.addEventListener('click', () => { txt.value = p.txt; secs.value = p.in; ciBox.checked = p.mo; mark(); });
    picks.append(b);
  });
  TIMES.forEach(([s, l]) => {
    const b = el('button', 'mini', l); b.type = 'button'; b.dataset.s = s;
    b.addEventListener('click', () => { secs.value = s; mark(); });
    times.append(b);
  });
  times.append(secs, el('span', 'cs-unit', 's'));
  secs.addEventListener('input', mark);
  function mark() { times.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === String(secs.value))); }
  mark();

  wrap.append(sum, as, picks, txt, times, ci, send, note, liveH, live, auto);
  box.append(wrap);

  function say(t, warn) { note.textContent = t; note.classList.toggle('warn', !!warn); }
  send.addEventListener('click', async () => {
    const t = txt.value.trim(), s = Number(secs.value);
    if (!t) { say('Type what to call, or tap one above.', true); return; }
    if (!(s >= 0 && s <= 3600)) { say('Seconds to GO: 0 to 3600.', true); return; }
    if (!unlocked) { pending = send; return needUnlock(); }
    const r = await post('/api/crew/call', { txt: t, in: s, mo: ciBox.checked, from: who() });
    if (r.ok) { say('Sent: ' + t + (s ? ' in ' + s + ' s' : ' NOW') + '.'); txt.value = ''; }
    else if (r.status !== 401) { let e = 'Not sent.'; try { e = (await r.json()).error || e; } catch (x) {} say(e, true); }
  });

  let liveKey = '';
  function renderLive() {
    as.textContent = 'AS ' + who() + ' · change it with the role buttons above';
    const calls = (S.crew || (S.status && S.status.crew) || []).filter(c => !c.go);
    const k = calls.map(c => c.id).join('|') + unlocked;
    liveH.hidden = !calls.length;
    if (k === liveKey) return;
    liveKey = k;
    live.replaceChildren(...calls.map(c => {
      const row = el('div', 'cs-row');
      row.append(el('span', 'who', c.from || 'CREW'), el('b', null, c.txt));
      const x = el('button', 'mini', 'CANCEL'); x.type = 'button';
      x.addEventListener('click', async () => {
        if (!unlocked) { pending = x; return needUnlock(); }
        const r = await post('/api/crew/cancel', { id: c.id });
        say(r.ok ? 'Cancelled: ' + c.txt + '.' : r.status === 404 ? 'That call already went.' : 'Couldn\'t cancel.', !r.ok);
      });
      row.append(x);
      return row;
    }));
  }
  setInterval(() => { if (!document.hidden && wrap.open) renderLive(); }, 1000);
  wrap.addEventListener('toggle', () => { if (wrap.open) { renderLive(); loadAuto(); } });

  async function loadAuto() {
    try { autoBox.checked = !!(await (await fetch('/api/crew/settings', { cache: 'no-store' })).json()).autoDrop; } catch (e) {}
  }
  autoBox.addEventListener('change', async () => {
    const want = autoBox.checked;
    if (!unlocked) { autoBox.checked = !want; pending = null; return needUnlock(); }
    const r = await post('/api/crew/settings', { autoDrop: want });
    if (r.status === 403) { autoBox.checked = !want; say('THE DROP BY ITSELF needs the owner\'s password, not the crew code.', true); return; }
    if (r.ok) say(want ? 'THE DROP BY ITSELF is on: a count-in call 4 bars before each drop.' : 'THE DROP BY ITSELF is off.');
  });
  return { renderLive };
})();
