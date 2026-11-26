'use strict';
/*
 * THE LINE RULE (DECISIONS #135, docs/wiki/rules.md "Lines that show by themselves"). The ONE place that decides which
 * of the lines that show themselves unasked (banners, offers, warnings) are on screen at once, in what order of
 * importance, and folds the rest into one "+2 MORE" that opens them all.
 *   - The corner window (any window up to 480 px tall, or STACKED WAVES fitted beside the decks): at most 2 lines.
 *   - Anywhere else: at most 4.
 *   - SHOW STOP is never counted or folded: it covers the whole screen and wins over everything.
 *   - A line never folds away a line above it in ORDER; a folded line is one tap away (+N MORE), never gone. The opened
 *     list folds itself again after 30 s (or on LESS).
 *   - Lines nobody wants twice can be put away for the night here (the MIXCLOUD CHECK line: tap = gone tonight).
 * Each feature still draws its own line; this file only shows / folds them (class ln-fold). Pure parts (ORDER, pick,
 * cap) run under Node (src/test/js/lines.test.js). Text nodes only.
 */
const Lines = (() => {
  /** Most important first. [key, CSS selector, what it is]. HARD STOP's TIMELINE moment and every new line go in HERE. */
  const ORDER = [
    ['hold', '.sf-hold', 'HOLD: the show is held (NIGHT SAFETY)'],
    ['alert', '#alert', 'lost connection / a booth warning'],
    ['alerts', '#showAlerts', 'DEAD AIR, a USB pulled, a track ending'],
    ['deaf', '#soundChip.warn', 'RECORDING BUT HEARING NOTHING'],
    ['announce', '#annBar', 'an announcement playing (■ STOP)'],
    ['crew', '#crewCalls', 'CREW CALLS (one bar; +1 / +2 inside it)'],
    ['weather', '.wx-ask', 'WEATHER: HOLD? (safety ask)'],
    ['autostop', '#curfewBar', 'AUTO-STOP armed at MUSIC OFF'],
    ['asks', '#boothAsks', 'BOOTH ASKS from HARD STOP'],
    ['settime', '#setTimeNow, #setTimeDecks', 'SET TIME: fits / runs over / past MUSIC OFF / running late'],
    ['moment', '#momentNow', 'MOMENTS: SPEECHES IN 12'],
    ['venue', '#venueHintLine', "VENUE FROM WI-FI: YOU'RE AT X - SWITCH TONIGHT? (#160, nodecks.js)"],
    ['mixcloud', '#mixcloudNow', 'MIXCLOUD CHECK while recording'],
    ['eon', '#eonReady', 'END OF NIGHT card ready'],
    ['tonight', '#tonightCard', "TONIGHT ISN'T SET UP (NOW; never while music plays; once a night; #162)"],
    ['sound', '#soundSetupLine, #soundChip:not(.warn)', 'SOUND CARD FOUND / IN · SET UP (goes by itself after 60 s)'],
    ['away', '#away', 'WHILE YOU WERE AWAY'],
    ['hsapp', '#hsAppBar', 'USE IN THE HARD STOP APP (phone browser, HARD STOP seen, × = never again on that phone; #162)'],
    ['milestone', '#milestoneLine', 'MILESTONE: 100TH TRACK (owner only, once, never while music plays; #146)'],
    ['demo', '#demoBar', 'DEMO (you started it)'],
  ];
  const SMALL_MAX = 2, MAX = 4;
  /** Lines tapped away for the night on this phone: [key, the element, the words on its title]. */
  const NIGHT_AWAY = [['mixcloud', 'mixcloudNow', 'Tap to hide for tonight']];

  /** How many lines may show: 2 in the corner window, else 4. Pure. */
  function cap(w, h, fitted) { return (h <= 480 || fitted) ? SMALL_MAX : MAX; }

  /**
   * Which of the wanted lines show and which fold. wanted = keys wanting to show (any order); extra = key -> lines
   * inside it beyond its first (two show alerts = 1 extra). Pure.
   * @return {show: [keys], fold: [keys], more: lines behind +N MORE}
   */
  function pick(wanted, max, extra) {
    const rank = k => { const i = ORDER.findIndex(o => o[0] === k); return i < 0 ? ORDER.length : i; };
    const w = [...new Set(wanted)].sort((a, b) => rank(a) - rank(b));
    const show = w.slice(0, max), fold = w.slice(max);
    let more = fold.length;
    // a container that keeps only its first line in a small window: what it hides counts too
    if (extra) show.forEach(k => { more += extra[k] || 0; });
    if (extra) fold.forEach(k => { more += extra[k] || 0; });
    return { show, fold, more };
  }
  const moreText = n => '+' + n + ' MORE';

  if (typeof document === 'undefined') return { ORDER, pick, cap, moreText, SMALL_MAX, MAX, NIGHT_AWAY };

  const css = document.createElement('style');
  css.textContent = `
    .ln-fold { display: none !important; }
    body.ln-small:not(.ln-open) #showAlerts > div:nth-child(n+2), body.ln-small:not(.ln-open) #boothAsks > .booth-ask:nth-child(n+2) { display: none; }
    .ln-more { display: block; margin: 4px 16px 0 auto; font: inherit; font-size: 11px; letter-spacing: .1em; background: none; color: var(--grey, #9a9a9a);
      border: 1px solid var(--line, #333); padding: 2px 10px; min-height: 24px; cursor: pointer; }
    .ln-more[hidden] { display: none !important; }
    body.ln-small .ln-more { margin: 3px 10px 0 auto; padding: 0 8px; min-height: 20px; }
    .deckbar .ln-more { display: inline-block; margin: 0 8px 0 auto; }
    #mixcloudNow { cursor: pointer; }`;
  document.head.appendChild(css);

  const more = document.createElement('button');
  more.type = 'button'; more.className = 'ln-more'; more.id = 'linesMore'; more.hidden = true;
  more.setAttribute('aria-expanded', 'false');
  const anchor = document.getElementById('eonReady') || document.getElementById('boothAsks');
  if (anchor) anchor.insertAdjacentElement('afterend', more);
  let open = false, openAt = 0, lastSig = '';
  const OPEN_MS = 30000; // an opened list folds itself again after 30 s: the corner window goes back to the decks
  more.addEventListener('click', () => { open = !open; openAt = Date.now(); lastSig = ''; tick(); });

  const night = () => (typeof S !== 'undefined' && S.status && S.status.night) || '';
  const awayKey = k => 'ln-away:' + k + ':' + night();
  const isAway = k => { try { return !!night() && localStorage.getItem(awayKey(k)) === '1'; } catch (e) { return false; } };
  NIGHT_AWAY.forEach(([k, id, title]) => {
    const e = document.getElementById(id);
    if (!e) return;
    e.title = title;
    e.addEventListener('click', () => { try { localStorage.setItem(awayKey(k), '1'); } catch (x) {} lastSig = ''; tick(); });
  });

  /** Does this element want to show right now (as its own feature drew it)? Measured with our fold taken off. */
  function wants(e) {
    if (!e || e.hidden || !e.textContent.trim()) return false;
    const r = e.getBoundingClientRect();
    return r.height > 0 || r.width > 0;
  }
  function tick() {
    const els = {};
    ORDER.forEach(([k, sel]) => { els[k] = [...document.querySelectorAll(sel)]; });
    const stop = document.querySelector('.sf-stop');
    const all = Object.values(els).flat();
    all.forEach(e => e.classList.remove('ln-fold')); // measure as the features drew them (no paint in between)
    const away = new Set(NIGHT_AWAY.map(a => a[0]).filter(isAway));
    const wanted = [], extra = {};
    for (const [k] of ORDER) {
      const vis = els[k].filter(wants);
      if (!vis.length) continue;
      if (away.has(k)) continue;
      wanted.push(k);
      if (k === 'alerts' || k === 'asks') { // (crew calls keep their own +1 / +2 inside the bar)
        const n = vis.reduce((a, e) => a + e.querySelectorAll(k === 'alerts' ? ':scope > div' : ':scope > .booth-ask').length, 0);
        if (n > 1) extra[k] = n - 1;
      }
    }
    const fitted = document.body.classList.contains('fit-decks') && document.body.dataset.view === 'decks';
    // beside the decks the button sits in the DECKS bar (no extra row taken from the decks); elsewhere under the lines
    const bar = fitted && document.querySelector('#decks .deckbar'), lb = bar && document.getElementById('layoutBtn');
    if (lb && more.parentElement !== bar) bar.insertBefore(more, lb);
    else if (!lb && anchor && more.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', more);
    const small = cap(innerWidth, innerHeight, fitted) === SMALL_MAX;
    document.body.classList.toggle('ln-small', small);
    const real = pick(wanted, cap(innerWidth, innerHeight, fitted), small ? extra : null);
    if (!real.more || Date.now() - openAt > OPEN_MS) open = false; // nothing folded, or 30 s gone: folded again
    const fold = open ? [] : real.fold.slice();
    if (stop && !stop.hidden) fold.splice(0, fold.length, ...wanted); // SHOW STOP covers it all: nothing else competes
    [...fold, ...away].forEach(k => els[k].forEach(e => e.classList.add('ln-fold')));
    document.body.classList.toggle('ln-open', open);
    const sig = real.show.join() + '|' + fold.join() + '|' + real.more + '|' + open + '|' + small;
    more.hidden = !real.more || (stop && !stop.hidden);
    if (!more.hidden) {
      const t = open ? 'LESS' : moreText(real.more);
      if (more.textContent !== t) more.textContent = t;
      more.setAttribute('aria-expanded', String(open));
      more.title = open ? 'Fold the lower lines again' : 'Folded: ' + real.fold.concat(Object.keys(extra)).map(k => (ORDER.find(o => o[0] === k) || [])[2]).join(' · ');
    }
    if (sig !== lastSig) { lastSig = sig; if (typeof FIT !== 'undefined') FIT.sig = ''; } // the corner window refits round it
  }
  setInterval(() => { try { tick(); } catch (e) { /* never break the dashboard */ } }, 500);
  addEventListener('resize', () => { try { tick(); } catch (e) {} });
  return { ORDER, pick, cap, moreText, tick, SMALL_MAX, MAX, NIGHT_AWAY };
})();
if (typeof module !== 'undefined') module.exports = Lines;
