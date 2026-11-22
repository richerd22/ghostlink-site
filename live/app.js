// GHOST LINK dashboard. No build step, no libraries. Data shapes: docs/API.md.
'use strict';
// "Script error." with no details comes from outside the page (an extension, the browser itself): not ours.
window.addEventListener('error', e => { if (e.error || (e.message && e.message !== 'Script error.')) oops(e.error || e.message); });
window.addEventListener('unhandledrejection', e => oops(e.reason));

const GHOSTS = {
  asleep:       ['  .--.  ', ' / __ \\ ', '|      |', '|      |', ' \\/\\/\\/ '],
  listening:    ['  .--.  ', ' / .. \\ ', '|      |', '|      |', ' \\/\\/\\/ '],
  linked:       ['  .--.  ', ' / oo \\ ', '|      |', '|      |', ' \\/\\/\\/ '],
  'backed-off': ['  .--.  ', ' / .. \\ ', '|      |', '|      |', ' \\/\\/\\/ '],
};

const S = { status: null, devices: [], decks: {}, waves: {}, structs: {}, grids: {}, played: [], events: [], skew: 0 };
const $ = id => document.getElementById(id);

// ---------- connection ----------

let retry = 1000;
let awayAt = null; // when this phone lost the box (box clock), for WHILE YOU WERE AWAY
// #85 speed: one socket at a time (sock), a dead one is noticed in seconds, and a phone in a pocket lets go.
let sock = null, sockAt = 0, retryT = 0, hiddenT = 0;
function connect() {
  clearTimeout(retryT);
  if (sock || document.hidden) return; // never two sockets; a hidden page connects when it shows again
  // Waveforms this phone already holds: the box leaves them out of the hello (30 phones rejoining at once).
  // wf=later: the hello comes without waveforms (a few KB: decks on screen at once), then one message per deck.
  const have = Object.values(S.waves).map(w => w && w.key).filter(Boolean).slice(0, 8).map(encodeURIComponent).join(',');
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?wf=later' + (have ? '&have=' + have : ''));
  sock = ws; sockAt = Date.now();
  ws.onopen = () => {
    retry = 1000;
    setAlert(null);
    ws.send(JSON.stringify({ type: 'clock', data: Date.now() })); // the box may have no internet time
  };
  ws.onmessage = m => { sockAt = Date.now(); handle(JSON.parse(m.data)); };
  ws.onclose = () => lost(ws, true);
}
/** This socket is done (closed, silent, or let go while hidden). Only the current one counts. */
function lost(ws, say) {
  if (ws !== sock) return;
  sock = null;
  ws.onclose = ws.onmessage = ws.onopen = null;
  try { ws.close(); } catch (e) { /* already gone */ }
  if (!awayAt && S.status) awayAt = { box: Date.now() - (S.skew || 0), phone: Date.now() };
  if (say) setAlert(typeof Why !== 'undefined' ? Why.lostAlert() // #93: which kind of lost (phone offline / box restarting / not answering)
    : { title: 'Lost connection to GHOST LINK', fix: 'Reconnecting. Check this phone is on the same Wi-Fi as the box.', sticky: true });
  if (document.hidden) return;
  retryT = setTimeout(connect, retry);
  retry = Math.min(retry * 2, 5000);
}
// The box sends status every second. A Wi-Fi drop often never closes the socket (no goodbye reaches the phone):
// 6 s of silence (8 s to open) = gone, start again now instead of waiting a minute for the browser to notice.
setInterval(() => { if (sock && Date.now() - sockAt > (sock.readyState === 1 ? 6000 : 8000)) lost(sock, true); }, 2000);
// Hidden for 60 s (pocket, other app): let go, so 10+ phones in pockets don't share the venue Wi-Fi with the booth.
// Back on screen: reconnect at once (waveforms already held aren't sent again; WHILE YOU WERE AWAY fills the gap).
document.addEventListener('visibilitychange', () => {
  clearTimeout(hiddenT);
  if (document.hidden) hiddenT = setTimeout(() => { if (sock && document.hidden) lost(sock, false); }, 60000);
  else if (!sock) { retry = 1000; connect(); }
  else if (Date.now() - sockAt > 6000) lost(sock, true);
});
addEventListener('online', () => { if (!sock) { retry = 1000; connect(); } });

function handle({ type, data }) {
  try { testWatch(type, data); } catch (e) { /* the checklist must never break the dashboard */ }
  if (S.demo && /^(deck|waveform|structure|artwork)$/.test(type) && Demo.takes(type, data)) return; // DEMO is covering this player
  switch (type) {
    case 'hello':
      setStatus(data.status);
      try { whileAway(data); } catch (e) { /* never block the reconnect */ }
      S.devices = data.devices;
      S.decks = {};
      data.decks.forEach(d => setDeck(d));
      { // keep the waveforms the box says we still have (kept: {player: trackKey}); everything else comes fresh
        const kept = data.kept || {}, old = S.waves;
        S.waves = {};
        // by key on ANY deck: the same track can be on another deck now (an instant double, a reload)
        Object.entries(kept).forEach(([p, k]) => { const src = Object.values(old).find(w => w && w.key === k); if (src) S.waves[p] = src; });
      }
      Object.entries(data.waveforms || {}).forEach(([p, w]) => setWave(+p, w));
      S.structs = {};
      S.grids = data.grids || {}; // #84 beat grids
      Object.entries(data.structures || {}).forEach(([p, st]) => { S.structs[p] = st; });
      S.played = data.played;
      S.events = data.events;
      renderAll();
      break;
    case 'crew': S.crew = data; break;
    case 'bye': if (typeof Why !== 'undefined') Why.bye(); break; // #93: the box is restarting on purpose
    case 'status': S.crew = data.crew; setStatus(data); renderStatus(); renderHeader(); renderNetwork(); renderAlerts(); renderDecks(); $('djNow').textContent = data.dj || 'not set'; renderPlanNow(); renderSongId(); renderGhostDeck(); break;
    case 'devices': S.devices = data; renderNetwork(); renderDecks(); renderVenue(); break;
    case 'deck': setDeck(data); renderDeck(data.player); renderGhostDeck(); break;
    case 'waveform': setWave(data.player, data.waveform); break;
    case 'beat': onBeat(data.p, data.b); break;
    case 'audio': S.audioLv = data; if (typeof Sound !== 'undefined') Sound.levels(data); break;
    case 'structure': S.structs[data.player] = data.structure; nowShape = null; break;
    case 'grid': S.grids[data.player] = data.grid; break; // #84: beat lines on the waveforms
    case 'artwork': renderDeck(data.player); break;
    case 'played': S.played.push(data); renderPlayed(); break;
    case 'night': S.played = data.played; renderPlayed(); break;
    case 'event': S.events.push(data); if (S.events.length > 500) S.events.shift(); renderEvents(); if (data.kind === 'ghostdeck' || data.kind === 'autostop') renderGhostDeck(); break;
  }
}

let lastAlertKinds = '';
function renderAlerts() {
  const al = (S.status && S.status.alerts) || [];
  const kinds = al.map(a => a.kind).join();
  if (kinds !== lastAlertKinds && al.some(a => a.kind === 'dead-air' || a.kind === 'media') && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  lastAlertKinds = kinds;
  setHTML($('showAlerts'), al.map(a => `<div class="${esc(a.kind)}"><b>${esc(a.title)}</b>${esc(a.detail)}</div>`).join(''));
}

function setStatus(s) {
  const nightChanged = !S.status || S.status.night !== s.night;
  S.status = s;
  if (nightChanged && !$('played').hidden) loadNights();
  S.skew = Date.now() - s.time; // the box's clock can be wrong when it has no internet
}

function setDeck(d) {
  glide(S.decks[d.player], d); // animate from when we got it, not the box's clock, and never snap on small drift
  S.decks[d.player] = d;
}
/**
 * Smooth playhead (a club video IMG_3819: "it lags and jumps around"). Every update used to snap the playhead to the
 * box's number, so uneven Wi-Fi made it jump back and forth. Now the phone keeps its own steady clock and folds each
 * update in gently: the difference is eased in over at least 0.6 s, slowly enough that time never runs backwards.
 * Real jumps (cue, loop, seek, new track, play/stop, over 1.5 s off) still snap at once.
 */
function glide(prev, d) {
  const now = performance.now();
  d.corr = 0; d.tau = 600;
  const i = d.info || {};
  // Wi-Fi delivers updates late and unevenly; a late one looked like the deck jumping back (fake tiny loops, early
  // loop jumps). Each update says when the box read it (updatedAt, box clock), so work out where the deck is NOW:
  // the phone-to-box offset is the smallest delay seen (the least-delayed update), drifting up only slowly.
  if (d.updatedAt > 0) {
    const o = Date.now() - d.updatedAt;
    if (S.off == null || o < S.off || o - S.off > 5000) S.off = o; else S.off += (o - S.off) * 0.02;
    if (d.playing) d.positionMs += Math.max(0, Math.min(2000, Date.now() - S.off - d.updatedAt)) * (1 + d.pitch / 100) * (i.reverse ? -1 : 1);
  }
  d.raw = d.positionMs;
  const same = prev && prev.receivedAt && prev.load === 'LOADED' && d.load === 'LOADED' && prev.trackKey === d.trackKey && !prev.demo === !d.demo;
  // Loop bounds. CDJ-3000s send them; the XZ and older players only say "looping". Then the phone works them out
  // from the jump back: where the playhead was (loop out) and where it landed (loop in). Kept while the loop lasts.
  if (i.looping && i.loopEndMs > i.loopStartMs) d.loop = [i.loopStartMs, i.loopEndMs];
  else if (i.looping && same && prev.loop) d.loop = prev.loop;
  if (i.looping && same && prev.playing && d.playing && !(i.loopEndMs > i.loopStartMs)) {
    const was = position(prev), back = was - d.positionMs;
    if (!prev.loop && back > 250 && back < 70000) d.loop = [d.positionMs, was]; // first jump back only: later ones are just the loop going round
  }
  if (same && prev.playing && d.playing && !!(prev.info || {}).looping === !!i.looping) {
    const predicted = position(prev);
    let err = d.positionMs - predicted;
    const L = d.loop && prev.loop && d.loop[0] === prev.loop[0] ? d.loop[1] - d.loop[0] : 0;
    if (L > 0) err = ((err % L) + L * 1.5) % L - L / 2; // around a loop, the short way round
    // Backspins, scratches, reverse: anything going backwards more than a hair follows the player at once.
    const backwards = L === 0 && err < -150;
    if (Math.abs(err) < 1500 && !backwards && !(L === 0 && d.loop) && !i.reverse && !(prev.info || {}).reverse) {
      d.positionMs = predicted; d.corr = err; d.tau = Math.max(600, Math.abs(err) * 1.5); d.shown = prev.shown;
    }
  }
  // While it's going backwards (backspin, scratch), carry on at the speed the player is actually moving.
  d.raw = d.raw ?? d.positionMs;
  if (same && prev.playing && d.playing && !i.looping && prev.raw != null && now - prev.receivedAt > 50) {
    const v = (d.raw - prev.raw) / (now - prev.receivedAt);
    if (v < -0.05 && v > -8) { d.vel = v; d.positionMs = d.raw; d.corr = 0; d.shown = undefined; }
  }
  // Moved by hand while stopped (scratch, jog, needle search): the XZ reports whole beats (476 ms steps, ~15 a second,
  // home test Nov 10), which read as jumping. Glide each step in over ~70 ms instead of cutting.
  if (same && !d.playing && prev.receivedAt) {
    const from = position(prev);
    if (Math.abs(d.positionMs - from) > 1 && Math.abs(d.positionMs - from) < 4000) d.ease = { from, at: now };
  }
  // REVERSE only when it lasts (a backspin or reverse play), not for a quick scratch back.
  d.revSince = i.reverse ? (prev && prev.revSince) || now : 0;
  d.receivedAt = now;
}
const reverseShown = d => !!(d.info && d.info.reverse && d.revSince && performance.now() - d.revSince > 1000);


function setWave(player, w) {
  const bytes = b => Uint8Array.from(atob(b || ''), c => c.charCodeAt(0));
  S.waves[player] = { key: w.trackKey, detail: bytes(w.detail), perSec: w.detailPerSecond, overview: bytes(w.overview) };
}

// ---------- helpers ----------

/** Not joined: players stop sending us status, so decks show what we last saw, with the clock stopped. */
const frozen = d => !(d && d.demo) && !!S.status && S.status.source === 'beat-link' && S.status.link !== 'LINKED';

function position(d) {
  let p = d.positionMs;
  if (!d.playing && d.ease) {
    const el = performance.now() - d.ease.at;
    if (el < 400) p = d.positionMs + (d.ease.from - d.positionMs) * Math.exp(-el / 70); else d.ease = null;
  }
  if (d.playing && !frozen(d)) {
    const el = performance.now() - d.receivedAt;
    p += (d.vel != null ? d.vel * Math.min(el, 400) : (1 + d.pitch / 100) * (d.info && d.info.reverse ? -1 : 1) * el) + (d.corr || 0) * (1 - Math.exp(-el / (d.tau || 600)));
    const L = d.loop ? d.loop[1] - d.loop[0] : 0;
    if (L > 0 && d.info && d.info.looping) {
      if (p >= d.loop[1]) p = d.loop[0] + (p - d.loop[0]) % L; // wrap like the player does, don't run past loop out
    } else if (d.vel == null && !(d.info && d.info.reverse) && d.shown != null && p < d.shown && d.shown - p < 150) p = d.shown; // no jitter backwards
    d.shown = p;
  }
  return Math.max(0, d.durationMs ? Math.min(p, d.durationMs) : p);
}
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const clock = at => new Date(at + S.skew).toTimeString().slice(0, 5);
const clockSec = at => new Date(at + S.skew).toTimeString().slice(0, 8);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** innerHTML only when it changed: no churn, no lost focus, no re-layout on the 1-a-second status. */
const setText = (e, t) => { if (e && e.textContent !== t) { e._h = undefined; e.textContent = t; } };
const setHTML = (e, h) => { if (e && e._h !== h) { e._h = h; e.innerHTML = h; } };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// A warning can be put away for the rest of the night (per phone); it comes back next night or at the next venue.
function alertKey(p) { return 'dismiss:' + p.title + ':' + ((S.status && S.status.night) || '') + ':' + ((S.status && S.status.venue && S.status.venue.name) || ''); }
function dismissed(p) { try { return localStorage.getItem(alertKey(p)) === '1'; } catch (e) { return false; } }
// sticky = can't be put away (lost connection): a frozen dashboard must always say so.
function setAlert(p) {
  const a = $('alert');
  const gone = !!p && !p.sticky && dismissed(p);
  a.hidden = !p || gone;
  if (p && !gone) {
    a.innerHTML = `<b>${esc(p.title)}</b><span>${esc(p.fix)}</span>` + (p.sticky ? '' : '<button type="button" class="mini" data-dismiss>OK, NOT TONIGHT</button>');
    const b = a.querySelector('[data-dismiss]');
    a.onclick = e => { if (!e.target.closest('button')) a.classList.toggle('open'); };
    if (b) b.onclick = () => { try { localStorage.setItem(alertKey(p), '1'); } catch (e) {} if (S.status) renderHeader(); else a.hidden = true; };
  }
}

// ---------- header ----------

function renderHeader() {
  const s = S.status;
  if (!s) return;
  const g = $('ghost');
  g.textContent = (GHOSTS[s.ghost] || GHOSTS.asleep).join('\n');
  g.className = 'ghost ' + s.ghost;
  const link = $('link');
  link.className = 'link' + (s.link === 'BACKED_OFF' ? ' warn' : '');
  link.textContent = {
    LINKED: 'DEVICE ' + s.deviceNumber,
    LISTENING: 'LISTENING',
    BACKED_OFF: 'BACKED OFF',
    LISTEN_ONLY: 'LISTEN ONLY',
    OFFLINE: s.djLinkTraffic.arriving ? 'LISTENING' : 'NO DJ LINK',
  }[s.link] || s.link;
  const view = curView();
  // DEMO with no gear at all: the 'nothing connected' warning would just be noise. With real gear, problems show.
  const quiet = S.demo && !S.devices.some(x => x.kind === 'PLAYER');
  // The first problem this phone hasn't put away for tonight (one dismissed warning never hides the next one).
  setAlert(view !== 'status' && !quiet ? s.problems.find(p => !dismissed(p)) || null : null);
}

// ---------- decks ----------

const tiles = {};
let decksHidden = false; // kept by showView: DECKS isn't on screen

function players() {
  const ps = new Set(Object.keys(S.decks).map(Number));
  S.devices.filter(d => d.kind === 'PLAYER' && d.number <= 6).forEach(d => ps.add(d.number));
  return [...ps].sort((a, b) => a - b);
}

function renderDecks() {
  const root = $('deckgrid');
  const ps = players();
  if (!ps.length) {
    root.innerHTML = '<div class="empty-note" hidden></div>'; // easy.js: NO DECKS YET says what to plug in
    for (const k in tiles) delete tiles[k];
    return;
  }
  if (root.querySelector('.empty-note')) root.innerHTML = '';
  ps.forEach(p => renderDeck(p));
}

function renderDeck(p) {
  const d = S.decks[p] || { player: p, load: 'EMPTY' };
  let t = tiles[p];
  if (decksHidden && t) { // off screen: only keep the stuck-loading clock (BOOTH CHECK reads it); DECKS redraws on return
    if (d.load === 'LOADING') t.loadingAt = t.loadingAt || Date.now(); else t.loadingAt = 0;
    lookupTrack(d); // "played before?" must be asked at load time even off screen, or this play counts as a repeat
    t.dirty = true;
    return;
  }
  if (!t) {
    t = tiles[p] = { root: el('article', 'deck') };
    const root = $('deckgrid');
    root.querySelector('.empty-note')?.remove();
    const after = [...root.children].find(c => +c.dataset.player > p);
    t.root.dataset.player = p;
    t.root.hidden = DV.hide.includes(p);
    root.insertBefore(t.root, after || null);
  }
  const empty = d.load !== 'LOADED';
  if (t.shape !== (empty ? 'empty' : 'full')) {
    t.shape = empty ? 'empty' : 'full';
    t.root.innerHTML = empty
      ? `<div class="top"><span class="num">${p}</span><span class="model"></span></div><div class="state"></div>`
      : `<div class="top"><span class="num">${p}</span><span class="model"></span><span class="tag demo">DEMO</span><span class="tag seen">LAST SEEN</span><span class="tag air">ON AIR</span><span class="tag master">MASTER</span></div>
         <div class="track"><img class="art" alt=""><div class="names"><div class="title"></div><div class="artist"></div></div></div>
         <div class="meta"></div>
         <div class="nums"><div><small>BPM</small><span class="bpm"></span></div><div><small>PITCH</small><span class="pitch"></span></div><div class="remain"><small>REMAIN</small><span class="rem"></span></div></div>
         <canvas class="detail"></canvas><canvas class="overview"></canvas>
         <div class="phrase"><span class="ph-now"></span><span class="beats"><i class="one"></i><i></i><i></i><i></i></span><span class="ph-next"></span></div>`;
    const found = new Map(); // the tile's parts, looked up once per rebuild (frameTiles asks 60 times a second)
    t.q = sel => { let e = found.get(sel); if (e === undefined) { e = t.root.querySelector(sel); found.set(sel, e); } return e; };
    t.art = undefined; // forces the first artwork decision
    t.phNow = t.phNext = t.metaHtml = undefined;
  }
  t.root.classList.toggle('empty', empty);
  t.root.classList.toggle('air', !empty && d.onAir);
  const fl = deckFlags(d).join(' · ');
  const i = d.info || {};
  // firmware (when the deck says) replaces the flags line, as before
  if (!empty && i.firmware) setText(t.q('.model'), (d.model || '') + ' · v' + i.firmware);
  else setHTML(t.q('.model'), esc(d.model || '') + (fl ? ' <span class="flags">' + esc(fl) + '</span>' : ''));
  if (d.load === 'LOADING') t.loadingAt = t.loadingAt || Date.now(); else t.loadingAt = 0;
  if (empty) {
    // A deck stuck on LOADING (a club deck 3): the box retries by itself; after 20 s offer RESTART READING here too.
    const stuck = d.load === 'LOADING' && Date.now() - t.loadingAt > 20000;
    // While details load, show what the player itself still says (play state, tempo), not a blank deck.
    const live = d.load === 'LOADING' ? [d.playing ? 'PLAYING' : '', d.effectiveBpm ? d.effectiveBpm.toFixed(1) + ' BPM' : ''].filter(Boolean).join(' · ') : '';
    setHTML(t.q('.state'), (stuck ? 'NOT READING YET' : d.load === 'LOADING' ? 'LOADING' : 'EMPTY')
      + (live ? ' <span class="flags">' + esc(live) + '</span>' : '')
      + (stuck ? ' <button type="button" class="mini" data-restart-reading>RESTART READING</button>' : ''));
    return;
  }
  const fz = frozen(d);
  t.root.classList.toggle('frozen', fz);
  t.q('.seen').hidden = !fz;
  t.q('.demo').hidden = !d.demo;
  t.q('.air').hidden = !d.onAir;
  t.q('.master').hidden = !d.master;
  setText(t.q('.title'), d.title || '');
  setText(t.q('.artist'), d.artist || '');
  const art = d.hasArtwork ? `/api/art/${p}?k=${encodeURIComponent(d.trackKey)}` : null;
  if (art !== t.art) { t.art = art; const img = t.q('.art'); img.style.visibility = art ? 'visible' : 'hidden'; if (art) img.src = art; }
  setText(t.q('.bpm'), d.effectiveBpm ? d.effectiveBpm.toFixed(1) : '--');
  setText(t.q('.pitch'), (d.pitch >= 0 ? '+' : '') + d.pitch.toFixed(2) + '%');
  lookupTrack(d);
  const lk = S.lookups[d.player + '|' + d.trackKey];
  const mix = mixHint(d);
  const metaHtml = [
    i.color ? `<span><i class="dot" style="background:${esc(i.color)}"></i></span>` : '',
    i.key ? `<span>KEY ${esc(i.key)}${camelot(i.key) && camelot(i.key) !== i.key ? ' · ' + camelot(i.key) : ''}</span>` : '',
    lk && lk.tonight.length ? `<span style="color:var(--warn)">PLAYED ${clock(lk.tonight[lk.tonight.length - 1].at)}${lk.tonight[lk.tonight.length - 1].dj ? ' · ' + esc(lk.tonight[lk.tonight.length - 1].dj) : ''}</span>`
      : lk && lk.past.length ? `<span>LAST PLAYED ${esc(nightLabel(lk.past[0].night))}</span>` : '',
    mix ? `<span style="color:${mix.ok ? 'var(--fg)' : 'var(--warn)'}">MIX ${esc(mix.text)}</span>` : '',
    ...venueNotes(d, lk),
    i.genre ? `<span>${esc(i.genre)}</span>` : '',
    i.looping ? '<span style="color:var(--warn)">LOOP' + (i.loopBeats ? ' ' + i.loopBeats : '') + '</span>' : '',
    i.synced ? '<span>' + (i.bpmSyncOnly ? 'BPM SYNC' : 'SYNC') + '</span>' : '',
    reverseShown(d) ? '<span style="color:var(--warn)">REVERSE</span>' : '',
    i.cued && !d.playing ? '<span>CUED</span>' : '',
    i.atEnd ? '<span style="color:var(--warn)">END</span>' : '',
    i.cueCountdown && d.playing && i.cueCountdown <= 64 ? '<span>CUE IN ' + i.cueCountdown + '</span>' : '',
  ].join('');
  if (t.metaHtml !== metaHtml) { t.metaHtml = metaHtml; t.q('.meta').innerHTML = metaHtml; } // only touch the page on change
}

function toggleBuzz() {
  buzzDrop = !buzzDrop;
  try { localStorage.setItem('buzzDrop', buzzDrop ? '1' : '0'); } catch (e) {}
  if (buzzDrop && navigator.vibrate) navigator.vibrate(60); // also unlocks vibration on Android
}

// ---------- track smarts: played before? will it mix? ----------
/** MUSIC AT THIS VENUE (#55): NOT HERE (the room's list), PLAYED HERE (past nights at this venue), BPM outside the room's usual. */
function noPlayLine(rules, d) {
  const n = x => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const t = n(d.title), a = n(d.artist), both = (a + ' ' + t).trim();
  return (rules.noPlay || []).find(l => { const x = n(l); return x && (x === t || x === a || x === both || (x.length >= 6 && both.includes(x))); });
}
function venueNotes(d, lk) {
  const r = S.status && S.status.venueMusic;
  if (!r || d.load !== 'LOADED') return [];
  const out = [], no = noPlayLine(r, d);
  if (no) out.push(`<span style="color:var(--warn)" title="${esc(no)}">NOT HERE</span>`);
  if (lk && lk.here) {
    const days = Math.round((new Date((S.status.night || '') + 'T12:00:00') - new Date(lk.here.night + 'T12:00:00')) / 864e5);
    const recent = r.repeatDays > 0 && days >= 0 && days <= r.repeatDays;
    out.push(`<span style="color:${recent ? 'var(--warn)' : 'var(--grey)'}">PLAYED HERE ${lk.here.count > 1 ? lk.here.count + '× · ' : ''}` +
      `${days <= 1 ? 'LAST NIGHT' : days < 60 ? days + ' DAYS AGO' : esc(nightLabel(lk.here.night))}${lk.here.dj ? ' · ' + esc(lk.here.dj) : ''}</span>`);
  }
  const bpm = d.effectiveBpm || d.trackBpm;
  if (!d.onAir && bpm && r.bpmLow && r.bpmHigh && (bpm < r.bpmLow - 0.5 || bpm > r.bpmHigh + 0.5))
    out.push(`<span style="color:var(--grey)">${bpm < r.bpmLow ? 'SLOWER' : 'FASTER'} THAN HERE (${r.bpmLow}-${r.bpmHigh})</span>`);
  return out;
}
S.lookups = {};
/** Once per load: has this track been on air tonight (or on past nights)? Asked at load time, so this play isn't counted. */
function lookupTrack(d) {
  if (d.load !== 'LOADED' || !d.title) return;
  const k = d.player + '|' + d.trackKey;
  if (k in S.lookups) return;
  S.lookups[k] = null;
  fetch('/api/track?title=' + encodeURIComponent(d.title) + '&artist=' + encodeURIComponent(d.artist || ''))
    .then(r => r.json()).then(j => { S.lookups[k] = j; renderDeck(d.player); }).catch(() => {});
}

const CAMELOT = {
  'Abm': '1A', 'G#m': '1A', 'Ebm': '2A', 'D#m': '2A', 'Bbm': '3A', 'A#m': '3A', 'Fm': '4A', 'Cm': '5A', 'Gm': '6A',
  'Dm': '7A', 'Am': '8A', 'Em': '9A', 'Bm': '10A', 'F#m': '11A', 'Gbm': '11A', 'Dbm': '12A', 'C#m': '12A',
  'B': '1B', 'Cb': '1B', 'F#': '2B', 'Gb': '2B', 'Db': '3B', 'C#': '3B', 'Ab': '4B', 'G#': '4B', 'Eb': '5B', 'D#': '5B',
  'Bb': '6B', 'A#': '6B', 'F': '7B', 'C': '8B', 'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B',
};
/** Key label -> Camelot (rekordbox may already show Camelot, or "A minor" style). */
function camelot(k) {
  if (!k) return null;
  const s = String(k).trim().replace(/\s*minor$/i, 'm').replace(/\s*major$/i, '').replace('♯', '#').replace('♭', 'b');
  if (/^(1[0-2]|[1-9])[AB]$/i.test(s)) return s.toUpperCase();
  return CAMELOT[s] || CAMELOT[s.charAt(0).toUpperCase() + s.slice(1)] || null;
}
/** Same number, a step either way with the same letter, or the same number's other letter: mixes cleanly. */
function keysMix(a, b) {
  const pa = /^(\d+)([AB])$/.exec(a), pb = /^(\d+)([AB])$/.exec(b);
  if (!pa || !pb) return null;
  const na = +pa[1], nb = +pb[1], step = Math.min((na - nb + 12) % 12, (nb - na + 12) % 12);
  return (pa[2] === pb[2] && step <= 1) || (na === nb);
}
/** On a cued deck: how it sits against what's on air (key fit and the tempo change needed). */
function mixHint(d) {
  if (d.load !== 'LOADED' || d.onAir) return null;
  const live = Object.values(S.decks).filter(x => x.player !== d.player && x.load === 'LOADED' && x.onAir && x.playing);
  const m = live.find(x => x.master) || live[0];
  if (!m) return null;
  const a = camelot(m.info && m.info.key), b = camelot(d.info && d.info.key);
  const fit = a && b ? keysMix(a, b) : null;
  const pct = m.effectiveBpm && d.trackBpm ? (m.effectiveBpm / d.trackBpm - 1) * 100 : null;
  const parts = [];
  if (a && b) parts.push(a + '→' + b + (fit ? ' ✓' : ' ✕'));
  if (pct != null && isFinite(pct)) parts.push((pct >= 0 ? '+' : '') + pct.toFixed(1) + '%');
  return parts.length ? { text: parts.join(' · '), ok: fit !== false && (pct == null || Math.abs(pct) <= 8) } : null;
}

// ---------- beats + phrases (shared by deck tiles and the NOW view) ----------

/** Exact beat packets: the player says "beat 3 of 4" the moment it happens. Anchor the counter to it. */
const beats = {};
function onBeat(p, b) { beats[p] = { b, at: performance.now() }; const d = S.decks[p]; if (d && d.load === 'LOADED') Waves.beat(d, b, position(d)); }

/** Beat in bar (1-4) and beat number now. Anchored to the last beat packet when fresh, else counted from the last status. */
function beatNow(d) {
  const i = d.info;
  if (!i || !i.beatNumber || !d.effectiveBpm) return null;
  const beatMs = 60000 / d.effectiveBpm;
  const elapsed = d.playing ? Math.floor((performance.now() - d.receivedAt) / beatMs) : 0;
  const n = i.beatNumber + Math.max(0, elapsed);
  const bp = beats[d.player];
  if (bp && d.playing && performance.now() - bp.at < beatMs * 1.5) return { n, inBar: bp.b };
  const inBar = i.beatInBar ? ((i.beatInBar - 1 + elapsed) % 4 + 4) % 4 + 1 : ((n - 1) % 4) + 1;
  return { n, inBar };
}

/** Current phrase, the next one, and seconds until it starts (at the current pitch). */
function phraseNow(d, pos) {
  const st = S.structs[d.player];
  if (!st || st.trackKey !== d.trackKey || !st.phrases.length) return null;
  const ph = st.phrases;
  let k = ph.findIndex(p => pos >= p.startMs && pos < p.endMs);
  if (k < 0) k = pos < ph[0].startMs ? -1 : ph.length - 1;
  const cur = k >= 0 ? ph[k] : null, next = ph[k + 1] || null;
  const rate = 1 + d.pitch / 100;
  const b = beatNow(d);
  let bar = null, bars = null;
  if (cur && b) {
    const endBeat = next ? next.startBeat : cur.startBeat + Math.round((cur.endMs - cur.startMs) / (60000 / d.trackBpm));
    bars = Math.max(1, Math.round((endBeat - cur.startBeat) / 4));
    bar = Math.min(bars, Math.max(1, Math.floor((b.n - cur.startBeat) / 4) + 1));
  }
  return { cur, next, inS: next ? (next.startMs - pos) / 1000 / rate : null, bar, bars };
}

/** The next drop: the next CHORUS section ahead of the playhead (rekordbox phrase analysis). */
function nextDrop(d, pos) {
  const st = S.structs[d.player];
  if (!st || st.trackKey !== d.trackKey) return null;
  const p = st.phrases.find(x => x.startMs > pos && /CHORUS/.test(x.kind));
  return p ? { kind: p.kind, inS: (p.startMs - pos) / 1000 / (1 + d.pitch / 100) } : null;
}
let buzzDrop = (() => { try { return localStorage.getItem('buzzDrop') === '1'; } catch (e) { return false; } })(), buzzedFor = null;

function setBeats(box, d) {
  const b = beatNow(d);
  box.querySelectorAll('i').forEach((el, k) => el.classList.toggle('on', !!b && d.playing && k === b.inBar - 1));
}

// Waveforms + clocks animate locally between updates.
function frame() {
  try { frameTiles(); } catch (e) { oops(e); }
  try { if (!$('now').hidden) frameNow(); } catch (e) { oops(e); }
  requestAnimationFrame(frame);
}
// A drawing bug must never freeze the screen: note it once and keep animating.
function oops(e) {
  if (window.__oops) return;
  window.__oops = String(e && e.stack || e);
  console.error(e);
  document.body.dataset.error = window.__oops.slice(0, 300);
  // Shown long enough to read or screenshot, then out of the way; the next new error shows again.
  setTimeout(() => { delete document.body.dataset.error; window.__oops = null; }, 20000);
}

function frameTiles() {
  if (decksHidden) return; // nothing to see; showView redraws every tile when DECKS comes back
  if (FIT.on) fitRoles();
  for (const p in tiles) {
    const t = tiles[p], d = S.decks[p];
    if (!d || t.shape !== 'full') {
      if (FIT.on && !DV.hide.includes(+p)) blankStack(stackCanvas(+p, 0)); // a thin EMPTY / LOADING row
      else if (DV.mode === 'stack') clearStack(+p);
      continue;
    }
    const pos = position(d);
    const rate = 1 + d.pitch / 100;
    const up = DV.time === 'elapsed' || !d.durationMs;
    const rem = up ? mmss(pos / rate) : '-' + mmss((d.durationMs - pos) / rate), re = t.q('.rem');
    if (re.textContent !== rem) re.textContent = rem; // once a second, not every frame
    const lbl = up ? 'ELAPSED' : 'REMAIN', lb = t.q('.remain small');
    if (lb.textContent !== lbl) lb.textContent = lbl;
    const w = S.waves[p];
    if (w && w.key === d.trackKey) {
      if (DV.mode === 'stack') { const sc = stackCanvas(+p, pos); drawDetail(sc, w, pos, d); sc._blank = false; if (FIT.on) Views.after(+p, sc, w, pos, d); }
      else drawDetail(t.q('.detail'), w, pos, d);
      if (DV.show.overview && !FIT.on) drawOverview(t.q('.overview'), w, pos, d); // tiles are put away when FIT
    } else if (DV.mode === 'stack') { Waves.wait(stackCanvas(+p, pos), WAVE_OPT); } // loaded, waveform on its way (#84): a quiet line, the facts already show
    else { Waves.wait(t.q('.detail'), WAVE_OPT); Waves.wait(t.q('.overview'), WAVE_OPT); } // never the last track's waveform
    setBeats(t.q('.beats'), d);
    const ph = phraseNow(d, pos);
    const phNow = ph && ph.cur ? `<b>${esc(ph.cur.kind)}</b>${ph.bar ? ' ' + ph.bar + '/' + ph.bars : ''}` : '';
    if (t.phNow !== phNow) { t.phNow = phNow; t.q('.ph-now').innerHTML = phNow; } // only touch the page on change
    const phNext = ph && ph.next ? ph.next.kind + ' in ' + mmss(Math.ceil(ph.inS) * 1000) : '';
    if (t.phNext !== phNext) { t.phNext = phNext; t.q('.ph-next').textContent = phNext; }
  }
  if (FIT.on) fitGeometry();
}

function fit(c) {
  const r = devicePixelRatio || 1;
  const W = Math.round(c.clientWidth * r), H = Math.round(c.clientHeight * r);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  return [c.getContext('2d'), W, H, r];
}

let WINDOW_S = 8; // seconds of audio across the scrolling waveform (LAYOUT → ZOOM)

/** LAYOUT → COLOUR: the players' own colours, rekordbox-style blue (louder = whiter), or plain white. */
function waveColor(a, i, level) {
  if (DV.color === 'blue') { const l = Math.max(0, Math.min(1, level)); return `rgb(${40 + 200 * l * l | 0},${110 + 140 * l * l | 0},255)`; }
  if (DV.color === 'mono') return '#d8d8d8';
  return `rgb(${a[i * 4 + 1]},${a[i * 4 + 2]},${a[i * 4 + 3]})`;
}

/**
 * What the player is doing beyond play/stop, the same words on every view (tiles, STACKED, NOW): LOOP (with its
 * length), REVERSE, SYNC / BPM SYNC, CUED, END. a club: a loop only showed in a line under the deck, and only with
 * that line switched on.
 */
function deckFlags(d) {
  const i = d && d.info;
  if (!i || d.load !== 'LOADED') return [];
  return [i.looping ? 'LOOP' + (i.loopBeats ? ' ' + (i.loopBeats < 1 ? '1/' + Math.round(1 / i.loopBeats) : i.loopBeats) : '') : '',
    reverseShown(d) ? 'REVERSE' : '', i.synced ? (i.bpmSyncOnly ? 'BPM SYNC' : 'SYNC') : '', i.cued && !d.playing ? 'CUED' : '',
    i.atEnd ? 'END' : ''].filter(Boolean);
}

// WAVEFORMS (#84): drawing lives in waves.js (cached strips, beat grid, cues, end warning); these pass the phone's
// choices (zoom, colour) and the deck's grid / phrases.
const WAVE_OPT = { fit, windowS: 8, color: 'rgb', grid: null, struct: null };
function waveOpt(d) {
  WAVE_OPT.windowS = Views.windowS(d, DV.zoom); WAVE_OPT.color = DV.color || 'rgb';
  WAVE_OPT.grid = (S.grids || {})[d.player] || null; WAVE_OPT.struct = S.structs[d.player] || null;
  return WAVE_OPT;
}
function drawDetail(c, w, pos, d) { Waves.detail(c, w, pos, d, waveOpt(d)); }
function drawOverview(c, w, pos, d) { Waves.overview(c, w, pos, d, waveOpt(d)); }

/** Thin band along the top: one block per phrase, chorus/up brighter. Boundaries as gaps. */
function drawPhraseBand(g, W, H, r, d, frac) {
  const st = S.structs[d.player];
  if (!st || st.trackKey !== d.trackKey || !d.durationMs) return;
  const bh = Math.max(3 * r, H * frac);
  for (const p of st.phrases) {
    const x0 = Math.round(p.startMs / d.durationMs * W), x1 = Math.round(p.endMs / d.durationMs * W);
    g.fillStyle = PHRASE_SHADE(p.kind);
    g.fillRect(x0 + r, 0, Math.max(1, x1 - x0 - r), bh);
  }
}
const PHRASE_SHADE = k => /CHORUS|UP/.test(k) ? '#ffffff' : /DOWN|BRIDGE/.test(k) ? '#555555' : '#9a9a9a';

// ---------- now (role views) ----------
// One big readout of what's on air, shaped by who is watching. Role per phone, or ?role=photo in a shared link.

const ROLES = {
  dj:      { label: 'DJ',      blocks: ['hero', 'night', 'time', 'bpm', 'key', 'next-track', 'phrase', 'all'] },
  photo:   { label: 'PHOTO',   blocks: ['drop', 'hero', 'countdown', 'phrase', 'time', 'all'] },
  vj:      { label: 'VJ',      blocks: ['hero', 'bpm', 'beats', 'phrase', 'countdown', 'dropbars', 'showctl', 'key'] },
  lights:  { label: 'LIGHTS',  blocks: ['bpm', 'beats', 'phrase', 'countdown', 'dropbars', 'showctl', 'hero', 'all'] },
  sound:   { label: 'SOUND',   blocks: ['sound', 'room', 'hero', 'time', 'night', 'boxhealth'] },
  tech:    { label: 'TECH',    blocks: ['boxhealth', 'health', 'all', 'hero', 'time', 'night'] },
  manager: { label: 'MANAGER', blocks: ['night', 'stats', 'lineup', 'hero', 'all'] },
  host:    { label: 'HOST',    blocks: ['night', 'lineup', 'hero', 'time'] },
};
let role = (() => {
  const q = new URLSearchParams(location.search).get('role');
  if (q && ROLES[q]) { try { localStorage.setItem('role', q); } catch (e) {} return q; }
  try { return ROLES[localStorage.getItem('role')] ? localStorage.getItem('role') : 'dj'; } catch (e) { return 'dj'; }
})();
let nowShape = null;

function setRole(r) {
  if (!ROLES[r]) return;
  role = r;
  try { localStorage.setItem('role', role); } catch (e) {}
  nowShape = null;
  if (editing) renderEditor();
  pollLive(true);
}
document.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => setRole(b.dataset.role)));

