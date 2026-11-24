'use strict';
// DEMO: shows the whole dashboard working with nothing plugged in, for showing a tech, a venue manager or another
// DJ. Real decks stay real; any of players 1-4 without a real track gets a made-up one that plays, mixes and
// hands over like a set. Lives only in this browser tab's page: nothing is sent to the box, nothing is logged,
// and other phones never see it. Start: STATUS -> TOOLS -> DEMO, or add ?demo=1 to the address.
const Demo = (() => {
  const TRACKS = [
    ['Harbour Lights', 'Tessa Quill', 124, '8A', 'House', '#2fb8ff'],
    ['Second Wind', 'Arlo Venn', 125, '9A', 'House', '#ffb000'],
    ['Copper Wire', 'Noor Fallon', 126, '8B', 'Techno', '#ff2a2a'],
    ['Saltwater Radio', 'June Ashby', 124, '7A', 'Deep House', '#3cd070'],
    ['Late Shift', 'Corran', 127, '9B', 'Tech House', '#b36bff'],
    ['Tin Roof', 'Mae Ostrow', 125, '8A', 'UK Garage', '#ff7ab6'],
    ['Overpass', 'Delancey Hart', 128, '10A', 'Techno', '#2fb8ff'],
    ['Kettle Hum', 'Ivo Brandt', 123, '7B', 'House', '#ffb000'],
  ];
  const PER_SEC = 150; // waveform columns per second, same as the players' detail waveform
  // How many made-up decks: 4, or ?decks=1..4 with ?demo=1 (#143: the website's calm demo shows 2).
  const PLAYERS = [1, 2, 3, 4].slice(0, Math.min(4, Math.max(1, +new URLSearchParams(location.search).get('decks') || 4)));
  let on = false, timer = null, next = 0, fake = {};
  const real = {}; // what the box last said about players we're covering, put back when the demo ends

  function wave(bpm, durMs, phrases) {
    const n = Math.floor(durMs / 1000 * PER_SEC), d = new Uint8Array(n * 4);
    let seed = bpm * 7919;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const ms = i / PER_SEC * 1000, beat = ms / (60000 / bpm), ph = beat % 1;
      const sec = phrases.find(p => ms >= p.startMs && ms < p.endMs);
      const k = sec ? sec.kind : 'INTRO';
      const energy = k === 'CHORUS' ? 1 : k === 'UP' ? 0.8 : k === 'DOWN' ? 0.45 : 0.6;
      const kick = k !== 'DOWN' && ph < 0.09;
      const h = kick ? 24 + rnd() * 7 : (6 + rnd() * 12) * energy + (beat % 2 > 1.5 ? 4 : 0);
      d[i * 4] = Math.min(31, h);
      d[i * 4 + 1] = kick ? 190 + rnd() * 40 : 60 + rnd() * 60;
      d[i * 4 + 2] = kick ? 120 + rnd() * 50 : 170 + rnd() * 60;
      d[i * 4 + 3] = kick ? 110 + rnd() * 40 : 120 + rnd() * 120;
    }
    const m = 400, o = new Uint8Array(m * 4);
    for (let j = 0; j < m; j++) {
      let s = 0, c = 0; const a = Math.floor(j / m * n), b = Math.floor((j + 1) / m * n);
      for (let i = a; i < b; i++) { s += d[i * 4]; c++; }
      const src = Math.min(n - 1, a) * 4;
      o[j * 4] = c ? Math.min(31, s / c * 1.6) : 0; o[j * 4 + 1] = 90; o[j * 4 + 2] = 190; o[j * 4 + 3] = 170;
      if (d[src] > 22) o[j * 4 + 1] = 200;
    }
    return { detail: d, overview: o, perSec: PER_SEC };
  }

  function load(p, startFrac, playing) {
    const t = TRACKS[next++ % TRACKS.length];
    const [title, artist, bpm, key, genre, color] = t;
    const beatMs = 60000 / bpm, bar = beatMs * 4;
    const kinds = ['INTRO', 'UP', 'CHORUS', 'DOWN', 'UP', 'CHORUS', 'OUTRO'];
    const phrases = []; let at = 0, beat = 1;
    for (const kind of kinds) { const len = 16 * bar; phrases.push({ kind, startMs: at, endMs: at + len, startBeat: beat }); at += len; beat += 64; }
    const durMs = Math.round(at);
    const trackKey = 'demo:' + p + ':' + next;
    fake[p] = {
      player: p, load: 'LOADED', model: 'CDJ-3000', title, artist, trackKey, hasArtwork: false, demo: true,
      trackBpm: bpm, pitch: 0, effectiveBpm: bpm, durationMs: durMs, positionMs: durMs * startFrac,
      playing, onAir: playing, master: false, cuesMs: [phrases[1].startMs, phrases[2].startMs, phrases[5].startMs],
      info: { key, genre, color, beatNumber: 1, beatInBar: 1, cued: !playing },
    };
    const w = wave(bpm, durMs, phrases);
    S.waves[p] = { key: trackKey, ...w };
    S.structs[p] = { trackKey, phrases };
  }

  function tick() {
    const ps = PLAYERS.filter(p => !(S.decks[p] && S.decks[p].load === 'LOADED' && !S.decks[p].demo));
    for (const p in fake) if (!ps.includes(+p)) delete fake[p]; // a real track arrived: it wins
    // Real music playing? Then the made-up decks just sit cued next to it; the real ones stay on air and MASTER.
    const realPlaying = Object.values(S.decks).some(d => !d.demo && d.load === 'LOADED' && d.playing);
    ps.forEach((p, i) => { if (!fake[p]) load(p, i === 0 && !realPlaying ? 0.35 : 0, i === 0 && !realPlaying); });
    if (realPlaying) for (const d of Object.values(fake)) { d.playing = false; d.onAir = false; d.master = false; d.info.cued = true; }
    const live = Object.values(fake).filter(d => d.playing);
    for (const d of Object.values(fake)) {
      if (d.playing) d.positionMs = Math.min(d.durationMs, d.positionMs + 500 * (1 + d.pitch / 100));
      d.info.beatNumber = Math.floor(d.positionMs / (60000 / d.effectiveBpm)) + 1;
      d.info.beatInBar = (d.info.beatNumber - 1) % 4 + 1;
      // Handover: when a playing track reaches its last third, the next cued deck starts and takes over.
      if (d.playing && d.positionMs > d.durationMs * 0.66 && live.length < 2) {
        const nx = Object.values(fake).find(x => !x.playing);
        if (nx) { nx.playing = true; nx.onAir = true; nx.info.cued = false; nx.pitch = +(d.effectiveBpm / nx.trackBpm * 100 - 100).toFixed(2); nx.effectiveBpm = d.effectiveBpm; }
      }
      if (d.playing && d.positionMs >= d.durationMs - 500) { d.playing = false; d.onAir = false; setTimeout(() => { if (on && fake[d.player] === d) load(d.player, 0, false); }, 3000); }
    }
    // MASTER: the outgoing track until it's nearly done, then the incoming one.
    const playing = Object.values(fake).filter(d => d.playing).sort((a, b) => b.positionMs / b.durationMs - a.positionMs / a.durationMs);
    const m = playing.length > 1 && playing[0].positionMs > playing[0].durationMs * 0.85 ? playing[1] : playing[0];
    Object.values(fake).forEach(d => { d.master = !realPlaying && d === m; });
    for (const d of Object.values(fake)) { setDeck({ ...d, info: { ...d.info } }); renderDeck(d.player); }
    try { nowShape = null; } catch (e) {}
  }

  function start() {
    if (on) return;
    on = true; S.demo = true;
    for (const p of [1, 2, 3, 4]) if (S.decks[p]) real[p] = S.decks[p];
    document.documentElement.classList.add('demo');
    $('demoBar').hidden = false;
    tick(); timer = setInterval(tick, 500);
    renderDecks(); renderHeader();
  }
  function stop() {
    if (!on) return;
    on = false; S.demo = false;
    clearInterval(timer);
    for (const p in fake) {
      delete S.waves[p]; delete S.structs[p];
      if (real[p] && real[p].load !== 'LOADED') S.decks[p] = real[p]; else delete S.decks[p];
      const t = tiles[p]; if (t) { t.root.remove(); delete tiles[p]; }
      document.querySelector(`#stack [data-player="${p}"]`)?.remove();
    }
    fake = {};
    document.documentElement.classList.remove('demo');
    $('demoBar').hidden = true;
    renderDecks(); renderHeader();
  }
  /** Called for each message from the box; true means "this player is the demo's, ignore". */
  function takes(type, data) {
    if (!on || !data) return false;
    const p = data.player;
    if (!fake[p]) return false;
    if (type === 'deck' && data.load !== 'EMPTY') { delete fake[p]; return false; } // a real track loading: hand it back
    if (type === 'deck') real[p] = data;
    return true;
  }
  $('demoEnd').addEventListener('click', stop);
  document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => { start(); location.hash = 'decks'; }));
  if (new URLSearchParams(location.search).get('demo') === '1') setTimeout(start, 300);
  return { start, stop, takes, get on() { return on; } };
})();
