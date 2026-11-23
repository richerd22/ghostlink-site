'use strict';
// HOLD from the STAGE CLOCK itself (DECISIONS #132), own file, loaded by stage.html after safety.js. Text nodes only.
// The clock stays clean: a tap on the screen shows a small strip for 12 s, "HOLD: WEATHER · LIGHTNING · STAGE FIX ·
// SAFETY" (one tap each) or, while the box's HOLD is up, RESUME. Crew code or owner, as everywhere (#127): a locked
// screen asks for the crew code once (the cookie keeps it), then does what was tapped. Never on the crowd's NEXT UP.
const StageHold = (() => {
  const PRESETS = ['WEATHER', 'LIGHTNING', 'STAGE FIX', 'SAFETY'];
  /** What the strip offers: {mode: 'hold' | 'resume' | 'theirs', buttons: [[label, preset|null]]}. Pure (tested). */
  function strip(hold) {
    if (!hold) return { mode: 'hold', buttons: PRESETS.map(p => [p, p]) };
    if (hold.src === 'box') return { mode: 'resume', buttons: [['RESUME', null]] };
    return { mode: 'theirs', buttons: [] }; // HARD STOP's hold: resumed from HARD STOP
  }
  if (typeof document === 'undefined') return { strip, PRESETS };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const css = document.createElement('style');
  css.textContent = `
    .sh { position: absolute; left: 0; right: 0; margin: 0 auto; width: fit-content; top: 13cqh; z-index: 50; /* top: the DOOR badge and the foot live at the bottom */ display: flex; flex-wrap: wrap; gap: 1.2cqh 1.2cqw;
      align-items: center; justify-content: center; background: #000; border: 2px solid #ffb000; color: #ffb000; padding: 1.4cqh 2cqw;
      font-size: clamp(14px, 3cqh, 40px); letter-spacing: .08em; font-weight: 600; max-width: 92cqw; cursor: auto; }
    .sh[hidden] { display: none !important; }
    .sh button { font: inherit; background: #000; color: #fff; border: 2px solid #fff; padding: .6cqh 1.6cqw; min-height: 44px; cursor: pointer; }
    .sh button.go { border-color: #ffb000; color: #ffb000; }
    .sh input { font: inherit; width: 8ch; background: #000; color: #fff; border: 2px solid #fff; padding: .4cqh 1cqw; min-height: 44px; }
    .sh .msg { flex-basis: 100%; text-align: center; font-size: .7em; color: #fff; font-weight: 400; }
    .sh .msg:empty { display: none; }`;
  document.head.appendChild(css);
  const box = el('div', 'sh'); box.hidden = true; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'HOLD');
  const host = document.getElementById('stage') || document.body;
  host.append(box);
  let hideT = 0, want = null;
  const msg = el('span', 'msg');

  async function send(preset) {
    const path = preset ? '/api/safety/hold' : '/api/safety/resume';
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preset ? { preset, from: 'STAGE CLOCK' } : {}) });
    if (r.status === 401) { want = preset || 'RESUME'; askCode(); return; }
    const j = await r.json().catch(() => ({}));
    if (r.ok) { msg.textContent = preset ? 'HOLD: ' + preset + ' on every screen.' : 'RESUMED.'; setTimeout(close, 2500); }
    else msg.textContent = j.error || 'That didn\'t go through. Try again.';
  }
  function askCode() {
    box.replaceChildren(el('span', null, 'CREW CODE'));
    const inp = el('input'); inp.type = 'password'; inp.inputMode = 'numeric'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Crew code');
    const ok = el('button', 'go', 'OK'); ok.type = 'button';
    const go = async () => {
      const r = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: inp.value }) });
      if (!r.ok) { msg.textContent = 'Not the crew code.'; inp.value = ''; return; }
      const w = want; want = null; msg.textContent = '';
      build(); send(w === 'RESUME' ? null : w);
    };
    ok.addEventListener('click', go);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    box.append(inp, ok, msg);
    keep(30000);
    setTimeout(() => inp.focus(), 50);
  }
  function build() {
    const S = typeof Safety !== 'undefined' ? Safety.now() : null;
    const s = strip(S && S.hold);
    box.replaceChildren();
    if (s.mode === 'theirs') box.append(el('span', null, 'HOLD FROM HARD STOP · RESUME IT THERE'));
    else box.append(el('span', null, s.mode === 'hold' ? 'HOLD:' : 'HOLD: ' + S.hold.why));
    for (const [label, preset] of s.buttons) {
      const b = el('button', preset ? null : 'go', label); b.type = 'button';
      b.addEventListener('click', e => { e.stopPropagation(); send(preset); });
      box.append(b);
    }
    box.append(msg);
  }
  function keep(ms) { clearTimeout(hideT); hideT = setTimeout(close, ms); }
  function close() { box.hidden = true; msg.textContent = ''; want = null; }
  box.addEventListener('click', e => { e.stopPropagation(); keep(want ? 30000 : 12000); });
  document.addEventListener('click', () => {
    if (!box.hidden) return close();
    build(); box.hidden = false; keep(12000);
  });
  return { strip, PRESETS };
})();
if (typeof module !== 'undefined') module.exports = StageHold;