/** The deck that matters: tempo master if playing, else whichever is on air and playing, else any loaded. */
function focusDeck() {
  const ds = Object.values(S.decks).filter(d => d.load === 'LOADED');
  return ds.find(d => d.master && d.playing) || ds.find(d => d.onAir && d.playing) || ds.find(d => d.playing) || ds[0] || null;
}

// The night's numbers for the role blocks (set time left, next DJ, music off, box health, show control): the same
// one-poll feed the HARD STOP app reads (/api/hardstop/live), only while NOW is on screen with a block that needs it.
S.live = null; S.plan = null; S.sc = null;
const LIVE_BLOCKS = ['night', 'boxhealth', 'stats', 'lineup', 'sound'];
let liveAt = 0, planAt = 0, scAt = 0, liveBusy = false;
async function pollLive(force) {
  if (liveBusy || document.hidden || $('now').hidden) return;
  const l = layout(role), now = Date.now();
  liveBusy = true;
  try {
    if (l.some(b => LIVE_BLOCKS.includes(b)) && (force || now - liveAt > 3000)) {
      liveAt = now;
      const r = await fetch('/api/hardstop/live', { cache: 'no-store' });
      if (r.ok) S.live = await r.json();
    }
    if ((l.includes('lineup') || l.includes('night')) && (force || now - planAt > 20000)) {
      planAt = now;
      const r = await fetch('/api/plan', { cache: 'no-store' });
      if (r.ok) S.plan = await r.json();
    }
    if (l.includes('showctl') && (force || now - scAt > 3000)) {
      scAt = now;
      const r = await fetch('/api/showctl', { cache: 'no-store' });
      if (r.ok) S.sc = await r.json();
    }
  } catch (e) { /* offline: keep the last numbers */ }
  liveBusy = false;
}
setInterval(pollLive, 1000);

/** "02:00" tonight on the box's clock (times before noon are after midnight). */
function atTonight(hhmm) {
  const night = S.status && S.status.night;
  if (!night || !/^\d{1,2}:\d{2}$/.test(hhmm || '')) return null;
  const [h, m] = hhmm.split(':').map(Number), t = new Date(night + 'T00:00:00');
  t.setHours(h, m, 0, 0);
  if (h < 12) t.setDate(t.getDate() + 1);
  return t.getTime();
}
/** ON NOW: who, minutes left, who's next, music off. HARD STOP / the venue's usual times count too (live feed). */
function onNow() {
  const L = S.live, now = Date.now() - (S.skew || 0);
  if (L && L.set) {
    const p = L.plan || {}, off = atTonight(p.musicOff);
    // Nobody named yet (a HARD STOP lineup names a DJ when their first track airs): the lineup slot by the clock.
    let slot = null;
    ((S.plan && S.plan.lineup) || []).forEach(x => { const at = untimed(x) ? 0 : atTonight(x.start); if (at != null && at <= now) slot = x.dj; });
    return { dj: L.set.dj || (S.status && S.status.dj) || slot, left: L.set.endsAt ? L.set.endsAt - now : null,
      next: p.nextDj ? { dj: p.nextDj, start: p.nextAt } : null, off: off ? { at: off, label: p.musicOff } : null, now };
  }
  const nn = nightNow();
  if (!nn) return null;
  const end = nn.next ? nn.next.at : nn.off ? nn.off.at : null;
  return { dj: nn.dj, left: end ? end - nn.now : null, next: nn.next, off: nn.off, now: nn.now };
}
const minsLeft = ms => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 90 ? Math.floor(m / 60) + ' H ' + (m % 60) + ' MIN' : m + ' MIN'; };
const barsTo = (s, bpm) => bpm ? Math.max(0, Math.round(s * bpm / 240)) : null;

