// LIGHTS (DECISIONS #119): WLED (DDP) / Art-Net / sACN lights from the beat and the night. STATUS -> SCREENS & OUTPUTS.
// Loaded after app.js; uses its globals: $, post(), unlocked, pending, needUnlock().
// Built with createElement + textContent only (addresses come back from the box; nothing is put in as HTML).
(() => {
  const root = $('lights');
  if (!root) return;
  const MODES = [['pulse', 'PULSE ON THE BEAT'], ['chase', 'CHASE'], ['calm', 'CALM'], ['off', 'OFF']];
  const KINDS = [['ddp', 'WLED'], ['artnet', 'ART-NET'], ['sacn', 'SACN']];
  const PORT = { ddp: 4048, artnet: 6454, sacn: 5568 };
  // "address" or "address:port" (a port only shows when it isn't the usual one, so SAVE never loses it)
  const split = v => { const i = v.lastIndexOf(':'); return i > 0 && /^\d+$/.test(v.slice(i + 1)) ? [v.slice(0, i), Number(v.slice(i + 1))] : [v, 0]; };
  const EVENTS = [['crew', 'CREW CALLS', 'three white flashes at GO'], ['drop', 'THE DROP', 'a big flash on the chorus'],
    ['silence', 'SILENCE', 'a slow red breathe'], ['goodnight', 'HOUSE LOOK', 'warm and dim after MUSIC OFF and at GOODNIGHT'],
    ['stages', 'HARD STOP STAGES', 'amber 30 min, orange 10, red pulse 5 and the last minute, down at MUSIC OFF'],
    ['phrases', 'PHRASE COLOURS', 'brighter and whiter in the chorus, softer in the intro and outro (rekordbox phrases, CDJ-3000)']]; // #128
  let S = null, editing = false;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const button = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };

  // ---- the fixed parts ----
  const head = el('div', 'sc-head');
  const name = el('div', 'sc-name');
  const dot = el('span', 'sc-dot'); const swatch = el('span', 'lt-swatch'); const state = el('small', null, 'OFF');
  name.append(dot, 'LIGHTS', swatch, state);
  const power = button('OFF', 'sc-power', e => change({ on: !S.on }, e.currentTarget, S.on ? 'LIGHTS off: the lights are handed back dark.' : 'LIGHTS on.'));
  head.append(name, power);

  const safety = el('div', 'buttons lt-safety');
  const black = button('BLACKOUT', 'lt-black', async e => {
    const btn = e.currentTarget;
    if (!S.blackout) { const r = await post('/api/lights/blackout', {}); done(r, 'BLACKOUT: every light is dark.'); return; }
    if (!unlocked) { pending = btn; return needUnlock(); } // ending it: the crew code or the owner
    done(await post('/api/lights/blackout/off', {}), 'BLACKOUT over: back to the look.');
  });
  const test = button('TEST', null, async e => {
    if (!unlocked) { pending = e.currentTarget; return needUnlock(); }
    const r = await post('/api/lights/test', {});
    const j = await r.clone().json().catch(() => ({}));
    done(r, j.said || 'Rainbow sent.');
  });
  safety.append(black, test);

  const modes = el('div', 'buttons lt-modes');
  MODES.forEach(([k, label]) => { const b = button(label, null, e => change({ mode: k }, e.currentTarget, label + '.')); b.dataset.mode = k; modes.append(b); });

  const bright = el('label', 'lt-bright');
  const brightText = el('span', null, 'BRIGHTEST 60 %');
  const range = el('input'); range.type = 'range'; range.min = 10; range.max = 100; range.step = 10;
  range.setAttribute('aria-label', 'Brightest');
  range.addEventListener('input', () => { brightText.textContent = 'BRIGHTEST ' + range.value + ' %'; });
  range.addEventListener('change', e => change({ brightness: Number(range.value) }, e.currentTarget, 'Brightest: ' + range.value + ' %.'));
  bright.append(brightText, range);

  // #128 the venue remembers its look: one quiet offer, never by itself
  const offer = el('div', 'lt-offer'); offer.hidden = true;
  const offerText = el('span');
  const offerUse = button('USE IT', null, e => venue(true, e.currentTarget));
  const offerNo = button('NOT TONIGHT', 'mini', e => venue(false, e.currentTarget));
  offer.append(offerText, offerUse, offerNo);
  async function venue(use, btn) {
    if (!unlocked) { pending = btn; return needUnlock(); }
    const r = await post('/api/lights/venue', { use });
    const j = await r.clone().json().catch(() => ({}));
    done(r, use ? 'The look from last time: ' + String(j.mode || '').toUpperCase() + '.' : 'OK, the look stays.');
  }
  const phraseNote = el('div', 'note lt-phrase'); phraseNote.hidden = true;

  const events = el('div', 'lt-events');
  const checks = {};
  EVENTS.forEach(([k, label, what]) => {
    const l = el('label', 'lt-ev'); const c = el('input'); c.type = 'checkbox';
    c.addEventListener('change', e => change({ events: { [k]: c.checked } }, e.currentTarget, label + (c.checked ? ' on.' : ' off.')));
    l.append(c, el('span', null, label), el('small', null, what));
    checks[k] = [l, c];
    events.append(l);
  });

  const where = el('div', 'lt-where');
  const rows = el('div');
  const counts = el('div', 'sc-fields');
  const pixLabel = el('label', null, 'HOW MANY LIGHTS / PIXELS'); const pix = el('input'); pix.type = 'number'; pix.min = 1; pix.max = 480; pix.inputMode = 'numeric'; pixLabel.append(pix);
  const startLabel = el('label', null, 'DMX START ADDRESS'); const start = el('input'); start.type = 'number'; start.min = 1; start.max = 512; start.inputMode = 'numeric'; startLabel.append(start);
  counts.append(pixLabel, startLabel);
  const add = button('+ ADD A LIGHT', null, () => { editing = true; rows.append(row({ kind: 'ddp', host: '', universe: 0 })); syncDmx(); });
  const save = button('SAVE', null, e => {
    const targets = [...rows.children].map(r => {
      const [host, port] = split(r.querySelector('[data-host]').value.trim());
      const kind = r.querySelector('select').value;
      return { kind, host, port, universe: Number(r.querySelector('[data-uni]').value || (kind === 'sacn' ? 1 : 0)),
        rgbw: r.querySelector('[data-ch]').value === 'rgbw', two: kind !== 'ddp' && r.querySelector('[data-two]').checked };
    }).filter(t => t.host);
    change({ targets, pixels: Number(pix.value || 60), start: Number(start.value || 1) }, e.currentTarget, 'Saved.').then(ok => { if (ok) editing = false; });
  });
  const whereButtons = el('div', 'buttons'); whereButtons.append(add, save);
  where.append(el('div', 'lt-sub', 'WHERE IT GOES'), rows, counts, whereButtons);
  where.addEventListener('input', () => { editing = true; });

  const say = el('div', 'note');
  const help = el('div', 'note');
  help.append('Off until the owner turns it on. Plain RGB or RGBW lights: a WLED strip, or Art-Net / sACN fixtures. ');
  const q = el('button', 'q', '?'); q.type = 'button'; q.setAttribute('data-tip', ''); q.setAttribute('aria-label', 'More');
  help.append(q);
  const tip = el('div', 'note tip');
  tip.hidden = true;
  tip.textContent = 'WLED: type the strip\'s address (from the WLED app), WLED. ART-NET / SACN: the node\'s address and universe; '
    + 'each fixture is 3 channels (red, green, blue), or 4 with RGBW (+ white), from the start address; +1 UNIVERSE carries on in the next universe. The colour follows the track\'s key. BLACKOUT works '
    + 'for anyone here; ending it needs the crew code. TEST: a 5 second rainbow, even with LIGHTS off. Never more than 3 flashes a second.';
  root.append(head, safety, el('div', 'lt-sub', 'THE LOOK'), offer, modes, bright, el('div', 'lt-sub', 'EVENTS WIN OVER THE LOOK'), events, phraseNote, where, say, help, tip);

  function row(t) {
    const r = el('div', 'lt-row');
    const kind = el('select'); kind.setAttribute('aria-label', 'Kind');
    KINDS.forEach(([v, l]) => { const o = el('option', null, l); o.value = v; kind.append(o); });
    kind.value = t.kind;
    const host = el('input'); host.dataset.host = ''; host.placeholder = t.kind === 'ddp' ? '192.168.1.50 or wled.local' : '192.168.1.60';
    host.value = t.host + (t.port && t.port !== PORT[t.kind] ? ':' + t.port : ''); host.autocomplete = 'off'; host.setAttribute('aria-label', 'Address');
    const uni = el('input'); uni.dataset.uni = ''; uni.type = 'number'; uni.inputMode = 'numeric'; uni.placeholder = 'UNIVERSE';
    uni.value = t.kind === 'ddp' ? '' : t.universe; uni.setAttribute('aria-label', 'Universe');
    const x = button('REMOVE', 'mini', () => { editing = true; r.remove(); syncDmx(); });
    // #128: 3 or 4 channels per light, and (Art-Net / sACN) a second universe when they don't all fit in one
    const ch = el('select'); ch.dataset.ch = ''; ch.setAttribute('aria-label', 'Channels per light');
    [['rgb', 'RGB'], ['rgbw', 'RGBW']].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; ch.append(o); });
    ch.value = t.rgbw ? 'rgbw' : 'rgb';
    const twoL = el('label', 'lt-two'); const two = el('input'); two.type = 'checkbox'; two.dataset.two = ''; two.checked = !!t.two;
    twoL.title = 'When the lights don\'t fit in one universe, carry on in the next one (from address 1)';
    twoL.append(two, el('span', null, '+1 UNIVERSE'));
    const sync = () => { uni.hidden = kind.value === 'ddp'; twoL.hidden = kind.value === 'ddp'; syncDmx(); };
    kind.addEventListener('change', sync);
    r.append(kind, host, uni, ch, twoL, x);
    uni.hidden = t.kind === 'ddp';
    twoL.hidden = t.kind === 'ddp';
    return r;
  }
  function syncDmx() {
    startLabel.hidden = ![...rows.children].some(r => r.querySelector('select').value !== 'ddp');
  }

  async function change(body, btn, ok) {
    if (!unlocked) { pending = btn; needUnlock(); return false; }
    return done(await post('/api/lights', body), ok);
  }
  async function done(r, ok) {
    if (r.status === 401) return false;
    const j = await r.json().catch(() => ({}));
    say.textContent = r.ok ? ok : (j.error || 'Not saved.');
    say.classList.toggle('warn', !r.ok);
    if (r.ok && j.mode) { S = j; render(); }
    return r.ok;
  }

  function render() {
    if (!S) return;
    const n = S.targets.length;
    const words = S.blackout ? 'BLACKOUT' : S.testing ? 'TEST · rainbow' : !S.on ? 'OFF' + (n ? '' : ' · no lights set up')
      : (S.mode.toUpperCase() + (S.showing && S.showing !== S.mode && S.showing !== 'off' ? ' · NOW ' + S.showing.toUpperCase() : '')
        + (n ? (S.sending ? ' · sending to ' + n + (n === 1 ? ' light' : ' lights') : ' · can\'t reach the lights yet') : ' · add a light below'));
    state.textContent = words;
    dot.classList.toggle('live', !!S.sending);
    dot.classList.toggle('warn', S.on && n > 0 && !S.sending);
    swatch.style.background = S.sending ? S.colour : 'transparent';
    power.textContent = S.on ? 'ON' : 'OFF';
    power.classList.toggle('on', S.on);
    power.setAttribute('aria-pressed', S.on);
    black.textContent = S.blackout ? 'END BLACKOUT' : 'BLACKOUT';
    black.classList.toggle('on', S.blackout);
    modes.querySelectorAll('button').forEach(b => { const on = b.dataset.mode === S.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    if (document.activeElement !== range) { range.value = S.brightness; brightText.textContent = 'BRIGHTEST ' + S.brightness + ' %'; }
    EVENTS.forEach(([k]) => { checks[k][1].checked = !!S.events[k]; });
    checks.stages[0].hidden = !S.hardStop; // only once HARD STOP has been seen
    // #128 PHRASE COLOURS: what the master deck's phrase is now, said calmly when there's none
    phraseNote.hidden = !S.events.phrases || !S.on;
    phraseNote.textContent = S.phrase ? 'PHRASE NOW: ' + String(S.phrase).toUpperCase()
      : 'No rekordbox phrases from the master deck right now (CDJ-3000s share them for tracks analysed with phrases; the XDJ-XZ never does): the look as usual.';
    const vo = S.venueLook;
    offer.hidden = !vo;
    if (vo) offerText.textContent = 'LAST TIME AT ' + String(vo.name || '').toUpperCase() + ': ' + String(vo.mode || '').toUpperCase();
    if (!editing) {
      rows.replaceChildren(...S.targets.map(row));
      if (!S.targets.length) rows.append(row({ kind: 'ddp', host: '', universe: 0 }));
      pix.value = S.pixels;
      start.value = S.start;
      syncDmx();
    }
  }

  async function load() {
    try {
      const r = await fetch('/api/lights', { cache: 'no-store' });
      if (r.ok) { S = await r.json(); render(); }
    } catch (e) { /* offline */ }
  }
  load();
  setInterval(() => { if (!document.hidden && root.offsetParent !== null) load(); }, 1500);
})();
