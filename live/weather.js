'use strict';
// WEATHER (DECISIONS #131), off until the owner sets a place. Polls GET /api/weather (open on the LAN, never the place).
//  - NOW ('dash'): one calm suggestion when the owner's gust number or thunder is due in the next hour:
//    "GUSTS 70 km/h IN THE NEXT HOUR: HOLD?" with HOLD (opens NIGHT SAFETY's HOLD on WEATHER / LIGHTNING: a person
//    still taps HOLD THE SHOW) and NOT NOW (30 min). It never holds by itself. STATUS -> NIGHT SAFETY -> WEATHER: the
//    owner's card (the place, the numbers).
//  - TV ('tv') and the crew screen ('crew'): the small line "WIND 32 · GUSTS 61 km/h"; the crew screen shows the
//    suggestion too, with HOLD opening the dashboard's NOW.
// The stage clock gets the line from /api/stageclock itself. createElement + textContent only.
const WeatherView = (() => {
  /** The suggestion's words and what HOLD opens, or null. */
  function suggestion(w) {
    const s = w && w.suggest;
    if (!s || !s.text) return null;
    return { text: String(s.text), preset: s.preset === 'LIGHTNING' ? 'LIGHTNING' : 'WEATHER', kind: s.kind === 'storm' ? 'storm' : 'gust' };
  }
  /** The small line, or ''. */
  function line(w) { return w && typeof w.line === 'string' ? w.line : ''; }
  if (typeof document === 'undefined') return { suggestion, line }; // node tests: the words only

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const css = document.createElement('style');
  css.textContent = `
    .wx-ask { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; border: 1px solid var(--warn, #ffb000); color: var(--warn, #ffb000);
      padding: 8px 10px; margin: 10px 0 4px; font-weight: 600; letter-spacing: .06em; }
    .wx-ask[hidden], .wx-line[hidden] { display: none !important; }
    .wx-ask span { flex: 1 1 200px; min-width: 0; }
    .wx-ask button { margin: 0; min-height: 40px; }
    .wx-ask .wx-hold { border-color: var(--warn, #ffb000); color: var(--warn, #ffb000); }
    body.fit-decks .wx-ask { font-size: 12px; padding: 4px 8px; margin: 6px 0 2px; }
    body.fit-decks .wx-ask button { min-height: 28px; padding: 0 10px; }
    .wx-line.wx-tv { position: fixed; top: 1.2vh; left: 50%; transform: translateX(-50%); z-index: 2147479000; font-size: 2.4vh; letter-spacing: .06em;
      color: #fff; background: #000; padding: .3vh 1vw; white-space: nowrap; font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    .wx-line.wx-crew { color: #fff; letter-spacing: .06em; white-space: nowrap; }
    .wx-ask.wx-crew { font-size: 3vh; border-width: 2px; padding: 1.2vh 1.6vw; margin: 0; }
    .wx-ask.wx-crew a, .wx-ask.wx-crew button { font: inherit; font-size: .8em; background: none; color: inherit; border: 2px solid currentColor; padding: .6vh 1.4vw; text-decoration: none; cursor: pointer; letter-spacing: .06em; }
    .wx-ask.wx-crew span { flex-basis: 100%; }
    .wx-card .wx-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0; }
    .wx-card .wx-row input[type=text] { flex: 1 1 220px; min-width: 0; }
    .wx-card .wx-places { display: grid; gap: 6px; }
    .wx-card .wx-places button { text-align: left; margin: 0; }
    .wx-card .wx-now { color: var(--fg); letter-spacing: .06em; }`;
  document.head.appendChild(css);

  let W = null;
  const listeners = [];
  async function poll() {
    try {
      const r = await fetch('/api/weather', { cache: 'no-store' });
      if (!r.ok) return;
      W = await r.json();
      listeners.forEach(f => { try { f(W); } catch (e) {} });
    } catch (e) { /* keep the last reading */ }
  }
  function post(path, body) {
    if (typeof window.post === 'function') return window.post(path, body);
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }

  function askBox(cls, holdEl) {
    const box = el('div', 'wx-ask' + (cls ? ' ' + cls : '')); box.hidden = true; box.setAttribute('role', 'status');
    const t = el('span');
    box.append(t, holdEl);
    let kind = 'gust';
    const not = btn('NOT NOW', 'mini', async () => {
      box.hidden = true;
      const r = await post('/api/weather/dismiss', { kind });
      if (r && r.ok) poll();
    });
    box.append(not);
    return { box, show(s) { box.hidden = !s; if (s) { kind = s.kind; if (t.textContent !== s.text) t.textContent = s.text; } }, preset: () => (W && W.suggest && W.suggest.preset) || 'WEATHER' };
  }

  function dash() {
    const host = document.getElementById('safetyNow');
    if (host) {
      const hold = btn('HOLD', 'wx-hold');
      const a = askBox('', hold);
      hold.addEventListener('click', () => {
        const p = a.preset();
        if (window.SafetyCtl && window.SafetyCtl.openHold(p)) return;
        if (!window.SafetyCtl) location.hash = '#now';
      });
      host.before(a.box);
      listeners.push(w => a.show(WeatherView.suggestion(w)));
    }
    // The crew screen's HOLD opens NOW here with the picker on WEATHER / LIGHTNING.
    const m = location.search.match(/[?&]hold=(WEATHER|LIGHTNING)\b/);
    if (m) setTimeout(() => { if (window.SafetyCtl) window.SafetyCtl.openHold(m[1]); }, 1200);
    card();
    poll();
    setInterval(() => { if (!document.hidden) poll(); }, 30000);
  }

  function lineEl(cls) {
    const e = el('span', 'wx-line ' + cls); e.hidden = true;
    listeners.push(w => { const l = WeatherView.line(w); e.hidden = !l; if (e.textContent !== l) e.textContent = l; });
    return e;
  }

  function tv() {
    document.body.append(lineEl('wx-tv'));
    poll(); setInterval(poll, 30000);
  }

  function crew() {
    const sp = document.querySelector('.top .sp');
    if (sp && !document.getElementById("onNowWx")) sp.after(lineEl("wx-crew")); // #132: on the ON NOW row instead (crewscreen.js)
    const calls = document.querySelector('.calls');
    if (calls) {
      const a = el('a', null, 'HOLD ON NOW');
      const k = askBox('wx-crew', a);
      listeners.push(w => { const s = WeatherView.suggestion(w); k.show(s); if (s) a.href = '/?hold=' + s.preset + '#now'; });
      calls.prepend(k.box);
    }
    poll(); setInterval(poll, 30000);
  }

  // ---------------- STATUS -> NIGHT SAFETY -> WEATHER (the owner's) ----------------
  function card() {
    const c = document.getElementById('weatherCard');
    if (!c) return;
    c.classList.add('wx-card');
    let S = null;
    const body = el('div'), msg = el('div', 'note');
    c.append(el('h4', null, 'WEATHER'), body, msg);
    const say = (t, warn) => { msg.textContent = t || ''; msg.classList.toggle('warn', !!warn); };
    async function load() {
      try {
        const r = await fetch('/api/weather/settings', { cache: 'no-store' });
        if (r.status === 401 || r.status === 403) { body.replaceChildren(el('div', 'note', 'WEATHER for outdoor nights: the owner sets it here (unlock with the owner\'s password).')); return; }
        if (!r.ok) return;
        S = await r.json();
        render();
      } catch (e) {}
    }
    async function send(b, ok) {
      if (typeof unlocked !== 'undefined' && !unlocked && typeof needUnlock === 'function') return needUnlock();
      const r = await post('/api/weather/settings', b);
      const j = await r.clone().json().catch(() => ({}));
      if (r.status === 403) { say('WEATHER is the owner\'s: unlock with the owner\'s password.', true); return; }
      if (!r.ok) { if (r.status !== 401) say(j.error || 'Didn\'t save.', true); return; }
      S = j; render(); if (ok) say(ok); poll();
    }
    function render() {
      const parts = [];
      const top = el('div', 'wx-row');
      const sw = btn('WEATHER: ' + (S.on ? 'ON' : 'OFF'), S.on ? 'on' : '', () => send({ on: !S.on }, S.on ? 'WEATHER off.' : 'WEATHER on: the box asks Open-Meteo every 10 min while the night is on.'));
      sw.setAttribute('aria-pressed', S.on ? 'true' : 'false');
      top.append(sw);
      if (S.line) top.append(el('span', 'wx-now', S.line));
      parts.push(top);
      parts.push(el('div', 'note', 'For outdoor nights: wind, gusts and thunder in the next hour, on the stage clock, the TV and the crew screen. At your numbers, NOW asks once: HOLD? It never holds the show by itself.'));
      // the place
      const pl = el('div', 'wx-row');
      pl.append(el('small', null, 'PLACE: '), el('b', null, S.place ? S.place.name : 'NOT SET'));
      if (S.place) pl.append(btn('FORGET IT', 'mini', () => send({ forget: true, on: false }, 'Place forgotten. WEATHER off.')));
      parts.push(pl);
      const fr = el('div', 'wx-row');
      const q = el('input'); q.type = 'text'; q.maxLength = 80; q.placeholder = 'Town or city, or 42.36, -71.06'; q.autocomplete = 'off';
      q.setAttribute('aria-label', 'Town, city or latitude, longitude');
      const list = el('div', 'wx-places');
      const find = btn('FIND', null, async () => {
        const v = q.value.trim();
        if (!v) { say('Type a town or a city first.', true); return; }
        if (typeof unlocked !== 'undefined' && !unlocked && typeof needUnlock === 'function') return needUnlock();
        say('Looking it up…');
        const r = await post('/api/weather/find', { q: v });
        const j = await r.clone().json().catch(() => ({}));
        if (!r.ok) { if (r.status !== 401) say(j.error || 'Couldn\'t look that up.', true); return; }
        say(j.places.length > 1 ? 'Pick the right one:' : '');
        list.replaceChildren(...j.places.map(p => btn(p.name, 'mini', () => { list.replaceChildren(); q.value = ''; send({ place: p }, 'Place set: ' + p.name + '.'); })));
        if (j.places.length === 1) { list.replaceChildren(); q.value = ''; send({ place: j.places[0] }, 'Place set: ' + j.places[0].name + '.'); }
      });
      q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); find.click(); } });
      fr.append(q, find);
      parts.push(fr, list);
      parts.push(el('div', 'note', 'The place stays on this box and only goes to Open-Meteo (free weather) as its latitude and longitude: never to HARD STOP, a share link, a backup or a settings file. Looked up once, when you press FIND.'));
      // #132: tonight's venue remembers its gust number (as the LIGHTS look): offered, never applied by itself
      if (S.venueGust) {
        const vg = el('div', 'wx-row wx-venue');
        const ans = async use => {
          if (typeof unlocked !== 'undefined' && !unlocked && typeof needUnlock === 'function') return needUnlock();
          const r = await post('/api/weather/venue', { use });
          const j = await r.clone().json().catch(() => ({}));
          if (r.ok) { S = j; render(); say(use ? 'Saved.' : ''); }
        };
        vg.append(el('span', null, 'LAST TIME AT ' + S.venueGust.name + ': GUSTS ' + S.venueGust.gust + ' km/h'),
          btn('USE IT', null, () => ans(true)), btn('NOT TONIGHT', 'mini', () => ans(false))); // as LIGHTS' offer
        parts.push(vg);
      }
      // the numbers
      const nr = el('div', 'wx-row');
      const g = el('select'); g.setAttribute('aria-label', 'Gusts to ask about');
      (S.gustChoices || []).forEach(v => { const o = el('option', null, 'ASK AT GUSTS ' + v + ' km/h (' + Math.round(v * 0.621371) + ' mph)'); o.value = v; g.append(o); });
      g.value = String(S.gust);
      g.addEventListener('change', () => send({ gust: Number(g.value) }, 'Saved.'));
      const st = btn('THUNDER: ' + (S.storm ? 'ASK' : 'DON\'T ASK'), S.storm ? 'on' : '', () => send({ storm: !S.storm }, 'Saved.'));
      const u = el('select'); u.setAttribute('aria-label', 'Units');
      [['auto', 'UNITS: AUTO (' + S.unitsNow + ')'], ['kmh', 'KM/H'], ['mph', 'MPH']].forEach(([v, l]) => { const o = el('option', null, l); o.value = v; u.append(o); });
      u.value = S.units;
      u.addEventListener('change', () => send({ units: u.value }, 'Saved.'));
      nr.append(g, st, u);
      parts.push(nr);
      parts.push(el('div', 'note', 'Gusts: 50 km/h (31 mph) to start; your stage or tent supplier\'s wind plan wins, so use their number. Thunder: the usual rule is indoors at the first thunder and 30 min after the last (HOLD LIGHTNING counts that down).'));
      if (S.error) parts.push(el('div', 'note warn', 'Last read: ' + S.error));
      body.replaceChildren(...parts);
    }
    const fold = document.getElementById('go-night-safety');
    if (fold) fold.addEventListener('toggle', () => { if (fold.open) load(); });
    setTimeout(load, 1600);
    const uf = document.getElementById('unlockForm');
    if (uf) uf.addEventListener('submit', () => setTimeout(load, 800));
  }

  function start(mode) {
    if (mode === 'dash') dash();
    else if (mode === 'crew') crew();
    else tv();
  }
  return { start, suggestion, line, now: () => W };
})();
if (typeof module !== 'undefined') module.exports = WeatherView;