let nowEls = null, nowAt = 0;
function frameNow() {
  // 20 times a second is plenty for numbers and the beat squares; the rest of the frame stays free.
  const t = performance.now();
  if (t - nowAt < 50 && nowShape) return;
  nowAt = t;
  document.querySelectorAll('[data-role]').forEach(b => b.classList.toggle('on', b.dataset.role === role));
  const d = focusDeck();
  const body = $('nowBody');
  const shape = role + '|' + (d ? d.player + d.trackKey : '-') + '|' + layout(role).join();
  if (shape !== nowShape) {
    nowShape = shape;
    nowEls = new Map();
    const l = layout(role);
    // The night, the box and the room don't need a track on air: those blocks show with nothing playing too.
    const always = l.filter(b => BLOCKS[b].always);
    body.innerHTML = d ? '<div class="grid">' + l.map(b => BLOCKS[b].html).join('') + '</div>'
      : '<div class="empty-note">Nothing playing yet. Load and play a track on any deck.</div>' + (always.length ? '<div class="grid">' + always.map(b => BLOCKS[b].html).join('') + '</div>' : '');
    if (editing) renderEditor();
    pollLive(true);
  }
  const q = s => { let e = nowEls.get(s); if (e === undefined) { e = body.querySelector(s); nowEls.set(s, e); } return e; };
  const set = (s, v) => { const e = q(s); if (e && e.textContent !== v) e.textContent = v; };
  const setH = (s, v) => { const e = q(s); if (e && e._h !== v) { e._h = v; e.innerHTML = v; } };
  frameNight(q, set, setH);
  if (!d) return;
  const pos = position(d), rate = 1 + d.pitch / 100;
  set('.n-title', d.title || '');
  set('.n-artist', d.artist || '');
  set('.n-deck', 'DECK ' + d.player + (d.onAir ? ' · ON AIR' : '') + (d.master ? ' · MASTER' : ''));
  const img = q('.n-art');
  if (img) { const a = d.hasArtwork ? `/api/art/${d.player}?k=${encodeURIComponent(d.trackKey)}` : ''; if (img.dataset.src !== a) { img.dataset.src = a; img.style.visibility = a ? 'visible' : 'hidden'; if (a) img.src = a; } }
  set('.n-bpm', d.effectiveBpm ? d.effectiveBpm.toFixed(1) : '--');
  set('.n-pitch', (d.pitch >= 0 ? '+' : '') + d.pitch.toFixed(2) + '%');
  set('.n-key', (d.info && d.info.key) || '--');
  set('.n-genre', (d.info && d.info.genre) || '');
  set('.n-rem', d.durationMs ? '-' + mmss((d.durationMs - pos) / rate) : mmss(pos));
  set('.n-len', d.durationMs ? 'of ' + mmss(d.durationMs / rate) : '');
  const bb = q('.beats-big'); if (bb) setBeats(bb, d);
  const ph = phraseNow(d, pos);
  set('.n-phrase', ph && ph.cur ? ph.cur.kind : '--');
  set('.n-bar', ph && ph.bar ? 'bar ' + ph.bar + ' of ' + ph.bars : (ph ? '' : 'no phrase analysis on this track'));
  set('.n-next', ph && ph.next ? ph.next.kind : '--');
  const nb = ph && ph.next ? barsTo(ph.inS, d.effectiveBpm) : null;
  set('.n-in', ph && ph.next ? 'in ' + mmss(Math.ceil(ph.inS) * 1000) + (nb != null ? ' · ' + nb + (nb === 1 ? ' BAR' : ' BARS') : '') : '');
  const cd = q('.n-cd'); // the NEXT SECTION cell (other cells are .countdown too)
  if (cd) cd.classList.toggle('soon', !!(ph && ph.next && ph.inS < 8));
  const strip = q('canvas.strip');
  if (strip) {
    const [g, W, H, r] = fit(strip);
    g.clearRect(0, 0, W, H);
    drawPhraseBand(g, W, H, r, d, 1);
    if (d.durationMs) {
      const x = Math.round(pos / d.durationMs * W);
      g.fillStyle = '#000'; g.fillRect(x - 2 * r, 0, 6 * r, H);
      g.fillStyle = '#fff'; g.fillRect(x, 0, 2 * r, H);
    }
  }
  if (q('.n-other')) {
    const other = Object.values(S.decks).find(o => o.player !== d.player && o.load === 'LOADED');
    set('.n-other', other ? (other.title || '') + (other.artist ? ' · ' + other.artist : '') : 'nothing loaded');
    const oh = other && mixHint(other);
    set('.n-other-deck', other ? 'DECK ' + other.player + (other.playing ? ' · PLAYING' : ' · CUED') + (oh ? ' · MIX ' + oh.text : '') : 'OTHER DECK');
  }
  const all = q('.n-all');
  if (all) {
    // Every deck at a glance: one line each, with a tiny overview waveform and playhead.
    const decks = Object.values(S.decks).filter(x => x.player <= 6).sort((a, b) => a.player - b.player);
    const keyOf = decks.map(x => x.player + x.load + x.trackKey).join();
    if (all.dataset.k !== keyOf) {
      all.dataset.k = keyOf;
      all.innerHTML = decks.map(x => `<div class="ad" data-p="${x.player}"><b>${x.player}</b>` +
        `<span class="ad-t"><span class="ad-title"></span><span class="ad-sub"></span></span>` +
        `<span class="ad-r"></span><span class="ad-b"></span><canvas class="ad-w"></canvas></div>`).join('');
    }
    decks.forEach(x => {
      const row = all.querySelector(`[data-p="${x.player}"]`);
      if (!row) return;
      const rq = s => row.querySelector(s), rs = (s, v) => { const e = rq(s); if (e.textContent !== v) e.textContent = v; };
      const loaded = x.load === 'LOADED', p = position(x), rt = 1 + x.pitch / 100, i = x.info || {};
      row.classList.toggle('air', !!x.onAir); row.classList.toggle('master', !!x.master); row.classList.toggle('playing', !!x.playing); row.classList.toggle('empty', !loaded);
      rs('.ad-title', loaded ? x.title || '' : x.load === 'LOADING' ? 'LOADING' : 'EMPTY');
      rs('.ad-sub', loaded ? [...deckFlags(x), x.artist, i.key, x.master ? 'MASTER' : ''].filter(Boolean).join(' · ') : '');
      rs('.ad-r', loaded && x.durationMs ? '-' + mmss((x.durationMs - p) / rt) : '');
      rs('.ad-b', x.effectiveBpm ? x.effectiveBpm.toFixed(1) : '');
      const c = rq('.ad-w'), w = S.waves[x.player];
      if (loaded && w && w.key === x.trackKey && c.clientWidth) drawOverview(c, w, p, x);
      else if (c.width) { c.getContext('2d').clearRect(0, 0, c.width, c.height); }
    });
  }
  if (q('.n-drop') || q('.n-dropbars')) {
    const dr = d.playing ? nextDrop(d, pos) : null;
    const why = S.structs[d.player] ? 'no more drops in this track' : 'needs rekordbox phrase analysis';
    set('.n-drop', dr ? mmss(Math.ceil(dr.inS) * 1000) : '--');
    const bars = dr ? barsTo(dr.inS, d.effectiveBpm) : null;
    set('.n-drop-s', dr ? dr.kind + (bars != null ? ' · ' + bars + (bars === 1 ? ' BAR' : ' BARS') : '') : why);
    set('.n-dropbars', bars != null ? bars + (bars === 1 ? ' BAR' : ' BARS') : '--');
    set('.n-dropbars-s', dr ? 'in ' + mmss(Math.ceil(dr.inS) * 1000) + ' · ' + dr.kind : why);
    [q('.n-drop'), q('.n-dropbars')].forEach(e => {
      const cell = e && e.closest('.cell');
      if (!cell) return;
      cell.classList.toggle('soon', !!(dr && dr.inS < 8));
      cell.classList.toggle('flash', !!(dr && dr.inS < 3));
    });
    set('.n-buzz', buzzDrop ? 'BUZZ 3s BEFORE: ON' : 'BUZZ 3s BEFORE: OFF');
    const id = dr && d.trackKey + '|' + Math.round(pos / 1000 + dr.inS);
    if (q('.n-drop') && buzzDrop && dr && dr.inS < 3 && buzzedFor !== id) { buzzedFor = id; if (navigator.vibrate) navigator.vibrate([120, 80, 120, 80, 300]); }
  }
}

/** The blocks that don't depend on the track: the night, the box, the room, show control. */
function frameNight(q, set, setH) {
  const s = S.status, L = S.live;
  if (q('.n-set')) {
    const on = onNow();
    set('.n-set', on ? (on.dj || 'NO DJ SET') : ((s && s.dj) || 'NO PLAN TONIGHT'));
    const parts = [];
    if (on && on.left != null) parts.push(minsLeft(on.left) + ' LEFT');
    if (on && on.next) parts.push('NEXT ' + on.next.dj + (on.next.start ? ' ' + on.next.start : ''));
    else if (on && on.left != null) parts.push('LAST SET');
    set('.n-set-end', parts.join(' · ') || (nights.some(n => s && n.date === s.night && n.lineup.length) ? 'LAST SET OF THE NIGHT' : 'NO SET TIMES TONIGHT · TAP TO PLAN'));
    set('.n-off', on && on.off ? 'MUSIC OFF ' + on.off.label + ' · in ' + inMin(on.off.at - on.now) : '');
    const cell = q('.n-set').closest('.cell');
    if (cell) cell.classList.toggle('soon', !!(on && ((on.left != null && on.left < 10 * 60000) || (on.off && on.off.at - on.now < 15 * 60000))));
  }
  if (q('.n-count')) {
    set('.n-count', String(S.played.length));
    const first = S.played[0];
    set('.n-since', first ? 'since ' + clock(first.at) : '');
    const avg = S.played.length ? S.played.reduce((a, t) => a + t.bpm, 0) / S.played.length : 0;
    set('.n-avg', avg ? avg.toFixed(1) : '--');
  }
  if (q('.n-link') && s) {
    set('.n-link', { LINKED: 'JOINED ' + s.deviceNumber, LISTENING: 'LISTENING', BACKED_OFF: 'BACKED OFF', LISTEN_ONLY: 'LISTEN ONLY', OFFLINE: 'OFFLINE' }[s.link] || s.link);
    set('.n-health', s.problems.length ? s.problems[0].title : 'all good · ' + s.players + ' players');
  }
  if (q('.n-stats')) {
    const n = (L && L.night) || {}, played = S.played, djs = new Set(played.map(t => t.dj).filter(Boolean)).size;
    const peak = n.peakBpm || played.reduce((a, t) => Math.max(a, t.bpm || 0), 0);
    const st = [['TRACKS', played.length], ['DJS', n.djs != null ? n.djs : djs], ['SINCE', played[0] ? clock(played[0].at) : '--'], ['PEAK BPM', peak ? peak.toFixed(1) : '--']];
    if (L && L.set && L.set.dj) st.push(['THIS SET', (L.set.tracks || 0) + (L.set.trend ? ' · ' + L.set.trend : '')]);
    setH('.n-stats', st.map(([k, v]) => `<span><small>${k}</small><b>${esc(String(v))}</b></span>`).join(''));
  }
  if (q('.n-lineup')) {
    const p = S.plan, dj = (s && s.dj) || (p && p.onTheDecks);
    const rows = p && p.lineup && p.lineup.length ? p.lineup.map(x => `<li class="${x.dj === dj ? 'cur' : ''}"><time>${untimed(x) ? 'ALL' : esc(x.start)}</time>${esc(x.dj)}</li>`) : [];
    if (p && p.musicOff) rows.push(`<li class="off"><time>${esc(p.musicOff)}</time>MUSIC OFF</li>`);
    setH('.n-lineup', rows.join('') || '<li class="none">No lineup tonight. STATUS → NIGHTS, or HARD STOP.</li>');
  }
  if (q('.n-box') && s) {
    const a = s.audio, lv = S.audioLv, w = s.wifi || {};
    const quiet = typeof WifiQuiet !== 'undefined' ? WifiQuiet.short(s) : null; // #104 WI-FI QUIET
    const sig = quiet || (L && L.box && L.box.wifi != null ? L.box.wifi + '%' : w.ssid ? 'ON' : w.state === 'hotspot' ? 'HOTSPOT' : 'NONE');
    const snd = !a || !a.card ? 'NO CARD' : lv ? (Math.max(lv.rl, lv.rr) <= -119 ? '--' : Math.max(lv.rl, lv.rr).toFixed(0) + ' dB') : 'ON';
    const st = [['TEMP', s.cpuTempC == null ? '--' : s.cpuTempC.toFixed(0) + '°C', s.cpuTempC >= 75],
      ['WI-FI', sig, w.state === 'hotspot' || !!quiet], ['PLAYERS', String(s.players || 0), !s.players],
      ['SOUND IN', snd, false], ['REC', a && a.recording ? '● ON' : 'OFF', false],
      ['UP', Math.floor(s.uptimeSeconds / 3600) + 'h ' + Math.floor(s.uptimeSeconds % 3600 / 60) + 'm', false]];
    setH('.n-box', st.map(([k, v, warn]) => `<span${warn ? ' class="look"' : ''}><small>${k}</small><b${k === 'REC' && v !== 'OFF' ? ' class="rec"' : ''}>${esc(v)}</b></span>`).join(''));
  }
  if (q('.n-snd') && s) {
    const a = s.audio, lv = S.audioLv;
    const db = lv ? Math.max(lv.rl, lv.rr) : null, pk = lv ? Math.max(lv.pl, lv.pr) : null;
    set('.n-snd', !a || !a.card ? 'NO CARD' : db == null || db <= -119 ? '--' : db.toFixed(0) + ' dB');
    set('.n-snd-s', !a || !a.card ? 'Plug a USB sound card into the box (NETWORK → SOUND IN)'
      : (lv && lv.music ? 'MUSIC' : 'SILENT') + (pk != null && pk > -119 ? ' · PEAK ' + pk.toFixed(0) + ' dB' : '') + (a.recording ? ' · ● REC' : ''));
    const bar = q('.n-snd-bar');
    if (bar) { const pct = db == null ? 0 : Math.max(0, Math.min(100, (db + 60) / 60 * 100)); const v = pct.toFixed(0) + '%'; if (bar.style.width !== v) bar.style.width = v; bar.classList.toggle('hot', pk != null && pk > -1); }
    const cell = q('.n-snd').closest('.cell');
    if (cell) cell.classList.toggle('soon', !!(a && a.card && lv && !lv.music));
  }
  if (q('.n-room')) {
    const rm = s && s.room;
    set('.n-room', rm ? (rm.cal ? '' : '~') + Math.round(rm.db) + ' dB' : '--');
    set('.n-room-s', rm ? 'AVG ' + Math.round(rm.leq) + ' dB' + (rm.over100 ? ' · ' + Math.round(rm.over100 / 60) + ' MIN OVER 100' : '') : 'needs the HARD STOP panel mic');
  }
  if (q('.n-sc')) {
    const c = S.sc;
    const rows = !c ? [] : [
      ['LINK', c.link && c.link.on, c.link && c.link.peers > 0, c.link && c.link.on ? (c.link.peers ? c.link.peers + ' APP' + (c.link.peers === 1 ? '' : 'S') : 'LOOKING') : ''],
      ['MIDI CLOCK', c.midi && c.midi.on, c.midi && c.midi.sending, c.midi && c.midi.on ? (c.midi.problem ? 'PROBLEM' : c.midi.sending ? 'SENDING' : 'WAITING') : ''],
      ...['resolume', 'grandma3', 'qlab'].map(k => { const t = (c.targets || {})[k] || {}; return [k === 'grandma3' ? 'GRANDMA3' : k.toUpperCase(), t.on, t.sending, t.on ? (t.sending ? 'SENDING' : 'WAITING') : '']; }),
    ].filter(r => r[1]);
    setH('.n-sc', !c ? '<span class="none">--</span>' : rows.length
      ? rows.map(([n, , live, txt]) => `<span><i class="sc-dot${live ? ' live' : ''}"></i>${n} <small>${txt}</small></span>`).join('') + (c.bpm ? `<span class="bpm">${c.bpm.toFixed(1)} BPM</span>` : '')
      : '<span class="none">ALL OFF · STATUS → SHOW CONTROL</span>');
  }
}

const BLOCKS = {
  hero: { name: 'Track', html: `<div class="cell wide bare"><div class="hero"><div><div class="who n-deck"></div><div class="big-title n-title"></div><div class="big-artist n-artist"></div></div><img class="n-art" alt=""></div></div>` },
  time: { name: 'Time left', html: `<div class="cell"><small>REMAINING</small><div class="v n-rem"></div><div class="s n-len"></div></div>` },
  bpm: { name: 'BPM', html: `<div class="cell"><small>BPM</small><div class="v n-bpm"></div><div class="s n-pitch"></div></div>` },
  key: { name: 'Key', html: `<div class="cell"><small>KEY</small><div class="v n-key"></div><div class="s n-genre"></div></div>` },
  beats: { name: 'Beat counter', html: `<div class="cell wide"><small>BEAT</small><div class="beats-big"><i class="one"></i><i></i><i></i><i></i></div></div>` },
  phrase: { name: 'Section', html: `<div class="cell wide"><small>SECTION</small><div class="v n-phrase"></div><div class="s n-bar"></div><canvas class="strip"></canvas></div>` },
  countdown: { name: 'Next section', html: `<div class="cell wide countdown n-cd"><small>NEXT SECTION</small><div class="v"><span class="n-next"></span> <span class="n-in"></span></div></div>` },
  drop: { name: 'Next drop', html: `<div class="cell wide countdown drop-big"><small>NEXT DROP</small><div class="v n-drop"></div><div class="s n-drop-s"></div><button type="button" class="n-buzz" onclick="toggleBuzz()"></button></div>` },
  dropbars: { name: 'Bars to the drop', html: `<div class="cell countdown"><small>DROP IN</small><div class="v n-dropbars"></div><div class="s n-dropbars-s"></div></div>` },
  night: { name: 'On now (set time left)', always: true, html: `<div class="cell wide countdown"><small>ON NOW</small><div class="v n-set" style="font-size:28px"></div><div class="s n-set-end" style="color:var(--fg)"></div><div class="s n-off"></div></div>` },
  lineup: { name: 'Lineup', always: true, html: `<div class="cell wide"><small>LINEUP TONIGHT</small><ol class="n-lineup lineup-list"></ol></div>` },
  stats: { name: 'The night in numbers', always: true, html: `<div class="cell wide"><small>TONIGHT <a href="#played" class="cell-link">RECAP →</a></small><div class="n-stats mini-stats"></div></div>` },
  all: { name: 'All decks', html: `<div class="cell wide bare"><small>ALL DECKS</small><div class="n-all all-decks"></div></div>` },
  'next-track': { name: 'Other deck', html: `<div class="cell wide"><small class="n-other-deck"></small><div class="s n-other" style="font-size:18px;color:var(--fg)"></div></div>` },
  health: { name: 'DJ Link health', always: true, html: `<div class="cell"><small>DJ LINK</small><div class="v n-link" style="font-size:28px"></div><div class="s n-health"></div></div>` },
  boxhealth: { name: 'The box (temp, Wi-Fi, sound, REC)', always: true, html: `<div class="cell wide"><small>THE BOX <a href="#status/box" class="cell-link">DETAILS →</a></small><div class="n-box mini-stats"></div></div>` },
  sound: { name: 'Sound in (level, silence)', always: true, html: `<div class="cell wide"><small>SOUND IN <a href="#network/sound" class="cell-link">RECORD →</a></small><div class="v n-snd"></div><div class="snd-bar"><b class="n-snd-bar"></b></div><div class="s n-snd-s"></div></div>` },
  room: { name: 'Room level (dB)', always: true, html: `<div class="cell"><small>ROOM</small><div class="v n-room"></div><div class="s n-room-s"></div></div>` },
  showctl: { name: 'Show control', always: true, html: `<div class="cell wide"><small>SHOW CONTROL <a href="#status/show-control" class="cell-link">SET UP →</a></small><div class="n-sc sc-list"></div></div>` },
  set: { name: 'Tracks + avg BPM', html: `<div class="cell"><small>TRACKS PLAYED</small><div class="v n-count"></div><div class="s n-since"></div></div><div class="cell"><small>AVG BPM</small><div class="v n-avg"></div></div>` },
};

