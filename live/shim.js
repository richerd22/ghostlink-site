// SEE IT LIVE: a pretend box for the real GHOST LINK dashboard, so it runs on ghostlink.cold.fyi with no box.
// Loaded before app.js (bin/site puts it there). It stands in for the box's WebSocket and /api answers; demo.js then
// plays made-up tracks on decks 1-4, the same DEMO the box offers under STATUS -> TOOLS. Nothing leaves the page:
// no network calls, nothing saved anywhere but this tab. Track names, artists and DJs are all invented.
(function () {
  'use strict';
  var today = new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 10); // a night runs noon to noon
  var t0 = Date.now();
  function ago(min) { return t0 - min * 60000; }

  function status() {
    return {
      time: Date.now(), source: 'demo', link: 'LINKED', ghost: 'linked', deviceNumber: 15, cable: null, djAddress: null,
      hardstopAt: null, set: { suggest: '', deck: 0, stick: '', guess: false }, wifi: {}, players: 4,
      djLinkTraffic: { arriving: true, lastPacketAt: Date.now(), ports: { 50000: { perSecond: 3.4, total: 900 }, 50001: { perSecond: 2.2, total: 600 }, 50002: { perSecond: 11, total: 4000 } } },
      uptimeSeconds: Math.round((Date.now() - t0) / 1000) + 5400, startedAt: new Date(ago(90)).toISOString(), cpuTempC: 48,
      problems: [], gearCare: [], room: null, alerts: [], crew: [], venue: null, night: today,
      venueMusic: { doors: null, musicOff: null, bpmLow: 0, bpmHigh: 0, repeatDays: 30, noPlay: [], notes: '' },
      audio: { card: null, live: false, recordOn: false, recording: null }, dj: 'TICK', mixerMidi: null, songId: false,
      clockOk: true, blackbox: true, clockBattery: null, nearby: [], ghostDeck: false, ghostDeckSendAs: 0,
      autoStop: { armed: false, at: null, label: null, firedAt: null, hardstopMayStop: false, hardstopCanStopNow: false },
      deckSetup: [],
      update: { onBox: false, current: null, previous: null, available: null, upToDate: null, checkedAt: null, busy: null, error: null,
        whenMusicStops: false, pending: null, last: null, page: 'ghostlink.cold.fyi/updates', off: 'This is the demo. Updates happen on the box itself.' },
      venueOk: false,
    };
  }
  function dev(n, name, kind, ip) { return { number: n, name: name, kind: kind, address: '169.254.20.' + ip, mac: null, firstSeen: ago(90), lastSeen: Date.now() }; }
  var devices = [dev(1, 'CDJ-3000', 'PLAYER', 101), dev(2, 'CDJ-3000', 'PLAYER', 102), dev(3, 'CDJ-3000', 'PLAYER', 103), dev(4, 'CDJ-3000', 'PLAYER', 104),
    dev(15, 'GHOST LINK', 'GHOSTLINK', 20), dev(33, 'DJM-V10', 'MIXER', 133)];
  function played(min, p, title, artist, bpm, dj) { return { at: ago(min), player: p, title: title, artist: artist, bpm: bpm, trackKey: 'demo-' + min, venue: null, dj: dj }; }
  var PLAYED = [
    played(88, 1, 'Paper Lanterns', 'Rhea Calloway', 122, 'LIL TICK'), played(82, 2, 'Quiet Engine', 'Somerled', 122.5, 'LIL TICK'),
    played(75, 1, 'Blue Hour', 'Pell & Marsh', 123, 'LIL TICK'), played(68, 3, 'Undertow', 'Kasia Dorne', 123.5, 'LIL TICK'),
    played(60, 2, 'Static Bloom', 'Ferro', 124, 'TICK'), played(53, 1, 'Night Ferry', 'Odile Grant', 124, 'TICK'),
    played(46, 3, 'Glasshouse', 'Tamsin Rook', 124.5, 'TICK'), played(39, 2, 'Long Way Round', 'Henny Vale', 125, 'TICK'),
  ];
  function ev(min, kind, text) { return { at: ago(min), level: 'INFO', kind: kind, text: text }; }
  var EVENTS = [
    ev(90, 'start', 'GHOST LINK started. This is the demo: made-up decks, nothing real connected.'),
    ev(89, 'join', 'Joined as device 15. Nobody else was using it.'),
    ev(89, 'devices', 'Found 4 CDJ-3000 players and a DJM-V10 mixer.'),
    ev(61, 'dj', 'TICK is on the decks.'),
  ];

  // Open on DECKS unless the address names a tab (the dashboard otherwise reopens the tab used last).
  try { if (!location.hash) localStorage.removeItem('lastView'); } catch (e) {}

  // ---------- the box's WebSocket ----------
  function FakeSocket() {
    var ws = this;
    ws.readyState = 0;
    setTimeout(function () {
      ws.readyState = 1;
      if (ws.onopen) ws.onopen({});
      ws._say('hello', { status: status(), devices: devices, decks: [], waveforms: {}, kept: {}, structures: {}, played: PLAYED.slice(), events: EVENTS.slice() });
      ws._t = setInterval(function () { ws._say('status', status()); }, 1000);
    }, 60);
  }
  FakeSocket.prototype._say = function (type, data) { if (this.onmessage) this.onmessage({ data: JSON.stringify({ type: type, data: data }) }); };
  FakeSocket.prototype.send = function () {};
  FakeSocket.prototype.close = function () { clearInterval(this._t); this.readyState = 3; };
  FakeSocket.CONNECTING = 0; FakeSocket.OPEN = 1; FakeSocket.CLOSING = 2; FakeSocket.CLOSED = 3;
  window.WebSocket = FakeSocket;

  // ---------- the box's /api ----------
  var NOPE = 'This is the demo, so there is no box to change. On a real box this works.';
  var API = {
    status: status, plan: function () { return { night: today, starts: '21:00', startsFrom: 'default', musicOff: null, musicOffFrom: null, lineup: [], lineupFrom: null, onTheDecks: 'TICK', hardstopAt: null }; },
    nights: function () { return [today]; }, schedule: [], mixer: { controls: [], device: '' }, rooms: { self: '', others: [] },
    osc: { sent: 0, targets: [] }, whoami: { remote: false }, tracklist: { shared: false, remote: false }, sticks: [],
    unit: { name: 'GHOST LINK' }, auth: { owner: false, unlocked: false, mustChange: false, defaultPassword: false },
    venues: { current: null, venues: [] }, track: { tonight: [], past: [] }, history: function () { return { tracks: PLAYED.slice() }; },
    stats: { nights: 1, tracks: PLAYED.length, hours: 1.5, since: today, unique: PLAYED.length, topTracks: [], topArtists: [] },
    'hardstop/live': { np: null, dead: false, crew: [] },
  };
  function json(code, body) { return Promise.resolve(new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } })); }
  var realFetch = window.fetch && window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var m = /^(?:https?:\/\/[^/]+)?\/api\/([^?#]*)/.exec(url);
    if (!m) return /^https?:/.test(url) || !realFetch ? json(404, { error: NOPE }) : realFetch(input, init);
    var method = ((init && init.method) || 'GET').toUpperCase();
    if (method !== 'GET') return json(403, { error: NOPE, locked: true });
    var a = API[m[1]];
    if (a === undefined) return json(200, {});
    return json(200, typeof a === 'function' ? a() : a);
  };

  // ---------- the page around it ----------
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.getElementById('demoBar');
    if (bar) { var s = bar.querySelector('span'); if (s) s.textContent = 'DEMO · made-up tracks, no box needed. Tap around.'; }
    var end = document.getElementById('demoEnd'); if (end) end.remove();
    // Pages that only exist on a box (TV, arcade, song): say so instead of a broken link.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href');
      if (/^[a-z-]+\.html/.test(h) || /^http:\/\//.test(h)) {
        e.preventDefault();
        if (bar) { var s2 = bar.querySelector('span'); if (s2) { s2.textContent = 'That page lives on the box. Everything else here works.'; setTimeout(function () { s2.textContent = 'DEMO · made-up tracks, no box needed. Tap around.'; }, 3500); } }
      }
    }, true);
  });
  window.addEventListener('load', function () { setTimeout(function () { try { if (typeof Demo !== 'undefined' && !Demo.on) Demo.start(); } catch (e) {} }, 400); });
})();
