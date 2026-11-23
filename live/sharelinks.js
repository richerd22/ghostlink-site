'use strict';
// SHARE LINKS (STATUS -> SHARE, DECISIONS #97). Owner only. NEW LINK: a preset (WATCH / CREW / VJ / MANAGER CAN STOP
// DECKS) or your own pick of what it can do, a name, how long; the box signs it and shows a QR + COPY. The list: who,
// what, until when, last used, SHOW, REVOKE. REMOTE OFF (this Wi-Fi only) refuses links from outside, or every link.
// CLAIM THIS BOX: a one-time code for a GHOST LINK account later. Own file: if anything here throws, the rest of the
// dashboard carries on. Names and anything from the box go in as text, never HTML.
const ShareLinks = (() => {
  const box = $('shareLinks');
  if (!box) return {};
  const st = document.createElement('style');
  st.textContent = `
    #shareLinks .sl-motto { color: var(--fg); font-weight: 600; margin: 2px 0 10px; }
    #shareLinks .sl-form, #shareLinks .sl-made, #shareLinks .sl-claim { border: 1px solid var(--dim); padding: 12px; margin: 10px 0; display: grid; gap: 10px; }
    #shareLinks .sl-checks { display: grid; gap: 6px; }
    #shareLinks .sl-checks label { display: flex; gap: 8px; align-items: center; font-size: 14px; }
    #shareLinks .sl-checks input { flex: 0 0 20px; width: 20px; min-width: 20px; height: 20px; margin: 0; accent-color: var(--fg); padding: 0; }
    #shareLinks .sl-list { display: grid; gap: 8px; margin: 10px 0; }
    #shareLinks .sl-item { border-top: 1px solid var(--dim); padding-top: 8px; display: grid; gap: 4px; }
    #shareLinks .sl-item b { font-size: 15px; }
    #shareLinks .sl-item small { color: var(--grey); font-size: 13px; }
    #shareLinks .sl-code { font-size: 40px; font-weight: 700; letter-spacing: .08em; font-variant-numeric: tabular-nums; }
    #shareLinks .sl-made .share-addr { font-size: 14px; }
    #shareLinks input[type=text] { flex: none; width: 100%; max-width: 360px; box-sizing: border-box; }`;
  document.head.appendChild(st);
  box.innerHTML = `
    <div class="sl-motto">Private by default. Everywhere when you want it.</div>
    <div class="note">Give someone a link instead of the password. It only does what you tick, ends on its own, and you can revoke it. <button type="button" class="q" data-tip aria-label="More">?</button></div>
    <div class="note tip" hidden>Everything is off until you pick it. WATCH: the dashboard, read only. CREW CALLS: send and cancel crew calls. STOP / START THE DECKS: only while DECK CONTROLS is on here, for players that obey, with a confirm on their phone. SETTINGS: who's on and tonight's plan only. PLAY ON THE PA: for the HARD STOP app away from the venue Wi-Fi; plays what HARD STOP may play, only while LET HARD STOP CALL THE PA is on here, never EMERGENCY. A link never reaches Wi-Fi, passwords, updates, backups or REMOTE OFF, and can't start a recording. Controls work on this Wi-Fi; from anywhere else only if you tick ALSO FROM OUTSIDE THE VENUE (and WATCH FROM HOME is on). Everything a link does goes in EVENTS with its name.</div>
    <div class="buttons"><button type="button" id="slNew">NEW LINK</button><button type="button" id="slClaimBtn">CLAIM THIS BOX</button></div>
    <form class="sl-form" id="slForm" hidden>
      <div class="buttons" id="slPresets">
        <button type="button" data-preset="watch">WATCH</button>
        <button type="button" data-preset="crew">CREW</button>
        <button type="button" data-preset="vj">VJ</button>
        <button type="button" data-preset="manager">MANAGER CAN STOP DECKS</button>
      </div>
      <div class="sl-checks">
        <label><input type="checkbox" value="watch"> WATCH (read only)</label>
        <label><input type="checkbox" value="crew"> CREW CALLS</label>
        <label><input type="checkbox" value="decks"> STOP / START THE DECKS</label>
        <label><input type="checkbox" value="settings"> SETTINGS (who's on, tonight's plan)</label>
        <label><input type="checkbox" value="announce"> PLAY ON THE PA (HARD STOP's list, never EMERGENCY)</label>
        <label><input type="checkbox" value="updates"> UPDATE AFTER TONIGHT (queues a waiting update, never installs on the spot)</label>
        <label><input type="checkbox" value="outside"> ALSO FROM OUTSIDE THE VENUE</label>
      </div>
      <input type="text" id="slLabel" maxlength="40" placeholder="Who it's for (e.g. Sam, VJ laptop)" aria-label="Who it's for" autocomplete="off">
      <div class="row"><span class="lbl">LASTS</span><select id="slExpiry" aria-label="How long the link lasts">
        <option value="night">UNTIL END OF NIGHT</option><option value="2h">2 HOURS</option>
        <option value="24h">24 HOURS</option><option value="7d">7 DAYS</option></select></div>
      <div class="note" id="slFormNote"></div>
      <div class="buttons"><button type="submit">MAKE LINK</button><button type="button" id="slCancel">CANCEL</button></div>
    </form>
    <div class="sl-made" id="slMade" hidden>
      <small id="slMadeWho"></small>
      <div class="share-addr" id="slMadeUrl"></div>
      <img class="share-qr" id="slMadeQr" alt="">
      <div class="buttons"><button type="button" id="slCopy">COPY</button><button type="button" id="slOutside" hidden>COPY FROM-ANYWHERE LINK</button><button type="button" id="slMadeClose">DONE</button></div>
      <div class="note" id="slMadeNote"></div>
    </div>
    <div class="sl-claim" id="slClaim" hidden>
      <small>CLAIM THIS BOX (LINK TO YOUR ACCOUNT)</small>
      <div class="sl-code" id="slClaimCode"></div>
      <div class="note">In the HARD STOP app: ACCOUNT &rarr; CLAIM A BOX, and enter this code (your Third Polar Arch account, one for HARD STOP and GHOST LINK). When OPEN MY ACCOUNT shows, that opens it with the code filled in. Your box keeps working without an account.</div>
      <div class="note" id="slClaimUntil"></div>
      <div class="buttons"><a class="button" id="slClaimOpen" target="_blank" rel="noopener" hidden>OPEN MY ACCOUNT</a><button type="button" id="slClaimCopy">COPY</button><button type="button" id="slClaimClose">DONE</button></div>
    </div>
    <div class="sl-list" id="slList"></div>
    <div class="row"><span class="lbl">REMOTE OFF</span>
      <button type="button" data-off="off">LINKS WORK</button>
      <button type="button" data-off="outside">OFF FROM OUTSIDE</button>
      <button type="button" data-off="all">ALL LINKS OFF</button></div>
    <div class="note" id="slNote"></div>`;

  const WORDS = { watch: 'WATCH', crew: 'CREW CALLS', decks: 'STOP / START DECKS', settings: 'SETTINGS', announce: 'PLAY ON THE PA', outside: 'ALSO FROM OUTSIDE', recording: 'ONE RECORDING (HAND IT TO THE DJ)', requests: 'ASK THE DJ (ASK + VOTE ONLY)', updates: 'UPDATE AFTER TONIGHT' };
  const PRESETS = {
    watch: { scopes: ['watch'], label: 'Watch' },
    crew: { scopes: ['watch', 'crew'], label: 'Crew' },
    vj: { scopes: ['watch'], label: 'VJ laptop', to: 'decks' },
    manager: { scopes: ['watch', 'decks'], label: 'Manager' },
  };
  let state = null, to = '', made = null, claim = null;
  const checks = () => [...box.querySelectorAll('.sl-checks input')];
  const say = (t, warn) => note('slNote', t || '', warn);
  const when = ms => {
    const d = new Date(ms), now = new Date();
    const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString([], { weekday: 'short' }) + ' ' + hm;
  };
  const ago = ms => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; };
  const lanBase = () => shareAddress().replace(/\/$/, '');
  // #111: with the unit's short links set up, gl.cold.fyi/<unit>/s/<token>: it finds the box on this Wi-Fi or through
  // WATCH FROM HOME, so the link survives a new address or tunnel. Otherwise the plain address on this Wi-Fi.
  const shortBase = () => state && state.short ? 'https://' + state.short : '';
  const urlOf = (path, base) => (base || shortBase() || lanBase()) + path + (to ? '?to=' + to : '');

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    if (btn) { const was = btn.textContent; btn.textContent = 'COPIED'; setTimeout(() => { btn.textContent = was; }, 1500); }
  }

  async function load() {
    let r;
    try { r = await fetch('/api/share', { cache: 'no-store' }); } catch (e) { return; }
    if (r.status === 401 || r.status === 403) {
      state = null; $('slList').textContent = '';
      say(r.status === 403 ? "Share links need the owner's password, not tonight's crew code." : 'Owner only: unlock with the password to make or see links.');
      return;
    }
    try { state = await r.json(); } catch (e) { return; }
    render();
  }

  function render() {
    const list = $('slList');
    list.textContent = '';
    box.querySelectorAll('[data-off]').forEach(b => b.classList.toggle('on', state.remoteOff === b.dataset.off));
    const off = state.remoteOff === 'all' ? 'REMOTE OFF: every link is refused right now.'
      : state.remoteOff === 'outside' ? 'REMOTE OFF: links are refused from outside the venue.' : '';
    say(off || (state.links.length ? state.links.length + ' live link' + (state.links.length === 1 ? '' : 's') + ' (' + state.max + ' at most).' : 'No links yet.'), !!off);
    for (const l of state.links) {
      const it = document.createElement('div');
      it.className = 'sl-item';
      const b = document.createElement('b'); b.textContent = l.label;
      const s1 = document.createElement('small'); s1.textContent = l.scopes.map(s => WORDS[s] || s).join(' · ');
      const s2 = document.createElement('small');
      s2.textContent = 'Until ' + when(l.exp) + ' · ' + (l.lastUsed ? 'last used ' + ago(l.lastUsed) + (l.lastWhere ? ' (' + l.lastWhere + ')' : '') : 'not used yet');
      const bt = document.createElement('div'); bt.className = 'buttons';
      const show = document.createElement('button'); show.type = 'button'; show.textContent = 'SHOW';
      show.addEventListener('click', () => { to = ''; showMade({ label: l.label, scopes: l.scopes, exp: l.exp, path: '/s/' + l.token }); });
      const rev = document.createElement('button'); rev.type = 'button'; rev.textContent = 'REVOKE';
      rev.addEventListener('click', async () => {
        if (rev.dataset.armed !== '1') { rev.dataset.armed = '1'; rev.textContent = 'TAP AGAIN TO REVOKE'; setTimeout(() => { rev.dataset.armed = ''; rev.textContent = 'REVOKE'; }, 4000); return; }
        const r = await post('/api/share/revoke', { id: l.id });
        if (r.ok) { if (made && made.path === '/s/' + l.token) $('slMade').hidden = true; load(); }
      });
      bt.append(show, rev);
      it.append(b, s1, s2, bt);
      list.appendChild(it);
    }
  }

  function showMade(m) {
    made = m;
    const url = urlOf(m.path);
    $('slMadeWho').textContent = 'LINK FOR ' + m.label.toUpperCase() + ' · UNTIL ' + when(m.exp);
    $('slMadeUrl').textContent = url.replace(/^https?:\/\//, '');
    $('slMadeQr').src = '/api/qr.svg?text=' + encodeURIComponent(url);
    const tunnel = typeof remoteState === 'object' && remoteState && remoteState.url;
    $('slOutside').hidden = !tunnel || !!shortBase(); // the short form already works from anywhere
    const ctl = m.scopes.some(s => s === 'crew' || s === 'decks' || s === 'settings' || s === 'announce' || s === 'updates');
    note('slMadeNote', m.scopes.includes('decks') ? 'STOP / START THE DECKS only works while DECK CONTROLS is on here.'
      : shortBase() ? 'One link for here and away: on this Wi-Fi it opens the box, from anywhere else it works while WATCH FROM HOME is on.'
        + (ctl && !m.scopes.includes('outside') ? ' From outside it only watches.' : '')
      : !tunnel ? 'Works on this Wi-Fi. From anywhere else: turn on WATCH FROM HOME, then SHOW this link again.'
      : ctl && !m.scopes.includes('outside') ? 'From outside the venue this link only watches.' : '');
    $('slMade').hidden = false;
    $('slMade').scrollIntoView({ block: 'nearest' });
  }

  $('slNew').addEventListener('click', () => {
    if (!unlocked) { pending = null; return needUnlock(); }
    to = ''; checks().forEach(c => { c.checked = c.value === 'watch'; });
    $('slLabel').value = ''; $('slExpiry').value = 'night'; note('slFormNote', '');
    box.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('on'));
    $('slForm').hidden = false; $('slMade').hidden = true;
    $('slLabel').focus();
  });
  $('slCancel').addEventListener('click', () => { $('slForm').hidden = true; });
  box.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = PRESETS[b.dataset.preset];
    checks().forEach(c => { c.checked = p.scopes.includes(c.value); });
    to = p.to || '';
    if (!$('slLabel').value || Object.values(PRESETS).some(x => x.label === $('slLabel').value)) $('slLabel').value = p.label;
    box.querySelectorAll('[data-preset]').forEach(x => x.classList.toggle('on', x === b));
  }));
  checks().forEach(c => c.addEventListener('change', () => box.querySelectorAll('[data-preset]').forEach(x => x.classList.remove('on'))));
  $('slForm').addEventListener('submit', async e => {
    e.preventDefault();
    const scopes = checks().filter(c => c.checked).map(c => c.value);
    const r = await post('/api/share', { label: $('slLabel').value.trim(), scopes, expiry: $('slExpiry').value });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) return;
    if (!r.ok) { note('slFormNote', r.status === 403 ? "Share links need the owner's password." : j.error || "Didn't work (" + r.status + ').', true); return; }
    $('slForm').hidden = true;
    showMade(j);
    await load();
    if (made === j) showMade(j); // #111: the list now knows the short form
  });
  $('slCopy').addEventListener('click', () => made && copy(urlOf(made.path), $('slCopy')));
  $('slOutside').addEventListener('click', () => made && remoteState && remoteState.url && copy(urlOf(made.path, remoteState.url), $('slOutside')));
  $('slMadeClose').addEventListener('click', () => { $('slMade').hidden = true; });
  box.querySelectorAll('[data-off]').forEach(b => b.addEventListener('click', async () => {
    if (!unlocked) { pending = null; return needUnlock(); }
    const r = await post('/api/share/remote-off', { mode: b.dataset.off });
    if (r.ok) load(); else if (r.status === 403) say("REMOTE OFF needs the owner's password.", true);
  }));

  $('slClaimBtn').addEventListener('click', async () => {
    if (!unlocked) { pending = null; return needUnlock(); }
    const r = await post('/api/claim/start', {});
    if (r.status === 401) return;
    if (!r.ok) { say(r.status === 403 ? "Claiming needs the owner's password." : "Couldn't make a code.", true); return; }
    claim = await r.json();
    $('slClaimCode').textContent = claim.code;
    if (claim.claimUrl && /^https:\/\//.test(claim.claimUrl)) { $('slClaimOpen').href = claim.claimUrl; $('slClaimOpen').hidden = false; }
    $('slClaimUntil').textContent = 'Works once, until ' + when(claim.exp) + '. A new code replaces this one.';
    $('slClaim').hidden = false;
    // The box had no internet: hand the signed offer to the accounts relay from this phone (mobile data works).
    if (!claim.deposited && claim.relay) {
      try {
        const offer = { box: claim.box, pub: claim.pub, code: claim.code, exp: claim.exp, sig: claim.sig,
          kind: claim.kind, number: claim.number, label: claim.label, name: claim.name };
        const rr = await fetch(claim.relay + '/api/boxes/claim-offer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(offer) });
        claim.deposited = rr.status === 201;
      } catch (e) { /* no internet here either: COPY still works */ }
    }
    $('slClaimUntil').textContent += claim.deposited ? ' Ready: enter the code in the HARD STOP app' + (claim.claimUrl ? ', or tap OPEN MY ACCOUNT.' : '.')
      : ' Neither the box nor this phone could reach the accounts site right now. Try again when one of them has internet.';
  });
  $('slClaimCopy').addEventListener('click', () => claim && copy(claim.code, $('slClaimCopy')));
  $('slClaimClose').addEventListener('click', () => { $('slClaim').hidden = true; });

  // The share card (tap GHOST LINK): SHARE LINKS jumps here.
  const jump = $('shareLinksBtn');
  if (jump) jump.addEventListener('click', () => {
    $('share').hidden = true;
    location.hash = '#status/share';
    setTimeout(() => { const d = $('go-share'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } load(); }, 100);
  });

  // Load when the owner unlocks and whenever STATUS comes into view; a quiet refresh keeps "last used" fresh.
  let was = null;
  setInterval(() => {
    if (document.body.classList.contains('remote')) return;
    const now = unlocked && curView() === 'status';
    if (now && !was) load();
    if (!unlocked && state) { state = null; $('slList').textContent = ''; say(''); }
    was = now;
  }, 1000);
  setInterval(() => { if (unlocked && curView() === 'status' && !document.hidden) load(); }, 30000);
  return { load };
})();