// Each phone can change any role's layout: EDIT -> show/hide and move blocks. Saved on this phone only.
const layoutCache = {};
function layout(r) {
  if (layoutCache[r]) return layoutCache[r].slice();
  let out = ROLES[r].blocks.slice();
  try { const l = JSON.parse(localStorage.getItem('layout:' + r)); if (Array.isArray(l)) out = l.filter(b => BLOCKS[b]); } catch (e) {}
  layoutCache[r] = out;
  return out.slice();
}
function saveLayout(r, l) { try { localStorage.setItem('layout:' + r, JSON.stringify(l)); } catch (e) {} delete layoutCache[r]; nowShape = null; }
let editing = false;
function renderEditor() {
  const l = layout(role);
  const all = l.concat(Object.keys(BLOCKS).filter(b => !l.includes(b)));
  $('nowEdit').innerHTML = all.map(b => `<div class="edit-row"><button data-toggle="${b}" class="${l.includes(b) ? 'on' : ''}">${l.includes(b) ? 'ON' : 'OFF'}</button>` +
    `<span>${BLOCKS[b].name}</span>${l.includes(b) && l.indexOf(b) > 0 ? `<button data-up="${b}">UP</button>` : ''}</div>`).join('') +
    `<div class="edit-row"><button data-reset>RESET ${ROLES[role].label}</button><button data-done>DONE</button></div>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-toggle],[data-up],[data-reset],[data-done],[data-edit]');
  if (!t) return;
  const l = layout(role);
  if (t.dataset.edit !== undefined) editing = !editing;
  else if (t.dataset.toggle) { const b = t.dataset.toggle; saveLayout(role, l.includes(b) ? l.filter(x => x !== b) : l.concat(b)); }
  else if (t.dataset.up) { const k = l.indexOf(t.dataset.up); [l[k - 1], l[k]] = [l[k], l[k - 1]]; saveLayout(role, l); }
  else if (t.dataset.reset !== undefined) { try { localStorage.removeItem('layout:' + role); } catch (x) {} delete layoutCache[role]; nowShape = null; }
  else if (t.dataset.done !== undefined) editing = false;
  $('nowEdit').hidden = !editing;
  if (editing) renderEditor();
});

// ---------- network ----------

function renderNetwork() {
  if ($('network').hidden) return; // showView draws it when NETWORK opens
  const s = S.status;
  if (s) {
    const t = s.djLinkTraffic;
    const names = { 50000: 'ANNOUNCE', 50001: 'BEATS', 50002: 'STATUS' };
    setHTML($('traffic'), t.arriving
      ? Object.entries(t.ports).map(([p, c]) => `<span>${names[p] || p} <b>${c.perSecond.toFixed(1)}</b>/s</span>`).join('')
      : '<span class="none">NO DJ LINK DATA ARRIVING</span>');
  }
  const ours = s && s.deviceNumber;
  setHTML($('devices'), S.devices.map(d => {
    const self = d.kind === 'GHOSTLINK';
    const clash = !self && ours && d.number === ours;
    return `<tr class="${self ? 'self' : ''}${clash ? ' clash' : ''}"><td>${d.number}</td><td>${esc(self ? 'GHOST LINK (this box)' : d.name)}</td>` +
      `<td>${d.kind.toLowerCase()}</td><td>${esc(d.address)}</td></tr>`;
  }).join('') || '<tr><td colspan="4" class="empty-note">Nothing heard yet.</td></tr>');
}

function renderEvents() {
  if ($('network').hidden) return; // 200 rows: only while NETWORK is on screen
  $('events').innerHTML = S.events.slice(-200).reverse()
    .map(e => `<li class="${e.level}"><time>${clockSec(e.at)}</time><span>${esc(e.text)}</span></li>`).join('');
}

// ---------- played ----------

let viewNight = null, pastTracks = [];

function playedList() { return viewNight ? pastTracks : S.played; }

function renderPlayed() {
  if ($('played').hidden) return; // list + charts redraw when PLAYED opens (showView)
  const night = viewNight || (S.status && S.status.night) || '';
  const q = viewNight ? '&night=' + viewNight : '';
  $('csvLink').href = '/api/history?format=csv' + q;
  $('m3uLink').href = '/api/history?format=m3u8' + q;
  $('jsonLink').href = '/api/history' + (viewNight ? '?night=' + viewNight : '');
  $('jsonLink').download = 'played-' + night + '.json';
  const list = playedList();
  $('djNow').textContent = (S.status && S.status.dj) || 'not set';
  renderSetHint();
  $('djForm').hidden = !!viewNight;
  // Newest first, with a heading wherever the DJ changes (only once a lineup is in use).
  const lineup = list.some(t => t.dj);
  let lastDj;
  $('playedList').innerHTML = list.slice().reverse().map(t => {
    const head = lineup && t.dj !== lastDj ? `<li class="dj-sep">${esc(t.dj || 'NO DJ SET')}</li>` : '';
    lastDj = t.dj;
    return head + `<li><time>${clock(t.at)}</time><span class="deckno">${t.player}</span>` +
      `<span class="what">${esc(t.title)} <span>${esc(t.artist)}</span></span><span class="bpm">${t.bpm.toFixed(1)}</span></li>`;
  }).join('') || `<li class="empty-note">${viewNight ? 'Nothing logged that night.' : 'Nothing on air yet tonight.'}</li>`;
  const r = recapOf(list);
  $('recap').innerHTML = r ? [
    ['TRACKS', r.count], ['SET', r.span], ['BPM', r.bpmRange], ['AVG BPM', r.avg], ['MOST PLAYED', r.topArtist || '--'],
    ...(lineup ? [['DJS', new Set(list.map(t => t.dj).filter(Boolean)).size]] : []),
  ].map(([k, v]) => `<div><small>${k}</small><b>${esc(String(v))}</b></div>`).join('') : '';
  drawBpmChart($('bpmChart'), list);
  drawSetLine($('setLine'), list);
}

/** The night as a strip: one block per track (until the next one went on air), DJs as labelled bands on top. */
function drawSetLine(c, list) {
  c.hidden = list.length < 2;
  if (c.hidden) return;
  const [g, W, H, r] = fit(c);
  g.clearRect(0, 0, W, H);
  const t0 = list[0].at, t1 = Math.max(list[list.length - 1].at + 4 * 60000, viewNight ? 0 : Date.now() - (S.skew || 0));
  const x = t => Math.round((t - t0) / (t1 - t0) * W);
  const top = 26 * r, h = H - top - 18 * r;
  g.font = `${11 * r}px "JetBrains Mono", monospace`;
  g.textBaseline = 'top';
  // DJ bands
  let start = 0;
  for (let i = 1; i <= list.length; i++) {
    if (i === list.length || list[i].dj !== list[start].dj) {
      const x0 = x(list[start].at), x1 = i === list.length ? x(t1) : x(list[i].at);
      g.fillStyle = '#222'; g.fillRect(x0, 0, Math.max(1, x1 - x0 - 2 * r), 18 * r);
      g.fillStyle = '#9a9a9a';
      if (x1 - x0 > 40 * r) g.fillText((list[start].dj || '').slice(0, Math.floor((x1 - x0) / (7 * r))), x0 + 4 * r, 3 * r);
      start = i;
    }
  }
  // Tracks: alternating greys, deck number inside when there's room
  list.forEach((t, i) => {
    const x0 = x(t.at), x1 = i + 1 < list.length ? x(list[i + 1].at) : x(t1);
    g.fillStyle = i % 2 ? '#5a5a5a' : '#cfcfcf';
    g.fillRect(x0, top, Math.max(1, x1 - x0 - r), h);
    if (x1 - x0 > 14 * r) { g.fillStyle = '#000'; g.fillText(String(t.player), x0 + 3 * r, top + 3 * r); }
  });
  g.fillStyle = '#9a9a9a';
  g.fillText(clock(t0), 0, H - 14 * r);
  const end = clock(t1), w = g.measureText(end).width;
  g.fillText(end, W - w, H - 14 * r);
}

/** The night as text to paste anywhere: time, artist - title, grouped by DJ. */
function setlistText(list) {
  const night = viewNight || (S.status && S.status.night) || '';
  const v = S.status && S.status.venue;
  const out = ['GHOST LINK setlist · ' + nightLabel(night) + (v && v.name ? ' · ' + v.name : ''), ''];
  let dj;
  list.forEach(t => {
    if (t.dj !== dj && list.some(x => x.dj)) { if (out.length > 2) out.push(''); out.push((t.dj || 'NO DJ SET').toUpperCase()); dj = t.dj; }
    out.push(clock(t.at) + '  ' + (t.artist ? t.artist + ' - ' : '') + t.title);
  });
  return out.join('\n');
}
/**
 * For posting a recorded mix (Mixcloud, 1001Tracklists, SoundCloud description): each track's time from the start of
 * its DJ's set, "00:00 Artist - Title", one block per DJ.
 */
function tracklistText(list) {
  const out = [];
  let dj = null, t0 = 0;
  const ts = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
  list.forEach((t, i) => {
    if (i === 0 || (t.dj !== dj && list.some(x => x.dj))) {
      if (out.length) out.push('');
      if (list.some(x => x.dj)) out.push((t.dj || 'NO DJ SET').toUpperCase());
      dj = t.dj; t0 = t.at;
    }
    out.push(ts(t.at - t0) + ' ' + (t.artist ? t.artist + ' - ' : '') + t.title);
  });
  return out.join('\n');
}
$('tracklistBtn').addEventListener('click', async () => {
  const text = tracklistText(playedList());
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  $('tracklistBtn').textContent = 'COPIED';
  setTimeout(() => { $('tracklistBtn').textContent = 'COPY TRACKLIST'; }, 1500);
});
$('setlistBtn').addEventListener('click', async () => {
  const text = setlistText(playedList());
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  $('setlistBtn').textContent = 'COPIED';
  setTimeout(() => { $('setlistBtn').textContent = 'COPY SETLIST'; }, 1500);
});

function recapOf(list) {
  if (!list.length) return null;
  const bpms = list.map(t => t.bpm).filter(b => b > 0);
  const first = list[0].at, last = list[list.length - 1].at;
  const mins = Math.round((last - first) / 60000);
  const counts = {};
  list.forEach(t => { if (t.artist) counts[t.artist] = (counts[t.artist] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return {
    count: list.length,
    span: Math.floor(mins / 60) + 'h ' + String(mins % 60).padStart(2, '0') + 'm',
    from: clock(first), to: clock(last),
    bpmRange: bpms.length ? Math.round(Math.min(...bpms)) + '-' + Math.round(Math.max(...bpms)) : '--',
    avg: bpms.length ? (bpms.reduce((a, b) => a + b, 0) / bpms.length).toFixed(1) : '--',
    topArtist: top && top[1] > 1 ? top[0] + ' x' + top[1] : null,
  };
}

/** BPM across the night: one dot per track, joined. White on black; the line is the data. */
function drawBpmChart(c, list, opts = {}) {
  const pts = list.filter(t => t.bpm > 0);
  if (!opts.ctx) c.style.display = pts.length < 2 ? 'none' : ''; // visible before measuring
  if (pts.length < 2) return;
  const [g, W, H, r] = opts.ctx ? [opts.ctx, opts.W, opts.H, opts.r] : fit(c);
  if (!opts.ctx) g.clearRect(0, 0, W, H);
  const t0 = pts[0].at, t1 = pts[pts.length - 1].at;
  let lo = Math.min(...pts.map(t => t.bpm)), hi = Math.max(...pts.map(t => t.bpm));
  if (hi - lo < 4) { lo -= 2; hi += 2; }
  const pad = 6 * r, x = t => pad + (t.at - t0) / Math.max(1, t1 - t0) * (W - 2 * pad), y = t => H - pad - (t.bpm - lo) / (hi - lo) * (H - 2 * pad - 14 * r);
  g.strokeStyle = '#fff'; g.lineWidth = 1.5 * r; g.beginPath();
  pts.forEach((t, i) => i ? g.lineTo(x(t), y(t)) : g.moveTo(x(t), y(t)));
  g.stroke();
  g.fillStyle = '#fff';
  pts.forEach(t => g.fillRect(x(t) - 2 * r, y(t) - 2 * r, 4 * r, 4 * r));
  g.fillStyle = '#9a9a9a'; g.font = `${11 * r}px "JetBrains Mono", monospace`;
  g.fillText(Math.round(hi) + ' BPM', pad, 11 * r);
  g.fillText(Math.round(lo), pad, H - 1 * r);
}

async function loadNights() {
  try {
    const nights = await (await fetch('/api/nights')).json();
    const tonight = S.status && S.status.night;
    const opts = [tonight].concat(nights.filter(n => n !== tonight)).filter(Boolean);
    $('nightPick').innerHTML = opts.map(n => `<option value="${esc(n)}">${n === tonight ? 'TONIGHT · ' : ''}NIGHT OF ${esc(n)}</option>`).join('')
      || '<option value="">TONIGHT</option>';
    $('nightPick').value = viewNight || tonight || '';
    if ($('nightPick').selectedIndex < 0) $('nightPick').selectedIndex = 0;
  } catch (e) {}
}
$('nightPick').addEventListener('change', async () => {
  const n = $('nightPick').value;
  viewNight = n === (S.status && S.status.night) ? null : n;
  if (viewNight) pastTracks = (await (await fetch('/api/history?night=' + encodeURIComponent(n))).json()).tracks;
  renderPlayed();
});

/** A 1080x1350 card for posting: ghost, night, numbers, BPM line, the tracks. */
$('recapBtn').addEventListener('click', () => {
  const list = playedList(), r = recapOf(list);
  if (!r) return;
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.textBaseline = 'top';
  g.font = '600 22px "JetBrains Mono", monospace';
  GHOSTS.linked.forEach((l, i) => g.fillText(l, 72, 72 + i * 22));
  g.font = '600 40px "JetBrains Mono", monospace';
  g.fillText('GHOST LINK', 220, 92);
  g.fillStyle = '#9a9a9a'; g.font = '28px "JetBrains Mono", monospace';
  const venue = list.map(t => t.venue).filter(Boolean).pop();
  g.fillText((venue ? venue.toUpperCase() + ' · ' : '') + 'NIGHT OF ' + (viewNight || S.status.night), 220, 146);
  const stats = [['TRACKS', r.count], ['SET', r.span], ['BPM', r.bpmRange], ['AVG', r.avg]];
  stats.forEach(([k, v], i) => {
    const x = 72 + i * 240;
    g.fillStyle = '#9a9a9a'; g.font = '22px "JetBrains Mono", monospace'; g.fillText(k, x, 250);
    g.fillStyle = '#fff'; g.font = '600 52px "JetBrains Mono", monospace'; g.fillText(String(v), x, 282);
  });
  g.save(); g.translate(72, 380);
  drawBpmChart(null, list, { ctx: g, W: W - 144, H: 220, r: 2 });
  g.restore();
  g.font = '26px "JetBrains Mono", monospace';
  const rows = Math.min(list.length, 17);
  for (let i = 0; i < rows; i++) {
    const t = list[i], y = 650 + i * 36;
    g.fillStyle = '#9a9a9a'; g.fillText(clock(t.at), 72, y);
    g.fillStyle = '#fff';
    let line = (t.artist ? t.artist + ' - ' : '') + t.title;
    while (g.measureText(line).width > W - 260 && line.length > 4) line = line.slice(0, -2);
    g.fillText(line, 220, y);
  }
  if (list.length > rows) { g.fillStyle = '#9a9a9a'; g.fillText('+ ' + (list.length - rows) + ' more', 220, 650 + rows * 36); }
  g.fillStyle = '#555'; g.font = '20px "JetBrains Mono", monospace';
  g.fillText('made with <3 in Boston, MA by Third Polar Arch', 72, H - 72);
  c.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'ghostlink-recap-' + (viewNight || S.status.night) + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
});

// ---------- status ----------

function renderStatus() {
  const s = S.status;
  if (!s) return;
  renderControls(s);
  setHTML($('problems'), s.problems.map(p => `<li><b>${esc(p.title)}</b>${esc(p.fix)}</li>`).join(''));
  if ($('status').hidden) return; // the rest only matters on screen; showView calls this when STATUS opens
  renderBoothCheck(s);
  const gc = (s.gearCare || []).slice();
  const rm = s.room;
  if (rm) gc.unshift({ title: 'ROOM ' + (rm.cal ? '' : '~') + Math.round(rm.db) + ' dB · AVG ' + Math.round(rm.leq) + ' dB',
    fix: (rm.over100 ? Math.round(rm.over100 / 60) + ' min over 100 dB tonight. ' : '') + "HARD STOP's mic at the booth" + (rm.cal ? '.' : ', not calibrated: like a phone meter.') });
  $('gearCare').hidden = !gc.length;
  setHTML($('gearList'), gc.map(p => `<li><b>${esc(p.title)}</b> ${esc(p.fix || p.detail || '')}</li>`).join(''));
  const up = s.uptimeSeconds;
  const facts = [
    ['LINK', { LINKED: 'joined as device ' + s.deviceNumber, LISTENING: 'listening', BACKED_OFF: 'backed off', LISTEN_ONLY: 'listen only', OFFLINE: 'not joined' }[s.link]],
    ['DJ CABLE', s.cable == null ? 'unknown' : s.cable ? 'connected' + (s.djAddress ? ' · ' + s.djAddress : ' · no address') : 'unplugged'],
    ['DJ LINK DATA', s.djLinkTraffic.arriving ? 'arriving' : 'none'],
    ['PLAYERS', s.players],
    ['WI-FI', (s.wifiQuiet ? s.wifiQuiet.words + ' · ' : '') + (s.wifi && s.wifi.ssid ? s.wifi.ssid + (s.wifi.ip ? ' · ' + s.wifi.ip : '') : 'not connected')],
    ['UPTIME', Math.floor(up / 3600) + 'h ' + Math.floor(up % 3600 / 60) + 'm'],
    ['CPU TEMP', s.cpuTempC == null ? '--' : s.cpuTempC.toFixed(0) + '°C'],
    ['VENUE', s.venue ? s.venue.name : 'none set'],
    ['SOURCE', s.source],
  ];
  setHTML($('facts'), facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join(''));
  if (s.wifi && s.wifi.mode && S.wifiMode === s.wifi.mode) S.wifiMode = null; // watcher caught up
  renderWifi();
}

// ---------- nights planned ahead ----------
let nights = [];
async function loadNightsPlan() {
  try { nights = await (await fetch('/api/schedule')).json(); } catch (e) {}
  renderNightsPlan();
}
const venueName = id => ((venues.venues || []).find(v => v.id === id) || {}).name || '';
function renderNightsPlan() {
  const tonight = (S.status && S.status.night) || '';
  const upcoming = nights.filter(n => !tonight || n.date >= tonight);
  $('nightsList').innerHTML = upcoming.map(n => `<div class="n"><b>${esc(nightLabel(n.date))}${n.date === tonight ? ' · TONIGHT' : ''}</b>` +
    `<div>${esc(venueName(n.venue) || 'no venue')}</div>` +
    `<div class="slots">${n.doors ? esc(n.doors) + '  STARTS\n' : ''}${n.lineup.map(s => esc((untimed(s) ? 'ALL NIGHT  ' : s.start + '  ') + s.dj)).join('\n')}${n.musicOff ? '\n' + esc(n.musicOff) + '  MUSIC OFF' : ''}${n.notes ? '\n' + esc(n.notes) : ''}</div>` +
    `<div class="row"><button type="button" data-night="${esc(n.date)}">EDIT</button></div></div>`).join('') ||
    '<div class="note">Nothing planned. Plan a night to have the venue and lineup switch by themselves.</div>';
  $('nightsList').querySelectorAll('[data-night]').forEach(b => b.onclick = () => openNightForm(nights.find(n => n.date === b.dataset.night)));
  renderPlanNow();
}
/** PLAYED: tonight's lineup with whoever is on the decks in bold (cheap; runs on every status). */
function renderPlanNow() {
  const tonight = (S.status && S.status.night) || '';
  const plan = nights.find(n => n.date === tonight);
  const dj = S.status && S.status.dj;
  const slot = s => (untimed(s) ? '' : s.start + ' ') + s.dj;
  let h = plan && plan.lineup.length ? 'LINEUP · ' + plan.lineup.map(s =>
    s.dj === dj ? `<b>${esc(slot(s))}</b>` : esc(slot(s))).join(' · ') : '';
  const hs = S.status && S.status.hardstopAt;
  if (hs) h += (plan && plan.lineup.length ? '<br>' : '') + 'TIMES FROM HARD STOP · ' + clock(hs);
  const vm = S.status && S.status.venueMusic;
  if (vm && vm.notes) h += (h ? '<br>' : '') + 'THIS ROOM · ' + esc(vm.notes);
  setHTML($('planNow'), h);
}
/** Tonight's plan against the box clock: who's on, when their set ends, who's next, and music off. */
function nightNow() {
  const tonight = S.status && S.status.night;
  const plan = tonight && nights.find(n => n.date === tonight);
  if (!plan) return null;
  const at = hhmm => { const [h, m] = hhmm.split(':').map(Number); const t = new Date(tonight + 'T00:00:00'); t.setHours(h, m, 0, 0); if (h < 12) t.setDate(t.getDate() + 1); return t.getTime(); };
  const now = Date.now() - (S.skew || 0);
  // A line with no time is on from the start of the night (noon) until the first timed slot.
  const slots = plan.lineup.map(s => ({ dj: s.dj, at: at(s.start), start: s.start }));
  let cur = -1;
  slots.forEach((s, i) => { if (s.at <= now) cur = i; });
  return {
    dj: (S.status && S.status.dj) || (cur >= 0 ? slots[cur].dj : null),
    next: slots[cur + 1] || null,
    off: plan.musicOff ? { at: at(plan.musicOff), label: plan.musicOff } : null,
    now,
  };
}
const inMin = ms => { const m = Math.max(0, Math.round(ms / 60000)); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };

/** A lineup line typed without a time is stored as 12:00, the start of the night: "all night" on screen. */
const untimed = s => !s.start || s.start === '12:00';
function nightLabel(d) {
  const t = new Date(d + 'T12:00:00');
  return isNaN(t) ? d : t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}
function openNightForm(n) {
  if (!unlocked) return needUnlock();
  $('nVenue').innerHTML = '<option value="">(no venue)</option>' +
    (venues.venues || []).map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');
  $('nDate').value = n ? n.date : ((S.status && S.status.night) || '');
  $('nDate').disabled = !!n;
  $('nVenue').value = n ? n.venue || '' : venues.current || '';
  $('nLineup').value = n ? n.lineup.map(s => (untimed(s) ? '' : s.start + ' ') + s.dj).join('\n') : '';
  note('nightNote', '');
  $('nNotes').value = n ? n.notes || '' : '';
  $('nOff').value = n ? n.musicOff || '' : '';
  $('nDoors').value = n ? n.doors || '' : '';
  $('nightDelBtn').hidden = !n;
  $('nightForm').hidden = false;
}
$('nightNewBtn').addEventListener('click', () => openNightForm(null));
$('nightCancel').addEventListener('click', () => { $('nightForm').hidden = true; });
$('nightForm').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await post('/api/schedule', { date: $('nDate').value, venue: $('nVenue').value, lineup: $('nLineup').value, notes: $('nNotes').value, musicOff: $('nOff').value, doors: $('nDoors').value });
  if (r.ok) { nights = await r.json(); $('nightForm').hidden = true; renderNightsPlan(); }
  else if (r.status === 400) note('nightNote', (await r.json()).error, true);
  else if (r.status !== 401) note('nightNote', "Didn't save (" + r.status + '). Try again.', true);
});
$('nightDelBtn').addEventListener('click', async () => {
  if (!confirm('Delete this planned night?')) return;
  const r = await post('/api/schedule/delete', { date: $('nDate').value });
  if (r.ok) { nights = await r.json(); $('nightForm').hidden = true; renderNightsPlan(); }
});
loadNightsPlan();

// ---------- mixer over USB MIDI (listen only) ----------
let mixerTimer;
async function loadMixer() {
  clearTimeout(mixerTimer);
  if ($('network').hidden) return;
  let m = {};
  try { m = await (await fetch('/api/mixer')).json(); } catch (e) {}
  if (!m.device) {
    note('mixerNote', 'No mixer cable. Optional: a USB cable from the DJM\'s USB port to the box (with the venue\'s OK) shows FX, filters and buttons live, and warns when an FX is left on into the next track.');
    $('mixer').innerHTML = '';
  } else {
    note('mixerNote', m.device + ' · touch a knob or button and it appears here. Name it once; WATCH it to get FX LEFT ON warnings. GHOST LINK only listens.');
    $('mixer').innerHTML = (m.controls || []).slice(0, 40).map(c =>
      `<div class="mc${c.value === c.rest ? ' off' : ''}${c.watch ? ' watch' : ''}"><span><b>${esc(c.name || c.key)}</b>` +
      `${c.name ? ' <span class="k">' + esc(c.key) + '</span>' : ''}</span><span class="bar"><i style="width:${Math.round(c.value / 127 * 100)}%"></i></span>` +
      `<button type="button" data-mkey="${esc(c.key)}" data-mname="${esc(c.name || '')}" data-mval="${c.value}">NAME</button></div>`).join('') ||
      '<div class="note">Nothing moved yet.</div>';
    $('mixer').querySelectorAll('[data-mkey]').forEach(b => b.onclick = () => nameControl(b.dataset.mkey, b.dataset.mname, +b.dataset.mval));
  }
  mixerTimer = setTimeout(loadMixer, 700);
}
async function nameControl(key, current, value) {
  if (!unlocked) { pending = null; return needUnlock(); }
  const name = prompt('Name for ' + key + ' (blank to forget). Put it back to its normal position first; that is its rest value.', current);
  if (name === null) return;
  const watch = name ? confirm('Warn when "' + name + '" is still on into the next track (FX LEFT ON)?') : false;
  await post('/api/mixer/name', { key, name, rest: value, watch });
  loadMixer();
}

// ---------- rooms: other GHOST LINK boxes, live, on NOW ----------
let rooms = { self: '', others: [] };
const roomInfo = {};
async function loadRooms() {
  try { rooms = await (await fetch('/api/rooms')).json(); } catch (e) { return; }
  $('roomSelf').value = rooms.self || '';
  $('roomOthers').value = rooms.others.map(r => r.name + ' = ' + r.address).join('\n');
  renderRooms();
}
async function pollRooms() {
  await Promise.all(rooms.others.map(async r => {
    try {
      const [s, d] = await Promise.all(['status', 'decks'].map(k =>
        fetch('http://' + r.address + '/api/' + k, { signal: AbortSignal.timeout(2500) }).then(x => x.json())));
      roomInfo[r.address] = { ok: true, s, d };
    } catch (e) { roomInfo[r.address] = { ok: false }; }
  }));
  renderRooms();
}
function roomLine(d) {
  const air = (d || []).filter(x => x.load === 'LOADED' && x.onAir && x.playing);
  const t = air.find(x => x.master) || air[0];
  return t ? `<span class="air">ON AIR</span> ${esc(t.title || '')} · ${t.effectiveBpm ? t.effectiveBpm.toFixed(0) : '--'}` : '<span class="off">quiet</span>';
}
function renderRooms() {
  const strip = $('roomsStrip');
  strip.hidden = !rooms.others.length;
  if (!rooms.others.length) return;
  const here = `<span class="here"><b>${esc(rooms.self || 'HERE')}</b> ${roomLine(Object.values(S.decks))}</span>`;
  strip.innerHTML = here + rooms.others.map(r => {
    const i = roomInfo[r.address];
    return `<a href="http://${esc(r.address)}/#now"><b>${esc(r.name)}</b> ${!i ? '…' : i.ok ? roomLine(i.d) : '<span class="off">can\'t reach</span>'}</a>`;
  }).join('');
}
$('roomsForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!unlocked) { pending = null; return needUnlock(); }
  const others = $('roomOthers').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.split('=');
    return m.length > 1 ? { name: m[0].trim(), address: m.slice(1).join('=').trim() } : { name: '', address: l };
  });
  const r = await post('/api/rooms', { self: $('roomSelf').value, others });
  if (r.ok) { rooms = await r.json(); note('roomsNote', 'Saved.'); loadRooms(); pollRooms(); }
  else if (r.status === 400) note('roomsNote', (await r.json()).error, true);
});
loadRooms().then(pollRooms);
setInterval(() => { if (rooms.others.length) pollRooms(); }, 3000);

// ---------- TEST RUN: a checklist that ticks itself as things happen (kept on this phone) ----------
const TESTS = [
  ['players', 'Players found on the DJ network'],
  ['joined', 'GHOST LINK joined (device 7-15)'],
  ['title', 'Track title + artist on a deck'],
  ['art', 'Artwork'],
  ['wave', 'Waveform'],
  ['beat', 'Beat counter flashing'],
  ['onair', 'ON AIR from the mixer'],
  ['handover', 'MASTER moved between decks'],
  ['played', 'Played Tonight logged a track'],
  ['tags', 'SYNC, LOOP or CUED tag'],
  ['mix', 'MIX hint on a cued deck'],
  ['lineup', 'DJ set in PLAYED → ON THE DECKS'],
  ['listen', 'LISTEN ONLY, then REJOIN'],
  ['cable', 'Cable out, then back (players return)'],
  ['usb', 'USB pulled under a playing track (alert)'],
  ['phrases', 'Song sections (CDJ-3000s; not on the XZ)'],
];
let testRun = (() => { try { return JSON.parse(localStorage.getItem('testRun') || '{}'); } catch (e) { return {}; } })();
let testPrev = {};
function testMark(k) {
  if (testRun[k]) return;
  testRun[k] = Date.now();
  try { localStorage.setItem('testRun', JSON.stringify(testRun)); } catch (e) {}
  renderTests();
}
function testWatch(type, data) {
  if (type === 'devices' || type === 'hello') {
    const n = (type === 'hello' ? data.devices : data).filter(d => d.kind === 'PLAYER').length;
    if (n) testMark('players');
    if (testPrev.players > 0 && n === 0) testPrev.cableOut = true;
    if (testPrev.cableOut && n > 0) testMark('cable');
    testPrev.players = n;
  }
  const st = type === 'status' ? data : type === 'hello' ? data.status : null;
  if (st) {
    if (st.link === 'LINKED') { testMark('joined'); if (testPrev.listen) testMark('listen'); }
    if (st.link === 'LISTEN_ONLY') testPrev.listen = true;
    if (st.dj) testMark('lineup');
    if ((st.alerts || []).some(a => a.kind === 'media')) testMark('usb');
  }
  const decks = type === 'deck' ? [data] : type === 'hello' ? data.decks : [];
  decks.forEach(d => {
    if (d.load !== 'LOADED') return;
    if (d.title) testMark('title');
    if (d.hasArtwork) testMark('art');
    if (d.onAir && d.playing) testMark('onair');
    const i = d.info || {};
    if (i.synced || i.looping || i.cued) testMark('tags');
    if (d.master) { if (testPrev.master && testPrev.master !== d.player) testMark('handover'); testPrev.master = d.player; }
    if (mixHint(d)) testMark('mix');
  });
  if (type === 'waveform' || (type === 'hello' && Object.keys(data.waveforms || {}).length)) testMark('wave');
  if (type === 'beat') testMark('beat');
  if (type === 'played') testMark('played');
  if (type === 'structure' && data.structure && data.structure.phrases && data.structure.phrases.length) testMark('phrases');
}
function renderTests() {
  const done = TESTS.filter(([k]) => testRun[k]).length;
  $('testCount').textContent = done + ' / ' + TESTS.length;
  $('testList').innerHTML = TESTS.map(([k, label]) =>
    `<li class="${testRun[k] ? 'ok' : ''}"><span>${testRun[k] ? '✓' : '·'}</span>${esc(label)}${testRun[k] ? ' <time>' + clockSec(testRun[k] - (S.skew || 0)) + '</time>' : ''}</li>`).join('');
}
$('testReset').addEventListener('click', () => { testRun = {}; testPrev = {}; try { localStorage.removeItem('testRun'); } catch (e) {} renderTests(); });
renderTests();

// ---------- song ID for the crowd ----------
function renderSongId() {
  const on = !!(S.status && S.status.songId);
  $('songIdBtn').textContent = on ? 'TURN OFF' : 'TURN ON';
  $('songIdBtn').classList.toggle('on', on);
  $('songIdQr').hidden = !on;
  if (on) {
    const url = shareAddress() + 'song.html';
    if ($('songIdQr').dataset.u !== url) { $('songIdQr').dataset.u = url; $('songIdQr').src = '/api/qr.svg?text=' + encodeURIComponent(url); }
  }
}
$('songIdBtn').addEventListener('click', async () => {
  if (!unlocked) { pending = null; return needUnlock(); }
  await post('/api/songid', { on: !(S.status && S.status.songId) });
});

// ---------- DECK CONTROLS (GHOST DECK: the box tells real decks to stop / play / load) ----------
// Tap arms a button, then hold it 1 s. Nothing fires from a single tap or a stray click.
function holdable(btn, fire) {
  btn.dataset.label = btn.textContent;
  let armed = false, fired = false, timer = null, disarmAt = null;
  const disarm = () => { armed = false; clearTimeout(timer); clearTimeout(disarmAt); btn.classList.remove('armed', 'holding'); btn.textContent = btn.dataset.label; };
  btn.addEventListener('click', () => {
    if (fired) { fired = false; return; }
    if (armed || btn.disabled) return;
    armed = true; btn.classList.add('armed'); btn.textContent = 'HOLD · ' + btn.dataset.label;
    disarmAt = setTimeout(() => { if (!btn.classList.contains('holding')) disarm(); }, 5000);
  });
  btn.addEventListener('pointerdown', () => {
    if (!armed) return;
    btn.classList.add('holding');
    timer = setTimeout(() => { fired = true; disarm(); fire(); }, 1000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, () => {
    if (btn.classList.contains('holding')) { clearTimeout(timer); btn.classList.remove('holding'); }
  }));
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
let gdPick = null, gdPlaySig = '', gdSrcSig = '', gdTargetSig = '';
async function gdSend(cmd, body) {
  if (!unlocked) { pending = null; return needUnlock(); }
  $('gdAsk').hidden = true;
  const r = await post('/api/ghostdeck/' + cmd, body || {});
  const j = await r.json().catch(() => ({}));
  if (r.status === 409 && j.ask) {
    $('gdAskText').textContent = j.text;
    $('gdAsk').hidden = false;
    $('gdAskYes').onclick = () => gdSend(cmd, Object.assign({}, body, { over: true, replace: true }));
    return;
  }
  note('gdNote', j.text || j.error || (r.ok ? 'Sent.' : 'Not sent.'), !r.ok);
}
$('gdAskNo').addEventListener('click', () => { $('gdAsk').hidden = true; note('gdNote', 'Cancelled.'); });
$('gdToggle').addEventListener('click', async () => {
  if (!unlocked) { pending = null; return needUnlock(); }
  const r = await post('/api/ghostdeck', { on: !(S.status && S.status.ghostDeck) });
  if (r.status === 403) note('gdNote', "Turning DECK CONTROLS on or off needs the owner's password, not tonight's crew code.", true);
});
holdable($('gdStop'), () => gdSend('stop'));
holdable($('gdLoad'), () => {
  const src = $('gdSrc').value.split(':');
  if (!gdPick || src.length < 2) return note('gdNote', 'Find a track and tap it first.', true);
  gdSend('load', { target: +$('gdTarget').value, source: +src[0], slot: src[1], id: gdPick.id, title: gdPick.title });
});
async function gdFind() {
  const src = $('gdSrc').value.split(':'), q = $('gdQ').value.trim();
  if (src.length < 2) return note('gdNote', 'No USB or SD in any deck yet.', true);
  if (!q) return note('gdNote', 'Type part of a title or artist.', true);
  if (!unlocked) { pending = null; return needUnlock(); }
  note('gdNote', 'Searching…');
  const r = await fetch('/api/ghostdeck/search?player=' + src[0] + '&slot=' + src[1] + '&q=' + encodeURIComponent(q));
  if (r.status === 401) { setUnlocked(false); return needUnlock(); }
  const l = await r.json().catch(() => []);
  gdPick = null;
  $('gdResults').innerHTML = l.map((t, i) => `<li data-i="${i}">${esc(t.title)}${t.artist ? '<small>' + esc(t.artist) + '</small>' : ''}</li>`).join('');
  $('gdResults').querySelectorAll('li').forEach(li => li.addEventListener('click', () => {
    gdPick = l[+li.dataset.i];
    $('gdResults').querySelectorAll('li').forEach(x => x.classList.toggle('sel', x === li));
    note('gdNote', 'Picked "' + gdPick.title + '". Choose the deck, then LOAD (tap, hold).');
  }));
  note('gdNote', l.length ? l.length + (l.length === 1 ? ' track' : ' tracks') + '. Tap one.' : 'Nothing found on that ' + (src[1] === 'SD_SLOT' ? 'SD' : 'USB') + '.', !l.length);
}
$('gdFind').addEventListener('click', gdFind);
$('gdQ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); gdFind(); } });
// AUTO-STOP AT MUSIC OFF + HARD STOP may stop it + the countdown bar on every view.
holdable($('gdArm'), () => gdSend('autostop', { on: true }));
$('gdDisarm').addEventListener('click', () => gdSend('autostop', { on: false }));
$('curfewCancel').addEventListener('click', () => gdSend('autostop', { on: false }));
$('gdHsMay').addEventListener('click', async () => {
  if (!unlocked) { pending = null; return needUnlock(); }
  const a = (S.status && S.status.autoStop) || {};
  const r = await post('/api/ghostdeck/autostop-hardstop', { on: !a.hardstopMayStop });
  if (r.status === 403) note('gdNote', "That needs the owner's password, not tonight's crew code.", true);
});
function renderCurfew() {
  const a = (S.status && S.status.autoStop) || {}, gd = !!(S.status && S.status.ghostDeck);
  const now = Date.now() - (S.skew || 0);
  $('gdCurfewText').textContent = !a.label ? 'Tonight has no MUSIC OFF time. Add one under NIGHTS (PLAN A NIGHT), or in HARD STOP.'
    : a.firedAt ? 'Stopped the decks at ' + a.label + '.'
    : a.armed ? 'ARMED · every deck stops at ' + a.label + ' (in ' + mmss(a.at - now) + '). Phones warn at 10, 5 and 1 min.'
    : 'Off tonight. MUSIC OFF is ' + a.label + '. ARM to stop every deck then (resets tomorrow).';
  $('gdArm').hidden = !!a.armed || !a.label || !!a.firedAt;
  $('gdDisarm').hidden = !a.armed || !!a.firedAt;
  $('gdHsMay').textContent = 'HARD STOP CAN STOP IT: ' + (a.hardstopMayStop ? 'ON' : 'OFF');
  $('gdHsMay').classList.toggle('on', !!a.hardstopMayStop);
  const left = a.at - now, show = gd && a.armed && a.at && ((left <= 10 * 60000 && left > -120000) || (a.firedAt && now - a.firedAt < 120000));
  $('curfewBar').hidden = !show;
  if (show) $('curfewText').textContent = a.firedAt ? 'AUTO-STOP · decks stopped at ' + a.label : 'MUSIC STOPS AT ' + a.label + ' · ' + mmss(left) + ' · AUTO-STOP';
  $('curfewCancel').hidden = !!a.firedAt;
}
setInterval(() => { if (S.status && S.status.autoStop && S.status.autoStop.armed) renderCurfew(); }, 1000);

// HOUSE SETTINGS: our club standard, editable, sent to stopped decks.
let houseFields = null;
async function loadHouse() {
  if (!unlocked) return;
  const r = await fetch('/api/ghostdeck/house');
  if (!r.ok) return;
  houseFields = (await r.json()).fields || [];
  const nice = v => v.replace('PLUS_MINUS_', '±').replace('MINUS_', '-').replace(/_/g, ' ') + (v.startsWith('MINUS_') ? ' dB' : '') + (v.startsWith('PLUS_MINUS_') ? '%' : '');
  $('gdHouseList').innerHTML = houseFields.map(f => `<label for="hs_${f.field}">${esc(f.label)}</label><select id="hs_${f.field}" data-field="${f.field}">` +
    f.choices.map(c => `<option value="${c}"${c === f.value ? ' selected' : ''}>${esc(nice(c))}${c === f.standard ? ' ·STANDARD' : ''}</option>`).join('') + '</select>').join('');
  $('gdHouseList').querySelectorAll('select').forEach(sel => {
    const f = houseFields.find(x => x.field === sel.dataset.field);
    const mark = () => sel.classList.toggle('changed', sel.value !== f.standard);
    mark(); sel.addEventListener('change', mark);
  });
}
$('gdHouse').addEventListener('toggle', () => { if ($('gdHouse').open) { if (!unlocked) { pending = null; needUnlock(); } else loadHouse(); } });
async function saveHouse(reset) {
  if (!unlocked) { pending = null; return needUnlock(); }
  const settings = {};
  $('gdHouseList').querySelectorAll('select').forEach(s => { settings[s.dataset.field] = s.value; });
  const r = await post('/api/ghostdeck/house-settings', reset ? { reset: true } : { settings });
  if (r.status === 403) return note('gdNote', "Changing the house settings needs the owner's password.", true);
  note('gdNote', r.ok ? (reset ? 'Back to the standard.' : 'House settings saved.') : 'Not saved.', !r.ok);
  loadHouse();
}
$('gdHouseSave').addEventListener('click', () => saveHouse(false));
$('gdHouseReset').addEventListener('click', () => saveHouse(true));
holdable($('gdHouseSend'), () => gdSend('house'));

$('gdSendAs').querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
  if (!unlocked) { pending = null; return needUnlock(); }
  const r = await post('/api/ghostdeck/sendas', { n: +b.dataset.as });
  const j = await r.json().catch(() => ({}));
  note('gdNote', r.status === 403 ? "That needs the owner's password." : j.text || j.error || '', !r.ok);
}));
function renderGhostDeck() {
  const on = !!(S.status && S.status.ghostDeck);
  $('gdToggle').textContent = on ? 'TURN OFF' : 'TURN ON';
  $('gdToggle').classList.toggle('on', on);
  $('gdBody').hidden = !on;
  renderCurfew(); // the countdown bar shows on every view
  if ($('status').hidden) return; // the deck rows are only drawn while STATUS is on screen
  const as = (S.status && S.status.ghostDeckSendAs) || 0;
  $('gdSendAs').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.as === as));
  if (as) $('gdTest').open = true;
  if (!on) return;
  const decks = Object.values(S.decks || {}).sort((a, b) => a.player - b.player);
  // One row per deck: PLAY or STOP, SYNC ON/OFF, MASTER. Every button is tap + hold.
  const sig = decks.map(d => [d.player, d.load, d.title, d.playing, d.onAir, d.master, d.info && d.info.synced].join(',')).join('|');
  if (sig !== gdPlaySig) {
    gdPlaySig = sig;
    $('gdPlay').innerHTML = '';
    decks.forEach(d => {
      const loaded = d.load === 'LOADED', synced = !!(d.info && d.info.synced);
      const row = document.createElement('div');
      row.className = 'gd-deck';
      const st = !loaded ? 'EMPTY' : (d.playing ? 'PLAYING' : 'STOPPED') + (d.onAir ? ' · ON AIR' : '') + (d.master ? ' · MASTER' : '') + (synced ? ' · SYNC' : '');
      row.innerHTML = `<div class="gd-name"><b>DECK ${d.player}</b> ${esc(d.title || '')}<small>${st}</small></div>`;
      const btn = (label, cmd, body) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hold'; b.textContent = label; holdable(b, () => gdSend(cmd, body)); row.appendChild(b); };
      if (loaded && d.playing) btn('STOP', 'stop', { player: d.player });
      if (loaded && !d.playing && d.title) btn('PLAY', 'play', { player: d.player });
      btn(synced ? 'SYNC OFF' : 'SYNC ON', 'sync', { player: d.player, on: !synced });
      if (loaded && d.title) btn('FROM CUE', 'restart', { player: d.player });
      if (loaded && !d.master) btn('MASTER', 'master', { player: d.player });
      $('gdPlay').appendChild(row);
    });
  }
  // Every USB / SD in a deck, and every deck that isn't playing (to load onto).
  const srcs = [];
  decks.forEach(d => { const i = d.info || {};
    if (i.usb === 'LOADED') srcs.push([d.player + ':USB_SLOT', 'USB IN DECK ' + d.player]);
    if (i.sd === 'LOADED') srcs.push([d.player + ':SD_SLOT', 'SD IN DECK ' + d.player]); });
  const ss = srcs.map(x => x[0]).join();
  if (ss !== gdSrcSig) {
    gdSrcSig = ss;
    const was = $('gdSrc').value;
    $('gdSrc').innerHTML = srcs.length ? srcs.map(([v, t]) => `<option value="${v}">${t}</option>`).join('') : '<option value="">NO USB / SD YET</option>';
    if (srcs.some(x => x[0] === was)) $('gdSrc').value = was;
  }
  const targets = decks.filter(d => !d.playing);
  const ts = targets.map(d => d.player + (d.title || '')).join('|');
  if (ts !== gdTargetSig) {
    gdTargetSig = ts;
    const was = $('gdTarget').value;
    $('gdTarget').innerHTML = targets.length ? targets.map(d => `<option value="${d.player}">DECK ${d.player}${d.title ? ' · has ' + esc(d.title) : ' · empty'}</option>`).join('') : '<option value="">EVERY DECK IS PLAYING</option>';
    if (targets.some(d => String(d.player) === was)) $('gdTarget').value = was;
  }
  const log = (S.events || []).filter(e => e.kind === 'ghostdeck').slice(-4).reverse();
  const html = log.map(e => `<li class="${e.level === 'INFO' ? '' : 'warn'}">${esc(clock(e.at))} · ${esc(e.text)}</li>`).join('');
  setHTML($('gdLog'), html);
}

// ---------- OSC out ----------
async function loadOsc() {
  try {
    const o = await (await fetch('/api/osc')).json();
    if (document.activeElement !== $('oscTargets')) $('oscTargets').value = (o.targets || []).map(t => t.host + ':' + t.port).join('\n');
    $('oscForm').dataset.sent = o.sent || 0;
  } catch (e) {}
}
$('oscForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!unlocked) { pending = null; return needUnlock(); }
  const r = await post('/api/osc', { targets: $('oscTargets').value.split('\n') });
  const j = await r.json().catch(() => ({}));
  if (r.ok) { $('oscTargets').blur(); loadOsc(); }
  note('oscNote', r.ok ? (j.targets.length ? 'Sending to ' + j.targets.map(t => t.host + ':' + t.port).join(', ') + ' on every beat of the master deck.' : 'OSC off.') : (j.error || 'Not saved.'), !r.ok);
});
loadOsc();

// ---------- watch from home ----------
let remoteState = {};
async function loadRemote() {
  let res;
  try { res = await fetch('/api/remote'); } catch (e) { return; }
  if (res.status === 401) { remoteState = {}; $('remoteBox').hidden = true; $('remoteBtn').textContent = 'TURN ON'; return; } // locked: keep the plain description
  try { remoteState = await res.json(); } catch (e) { return; }
  const r = remoteState;
  $('remoteBtn').textContent = r.on ? 'TURN OFF' : 'TURN ON';
  $('remoteBtn').classList.toggle('on', !!r.on);
  $('remoteBox').hidden = !r.url;
  // With the short link set up, share gl.cold.fyi/<unit>/watch (#111: this unit's, same every night); otherwise the raw tunnel link.
  const share = r.url ? (r.shortLink ? 'https://' + r.shortLink : r.url) : null;
  if (share && $('remoteUrl').dataset.v !== share) {
    $('remoteUrl').dataset.v = share;
    $('remoteUrl').textContent = share.replace('https://', '');
    $('remoteQr').src = '/api/qr.svg?text=' + encodeURIComponent(share);
  }
  $('watchToken').placeholder = r.shortLink ? 'short link set up · paste a new token to replace' : 'GitHub token for gl.cold.fyi/watch';
  if (r.error) note('remoteNote', r.error, true);
  else if (r.on && !r.url) note('remoteNote', 'Opening the link... a few seconds.');
  else if (r.url) note('remoteNote', r.shortLink ? 'On. Send ' + r.shortLink + ' - same link every night. ' + (r.shortResult || '')
    : 'On. Send this link to whoever should watch. TURN OFF ends it; a new link is made each time.');
  else if (!r.available) note('remoteNote', "The tunnel tool isn't installed on this box yet.", true);
  if (r.on && !r.url && !r.error) setTimeout(loadRemote, 2000);
}
$('remoteBtn').addEventListener('click', async () => {
  if (!unlocked) { pending = null; return needUnlock(); }
  const r = await post('/api/remote', { on: !remoteState.on });
  if (r.ok) { remoteState = await r.json(); loadRemote(); }
});
$('remoteCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(remoteState.shortLink ? 'https://' + remoteState.shortLink : remoteState.url); $('remoteCopy').textContent = 'COPIED'; } catch (e) {}
});
$('watchTokenForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!unlocked) { pending = null; return needUnlock(); }
  const r = await post('/api/remote/token', { token: $('watchToken').value });
  $('watchToken').value = '';
  const j = await r.json().catch(() => ({}));
  note('remoteNote', r.ok ? (j.shortLink ? 'Saved. From now on, share ' + j.shortLink + '.' : 'Token removed.') : (j.error || 'Not saved.'), !r.ok);
  if (r.ok) loadRemote();
});
(async () => {
  try {
    const w = await (await fetch('/api/whoami')).json();
    if (w.remote) { document.body.classList.add('remote'); $('remoteBanner').hidden = false; }
    else loadRemote();
  } catch (e) {}
})();

// ---------- tracklist: the DJ's call (crew only unless shared, tonight only) ----------
let tlShared = false;
async function loadTracklistShare() {
  try {
    const t = await (await fetch('/api/tracklist', { cache: 'no-store' })).json();
    tlShared = !!t.shared;
    $('shareTl').textContent = 'TRACKLIST: ' + (tlShared ? 'SHARED' : 'CREW ONLY');
    $('shareTl').classList.toggle('on', tlShared);
    $('tlPrivate').hidden = !(t.remote && !tlShared);
  } catch (e) {}
}
$('shareTl').addEventListener('click', async () => {
  if (!unlocked) { pending = null; return needUnlock(); }
  const next = !tlShared;
  if (next && !confirm("Share tonight's tracklist on WATCH FROM HOME and the night's link? Only if the DJ says yes. Tomorrow starts crew only again.")) return;
  const r = await post('/api/tracklist', { shared: next });
  if (r.ok) loadTracklistShare();
});
loadTracklistShare();
setInterval(loadTracklistShare, 60000);

// ---------- whose USB (sets spotted from a new USB; the stick's name is only ever a suggestion) ----------
function renderSetHint() {
  const st = (S.status && S.status.set) || {};
  $('djName').placeholder = st.guess ? "Who's this?" : 'Next DJ';
  const b = $('djSuggest');
  b.hidden = !(st.guess && st.suggest);
  if (!b.hidden) b.textContent = st.suggest.toUpperCase() + '?';
}
$('djSuggest').addEventListener('click', () => { $('djName').value = (S.status.set || {}).suggest || ''; $('djName').focus(); });
let sticksSeen = '';
async function loadSticks() {
  if (document.body.classList.contains('remote')) return;
  try {
    const l = await (await fetch('/api/sticks', { cache: 'no-store' })).json();
    const key = JSON.stringify(l);
    if (key === sticksSeen) return;
    sticksSeen = key;
    $('sticksBox').hidden = !l.length;
    $('sticksList').innerHTML = l.map(k => `<form class="stick" data-id="${esc(k.id)}"><span>${esc(k.name || 'USB')} · DECK ${k.deck} · ${clock(k.at)}</span>` +
      `<input value="${esc(k.dj || '')}" placeholder="${esc(k.suggest ? k.suggest + '?' : 'Whose?')}" maxlength="60" aria-label="DJ for this USB"><button class="mini">SAVE</button></form>`).join('');
    $('sticksList').querySelectorAll('form').forEach(f => f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!unlocked) { pending = null; return needUnlock(); }
      const r = await post('/api/sticks', { id: f.dataset.id, dj: f.querySelector('input').value });
      if (r.ok) { sticksSeen = ''; loadSticks(); }
    }));
  } catch (e) {}
}
loadSticks();
setInterval(loadSticks, 20000);

// ---------- lineup ----------
$('djForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!unlocked) { pending = null; return needUnlock(); }
  const r = await post('/api/dj', { name: $('djName').value });
  if (r.ok) { $('djName').value = ''; $('djName').blur(); }
});

// ---------- share: the address for this network, on tap (never pops up by itself) ----------
function shareAddress() {
  const s = S.status || {}, w = s.wifi || {};
  const host = w.state === 'hotspot' ? '10.42.0.1' : (/^[\d.]+$|\.local$/.test(location.hostname) ? location.host : (w.ip || location.host));
  return 'http://' + host + '/';
}
$('shareBtn').addEventListener('click', () => {
  const a = shareAddress(), w = (S.status || {}).wifi || {};
  $('shareAddr').textContent = a.replace(/^http:\/\//, '').replace(/\/$/, '');
  $('shareQr').src = '/api/qr.svg?text=' + encodeURIComponent(a);
  $('shareWifi').textContent = w.state === 'hotspot' ? 'On the Wi-Fi "GHOST LINK" (password on the sticker).'
    : w.ssid ? 'On the Wi-Fi "' + w.ssid + '".' : '';
  $('shareCopy').textContent = 'COPY';
  $('share').hidden = false;
  loadUnit();
});
// The short link: gl.cold.fyi/<unit name>, plus /photo, /vj ... for a role. The name is changed here (locked).
let unitName = '', unitNo = 1;
async function loadUnit() {
  let label = '';
  try { const u = await (await fetch('/api/unit')).json(); unitName = u.name || ''; unitNo = u.number || 1; label = u.label || ''; } catch (e) {}
  // #111: THIS BOX: GHOST LINK UNIT 01 · gl.cold.fyi/ghostlink, then the unit's links (each names this unit only).
  const g = unitName ? 'gl.cold.fyi/' + unitName : '';
  $('unitLabel').textContent = 'THIS BOX: GHOST LINK ' + label + (g ? ' · ' + g : '');
  $('shareUnitLinks').textContent = g ? [g + ' · DASHBOARD', g + '/watch · WATCH FROM HOME', g + '/night · END OF NIGHT'].join('\n') : '';
  $('shareRoles').textContent = unitName ? ['photo', 'vj', 'lights', 'manager'].map(r => '/' + r).join('  ') : '';
}
$('unitEdit').addEventListener('click', () => {
  if (!unlocked) { $('share').hidden = true; return needUnlock(); }
  $('unitName').value = unitName; $('unitNo').value = unitNo; $('unitForm').hidden = false; $('unitName').focus();
});
$('unitForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = { name: $('unitName').value }, no = parseInt($('unitNo').value, 10);
  if (no && no !== unitNo) body.number = no;
  const r = await post('/api/unit', body);
  const j = await r.json().catch(() => ({}));
  if (r.ok) { $('unitForm').hidden = true; note('unitNote', 'Saved: ' + (j.label || '') + '. gl.cold.fyi/' + j.name + ' works within a minute.'); loadUnit(); }
  else if (r.status !== 401) note('unitNote', j.error || "Didn't save.", true);
});
$('shareCopy').addEventListener('click', async () => {
  const a = shareAddress();
  try { await navigator.clipboard.writeText(a); }
  catch (e) { const t = document.createElement('textarea'); t.value = a; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  $('shareCopy').textContent = 'COPIED';
});
$('shareClose').addEventListener('click', () => { $('share').hidden = true; });
$('share').addEventListener('click', e => { if (e.target === $('share')) $('share').hidden = true; });

// ---------- controls lock ----------
// Watching is open; changing the box needs the password once per phone (cookie). LISTEN ONLY is never locked.
const LOCKED = ['/api/join', '/api/rejoin', '/api/reader/restart', '/api/restart', '/api/shutdown', '/api/logs', '/api/wifi', '/api/restore'];
let unlocked = false;
let pending = null; // the locked button tapped before unlocking; it runs once the password is in

async function refreshAuth() {
  try {
    const a = await (await fetch('/api/auth')).json();
    setUnlocked(a.unlocked);
    showCrew(a.owner);
    if (a.mustChange && a.unlocked) { // new box: pick your own password before anything else
      $('pwForm').hidden = false;
      note('lockNote', 'New box: pick your own password (8+ characters) to finish setting up.', true);
    }
  } catch (e) { /* offline: keep what we had */ }
}
function setUnlocked(u) {
  const changed = u !== unlocked;
  unlocked = u;
  if (changed) setTimeout(() => { loadVenues(); loadRemote(); }); // venue Wi-Fi passwords and the remote link come with the unlock
  $('unlockForm').hidden = u;
  $('unlocked').hidden = !u;
  if (!u) $('pwForm').hidden = true;
  $('status').classList.toggle('locked', !u);
  document.querySelectorAll('[data-post], [data-wifi], a[href="/api/logs"], a[href="/api/blackbox.zip"], #backupBtn, #backupRecBtn, #restoreBtn').forEach(b => {
    const path = b.dataset.post || (b.dataset.wifi ? '/api/wifi' : b.id ? '/api/restore' : '/api/logs');
    if (LOCKED.includes(path)) b.toggleAttribute('data-locked', !u);
  });
}
/** Owner phones see tonight's CREW CODE: give it to the lighting tech or a manager instead of the password. */
async function showCrew(owner) {
  $('pwChangeBtn').hidden = owner === false;
  if (!owner) { $('crewCode').hidden = true; return; }
  try {
    const c = await (await fetch('/api/crew-code')).json();
    if (!c.code) { // #87: a new box (default password) has no crew code yet: it said "CREW CODE TONIGHT · ... until ."
      $('crewCode').textContent = "Tonight's CREW CODE shows here once you've picked your own password.";
      $('crewCode').hidden = false;
      return;
    }
    $('crewCode').innerHTML = `CREW CODE TONIGHT <b>${esc(c.code)}</b> · unlocks the booth controls on a phone until ${esc(c.until)}. ` +
      'Not the password, backups, the unit name or venue Wi-Fi passwords.';
    $('crewCode').hidden = false;
  } catch (e) {}
}
function needUnlock() {
  note('lockNote', 'That control is locked. Enter the password above; it runs as soon as you\'re in.', true);
  if (curView() !== 'status') location.hash = '#status';
  $('lock').scrollIntoView({ block: 'center' });
  $('pw').focus();
}
function note(id, text, warn) {
  $(id).textContent = text;
  $(id).classList.toggle('warn', !!warn);
}
async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { setUnlocked(false); needUnlock(); }
  if (r.status === 403) { // #87: a new box refuses changes until the owner picks a password: say that, not "Didn't save (403)"
    const j = await r.clone().json().catch(() => ({}));
    if (j.mustChange) {
      if (curView() !== 'status') location.hash = '#status';
      $('pwForm').hidden = false;
      note('lockNote', j.error || 'New box: pick your own password (8+ characters) first.', true);
      $('lock').scrollIntoView({ block: 'center' });
      $('pwCur').focus();
      return new Response(null, { status: 401 }); // callers skip their own "didn't save" note for 401
    }
  }
  return r;
}
$('unlockForm').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await post('/api/unlock', { password: $('pw').value });
  $('pw').value = '';
  if (r.ok) {
    setUnlocked(true);
    refreshAuth();
    note('lockNote', 'Unlocked on this phone.');
    if (pending) { const b = pending; pending = null; if (curView() !== 'status') location.hash = '#status'; b.click(); }
  }
  else note('lockNote', 'Wrong password. After 5 tries, wait a minute.', true);
});
$('lockBtn').addEventListener('click', async () => { await post('/api/lock'); setUnlocked(false); });
$('pwChangeBtn').addEventListener('click', () => { $('pwForm').hidden = !$('pwForm').hidden; });
$('pwForm').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await post('/api/password', { current: $('pwCur').value, next: $('pwNew').value });
  $('pwCur').value = $('pwNew').value = '';
  if (r.ok) { setUnlocked(false); note('lockNote', 'Password changed. Every phone needs the new one now.'); }
  else note('lockNote', 'Not changed: current password wrong, or new one under 8 characters.', true);
});
document.querySelectorAll('a[href="/api/logs"], a[href="/api/blackbox.zip"], #backupBtn, #backupRecBtn').forEach(a =>
  a.addEventListener('click', e => { if (!unlocked) { e.preventDefault(); needUnlock(); } }));
$('restoreBtn').addEventListener('click', e => { if (!unlocked) { e.preventDefault(); needUnlock(); } });
$('restoreFile').addEventListener('change', async () => {
  const f = $('restoreFile').files[0];
  $('restoreFile').value = '';
  if (!f || !confirm('Put this backup back? It replaces venues, nights and played lists with the ones in the file, then GHOST LINK restarts.')) return;
  const form = new FormData(); form.append('backup', f);
  const r = await fetch('/api/restore', { method: 'POST', body: form });
  if (r.status === 401) { setUnlocked(false); return needUnlock(); }
  const j = await r.json().catch(() => ({}));
  note('backupNote', r.ok ? 'Restored ' + j.restored + ' files. GHOST LINK is restarting; this page reconnects by itself.' : (j.error || "Couldn't restore that file."), !r.ok);
});

// Risky ones (RESTART, SHUT DOWN) are .hold: tap, then hold 1 s, like every deck control.
async function runPost(b) {
  if (LOCKED.includes(b.dataset.post) && !unlocked) { pending = b.classList.contains('hold') ? null : b; return needUnlock(); }
  if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
  b.disabled = true;
  try {
    const r = await post(b.dataset.post);
    if (r.ok && b.dataset.post === '/api/shutdown') shuttingDown();
    else if (r.ok && DONE[b.dataset.post]) note('ctlNote', DONE[b.dataset.post]);
    else if (!r.ok && r.status !== 401) note('ctlNote', "Didn't work (" + r.status + '). Try again, or RESTART.', true);
  } finally { b.disabled = false; }
}
document.querySelectorAll('[data-post]').forEach(b => {
  if (b.classList.contains('hold')) holdable(b, () => runPost(b));
  else b.addEventListener('click', () => runPost(b));
});
/**
 * POWER OFF made plain (Richard, Nov 8): after SHUT DOWN the whole screen says what's happening, waits until the box
 * has really stopped answering, then says SAFE TO UNPLUG. The button on the box (the small one on the Raspberry Pi
 * by the USB-C power) does the same clean shutdown with one press, and one more press turns it back on.
 */
async function shuttingDown() {
  const o = $('offScreen'); o.hidden = false;
  let gone = 0;
  for (let i = 0; i < 60 && gone < 3; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1500); await fetch('/api/status', { cache: 'no-store', signal: ctl.signal }); gone = 0; }
    catch (e) { gone++; }
  }
  await new Promise(r => setTimeout(r, 6000)); // the last writes to the card after the network goes
  $('offTitle').textContent = 'SAFE TO UNPLUG';
  $('offText').innerHTML = 'The green light on the box is off (red stays on until you unplug).<br>To turn it back on: plug it in, or press the button on the box once.';
}
const DONE = {
  '/api/listen-only': 'LISTEN ONLY is on. GHOST LINK left the DJ network; decks show what it last saw. REJOIN to go back.',
  '/api/rejoin': 'Rejoining: listening 10 seconds, then joining. Decks come back live in about 15 seconds.',
  '/api/reader/restart': 'Reading starts over: every deck blanks for a few seconds, then titles and waveforms come back. The box and Wi-Fi stay up.',
  '/api/join': 'Joining allowed. GHOST LINK listens 10 seconds, then joins.',
  '/api/restart': 'Restarting. The page reconnects by itself in about 20 seconds.',
  '/api/shutdown': 'Shutting down. Unplug power after 20 seconds.',
};
/** The control matching what the box is doing now is lit, so it's clear which one took. */
function renderControls(s) {
  const mode = s.link === 'LISTEN_ONLY' ? '/api/listen-only' : null;
  document.querySelectorAll('[data-post]').forEach(b => b.classList.toggle('on', b.dataset.post === mode));
}

// ---------- venue ----------
let venues = { current: null, venues: [] }, venueEditing = null;
async function loadVenues() {
  try { venues = await (await fetch('/api/venues')).json(); } catch (e) {}
  renderVenue();
  renderNightsPlan(); // planned nights show venue names
}
function renderVenue() {
  const v = venues.venues.find(x => x.id === venues.current);
  $('venueName').textContent = v ? v.name + (v.home ? ' · HOME' : '') + (v.players ? ' · ' + v.players + ' players expected' : '') : 'No venue set';
  $('venueNotes').textContent = v ? v.notes : 'Add one to keep booth notes and tag tonight with it.';
  const wifi = v && v.wifi && v.wifi.length ? v.wifi.map(w => esc(w.ssid) + (w.password ? ' · <span class="pw">' + esc(w.password) + '</span>'
    : w.saved ? ' · password saved' : '')).join('<br>') : '';
  const rows = v ? [['ADDRESS', esc(v.address)], ['ROOMS', esc(v.rooms)], ['GEAR', esc(v.gear)], ['CONTACTS', esc(v.contacts)], ['WI-FI', wifi]] : [];
  // Setups change by the night: what's actually on the DJ network right now, live.
  const seen = {};
  (S.devices || []).filter(d => d.kind === 'PLAYER' || d.kind === 'MIXER')
    .forEach(d => { const n = d.kind === 'MIXER' && /XDJ|OPUS/.test(d.name) ? d.name + ' mixer' : d.name; seen[n] = (seen[n] || 0) + 1; });
  const now = Object.entries(seen).map(([n, c]) => esc(n) + (c > 1 ? ' ×' + c : '')).join(' · ');
  rows.unshift(['TONIGHT', now || 'no DJ gear on the network yet']);
  setHTML($('venueInfo'), rows.filter(r => r[1]).map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join(''));
  if (document.activeElement !== $('venuePick')) setHTML($('venuePick'), '<option value="">(none)</option>' +
    venues.venues.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''));
  $('venuePick').value = venues.current || '';
  $('venueEditBtn').hidden = !v;
}
function openVenueForm(v) {
  if (!unlocked) return needUnlock();
  venueEditing = v ? v.id : null;
  $('vName').value = v ? v.name : '';
  $('vPlayers').value = v && v.players ? v.players : '';
  $('vNotes').value = v ? v.notes : '';
  $('vAddress').value = v ? v.address || '' : '';
  $('vRooms').value = v ? v.rooms || '' : '';
  $('vGear').value = v ? v.gear || '' : '';
  $('vContacts').value = v ? v.contacts || '' : '';
  $('vHome').checked = !!(v && v.home); // #109 HOME
  $('vWifi').innerHTML = '';
  (v && v.wifi || []).forEach(w => addWifiRow(w));
  $('venueDelBtn').hidden = !v;
  $('venueForm').hidden = false;
  $('vName').focus();
}
/** One venue Wi-Fi row. A stored password is never sent to the phone's form; leave it blank to keep it. */
function addWifiRow(w) {
  const r = el('div', 'row');
  r.innerHTML = `<input class="ssid" placeholder="Wi-Fi name (exact)" maxlength="32" aria-label="Wi-Fi name" list="wifiNearbyList" autocapitalize="off" autocorrect="off" spellcheck="false">
    <input class="pw" type="password" placeholder="${w && (w.saved || w.password) ? 'password saved - blank keeps it' : 'password'}" aria-label="Wi-Fi password">
    <button type="button" aria-label="Remove">✕</button>`;
  r.querySelector('.ssid').value = w ? w.ssid : '';
  r.querySelector('button').onclick = () => { r.remove(); wifiNearbyChips(); };
  r.querySelector('.ssid').addEventListener('input', wifiNearbyChips);
  $('vWifi').appendChild(r);
  wifiNearbyChips();
}
/** #94 (51 test: a club's Wi-Fi was saved as "a club" + "51", its real name is "a club / 51"): the networks the box can
 *  see, as tap-to-fill chips and input suggestions, so the name is exact. A saved name the box can't see is flagged. */
function wifiNearbyChips() {
  const near = (S.status && S.status.wifiNearby) || [], box = $('vWifiNear'), dl = $('wifiNearbyList');
  if (!box || !dl) return;
  dl.replaceChildren(...near.map(n => { const o = document.createElement('option'); o.value = n.ssid; return o; }));
  const rows = [...$('vWifi').children];
  box.replaceChildren();
  box.hidden = !near.length;
  if (!near.length) return;
  const lab = document.createElement('span'); lab.textContent = 'NEARBY (tap to use the exact name): ';
  box.append(lab);
  near.slice(0, 8).forEach(n => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mini';
    b.textContent = n.ssid + ' ' + n.signal + '%';
    b.onclick = () => {
      const empty = [...$('vWifi').children].find(r => !r.querySelector('.ssid').value.trim());
      if (empty) empty.querySelector('.ssid').value = n.ssid; else addWifiRow({ ssid: n.ssid });
      const row = [...$('vWifi').children].find(r => r.querySelector('.ssid').value === n.ssid);
      if (row) row.querySelector('.pw').focus();
    };
    box.append(b);
  });
  rows.forEach(r => {
    const v = r.querySelector('.ssid').value.trim();
    r.classList.toggle('notnear', !!v && !near.some(n => n.ssid === v));
    r.querySelector('.ssid').title = v && !near.some(n => n.ssid === v) ? 'The box hasn\'t seen a Wi-Fi with exactly this name here.' : '';
  });
}
$('vWifiAdd').addEventListener('click', () => addWifiRow(null));
$('venueNewBtn').addEventListener('click', () => openVenueForm(null));
$('venueEditBtn').addEventListener('click', () => openVenueForm(venues.venues.find(x => x.id === venues.current)));
$('venueCancel').addEventListener('click', () => { $('venueForm').hidden = true; });
$('venueForm').addEventListener('submit', async e => {
  e.preventDefault();
  const wifi = [...$('vWifi').children].map(r => ({ ssid: r.querySelector('.ssid').value.trim(), password: r.querySelector('.pw').value || null }))
    .filter(w => w.ssid);
  const r = await post('/api/venues', { id: venueEditing, name: $('vName').value, notes: $('vNotes').value, players: +$('vPlayers').value || 0,
    address: $('vAddress').value, rooms: $('vRooms').value, gear: $('vGear').value, contacts: $('vContacts').value, wifi,
    home: $('vHome').checked });
  if (r.ok) { venues = await r.json(); $('venueForm').hidden = true; note('venueNote', ''); renderVenue(); }
  else if (r.status === 400) note('venueNote', (await r.json()).error, true);
  else if (r.status !== 401) note('venueNote', "Didn't save (" + r.status + '). Try again.', true);
});
$('venueDelBtn').addEventListener('click', async () => {
  if (!venueEditing || !confirm('Delete this venue? Past nights keep its name.')) return;
  const r = await post('/api/venues/delete', { id: venueEditing });
  if (r.ok) { venues = await r.json(); $('venueForm').hidden = true; renderVenue(); }
});
$('venuePick').addEventListener('change', async () => {
  if (!unlocked) { renderVenue(); return needUnlock(); }
  const r = await post('/api/venues/select', { id: $('venuePick').value });
  if (r.ok) { venues = await r.json(); renderVenue(); }
});
loadVenues();

// ---------- wi-fi mode ----------
const WIFI_NOTES = {
  auto: 'Stays on known Wi-Fi and keeps retrying it. Becomes the GHOST LINK hotspot only when no known Wi-Fi is in range (90 s at start-up, 10 min later in the night).',
  hotspot: 'Always the GHOST LINK hotspot. Phones join it and the dashboard pops up.',
  client: 'Never the hotspot. Only joins known Wi-Fi.',
};
document.querySelectorAll('[data-wifi]').forEach(b => b.addEventListener('click', async () => {
  if (!unlocked) return needUnlock();
  const m = b.dataset.wifi;
  if (m !== 'auto' && !confirm(m === 'hotspot'
      ? 'Switch to the GHOST LINK hotspot? This phone will lose the box until it joins the GHOST LINK Wi-Fi.'
      : 'Never be the hotspot? If no known Wi-Fi is around, the box will only be reachable by cable.')) return;
  const r = await post('/api/wifi', { mode: m });
  if (r.ok) { S.wifiMode = m; renderWifi(); }
}));
function renderWifi() {
  const w = (S.status && S.status.wifi) || {};
  const mode = S.wifiMode || w.mode || 'auto';
  document.querySelectorAll('[data-wifi]').forEach(b => b.classList.toggle('on', b.dataset.wifi === mode));
  let t = WIFI_NOTES[mode] || '';
  if (w.state === 'hotspot') t = 'Hotspot GHOST LINK is on · ' + (w.guests || 0) + ' joined. ' +
    (mode === 'auto' ? 'AUTO keeps it on until KNOWN WI-FI ONLY (or a reboot).' : t);
  else if (w.state === 'none' && mode === 'auto') t = 'No Wi-Fi right now. Retrying known Wi-Fi; the hotspot starts only if none is in range. ';
  note('wifiNote', t);
  if (typeof WifiQuiet !== 'undefined') WifiQuiet.render(); // #104
}
refreshAuth();

// ---------- display options (this phone only) ----------

function pref(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
}
function applyDisplay() {
  const theme = pref('theme') || 'night', size = pref('size') || 'm';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.size = size;
  document.querySelector('meta[name="theme-color"]').content = theme === 'day' ? '#ffffff' : '#000000';
  document.querySelectorAll('[data-theme-set]').forEach(b => b.classList.toggle('on', b.dataset.themeSet === theme));
  document.querySelectorAll('[data-size-set]').forEach(b => b.classList.toggle('on', b.dataset.sizeSet === size));
}
document.querySelectorAll('[data-theme-set]').forEach(b => b.addEventListener('click', () => { pref('theme', b.dataset.themeSet); applyDisplay(); }));
document.querySelectorAll('[data-size-set]').forEach(b => b.addEventListener('click', () => { pref('size', b.dataset.sizeSet); applyDisplay(); }));
applyDisplay();

// ---------- deck layout (LAYOUT on DECKS; per phone) ----------
// Everything about how DECKS looks is a choice on this phone: tiles or stacked waveforms (all decks' scrolling
// waveforms in one block, playheads lined up), how many across, waveform height and zoom, text size, and which
// parts show. Saved in this browser only.
const DV_EXTRA = { color: 'rgb', time: 'remain', dim: '0', hide: [], fit: 'auto' };
// #90 (Nov 21): VIEW presets first (CORNER beside Resolume, SIDE in a tall window beside a console, BOOTH, TV);
// the older ones stay for bookmarks. show.artist: the artist beside the title on STACKED rows.
const SHOW_ALL = { art: 1, meta: 1, nums: 1, overview: 1, phrase: 1, artist: 1 };
const DV_PRESETS = {
  corner:  { mode: 'stack', cols: 'auto', wave: 's', zoom: '8', text: 's', show: { ...SHOW_ALL, overview: 0 }, ...DV_EXTRA },
  side:    { mode: 'stack', cols: 'auto', wave: 'm', zoom: '8', text: 's', show: { ...SHOW_ALL }, ...DV_EXTRA },
  booth:   { mode: 'tiles', cols: 'auto', wave: 'l', zoom: '8', text: 'm', show: { ...SHOW_ALL }, ...DV_EXTRA },
  tv:      { mode: 'stack', cols: 'auto', wave: 'xl', zoom: '8', text: 'l', show: { ...SHOW_ALL }, ...DV_EXTRA, fit: 'always' },
  classic: { mode: 'tiles', cols: 'auto', wave: 'm', zoom: '8', text: 'm', show: { art: 1, meta: 1, nums: 1, overview: 1, phrase: 1, artist: 1 }, ...DV_EXTRA },
  big:     { mode: 'tiles', cols: 'auto', wave: 'xl', zoom: '8', text: 'm', show: { art: 1, meta: 1, nums: 1, overview: 1, phrase: 1, artist: 1 }, ...DV_EXTRA },
  stack:   { mode: 'stack', cols: 'auto', wave: 'm', zoom: '8', text: 's', show: { art: 1, meta: 1, nums: 1, overview: 1, phrase: 1, artist: 1 }, ...DV_EXTRA },
  waves:   { mode: 'waves', cols: '1', wave: 'giant', zoom: '8', text: 'm', show: { art: 0, meta: 0, nums: 0, overview: 1, phrase: 1, artist: 1 }, ...DV_EXTRA },
  compact: { mode: 'tiles', cols: 'auto', wave: 's', zoom: '8', text: 's', show: { art: 0, meta: 1, nums: 1, overview: 0, phrase: 0, artist: 1 }, ...DV_EXTRA },
};
let DV = loadDV();
// ?embed=1: inside another app's web view (HARD STOP's GHOST LINK screen). No header / tabs, no tour; alerts stay.
if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');
// #90: AUTO = nobody on this browser picked a view: the window's shape picks one (Views.auto), not saved, and it
// follows the window when it's resized. Picking anything in LAYOUT (or a ?view= / ?layout= link) ends AUTO.
let DV_AUTO = false;
const dvCopy = k => JSON.parse(JSON.stringify(DV_PRESETS[k]));
{ // ?layout=stack (or big, waves, compact, classic) picks a preset, handy for a booth screen bookmark
  const qs = new URLSearchParams(location.search), q = qs.get('layout'), vq = qs.get('view');
  if (vq === 'auto') DV_AUTO = true;
  else if (vq && DV_PRESETS[vq]) { DV = dvCopy(vq); pref('viewChosen', '1'); }
  else if (q && DV_PRESETS[q]) { DV = dvCopy(q); pref('viewChosen', '1'); }
  else if (q) try { DV = cleanDV(JSON.parse(atob(q))); pref('viewChosen', '1'); } catch (e) { /* not a layout link */ }
  else if (!pref('viewChosen') && JSON.stringify(DV) === JSON.stringify(cleanDV(DV_PRESETS.classic))) DV_AUTO = true;
  if (DV_AUTO) DV = dvCopy(Views.auto(innerWidth, innerHeight));
  // ?view=side&zoom=16&wave=s&artist=0&overview=0: a link an LD can bookmark (each part optional).
  const z = qs.get('zoom'), wv = qs.get('wave');
  if (['4', '8', '16', '32'].includes(z)) DV.zoom = z;
  if (['s', 'm', 'l', 'xl', 'giant'].includes(wv)) DV.wave = wv;
  for (const k of ['artist', 'overview']) if (qs.get(k) === '0' || qs.get(k) === '1') DV.show[k] = +qs.get(k);
}
function loadDV() {
  let v = null;
  try { v = JSON.parse(pref('deckview') || 'null'); } catch (e) { v = null; }
  return cleanDV(v);
}
/** Anything stored or pasted in a link becomes a valid layout; unknown values fall back to CLASSIC's. */
function cleanDV(v) {
  const base = JSON.parse(JSON.stringify(DV_PRESETS.classic));
  if (!v || typeof v !== 'object') return base;
  const ok = (k, list) => list.includes(String(v[k])) ? String(v[k]) : base[k];
  return {
    mode: ok('mode', ['tiles', 'stack', 'waves']), cols: ok('cols', ['auto', '1', '2', '3', '4']),
    wave: ok('wave', ['s', 'm', 'l', 'xl', 'giant']), zoom: ok('zoom', ['4', '8', '16', '32']), text: ok('text', ['s', 'm', 'l', 'xl']),
    show: Object.fromEntries(Object.keys(base.show).map(k => [k, v.show && k in v.show ? (v.show[k] ? 1 : 0) : 1])),
    color: ok('color', ['rgb', 'blue', 'mono']), time: ok('time', ['remain', 'elapsed']), dim: ok('dim', ['0', '1']),
    hide: Array.isArray(v.hide) ? [...new Set(v.hide.map(Number).filter(n => n >= 1 && n <= 6))].sort() : [],
    fit: ok('fit', ['auto', 'off', 'always']),
  };
}
function presetOf(v) {
  return Object.keys(DV_PRESETS).find(k => JSON.stringify(DV_PRESETS[k]) === JSON.stringify(v)) || null;
}
function applyDV() {
  if (!DV_AUTO) pref('deckview', JSON.stringify(DV));
  WINDOW_S = +DV.zoom;
  const sec = $('decks');
  sec.dataset.mode = DV.mode; sec.dataset.cols = DV.cols; sec.dataset.wave = DV.wave; sec.dataset.text = DV.text;
  for (const k in DV.show) sec.classList.toggle('hide-' + k, !DV.show[k]);
  sec.classList.toggle('dim-off', DV.dim === '1');
  for (const p in tiles) tiles[p].root.hidden = DV.hide.includes(+p);
  document.querySelectorAll('#stack .srow').forEach(r => { r.hidden = DV.hide.includes(+r.dataset.player); });
  $('stack').hidden = DV.mode !== 'stack';
  applyFit();
  const pr = presetOf(DV);
  document.querySelectorAll('#layoutPanel [data-dv]').forEach(g => {
    const key = g.dataset.dv;
    g.querySelectorAll('button').forEach(b => b.classList.toggle('on',
      key === 'view' ? b.dataset.v === (DV_AUTO ? 'auto' : pr) :
      key === 'preset' ? DV_PRESETS[b.dataset.v] && JSON.stringify(DV_PRESETS[b.dataset.v]) === JSON.stringify(DV) : key === 'show' ? !!DV.show[b.dataset.v] : key === 'hide' ? !DV.hide.includes(+b.dataset.v) : DV[key] === b.dataset.v));
  });
  $('deckPreset').textContent = (DV_AUTO ? 'AUTO · ' : '') + (pr ? pr === 'big' ? 'BIG WAVES' : pr === 'waves' ? 'WAVES ONLY' : pr === 'stack' ? 'STACKED' : pr.toUpperCase() : 'CUSTOM');
}
document.querySelectorAll('#layoutPanel [data-dv]').forEach(g => g.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const key = g.dataset.dv, v = b.dataset.v;
  DV_AUTO = key === 'view' && v === 'auto';
  pref('viewChosen', DV_AUTO ? '' : '1');
  if (DV_AUTO) pref('deckview', JSON.stringify(cleanDV(DV_PRESETS.classic))); // so the next load is AUTO too
  if (key === 'view') DV = dvCopy(DV_AUTO ? Views.auto(innerWidth, innerHeight) : v);
  else if (key === 'preset') DV = JSON.parse(JSON.stringify(DV_PRESETS[v]));
  else if (key === 'show') DV.show[v] = DV.show[v] ? 0 : 1;
  else if (key === 'hide') DV.hide = DV.hide.includes(+v) ? DV.hide.filter(n => n !== +v) : [...DV.hide, +v].sort();
  else DV[key] = v;
  applyDV();
}));
$('layoutLink').addEventListener('click', async () => {
  const pr = presetOf(DV); // a named view gives a short link (#90): /?view=side#decks
  const url = location.origin + (pr ? '/?view=' + (DV_AUTO ? 'auto' : pr) + '#decks' : '/?layout=' + encodeURIComponent(btoa(JSON.stringify(DV))));
  try { await navigator.clipboard.writeText(url); $('layoutLinkNote').textContent = 'Copied. Open it on another phone or screen to get this layout.'; }
  catch (e) { $('layoutLinkNote').textContent = url; }
});
$('layoutBtn').addEventListener('click', () => {
  const p = $('layoutPanel'); p.hidden = !p.hidden;
  $('layoutBtn').setAttribute('aria-expanded', String(!p.hidden));
  $('layoutBtn').classList.toggle('on', !p.hidden);
});
// Tap any scrolling waveform to step the zoom: 4 → 8 → 16 → 32 seconds across.
document.addEventListener('click', e => {
  if (!e.target.closest('#decks canvas.detail, #stack canvas')) return;
  const z = ['4', '8', '16', '32'];
  DV.zoom = z[(z.indexOf(DV.zoom) + 1) % z.length];
  if (DV_AUTO) { DV_AUTO = false; pref('viewChosen', '1'); }
  applyDV();
});
/** An unloaded or lost deck: its stacked row goes blank instead of keeping the old track. */
function clearStack(p) {
  const row = document.querySelector(`#stack [data-player="${p}"]`);
  if (!row) return;
  const c = row.querySelector('canvas'), st = row.querySelector('.st');
  if (c.width) { const [g, W, H] = fit(c); g.clearRect(0, 0, W, H); }
  c._wait = null; c._ov = null;
  st.querySelectorAll('span').forEach(s => { s._h = undefined; if (s.textContent) s.textContent = ''; });
  row.classList.remove('air', 'loop');
}
/** A row whose deck has no waveform (yet): blank once, not every frame. */
function blankStack(c) {
  if (!c || c._blank) return;
  c._blank = true; c._wait = null; c._ov = null;
  if (c.width) { const [g, W, H] = fit(c); g.clearRect(0, 0, W, H); }
}

