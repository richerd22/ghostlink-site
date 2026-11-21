'use strict';
// First-open tour: four short cards, once per phone. SKIP or DONE and it never shows again (HELP -> SHOW THE TOUR
// brings it back). Not shown on view-only watch links, crowd/role links, or when ?notour is in the address.
const Tour = (() => {
  const STEPS = [
    { view: 'decks', title: 'EVERY DECK, LIVE', text: 'Track, key, BPM, time left and the waveform on every player. Red = on air. LAYOUT (top right) makes it yours: giant waveforms, all waveforms stacked, decks side by side.' },
    { view: 'now', title: 'NOW', text: "What the room is hearing. Pick your job at the top (DJ, photo, lights, manager) and it shows what you need: next drop, set times, what's up next." },
    { view: 'played', title: 'PLAYED', text: 'Every track tonight with the time and who played it. Set the DJ here. COPY SETLIST when the night is done.' },
    { view: 'status', title: 'STATUS', text: "If anything's wrong, it says what and how to fix it, in plain words. Settings are behind the password, so nobody changes things by accident." },
  ];
  let i = 0;
  const box = $('tour');
  function show() {
    const s = STEPS[i];
    location.hash = s.view;
    $('tourStep').textContent = (i + 1) + ' / ' + STEPS.length;
    $('tourTitle').textContent = s.title;
    $('tourText').textContent = s.text;
    $('tourNext').textContent = i === STEPS.length - 1 ? 'DONE' : 'NEXT';
    $('tourDemo').hidden = i !== STEPS.length - 1;
    box.hidden = false;
  }
  function done() {
    box.hidden = true;
    try { localStorage.setItem('toured', '1'); } catch (e) {}
    location.hash = 'decks';
  }
  function start() { i = 0; show(); }
  $('tourNext').addEventListener('click', () => { if (++i >= STEPS.length) done(); else show(); });
  $('tourSkip').addEventListener('click', done);
  $('tourDemo').addEventListener('click', () => { done(); Demo.start(); });
  document.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', start));
  const q = new URLSearchParams(location.search);
  let seen = true;
  try { seen = localStorage.getItem('toured') === '1'; } catch (e) { /* no storage: don't nag */ }
  const viewOnly = document.body.classList.contains('remote') || location.hostname.endsWith('trycloudflare.com');
  if (!seen && !viewOnly && !q.has('notour') && !q.has('embed') && !q.has('role') && !q.has('layout') && !location.hash) setTimeout(start, 600);
  return { start };
})();
