'use strict';
// DJ PROFILE (#154): dj.html?dj=NAME, one DJ across their nights on this box: nights and hours on air, their usual
// set time, tempo range and keys, most played, venues (the owner only), each night (tap = SET INSIGHTS) and their
// own GHOST WRAPPED (wrapped.html?dj=). dj.html alone = every DJ on the box. From GET /api/night/dj (crew code or
// owner; never WATCH FROM HOME). Read-only. Text nodes only (names and titles come from the network).
// The helpers are pure (src/test/js/dj154.test.js).
const DjPage = (() => {
  const pad = n => String(n).padStart(2, '0');
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  /** "2026-11-12" -> "NOV 12" (and the year when it isn't this one). */
  function day(n, thisYear) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(n || ''));
    if (!m) return '';
    return MON[+m[2] - 1] + ' ' + (+m[3]) + (thisYear && +m[1] !== thisYear ? ' ' + m[1] : '');
  }
  function hhmm(ms) { if (ms == null) return '--:--'; const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /** 125 -> "2h 05m", 40 -> "40 min". */
  function dur(min) { if (min == null) return '--'; min = Math.round(min); return min >= 60 ? Math.floor(min / 60) + 'h ' + pad(min % 60) + 'm' : min + ' min'; }
  /** ms -> "12.5 h" / "40 min" */
  function hours(ms) { const m = Math.round((ms || 0) / 60000); return m >= 60 ? (Math.round(m / 6) / 10) + ' h' : m + ' min'; }
  const name = t => (t && t.title ? t.title : 'Unknown track') + (t && t.artist ? ' - ' + t.artist : '');

  /** "23:00-01:05 · 2h 05m" (+ "· SATURDAYS" when one day is most of their nights). */
  function setLine(u) {
    if (!u || !u.start) return '';
    return u.start + '-' + u.end + ' · ' + dur(u.minutes) + (u.day ? ' · ' + u.day + 'S' : '');
  }
  /** "Usually 124-128 BPM · 120-134 in all · avg 126.1". */
  function tempoLine(t) {
    if (!t) return '';
    const usual = t.usualLow === t.usualHigh ? t.usualLow + ' BPM' : t.usualLow + '-' + t.usualHigh + ' BPM';
    const all = t.low === t.high ? '' : ' · ' + Math.round(t.low) + '-' + Math.round(t.high) + ' in all';
    return 'usually ' + usual + all + ' · avg ' + t.avg;
  }
  /** One night's row: "22:10-23:40 · 14 tracks" (+ venue for the owner). */
  function nightLine(n) {
    return hhmm(n.from) + '-' + hhmm(n.to) + ' · ' + n.tracks + (n.tracks === 1 ? ' track' : ' tracks') + (n.venue ? ' · ' + n.venue : '');
  }
  /** Camelot -> SET DNA's key colour (colour that carries data). */
  function keyColour(cam) {
    const m = /^(\d+)([AB])$/.exec(cam || '');
    return m ? 'hsl(' + ((+m[1] - 1) * 30) + ', 85%, ' + (m[2] === 'A' ? 52 : 66) + '%)' : '#777';
  }
  const link = dj => 'dj.html?dj=' + encodeURIComponent(dj);

  if (typeof document === 'undefined') return { day, hhmm, dur, hours, setLine, tempoLine, nightLine, keyColour, link };

  // ---------- the page ----------
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function num(host, label, value) { const d = el('div'); d.append(el('small', null, label), el('b', null, value)); host.append(d); }
  function row(host, a, b, href) { const r = el(href ? 'a' : 'div', 'row'); if (href) r.href = href; r.append(el('span', null, a), el('b', null, b)); host.append(r); return r; }
  const year = new Date().getFullYear();

  function list(j) {
    const c = $('card');
    c.replaceChildren(el('h1', null, 'DJS ON THIS BOX'));
    const djs = j.djs || [];
    c.append(el('div', 'sub', djs.length + (djs.length === 1 ? ' DJ' : ' DJS') + ' · SHOW NIGHTS ONLY'));
    if (!djs.length) { c.append(el('div', 'line', 'No DJ names on file yet. Name who is on the decks on NOW and they show here after their night.')); return; }
    c.append(el('h2', null, 'TAP ONE'));
    for (const d of djs) row(c, d.dj, d.nights + (d.nights === 1 ? ' night' : ' nights') + ' · last ' + day(d.lastNight, year), link(d.dj));
    $('allDjs').hidden = true;
    document.title = 'GHOST LINK DJS';
  }

  function render(p) {
    const c = $('card');
    c.replaceChildren(el('h1', null, p.dj.toUpperCase()));
    c.append(el('div', 'sub', p.nights === 1 ? 'ONE NIGHT ON THIS BOX · ' + day(p.lastNight, year) : 'ON THIS BOX SINCE ' + day(p.firstNight, year) + ' · LAST ' + day(p.lastNight, year)));
    const n = el('div', 'nums');
    num(n, 'NIGHTS HERE', String(p.nights));
    num(n, 'ON AIR', hours(p.onAirMs));
    num(n, 'TRACKS', String(p.tracks));
    if (p.unique !== p.tracks) num(n, 'DIFFERENT', String(p.unique));
    c.append(n);
    if (p.tonightLeftOut) c.append(el('div', 'line', "Tonight joins this page once the music stops (the owner's password shows it now)."));

    c.append(el('h2', null, 'THEIR USUAL SET'));
    row(c, p.nights > 1 ? 'Usually' : 'Their set', setLine(p.usual));

    if (p.tempo || (p.keys || []).length) {
      c.append(el('h2', null, 'TEMPO AND KEYS'));
      if (p.tempo) row(c, 'Tempo', tempoLine(p.tempo));
      if ((p.keys || []).length) {
        const k = el('div', 'keys');
        for (const x of p.keys) { const s = el('span'); const i = el('i'); i.style.background = keyColour(x.key); i.setAttribute('aria-hidden', 'true'); s.append(i, document.createTextNode(x.key + ' · ' + x.pct + '%')); k.append(s); }
        c.append(k);
        c.append(el('div', 'line', 'Their most used Camelot keys, of the ' + p.keyed + ' tracks with a key.'));
      }
    }

    c.append(el('h2', null, 'MOST PLAYED'));
    if (!(p.mostPlayed || []).length) c.append(el('div', 'line', 'Nothing twice yet: a different track every time.'));
    for (const t of p.mostPlayed || []) row(c, name(t), t.count + ' times');
    if ((p.topArtists || []).length) for (const a of p.topArtists.slice(0, 3)) row(c, a.name, a.count + ' tracks · artist');

    if (p.venuesShown && (p.venues || []).length) {
      c.append(el('h2', null, 'VENUES · ONLY YOU SEE THIS'));
      for (const v of p.venues) row(c, v.name, v.nights + (v.nights === 1 ? ' night' : ' nights'));
    }

    c.append(el('h2', null, 'THEIR NIGHTS'));
    const nights = p.perNight || [];
    nights.slice(0, 30).forEach(x => row(c, day(x.night, year), nightLine(x), 'setinsights.html?night=' + encodeURIComponent(x.night)));
    if (nights.length > 30) c.append(el('div', 'line', 'And ' + (nights.length - 30) + ' earlier nights.'));

    const w = p.wrapped || {};
    c.append(el('h2', null, 'GHOST WRAPPED'));
    if (w.personality) row(c, 'The ghost says', w.personality.name);
    const go = el('div', 'go'), a = el('a', 'btn', 'THEIR GHOST WRAPPED');
    a.href = 'wrapped.html?dj=' + encodeURIComponent(p.dj);
    go.append(a);
    c.append(go);
    c.append(el('div', 'line', 'Cards and a picture to save or hand to them. Nothing is sent anywhere.'));
    c.append(el('div', 'foot', 'From PLAYED on this box. Show nights only: practice nights never count. ON AIR = each track until the next one went on.'));
    const wb = $('wrapped'); wb.href = a.href; wb.hidden = false;
    document.title = 'GHOST LINK DJ ' + p.dj.toUpperCase();
  }

  async function load() {
    const dj = new URLSearchParams(location.search).get('dj') || '';
    let r;
    try { r = await fetch('/api/night/dj' + (dj ? '?dj=' + encodeURIComponent(dj) : ''), { cache: 'no-store' }); }
    catch (e) { $('msg').textContent = "Couldn't reach the box. Check the Wi-Fi and reload."; return; }
    if (r.status === 401 || r.status === 403) {
      const j = await r.json().catch(() => ({}));
      $('msg').hidden = false;
      $('msg').textContent = r.status === 401 ? "DJ pages are for the crew: enter the password or tonight's crew code." : (j.error || 'Not from here.');
      $('unlock').hidden = r.status !== 401;
      if (!$('unlock').hidden) $('pw').focus();
      $('card').hidden = true;
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { $('msg').hidden = false; $('msg').textContent = j.error || 'Nothing on file for that DJ.'; return; }
    $('msg').hidden = true;
    $('unlock').hidden = true;
    $('card').hidden = false;
    if (dj) render(j); else list(j);
  }

  function page() {
    $('unlock').addEventListener('submit', async e => {
      e.preventDefault();
      const r = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) }).catch(() => null);
      $('pw').value = '';
      if (r && r.ok) load();
      else $('msg').textContent = 'Wrong password or code. After 5 tries, wait a minute.';
    });
    load();
  }

  return { day, hhmm, dur, hours, setLine, tempoLine, nightLine, keyColour, link, page };
})();
if (typeof module !== 'undefined') module.exports = DjPage;