/*
 * EVERY DECK FITS (a club, Nov 12: "part screen window - everything should be able to fit here"). STACKED in a small
 * window (under 900 wide or under 600 tall, the corner window beside Resolume) puts the deck tiles away: each row
 * carries its deck's facts on one line (ON AIR / MASTER, LOOP / SYNC / CUED, BPM, pitch, key, time) and the rows share
 * the window's height by what's happening: decks out loud get the most, MIXING when two are, the deck cued NEXT
 * comes second, an empty deck is one thin line. LAYOUT → STACKED IN A SMALL WINDOW → DECK TILES BELOW brings the
 * tiles back on this phone. #80 (Nov 17): weights + minimums per role (FIT_SPEC), slim one-line rows under 36 px,
 * the height measured from everything above the rows so a crew call or alert never pushes a deck off.
 */
const FIT = { on: false, roles: {}, sig: '', at: 0 };
const loadSeen = {}; // player -> { k: trackKey, at }: the newest load is the likeliest next track
function applyFit() {
  const on = DV.mode === 'stack' && (DV.fit === 'always' || DV.fit === 'auto' && (innerWidth < 900 || innerHeight < 600));
  FIT.sig = ''; // a new wave size / zoom / view refits at once
  if (on === FIT.on) return;
  FIT.on = on; FIT.sig = '';
  $('decks').classList.toggle('fit', on);
  document.body.classList.toggle('fit-decks', on);
  if (!on) $('stack').querySelectorAll('.srow').forEach(r => {
    r.style.height = '';
    r.classList.remove('tall', 'slim', 'loud', 'mix', 'lead', 'next', 'empty');
    if (!(S.decks[r.dataset.player] && S.decks[r.dataset.player].load === 'LOADED')) r.remove(); // empty rows are FIT only
  });
}
addEventListener('resize', () => {
  if (DV_AUTO) { const a = Views.auto(innerWidth, innerHeight); if (presetOf(DV) !== a) { DV = dvCopy(a); applyDV(); } }
  applyFit(); FIT.sig = '';
});

