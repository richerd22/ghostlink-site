'use strict';
// SOUND IN (NETWORK view, DECISIONS #57): the USB sound card on the mixer's REC OUT. Live meter (pushed by the box
// about 5 times a second as 'audio'), RECORD THIS SET (opt-in per set, crew password) / STOP (anyone at the venue),
// each recording with its tracklist, download (crew) and delete (crew). A small ● REC in the header on every view while the box is recording, so the booth always knows.
// Own file: if anything here throws, the rest of the dashboard carries on.
const Sound = (() => {
  const pill = document.createElement('span');
  pill.className = 'rec-pill'; pill.id = 'recPill'; pill.hidden = true;
  $('link').insertAdjacentElement('afterend', pill);
  let last = null, listAt = 0, statusKey = '', listKey = '', listHtml = '', listDirty = true;

  const pct = db => Math.max(0, Math.min(100, (db + 60) / 60 * 100)); // -60 dBFS .. 0
  const hms = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
  const mb = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e6) + ' MB';

  function levels(d) {
    last = d;
    if (pill.hidden !== !d.rec) pill.hidden = !d.rec;
    if (d.rec) { const t = '● REC ' + hms(d.recFor) + (d.warn === 'hot' ? ' · TOO HOT' : d.warn === 'quiet' ? ' · TOO QUIET' : ''); if (pill.textContent !== t) pill.textContent = t; } // #113
    pill.classList.toggle('warn', !!(d.rec && d.warn));
    if ($('network').hidden) return;
    [['L', d.rl, d.pl], ['R', d.rr, d.pr]].forEach(([s, rms, peak]) => {
      const b = $('m' + s);
      b.style.width = pct(rms) + '%';
      b.classList.toggle('hot', peak > -1);
      $('m' + s + 'p').style.left = pct(peak) + '%';
      $('m' + s + 'v').textContent = rms <= -119 ? '--' : rms.toFixed(0) + ' dB';
    });
  }

  function render() {
    const a = S.status && S.status.audio;
    // #159 (a club Nov 25 lag): the key was the whole audio status, which changes with every clip once a recording runs
    // hot, so every status (1-2 a second) re-fetched and redrew the whole list, on every tab. Now: the card text
    // redraws only when what it shows changes, and the list is fetched only when a recording starts / ends / is
    // deleted, only while SOUND IN is on screen (else once it's opened), and every 30 s while you look at it.
    const r = a && a.recording;
    const key = JSON.stringify(a && [a.card, a.live, a.recordOn, r && r.name, r && r.dj, r && r.since, a.ask, a.deaf, S.status.dj]);
    const lk = JSON.stringify(a && [a.card, r && r.name]);
    if (lk !== listKey) { listKey = lk; listDirty = true; }
    const shown = !$('network').hidden;
    if (key === statusKey) { if (shown && (listDirty || Date.now() - listAt >= 30000)) loadList(); return; }
    statusKey = key;
    const card = a && a.live;
    $('sndMeter').hidden = !card;
    $('sndCtl').hidden = !a || !a.card;
    const jk = a && a.jack; // #161: the jack picked in SET UP SOUND IN, named; else neutral
    $('sndNote').textContent = card ? 'Reading ' + a.card + (jk ? ' on the ' + (jk.mixerName || 'mixer') + '\'s ' + jk.jack : '') + '. Set ' + (jk ? jk.jack : 'the mixer\'s output') + ' so the loud parts sit around -12 dB here.'
      : 'No sound card. Plug a USB sound card (UCA202 / UCA222) into the box: SET UP GUIDE shows which plug on the mixer.';
    if (a) {
      const who = (S.status && S.status.dj) || 'this set';
      $('sndRec').textContent = a.recordOn ? '■ STOP RECORDING' : '● RECORD ' + who.toUpperCase();
      $('sndRec').classList.toggle('rec-on', !!a.recordOn);
      $('sndRecNow').textContent = a.recording ? 'Recording ' + (a.recording.dj || 'the set') + ' since ' + clock(a.recording.since) + '. Keeps going until you tap STOP.'
        : a.recordOn ? 'Armed: starts when the music does.' : 'Nothing records unless you tap. One set at a time, the DJ\'s choice.';
    }
    // Nov 21: ON THE DECKS changed mid-recording: it carries on; ask, never cut.
    const ask = $('sndAsk');
    if (ask) {
      const q = a && a.ask;
      ask.hidden = !q;
      if (q) $('sndAskText').textContent = (q.dj || 'Someone new') + ' is on the decks now. Still recording (nothing was cut).';
      if (q) $('sndSplit').textContent = 'NEW FILE FOR ' + (q.dj || 'THIS SET').toUpperCase();
    }
    if (!pill.hidden && a && !a.recording) pill.hidden = true;
    if (shown && (listDirty || Date.now() - listAt >= 30000)) loadList();
  }

  async function loadList() {
    listAt = Date.now();
    listDirty = false;
    try {
      const r = await fetch('/api/audio');
      if (!r.ok) return;
      const j = await r.json(), files = j.files || [];
      $('sndListH').hidden = !files.length;
      const html = files.map(f => {
        const mins = f.endAt && f.startAt ? Math.round((f.endAt - f.startAt) / 60000) : null;
        const n = encodeURIComponent(f.name);
        return `<li data-name="${esc(f.name)}"><span class="what">${esc(f.dj || 'Set')} <span>${esc(f.venue || '')}</span>` +
          `<small>${esc(nightLabel(f.night || ''))} · ${clock(f.startAt)}${mins != null ? ' · ' + mins + ' min' : ''} · ${mb(f.bytes || 0)}${f.live ? ' · RECORDING' : ''}</small></span>` +
          `<span class="acts"><a class="btn mini" href="/api/audio/tracklist?name=${n}" target="_blank" rel="noopener">TRACKLIST</a>` +
          (f.live ? '' : `<a class="btn mini" href="/api/audio/file?name=${n}" download>FLAC</a><button type="button" class="mini local-only" data-del="${esc(f.name)}">DELETE</button>`) +
          `</span></li>`;
      }).join('');
      if (html !== listHtml) { listHtml = html; $('sndList').innerHTML = html; } // #159: unchanged = untouched (the level strips stay)
      if (typeof Recordings !== 'undefined') try { Recordings.decorate(files, j); } catch (e) { console.warn('recordings', e); } // #113
    } catch (e) {}
  }

  $('sndRec').addEventListener('click', async () => {
    const a = S.status && S.status.audio, on = !(a && a.recordOn);
    if (on && !unlocked) return needUnlock();   // starting needs the crew password; anyone here can STOP
    if (on && typeof RecNight !== 'undefined') return RecNight.choose(); // #159: WHAT TO RECORD / HOW TO SAVE, one plain sheet
    await post('/api/audio', { record: on });
  });
  $('sndSplit') && $('sndSplit').addEventListener('click', async () => {
    if (!unlocked) return needUnlock();
    await post('/api/audio', { split: true });
  });
  $('sndKeep') && $('sndKeep').addEventListener('click', () => post('/api/audio', { keep: true }));
  $('sndList').addEventListener('click', async e => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (!unlocked) return needUnlock();
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'SURE? TAP AGAIN'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'DELETE'; }, 3000); return; }
    const r = await post('/api/audio/delete', { name: b.dataset.del });
    if (r.ok) loadList();
  });
  // Downloads need the crew password: a locked phone gets the unlock box instead of a 401 page.
  $('sndList').addEventListener('click', e => {
    const a = e.target.closest('a[download]');
    if (a && !unlocked) { e.preventDefault(); needUnlock(); }
  });

  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { render(); } catch (e) { console.warn('sound', e); }
  };
  addEventListener('hashchange', () => { try { if (location.hash.startsWith('#network')) { statusKey = ''; listDirty = true; render(); if (last) levels(last); } } catch (e) {} });
  return { levels, render, reload: () => { listDirty = true; statusKey = ''; render(); } };
})();
