'use strict';
// GHOST DANCES (DECISIONS #92). Richard, Nov 20: "all the animations are so good. but they def repeat ... we should
// stockpile a ton." A library of small on-beat moves for the B SHEET ghost, picked by the music: the master deck's
// section (rekordbox phrases: CHORUS = high, UP / VERSE / BRIDGE = mid, INTRO / DOWN / OUTRO = low; no phrases = by
// BPM) and its tempo. A new move every 4 bars (or as soon as the section changes), always on a downbeat, never the
// same move twice in a row, and every move of a kind gets its turn before any comes round again (a shuffle bag).
// Over 150 BPM he dances half time so nothing moves more than ~2.5 times a second (the booth rule for flashing).
// The ghost stays the ghost: only the body sides, the hem and a few pixels of lean / hop / squash change; the eyes and
// the hat belong to the moods in fun.js. Used by fun.js (the header ghost and the little one on the decks) and the
// arcade's menu (BOO). No timers of its own: it moves only when a beat arrives.
const Dance = (() => {
  // Body lines (rows 3 and 4 of 5). 9 columns, the last is the spare one on the right: an arm lives there. A mirrored
  // pose (m) flips the whole ghost, so the arm is on the left.
  const BODY = {
    n:   ['|      | ', '|      | '],
    hr:  ['|      | ', ' |      |'], // hips right
    hl:  [' |      |', '|      | '], // shoulders right (hips left)
    up:  ['|      |/', '|      | '], // arm up
    out: ['|      |-', '|      | '], // arm out
    dn:  ['|      | ', '|      |\\'], // arm down and out
    pt:  ['|      |`', '|      | '], // finger to the sky
  };
  // The hem (row 5).
  const HEM = {
    n: ' \\/\\/\\/  ',
    f: ' /\\/\\/\\  ', // flutter
    r: '  \\/\\/\\/ ', // swish right
    l: '\\/\\/\\/   ',  // swish left
    k: ' \\/\\/\\/\\_', // a kick
    w: ' \\_/\\_/  ',  // ripple
  };
  // [name, tiers, [min BPM, max BPM], poses (one per beat, looped)]. A pose: x / y px (at size M), r degrees, sx / sy
  // scale, m mirrored, b body, h hem, back = spring back to rest after a hit, snap = no easing (the robot).
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
  ].map(([name, tiers, bpm, poses]) => ({ name, tiers: tiers.split(' '), bpm, poses }));

  /** low / mid / high from a section name (rekordbox phrases), else from the tempo. */
  function tierOf(kind, bpm) {
    if (kind) {
      if (/CHORUS/.test(kind)) return 'high';
      if (/INTRO|DOWN|OUTRO/.test(kind)) return 'low';
      return 'mid'; // UP, VERSE n, BRIDGE
    }
    return bpm && bpm < 100 ? 'low' : 'mid';
  }

  /** One dancer: step() on every beat of the master deck. Own state, so the header ghost and BOO never share a bag. */
  function make(rand) {
    rand = rand || Math.random;
    let cur = null, tier = '', beats = 0, recent = [];
    const bags = {};
    function pool(t, bpm) {
      const p = MOVES.filter(x => x.tiers.includes(t) && bpm >= x.bpm[0] && bpm <= x.bpm[1]);
      return p.length >= 2 ? p : MOVES.filter(x => x.tiers.includes(t));
    }
    function pick(t, bpm) {
      const p = pool(t, bpm), key = t + '|' + p.map(x => x.name).join();
      let bag = bags[t] && bags[t].key === key ? bags[t].left : null;
      if (!bag || !bag.length) bag = p.slice();
      // never the one dancing now; never one of the last three if there's anything else
      let ok = bag.filter(x => x !== cur && !recent.includes(x));
      if (!ok.length) ok = bag.filter(x => x !== cur);
      if (!ok.length) { bag = p.filter(x => x !== cur); ok = bag; }
      const m = ok[Math.floor(rand() * ok.length)] || p[0];
      bags[t] = { key, left: bag.filter(x => x !== m) };
      recent = [m, ...recent].slice(0, 3);
      return m;
    }
    /** b = beat in bar (1-4). Returns the pose for this beat, or null to hold (half time). */
    function step(b, t, bpm) {
      bpm = bpm || 120;
      const half = bpm > 150;
      if (b === 1 && (!cur || beats >= 16 * (half ? 2 : 1) || t !== tier)) { cur = pick(t, bpm); tier = t; beats = 0; }
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
    if (!x && !y && !pose.r && sx === 1 && sy === 1) return '';
    const f = v => Math.round(v * 100) / 100;
    return `translate(${f(x)}px, ${f(y)}px) rotate(${pose.r || 0}deg) scale(${f(sx)}, ${f(sy)})`;
  }
  /** How long the move into a pose takes (ms): a third of a beat, at most 220. */
  const ease = bpm => Math.round(Math.min(220, 0.4 * 60000 / (bpm || 120)));

  return { MOVES, BODY, HEM, tierOf, make, dress, css, ease };
})();
if (typeof module !== 'undefined') module.exports = Dance;