/** Who's out loud (two = MIXING) and which deck comes next: of the tracks not yet out loud, the one playing in the
 * headphones, else cued, else the newest load. Nothing out loud: the MASTER deck (else one on air) leads. */
function fitRoles() {
  const r = {}, loud = [], rest = [], now = performance.now();
  let lead = null;
  for (const p of players()) {
    const d = S.decks[p];
    if (DV.hide.includes(p) || !d || d.load !== 'LOADED') continue;
    if (!loadSeen[p] || loadSeen[p].k !== d.trackKey) loadSeen[p] = { k: d.trackKey, at: now, loud: false };
    if (d.onAir && d.playing) { loud.push(d); loadSeen[p].loud = true; }
    else if (!loadSeen[p].loud) rest.push(d); // a track that's been out loud is on its way out, not next
    if (d.master ? !(lead && lead.master) : !lead && d.onAir) lead = d;
  }
  for (const d of loud) r[d.player] = loud.length > 1 ? 'mix' : 'loud';
  if (!loud.length && lead) r[lead.player] = 'lead';
  if (loud.length && rest.length) {
    const newest = list => list.reduce((a, b) => loadSeen[b.player].at > loadSeen[a.player].at ? b : a);
    const playing = rest.filter(d => d.playing), cued = rest.filter(d => d.info && d.info.cued);
    const nx = playing.length ? newest(playing) : cued.length ? newest(cued) : newest(rest);
    r[nx.player] = 'next';
  }
  FIT.roles = r;
}

