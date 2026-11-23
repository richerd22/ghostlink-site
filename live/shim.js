// SEE IT LIVE: a pretend box for the real GHOST LINK pages, so they run on ghostlink.cold.fyi with no box.
// bin/livedemo.py puts it first in every page the demo hosts (the dashboard, STAGE CLOCK, NEXT UP, STREAM OVERLAY,
// NIGHT REPORT). It stands in for the box's WebSocket and /api answers; demo.js then plays made-up tracks on decks
// 1-4, the same DEMO the box offers under STATUS -> TOOLS. Nothing leaves the page: no network calls, nothing saved
// anywhere but this tab. Every button that would change the box says "In the demo nothing is sent" instead (#140).
// Tracks, artists, DJs (TICK, LIL TICK, TICK JR) and places are all made up. The answers are the box's own shapes
// (captured from the mock box), with the night laid out round the moment the page opened:
//   TICK opened, LIL TICK is on now and ends in 9 min (so the SET TIME line says DECK n FITS), TICK JR is next
//   (NEXT UP, the stage clock), SPEECHES in 24 min (MOMENTS), MUSIC OFF in 100 min (the curfew ladder is off),
//   LIGHTS on PULSE, ASK THE DJ open with 3 asks, WEATHER on and calm, a WRAP IT UP crew call for the changeover
//   (so the corner window has more lines than fit: THE LINE RULE folds the rest into +N MORE).
(function () {
  'use strict';
  var MIN = 60000;
  var VENUE = { id: 'the-roller-rink', name: 'THE ROLLER RINK', notes: '', players: 4, address: '', rooms: '', gear: '', contacts: '', wifi: [], home: false };
  var today = new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 10); // a night runs noon to noon
  var t0 = Date.now();
  function ago(min) { return t0 - min * MIN; }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function hm(ms) { var d = new Date(ms); return two(d.getHours()) + ':' + two(d.getMinutes()); }
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  var HOSTED = ["crowd.html", "dash.html", "endnight.html", "night.html", "overlay.html", "stage.html", "stream.html"]; // filled in by bin/livedemo.py from its PAGES: the box pages this demo has

  // ---------- tonight ----------
  var LINEUP = [{ dj: 'TICK', at: ago(95) }, { dj: 'LIL TICK', at: ago(50) }, { dj: 'TICK JR', at: t0 + 9 * MIN, note: 'BRINGS OWN MIXER, NEEDS 2 XLR' }];
  var OFF = t0 + 100 * MIN;
  var SPEECHES = t0 + 24 * MIN;
  var WIND = 'WIND 8 · GUSTS 14 mph';
  function onNow(now) { var on = null; LINEUP.forEach(function (s) { if (s.at <= now) on = s; }); return on; }
  function nextUp(now) { for (var i = 0; i < LINEUP.length; i++) if (LINEUP[i].at > now) return LINEUP[i]; return null; }

  // The SET TIME check (core/SetTime on the box): in the last 10 minutes of a set, does the cued track fit?
  // Read from the decks demo.js is playing in this page (S is app.js's state).
  function setTime(now) {
    var out = { check: null, pastOff: null, late: null, lateButton: true, lateUndo: false };
    var nx = nextUp(now), end = nx ? nx.at : OFF;
    if (end - now > 10 * MIN || end <= now || typeof S === 'undefined' || !S.decks) return out;
    var ds = Object.keys(S.decks).map(function (k) { return S.decks[k]; }).filter(function (d) { return d && d.load === 'LOADED'; });
    var air = ds.filter(function (d) { return d.playing; }).sort(function (a, b) { return b.positionMs / b.durationMs - a.positionMs / a.durationMs; })[0];
    var cued = ds.filter(function (d) { return !d.playing; })[0];
    if (!air) return out;
    var airEnds = now + Math.max(0, air.durationMs - air.positionMs);
    var c = { endAt: end, endIs: nx ? 'set' : 'off', nextDj: nx ? nx.dj : null,
      onAir: { deck: air.player, trackKey: air.trackKey, endsAt: airEnds, secsOver: Math.round((airEnds - end) / 1000) }, next: null, say: [], trackKey: air.trackKey };
    if (cued) {
      var cuedEnds = airEnds + cued.durationMs - 30000;
      c.next = { deck: cued.player, trackKey: cued.trackKey, endsAt: cuedEnds, secsOver: Math.round((cuedEnds - end) / 1000), playing: false };
      var so = c.next.secsOver;
      c.say.push(so > 0 ? 'DECK ' + cued.player + ' RUNS ' + Math.floor(so / 60) + ':' + two(so % 60) + ' OVER' : 'DECK ' + cued.player + ' FITS');
    }
    out.check = c;
    return out;
  }

  function status() {
    var now = Date.now(), on = onNow(now);
    return {
      time: now, unit: { name: 'GHOST LINK', number: 1, label: 'UNIT 01' }, source: 'demo', link: 'LINKED', ghost: 'linked', deviceNumber: 15,
      cable: null, djAddress: null, hardstopAt: null, set: { suggest: '', deck: 0, stick: '', guess: false }, wifi: {}, wifiNearby: [],
      wifiQuiet: null, standby: null, wifiSince: null, wifiBack: null, players: 4,
      djLinkTraffic: { arriving: true, lastPacketAt: now, ports: { 50000: { perSecond: 3.4, total: 900 }, 50001: { perSecond: 2.2, total: 600 }, 50002: { perSecond: 11, total: 4000 } } },
      uptimeSeconds: Math.round((now - t0) / 1000) + 5400, startedAt: new Date(ago(100)).toISOString(), cpuTempC: 48,
      problems: [], gearCare: [], room: null, alerts: [], crew: crew(now), asks: [], dropCalls: [],
      requests: { on: true, paused: false, open: ASKS.length, total: ASKS.length, changed: t0, library: false, clean: false, tv: true, tvLine: false },
      home: false, phase: 'NIGHT', phaseEnds: OFF, musicOffAt: OFF, goodnight: null, goodnightHardStop: false,
      lights: { on: true, mode: 'pulse' }, eon: null, autoDrop: false, wantlist: false, venue: VENUE, night: today,
      venueMusic: { doors: null, musicOff: hm(OFF), bpmLow: 0, bpmHigh: 0, repeatDays: 30, noPlay: [], notes: '' },
      audio: { card: null, live: false, recordOn: false, recording: null }, ear: null, earOn: false,
      dj: on ? on.dj : 'TICK', setTime: setTime(now), mixcloudNow: null, mixerMidi: null, songId: false,
      clockOk: true, blackbox: true, blackboxGap: null, clockBattery: null, nearby: [], ghostDeck: false, ghostDeckSendAs: 0,
      autoStop: { armed: false, at: OFF, label: hm(OFF), firedAt: null, hardstopMayStop: false, hardstopCanStopNow: false },
      deckSetup: [], safety: safety(),
      update: { onBox: false, current: null, previous: null, available: null, upToDate: null, checkedAt: null, busy: null, error: null,
        whenMusicStops: false, pending: null, last: null, page: 'ghostlink.cold.fyi/updates', off: 'This is the demo. Updates happen on the box itself.' },
      venueOk: true,
    };
  }
  // A WRAP-UP call for LIL TICK, sent from the stage a minute before the page opened, GO at the set's end; SEEN by the
  // booth. It stays up until 30 s after GO, like a real one.
  function crew(now) {
    var go = LINEUP[2].at;
    if (now > go + 30000) return [];
    return [{ id: 'gl-demo1', from: 'STAGE', txt: 'WRAP IT UP', goAt: go, in: Math.max(0, Math.round((go - now) / 1000)), go: now >= go,
      sentAt: ago(1), wrap: '10', seen: { at: ago(0.5), by: 'BOOTH' } }];
  }
  function dev(n, name, kind, ip) { return { number: n, name: name, kind: kind, address: '169.254.20.' + ip, mac: null, firstSeen: ago(100), lastSeen: Date.now() }; }
  var devices = [dev(1, 'CDJ-3000', 'PLAYER', 101), dev(2, 'CDJ-3000', 'PLAYER', 102), dev(3, 'CDJ-3000', 'PLAYER', 103), dev(4, 'CDJ-3000', 'PLAYER', 104),
    dev(15, 'GHOST LINK', 'GHOSTLINK', 20), dev(33, 'DJM-V10', 'MIXER', 133)];
  function played(min, p, title, artist, bpm, dj) { return { at: ago(min), player: p, title: title, artist: artist, bpm: bpm, trackKey: 'demo-' + min, venue: null, dj: dj }; }
  // TICK's set, then the changeover mark: PLAYED reads "TICK → LIL TICK" there.
  var PLAYED = [
    played(92, 1, 'Paper Lanterns', 'Rhea Calloway', 122, 'TICK'), played(85, 2, 'Quiet Engine', 'Somerled', 122.5, 'TICK'),
    played(77, 1, 'Blue Hour', 'Pell & Marsh', 123, 'TICK'), played(69, 3, 'Undertow', 'Kasia Dorne', 123.5, 'TICK'),
    played(60, 2, 'Static Bloom', 'Ferro', 124, 'TICK'),
    played(49, 1, 'Night Ferry', 'Odile Grant', 124, 'LIL TICK'), played(41, 3, 'Glasshouse', 'Tamsin Rook', 124.5, 'LIL TICK'),
    played(33, 2, 'Long Way Round', 'Henny Vale', 125, 'LIL TICK'), played(25, 1, 'Signal Fires', 'Ottilie Marr', 125, 'LIL TICK'),
    played(17, 3, 'Low Orbit', 'Brannock', 125.5, 'LIL TICK'), played(9, 2, 'Fog Lamp', 'Wren Calder', 126, 'LIL TICK'),
  ];
  function ev(min, kind, text) { return { at: ago(min), level: 'INFO', kind: kind, text: text }; }
  var EVENTS = [
    ev(100, 'start', 'GHOST LINK started. This is the demo: made-up decks, nothing real connected.'),
    ev(99, 'join', 'Joined as device 15. Nobody else was using it.'),
    ev(99, 'devices', 'Found 4 CDJ-3000 players and a DJM-V10 mixer.'),
    ev(95, 'dj', 'TICK is on the decks.'),
    ev(50, 'dj', 'LIL TICK is on the decks.'),
  ];

  // ASK THE DJ: three asks from the room (the tracks are demo.js's made-up ones).
  function ask(id, min, title, artist, name, note, votes) { return { id: id, title: title, artist: artist, name: name, note: note, votes: votes, state: 'OPEN', at: ago(min), lib: false, playedAt: null, answeredAt: null }; }
  var ASKS = [ask('rdemo1', 14, 'Harbour Lights', 'Tessa Quill', 'THE BIRTHDAY TABLE', 'for the birthday table', 3),
    ask('rdemo2', 8, 'Tin Roof', 'Mae Ostrow', '', '', 1), ask('rdemo3', 3, 'Overpass', 'Delancey Hart', 'BY THE BAR', '', 2)];

  function stageclock(crowd) {
    var now = Date.now(), on = onNow(now), nx = nextUp(now);
    var end = nx ? nx.at : OFF, left = Math.max(0, Math.round((end - now) / 1000));
    var next = nx ? { dj: nx.dj, at: hm(nx.at), atMs: nx.at } : null;
    if (crowd) return { state: 'SET', dj: on.dj, next: next, startsAt: null, hold: null, frozenAt: null, weather: null, at: now };
    return { state: 'SET', tone: left <= 300 ? 'red' : left <= 600 ? 'amber' : 'normal', dj: on.dj, endsAt: end, endIs: nx ? 'SET' : 'MUSIC OFF',
      left: left, over: null, startsAt: null, startsIn: null, next: next, prev: null, musicOffAt: OFF, shift: 0, at: now, hold: null, frozenAt: null,
      heldMin: 0, from: 'ghostlink', musicOff: hm(OFF), night: today, wrap: crew(now), calls: [], weather: WIND, nextNote: nx && nx.note || null };
  }
  function moment(crowd) {
    var m = { n: 'SPEECHES', at: SPEECHES }, left = SPEECHES - Date.now();
    var say = left > 30 * MIN || left <= -5 * MIN ? '' : left <= 0 ? 'SPEECHES NOW' : 'SPEECHES IN ' + Math.ceil(left / MIN);
    if (!say) return { moment: null, from: 'ghostlink', count: 1, now: Date.now() };
    m.say = say;
    if (!crowd) m.nt = 'mic 2 on';
    return crowd ? { moment: m, now: Date.now() } : { moment: m, from: 'ghostlink', count: 1, now: Date.now() };
  }
  function safety() {
    return { showStop: null, hold: null, tvLine: null, hearing: { on: false, every: 30, text: 'EARPLUGS AT THE BAR · LOOK AFTER YOUR EARS', showing: false },
      door: { on: false, n: 0, cap: null, pk: 0, from: 'box', tone: 'normal', show: false }, at: Date.now() };
  }
  function step(id, min, tv, crew, lights, osc) { return { id: id, min: min, tv: tv, crew: crew, pa: '', osc: osc, lights: lights, at: OFF - min * MIN, done: false, paName: null }; }
  function plan() {
    return { night: today, starts: hm(ago(95)), startsFrom: 'lineup', musicOff: hm(OFF), musicOffFrom: 'ghostlink',
      lineup: LINEUP.map(function (s) { return { start: hm(s.at), dj: s.dj }; }), lineupFrom: 'ghostlink', onTheDecks: onNow(Date.now()).dj, hardstopAt: null, home: false, homeFrom: null };
  }
  function report() {
    var sets = [
      { dj: 'TICK', n: 1, from: null, actualStart: ago(94), actualEnd: ago(50), tracks: 5, plannedStart: ago(95), plannedEnd: ago(50), lateMin: null, overMin: null },
      { dj: 'LIL TICK', n: 2, from: 'TICK', actualStart: ago(49), actualEnd: null, tracks: 6, plannedStart: ago(50), plannedEnd: LINEUP[2].at, lateMin: null, overMin: null },
      { dj: 'TICK JR', actualStart: null, actualEnd: null, tracks: 0, plannedStart: LINEUP[2].at, plannedEnd: OFF, lateMin: null, overMin: null, noMusic: true }];
    return { night: today, venue: VENUE.name, home: false, schedule: true, musicOff: hm(OFF), musicOffAt: OFF, startedAt: ago(94), stoppedAt: null, playing: true,
      minutesOver: 0, kept: null, sets: sets, overruns: [],
      music: { tracks: PLAYED.length, minutes: 94, hours: '1h 34m', bpmLow: 122, bpmHigh: 126,
        longest: { title: 'Blue Hour', artist: 'Pell & Marsh', dj: 'TICK', at: ago(77), playedMs: 468000 },
        djs: [{ dj: 'TICK', tracks: 5, bpmLow: 122, bpmHigh: 124 }, { dj: 'LIL TICK', tracks: 6, bpmLow: 124, bpmHigh: 126 }] },
      box: { crewCalls: 1, wifiDrops: 0, standBy: 0, deadAir: 0, restarts: 0, card: 0, warnings: 0, notes: 1 }, recordings: [], tonight: true,
      doorPeak: null, weather: { gust: 16, wind: 9, units: 'mph', gustAt: ago(70), storm: false, stormAt: null },
      log: [{ at: ago(100), kind: 'RESTART', tag: null, text: 'GHOST LINK started (run 1).', from: null, warn: false },
        { at: ago(52), kind: 'CREW', tag: null, text: 'Crew call: 5 MIN to TICK (wrap-up).', from: 'GHOST LINK', warn: false },
        { at: ago(50), kind: 'NOTE', tag: null, text: 'Changeover on time. LIL TICK on.', from: 'the owner', warn: false }],
      royalty: { djs: [{ sets: 1, tracks: 5, dj: 'TICK' }, { sets: 1, tracks: 6, dj: 'LIL TICK' }],
        sets: [{ n: 1, dj: 'TICK', from: null, start: ago(94), end: ago(50), tracks: 5 }, { n: 2, dj: 'LIL TICK', from: 'TICK', start: ago(49), end: Date.now(), tracks: 6 }],
        societies: [{ id: 'generic', name: 'Any other society', region: '', columns: ['#', 'Date', 'Start time', 'Venue', 'Venue address', 'DJ', 'Artist', 'Title', 'Duration played', 'BPM', 'Set'],
          how: 'Everything GHOST LINK knows about each track, for any society, a promoter\'s form or your own records.' }], venue: null, address: null } };
  }

  // Open on DECKS unless the address names a tab (the dashboard otherwise reopens the tab used last).
  try { if (page === 'dash' && !location.hash) localStorage.removeItem('lastView'); } catch (e) {}

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
  FakeSocket.prototype.addEventListener = function (k, f) { this['on' + k] = f; };
  FakeSocket.prototype.close = function () { clearInterval(this._t); this.readyState = 3; };
  FakeSocket.CONNECTING = 0; FakeSocket.OPEN = 1; FakeSocket.CLOSING = 2; FakeSocket.CLOSED = 3;
  window.WebSocket = FakeSocket;

  // ---------- the box's /api ----------
  var SENT = 'In the demo nothing is sent.';
  var API = {
    status: status, plan: plan, nights: [today],
    schedule: function () { return [{ date: today, venue: VENUE.id, lineup: plan().lineup, notes: '', musicOff: hm(OFF), doors: null, preset: null }]; },
    setnotes: function () { var o = {}; o[today] = { 'tick jr': LINEUP[2].note }; return o; },
    'schedule/moments': function () { return { date: today, text: hm(SPEECHES) + ' SPEECHES // mic 2 on', list: [{ t: hm(SPEECHES), n: 'SPEECHES', nt: 'mic 2 on' }] }; },
    'moments/next': function (q) { return moment(/view=crowd/.test(q)); },
    stageclock: function (q) { return stageclock(/view=crowd/.test(q)); },
    mixer: { controls: [], device: '' }, rooms: { self: '', others: [] },
    osc: { sent: 0, targets: [] }, whoami: { remote: false }, tracklist: { shared: false, remote: false }, sticks: [],
    unit: { name: 'GHOST LINK', number: 1, label: 'UNIT 01', short: null },
    // Unlocked, so the buttons work like the owner's (and say "nothing is sent"); never the default password.
    auth: { owner: false, unlocked: true, mustChange: false, defaultPassword: false },
    firstrun: { show: false, done: true, mustChange: false, unlocked: true, owner: false, kinds: [], kindsAt: 0, front: [], links: [], catalogue: [], venues: [] },
    venues: { current: VENUE.id, venues: [VENUE] }, track: { tonight: [], past: [] }, history: function () { return { tracks: PLAYED.slice(), night: today }; },
    stats: { nights: 1, tracks: PLAYED.length, hours: 1.5, since: today, unique: PLAYED.length, topTracks: [], topArtists: [] },
    'hardstop/live': { np: null, dead: false, crew: [] }, 'hardstop/hub': { seen: false },
    lights: function () {
      var c = typeof S !== 'undefined' && S.decks && Object.keys(S.decks).map(function (k) { return S.decks[k]; }).filter(function (d) { return d && d.onAir && d.info; })[0];
      return { on: true, mode: 'pulse', pixels: 60, start: 1, brightness: 60, blackout: false,
        events: { crew: true, stages: true, drop: true, silence: true, goodnight: true, phrases: false }, phrase: 'CHORUS',
        targets: [{ kind: 'ddp', host: 'wled-booth.local', port: 4048, universe: 0, rgbw: false, two: false, ok: true }],
        hardStop: false, testing: false, showing: 'pulse', sending: true, colour: (c && c.info.color) || '#2fb8ff', stage: 'normal', held: 0, venueLook: null };
    },
    'requests/all': function () { var r = status().requests; r.asks = ASKS; r.at = Date.now(); return r; },
    'requests/where': { lan: 'http://ghostlink.local/ask.html', anywhere: null, anywhereLive: false, exp: null },
    'requests/blocked': { blocked: [], max: 500, len: 40 },
    weather: function () { return { on: true, line: WIND, offline: false, units: 'mph', wind: 8, gust: 14, gustHour: 14, storm: false, readAt: Date.now() - 4 * MIN, suggest: null, at: Date.now() }; },
    'weather/settings': { on: true, place: { name: 'THE ROLLER RINK · OUTDOOR STAGE' }, units: 'auto', unitsNow: 'mph', gust: 50, gustChoices: [40, 50, 60, 70, 80, 90, 100], storm: true, line: WIND, readAt: t0, error: null, venueGust: null },
    safety: safety,
    'safety/settings': function () {
      return { ladder: { on: false, steps: [step('30', 30, '30 MIN TO GO', '', '', ''), step('10', 10, '10 MIN TO GO', '', 'orange', ''), step('5', 5, '', 'wrap5', '', ''), step('1', 1, 'LAST MINUTE', '', '', '/ghostlink/ladder/last')],
        musicOffAt: OFF, musicOffFrom: 'ghostlink', paChoices: [], announcements: false, appAutoCalls: false, hearing: safety().hearing },
        paClip: null, paClipName: null, paLines: [], announcements: false, door: safety().door,
        stopPresets: ['STOP THE MUSIC', 'CLEAR THE FLOOR', 'MEDICAL'], holdPresets: ['WEATHER', 'LIGHTNING', 'STAGE FIX', 'SAFETY'] };
    },
    'night/report': report,
    onstream: function () {
      return { hideIds: false, titles: false, start: { from: 'night', at: ago(94) }, clockSet: false, nudged: 0, now: 1, decks: [],
        played: PLAYED.slice(-4).map(function (t) { return { at: t.at, title: t.title, artist: t.artist, listed: false, says: false }; }), hidden: [] };
    },
    // SHOW CONTROL (#123 VISUALS LINK, the OSC targets): everything off, as on a new box (the box's own answer).
    showctl: function () {
      var o = {"bpm":124.0,"live":true,"link":{"on":false,"available":true,"included":true,"problem":null,"peers":0,"sessionBpm":120.0,"lastSend":0,"sending":false},"midi":{"on":false,"device":"auto","port":null,"problem":null,"sending":false,"jitterMicros":0,"devices":[]},"visuals":{"on":false,"cuesOn":false,"layers":{"1":1,"2":2,"3":3,"4":4,"5":5,"6":6},"rules":[],"fallback":0,"cues":[],"clearOff":false,"sent":0,"last":"","decks":[],"phrases":{"player":1,"has":true,"why":""},"host":"","port":7000,"lastSend":0,"sending":false}}, t = {"on":false,"host":"","port":7000,"prefix":"","master":0,"exec":"","dropColumn":0,"trackColumn":0,"passcode":"","scene":"","crewCue":"","offCue":"","lastSend":0,"sending":false,"sent":0,"last":""};
      o.targets = {};
      [['resolume', 7000], ['grandma3', 8000], ['qlab', 53000], ['madmapper', 8000], ['magicq', 8000], ['millumin', 0], ['synesthesia', 0], ['touchdesigner', 0]].forEach(function (k) {
        var c = JSON.parse(JSON.stringify(t)); c.port = k[1]; if (k[0] === 'grandma3') c.master = 1; if (k[0] === 'touchdesigner') c.prefix = 'gl'; o.targets[k[0]] = c;
      });
      return o;
    },
    // END OF NIGHT card (endnight.html) and THE NIGHT'S SHAPE: tonight so far.
    endofnight: function () {
      return { night: today, venue: VENUE.name, tracks: PLAYED.length, from: ago(94), to: Date.now(), minutes: 94, hours: '1h 34m', djs: ['TICK', 'LIL TICK'],
        bpmLow: 122, bpmHigh: 126, avgBpm: 124.2,
        transitions: { count: 10, clean: 7, gallopIndex: null, cleanest: { at: ago(41), sec: 34, bars: 17.1, dj: 'LIL TICK', cleanPct: 92, gi: 1.2, maxDecks: 2, sync: true }, longest: null, worst: null },
        records: [], hardStop: { musicOff: hm(OFF), musicOffAt: OFF, stoppedAt: null, playing: true, secondsBefore: null, kept: null },
        shared: false, tracklist: null, ready: false, tonight: true, home: false };
    },
    tracklist: function () { return { night: today, shared: false, remote: false }; },
    // NIGHTS -> PLAN A NIGHT's "READS AS" line: the box's parse, simply (a time and a name a line; no time = all night).
    'schedule/parse': function (q) {
      var text = decodeURIComponent(((q.match(/[?&]lineup=([^&]*)/) || [0, ''])[1]).replace(/\+/g, ' '));
      var out = [];
      text.split(/\r?\n/).forEach(function (l) {
        l = l.split('//')[0].trim();
        if (!l) return;
        var m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s+(.+)$/i.exec(l), h;
        if (m && (m[2] || m[3])) { h = +m[1] % 12 + (/pm/i.test(m[3] || '') ? 12 : 0); if (!m[3]) h = +m[1]; out.push({ start: two(h % 24) + ':' + (m[2] || '00'), dj: m[4].trim() }); }
        else out.push({ start: '12:00', dj: l });
      });
      return { notes: {}, lineup: out };
    },
    share: { max: 50, nightEnd: OFF, remoteOff: 'off', links: [], short: null }, 'nights/home': [],
    keys: { max: 20, scopes: ['read', 'crew', 'soundboard', 'record'], keys: [] },
    sheet: { night: null, source: null, url: null, follow: false, applied: [], appliedAt: null, readAt: null, okAt: null, changedAt: null, lastError: null, canUndo: false, live: false, tonight: today, hardstop: false },
  };
  function json(code, body) { return Promise.resolve(new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } })); }
  var realFetch = window.fetch && window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var m = /^(?:https?:\/\/[^/]+)?\/api\/([^?#]*)(\?[^#]*)?/.exec(url);
    if (!m) return /^https?:/.test(url) || !realFetch ? json(404, { error: SENT }) : realFetch(input, init);
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'GET') { toast(); return json(403, { error: SENT, demo: true }); } // never 401: that opens the lock
    var a = API[m[1]];
    if (a === undefined) return json(200, {});
    return json(200, typeof a === 'function' ? a(m[2] || '') : a);
  };
  if (navigator.sendBeacon) navigator.sendBeacon = function () { toast(); return true; };

  // ---------- "In the demo nothing is sent": one calm line at the bottom, never a pile ----------
  var toastEl = null, toastT = 0;
  function toast() {
    if (!document.body) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'demoToast'; toastEl.setAttribute('role', 'status');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;max-width:calc(100% - 32px);box-sizing:border-box;'
        + 'background:#000;color:#fff;border:1px solid #444;padding:8px 14px;font:600 12px/1.3 "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.08em;'
        + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;transition:opacity .3s;';
      toastEl.textContent = SENT.toUpperCase().replace('.', '') + ' · ON A BOX THIS WORKS';
      document.body.appendChild(toastEl);
    }
    toastEl.style.opacity = '1';
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.style.opacity = '0'; }, 2600);
  }
  window.DemoShim = { toast: toast, page: page };

  // Pictures the box draws (the QR codes: /api/qr.svg): a plain stand-in, never a request that can't be answered.
  var QR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/>'
    + '<rect x="8" y="8" width="26" height="26" fill="none" stroke="#000" stroke-width="6"/><rect x="66" y="8" width="26" height="26" fill="none" stroke="#000" stroke-width="6"/>'
    + '<rect x="8" y="66" width="26" height="26" fill="none" stroke="#000" stroke-width="6"/><text x="50" y="56" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">DEMO</text></svg>');
  function fixImg(i) { var v = i.getAttribute && i.getAttribute('src'); if (v && /^\/api\//.test(v)) i.setAttribute('src', QR); }
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, /^(?:https?:\/\/[^/]+)?\/api\//.test(String(v)) ? QR : v); } });
  } catch (e) {}
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      if (m.type === 'attributes') fixImg(m.target);
      else m.addedNodes.forEach(function (n) { if (n.nodeType !== 1) return; if (n.tagName === 'IMG') fixImg(n); if (n.querySelectorAll) n.querySelectorAll('img').forEach(fixImg); });
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });

  // ---------- the page around it ----------
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.getElementById('demoBar');
    var BAR = 'DEMO · made-up tracks, no box needed. Tap around.';
    if (bar) { var s = bar.querySelector('span'); if (s) s.textContent = BAR; }
    var end = document.getElementById('demoEnd'); if (end) end.remove();
    // Box pages this demo doesn't have (TV, arcade, song ...): say so instead of a broken link. Downloads too.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href') || '';
      var file = h.split(/[?#]/)[0].replace(/^\//, '');
      var hosted = HOSTED.indexOf(file === 'index.html' || file === '' ? 'dash.html' : file) >= 0;
      if ((/^\/?[a-z-]+\.html/.test(h) && !hosted) || /^http:\/\//.test(h) || /^\/api\//.test(h)) {
        e.preventDefault();
        var say = /^\/api\//.test(h) ? 'In the demo there is nothing to download.' : 'That page lives on the box. Everything else here works.';
        var s2 = bar && bar.querySelector('span');
        if (s2 && !bar.hidden) { s2.textContent = say; setTimeout(function () { s2.textContent = BAR; }, 3500); }
        else toast();
      } else if (hosted && /^\//.test(h)) { e.preventDefault(); window.open(file + h.slice(h.indexOf(file) + file.length), a.target || '_self'); }
    }, true);
    // Forms that would post to the box (none should, but never let one leave the page).
    document.addEventListener('submit', function (e) { var f = e.target; if (f && f.getAttribute && f.getAttribute('action')) { e.preventDefault(); toast(); } }, true);
  });
  if (page === 'dash') window.addEventListener('load', function () { setTimeout(function () { try { if (typeof Demo !== 'undefined' && !Demo.on) Demo.start(); } catch (e) {} }, 400); });
})();
