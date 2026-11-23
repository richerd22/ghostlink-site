// VISUALS LINK (DECISIONS #123): TRACK -> CLIP rules and PHRASE CUES for Resolume, under SHOW CONTROL.
// Loaded after app.js and showctl.js; uses app.js's globals: $, esc, post(), unlocked, pending, needUnlock().
// Sends to the RESOLUME row's computer (typed once; RESOLUME BASIC fills it). Both switches off until the owner turns
// them on. Track titles from the decks only ever go in as text (textContent).
(() => {
  const root = $('vlRows');
  if (!root) return;
  const MATCH = [['title', 'TITLE HAS'], ['artist', 'ARTIST HAS'], ['tag', 'COMMENT TAG'], ['genre', 'GENRE HAS']];
  const SECTIONS = ['INTRO', 'VERSE', 'UP', 'DOWN', 'CHORUS', 'BRIDGE', 'OUTRO'];
  const WHEN = [['bar', 'ON BAR N OF'], ['before', 'N BARS BEFORE']];
  let S = null, V = null, dirty = false, open = false;
  const opt = (list, v) => list.map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${n}</option>`).join('');

  root.innerHTML = `
    <div class="sc-row vl" data-vl>
      <div class="sc-head">
        <div class="sc-name"><span class="sc-dot" data-dot></span>VISUALS LINK<small data-state>OFF</small></div>
        <button type="button" data-open aria-expanded="false">SET UP</button>
      </div>
      <div data-body hidden>
        <div class="note">Resolume follows the decks: a track going on air launches its clip on that deck's layer, and your cues land on the bars of the rekordbox phrases. Sends to the RESOLUME row's computer (that row can stay off).</div>
        <div class="vl-sub">PRESETS</div>
        <div class="vl-row">
          <label>RESOLUME COMPUTER ADDRESS<input data-host type="text" placeholder="192.168.1.20" autocomplete="off"></label>
          <button type="button" data-preset>RESOLUME BASIC</button>
        </div>
        <div class="note">RESOLUME BASIC: deck 1 to layer 1 (and so on), clip 1 when no rule matches, two example cues. Your rules stay. Then turn on what you want below.</div>

        <div class="vl-sub vl-split"><span>TRACK → CLIP<small data-cstate></small></span><button type="button" class="sc-power" data-power="on">OFF</button></div>
        <div class="vl-label">DECK → LAYER (0 = THAT DECK SENDS NOTHING)</div>
        <div class="vl-layers" data-layers></div>
        <div class="vl-label">RULES (THE FIRST ONE THAT MATCHES WINS)</div>
        <div data-rules></div>
        <div class="buttons"><button type="button" data-add-rule>+ ADD A RULE</button></div>
        <div class="vl-row">
          <label>NO RULE MATCHES: CLIP (0 = NOTHING)<input data-fallback type="number" inputmode="numeric" min="0" max="999"></label>
          <button type="button" data-test-fallback>TEST</button>
        </div>
        <label class="vl-check"><input type="checkbox" data-clearoff> CLEAR A DECK'S LAYER WHEN IT GOES OFF AIR<small>after 2 s with the fader down or the deck stopped; its clip comes back with it</small></label>
        <div class="buttons"><button type="button" data-save>SAVE</button></div>
        <div class="note">Only a deck that's on air counts (its fader up on the mixer; with no mixer on the network, the master deck). One clip per track load (tick AGAIN on a rule to launch it each time the deck comes back on air). A tag is a word in the track's comment in rekordbox, like #vj:intro. Clip numbers count from the left of the layer.</div>
        <div class="vl-last" data-last></div>

        <div class="vl-sub vl-split"><span>PHRASE CUES<small data-qstate></small></span><button type="button" class="sc-power" data-power="cuesOn">OFF</button></div>
        <div data-cues></div>
        <div class="buttons"><button type="button" data-add-cue>+ ADD A CUE</button><button type="button" data-save>SAVE</button></div>
        <div class="note">From the master deck's rekordbox phrases, on the downbeat. Each cue sends its address 1 then 0, once per track. Needs tracks analysed with phrases on players that share them: CDJ-3000s do; the XDJ-XZ doesn't, so cues just wait there.</div>
        <div class="note" data-phrase></div>
        <div class="note" data-note></div>
      </div>
    </div>`;
  const el = root.querySelector('[data-vl]');
  const q = s => el.querySelector(s);

  function ruleRow(r, i) {
    return `<div class="vl-item" data-i="${i}">
      <select data-k="match" aria-label="Match">${opt(MATCH, r.match)}</select>
      <input data-k="text" type="text" maxlength="80" placeholder="#vj:intro" aria-label="Look for" value="${esc(r.text || '')}">
      <label>CLIP<input data-k="clip" type="number" inputmode="numeric" min="1" max="999" value="${r.clip || ''}"></label>
      <label>LAYER<input data-k="layer" type="number" inputmode="numeric" min="0" max="99" placeholder="deck's" value="${r.layer || ''}"></label>
      <label class="vl-again" title="Launch the clip again each time this deck comes back on air (after 2 s away), not just once per track"><input data-k="again" type="checkbox" ${r.again ? 'checked' : ''}> AGAIN</label>
      <button type="button" data-test-rule="${i}">TEST</button>
      <button type="button" data-del aria-label="Remove this rule">REMOVE</button>
    </div>`;
  }
  function cueRow(c, i) {
    return `<div class="vl-item vl-cue" data-i="${i}">
      <label>WHEN<select data-k="when">${opt(WHEN, c.when)}</select></label>
      <label>N<input data-k="bars" type="number" inputmode="numeric" min="1" max="64" value="${c.bars || ''}"></label>
      <label>SECTION<select data-k="section">${opt(SECTIONS.map(s => [s, s]), c.section)}</select></label>
      <input data-k="address" type="text" maxlength="120" placeholder="/composition/columns/2/connect" aria-label="OSC address" value="${esc(c.address || '')}">
      <button type="button" data-test-cue="${i}">TEST</button>
      <button type="button" data-del aria-label="Remove this cue">REMOVE</button>
    </div>`;
  }

  function read() {
    const layers = {};
    q('[data-layers]').querySelectorAll('input').forEach(i => { layers[i.dataset.p] = Number(i.value || 0); });
    const rules = [...q('[data-rules]').querySelectorAll('.vl-item')].map(r => ({
      match: r.querySelector('[data-k="match"]').value, text: r.querySelector('[data-k="text"]').value.trim(),
      clip: Number(r.querySelector('[data-k="clip"]').value || 0), layer: Number(r.querySelector('[data-k="layer"]').value || 0),
      again: !!r.querySelector('[data-k="again"]').checked }));
    const cues = [...q('[data-cues]').querySelectorAll('.vl-item')].map(r => ({
      when: r.querySelector('[data-k="when"]').value, bars: Number(r.querySelector('[data-k="bars"]').value || 0),
      section: r.querySelector('[data-k="section"]').value, address: r.querySelector('[data-k="address"]').value.trim() }));
    return { layers, rules, cues, fallback: Number(q('[data-fallback]').value || 0), clearOff: !!q('[data-clearoff]').checked };
  }

  function drawLists(rules, cues) {
    q('[data-rules]').innerHTML = rules.length ? rules.map(ruleRow).join('') : '<div class="note">No rules yet: every track gets the fallback clip.</div>';
    q('[data-cues]').innerHTML = cues.length ? cues.map(cueRow).join('') : '<div class="note">No cues yet.</div>';
  }

  function render(force) {
    if (!V) return;
    const sending = V.sending;
    const where = V.host ? `${V.host}:${V.port}` : 'no address yet';
    const st = !V.on && !V.cuesOn ? `OFF · ${where}` : `${[V.on ? 'TRACK → CLIP' : '', V.cuesOn ? 'PHRASE CUES' : ''].filter(Boolean).join(' + ')} · ${where}${sending ? ' · SENDING' : ''}`;
    q('[data-state]').textContent = st;
    q('[data-dot]').classList.toggle('live', !!sending);
    q('[data-dot]').classList.toggle('warn', (V.on || V.cuesOn) && !V.host);
    for (const k of ['on', 'cuesOn']) {
      const b = q(`[data-power="${k}"]`);
      b.textContent = V[k] ? 'ON' : 'OFF';
      b.classList.toggle('on', !!V[k]);
      b.setAttribute('aria-pressed', !!V[k]);
    }
    q('[data-cstate]').textContent = V.on ? ' · ON' : ' · OFF';
    q('[data-qstate]').textContent = V.cuesOn ? ' · ON' : ' · OFF';
    const host = q('[data-host]');
    if (document.activeElement !== host && (force || !host.dataset.touched)) { host.value = V.host || ''; delete host.dataset.touched; }
    if (force || !dirty) {
      dirty = false;
      q('[data-layers]').innerHTML = Object.entries(V.layers).map(([p, l]) =>
        `<label>DECK ${esc(p)}<input data-p="${esc(p)}" type="number" inputmode="numeric" min="0" max="99" value="${Number(l)}"></label>`).join('');
      drawLists(V.rules, V.cues);
      q('[data-fallback]').value = V.fallback || '';
      q('[data-clearoff]').checked = !!V.clearOff;
    }
    // What each deck got last (titles from the decks: text only).
    const last = q('[data-last]');
    last.textContent = '';
    (V.decks || []).forEach(d => {
      const line = document.createElement('div');
      line.className = 'note';
      const what = d.clip > 0 && d.layer > 0 ? `LAYER ${d.layer} CLIP ${d.clip}` : /CLEARED$/.test(d.why || '') ? `LAYER ${d.layer} CLEARED` : 'NOTHING';
      line.textContent = `DECK ${d.player}: ${d.title || '?'} → ${what} · ${d.why}`;
      last.appendChild(line);
    });
    const ph = V.phrases || {};
    q('[data-phrase]').textContent = V.cuesOn && ph.has === false && ph.why ? ph.why : '';
    if (!open && (V.on || V.cuesOn || V.rules.length || V.cues.length || V.clearOff)) { open = true; fold(true); }
  }

  function fold(o) {
    q('[data-body]').hidden = !o;
    q('[data-open]').setAttribute('aria-expanded', o);
    q('[data-open]').textContent = o ? 'CLOSE' : 'SET UP';
  }

  function say(text, warn) {
    const n = q('[data-note]');
    n.textContent = text;
    n.classList.toggle('warn', !!warn);
  }

  async function send(path, body, btn, ok) {
    if (!unlocked) { pending = btn; needUnlock(); return null; }
    const r = await post(path, body);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { say(j.error || 'Not saved.', true); return null; }
    if (j.visuals) { S = j; V = j.visuals; render(true); }
    if (ok) say(ok, false);
    return j;
  }

  q('[data-open]').addEventListener('click', () => { open = true; fold(q('[data-body]').hidden); });
  el.addEventListener('input', e => { if (e.target.matches('[data-host]')) e.target.dataset.touched = '1'; else dirty = true; });
  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.power) {
      const k = b.dataset.power, on = !V[k];
      const body = Object.assign(dirty ? read() : {}, { [k]: on });
      await send('/api/showctl/visuals', body, b, (k === 'on' ? 'TRACK → CLIP' : 'PHRASE CUES') + (on ? ' is on.' : ' is off.'));
      if (on && !V.host) say('On, but type the Resolume computer\'s address above first (then RESOLUME BASIC or the RESOLUME row).', true);
    } else if (b.hasAttribute('data-save')) {
      await send('/api/showctl/visuals', read(), b, 'Saved.');
    } else if (b.hasAttribute('data-preset')) {
      await send('/api/showctl/visuals/preset', { preset: 'resolume-basic', host: q('[data-host]').value.trim() }, b, 'Filled in. Turn on TRACK → CLIP and / or PHRASE CUES when Resolume is ready.');
    } else if (b.hasAttribute('data-add-rule')) {
      const cur = read();
      cur.rules.push({ match: 'tag', text: '', clip: 1, layer: 0, again: false });
      drawLists(cur.rules, cur.cues); dirty = true;
    } else if (b.hasAttribute('data-add-cue')) {
      const cur = read();
      cur.cues.push({ when: 'bar', bars: 1, section: 'CHORUS', address: '' });
      drawLists(cur.rules, cur.cues); dirty = true;
    } else if (b.hasAttribute('data-del')) {
      const list = b.closest('[data-rules]') ? 'rules' : 'cues', i = Number(b.closest('.vl-item').dataset.i);
      const cur = read();
      cur[list].splice(i, 1);
      drawLists(cur.rules, cur.cues); dirty = true;
    } else if (b.dataset.testRule !== undefined || b.dataset.testCue !== undefined || b.hasAttribute('data-test-fallback')) {
      // Save what's typed first, so TEST sends what the screen shows.
      if (!(await send('/api/showctl/visuals', read(), b))) return;
      const body = b.dataset.testRule !== undefined ? { rule: Number(b.dataset.testRule) } : b.dataset.testCue !== undefined ? { cue: Number(b.dataset.testCue) } : { fallback: true };
      const r = await post('/api/showctl/visuals/test', body);
      const j = await r.json().catch(() => ({}));
      say(r.ok ? 'Sent: ' + (j.sent || []).join(' · ') : (j.error || 'Not sent.'), !r.ok);
    }
  });

  async function load() {
    try {
      const r = await fetch('/api/showctl', { cache: 'no-store' });
      if (r.ok) { S = await r.json(); V = S.visuals || null; render(false); }
    } catch (e) { /* offline */ }
  }
  load();
  setInterval(() => { if (!document.hidden && root.offsetParent !== null) load(); }, 2000);
})();
