'use strict';
// API KEYS (STATUS -> SHARE -> API KEYS, DECISIONS #126). Owner only. Keys for the crew's tools (Bitfocus Companion,
// a Stream Deck, a script): a name, the powers ticked (READ / CREW CALLS / SOUNDBOARD / RECORD), shown once with COPY,
// REVOKE. A key never reaches the decks, HARD STOP's routes or the owner's settings, and never works from outside.
// Own file: if anything here throws, the rest of the dashboard carries on. Names go in as text, never HTML.
const ApiKeys = (() => {
  const box = $('apiKeys');
  if (!box) return {};
  const st = document.createElement('style');
  st.textContent = `
    #apiKeys .ak-form, #apiKeys .ak-made { border: 1px solid var(--dim); padding: 12px; margin: 10px 0; display: grid; gap: 10px; }
    #apiKeys .ak-checks { display: grid; gap: 6px; }
    #apiKeys .ak-checks label { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; }
    #apiKeys .ak-checks input { flex: 0 0 20px; width: 20px; min-width: 20px; height: 20px; margin: 0; accent-color: var(--fg); padding: 0; }
    #apiKeys .ak-checks small { display: block; color: var(--grey); font-size: 13px; }
    #apiKeys .ak-key { font-size: 15px; font-weight: 600; overflow-wrap: anywhere; word-break: break-all; user-select: all; border: 1px solid var(--fg); padding: 8px; }
    #apiKeys .ak-list { display: grid; gap: 8px; margin: 10px 0; }
    #apiKeys .ak-item { border-top: 1px solid var(--dim); padding-top: 8px; display: grid; gap: 4px; }
    #apiKeys .ak-item.gone { opacity: .55; }
    #apiKeys .ak-item b { font-size: 15px; overflow-wrap: anywhere; }
    #apiKeys .ak-item small { color: var(--grey); font-size: 13px; }
    #apiKeys input[type=text] { flex: none; width: 100%; max-width: 360px; box-sizing: border-box; }`;
  document.head.appendChild(st);
  box.innerHTML = `
    <div class="note">For the crew's tools: Bitfocus Companion, a Stream Deck, a script. A key only does what you tick and stops the moment you revoke it. <button type="button" class="q" data-tip aria-label="More">?</button></div>
    <div class="note tip" hidden>The tool sends the key in a header (X-GhostLink-Key). A key never reaches DECK CONTROLS, HARD STOP's connection, Wi-Fi (except ending STAND BY), passwords, updates, share links or settings, and only works on this Wi-Fi, never from outside. Everything a key does goes in EVENTS with its name. How to: ghostlink.cold.fyi/help → HOW TO → BUTTONS AND TOOLS.</div>
    <div class="buttons"><button type="button" id="akNew">NEW KEY</button></div>
    <form class="ak-form" id="akForm" hidden>
      <div class="ak-checks">
        <label><input type="checkbox" value="read" checked><span>READ<small>now playing, BPM, time left, recording, crew calls</small></span></label>
        <label><input type="checkbox" value="crew"><span>CREW CALLS<small>send and cancel crew calls, end STAND BY</small></span></label>
        <label><input type="checkbox" value="soundboard"><span>SOUNDBOARD<small>play and stop sounds (ANNOUNCEMENTS must be on)</small></span></label>
        <label><input type="checkbox" value="record"><span>RECORD<small>start and stop the set recording</small></span></label>
      </div>
      <input type="text" id="akLabel" maxlength="40" placeholder="What it's for (COMPANION, LIGHTS DESK)" aria-label="What the key is for" autocomplete="off">
      <div class="note" id="akFormNote"></div>
      <div class="buttons"><button type="submit">MAKE KEY</button><button type="button" id="akCancel">CANCEL</button></div>
    </form>
    <div class="ak-made" id="akMade" hidden>
      <small id="akMadeWho"></small>
      <div class="ak-key" id="akMadeKey"></div>
      <div class="note">Shown once. Paste it into the tool now (Companion: the GHOST LINK connection's API key).</div>
      <div class="buttons"><button type="button" id="akCopy">COPY</button><button type="button" id="akDone">DONE</button></div>
    </div>
    <div class="ak-list" id="akList"></div>
    <div class="note" id="akNote"></div>`;

  const WORDS = { read: 'READ', crew: 'CREW CALLS', soundboard: 'SOUNDBOARD', record: 'RECORD' };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const say = (t, warn) => note('akNote', t || '', warn);
  const checks = () => [...box.querySelectorAll('.ak-checks input')];
  const ago = ms => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };
  let state = null, made = null;

  async function load() {
    let r;
    try { r = await fetch('/api/keys', { cache: 'no-store' }); } catch (e) { return; }
    if (!r.ok) {
      state = null;
      $('akList').textContent = '';
      say(r.status === 403 ? "API keys need the owner's password, not tonight's crew code." : 'Owner only: unlock with the password to make or see keys.');
      return;
    }
    state = await r.json();
    render();
  }

  function render() {
    const list = $('akList');
    list.textContent = '';
    const keys = (state && state.keys) || [];
    if (!keys.length) { say('No keys yet.'); return; }
    say('');
    keys.forEach(k => {
      const it = el('div', 'ak-item' + (k.revoked ? ' gone' : ''));
      it.append(el('b', null, k.label));
      it.append(el('small', null, k.scopes.map(s => WORDS[s] || s).join(' · ')));
      it.append(el('small', null, k.revoked ? 'REVOKED ' + ago(k.revoked) : (k.lastUsed ? 'last used ' + ago(k.lastUsed) : 'not used yet') + ' · ' + k.hint));
      if (!k.revoked) {
        const b = el('button', 'hold', 'REVOKE'); b.type = 'button';
        b.addEventListener('click', async () => {
          if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'REVOKE: SURE?'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'REVOKE'; }, 4000); return; }
          const r = await post('/api/keys/revoke', { id: k.id });
          if (r.ok) load(); else if (r.status !== 401) say("Didn't revoke (" + r.status + ').', true);
        });
        const row = el('div', 'buttons'); row.append(b); it.append(row);
      }
      list.append(it);
    });
  }

  $('akNew').addEventListener('click', () => {
    if (!unlocked) { pending = null; return needUnlock(); }
    $('akForm').hidden = false; $('akMade').hidden = true; note('akFormNote', '');
    $('akLabel').focus();
  });
  $('akCancel').addEventListener('click', () => { $('akForm').hidden = true; });
  $('akForm').addEventListener('submit', async e => {
    e.preventDefault();
    const scopes = checks().filter(c => c.checked).map(c => c.value);
    if (!scopes.length) { note('akFormNote', 'Tick at least one thing the key can do.', true); return; }
    const r = await post('/api/keys', { label: $('akLabel').value.trim(), scopes });
    if (r.status === 401) return;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { note('akFormNote', r.status === 403 ? "API keys need the owner's password." : j.error || "Didn't work (" + r.status + ').', true); return; }
    made = j.key;
    $('akForm').hidden = true;
    $('akMadeWho').textContent = j.label + ' · ' + j.scopes.map(s => WORDS[s] || s).join(' · ');
    $('akMadeKey').textContent = made;
    $('akMade').hidden = false;
    $('akLabel').value = '';
    load();
  });
  $('akCopy').addEventListener('click', async () => {
    if (!made) return;
    try { await navigator.clipboard.writeText(made); $('akCopy').textContent = 'COPIED'; }
    catch (e) { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($('akMadeKey')); s.removeAllRanges(); s.addRange(rg); $('akCopy').textContent = 'SELECTED: COPY IT'; }
    setTimeout(() => { $('akCopy').textContent = 'COPY'; }, 2500);
  });
  $('akDone').addEventListener('click', () => { made = null; $('akMadeKey').textContent = ''; $('akMade').hidden = true; });

  let was = null;
  setInterval(() => {
    if (document.body.classList.contains('remote')) return;
    const now = unlocked && curView() === 'status';
    if (now && !was) load();
    if (!unlocked && state) { state = null; $('akList').textContent = ''; say(''); made = null; $('akMade').hidden = true; }
    was = now;
  }, 1000);
  return { load };
})();
