'use strict';
/*
 * #134 THE END OF STAND BY, said plainly (Nov 23, home test: BACK ON THEIR WI-FI from a phone on the GHOST LINK
 * hotspot, then the page offered JOIN VENUE WI-FI NOW while the box was already leaving the hotspot for its saved
 * Wi-Fi: "kinda confusing haha think it all thru always").
 * Pure parts (no DOM; Node tests in src/test/js/standbyend.test.js). wifiquiet.js and easy.js use them.
 *  - back(s, mine, now): the last end (the box's wifiBack, or what this page's own END tap got back), or null.
 *  - phase(s, b, now): leaving | joining | radio | joined | still | stayed.
 *  - line(s, b, viewer, now): the one plain line for right after an end (null once it's old news).
 *  - lost(b, lastQuiet, now): the calm screen while the page has lost the box after an end {title, lines}, or null.
 *  - canJoin(s, now, b): JOIN VENUE WI-FI NOW only when it would really do something.
 *  - viewer(s, host, via): hotspot | cable | wifi | here | null (how this page reaches the box).
 * Times are the box's clock (ms).
 */
const StandbyEnd = (() => {
  const HOLD_MS = 60000;   // no JOIN VENUE WI-FI NOW for a minute after an end: the box is rejoining by itself
  const LOST_MS = 300000;  // a page that loses the box within 5 min of an end shows the calm screen, not an error
  const q = n => '"' + n + '"';
  const ghost = 'ghostlink.local';

  function back(s, mine, now) {
    const b = (s && s.wifiBack) || null;
    if (b && b.at && now - b.at < 180000) return b;
    if (mine && mine.at && now - mine.at < 180000) return mine;
    return null;
  }

  /** Where the box is in its way back. */
  function phase(s, b, now) {
    const w = (s && s.wifi) || {}, st = w.state, since = (s && s.wifiSince) || 0;
    if (st === 'client' && w.ssid) return since && since < b.at - 2000 ? 'still' : 'joined';
    if (st === 'off') return 'radio';
    if (st === 'hotspot') {
      if (b.look === 'none-saved') return 'stayed';                 // nothing saved: it never steps aside
      if (since > b.at + 1000) return 'stayed';                     // it looked, found nothing, GHOST LINK is back
      return now - b.at < 30000 ? 'leaving' : 'stayed';
    }
    if (!st && w.ssid && !b.look) return 'joined';                  // no watcher (a laptop): plain Wi-Fi
    return 'joining';
  }

  function savedList(b) {
    const v = (b.saved || []).slice(0, 3).map(q);
    return v.length ? ' (' + v.join(', ') + ')' : '';
  }

  /** The one plain line right after an end; null once it's old news. */
  function line(s, b, viewer, now) {
    if (!b) return null;
    const p = phase(s, b, now), age = now - b.at, w = (s && s.wifi) || {};
    if (age > HOLD_MS && (p === 'joined' || p === 'still' || p === 'stayed')) return null;
    if (age > 180000) return null;
    const to = b.to, off = b.kind === 'off';
    const drop = to ? (viewer === 'cable' ? ' This laptop keeps the box on the DJ cable.'
      : viewer === 'wifi' || viewer === 'here' ? ''
      : viewer === 'hotspot' ? ' Your phone will drop off GHOST LINK: join ' + q(to) + ' to find the box again (' + ghost + ').'
      : ' A phone on GHOST LINK drops off: join ' + q(to) + ' to find the box again (' + ghost + ').') : '';
    switch (p) {
      case 'still': return 'Back to normal Wi-Fi: still on ' + q(w.ssid) + '.';
      case 'joined': return 'Back on ' + q(w.ssid) + '.' + (viewer === 'cable' ? ' Phones on ' + q(w.ssid) + ' find the box at ' + ghost + '.' : '');
      case 'stayed':
        if (b.look === 'none-saved') return off ? 'Wi-Fi back on. No saved Wi-Fi: GHOST LINK is its own network again.'
          : 'Back to normal Wi-Fi. No saved Wi-Fi nearby: GHOST LINK stays up.';
        return (to ? q(to) + ' didn\'t answer' : 'No saved Wi-Fi nearby') + ': GHOST LINK stays up.';
      case 'radio':
        return 'Wi-Fi coming back on.' + (to ? ' Then back to ' + q(to) + '.' + drop
          : b.look === 'none-saved' ? ' No saved Wi-Fi: the GHOST LINK hotspot comes up in about 90 s.'
          : ' Looking for saved Wi-Fi' + savedList(b) + '; none in range = the GHOST LINK hotspot in about 90 s.');
      default: // leaving / joining
        if (b.look === 'none-saved') return off ? 'Wi-Fi back on. No saved Wi-Fi: the GHOST LINK hotspot comes up in about 90 s.'
          : 'Back to normal Wi-Fi. No saved Wi-Fi nearby: GHOST LINK stays up.';
        if (to) return 'Going back to ' + q(to) + ' now.' + drop;
        return 'Back to normal Wi-Fi: looking for saved Wi-Fi' + savedList(b) + '. None was nearby at its last look'
          + (off ? ': the GHOST LINK hotspot comes up in about 90 s if none answers.'
            : (viewer === 'hotspot' ? ': your phone may drop off for a moment; if none answers, GHOST LINK comes back within a minute.'
              : ': if none answers, GHOST LINK comes back within a minute.'));
    }
  }

  /**
   * The calm screen while this page has lost the box after an end (or at a STAND BY end time that just passed).
   * lastQuiet = the wifiQuiet this page saw last (it may lose the box before it hears about the end).
   */
  function lost(b, lastQuiet, now) {
    let e = b;
    if (!e && lastQuiet && lastQuiet.until && now >= lastQuiet.until - 15000 && now - lastQuiet.until < LOST_MS)
      e = { at: lastQuiet.until, kind: lastQuiet.kind, to: lastQuiet.backTo || null, look: lastQuiet.backLook || 'unknown', saved: [] };
    if (!e || now - e.at > LOST_MS || now < e.at - 15000) return null;
    if (e.look === 'none-saved') return {
      title: 'GHOST LINK IS COMING BACK',
      lines: ['The box ended STAND BY and has no saved Wi-Fi, so it stays its own GHOST LINK network.',
        'Pick GHOST LINK in this phone\'s Wi-Fi settings if it doesn\'t rejoin by itself.'],
    };
    if (e.to) return {
      title: 'THE BOX IS JOINING ' + q(e.to),
      lines: ['STAND BY is over: the box left its GHOST LINK network for ' + q(e.to) + ', so this phone lost it. That\'s expected.',
        'Join ' + q(e.to) + ' in this phone\'s Wi-Fi settings, then open ' + ghost + '.',
        'If ' + q(e.to) + ' doesn\'t take, GHOST LINK comes back on by itself within a minute or two: join GHOST LINK again.'],
    };
    return {
      title: 'THE BOX IS LOOKING FOR SAVED WI-FI',
      lines: ['STAND BY is over: the box stepped off its GHOST LINK network to look for saved Wi-Fi' + savedList(e) + ', so this phone lost it.',
        'Found one: join that Wi-Fi too, then open ' + ghost + '. None: GHOST LINK comes back within a minute; join GHOST LINK again.'],
    };
  }

  /** A saved venue Wi-Fi the box can join (the watcher only joins ones with a password). */
  const savedVenue = s => ((s.venue || {}).wifi || []).some(w => w && w.ssid && (w.saved || w.password)); // status: saved = has a password

  /** JOIN VENUE WI-FI NOW only when it would really do something, and never in the minute after an end. */
  function canJoin(s, now, b) {
    if (!s || s.wifiQuiet) return false;
    if (((s.wifi || {}).state) !== 'hotspot') return false;
    if (!savedVenue(s)) return false;
    if (b && b.at && now - b.at < HOLD_MS) return false;
    return true;
  }

  /** How this page reaches the box. via = what the box said on the END tap (it sees which address it came in on). */
  function viewer(s, host, via) {
    if (via) return via;
    const w = (s && s.wifi) || {};
    if (host === '10.42.0.1') return 'hotspot';
    if (host && s && host === s.djAddress) return 'cable';
    if (host && host === w.ip && w.state === 'client') return 'wifi';
    if (host === 'localhost' || host === '127.0.0.1') return 'here';
    return null; // ghostlink.local and friends: could be any of them
  }

  return { back, phase, line, lost, canJoin, viewer, savedVenue, HOLD_MS };
})();
if (typeof module !== 'undefined') module.exports = StandbyEnd;
