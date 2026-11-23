'use strict';
// WRAP-UP CALLS (DECISIONS #124): three quick buttons at the top of NOW -> SEND A CREW CALL: 5 MIN, 1 MIN, WRAP IT.
// Each is an ordinary crew call "WRAP IT UP" (GO in 5 min / 1 min / now) through POST /api/crew/wrap, so it shows
// everywhere crew calls do (every dashboard's NOW as a big amber / red row, the TV, the STAGE CLOCK's banner, HARD STOP
// panels when the app is there) and CANCEL is the crew call's own. A new one replaces the last. No sound: crew calls
// make none. Needs the crew code or the owner, like any crew call. Own file; uses app.js globals (role, ROLES,
// unlocked, pending, needUnlock, post, S). Text nodes only.
const WrapCalls = (() => {
  const fold = document.querySelector('#crewSend .crew-send');
  if (!fold) return {};
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const who = () => { const r = typeof role === 'string' ? role : 'dj'; return r === 'dj' ? 'BOOTH' : ((ROLES[r] && ROLES[r].label) || 'CREW'); };
  const st = document.createElement('style');
  st.textContent = `
    .wrap-calls { display: grid; gap: 6px; margin: 0 0 12px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
    .wrap-calls small { color: var(--grey); font-size: .75em; letter-spacing: .1em; }
    .wrap-calls .wc-btns { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .wrap-calls .wc-btns button { margin: 0; min-height: 44px; font-weight: 600; letter-spacing: .06em; }
    .wrap-calls .wc-btns button.go { border-color: var(--air); color: var(--air); }
    .wrap-calls .wc-live { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--warn); font-weight: 600; }
    .wrap-calls .wc-live .mini { margin-left: auto; }`;
  document.head.appendChild(st);
  const box = el('div', 'wrap-calls');
  const btns = el('div', 'wc-btns');
  const live = el('div', 'wc-live'); live.hidden = true;
  const liveTxt = el('span');
  const cancel = el('button', 'mini', 'CANCEL'); cancel.type = 'button';
  live.append(liveTxt, cancel);
  const note = el('div', 'note');
  [['10', '10 MIN'], ['5', '5 MIN'], ['1', '1 MIN'], ['now', 'WRAP IT']].forEach(([kind, label]) => {
    const b = el('button', kind === 'now' ? 'go' : null, label); b.type = 'button'; b.dataset.wrap = kind;
    b.addEventListener('click', async () => {
      if (!unlocked) { pending = b; return needUnlock(); }
      const r = await post('/api/crew/wrap', { kind, from: who() });
      if (r.ok) note.textContent = kind === 'now' ? 'Sent: WRAP IT UP, now.' : 'Sent: WRAP IT UP in ' + label.toLowerCase() + '.';
      else if (r.status !== 401) { let e = 'Not sent.'; try { e = (await r.json()).error || e; } catch (x) {} note.textContent = e; }
    });
    btns.append(b);
  });
  box.append(el('small', null, 'WRAP UP · on every screen, the DJ\'s too'), btns, live, note);
  fold.querySelector('summary').after(box);

  let liveId = null;
  cancel.addEventListener('click', async () => {
    if (!liveId) return;
    if (!unlocked) { pending = cancel; return needUnlock(); }
    const r = await post('/api/crew/cancel', { id: liveId });
    note.textContent = r.ok ? 'Cancelled: WRAP IT UP.' : r.status === 404 ? 'That call already went.' : 'Couldn\'t cancel.';
  });
  function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  setInterval(() => {
    if (document.hidden || !fold.open) return;
    const now = Date.now() - (S.skew || 0);
    const w = (S.crew || (S.status && S.status.crew) || []).find(c => c.wrap && now - c.goAt < 30000);
    liveId = w ? w.id : null;
    live.hidden = !w;
    if (w) liveTxt.textContent = w.goAt > now ? 'WRAP IT UP IN ' + fmt(w.goAt - now) : 'WRAP IT UP · NOW';
  }, 500);
  return {};
})();
