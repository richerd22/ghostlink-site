'use strict';
// STAGE CLOCK (DECISIONS #124): what stage.html shows, from GET /api/stageclock (the box does the state; StageClock.java).
// view(feed, now) turns one reading into the words and digits on the screen, counting down / up from the box's own
// times between polls, so the digits move every second even if a poll is late. Pure: tested by src/test/js/stageclock.test.js.
// The page (stage.html) only puts these strings into text nodes.
const StageClockView = (() => {
  const MIN = 60000;
  /** normal / amber (10 min) / red (5 min) / pulse (last minute) / over: the same steps as StageClock.tone. */
  function tone(leftMs) {
    return leftMs <= 0 ? 'over' : leftMs <= MIN ? 'pulse' : leftMs <= 5 * MIN ? 'red' : leftMs <= 10 * MIN ? 'amber' : 'normal';
  }
  /** 12:47, 1:02:03 (rounded up while counting down: 0:01 until it's really 0). */
  function fmt(ms, up) {
    const s = Math.max(0, up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
  }
  const two = n => String(n).padStart(2, '0');
  /** Time of day, HH:MM, on the box's clock in this screen's time zone (as the CREW SCREEN does). */
  function clock(now) { const d = new Date(now); return two(d.getHours()) + ':' + two(d.getMinutes()); }
  const hhmm = ms => clock(ms);
  /** Every state's screen. f = the last /api/stageclock reading; now = the box's clock (ms). */
  function view(f, now) {
    // #127 HOLD: the countdown stands still at the hold's start (f.frozenAt); a set that ends at MUSIC OFF keeps
    // counting (MUSIC OFF never moves). The words say HOLD: WEATHER and the ALL CLEAR clock when there is one.
    const realNow = now;
    const h = f && f.hold;
    const offEnd = f && f.state === 'SET' && f.endIs === 'MUSIC OFF';
    if (h && f.frozenAt != null && !offEnd && ['BEFORE', 'SET', 'CHANGEOVER', 'OVER'].includes(f.state)) now = f.frozenAt;
    const v = viewAt(f, now);
    if (!h) return v;
    v.tone = 'hold';
    v.label = 'HOLD: ' + h.why;
    v.word = '';
    const off = f.musicOffAt != null ? hhmm(f.musicOffAt) : null;
    v.sub = offEnd ? 'MUSIC OFF STAYS ' + off : v.state === 'SET' || v.state === 'BEFORE' || v.state === 'CHANGEOVER' ? 'PAUSED' + (off ? ' · MUSIC OFF ' + off : '') : v.sub;
    if (h.allClearAt != null) v.banner = h.allClearAt > realNow ? { text: 'ALL CLEAR IN', time: fmt(h.allClearAt - realNow), go: false } : { text: 'ALL CLEAR', time: '', go: false };
    return v;
  }
  function viewAt(f, now) {
    const v = { state: 'NONE', tone: 'normal', label: '', big: clock(now), sub: '', word: '', onNow: '', next: '', nextSub: '', link: false, banner: null };
    if (!f) { v.label = 'STAGE CLOCK'; v.sub = 'FINDING THE BOX'; return v; }
    v.state = f.state;
    v.onNow = f.dj || '';
    const nx = f.next;
    if (nx) { v.next = nx.dj; v.nextSub = 'AT ' + nx.at; }
    switch (f.state) {
      case 'BEFORE':
        v.label = 'FIRST SET IN';
        v.big = fmt(f.startsAt - now);
        v.sub = 'STARTS ' + (nx ? nx.at : hhmm(f.startsAt));
        break;
      case 'SET': {
        if (f.endsAt == null) { v.label = 'ON NOW'; v.big = clock(now); v.sub = 'NO END TIME'; break; }
        const left = f.endsAt - now, off = f.endIs === 'MUSIC OFF';
        v.tone = tone(left);
        if (left <= 0) { // the poll hasn't caught up yet: the box says OVER on the next one
          v.tone = 'over'; v.label = ''; v.big = '+' + fmt(-left, true); v.word = 'OVER';
          v.sub = (off ? 'MUSIC OFF WAS ' : 'ENDED ') + hhmm(f.endsAt);
          break;
        }
        v.label = off ? 'MUSIC OFF IN' : 'SET ENDS IN';
        v.big = fmt(left);
        v.sub = (off ? 'MUSIC OFF ' : 'ENDS ') + hhmm(f.endsAt);
        v.word = { amber: '· 10 MIN WARNING', red: '· 5 MIN WARNING', pulse: '· LAST MINUTE' }[v.tone] || '';
        break;
      }
      case 'CHANGEOVER':
        v.label = 'CHANGEOVER';
        v.big = fmt(f.startsAt - now);
        v.sub = 'NEXT SET ' + (nx ? nx.at : hhmm(f.startsAt));
        v.onNow = 'CHANGEOVER';
        if (nx) v.nextSub = 'ON IN ' + fmt(f.startsAt - now);
        break;
      case 'OVER': {
        const off = f.endIs === 'MUSIC OFF';
        v.tone = 'over'; v.label = ''; v.word = 'OVER';
        v.big = '+' + fmt(now - f.endsAt, true);
        v.sub = (off ? 'MUSIC OFF WAS ' : 'ENDED ') + hhmm(f.endsAt);
        if (nx) v.nextSub = f.startsAt != null && f.startsAt > now ? 'ON IN ' + fmt(f.startsAt - now) : 'WAS DUE ' + nx.at;
        break;
      }
      case 'DONE':
        v.label = "THAT'S THE NIGHT"; v.big = clock(now); v.onNow = ''; v.next = ''; v.nextSub = '';
        break;
      default: // NONE: a calm clock and where to set the times
        v.state = 'NONE'; v.label = 'TIME'; v.big = clock(now); v.sub = 'NO SET TIMES YET'; v.link = true;
    }
    // WRAP-UP CALLS: the soonest one as a banner. Before GO: WRAP IT UP IN 4:12; at GO: WRAP IT UP.
    const w = (f.wrap || []).filter(c => now - c.goAt < 30000)[0];
    if (w) v.banner = w.goAt > now ? { text: w.txt + ' IN', time: fmt(w.goAt - now), go: false } : { text: w.txt, time: '', go: true };
    return v;
  }
  /**
   * #128 the other crew calls (never wrap-up calls: those are the big banner), small, soonest first, at most 3:
   * [{text, from, time, go}] with time "IN 0:42" before GO and "NOW" at GO (the box drops a call 30 s after).
   */
  function calls(f, now) {
    return ((f && f.calls) || []).filter(c => c && c.txt && !c.wrap && now - c.goAt < 30000).slice(0, 3).map(c => {
      const go = c.goAt <= now;
      return { text: String(c.txt), from: c.from ? String(c.from) : '', time: go ? 'NOW' : 'IN ' + fmt(c.goAt - now), go };
    });
  }
  // ---- #131 SET NOTES, WEATHER, NEXT UP ----
  const NOTE_MS = 15 * MIN;
  /**
   * The next act's SET NOTE for the crew: "NEXT: LIL TICK · NEEDS TT + MIC" in the last 15 min of a set, the
   * changeover, overtime, and the 15 min before the first set. '' otherwise (and always on the crowd view: the box
   * never sends notes there).
   */
  function noteLine(f, now) {
    if (!f || !f.nextNote || !f.next || !f.next.dj) return '';
    const s = f.state;
    const soon = s === 'CHANGEOVER' || s === 'OVER'
      || (s === 'SET' && f.endsAt != null && f.endsAt - now <= NOTE_MS)
      || (s === 'BEFORE' && f.startsAt != null && f.startsAt - now <= NOTE_MS);
    return soon ? 'NEXT: ' + String(f.next.dj) + ' · ' + String(f.nextNote) : '';
  }
  /** WEATHER's small line ("WIND 32 · GUSTS 61 km/h", "NO WEATHER (OFFLINE)") or ''. */
  function weatherLine(f) { return f && typeof f.weather === 'string' ? f.weather : ''; }
  /**
   * NEXT UP (stage.html?view=crowd): the crowd's screen from /api/stageclock?view=crowd. Who's on, who's next and
   * when, and the changeover's countdown. No overtime, no crew lines, no end times: a friendly screen.
   * @return {state, label, name, sub, nextLabel, next, nextAt, pause}
   */
  function crowd(f, now) {
    const v = { state: 'NONE', label: '', name: '', sub: '', nextLabel: '', next: '', nextAt: '', pause: '' };
    if (!f) { v.label = 'NEXT UP'; v.name = clock(now); return v; }
    v.state = f.state;
    const nx = f.next;
    const at = f.hold && f.frozenAt != null ? f.frozenAt : now;
    const inT = ms => ms > 0 ? fmt(ms) : '';
    switch (f.state) {
      case 'BEFORE':
        v.label = 'FIRST UP';
        v.name = nx ? nx.dj : '';
        v.sub = f.startsAt != null && f.startsAt > at ? 'STARTS IN ' + inT(f.startsAt - at) : nx ? 'AT ' + nx.at : '';
        break;
      case 'CHANGEOVER':
        v.label = 'NEXT UP';
        v.name = nx ? nx.dj : '';
        v.sub = f.startsAt != null && f.startsAt > at ? 'ON IN ' + inT(f.startsAt - at) : 'COMING UP';
        break;
      case 'SET': case 'OVER':
        v.label = 'ON NOW';
        v.name = f.dj || '';
        if (nx) { v.nextLabel = 'NEXT UP'; v.next = nx.dj; v.nextAt = nx.at; }
        break;
      case 'DONE':
        v.label = "THAT'S THE NIGHT"; v.name = 'THANK YOU';
        break;
      default:
        v.state = 'NONE';
        if (f.dj) { v.label = 'ON NOW'; v.name = f.dj; } else { v.label = ''; v.name = clock(now); }
    }
    if (f.hold && f.state !== 'DONE') { v.pause = f.hold.weather ? 'A SHORT PAUSE FOR THE WEATHER' : 'A SHORT PAUSE'; if (f.state === 'BEFORE' || f.state === 'CHANGEOVER') v.sub = ''; }
    return v;
  }
  /** #128 the R key: 0 -> 90 -> 180 -> 270 -> 0. */
  function nextRotation(r) { const n = Number(r) || 0; return n >= 270 ? 0 : n + 90; }
  /** Font size for the big digits: as big as the screen allows for this many characters (mono: ~0.6 em each). */
  function bigSize(text, vw, vh) { return Math.floor(Math.min(vh * 0.36, (vw * 0.94) / (Math.max(4, text.length) * 0.61))); }
  return { tone, fmt, clock, view, bigSize, calls, nextRotation, noteLine, weatherLine, crowd };
})();
if (typeof module !== 'undefined') module.exports = StageClockView;
