'use strict';
// GHOST DANCES (DECISIONS #92, more in #106). Richard, Nov 20: "all the animations are so good. but they def repeat ...
// we should stockpile a ton." Nov 21: "gotta expand. Make em repeat less and less. Always more haha."
// A library of small on-beat moves for the B SHEET ghost, picked by the music: the master deck's section (rekordbox
// phrases: CHORUS = high, UP / VERSE / BRIDGE = mid, INTRO / DOWN / OUTRO = low; no phrases = by BPM) and its tempo
// (some moves only fit slow or fast music). A new move every 4 bars (or as soon as the section changes), always on a
// downbeat. When the section changes kind (the drop lands, the breakdown starts) he does a one-bar flourish first.
// REPEATS (#106): one shuffle bag per kind, kept on this phone / laptop across reloads (localStorage 'ghostDances'):
// every move of a kind plays once before any comes round again, never the one dancing now, never one of the last
// three, and among the rest the ones he hasn't done in longest are likelier (new moves come up soon after an update).
// Over 150 BPM he dances half time so nothing moves more than ~2.5 times a second (the booth rule for flashing).
// The ghost stays the ghost: only the body sides, the hem and a few pixels of lean / hop / squash / skew change; the
// eyes and the hat belong to the moods in fun.js. Used by fun.js (the header ghost and the little one on the decks),
// the arcade's menu (BOO) and the TV visualizer. No timers of its own: it moves only when a beat arrives.
const Dance = (() => {
  // Body lines (rows 3 and 4 of 5). 9 columns, the last is the spare one on the right: an arm lives there. A mirrored
  // pose (m) flips the whole ghost, so the arm is on the left. Row 3's inside is where an egg's grin goes (fun.js);
  // a few moves borrow it to sing along, and give it back the moment an egg wants it (dress only fills plain rows).
  const BODY = {
    n:     ['|      | ', '|      | '],
    hr:    ['|      | ', ' |      |'], // hips right
    hl:    [' |      |', '|      | '], // shoulders right (hips left)
    up:    ['|      |/', '|      | '], // arm up
    out:   ['|      |-', '|      | '], // arm out
    dn:    ['|      | ', '|      |\\'], // arm down and out
    pt:    ['|      |`', '|      | '], // finger to the sky
    // #106
    hip:   ['|      | ', '|      |>'], // hand on hip
    low:   ['|      | ', '|      |_'], // hand low, sweeping
    wig:   ['|      |~', '|      | '], // jazz hand
    star:  ['|      |/', '|      |\\'], // arm up and leg out: a star
    lean:  [' |      |', ' |      |'], // the whole body leans off the hem
    sing:  ['|   o  | ', '|      | '], // singing along
    shout: ['|   O  | ', '|      | '], // the drop, out loud
  };
  // The hem (row 5).
  const HEM = {
    n: ' \\/\\/\\/  ',
    f: ' /\\/\\/\\  ', // flutter
    r: '  \\/\\/\\/ ', // swish right
    l: '\\/\\/\\/   ',  // swish left
    k: ' \\/\\/\\/\\_', // a kick
    w: ' \\_/\\_/  ',  // ripple
    // #106
    b: '/\\/\\/\\/\\ ',  // flared out wide
    t: ' \\/\\/\\/. ', // a toe tap
    j: '_\\/\\/\\/  ',  // kick the other way
  };
  // [name, tiers, [min BPM, max BPM], poses (one per beat, looped)]. A pose: x / y px (at size M), r degrees, sx / sy
  // scale, k skew degrees, m mirrored, b body, h hem, back = spring back to rest after a hit, snap = no easing.
  const MOVES = [
    // --- low: intros, breakdowns, outros ---
    ['nod', 'low mid', [0, 999], [{ y: 1, back: 1 }, {}, {}, {}]], // the original
    ['sway', 'low', [0, 140], [{ r: -4, x: -1 }, { r: 4, x: 1 }]],
    ['breathe', 'low', [0, 999], [{ y: -1, sy: 1.04 }, {}, { y: -1, sy: 1.04 }, {}]],
    ['drift', 'low', [0, 135], [{ x: -2, h: 'r' }, { x: -1 }, { x: 2, h: 'l' }, { x: 1 }]],
    ['double nod', 'low', [0, 999], [{ y: 1, back: 1 }, {}, { y: 1, back: 1 }, {}]],
    ['hem flutter', 'low mid', [0, 999], [{ h: 'f' }, { h: 'n' }]],
    ['slow lean', 'low', [0, 130], [{ r: -5 }, { r: -5 }, { r: 5 }, { r: 5 }]],
    ['float wave', 'low', [0, 999], [{ b: 'up', y: -1 }, {}, {}, {}, { b: 'up', m: 1, y: -1 }, { m: 1 }, { m: 1 }, { m: 1 }]],
    ['ripple', 'low mid', [0, 999], [{ h: 'w' }, { h: 'n' }, { h: 'w' }, { h: 'f' }]],
    // #106
    ['lullaby', 'low', [0, 999], [{ r: -3, y: -1 }, { r: -3 }, { r: 3, y: -1 }, { r: 3 }]],
    ['hum', 'low', [0, 999], [{ b: 'sing' }, {}, { b: 'sing' }, {}]],
    ['tiptoe', 'low', [0, 999], [{ y: -2, sy: 1.03, h: 't' }, {}, { y: -2, sy: 1.03, h: 't', m: 1 }, { m: 1 }]],
    ['rocking chair', 'low', [0, 125], [{ r: -6, y: 1 }, { r: -2 }, { r: 6, y: 1 }, { r: 2 }]],
    ['lantern', 'low', [0, 999], [{ b: 'low' }, { b: 'low', y: -1 }, { b: 'out' }, { b: 'low' }]],
    ['peek', 'low', [0, 999], [{ x: -3, r: -6 }, { x: -3, r: -6 }, {}, {}]],
    ['big stretch', 'low', [0, 999], [{ b: 'up', sy: 1.05, y: -1 }, { b: 'up', sy: 1.05, y: -1 }, {}, {}]],
    ['bob', 'low mid', [0, 999], [{ y: -1 }, {}, { y: -1 }, { y: 1, back: 1 }]],
    ['sea legs', 'low', [0, 130], [{ k: -6, h: 'r' }, { k: 6, h: 'l' }]],
    ['moonlight', 'low', [0, 999], [{ b: 'pt', y: -1 }, { b: 'pt' }, {}, {}]],
    ['slow spin', 'low', [0, 120], [{}, {}, { sx: 0.5 }, { m: 1 }, { m: 1 }, { m: 1 }, { m: 1, sx: 0.5 }, {}]],
    ['hover', 'low', [0, 999], [{ y: -2 }, { y: -3 }, { y: -2 }, { y: -1 }]],
    ['candle', 'low', [0, 999], [{ sy: 1.03, k: 3 }, { k: -3 }, { sy: 1.03, k: 3 }, { k: -3 }]],
    ['wallflower', 'low', [0, 999], [{ x: -2, b: 'hip' }, { x: -2, b: 'hip' }, { x: -2, b: 'hip', y: 1, back: 1 }, { x: -2, b: 'hip' }]],
    ['jelly', 'low mid', [0, 999], [{ sx: 1.04, sy: 0.96 }, {}, { sx: 0.97, sy: 1.03 }, {}]],
    ['daydream', 'low', [0, 999], [{ b: 'lean', r: 2 }, { b: 'lean', r: 2 }, {}, {}]],
    ['tide', 'low', [0, 128], [{ x: -1, h: 'l' }, { x: -2, h: 'w' }, { x: 1, h: 'r' }, { x: 2, h: 'w' }]],
    // --- mid: verses, builds ---
    ['bounce', 'mid', [0, 999], [{ y: -3, back: 1 }]],
    ['hip sway', 'mid', [0, 999], [{ b: 'hr', x: 1 }, { b: 'hl', x: -1 }]],
    ['wave', 'mid', [0, 999], [{ b: 'up' }, { b: 'out' }, { b: 'up' }, { b: 'out' }]],
    ['step touch', 'mid', [0, 140], [{ x: 3, h: 'l' }, { x: 3 }, { x: -3, h: 'r' }, { x: -3 }]],
    ['shimmy', 'mid high', [100, 999], [{ r: 3 }, { r: -3 }, { r: 3 }, { r: -3 }]],
    ['wobble', 'mid', [0, 999], [{ sx: 1.06, sy: 0.94 }, { sx: 0.96, sy: 1.04 }]],
    ['two step', 'mid', [0, 999], [{ x: -2, y: -1, b: 'hl' }, {}, { x: 2, y: -1, b: 'hr' }, {}]],
    ['disco point', 'mid high', [0, 999], [{ b: 'pt', r: -4 }, {}, { b: 'pt', m: 1, r: 4 }, { m: 1 }]],
    ['kick', 'mid', [0, 999], [{ h: 'k' }, {}, { h: 'k', m: 1 }, { m: 1 }]],
    ['robot', 'mid', [0, 999], [{ x: 2, snap: 1 }, { b: 'out', x: 2, snap: 1 }, { x: -2, snap: 1 }, { b: 'dn', x: -2, snap: 1 }]],
    ['moonwalk', 'mid', [0, 132], [{ x: -1, h: 'r' }, { x: -2 }, { x: -3, h: 'r' }, { snap: 1 }]],
    ['lasso', 'mid high', [0, 999], [{ b: 'up' }, { b: 'out' }, { b: 'dn' }, { b: 'out' }]],
    // #106
    ['finger snap', 'mid', [0, 999], [{}, { b: 'wig', y: -1, back: 1 }, {}, { b: 'wig', y: -1, back: 1 }]],
    ['skank', 'mid', [0, 999], [{ b: 'out', x: 2, h: 'k' }, { b: 'dn', x: -1 }, { b: 'out', x: 2, h: 'k', m: 1 }, { b: 'dn', x: -1, m: 1 }]],
    ['running man', 'mid high', [110, 999], [{ h: 'k', y: -1 }, { h: 'r' }, { h: 'k', m: 1, y: -1 }, { h: 'r', m: 1 }]],
    ['cabbage patch', 'mid', [0, 999], [{ x: -2, y: -1, b: 'out' }, { y: -2, b: 'up' }, { x: 2, y: -1, b: 'out' }, { b: 'dn' }]],
    ['vogue', 'mid', [0, 999], [{ b: 'up', r: -4, snap: 1 }, { b: 'up', r: -4 }, { b: 'out', m: 1, r: 4, snap: 1 }, { b: 'out', m: 1, r: 4 }]],
    ['bop', 'mid', [0, 999], [{ y: -2, back: 1, b: 'hr' }, {}, { y: -2, back: 1, b: 'hl' }, {}]],
    ['lean in', 'mid', [0, 135], [{ x: -2, b: 'lean' }, { x: -2, b: 'lean' }, { x: 2, b: 'lean', m: 1 }, { x: 2, b: 'lean', m: 1 }]],
    ['the twist', 'mid', [0, 999], [{ b: 'hr', k: -5 }, { b: 'hl', k: 5 }]],
    ['sprinkler', 'mid', [0, 999], [{ b: 'out', r: -3 }, { b: 'out', r: -1 }, { b: 'out', r: 1 }, { b: 'up', r: 3 }]],
    ['jazz hands', 'mid high', [0, 999], [{ b: 'wig', y: -1 }, { b: 'wig', m: 1, y: -1 }, { b: 'wig' }, { b: 'wig', m: 1 }]],
    ['heel toe', 'mid', [0, 999], [{ h: 't' }, { h: 'k' }, { h: 't', m: 1 }, { h: 'k', m: 1 }]],
    ['groove', 'mid', [0, 999], [{ y: 1, sy: 0.97 }, { y: -1 }, { y: 1, sy: 0.97 }, { y: -1, b: 'hr' }]],
    ['sing along', 'mid', [0, 999], [{ b: 'sing' }, { b: 'sing', r: -3 }, {}, { b: 'sing', r: 3 }]],
    ['the bump', 'mid', [0, 999], [{ x: 3, b: 'hr', back: 1 }, {}, { x: -3, b: 'hl', back: 1 }, {}]],
    ['electric slide', 'mid', [0, 130], [{ x: -2, snap: 1 }, { x: -4, snap: 1 }, { x: -2, snap: 1 }, { snap: 1, h: 'k' }]],
    ['lawnmower', 'mid', [0, 999], [{ b: 'low', r: -3 }, { b: 'out', r: 2, y: -1 }, { b: 'low', r: -3 }, { b: 'up', r: 4, y: -1 }]],
    ['chill nod', 'mid', [0, 999], [{ y: 1, r: -2, back: 1 }, {}, { y: 1, r: 2, back: 1 }, {}]],
    ['roll call', 'mid', [0, 999], [{ b: 'pt' }, { b: 'out' }, { b: 'dn' }, { b: 'low' }]],
    ['hand on hip', 'mid', [0, 999], [{ b: 'hip', r: -3 }, { b: 'hip' }, { b: 'hip', r: -3, h: 't' }, { b: 'hip' }]],
    ['swing', 'mid', [90, 128], [{ k: -4, x: -1 }, { k: -4, x: -1, y: -1 }, { k: 4, x: 1 }, { k: 4, x: 1, y: -1 }]],
    // --- high: the drop, the chorus ---
    ['jump', 'high', [0, 999], [{ y: -5, sy: 1.05, back: 1 }]],
    ['spin', 'high', [0, 999], [{}, { sx: 0.35 }, { m: 1 }, { m: 1, sx: 0.35 }]],
    ['headbang', 'high', [120, 999], [{ r: 7, y: 1 }, { r: 0, y: -1 }]],
    ['pogo', 'high', [115, 999], [{ y: -6, back: 1 }, {}, { y: -6, back: 1 }, {}]],
    ['hands up', 'high', [0, 999], [{ b: 'up', y: -4 }, {}, { b: 'up', m: 1, y: -4 }, { m: 1 }]],
    ['stomp', 'high', [0, 999], [{ sy: 0.9, y: 1, h: 'f' }, { sy: 1.04, y: -2 }]],
    ['wiggle', 'high mid', [0, 999], [{ b: 'hr', h: 'l' }, { b: 'hl', h: 'r' }]],
    ['shuffle', 'high', [118, 999], [{ x: 2, h: 'r' }, { x: -2, h: 'l' }]],
    ['victory', 'high', [0, 999], [{ b: 'up', y: -3, r: -3 }, { b: 'up', m: 1, y: -3, r: 3 }]],
    ['tilt bounce', 'high', [0, 999], [{ r: -5, y: -2, back: 1 }, { r: 5, y: -2, back: 1 }]],
    ['big wave', 'high', [0, 999], [{ b: 'up', r: -3 }, { b: 'out' }, { b: 'up', m: 1, r: 3 }, { b: 'out', m: 1 }]],
    // #106
    ['star jump', 'high', [0, 999], [{ b: 'star', y: -5, sy: 1.05, back: 1 }, {}]],
    ['shout along', 'high', [0, 999], [{ b: 'shout', y: -2 }, {}, { b: 'shout', y: -2 }, {}]],
    ['dab', 'high', [0, 999], [{ b: 'up', r: -8, y: 1, snap: 1 }, { b: 'up', r: -8, y: 1 }, {}, { y: -2, back: 1 }]],
    ['air punch', 'high', [0, 999], [{ b: 'pt', y: -3, back: 1 }, {}, { b: 'pt', y: -3, back: 1, m: 1 }, { m: 1 }]],
    ['bunny hop', 'high', [115, 999], [{ y: -4, x: 1, back: 1 }, { y: -4, x: 1, back: 1 }, { y: -4, x: -1, back: 1 }, { y: -4, x: -1, back: 1 }]],
    ['rave hands', 'high', [120, 999], [{ b: 'wig', y: -2 }, { b: 'up', y: -2 }, { b: 'wig', m: 1, y: -2 }, { b: 'up', m: 1, y: -2 }]],
    ['windmill', 'high', [0, 999], [{ b: 'up', r: 4 }, { b: 'out', r: 2 }, { b: 'dn' }, { b: 'low', r: -2 }]],
    ['bounce out', 'high', [0, 999], [{ y: -4, sx: 1.05, h: 'b', back: 1 }, { h: 'n' }]],
    ['jump spin', 'high', [0, 999], [{ y: -4 }, { y: -4, sx: 0.35 }, { m: 1, y: -2 }, { m: 1 }]],
    ['skip', 'high', [0, 999], [{ y: -3, x: 2, h: 'k', back: 1 }, { x: 2 }, { y: -3, x: -2, h: 'k', m: 1, back: 1 }, { x: -2, m: 1 }]],
    ['flare', 'high', [0, 999], [{ h: 'b', sx: 1.06 }, { h: 'n' }, { h: 'b', sx: 1.06 }, { h: 'f' }]],
    ['rocket', 'high', [0, 999], [{ sy: 0.92, y: 1 }, { sy: 0.92, y: 1 }, { sy: 1.08, y: -6, back: 1 }, {}]],
    ['fist pump', 'high', [0, 999], [{ b: 'pt', y: -2, back: 1 }, { b: 'low' }, { b: 'pt', y: -2, back: 1 }, { b: 'low' }]],
    ['wild one', 'high', [125, 999], [{ r: -6, b: 'hr', h: 'r' }, { r: 6, b: 'hl', h: 'l' }, { r: -6, y: -2, b: 'up' }, { r: 6, y: -2, b: 'up', m: 1 }]],
    ['knees up', 'high', [0, 999], [{ h: 'k', y: -2 }, {}, { h: 'j', y: -2 }, {}]],
    ['drop stomp', 'high', [0, 999], [{ sy: 0.88, y: 2, h: 'b', snap: 1 }, {}, { sy: 0.88, y: 2, h: 'b', snap: 1 }, {}]],
    ['half time', 'high', [140, 999], [{ y: 1, sy: 0.95 }, {}, { y: -3, b: 'up', back: 1 }, {}]],
    ['big skank', 'high', [0, 999], [{ b: 'out', x: 3, h: 'k', y: -1 }, { b: 'dn', x: -1 }, { b: 'out', x: 3, h: 'k', m: 1, y: -1 }, { b: 'dn', x: -1, m: 1 }]],
  ].map(([name, tiers, bpm, poses]) => ({ name, tiers: tiers.split(' '), bpm, poses }));

  // FLOURISHES (#106): one bar when the section changes kind, then a fresh move. Own bag, same rules.
  const FLOURISHES = [
    ['ta da', [{ b: 'star', y: -3 }, { b: 'star', y: -3 }, {}, {}]],
    ['pop in', [{ sy: 0.9, y: 1 }, { sy: 1.06, y: -3, back: 1 }, {}, {}]],
    ['spin in', [{ sx: 0.35 }, { m: 1 }, { m: 1, sx: 0.35 }, {}]],
    ['shake off', [{ r: 4 }, { r: -4 }, { r: 3 }, {}]],
    ['look around', [{ x: -2 }, { x: 2, m: 1 }, { m: 1 }, {}]],
    ['drum roll', [{ y: -1, back: 1 }, { y: -1, back: 1 }, { y: -2, back: 1 }, { y: -3, back: 1 }]],
    ['here we go', [{ b: 'pt', y: -2 }, { b: 'pt', y: -2 }, { b: 'up', y: -3, back: 1 }, {}]],
  ].map(([name, poses]) => ({ name, tiers: ['enter'], bpm: [0, 999], poses, flourish: true }));
  const ALL = MOVES.concat(FLOURISHES);

  /** low / mid / high from a section name (rekordbox phrases), else from the tempo. */
  function tierOf(kind, bpm) {
    if (kind) {
      if (/CHORUS/.test(kind)) return 'high';
      if (/INTRO|DOWN|OUTRO/.test(kind)) return 'low';
      return 'mid'; // UP, VERSE n, BRIDGE
    }
    return bpm && bpm < 100 ? 'low' : 'mid';
  }

  // The memory: { n: picks so far, last: { move: n when last picked }, bags: { tier: [moves not yet played] } }.
  // Read and written at each pick (every 4 bars), so two tabs or the arcade and the dashboard share it.
  const KEY = 'ghostDances';
  function localStore() {
    let mem = null;
    return {
      load() { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return mem; },
      save(v) { mem = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} },
    };
  }
  function memoryStore() { let v = null; return { load: () => v && JSON.parse(JSON.stringify(v)), save: x => { v = JSON.parse(JSON.stringify(x)); } }; }
  const names = new Set(ALL.map(x => x.name));
  function clean(st) {
    const out = { n: 0, last: {}, bags: {} };
    if (!st || typeof st !== 'object') return out;
    if (Number.isFinite(st.n) && st.n >= 0) out.n = Math.floor(st.n);
    if (st.last && typeof st.last === 'object') for (const k of Object.keys(st.last)) if (names.has(k) && Number.isFinite(st.last[k])) out.last[k] = Math.min(st.last[k], out.n);
    if (st.bags && typeof st.bags === 'object') for (const t of ['low', 'mid', 'high', 'enter']) if (Array.isArray(st.bags[t])) out.bags[t] = st.bags[t].filter(k => names.has(k));
    return out;
  }

  /** One dancer: step() on every beat of the master deck. rand and store are for the tests. */
  function make(rand, store) {
    rand = rand || Math.random;
    store = store || (typeof localStorage !== 'undefined' ? localStore() : memoryStore());
    let cur = null, tier = '', beats = 0;
    const byName = Object.fromEntries(ALL.map(x => [x.name, x]));
    function pool(t, bpm) {
      const all = ALL.filter(x => x.tiers.includes(t));
      const p = all.filter(x => bpm >= x.bpm[0] && bpm <= x.bpm[1]);
      return { all, p: p.length >= 2 ? p : all };
    }
    function pick(t, bpm) {
      const st = clean(store.load());
      const { all, p } = pool(t, bpm), here = new Set(p.map(x => x.name));
      const fits = bag => bag.filter(k => here.has(k) && (!cur || k !== cur.name));
      let bag = fits(st.bags[t] || []);
      if (!bag.length) { st.bags[t] = all.map(x => x.name); bag = fits(st.bags[t]); }
      if (!bag.length) bag = p.map(x => x.name).filter(k => !cur || k !== cur.name);
      if (!bag.length) bag = [p[0].name];
      // not one of the last three picks if anything else is left
      const recent = Object.keys(st.last).sort((a, b) => st.last[b] - st.last[a]).slice(0, 3);
      let ok = bag.filter(k => !recent.includes(k));
      if (!ok.length) ok = bag;
      // the longer since he last did it, the likelier (never done = as if 200 picks ago)
      const w = ok.map(k => { const age = Math.min(200, k in st.last ? st.n - st.last[k] : 200); return age * age + 1; });
      let r = rand() * w.reduce((a, b) => a + b, 0), i = 0;
      while (i < ok.length - 1 && (r -= w[i]) >= 0) i++;
      const m = ok[i];
      st.last[m] = st.n++;
      for (const k of Object.keys(st.bags)) st.bags[k] = st.bags[k].filter(x => x !== m);
      store.save(st);
      return byName[m];
    }
    /** b = beat in bar (1-4). Returns the pose for this beat, or null to hold (half time). */
    function step(b, t, bpm) {
      bpm = bpm || 120;
      const half = bpm > 150, len = (cur && cur.flourish ? 4 : 16) * (half ? 2 : 1);
      if (b === 1 && (!cur || beats >= len || t !== tier)) {
        // a new kind of section (not the first move of the night): one bar of flourish, then the move
        cur = cur && t !== tier && !cur.flourish ? pick('enter', bpm) : pick(t, bpm);
        tier = t; beats = 0;
      }
      if (!cur) return null; // joined mid-bar: wait for the downbeat
      const n = beats++;
      if (half && n % 2) return null;
      const i = half ? n / 2 : n;
      return Object.assign({ move: cur.name }, cur.poses[i % cur.poses.length]);
    }
    return { step, get move() { return cur && cur.name; }, reset() { cur = null; tier = ''; beats = 0; } };
  }

  /** The pose's rows 3-5 into a ghost's lines, only where the moods left the plain body / hem (coffee, masks stay). */
  function dress(L, pose) {
    if (!pose) return L;
    const plain = s => s && s.trimEnd() === '|      |';
    const body = BODY[pose.b] || BODY.n;
    if (plain(L[2])) L[2] = body[0];
    if (plain(L[3])) L[3] = body[1];
    if (L[4] && L[4].trim() === '\\/\\/\\/' && pose.h && HEM[pose.h]) L[4] = HEM[pose.h];
    return L;
  }

  /** CSS transform for a pose, k = the ghost's size (S 0.8 ... XL 1.9). */
  function css(pose, k) {
    if (!pose) return '';
    k = k || 1;
    const x = (pose.x || 0) * k, y = (pose.y || 0) * k, sx = (pose.sx || 1) * (pose.m ? -1 : 1), sy = pose.sy || 1;
    if (!x && !y && !pose.r && !pose.k && sx === 1 && sy === 1) return '';
    const f = v => Math.round(v * 100) / 100;
    return `translate(${f(x)}px, ${f(y)}px) rotate(${pose.r || 0}deg)${pose.k ? ` skewX(${pose.k}deg)` : ''} scale(${f(sx)}, ${f(sy)})`;
  }
  /** How long the move into a pose takes (ms): a third of a beat, at most 220. */
  const ease = bpm => Math.round(Math.min(220, 0.4 * 60000 / (bpm || 120)));

  return { MOVES, FLOURISHES, BODY, HEM, tierOf, make, dress, css, ease, memoryStore };
})();
if (typeof module !== 'undefined') module.exports = Dance;
