'use strict';
/*
 * THREE CASES (DECISIONS #135, the Nov 22 rule): what only works with HARD STOP shows only once HARD STOP has talked
 * to this box (the same "seen" as LIGHTS' HARD STOP STAGES, #119, and the HARD STOP HUB, #130). No greyed rows, no
 * nags. Until then: ANNOUNCEMENTS' HARD STOP part (AUTO CALLS, LET HARD STOP CALL THE PA), DECK CONTROLS' HARD STOP
 * CAN STOP IT and GOODNIGHT's LET HARD STOP SEND GOODNIGHT are out of the way. A switch already ON always shows.
 * Reads GET /api/lights {hardStop} (open on the LAN). No answer = show everything (as before).
 */
(() => {
  const css = document.createElement('style');
  css.textContent = `body.hs-unseen #hsPa, body.hs-unseen #gdHsMay:not(.on), body.hs-unseen .ns-goodnight .cs-check:not(.hs-on) { display: none !important; }`;
  document.head.appendChild(css);
  async function check() {
    let seen = true;
    try {
      const r = await fetch('/api/lights', { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); seen = j.hardStop !== false; }
    } catch (e) { /* show everything */ }
    document.body.classList.toggle('hs-unseen', !seen);
    const gn = document.querySelector('.ns-goodnight .cs-check');
    const box = gn && gn.querySelector('input');
    if (gn) gn.classList.toggle('hs-on', !!(box && box.checked));
  }
  check();
  setInterval(() => { if (!document.hidden) check(); }, 60000);
})();
