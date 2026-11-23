'use strict';
// HARD STOP HUB (STATUS -> TONIGHT -> HARD STOP HUB, DECISIONS #130). HARD STOP's panels (their C6 Wi-Fi modules) and
// phones join a crew room on the box over the venue's network. Only shows once HARD STOP has been seen (#119's rule):
// GHOST LINK alone has no such card, no greyed rows. Shows who's in (names and kinds, text only), LINKED TO THE
// INTERNET ROOM, and for the owner LINK PANELS TONIGHT (a QR + a short code the HARD STOP app scans or types) and
// END TONIGHT'S KEY. Own file: if anything here throws, the rest of the dashboard carries on.
const HsHub = (() => {
  const box = $('hsHub');
  if (!box) return {};
  const st = document.createElement('style');
  st.textContent = `
    #hsHub .hub-list { display: grid; gap: 4px; margin: 8px 0; }
    #hsHub .hub-row { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; border-top: 1px solid var(--dim); padding-top: 4px; }
    #hsHub .hub-row b { font-size: 15px; overflow-wrap: anywhere; }
    #hsHub .hub-row small { color: var(--grey); font-size: 13px; }
    #hsHub .hub-line { font-size: 15px; margin: 6px 0; }
    #hsHub .hub-link { border: 1px solid var(--dim); padding: 12px; margin: 10px 0; display: grid; gap: 8px; justify-items: start; }
    #hsHub .hub-code { font-size: 22px; font-weight: 700; letter-spacing: .08em; user-select: all; font-variant-numeric: tabular-nums; }
    #hsHub .hub-qr { width: 200px; max-width: 70vw; height: auto; background: #fff; padding: 6px; }
    #hsHub .hub-qr svg { display: block; width: 100%; height: auto; }`;
  document.head.appendChild(st);
  box.innerHTML = `
    <div class="note">HARD STOP's panels on this network, through the box: any distance, with or without internet. <button type="button" class="q" data-tip aria-label="More">?</button></div>
    <div class="note tip" hidden>Each panel needs its C6 Wi-Fi module, on the same network as the box (the production network or the box's own hotspot; a venue's guest Wi-Fi often keeps devices apart). LINK PANELS TONIGHT gives the HARD STOP app tonight's key: scan the QR in the app, or type the code. It ends at END NIGHT, or when you tap END TONIGHT'S KEY. With internet, the box also joins HARD STOP's internet room, so phones outside the building see the same.</div>
    <div class="hub-line" id="hubNet"></div>
    <div class="hub-list" id="hubList"></div>
    <div class="buttons"><button type="button" id="hubMake">LINK PANELS TONIGHT</button><button type="button" id="hubEnd" class="hold" hidden>END TONIGHT'S KEY</button></div>
    <div class="hub-link" id="hubLink" hidden>
      <div class="hub-qr" id="hubQr" role="img" aria-label="QR code for the HARD STOP app"></div>
      <small>Or type this code in the HARD STOP app:</small>
      <div class="hub-code" id="hubCode"></div>
      <small id="hubUntil"></small>
      <div class="buttons"><button type="button" id="hubHide">DONE</button></div>
    </div>
    <div class="note" id="hubNote"></div>`;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hhmm = s => { const d = new Date(s * 1000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const KIND = { panel: 'PANEL', app: 'APP', web: 'GUEST' };
  let state = null, loadedAt = 0, busy = false;

  // STATUS folds each section into <details id="go-<data-k>"> (app.js foldStatus): hide the whole fold
  function show(on) { box.hidden = !on; const d = $('go-hardstop-hub') || $('hsHubHead'); if (d) d.hidden = !on; }

  async function load() {
    if (busy) return;
    busy = true; loadedAt = Date.now();
    try {
      const r = await fetch('/api/hardstop/hub', { cache: 'no-store' });
      if (!r.ok) { show(false); return; }
      state = await r.json();
      render();
    } catch (e) { /* offline: keep what we had */ } finally { busy = false; }
  }

  function render() {
    if (!state || !state.seen) { show(false); return; }
    show(true);
    const list = $('hubList');
    list.textContent = '';
    if (state.locked) {
      $('hubNet').textContent = '';
      $('hubMake').hidden = true; $('hubEnd').hidden = true;
      note('hubNote', 'Unlock (crew code or password) to see the panels.');
      return;
    }
    const net = state.internet || {};
    $('hubNet').textContent = 'LINKED TO THE INTERNET ROOM: ' + (state.linked ? 'YES' + (net.boxIsBridge ? ' (the booth comes through the box)' : '')
      : 'NO' + (!state.key ? '' : !net.invite ? ' (the HARD STOP app hands the box the internet room when it has one)' : net.state === 'refused' ? ' (the internet room said no; the app can send a new invite)' : ' (trying; the room on this network works without it)'));
    const ms = state.members || [];
    if (!ms.length) list.append(el('small', null, state.key ? 'Nobody in yet. Panels join once the app has tonight\'s key.' : 'No key tonight yet.'));
    ms.forEach(m => {
      const row = el('div', 'hub-row');
      row.append(el('b', null, m.name));
      row.append(el('small', null, (KIND[m.kind] || 'GUEST') + (m.bridge ? " · THE BOOTH'S BRIDGE" : '')));
      list.append(row);
    });
    const owner = !!state.owner;
    $('hubMake').hidden = !owner;
    $('hubEnd').hidden = !owner || !state.key;
    $('hubMake').textContent = state.key ? 'SHOW THE CODE AGAIN' : 'LINK PANELS TONIGHT';
    if (!owner) $('hubLink').hidden = true;
    note('hubNote', state.key ? "Tonight's key ends " + hhmm(state.key.exp) + '.' + (state.held ? ' ' + state.held + ' waiting for the booth.' : '')
      : owner ? '' : 'The owner links the panels (password, not the crew code).');
  }

  async function make() {
    const r = await fetch('/api/hardstop/hub/key', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GhostLink-Dashboard': '1' }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { setUnlocked(false); return needUnlock(); }
    if (!r.ok) return note('hubNote', j.error || 'Not made (' + r.status + ').', true);
    // the QR is the box's own SVG (zxing on the box); the code and times are text
    const qr = new DOMParser().parseFromString(j.qr, 'image/svg+xml').documentElement;
    $('hubQr').textContent = '';
    if (qr && qr.nodeName === 'svg') $('hubQr').append(document.importNode(qr, true));
    $('hubCode').textContent = j.code;
    $('hubUntil').textContent = 'Ends ' + hhmm(j.exp) + ' (END NIGHT). Panels and phones on this network only.';
    $('hubLink').hidden = false;
    loadedAt = 0; load();
  }

  async function end() {
    const r = await post('/api/hardstop/hub/end');
    if (!r.ok) return note('hubNote', 'Not ended (' + r.status + ').', true);
    $('hubLink').hidden = true;
    state = await r.json().catch(() => state);
    if (state) state.owner = true;
    note('hubNote', "Tonight's key is over. Panels on it left the room.");
    loadedAt = 0; load();
  }

  $('hubMake').addEventListener('click', () => { if (!unlocked) { pending = null; return needUnlock(); } make(); });
  holdable($('hubEnd'), end);
  $('hubHide').addEventListener('click', () => { $('hubLink').hidden = true; });

  show(false);
  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { if (Date.now() - loadedAt > 5000) load(); } catch (e) { console.warn('hub', e); }
  };
  load();
  return { load };
})();
