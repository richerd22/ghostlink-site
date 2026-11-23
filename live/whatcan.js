'use strict';
/*
 * WHAT CAN IT DO? (DECISIONS #135): one short, skippable list of what GHOST LINK does, grouped by kind of night. Opens
 * only on a tap: HELP -> WHAT CAN IT DO?, or the button on the tour's last card. Never by itself, never on a timer.
 * Each row says where it lives, so the list doubles as a map. The long version: help/how-to/what-kind-of-night.html.
 * Own file; the tour (tour.js) stays the first-run thing it was.
 */
const WhatCan = (() => {
  const GROUPS = [
    ['CLUB NIGHT ON CDJs', 'Every deck live, beside your visuals in a small window (DECKS, LAYOUT). Set times, fits / runs over, crew calls, the stage clock.'],
    ['LAPTOP DJ', 'Plug the sound card in: THE EAR hears the BPM and the drop. LAPTOP NIGHT in STATUS -> SETTINGS.'],
    ['LINEUPS + CHANGEOVERS', 'STATUS -> NIGHTS: plan the DJs; GHOST LINK switches sets by itself. RUNNING LATE, WRAP-UP calls, NEXT UP for the crowd.'],
    ['STREAM', 'STATUS -> SCREENS: the overlay, HIDE IDS, chapters, the MIXCLOUD CHECK while recording.'],
    ['WEDDINGS + PRIVATE NIGHTS', 'ASK THE DJ with your blocked words. MOMENTS in NIGHTS ("21:30 SPEECHES"): the screens say SPEECHES IN 12.'],
    ['OUTDOORS + SAFETY', 'NIGHT SAFETY: SHOW STOP, HOLD, the CURFEW LADDER, DOOR COUNT. WEATHER asks HOLD?, never holds by itself.'],
    ['LIGHTS + VISUALS', 'LIGHTS on the beat, BLACKOUT for anyone at the venue; VISUALS LINK and SHOW CONTROL for Resolume and lighting desks.'],
    ['AT HOME', 'HOME PRACTICE: kept, never a show. RECORD a set, BOO\'S ARCADE.'],
    ['AFTER', 'PLAYED: the tracklist, downloads, the NIGHT REPORT, the END OF NIGHT card.'],
  ];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const css = document.createElement('style');
  css.textContent = `
    .what-can { max-height: min(80vh, 640px); overflow-y: auto; }
    .what-can dl { margin: 6px 0 8px; }
    .what-can dt { font-weight: 600; letter-spacing: .08em; margin-top: 8px; font-size: 13px; }
    .what-can dd { margin: 2px 0 0; color: var(--grey, #9a9a9a); line-height: 1.4; font-size: 13px; }
    .what-can a { color: var(--fg, #fff); }
    body.ln-small .what-can dt, body.ln-small .what-can dd { font-size: 12px; }`;
  document.head.appendChild(css);

  const box = el('div', 'tour what-can'); box.hidden = true;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'What can it do?');
  const dl = el('dl');
  GROUPS.forEach(([k, v]) => dl.append(el('dt', null, k), el('dd', null, v)));
  const more = el('a', null, 'THE LONG VERSION: WHAT KIND OF NIGHT? →');
  more.href = 'https://ghostlink.cold.fyi/help/how-to/what-kind-of-night.html'; more.target = '_blank'; more.rel = 'noopener';
  const close = el('button', null, 'CLOSE'); close.type = 'button';
  const row = el('div', 'row'); row.append(close);
  box.append(el('small', null, 'BY KIND OF NIGHT'), el('b', null, 'WHAT CAN IT DO?'), dl, el('p', null, ''), row);
  box.querySelector('p').append(more);
  document.body.append(box);

  function open() { const t = document.getElementById('tour'); if (t) t.hidden = true; box.hidden = false; box.scrollTop = 0; close.focus({ preventScroll: true }); }
  function shut() { box.hidden = true; }
  close.addEventListener('click', shut);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) shut(); });
  document.querySelectorAll('[data-whatcan]').forEach(b => b.addEventListener('click', open));
  // the tour's last card (beside SEE A DEMO): a way in for whoever wants it; SKIP / DONE still end the tour
  const demo = document.getElementById('tourDemo');
  if (demo) {
    const b = el('button', 'ghostbtn', 'WHAT CAN IT DO?'); b.type = 'button'; b.hidden = true;
    b.addEventListener('click', () => { try { localStorage.setItem('toured', '1'); } catch (e) {} open(); });
    demo.before(b);
    new MutationObserver(() => { b.hidden = demo.hidden; }).observe(demo, { attributes: true, attributeFilter: ['hidden'] });
  }
  return { open, GROUPS };
})();