/* Nov 17 (#80): what each row asks for. w = its share of the spare height, min = what it gets before anyone shares,
   floor = the least it's squeezed to when four decks, an alert and a crew call all want a 300 px window. */
const FIT_SPEC = {
  empty: { w: 0, min: 22, floor: 16 },
  loud: { w: 4, min: 64, floor: 26 },  // the one deck out loud: always the biggest
  mix: { w: 3, min: 52, floor: 24 },   // two out loud: both big
  lead: { w: 3, min: 48, floor: 24 },  // nothing out loud: MASTER (else on air)
  next: { w: 2, min: 42, floor: 22 },  // cued next / mixing in
  air: { w: 1.3, min: 30, floor: 20 },
  idle: { w: 1, min: 30, floor: 20 },
};
function fitSpec(r) {
  const c = r.classList;
  for (const k of ['empty', 'loud', 'mix', 'lead', 'next', 'air']) if (c.contains(k)) return FIT_SPEC[k];
  return FIT_SPEC.idle;
}
/** Heights for the rows: everyone's minimum (squeezed toward the floors if even that won't fit), then the rest of
 * the window shared by weight; a row whose share comes out under its minimum keeps the minimum. Sums to avail. */
function fitHeights(specs, avail) {
  const n = specs.length, sum = a => a.reduce((x, y) => x + y, 0);
  let mins = specs.map(s => s.min);
  const need = sum(mins);
  if (need > avail) {
    const give = specs.map(s => s.min - s.floor), k = Math.min(1, (need - avail) / Math.max(1, sum(give)));
    mins = specs.map((s, i) => Math.floor(s.min - give[i] * k));
  }
  // #90: a row never grows past its max (its waveform capped by its width); what's left over stays as calm space below.
  const max = specs.map((s, i) => Math.max(mins[i], s.max || Infinity));
  const open = specs.map(s => s.w > 0), hs = mins.slice();
  for (let pass = 0; pass <= n; pass++) {
    let F = avail, W = 0;
    specs.forEach((s, i) => { if (open[i]) W += s.w; else F -= hs[i]; });
    if (!W) break;
    let closed = false;
    specs.forEach((s, i) => {
      if (!open[i]) return;
      const share = F * s.w / W;
      if (share < mins[i]) { open[i] = false; hs[i] = mins[i]; closed = true; }
      else if (share > max[i]) { open[i] = false; hs[i] = max[i]; closed = true; }
    });
    if (!closed) { specs.forEach((s, i) => { if (open[i]) hs[i] = Math.floor(F * s.w / W); }); break; }
  }
  const left = avail - sum(hs); // rounding: the biggest row under its max takes the odd pixels
  if (left > 0) {
    let b = -1;
    hs.forEach((h, i) => { if (h + left <= max[i] && (b < 0 || h > hs[b])) b = i; });
    if (b >= 0) hs[b] += left;
  }
  return hs;
}
/** Share the window's height between the rows. Checked twice a second, and at once when anything above them changes
 * size (a crew call, an alert, the header). It measures everything that isn't a row, so nothing above pushes a deck off. */
function fitGeometry() {
  const root = $('stack');
  let sig = innerWidth + 'x' + innerHeight;
  for (const r of root.children) sig += r.hidden ? '-' : r.className;
  const now = performance.now();
  if (sig === FIT.sig && now - FIT.at < 500) return;
  FIT.sig = sig; FIT.at = now;
  const rows = [...root.children].filter(r => !r.hidden);
  if (!rows.length) return;
  const cur = rows.reduce((a, r) => a + r.getBoundingClientRect().height, 0);
  let avail = Math.floor(innerHeight - (document.body.getBoundingClientRect().height - cur)) - 1;
  if (!$('layoutPanel').hidden) avail = Math.max(avail, Math.round(innerHeight * .6)); // LAYOUT open: the page scrolls anyway
  const hs = fitHeights(rows.map(r => Views.spec(r, fitSpec(r))), avail);
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k], h = hs[k];
    const px = h + 'px';
    if (r.style.height !== px) r.style.height = px;
    r.classList.toggle('tall', h >= 76); // room for the title on its own line
    r.classList.toggle('slim', h < 36 && !r.classList.contains('empty')); // one line: number, waveform, facts
    Views.sized(r, h); // the whole-track strip under the deck out loud, when there's room (#90)
  }
}
if ('ResizeObserver' in window) { // anything above the rows changing size refits at once
  const ro = new ResizeObserver(() => { FIT.sig = ''; });
  ['crewCalls', 'alert', 'away', 'curfewBar', 'demoBar', 'showAlerts'].forEach(id => { if ($(id)) ro.observe($(id)); });
  ro.observe(document.querySelector('header'));
  ro.observe(document.querySelector('#decks .deckbar'));
}

/** STACKED WAVES: one row per player, in player order, with its number and the track title (FIT: and its facts). */
function stackCanvas(p, pos) {
  const root = $('stack');
  let row = root.querySelector(`[data-player="${p}"]`);
  if (!row) {
    row = el('div', 'srow');
    row.dataset.player = p;
    row.hidden = DV.hide.includes(p);
    row.innerHTML = `<b>${p}</b><canvas></canvas><span class="st"><span class="sb"></span><span class="sf"></span><span class="stt"></span><span class="sn"></span></span>`;
    row._c = row.querySelector('canvas'); row._sb = row.querySelector('.sb'); row._sf = row.querySelector('.sf');
    row._stt = row.querySelector('.stt'); row._sn = row.querySelector('.sn');
    const after = [...root.children].find(c => +c.dataset.player > p);
    root.insertBefore(row, after || null);
  }
  const d = S.decks[p], loaded = !!(d && d.load === 'LOADED');
  row.classList.toggle('air', !!(d && d.onAir && loaded));
  const fl = deckFlags(d);
  row.classList.toggle('loop', fl.some(f => f.startsWith('LOOP')));
  const title = loaded ? Views.title(row._stt, d) : ''; // artist + title, shortened to fit, remix name kept (#90)
  const flags = fl.join(' · ');
  if (row._sf.textContent !== flags) row._sf.textContent = flags;
  if (row._stt.textContent !== title) row._stt.textContent = title;
  if (FIT.on) {
    const role = loaded ? FIT.roles[p] || '' : '';
    row.classList.toggle('empty', !loaded);
    row.classList.toggle('loud', role === 'loud');
    row.classList.toggle('mix', role === 'mix');
    row.classList.toggle('next', role === 'next');
    row.classList.toggle('lead', role === 'lead');
    const badges = !loaded ? '' : (role === 'mix' ? '<i class="t-air">MIXING</i>' : d.onAir ? '<i class="t-air">ON AIR</i>' : '')
      + (d.master ? '<i class="t-m">MASTER</i>' : '') + (role === 'next' ? '<i class="t-next">NEXT</i>' : '');
    setHTML(row._sb, badges);
    let facts;
    if (!loaded) facts = d && d.load === 'LOADING' ? 'LOADING' : 'EMPTY';
    else {
      const rate = 1 + (d.pitch || 0) / 100, i = d.info || {};
      const up = DV.time === 'elapsed' || !d.durationMs;
      const key = i.key ? camelot(i.key) || i.key : '';
      facts = (d.effectiveBpm ? d.effectiveBpm.toFixed(1) : '--') + ' ' + ((d.pitch || 0) >= 0 ? '+' : '') + (d.pitch || 0).toFixed(2) + '%'
        + (key ? ' ' + key : '') + ' ' + (up ? mmss(pos / rate) : '-' + mmss((d.durationMs - pos) / rate));
    }
    if (row._sn.textContent !== facts) row._sn.textContent = facts;
  }
  return row._c;
}
applyDV();

// Keep the screen on (booth phones on a stand). Browsers drop the lock when the tab hides; take it back.
let wake = null;
async function keepAwake() {
  if (!$('awake').checked || !('wakeLock' in navigator) || document.hidden) return;
  try { wake = await navigator.wakeLock.request('screen'); } catch (e) { /* low battery or not allowed */ }
}
$('awake').checked = pref('awake') === '1';
if (!('wakeLock' in navigator)) $('awake').parentElement.hidden = true;
$('awake').addEventListener('change', () => {
  pref('awake', $('awake').checked ? '1' : '0');
  if ($('awake').checked) keepAwake(); else if (wake) { wake.release(); wake = null; }
});
document.addEventListener('visibilitychange', keepAwake);
keepAwake();

// ---------- views ----------

const VIEWS = ['now', 'decks', 'network', 'played', 'status', 'help'];
/** The address says the tab and, after a slash, a place in it: #status/venue opens that fold, #now/vj picks the role. */
function route() {
  const [v, sub] = location.hash.slice(1).split('/');
  if (VIEWS.includes(v)) return { v, sub: sub || '' };
  const q = new URLSearchParams(location.search);
  return { v: q.has('role') ? 'now' : 'decks', sub: '' };
}
const curView = () => route().v;
// No tab in the address: the one this phone used last (a corner window bookmarks #decks, so it always opens there).
(() => {
  if (location.hash || new URLSearchParams(location.search).has('role')) return;
  let last = null;
  try { last = localStorage.getItem('lastView'); } catch (e) {}
  if (VIEWS.includes(last)) history.replaceState(null, '', '#' + last);
})();

let shownView = null;
function showView() {
  const { v, sub } = route();
  const changed = v !== shownView;
  shownView = v;
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== v);
  decksHidden = v !== 'decks';
  document.body.dataset.view = v; // CSS: crew calls go to one thin bar only beside the fitted decks
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.view === v));
  try { localStorage.setItem('lastView', v); } catch (e) {}
  if (v === 'played') { loadNights(); renderPlayed(); }
  if (v === 'network') { loadMixer(); renderNetwork(); renderEvents(); }
  if (v === 'decks' && changed && S.status) renderDecks(); // tiles only update while DECKS is on screen
  if (v === 'status') { renderStatus(); renderGhostDeck(); }
  if (v === 'now' && sub && ROLES[sub]) setRole(sub);
  if (v === 'decks' && sub === 'layout' && $('layoutPanel').hidden) $('layoutBtn').click();
  const target = sub && ($('go-' + sub) || (sub === 'layout' ? $('layoutPanel') : v !== 'now' && $(sub)));
  if (target) {
    if (target.tagName === 'DETAILS') target.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  } else { // the hash would otherwise scroll the header and tabs away (the browser can do it a frame late)
    window.scrollTo(0, 0);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }
  renderHeader();
  toTop();
  if (changed) { navShow(); slideIn(); }
}

// Laptop keys: 1-6 = tabs, / = GO TO, Esc closes it. Never while typing.
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
    if (e.key === 'Escape' && t.id === 'goQ') { t.value = ''; goFilter(); t.blur(); }
    return;
  }
  if (e.key >= '1' && e.key <= '6') { location.hash = '#' + VIEWS[+e.key - 1]; e.preventDefault(); }
  else if (e.key === '/') { e.preventDefault(); openGoTo(); }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') arrowUpDownAt = performance.now();
  // ← → = previous / next tab. Not right after ↑ / ↓ (the Konami code in fun.js), not with the share card open.
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && performance.now() - arrowUpDownAt > 3000 && $('share').hidden) {
    e.preventDefault(); stepTab(e.key === 'ArrowRight' ? 1 : -1);
  }
});
let arrowUpDownAt = -1e9;

/*
 * TABS (#80, a club Nov 12: "top buttons gotta be easier to nav, gotta have the swipe thru too"). Swipe the page left /
 * right for the next / previous tab (phones), ← → on a laptop. The tab you're on always scrolls into view, the tab
 * strip fades at an edge when there's more past it, and a tab only switches on a clean tap: not a finger that moved,
 * not one that started at the very top edge (the phone's own pull-down), not the tap that stops a scrolling page.
 */
let slideDir = 0;
function stepTab(dir) {
  const i = VIEWS.indexOf(curView()), j = i + dir;
  if (i < 0 || j < 0 || j >= VIEWS.length) return false;
  slideDir = dir;
  location.hash = '#' + VIEWS[j];
  return true;
}
function slideIn() {
  const m = document.querySelector('main');
  if (!slideDir) return;
  m.classList.remove('tab-in-l', 'tab-in-r');
  void m.offsetWidth; // restart the animation
  m.classList.add(slideDir > 0 ? 'tab-in-r' : 'tab-in-l');
  slideDir = 0;
}
document.querySelector('main').addEventListener('animationend', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('tab-in-l', 'tab-in-r');
});
/** The tab you're on stays in view in the strip; fades show there's more to either side. */
function navShow() {
  const n = document.querySelector('nav'), a = n.querySelector('a.on');
  if (a && n.scrollWidth > n.clientWidth) {
    const nr = n.getBoundingClientRect(), ar = a.getBoundingClientRect();
    if (ar.left < nr.left + 16) n.scrollLeft += ar.left - nr.left - 24;
    else if (ar.right > nr.right - 16) n.scrollLeft += ar.right - nr.right + 24;
  }
  navEdges();
}
function navEdges() {
  const n = document.querySelector('nav');
  n.classList.toggle('more-l', n.scrollLeft > 2);
  n.classList.toggle('more-r', n.scrollLeft + n.clientWidth < n.scrollWidth - 2);
}
document.querySelector('nav').addEventListener('scroll', navEdges, { passive: true });
addEventListener('resize', navShow);

