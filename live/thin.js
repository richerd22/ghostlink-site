'use strict';
// THIN TRACK NOTE (#125): a deck playing a track with no rekordbox analysis (streaming, unanalysed on the USB, a CD)
// gets one small NO ANALYSIS tag, so the booth tech knows why its waveform, beat grid and phrases (and so the lights
// cues, the drop calls and the time-left smarts) are missing. How we know: beat-link's CdjStatus.getTrackType() is
// REKORDBOX only for analysed files; UNANALYZED, CD_DIGITAL_AUDIO and UNKNOWN have none, and a track from slot UNKNOWN
// is streaming (Beatport / SoundCloud / TIDAL on the player). The box puts both in the deck's trackKey
// "player:SLOT:TYPE:id" (BeatLinkSource.key; SAY WHY reads it the same way). Own file; app.js calls Thin.tag(t, d).
const Thin = (() => {
  const WORDS = {
    streaming: 'Streaming track: the player sends no waveform, beat grid or phrases, so waveforms, lights cues and time left have less to go on.',
    unanalysed: 'Not analysed in rekordbox: no waveform, beat grid or phrases on the USB for this file, so waveforms, lights cues and time left have less to go on.',
    cd: 'CD: players send no waveform, beat grid or phrases for CDs, so waveforms, lights cues and time left have less to go on.',
  };

  /** Why a loaded deck's track has no analysis ('streaming' | 'unanalysed' | 'cd'), or null when it has (or we can't tell). */
  function of(d) {
    if (!d || d.load !== 'LOADED' || d.demo) return null;
    if (!d.trackKey) return null; // details not in yet: SAY WHY covers that
    const p = String(d.trackKey).split(':');
    if (p.length < 4) return null; // not a player's key (older recordings, demo)
    const slot = p[1], type = p[2];
    if (type === 'UNANALYZED') return 'unanalysed';
    if (type === 'CD_DIGITAL_AUDIO' || slot === 'CD_SLOT') return 'cd';
    if (type !== 'REKORDBOX' || slot === 'UNKNOWN') return 'streaming';
    return null;
  }

  function words(kind) { return WORDS[kind] || ''; }

  /** The tag on a deck tile's top line: made once, then only shown / hidden (text nodes only). */
  function tag(t, d) {
    if (!t || !t.root) return;
    const top = t.root.querySelector('.top');
    if (!top) return;
    let s = top.querySelector('.tag.thin');
    const k = of(d);
    if (!k) { if (s) s.hidden = true; return; }
    if (!s) {
      s = document.createElement('span');
      s.className = 'tag thin';
      s.textContent = 'NO ANALYSIS';
      top.appendChild(s);
    }
    if (s.title !== words(k)) s.title = words(k);
    s.hidden = false;
  }

  return { of, words, tag };
})();
if (typeof module !== 'undefined') module.exports = Thin;
