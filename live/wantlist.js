'use strict';
// WANTLIST (DECISIONS #92). Richard, Nov 20: "All the time I hear ids in these sets I'm like yooo I need this ... Quick
// button ... to add to a Wantlist ... grabs all da info for ya to make looking for it super ez. Ofc has to be optional
// ... some ppl are weird with their usbs and territorial".
// - Off until the owner turns it on (STATUS -> TONIGHT -> WANTLIST, or the ⚙ on NOW / DECKS). The only thing on the box
//   is that switch (/api/wantlist).
// - While on: + WANT on NOW, on each deck tile, and on the DECKS bar in STACKED / WAVES (the deck that's out loud).
//   One tap saves artist, the full title (remix and all), label, key, BPM, genre, when, where, who was on.
// - The list lives in this phone's browser only (localStorage). Nothing is sent to the box or the DJ.
// - PLAYED -> WANTLIST: COPY, SHARE, and per track search links (Beatport, Bandcamp, Discogs, YouTube, SoundCloud):
//   each opens that site's own search page with the words filled in, in a new tab. No accounts, nothing fetched here.
// Network text (titles, names) only ever goes into the page as text.
const Wantlist = (() => {
  const KEY = 'wantlist', MAX = 500;
  const load = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  let list = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) { /* private window: this visit only */ } };
  const on = () => !!(S.status && S.status.wantlist);
  const idOf = (artist, title) => (String(artist || '') + '|' + String(title || '')).toLowerCase().replace(/\s+/g, ' ').trim();
  const has = d => !!d && list.some(w => w.id === idOf(d.artist, d.title));

  function add(d) {
    if (!d || d.load !== 'LOADED' || !d.title) return false;
    const id = idOf(d.artist, d.title);
    if (list.some(w => w.id === id)) return true;
    const i = d.info || {}, s = S.status || {};
    let dj = s.dj || '';
    try { const n = typeof onNow === 'function' ? onNow() : null; if (n && n.dj) dj = n.dj; } catch (e) { /* no plan */ }
    list.unshift({
      id, artist: d.artist || '', title: d.title || '', label: i.label || '', key: i.key || '',
      camelot: (typeof camelot === 'function' && i.key && camelot(i.key) !== i.key) ? camelot(i.key) : '',
      bpm: d.trackBpm ? Math.round(d.trackBpm * 10) / 10 : 0, genre: i.genre || '', album: i.album || '', year: i.year || 0,
      at: Date.now() - (S.skew || 0), venue: (s.venue && s.venue.name) || '', dj, night: s.night || '', deck: d.player,
    });
    save();
    render();
    return true;
  }
  function remove(id) { list = list.filter(w => w.id !== id); save(); render(); }

  // ---------- search links: the site's own search page, the words in the address ----------
  const SITES = [
    ['BEATPORT', 'https://www.beatport.com/search?q='],
    ['BANDCAMP', 'https://bandcamp.com/search?q='],
    ['DISCOGS', 'https://www.discogs.com/search/?type=all&q='],
    ['YOUTUBE', 'https://www.youtube.com/results?search_query='],
    ['SOUNDCLOUD', 'https://soundcloud.com/search?q='],
  ];
  // "(Original Mix)" only gets in the way of a search; a named remix stays.
  const words = w => (w.artist + ' ' + w.title).replace(/\((original|extended|radio)( mix| edit)?\)/ig, '').replace(/\s+/g, ' ').trim();
  const when = w => { const t = new Date(w.at + (S.skew || 0)); return t.toTimeString().slice(0, 5) + ', ' + t.toDateString().slice(4, 10); };
  const facts = w => [w.label, w.key && (w.key + (w.camelot ? ' · ' + w.camelot : '')), w.bpm ? w.bpm + ' BPM' : '', w.genre].filter(Boolean).join(' · ');
  const heard = w => ['heard ' + when(w), w.dj, w.venue].filter(Boolean).join(' · ');
  function text() {
    return ['WANTLIST · ' + list.length + (list.length === 1 ? ' track' : ' tracks'), '',
      ...list.map(w => (w.artist ? w.artist + ' - ' : '') + w.title + (facts(w) ? '\n  ' + facts(w) : '') + '\n  ' + heard(w))].join('\n');
  }

  // ---------- PLAYED -> WANTLIST ----------
  const box = $('go-wantlist');
  function render() {
    if (!box) return;
    box.hidden = !on() && !list.length; // it's this phone's list: still there after the owner turns the buttons off
    $('wantN').textContent = list.length ? '(' + list.length + ')' : '';
    const ol = $('wantList');
    ol.textContent = '';
    if (!list.length) {
      const li = document.createElement('li'); li.className = 'none';
      li.textContent = 'Nothing yet. Tap + WANT on NOW or DECKS while a track plays.';
      ol.appendChild(li);
    }
    list.forEach(w => {
      const li = document.createElement('li');
      const t = document.createElement('b'); t.textContent = w.title; li.appendChild(t);
      const a = document.createElement('span'); a.className = 'w-artist'; a.textContent = w.artist; li.appendChild(a);
      const f = document.createElement('small'); f.textContent = [facts(w), heard(w)].filter(Boolean).join(' · '); li.appendChild(f);
      const links = document.createElement('div'); links.className = 'w-links';
      SITES.forEach(([name, base]) => {
        const l = document.createElement('a');
        l.href = base + encodeURIComponent(words(w)); l.target = '_blank'; l.rel = 'noopener noreferrer'; l.textContent = name;
        links.appendChild(l);
      });
      const x = document.createElement('button'); x.type = 'button'; x.className = 'mini'; x.textContent = 'REMOVE';
      x.addEventListener('click', () => remove(w.id));
      links.appendChild(x);
      li.appendChild(links);
      ol.appendChild(li);
    });
    $('wantCopy').disabled = $('wantShare').disabled = $('wantClear').disabled = !list.length;
  }
  async function copy(btn) {
    const t = text();
    try { await navigator.clipboard.writeText(t); }
    catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
    btn.textContent = 'COPIED'; setTimeout(() => { btn.textContent = 'COPY'; }, 1500);
  }
  if (box) {
    $('wantCopy').addEventListener('click', e => copy(e.currentTarget));
    $('wantShare').addEventListener('click', async e => {
      if (navigator.share) { try { await navigator.share({ title: 'WANTLIST', text: text() }); return; } catch (x) { if (x && x.name === 'AbortError') return; } }
      copy($('wantCopy'));
    });
    $('wantShare').hidden = !navigator.share;
    $('wantClear').addEventListener('click', () => { if (confirm('Clear your WANTLIST on this phone?')) { list = []; save(); render(); } });
  }

  // ---------- the owner switch (STATUS -> TONIGHT -> WANTLIST; the ⚙ panels mirror it) ----------
  const sw = $('wantSwitch');
  if (sw) sw.addEventListener('click', async () => {
    const want = !on();
    let r;
    try { r = await post('/api/wantlist', { on: want }); } catch (e) { note('wantNote', "Couldn't reach the box.", true); return; }
    if (r.status === 401) { pending = sw; return; } // post() opened the lock: it runs once the password is in
    if (r.status === 403) { note('wantNote', "That needs the owner's password, not tonight's crew code.", true); return; }
    if (!r.ok) { note('wantNote', "Didn't change (" + r.status + ').', true); return; }
    try { const j = await r.json(); if (S.status) S.status.wantlist = !!j.on; } catch (e) {}
    note('wantNote', want ? 'On: every phone gets + WANT on NOW and DECKS. Lists stay on each phone.' : 'Off. Lists already saved stay on their phones.');
    tick();
  });

  // ---------- the buttons ----------
  function label(b, d) {
    const saved = has(d);
    const t = saved ? '✓ WANTED' : '+ WANT';
    if (b.textContent !== t) b.textContent = t;
    b.classList.toggle('on', saved);
    b.disabled = !d || d.load !== 'LOADED' || !d.title;
  }
  function tap(b, d) {
    if (!add(d)) return;
    label(b, d);
    b.classList.remove('go-flash'); void b.offsetWidth; b.classList.add('go-flash');
  }
  const nowBtn = $('wantNow');
  if (nowBtn) nowBtn.addEventListener('click', () => tap(nowBtn, focusDeck()));
  // DECKS bar (STACKED / WAVES ONLY: one button for the deck that's out loud). Its own element, added to the bar.
  const barBtn = document.createElement('button');
  barBtn.type = 'button'; barBtn.className = 'want-btn'; barBtn.id = 'wantDeck'; barBtn.hidden = true; barBtn.textContent = '+ WANT';
  barBtn.title = 'Save the track out loud to your WANTLIST (on this phone)';
  barBtn.addEventListener('click', () => tap(barBtn, focusDeck()));
  const bar = document.querySelector('#decks .deckbar');
  if (bar) bar.insertBefore(barBtn, bar.firstChild);
  // Deck tiles: a small + WANT in each tile's top row (added after app.js builds the tile).
  $('deckgrid').addEventListener('click', e => {
    const b = e.target.closest('.want-tile');
    if (!b) return;
    const t = b.closest('[data-player]');
    if (t) tap(b, S.decks[+t.dataset.player]);
  });
  function tiles_() {
    const show = on() && typeof DV !== 'undefined' && DV.mode === 'tiles';
    Object.entries(tiles).forEach(([p, t]) => {
      const top = t.root.querySelector('.top');
      let b = top && top.querySelector('.want-tile');
      const full = !t.root.classList.contains('empty');
      if (!show || !full) { if (b) b.remove(); return; }
      if (!b && top) { b = document.createElement('button'); b.type = 'button'; b.className = 'want-btn want-tile'; top.appendChild(b); }
      if (b) label(b, S.decks[p]);
    });
  }
  function tick() {
    const o = on(), d = focusDeck();
    if (nowBtn) { nowBtn.hidden = !o || !d; if (!nowBtn.hidden) label(nowBtn, d); }
    barBtn.hidden = !o || !d || (typeof DV !== 'undefined' && DV.mode === 'tiles');
    if (!barBtn.hidden) label(barBtn, d);
    if (sw) {
      const t = 'WANTLIST BUTTONS: ' + (o ? 'ON' : 'OFF');
      if (sw.textContent !== t) sw.textContent = t;
      sw.classList.toggle('on', o);
    }
    try { tiles_(); } catch (e) { /* tiles not built yet */ }
    if (box && box.hidden !== (!o && !list.length)) render();
  }
  addEventListener('storage', e => { if (e.key === KEY) { list = load(); render(); } }); // another tab on this phone
  render();
  tick();
  setInterval(() => { try { tick(); } catch (e) { /* never stops the page */ } }, 700);
  return { add, get list() { return list.slice(); }, text, on };
})();