let pageScrollAt = -1e9;
addEventListener('scroll', () => { pageScrollAt = performance.now(); }, { passive: true });
const navTap = { a: null, x: 0, y: 0, t: 0, ok: false };
document.querySelector('nav').addEventListener('pointerdown', e => {
  navTap.a = e.target.closest('a'); navTap.x = e.clientX; navTap.y = e.clientY; navTap.t = performance.now();
  navTap.ok = e.pointerType === 'mouse' || (e.clientY >= 8 && navTap.t - pageScrollAt > 200);
});
document.querySelector('nav').addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a || e.detail === 0) return; // keyboard (Enter on a focused tab) always works
  const moved = Math.hypot(e.clientX - navTap.x, e.clientY - navTap.y);
  if (navTap.a !== a || !navTap.ok || moved > 12 || performance.now() - navTap.t > 1000) e.preventDefault();
});

// Swipe: one finger, mostly sideways, at least 60 px (or a quick 40 px flick). Not from the screen's side edges (the
// browser's own back gesture), not on a text box, slider or anything that scrolls sideways or drags (the ghost).
const SW = { on: false, x: 0, y: 0, t: 0, horiz: false, blockUntil: 0 };
function swipeable(t) {
  const m = document.querySelector('main');
  for (let e = t; e && e !== m; e = e.parentElement) {
    if (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)) return false;
    const cs = getComputedStyle(e);
    if (cs.touchAction === 'none') return false;
    if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2) return false;
  }
  return !!t && m.contains(t);
}
(() => {
  const m = document.querySelector('main');
  const reset = () => { SW.on = false; m.style.transition = 'transform .18s ease-out'; m.style.transform = ''; };
  m.addEventListener('touchstart', e => {
    SW.on = false;
    if (e.touches.length !== 1) return;
    const p = e.touches[0];
    if (p.clientX < 24 || p.clientX > innerWidth - 24 || !swipeable(e.target)) return;
    Object.assign(SW, { on: true, x: p.clientX, y: p.clientY, t: performance.now(), horiz: false });
  }, { passive: true });
  m.addEventListener('touchmove', e => {
    if (!SW.on) return;
    if (e.touches.length !== 1) { reset(); return; }
    const dx = e.touches[0].clientX - SW.x, dy = e.touches[0].clientY - SW.y;
    if (!SW.horiz) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.6) { SW.on = false; return; } // a scroll: leave it alone
      SW.horiz = true; m.style.transition = 'none';
    }
    e.preventDefault(); // sideways now: no page scroll under the finger
    const i = VIEWS.indexOf(curView()), end = (dx > 0 && i <= 0) || (dx < 0 && i >= VIEWS.length - 1);
    m.style.transform = `translateX(${Math.round(dx * (end ? .1 : .35))}px)`;
  }, { passive: false });
  m.addEventListener('touchend', e => {
    if (!SW.on) return;
    const horiz = SW.horiz, p = e.changedTouches[0], dx = p.clientX - SW.x, dy = p.clientY - SW.y;
    const dt = performance.now() - SW.t;
    reset();
    if (!horiz) return;
    SW.blockUntil = performance.now() + 400; // the lift-off is not also a tap on whatever was under the finger
    const far = Math.abs(dx) >= 60 || (Math.abs(dx) >= 40 && dt < 250);
    if (far && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 900) stepTab(dx < 0 ? 1 : -1);
  });
  m.addEventListener('touchcancel', () => { if (SW.on) reset(); });
  document.addEventListener('click', e => {
    if (performance.now() < SW.blockUntil) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();

// Back to top: a small button once a long tab is scrolled down.
let toTopShown = false;
function toTop() {
  const show = window.scrollY > 700;
  if (show !== toTopShown) { toTopShown = show; $('toTop').hidden = !show; }
}
addEventListener('scroll', () => { if (!toTopRaf) toTopRaf = requestAnimationFrame(() => { toTopRaf = 0; toTop(); }); }, { passive: true });
let toTopRaf = 0;
$('toTop').addEventListener('click', () => window.scrollTo({ top: 0 }));

// GO TO (top of STATUS): every setting and section by name. Typing filters; Enter or a tap goes there and opens it.
const GOTO = [
  ['BOOTH CHECK', 'status/boothCheck', 'health check ok doors'],
  ['BOX RECORDS · fastest, longest, most', 'played/insights', 'records box records fastest slowest longest blend pitch loops most decks set night busiest venue'],
  ['HALL OF FAME · cleanest blends, wild rides', 'played/insights', 'hall of fame transitions blends clean flam gallop wild rides horses chop tv trainwreck'],
  ['BOX RECORDS + HALL OF FAME: ON / OFF (owner)', 'played/insights', 'owner switch records hall of fame off on hide'],
  ['WILD RIDES: SHOW NAMES (owner)', 'played/insights', 'wild rides names show hide privacy owner dj'],
  ['NIGHTS · plan a night, lineup', 'status/nights', 'lineup set times schedule plan music off dj'],
  ['DECK CONTROLS · stop all, play, load', 'status/deck-controls', 'stop play load sync master ghost deck'],
  ['AUTO-STOP AT MUSIC OFF', 'status/deck-controls', 'curfew music off stop autostop'],
  ['HOUSE SETTINGS · club standard', 'status/deck-controls', 'house settings jog quantize'],
  ['ANNOUNCEMENTS · last call, test tone', 'status/announce', 'announcement announce last call lights on coat check test tone sound card output pa mic voice'],
  ['SOUNDBOARD · sfx, pa, drops, test sounds', 'status/soundboard', 'soundboard sfx pa drops dj smokey hype sound effects air horn pads build pieces time call bar closes presets this phone pink noise sweep sub polarity emergency'],
  ['SONG ID FOR THE CROWD', 'status/song-id', 'song id crowd what playing qr'],
  ['VENUE · address, gear, contacts', 'status/venue', 'venue address gear contacts booth notes'],
  ['MUSIC AT THIS VENUE · BPM, not here', 'status/venue', 'bpm not here repeat usual start notes music'],
  ['VENUE WI-FI · saved passwords', 'status/venue', 'wifi password ssid venue'],
  ['WI-FI MODE · hotspot', 'status/wifi', 'wifi hotspot network internet auto'],
  ['STAND BY · Wi-Fi quiet: stay off their Wi-Fi, all Wi-Fi off', 'status/wifi', 'wifi quiet stand by standby off venue network trouble interference radio airplane manager'],
  ['ROOMS · more than one box', 'status/rooms', 'rooms boxes room'],
  ['SHOW CONTROL · Link, MIDI clock', 'status/show-control', 'show control ableton link midi clock resolume grandma ma3 qlab lights visuals tempo'],
  ['OSC OUT', 'status/osc', 'osc lights visuals touchdesigner madmapper'],
  ['SCREENS · TV, stream overlay, sticker', 'status/screens', 'tv screen projector stream obs overlay sticker print song page'],
  ['WATCH FROM HOME', 'status/watch', 'remote watch home link share'],
  ['CONTROLS · rejoin, listen only, restart', 'status/controls', 'rejoin listen only restart shut down shutdown power reading'],
  ['BACKUP · restore, black box, logs', 'status/backup', 'backup restore black box blackbox logs'],
  ['GET READY TO SELL · hand the box on', 'status/sell', 'sell selling sold reset factory wipe erase new owner give away hand on'],
  ['BOX DETAILS · uptime, temperature', 'status/box', 'uptime temp temperature cpu source facts'],
  ['TOOLS · demo, tour, arcade, test run', 'status/tools', 'demo tour arcade games boo test run'],
  ['PASSWORD · lock, crew code', 'status/lock', 'password lock unlock crew code'],
  ['SOUND IN · record a set', 'network/sound', 'record recording sound card audio meter uca202 flac silence'],
  ['MIXER (USB MIDI) · FX left on', 'network/mixer', 'mixer midi fx djm'],
  ['EVENTS · what happened', 'network/events', 'events log history problems'],
  ['DEVICES ON THE DJ NETWORK', 'network', 'devices players network'],
  ['LAYOUT · decks, waveforms', 'decks/layout', 'layout waveform zoom stacked tiles colour size view corner side booth tv auto artist bars whole track ghost'],
  ['ROLES · DJ, photo, VJ, lights...', 'now', 'role now photo vj lights sound tech manager host'],
  ['ALL NIGHTS · past nights, by venue', 'played', 'past nights archive history all nights artist'],
  ['ON THE DECKS · set the DJ', 'played/djForm', 'dj next dj on the decks set'],
  ['SETLIST · copy, playlist, CSV', 'played', 'setlist tracklist copy csv json playlist recap'],
  ['DISPLAY · theme, text size, ghost', 'help/display', 'theme dim daylight text size ghost moods awake screen rips smells size roam decks'],
  ['GHOST SMELLS RIPS · on / off', 'help/display', 'ghost rips smells stink rip turn on'],
  ['HELP', 'help', 'help how'],
];
/*
 * GO TO finds every control, not only the list above (a club Nov 12: "finding the smells rips thing was rlly hard ...
 * search thing didnt even get it"). Each time it's used it reads the page: section headings and folds, buttons,
 * switches, labels and links, each with the tab and fold it lives in ("HELP → DISPLAY"). Words in any order, no
 * punctuation, a few words that mean the same (SYN). A hit switches tab, opens the fold, scrolls there and flashes it.
 */
const SYN = [['rips', 'rip', 'stink', 'stinks', 'smell', 'smells'], ['ghost', 'boo'], ['record', 'rec', 'recording', 'recordings'],
  ['wifi', 'wireless', 'hotspot'], ['lights', 'light', 'osc', 'show'], ['arcade', 'games', 'game'], ['tour', 'tutorial', 'intro'], ['records', 'record', 'fame', 'best'], ['wild', 'trainwreck', 'gallop', 'shame'], ['crew', 'call', 'cue', 'countin', 'countdown'], ['end', 'recap', 'summary', 'wrap', 'card']];
const normGo = t => String(t || '').toLowerCase().replace(/wi[\s-]?fi/g, 'wifi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const synsOf = w => { const g = SYN.find(x => x.some(y => y === w || (w.length >= 3 && y.startsWith(w)))); return g ? [w, ...g] : [w]; };
const TAB_NAME = { now: 'NOW', decks: 'DECKS', network: 'NETWORK', played: 'PLAYED', status: 'STATUS', help: 'HELP' };
let goAuto = [];
/** Where an element lives: its tab, then its fold (STATUS) or the heading above it (other tabs, LAYOUT rows). */
function goWhere(e) {
  const view = e.closest('.view');
  if (!view) return null;
  const parts = [TAB_NAME[view.id] || view.id.toUpperCase()];
  const det = e.closest('details');
  const row = e.closest('.lp-row');
  if (e.closest('#layoutPanel')) parts.push('LAYOUT' + (row && row.querySelector('small') ? ' → ' + row.querySelector('small').textContent : ''));
  else if (det && det.querySelector('summary') && !e.matches('summary')) parts.push(det.querySelector('summary').textContent.replace(/\s+/g, ' ').trim());
  else if (!e.matches('h2, h3, summary')) {
    let top = e; while (top.parentElement && top.parentElement !== view) top = top.parentElement;
    for (let n = top.previousElementSibling; n; n = n.previousElementSibling) if (/^H[23]$/.test(n.tagName)) { parts.push(n.textContent.trim()); break; }
  }
  return parts.map(x => x.slice(0, 40)).join(' → ');
}
function goIndex() {
  const seen = new Set(), out = [];
  document.querySelectorAll('main .view').forEach(view => view.querySelectorAll('h2, h3, summary, button, a[href], label, select[aria-label]').forEach(e => {
    if (e.closest('#goto, .go-list') || e.matches('.q, [data-dismiss]')) return;
    let label = (e.matches('select') ? e.getAttribute('aria-label') : e.textContent).replace(/\s+/g, ' ').trim();
    if (!label || label.length < 2 || label.length > 70) return;
    const where = goWhere(e);
    if (!where) return;
    const key = label + '|' + where;
    if (seen.has(key)) return;
    seen.add(key);
    const tip = e.getAttribute('title') || e.getAttribute('aria-label') || '';
    out.push({ label, where, hay: normGo(label + ' ' + tip + ' ' + where), lab: normGo(label), el: e, view: view.id });
  }));
  goAuto = out;
}
function goFilter() {
  const q = normGo($('goQ').value);
  const list = $('goList');
  if (!q) { list.hidden = true; list.innerHTML = ''; return; }
  const words = q.split(' ').map(synsOf);
  const has = (hay, alts) => alts.some(a => hay.includes(a));
  const hits = [];
  GOTO.forEach(([l, to, k]) => {
    const hay = normGo(l + ' ' + k);
    if (words.every(w => has(hay, w))) hits.push({ s: 2 + (words.every(w => has(normGo(l), w)) ? 3 : 0), label: l, to });
  });
  goAuto.forEach((x, i) => {
    if (!words.every(w => has(x.hay, w))) return;
    hits.push({ s: (words.every(w => has(x.lab, w)) ? 3 : 0) + (x.el.matches('h2, h3, summary') ? 1 : 0), label: x.label, where: x.where, i });
  });
  hits.sort((a, b) => b.s - a.s);
  const shown = hits.slice(0, 10);
  list.innerHTML = shown.map((h, n) => `<li><a href="${h.to ? '#' + h.to : '#'}"${h.i != null ? ` data-auto="${h.i}"` : ''}${n ? '' : ' class="first"'}>${esc(h.label)}${h.where ? `<small>${esc(h.where)}</small>` : ''}</a></li>`).join('')
    || '<li class="none">Nothing called that. Try HELP.</li>';
  list.hidden = false;
}
/** Go to a control GO TO found on the page: its tab, its fold open, scrolled to and flashed. */
function goJump(x) {
  const e = x.el;
  if (curView() !== x.view) location.hash = '#' + x.view;
  setTimeout(() => {
    if (e.closest('#layoutPanel') && $('layoutPanel').hidden) $('layoutBtn').click();
    for (let n = e.parentElement; n; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true;
    if (e.matches('summary')) e.parentElement.open = true;
    e.scrollIntoView({ block: 'center' });
    e.classList.remove('go-flash'); void e.offsetWidth; e.classList.add('go-flash');
    setTimeout(() => e.classList.remove('go-flash'), 1800);
  }, 120);
}
function openGoTo() {
  if (curView() !== 'status') location.hash = '#status';
  requestAnimationFrame(() => { $('goQ').focus(); $('goQ').select(); });
}
$('goQ').addEventListener('focus', goIndex); // read the page fresh each time (folds, venues and labels change)
$('goQ').addEventListener('input', () => { if (!goAuto.length) goIndex(); goFilter(); });
$('goQ').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const a = $('goList').querySelector('a');
  if (a) a.click();
});
$('goList').addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a) return;
  // Same address again (e.g. two entries in one fold): hashchange won't fire, so go there by hand.
  const to = a.getAttribute('href');
  const auto = a.dataset.auto != null ? goAuto[+a.dataset.auto] : null;
  $('goQ').value = ''; goFilter(); $('goQ').blur();
  if (auto) { e.preventDefault(); goJump(auto); return; }
  if (location.hash === to) { e.preventDefault(); showView(); }
});

function renderAll() {
  renderHeader(); renderDecks(); renderNetwork(); renderEvents(); renderPlayed(); renderStatus();
  if (typeof venues !== 'undefined') renderVenue();
}

window.addEventListener('hashchange', showView);

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
showView();
connect();
requestAnimationFrame(frame);

// Last line: bin/smoke checks this to know the whole script ran.
document.documentElement.dataset.ready = "1";

// RESTART READING from a stuck deck tile: same as the STATUS button (asks for the password once if locked).
document.addEventListener('click', e => {
  if (!e.target.closest('[data-restart-reading]')) return;
  const b = document.querySelector('[data-post="/api/reader/restart"]');
  if (b) b.click();
});

// The coin cell that keeps the clock while unplugged. A CR2032 is ~3.0-3.3 V new; under ~2.8 V it's on its way out.
function clockBattery(b) {
  const v = b.v.toFixed(2) + ' V' + (b.charging ? ' · CHARGING' : '');
  return b.v >= 2.8 ? ['ok', v + ' · GOOD'] : b.v >= 2.5 ? ['look', v + ' · LOW · swap the coin cell soon'] : ['look', v + ' · FLAT · swap the coin cell'];
}

// BOOTH CHECK (from HARD STOP's PANEL CHECK): everything that matters before doors, one glance. Green = good,
// amber = look at it, grey = nothing there yet. Words carry the meaning too, never colour alone.
// WHO'S HERE: HARD STOP gear, phones, computers (CDJs / mixers / DJ computers are on NETWORK).
function renderNearby(s) {
  const box = $('nearby');
  if (!box) return;
  const l = s.nearby || [];
  box.hidden = !l.length;
  const html = "<h2>WHO'S HERE</h2><dl>" + l.map(n => `<dt>${esc(n.kind)}${n.count > 1 ? ' ×' + n.count : ''}</dt><dd class="bc-ok">${esc(n.detail || 'ON THE DASHBOARD')}</dd>`).join('') + '</dl>';
  if (box.innerHTML !== html) box.innerHTML = html;
}

function renderBoothCheck(s) {
  renderNearby(s);
  const box = $('boothCheck');
  if (!box) return;
  const w = s.wifi || {}, v = s.venue || {}, decks = Object.values(S.decks);
  const players = s.players || 0, want = v.players || 0;
  const mixer = (S.devices || []).some(d => d.kind === 'MIXER');
  const titled = decks.some(d => d.load === 'LOADED' && d.title);
  const stuck = decks.some(d => d.load === 'LOADING' && tiles[d.player] && tiles[d.player].loadingAt && Date.now() - tiles[d.player].loadingAt > 20000);
  const power = (s.problems || []).find(p => /^Power/.test(p.title));
  const rows = [
    ['CLOCK', s.clockOk ? ['ok', 'CONFIRMED'] : ['look', 'NOT CONFIRMED · open this page on a phone']],
    ...(s.clockBattery ? [['CLOCK BATTERY', clockBattery(s.clockBattery)]] : []),
    ['VENUE', !v.name ? ['none', 'NONE SET'] : s.venueOk ? ['ok', v.name.toUpperCase()] : ['look', v.name.toUpperCase() + '? · not checked tonight · change it under VENUE if wrong']],
    ['WI-FI', s.wifiQuiet ? ['look', s.wifiQuiet.words + (s.wifiQuiet.until ? ' UNTIL ' + clock(s.wifiQuiet.until) : ' UNTIL YOU END IT')] // #104
      : w.state === 'hotspot' ? ['look', 'ON ITS OWN HOTSPOT · venue Wi-Fi saved?'] : w.ssid ? ['ok', w.ssid] : ['none', 'NONE']],
    ['DJ CABLE', s.cable === false ? ['look', 'UNPLUGGED'] : s.cable && s.djAddress ? ['ok', 'IN'] : s.cable ? ['look', 'IN, NO ADDRESS YET'] : ['none', '--']],
    ['JOINED', s.link === 'LINKED' ? ['ok', 'AS DEVICE ' + s.deviceNumber] : s.link === 'LISTENING' ? ['look', 'LISTENING'] : ['look', s.link || '--']],
    ['PLAYERS', !players ? ['none', 'NONE YET'] : want && players < want ? ['look', players + ' OF ' + want] : ['ok', players + (want ? ' OF ' + want : '')]],
    ['MIXER', mixer ? ['ok', 'ON THE NETWORK'] : players ? ['look', 'NONE · PLAYED GUESSES'] : ['none', '--']],
    ['TRACKS', stuck ? ['look', 'A DECK IS NOT READING'] : titled ? ['ok', 'TITLES ARRIVING'] : ['none', 'LOAD ONE TO CHECK']],
    ...(s.deckSetup && players ? [['DECK SETUP', s.deckSetup.length ? ['look', s.deckSetup.map(i => 'DECK ' + i.deck + ' ' + i.what + ' ' + i.now + ' (HOUSE ' + i.house + ')').join(' · ')] : ['ok', 'MATCHES HOUSE (JOG, FIRMWARE)']]] : []),
    ['POWER', power ? ['look', power.title.toUpperCase()] : ['ok', 'OK']],
    ['BLACK BOX', s.blackbox ? ['ok', 'WRITING'] : ['look', 'NOT WRITING']],
  ];
  const html = '<h2>BOOTH CHECK</h2><dl>' + rows.map(([k, [st, t]]) => `<dt>${k}</dt><dd class="bc-${st}">${esc(t)}</dd>`).join('') + '</dl>';
  if (box.innerHTML !== html) box.innerHTML = html;
}

// WHILE YOU WERE AWAY (from HARD STOP: missed alerts keep their own time). A phone that lost the box for more than
// 20 s (a club 12:02-12:25) gets what happened meanwhile, with the box's times, once, until OK.
function whileAway(hello) {
  const a = awayAt; awayAt = null;
  if (!a || Date.now() - a.phone < 20000) return;
  const from = a.box - 2000;
  const seen = (hello.events || []).filter(e => e.at >= from && (e.level !== 'INFO' || /^(played|reader|join|start|clock|conflict)$/.test(e.kind)));
  const lines = seen.slice(-6).map(e => clock(e.at) + '  ' + e.text);
  const st = hello.status && hello.status.startedAt ? Date.parse(hello.status.startedAt) : 0;
  if (st > from) lines.unshift(clock(st) + '  GHOST LINK restarted.');
  const box = $('away');
  if (!box) return;
  box.innerHTML = `<b>WHILE YOU WERE AWAY · ${esc(clock(a.box))} - ${esc(clock(Date.now() - (S.skew || 0)))}</b>` +
    (lines.length ? '<pre>' + esc(lines.join('\n')) + '</pre>' : '<div>Nothing happened that needs you.</div>') +
    '<button type="button" class="mini" data-away-ok>OK</button>';
  box.hidden = false;
  box.querySelector('[data-away-ok]').onclick = () => { box.hidden = true; };
}

// STATUS (home test Nov 10: "mega overwhelming"): BOOTH CHECK, WHO'S HERE and the lock stay open; every section under
// them folds shut, and each phone remembers which ones it keeps open.
(function foldStatus() {
  const sec = $('status');
  let open = {};
  try { open = JSON.parse(localStorage.getItem('statusOpen') || '{}') || {}; } catch (e) {}
  [...sec.querySelectorAll(':scope > h2')].forEach(h => {
    const d = document.createElement('details'), sm = document.createElement('summary');
    d.className = ('sect ' + h.className).trim();
    sm.textContent = h.textContent;
    d.appendChild(sm);
    const move = [];
    for (let n = h.nextElementSibling; n && n.tagName !== 'H2' && n.tagName !== 'FOOTER' && !n.classList.contains('group'); n = n.nextElementSibling) move.push(n);
    if (h.dataset.k) d.id = 'go-' + h.dataset.k; // GO TO and #status/<k> links open it
    h.replaceWith(d);
    move.forEach(m => d.appendChild(m));
    const key = sm.textContent;
    d.open = !!open[key];
    d.addEventListener('toggle', () => { open[key] = d.open; try { localStorage.setItem('statusOpen', JSON.stringify(open)); } catch (e) {} });
  });
})();

// "?" next to a short note: shows the long version under it (the detail is kept, just not in the way).
document.addEventListener('click', e => {
  const q = e.target.closest('[data-tip]');
  if (!q) return;
  let tip = q.closest('.note');
  tip = tip && tip.nextElementSibling;
  if (!tip || !tip.classList.contains('tip')) return;
  tip.hidden = !tip.hidden;
  q.classList.toggle('on', !tip.hidden);
  q.setAttribute('aria-expanded', String(!tip.hidden));
});
// The fold was built after showView ran: a #status/<k> link opened on load still lands on its fold.
(() => { const { v, sub } = route(); if (v === 'status' && sub && $('go-' + sub)) { $('go-' + sub).open = true; setTimeout(() => $('go-' + sub).scrollIntoView({ block: 'start' }), 300); } })();

// #87: opening the page on a tab (#status) let the browser jump to that section once the page finished loading, after
// showView had already scrolled to the top, so the header and tabs started off screen. Undo that late jump.
addEventListener('load', () => { if (!route().sub) setTimeout(() => { if (window.scrollY < 400) window.scrollTo(0, 0); }, 0); });
