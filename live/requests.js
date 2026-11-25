'use strict';
// #122 ASK THE DJ, the DJ's side. Own file; uses app.js globals (S, post, unlocked, needUnlock).
// Text nodes only: every title, artist, name and note came from a guest's phone.
//
// - One small badge in the header, "ASKS 3", only while requests are open tonight. Never a pop-up, never a sound:
//   the list opens only when the badge is tapped.
// - REQUESTS: sorted by votes, each with PLAYING IT / MAYBE LATER / NOPE (tap the lit one again = back to open).
//   NOPE is quiet: the guest sees "THE DJ SAW IT". A played ask is marked by itself. PAUSE REQUESTS, CLEAR.
// - STATUS -> ASK THE DJ: the switch for tonight, the options, the guest page's QR, the phone-data link.
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const rq = () => (typeof S !== 'undefined' && S.status && S.status.requests) || null;
  const hhmm = ms => new Date(ms - ((typeof S !== 'undefined' && S.skew) || 0)).toTimeString().slice(0, 5);

  // ---------- the badge ----------
  const badge = el('button', 'rq-badge');
  badge.type = 'button';
  badge.id = 'rqBadge';
  badge.hidden = true;
  badge.title = 'ASK THE DJ: the crowd\'s requests';
  // One badge, in one place: beside LAYOUT on DECKS (the corner window's tab row scrolls; the deck bar always shows),
  // else the last thing on the tab row.
  const nav = document.querySelector('header nav'), layoutBtn = $('layoutBtn');
  function place() {
    const decks = typeof curView === 'function' ? curView() === 'decks' : location.hash.startsWith('#decks');
    const home = decks && layoutBtn ? layoutBtn.parentNode : nav;
    if (!home) return;
    if (decks && layoutBtn) { if (badge.nextSibling !== layoutBtn) home.insertBefore(badge, layoutBtn); }
    else if (badge.parentNode !== home) home.append(badge);
    badge.classList.toggle('in-bar', !!(decks && layoutBtn));
  }
  place();
  window.addEventListener('hashchange', place);
  badge.addEventListener('click', () => open(!panel.hidden ? false : true));

  // ---------- the list ----------
  const panel = el('div', 'rq-panel');
  panel.id = 'rqPanel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Requests');
  const top = el('div', 'rq-top');
  const title = el('b', null, 'REQUESTS');
  const pauseB = btn('PAUSE REQUESTS', 'mini', () => act('/api/requests/pause', { paused: !(rq() && rq().paused) }));
  let clearArmed = 0;
  const clearB = btn('CLEAR', 'mini', () => {
    if (Date.now() - clearArmed > 4000) { clearArmed = Date.now(); clearB.textContent = 'TAP AGAIN TO CLEAR'; setTimeout(() => { clearB.textContent = 'CLEAR'; }, 4000); return; }
    clearArmed = 0; clearB.textContent = 'CLEAR';
    act('/api/requests/clear', {});
  });
  const closeB = btn('CLOSE', 'mini', () => open(false));
  top.append(title, el('span', 'sp'), pauseB, clearB, closeB);
  const say = el('div', 'rq-say');
  const list = el('div', 'rq-list');
  panel.append(top, say, list);
  document.body.append(panel);

  let data = null, seen = -1, busy = false;
  function open(on) {
    panel.hidden = !on;
    badge.classList.toggle('on', on);
    if (on) { seen = -1; tick(); }
  }

  async function load() {
    try {
      const r = await fetch('/api/requests/all', { cache: 'no-store' });
      if (r.status === 401 || r.status === 403) { data = null; say.textContent = 'The list needs the password or tonight\'s crew code (STATUS, the lock).'; list.replaceChildren(); return; }
      if (r.ok) { data = await r.json(); say.textContent = ''; }
    } catch (e) { /* keep what's shown */ }
    draw();
  }

  async function act(path, body) {
    if (busy) return;
    busy = true;
    try {
      const r = await post(path, body);
      if (r.ok) { data = await r.json(); draw(); }
    } catch (e) { /* the next status brings it back */ }
    busy = false;
  }

  const WORD = { PLAYING: 'PLAYING IT', LATER: 'MAYBE LATER', NOPE: 'NOPE' };
  function draw() {
    const s = rq();
    pauseB.textContent = s && s.paused ? 'OPEN REQUESTS AGAIN' : 'PAUSE REQUESTS';
    pauseB.classList.toggle('on', !!(s && s.paused));
    if (!data) return;
    const asks = data.asks || [];
    const open = asks.filter(a => a.state === 'OPEN').length;
    title.textContent = 'REQUESTS · ' + open + ' OPEN' + (s && s.paused ? ' · PAUSED' : '');
    if (!asks.length) { list.replaceChildren(el('div', 'rq-empty', s && s.on ? 'No asks yet. The guest page and its QR are in STATUS -> ASK THE DJ.' : 'ASK THE DJ is off tonight (STATUS -> ASK THE DJ).')); return; }
    list.replaceChildren(...asks.map(a => {
      const d = el('div', 'rq-row st-' + a.state.toLowerCase());
      d.append(el('span', 'v', String(a.votes)));
      const t = el('div', 'tx');
      t.append(el('b', null, a.title));
      if (a.artist) t.append(el('span', 'ar', a.artist));
      const who = [a.name, a.note].filter(Boolean).join(' · ');
      if (who) t.append(el('span', 'who', who));
      d.append(t);
      const b = el('div', 'acts');
      if (a.state === 'PLAYED') b.append(el('span', 'done', 'PLAYED ' + (a.playedAt ? hhmm(a.playedAt) : '')));
      else ['PLAYING', 'LATER', 'NOPE'].forEach(k => {
        const x = btn(WORD[k], 'mini' + (a.state === k ? ' on' : ''), () => act('/api/requests/answer', { id: a.id, state: a.state === k ? 'OPEN' : k }));
        b.append(x);
      });
      d.append(b);
      return d;
    }));
  }

  function tick() {
    const s = rq();
    const on = !!(s && s.on);
    const n = s ? s.open : 0;
    const txt = !on ? '' : s.paused ? 'ASKS ' + n + ' · PAUSED' : 'ASKS ' + n;
    if (badge.textContent !== txt) badge.textContent = txt;
    badge.hidden = !on && panel.hidden;
    badge.classList.toggle('some', on && n > 0);
    if (!panel.hidden && s && s.changed !== seen) { seen = s.changed; load(); }
    else if (!panel.hidden) draw();
    settings();
  }
  setInterval(tick, 1000);

  // ---------- STATUS -> ASK THE DJ ----------
  const box = $('rqSettings');
  let where = null, whereAt = 0, settingsKey = '';
  async function loadWhere() {
    whereAt = Date.now();
    try { const r = await fetch('/api/requests/where', { cache: 'no-store' }); where = r.ok ? await r.json() : null; } catch (e) { where = null; }
    settingsKey = '';
  }
  async function setting(k, v) {
    if (typeof unlocked !== 'undefined' && !unlocked) return needUnlock();
    const r = await post('/api/requests/settings', { [k]: v });
    if (r.status === 403) note('That needs the owner\'s password, not tonight\'s crew code.');
    settingsKey = '';
  }
  let noteText = '';
  function note(t) { noteText = t; settingsKey = ''; }
  function settings() {
    if (!box) return;
    const s = rq();
    if (!s) return;
    if (s.on && (!where || Date.now() - whereAt > 30000)) { if (Date.now() - whereAt > 5000) loadWhere(); }
    const k = JSON.stringify([s.on, s.paused, s.library, s.clean, s.tv, s.tvLine, where, noteText, typeof unlocked !== 'undefined' && unlocked]);
    if (k === settingsKey) return;
    settingsKey = k;
    const rows = [];
    const sw = el('div', 'buttons');
    sw.append(btn(s.on ? 'TURN OFF' : 'TURN ON FOR TONIGHT', s.on ? 'on' : '', () => setting('on', !s.on)));
    const a = el('a', 'btn', 'OPEN THE GUEST PAGE'); a.href = 'ask.html'; a.target = '_blank';
    sw.append(a);
    if (s.on) sw.append(btn('SEE THE LIST', '', () => { open(true); window.scrollTo(0, 0); }));
    rows.push(sw);
    rows.push(el('div', 'note', 'Song requests from the crowd\'s phones: a song, an artist, votes. No money, no sign-up. Off until the owner turns it on; it closes again on the next night. A night preset you saved can turn it on.'));
    const opt = (label, key, val, what) => {
      const d = el('div', 'rq-opt');
      d.append(btn(label + ': ' + (val ? 'ON' : 'OFF'), val ? 'on' : '', () => setting(key, !val)), el('span', 'note', what));
      return d;
    };
    rows.push(opt('SEARCH THE STICKS', 'library', s.library, 'Guests can search the songs on the USB sticks in the players. Read from the copies the box already has: it never asks or tells a player anything.'));
    rows.push(opt('KEEP IT CLEAN', 'clean', s.clean, 'Also refuses songs with swear words in the title. Slurs, links and rude names are always refused.'));
    rows.push(opt('QR ON THE TV', 'tv', s.tv, 'A small ASK THE DJ card with the QR on the TV view while requests are open.'));
    rows.push(opt('"REQUESTS OPEN" ON THE TV', 'tvLine', s.tvLine, 'One quiet line under the plan on the TV.'));
    if (s.on && where) {
      const url = where.anywhere && where.anywhereLive ? where.anywhere : where.lan;
      const img = el('img', 'share-qr'); img.alt = 'QR code for the guest page'; img.src = '/api/qr.svg?text=' + encodeURIComponent(url);
      rows.push(img);
      rows.push(el('div', 'note', url === where.lan
        ? 'This QR works for phones on the venue Wi-Fi or the GHOST LINK Wi-Fi.'
        : 'This QR works on the Wi-Fi and on phone data (through WATCH FROM HOME), until ' + hhmm(where.exp) + '.'));
      const ph = el('div', 'rq-opt');
      if (!where.anywhere) {
        ph.append(btn('ALSO FROM PHONE DATA', '', async () => {
          if (typeof unlocked !== 'undefined' && !unlocked) return needUnlock();
          const r = await post('/api/requests/link', {});
          if (r.ok) { where = await r.json(); settingsKey = ''; } else note('Couldn\'t make the link: ' + glWhy(r.status));
        }), el('span', 'note', 'Most guests are on phone data, not the venue Wi-Fi. This makes one link for tonight that can only ask and vote. It works while WATCH FROM HOME is on (anyone with the link can then also watch the decks, like any WATCH FROM HOME link). Revoke it in SHARE.'));
      } else if (!where.anywhereLive) {
        ph.append(el('span', 'note', 'The phone-data link is made. Turn on WATCH FROM HOME and this QR switches to it.'));
      }
      if (ph.childNodes.length) rows.push(ph);
    }
    // #129: a printed sign with the guest page's QR (sticker.html, the ASK THE DJ card)
    const pr = el('div', 'rq-opt');
    const sa = el('a', 'btn', 'PRINT A SIGN'); sa.href = 'sticker.html?ask=1'; sa.target = '_blank';
    pr.append(sa, el('span', 'note', 'A card for the bar or the booth: the Wi-Fi, then the QR to ASK THE DJ. It works on any night requests are on.'));
    rows.push(pr);
    if (noteText) rows.push(el('div', 'note warn', noteText));
    box.replaceChildren(...rows);
    blockedBox();
  }

  // ---------- #129 BLOCKED WORDS (the owner's): its own block under the switches, so typing isn't redrawn away ----------
  let bl = null, blLoaded = false;
  function blockedBox() {
    if (bl || !box) return;
    bl = el('details', 'rq-blocked local-only');
    const sum = el('summary', null, 'BLOCKED WORDS');
    const ta = el('textarea'); ta.rows = 4; ta.maxLength = 2100; ta.setAttribute('aria-label', 'Blocked words, one per line'); ta.placeholder = 'One per line: a rival\'s name, a word you don\'t want on the screen';
    const save = btn('SAVE', '', async () => {
      if (typeof unlocked !== 'undefined' && !unlocked) return needUnlock();
      const r = await post('/api/requests/settings', { blocked: ta.value.split('\n') });
      const j = await r.json().catch(() => ({}));
      msgEl.textContent = r.ok ? 'Saved. Asks with these words get "can\'t go on the list tonight" (never which word).'
        : r.status === 403 ? 'That needs the owner\'s password, not tonight\'s crew code.' : (j.error || 'Didn\'t save: ' + glWhy(r.status, j));
      msgEl.classList.toggle('warn', !r.ok);
      if (r.ok) load();
    });
    const msgEl = el('div', 'note', 'Refused in the song, the artist, the name and the note, also spelled with spaces or numbers. Only you see this list.');
    const row = el('div', 'buttons'); row.append(save);
    bl.append(sum, ta, row, msgEl);
    async function load() {
      try {
        const r = await fetch('/api/requests/blocked', { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); ta.value = (j.blocked || []).join('\n'); sum.textContent = 'BLOCKED WORDS' + (j.blocked && j.blocked.length ? ' (' + j.blocked.length + ')' : ''); blLoaded = true; }
        else if (r.status === 401 || r.status === 403) msgEl.textContent = 'Unlock with the owner\'s password to see or change the list.';
      } catch (e) { /* offline: try on the next open */ }
    }
    bl.addEventListener('toggle', () => { if (bl.open && !blLoaded) load(); });
    box.after(bl);
  }
})();
