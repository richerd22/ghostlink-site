'use strict';
/*
 * WI-FI QUIET (#104, after a club Nov 21: the venue manager had Wi-Fi trouble and the box got unplugged just in case).
 * STAND BY (HARD STOP's word for it; its feeds carry `standby`). A quick, plain way to keep GHOST LINK off the venue's air for a while, and one line that says where the box shows
 * up and until when. Own file; uses app.js globals (S, $, post, unlocked, needUnlock, clock). Text nodes only.
 *  - STATUS -> WI-FI: the line, STAY OFF THEIR WI-FI / ALL WI-FI OFF, then 30 MIN / 1 HOUR / TONIGHT / UNTIL I SAY.
 *  - The address sheet (tap GHOST LINK at the top): the same line and a WI-FI QUIET button.
 *  - WifiQuiet.say(s) for READY FOR TONIGHT, WifiQuiet.short(s) for NOW's box strip.
 * The box writes <data>/wifi-quiet; the Wi-Fi watcher obeys it (deploy/wifi-watch.sh).
 */
const WifiQuiet = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const KIND = {
    stay: {
      name: 'STAY OFF THEIR WI-FI',
      what: 'Leaves the venue Wi-Fi. The box is its own GHOST LINK network instead: phones join that (password on the sticker) or use the DJ cable.',
      stops: 'Stops while on: phones on the venue Wi-Fi, WATCH FROM HOME, gl.cold.fyi, updates. HARD STOP keeps counting; its GHOST LINK feeds wait for the Wi-Fi (or its phone joins GHOST LINK). Decks, recording and the black box keep going.',
      back: 'Back: BACK ON THEIR WI-FI here (from the GHOST LINK network), or wait for the end. A power cycle does not end it.',
    },
    off: {
      name: 'ALL WI-FI OFF',
      what: 'No Wi-Fi from the box at all: no network name, nothing on their router.',
      stops: 'Stops while on: every phone, HARD STOP\'s GHOST LINK feeds, any screen on Wi-Fi. A laptop on the DJ cable still reaches the box. Decks, recording and the black box keep going.',
      back: 'Back: it comes back by itself at the end. Sooner: unplug the box\'s power and plug it back in (Wi-Fi comes back on), or BACK ON from a laptop on the DJ cable.',
    },
  };
  const LENGTHS = [['30m', '30 MIN'], ['1h', '1 HOUR'], ['tonight', 'TONIGHT'], ['forever', 'UNTIL I SAY']];
  let pick = null, busy = false, err = '';

  const fmtLeft = s => s == null ? '' : s < 90 ? 'under 2 min' : s < 3600 ? Math.round(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.round(s % 3600 / 60) + ' min';
  const untilText = q => q.until ? 'until ' + clock(q.until) + ' (' + fmtLeft(q.secondsLeft) + ' left)' : 'until you end it';
  const since = s => s.wifiSince ? ' since ' + clock(s.wifiSince) : '';
  /** "THE BLUE ARCH's Wi-Fi" when the network is one saved on the venue, else the network's name. */
  function network(s) {
    const w = s.wifi || {}, v = s.venue || {};
    const saved = (v.wifi || []).some(x => x && x.ssid === w.ssid);
    return v.name && saved ? v.name + '\'s Wi-Fi "' + w.ssid + '"' : 'the Wi-Fi "' + w.ssid + '"';
  }

  /** Where the box shows up right now, and what other people see. */
  function where(s) {
    const w = s.wifi || {}, q0 = s.wifiQuiet;
    // Not taken by the watcher yet (an old one): say what's really happening, not what was asked.
    if (q0 && q0.applied === false) return 'Asked for ' + q0.words + ', not taken yet. ' + where(Object.assign({}, s, { wifiQuiet: null }));
    const q = q0;
    if (q && q.kind === 'off') return 'ALL WI-FI OFF ' + untilText(q) + '. Nobody sees the box: no network name, nothing on their router.';
    const pre = q ? q.words + ' ' + untilText(q) + '. ' : '';
    if (w.state === 'hotspot') return pre + 'Own network GHOST LINK showing' + since(s) + ' · ' + (w.guests || 0) + ' joined. Phones nearby see "GHOST LINK" in their Wi-Fi list; nothing on the venue\'s router.';
    if (w.state === 'off') return pre + 'No Wi-Fi from the box right now.';
    if (w.state === 'none' || !w.ssid) return pre + 'Not on any Wi-Fi right now' + (q ? '.' : ' (looking for known Wi-Fi).') + ' Nothing showing.';
    return pre + 'On ' + network(s) + ' as GHOST LINK' + since(s) + '. Their router lists one device (ghostlink); no new network name for anyone.';
  }

  /** For READY FOR TONIGHT. */
  function say(s) {
    const q = s.wifiQuiet;
    if (!q) return '';
    return q.words + ' ' + untilText(q) + (q.applied === false ? '. Not taken yet: the box\'s Wi-Fi watcher needs the Nov 22 update.' : '.');
  }
  /** For NOW's box strip: a word. */
  const short = s => !s.wifiQuiet ? null : s.wifiQuiet.kind === 'off' ? 'OFF' : 'QUIET';

  async function start(kind, length) {
    if (!unlocked) return needUnlock();
    const s = S.status || {}, w = s.wifi || {}, k = KIND[kind];
    const onHotspot = location.hostname === '10.42.0.1' || w.state === 'hotspot';
    const len = LENGTHS.find(l => l[0] === length)[1];
    const lose = kind === 'off' ? '\n\nThis phone loses the box now (unless it\'s a laptop on the DJ cable).'
      : onHotspot ? '' : '\n\nThis phone loses the box until it joins the GHOST LINK Wi-Fi (password on the sticker).';
    if ((kind === 'off' || !onHotspot) && !confirm(k.name + ' · ' + len + '?' + lose + '\n\n' + k.back)) return;
    busy = true; err = ''; render();
    try {
      const r = await post('/api/wifi/quiet', { kind, length });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { s.wifiQuiet = j.quiet || s.wifiQuiet; pick = null; }
      else if (r.status !== 401) err = j.error || 'Didn\'t take (' + r.status + ').';
    } catch (e) { err = 'The box didn\'t answer: it may already be off the Wi-Fi.'; }
    busy = false; render();
  }
  async function end() {
    if (!unlocked) return needUnlock();
    busy = true; err = ''; render();
    try {
      const r = await post('/api/wifi/quiet/end', {});
      if (r.ok && S.status) S.status.wifiQuiet = null;
      else if (r.status !== 401) err = 'Didn\'t take (' + r.status + ').';
    } catch (e) { err = 'The box didn\'t answer.'; }
    busy = false; render();
  }

  const box = $('wifiQuiet');
  let sig = '';
  function render() {
    if (!box) return;
    const s = S.status || {}, q = s.wifiQuiet;
    const now = JSON.stringify([where(s), q && q.kind, q && q.applied, pick, busy, err, unlocked]);
    if (now === sig) return;
    sig = now;
    box.textContent = '';
    box.append(el('h3', 'wq-h', 'STAND BY · WI-FI QUIET')); // STAND BY = HARD STOP's word for it too
    const line = el('div', 'wq-where' + (q ? ' on' : ''), where(s));
    box.append(line);
    if (q && q.applied === false) box.append(el('div', 'note warn', 'Not taken yet: the box\'s Wi-Fi watcher needs the Nov 22 update. Until then, unplugging the power is the only way off.'));
    if (q) {
      const row = el('div', 'buttons wq-row');
      const b = el('button', 'on', q.kind === 'off' ? 'WI-FI BACK ON NOW' : 'BACK ON THEIR WI-FI');
      b.type = 'button'; b.disabled = busy; b.onclick = end; b.toggleAttribute('data-locked', !unlocked);
      row.append(b);
      box.append(row, el('div', 'note', KIND[q.kind].back), el('div', 'note', KIND[q.kind].stops));
    }
    const kinds = el('div', 'buttons wq-row');
    for (const k of ['stay', 'off']) {
      if (q && q.kind === k && pick !== k) continue;
      const b = el('button', pick === k ? 'on' : '', (q ? 'CHANGE: ' : '') + KIND[k].name);
      b.type = 'button'; b.disabled = busy; b.toggleAttribute('data-locked', !unlocked);
      b.onclick = () => { if (!unlocked) return needUnlock(); pick = pick === k ? null : k; render(); };
      kinds.append(b);
    }
    if (q && q.kind) { // the same kind, another length
      const b = el('button', pick === q.kind ? 'on' : '', 'NEW END TIME');
      b.type = 'button'; b.disabled = busy; b.onclick = () => { pick = pick === q.kind ? null : q.kind; render(); };
      kinds.append(b);
    }
    box.append(kinds);
    if (!q && !pick) box.append(el('div', 'note', 'Keep GHOST LINK off the venue\'s air for a while (their Wi-Fi acting up, or they ask). Pick one, then how long.'));
    if (pick) {
      const k = KIND[pick];
      box.append(el('div', 'note', k.what), el('div', 'note', k.stops), el('div', 'note', k.back));
      const lens = el('div', 'buttons wq-row');
      for (const [id, label] of LENGTHS) {
        if (pick === 'off' && id === 'forever') continue; // ALL WI-FI OFF always comes back by itself
        const b = el('button', null, label);
        b.type = 'button'; b.disabled = busy; b.onclick = () => start(pick, id);
        lens.append(b);
      }
      box.append(lens);
      if (pick === 'off') box.append(el('div', 'note', 'TONIGHT = until 6:00 in the morning. A power cycle always ends ALL WI-FI OFF.'));
      else box.append(el('div', 'note', 'TONIGHT = until 6:00 in the morning. It keeps going through a power cycle (phones still reach the box on GHOST LINK).'));
      if (s.clockOk === false) box.append(el('div', 'note warn', 'The box\'s clock isn\'t confirmed yet: end times may be off. 30 MIN and 1 HOUR still count from now.'));
    }
    if (err) box.append(el('div', 'note warn', err));
  }

  // The address sheet (tap GHOST LINK at the top): where the box shows up, one tap to the controls.
  const shareLine = el('small', 'wq-share');
  const shareBtn = el('button', null, 'STAND BY');
  shareBtn.type = 'button';
  shareBtn.onclick = () => { const sh = $('share'); if (sh) sh.hidden = true; location.hash = '#status/wifi'; };
  const sw = $('shareWifi');
  if (sw) {
    sw.after(shareLine);
    const btns = document.querySelector('#share .buttons');
    if (btns) btns.prepend(shareBtn);
  }
  const top = $('shareBtn');
  if (top) top.addEventListener('click', () => { shareLine.textContent = where(S.status || {}); });

  return { render, where, say, short, end };
})();
