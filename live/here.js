'use strict';
// SETTINGS WHERE THEY'RE USED + FIND THE ARCADE (DECISIONS #92).
// Richard, Nov 20: "good having all in one master place. But need to make that a lil less overwhelming ... And have
// access to all of them also like .. where they are needed". And: the arcade is "v buried rn".
// - A small ⚙ on NOW and on DECKS opens the few switches that change that screen. Each one is the same switch as in
//   STATUS / HELP -> DISPLAY (a tap here taps that one), so there's still one master list and nothing can disagree.
// - BOO'S ARCADE: a small door at the bottom of NOW for every role but DJ (never in the DJ's face during a set), a
//   SHOW ITS CODE on the share card (tap GHOST LINK), and GO TO "arcade" opens it straight away.
const Here = (() => {
  const embed = /[?&]embed/.test(location.search);
  const arcadeHref = () => 'arcade.html' + (embed ? '?embed=1' : '');

  // ---------- ⚙ panels ----------
  // [label for a checkbox | null, selector of the master switch]. Buttons are mirrored: same words, same ON state.
  const PANELS = {
    now: [
      ['#help [data-fun]'], ['#themeBtns button'], ['#sizeBtns button'], ['#awake', 'KEEP SCREEN AWAKE'], ['#wantSwitch'],
    ],
    decks: [
      ['#help [data-roam]'], ['#help [data-gsize]'], ['#help [data-fun]'], ['#wantSwitch'],
    ],
  };
  function mirror(src, name) {
    const b = document.createElement('button');
    b.type = 'button';
    const sync = () => {
      const t = name ? name + ': ' + (src.checked ? 'ON' : 'OFF') : src.textContent.replace(/\s+/g, ' ').trim();
      if (b.textContent !== t) b.textContent = t;
      b.classList.toggle('on', name ? src.checked : src.classList.contains('on'));
      // a switch only for the box's own Wi-Fi (the owner's) isn't offered to WATCH FROM HOME either
      b.hidden = !!src.closest('.local-only') && document.body.classList.contains('remote');
    };
    b.addEventListener('click', () => {
      if (name) { src.checked = !src.checked; src.dispatchEvent(new Event('change')); }
      else src.click();
      setTimeout(sync, 50); setTimeout(sync, 600);
    });
    b._sync = sync;
    sync();
    return b;
  }
  function panel(kind, gear) {
    const p = document.createElement('div');
    p.className = 'here-set';
    p.id = 'here-' + kind;
    p.hidden = true;
    const row = document.createElement('div'); row.className = 'buttons';
    PANELS[kind].forEach(([sel, name]) => document.querySelectorAll(sel).forEach(src => {
      if (src.closest('.here-set')) return;
      if (src.id === 'awake' && src.parentElement.hidden) return; // no wake lock on this browser
      row.appendChild(mirror(src, name));
    }));
    p.appendChild(row);
    const more = document.createElement('div'); more.className = 'note';
    const a = document.createElement('a'); a.href = '#status'; a.textContent = 'ALL SETTINGS: STATUS';
    a.addEventListener('click', () => { p.hidden = true; gear.setAttribute('aria-expanded', 'false'); });
    more.appendChild(document.createTextNode('Same switches as in STATUS and HELP → DISPLAY. '));
    more.appendChild(a);
    p.appendChild(more);
    gear.addEventListener('click', () => {
      p.hidden = !p.hidden;
      gear.setAttribute('aria-expanded', String(!p.hidden));
      gear.classList.toggle('on', !p.hidden);
      if (!p.hidden) row.querySelectorAll('button').forEach(b => b._sync());
    });
    setInterval(() => { if (!p.hidden) row.querySelectorAll('button').forEach(b => b._sync()); }, 1000);
    return p;
  }
  function gearBtn(label) {
    const g = document.createElement('button');
    g.type = 'button'; g.className = 'here-gear'; g.textContent = '⚙︎';
    g.setAttribute('aria-label', label); g.title = label; g.setAttribute('aria-expanded', 'false');
    return g;
  }
  // NOW: the bar under the readout (index.html #nowHere holds + WANT and the arcade door)
  const nowBar = $('nowHere');
  if (nowBar) {
    const g = gearBtn('Settings for NOW');
    nowBar.appendChild(g);
    nowBar.after(panel('now', g));
  }
  // DECKS: a ⚙ at the left of the DECKS bar (LAYOUT stays where it is), its panel under the bar
  const bar = document.querySelector('#decks .deckbar');
  if (bar) {
    const g = gearBtn('Settings for DECKS (the ghost, WANTLIST)');
    g.id = 'decksGear';
    bar.insertBefore(g, bar.firstChild);
    bar.after(panel('decks', g));
  }

  // ---------- BOO'S ARCADE ----------
  const door = $('arcadeDoor');
  function doorTick() {
    if (!door) return;
    door.href = arcadeHref();
    door.hidden = role === 'dj'; // the DJ's NOW stays the DJ's
  }
  doorTick();
  setInterval(doorTick, 1000);
  document.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => setTimeout(doorTick)));

  // The share card (tap GHOST LINK): SHOW ITS CODE swaps the code and address for the arcade's, and back.
  const shareBox = document.querySelector('#share .share-box');
  if (shareBox) {
    const row = document.createElement('small');
    row.className = 'share-arcade';
    row.appendChild(document.createTextNode("BOO'S ARCADE · games on the live decks "));
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.id = 'shareArcade'; b.textContent = 'SHOW ITS CODE';
    row.appendChild(b);
    const btns = shareBox.querySelector('.buttons');
    shareBox.insertBefore(row, btns);
    let showing = false;
    const head = shareBox.querySelector('small'), headText = head ? head.textContent : '';
    const urlOf = on => { const base = typeof shareAddress === 'function' ? shareAddress() : location.origin + '/'; return on ? base + 'arcade.html' : base; };
    const show = on => {
      showing = on;
      const url = urlOf(on);
      $('shareAddr').textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      $('shareQr').src = '/api/qr.svg?text=' + encodeURIComponent(url);
      if (head) head.textContent = on ? "BOO'S ARCADE ON THIS NETWORK" : headText;
      b.textContent = on ? 'BACK TO THE DASHBOARD' : 'SHOW ITS CODE';
      $('shareCopy').textContent = 'COPY';
    };
    b.addEventListener('click', () => show(!showing));
    $('shareBtn').addEventListener('click', () => { showing = false; b.textContent = 'SHOW ITS CODE'; if (head) head.textContent = headText; }); // app.js filled it in
    // COPY copies what's showing (app.js's own COPY copies the dashboard's address)
    $('shareCopy').addEventListener('click', async e => {
      if (!showing) return;
      e.stopImmediatePropagation();
      const a = urlOf(true);
      try { await navigator.clipboard.writeText(a); }
      catch (x) { const t = document.createElement('textarea'); t.value = a; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      $('shareCopy').textContent = 'COPIED';
    }, true);
  }

  // GO TO: "arcade" opens it (not just the TOOLS row), plus the WANTLIST.
  if (typeof GOTO !== 'undefined') {
    GOTO.unshift(["BOO'S ARCADE · play now", 'arcade', 'arcade games game boo play wave ride fun']);
    GOTO.push(['WANTLIST · tracks you want (this phone)', 'played/wantlist', 'wantlist want id ids save find search buy beatport bandcamp discogs']);
    GOTO.push(['WANTLIST BUTTONS: ON / OFF (owner)', 'status/wantSwitchBox', 'wantlist want buttons switch owner']);
  }
  const goList = $('goList');
  if (goList) goList.addEventListener('click', e => {
    const a = e.target.closest('a[href="#arcade"]');
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    location.href = arcadeHref();
  }, true);
  addEventListener('hashchange', () => { if (location.hash === '#arcade') location.replace(arcadeHref()); });
  return { arcadeHref };
})();
