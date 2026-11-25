'use strict';
// ALL NIGHTS (PLAYED view, DECISIONS #55): every night on the box, filtered by venue, DJ, or a search (track, artist,
// DJ). Summary, top artists / DJs / venues / genres / keys / hours, the nights it covers (tap = open that night), and
// tracks grouped with play counts and where they were played. Plus MUSIC AT THIS VENUE (STATUS -> VENUE).
// Read-only except the venue music form (locked like the venue itself). Own file: if it throws, the rest carries on.
const Archive = (() => {
  const ALL = '__all';
  const pick = $('nightPick'), box = $('archive');
  let data = null, sort = 'plays', timer = null, filled = false;
  const on = () => pick.value === ALL;
  const day = n => { try { return nightLabel(n); } catch (e) { return n; } };
  const qs = () => {
    const p = new URLSearchParams();
    if ($('aVenue').value) p.set('venue', $('aVenue').value);
    if ($('aDj').value) p.set('dj', $('aDj').value);
    if ($('aQ').value.trim()) p.set('q', $('aQ').value.trim());
    return p.toString();
  };

  // DJ PROFILE (#64): with a DJ picked, how they play across every night on the box (/api/insights?dj=).
  let profile = null;
  async function loadProfile() {
    const dj = $('aDj').value;
    if (!dj || dj.charAt(0) === '(') { profile = null; return; }
    if (profile && profile.dj === dj) return;
    try {
      const [r, t] = await Promise.all([fetch('/api/insights?dj=' + encodeURIComponent(dj)),
        fetch('/api/transitions/dj?dj=' + encodeURIComponent(dj)).catch(() => null)]); // TRANSITIONS (#74)
      profile = r.ok ? await r.json() : null;
      if (profile && t && t.ok) profile.trans = await t.json();
    } catch (e) { profile = null; }
  }
  /** TRANSITIONS (#74) for this DJ: rated blends, % clean, gallop index, most decks, their cleanest. */
  function transRows(t, row) {
    if (!t || !t.count) return '';
    const b = t.best;
    return '<small>TRANSITIONS</small>' +
      row('Blends', t.count + (t.graded ? ' · ' + t.graded + ' rated · ' + t.cleanPct + '% clean on average' : '') + (t.sync ? ' · ' + t.sync + ' on sync' : '')) +
      row('Gallop index', t.gallopIndex != null ? t.gallopIndex + ' / 10' : null) +
      row('Most decks at once', t.maxDecks >= 3 ? t.maxDecks : null) +
      row('Longest rated blend', t.longestBars ? Math.round(t.longestBars) + ' bars' : null) +
      row('Cleanest', b ? b.cleanPct + '% · ' + Math.round(b.bars) + ' bars' + (b.to && b.to.title ? ' · into ' + esc(b.to.title) : '') + ' · ' + esc(day(b.night)) : null);
  }
  const secs = s => s == null ? '--' : s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + ' s';
  function profileCard() {
    const p = profile;
    if (!p || !p.tracks || p.dj !== $('aDj').value) return '';
    const st = p.styles || {}, names = { CUT: 'Cuts', QUICK: 'Quick', BLEND: 'Blends', LONG: 'Long blends' };
    const mixBits = Object.keys(names).filter(k => st[k]).map(k => names[k] + ' ' + Math.round(st[k] / p.mixes * 100) + '%').join(' · ');
    const row = (a, b) => b == null || b === '' ? '' : `<div class="ins-row"><span>${a}</span><b>${b}</b></div>`;
    return card('DJ PROFILE · ' + esc(p.dj.toUpperCase()),
      `<a class="btn mini" href="dj.html?dj=${esc(encodeURIComponent(p.dj))}">DJ PAGE · THEIR WRAPPED →</a>` + // #154 DJ PROFILE across nights
      row('Nights', p.nights + ' · ' + p.tracks + ' tracks · ' + p.hours + ' h') +
      row('Tempo', p.avgBpm ? p.avgBpm + ' BPM avg · ' + Math.round(p.bpmLow) + '-' + Math.round(p.bpmHigh) : null) +
      row('Mixes', p.mixes ? p.mixes + ' · typical ' + secs(p.avgMixSec) : null) +
      row('Style', mixBits || null) +
      row('In key', p.inKeyPct != null ? p.inKeyPct + '% of ' + p.keyPairs : null) +
      row('Loops', p.loops ? p.loops + (p.loopsPerHour ? ' · ' + p.loopsPerHour + ' an hour' : '') : null) +
      row('Pitch, most', p.pitchMax ? '±' + p.pitchMax + '%' : null) +
      row('Genres', (p.genres || []).slice(0, 3).map(g => esc(g.name)).join(', ') || null) +
      transRows(p.trans, row) +
      ((p.signature || []).length ? '<small>THEIR MOST PLAYED</small>' + bars(p.signature.slice(0, 5)) : '') +
      ((p.perNight || []).length > 1 ? '<small>NIGHT BY NIGHT</small>' + p.perNight.map(n => row(esc(day(n.night)),
        n.tracks + ' tracks' + (n.avgBpm ? ' · ' + Math.round(n.avgBpm) + ' BPM' : '') + (n.mixes ? ' · mixes ' + secs(n.avgMixSec) : ''))).join('') : ''));
  }

  async function load() {
    try {
      const [r] = await Promise.all([fetch('/api/archive?' + qs()), loadProfile()]);
      if (!r.ok) { box.innerHTML = '<p class="small">The tracklist hasn\'t been shared.</p>'; return; }
      data = await r.json();
      draw();
    } catch (e) {}
  }

  function facets() {
    const f = data.facets, keep = (id, list, all) => {
      const el = $(id), was = el.value;
      el.innerHTML = `<option value="">${all}</option>` + list.map(x =>
        `<option value="${esc(x.name)}">${esc(x.name.toUpperCase())} · ${x.nights} ${x.nights === 1 ? 'NIGHT' : 'NIGHTS'}</option>`).join('');
      el.value = was;
      if (el.selectedIndex < 0) el.value = '';
    };
    keep('aVenue', f.venues, 'EVERY VENUE');
    keep('aDj', f.djs, 'EVERY DJ');
  }

  const card = (t, b) => b ? `<div class="ins"><h3>${t}</h3>${b}</div>` : '';
  const bars = (list, filter) => {
    if (!list || !list.length) return '';
    const top = list[0].count;
    return list.map(x => `<div class="ins-bar${filter ? ' tap' : ''}"${filter ? ` data-f="${filter}" data-v="${esc(x.name)}"` : ''}><span>${esc(x.name)}</span>` +
      `<i style="--w:${Math.max(2, Math.round(x.count / top * 100))}%"></i><b>${x.count}</b></div>`).join('');
  };

  function draw() {
    if (!data) return;
    facets();
    const s = data.summary;
    $('aSum').innerHTML = s.tracks ? [
      ['NIGHTS', s.nights], ['TRACKS', s.tracks], ['DIFFERENT', s.unique], ['HOURS', s.hours],
      ['BPM', s.bpmLow ? Math.round(s.bpmLow) + '-' + Math.round(s.bpmHigh) : '--'], ['AVG BPM', s.bpmAvg || '--'],
      ['PLAYED AGAIN', s.repeats], ['SINCE', s.first ? day(s.first).replace(/^[A-Z]+,? /, '') : '--'],
    ].map(([k, v]) => `<div><small>${k}</small><b>${esc(String(v))}</b></div>`).join('') : '';
    const hours = Object.entries(s.byHour || {}).map(([h, n]) => ({ h: +h, n }))
      .sort((a, b) => ((a.h + 12) % 24) - ((b.h + 12) % 24)); // evening first, then after midnight
    const hTop = Math.max(1, ...hours.map(x => x.n));
    $('aCards').innerHTML = !s.tracks ? '' : [
      profileCard(),
      card('MOST PLAYED ARTISTS', bars(s.topArtists, 'q')),
      $('aDj').value ? '' : card('DJS', bars(s.topDjs, 'dj') + ((s.topDjs || []).length ? '<a class="btn mini" href="dj.html">EACH DJ\'S PAGE →</a>' : '')), // #154
      $('aVenue').value ? '' : card('VENUES', bars(s.topVenues, 'venue')),
      card('GENRES', bars(s.genres)),
      card('KEYS', bars(s.keys)),
      hours.length ? card('WHEN IT PLAYS', hours.map(x => `<div class="ins-bar"><span>${String(x.h).padStart(2, '0')}:00</span>` +
        `<i style="--w:${Math.max(2, Math.round(x.n / hTop * 100))}%"></i><b>${x.n}</b></div>`).join('')) : '',
    ].join('');
    $('aNights').innerHTML = data.nights.map(n => `<button type="button" class="arch-night" data-night="${esc(n.night)}">` +
      `<b>${esc(day(n.night))}</b><span>${esc(n.venues.join(' · '))}</span><span>${esc(n.djs.filter(d => d.charAt(0) !== '(').join(', ') || '')}</span>` +
      `<i>${n.tracks}</i></button>`).join('') || '<p class="small">Nothing on file matches.</p>';
    drawTracks();
  }

  function drawTracks() {
    const list = data.tracks.slice();
    if (sort === 'last') list.sort((a, b) => b.lastAt - a.lastAt);
    if (sort === 'az') list.sort((a, b) => String(a.artist || '').localeCompare(String(b.artist || '')) || String(a.title).localeCompare(String(b.title)));
    $('aTrN').textContent = data.summary.unique > list.length ? '(top ' + list.length + ' of ' + data.summary.unique + ')' : '';
    $('aTracks').innerHTML = list.map(t => `<li><span class="deckno" title="times played">${t.plays}×</span>` +
      `<span class="what">${esc(t.title)} <span>${esc(t.artist || '')}</span>` +
      `<small>LAST ${esc(day(t.lastNight))}${t.lastVenue ? ' · ' + esc(t.lastVenue) : ''}${t.lastDj ? ' · ' + esc(t.lastDj) : ''}` +
      `${t.venues.length > 1 ? ' · ' + t.venues.length + ' VENUES' : ''}${t.djs.length > 1 ? ' · ' + t.djs.length + ' DJS' : ''}</small></span>` +
      `<span class="bpm">${t.bpm ? t.bpm.toFixed(1) : ''}</span></li>`).join('') || '<li class="empty-note">Nothing on file matches.</li>';
  }

  function show() {
    const a = on();
    $('played').classList.toggle('archive-on', a);
    box.hidden = !a;
    if (a) load();
  }

  // The picker gets ALL NIGHTS at the top of the list.
  const origLoad = loadNights;
  loadNights = async function () {
    const keep = on();
    await origLoad.apply(this, arguments);
    if (!pick.querySelector(`option[value="${ALL}"]`)) pick.insertAdjacentHTML('afterbegin', `<option value="${ALL}">ALL NIGHTS · BY VENUE / DJ / ARTIST</option>`);
    if (keep) pick.value = ALL;
  };
  pick.addEventListener('change', show);
  const origRender = renderPlayed;
  renderPlayed = function () {
    origRender.apply(this, arguments);
    try { $('played').classList.toggle('archive-on', on()); box.hidden = !on(); } catch (e) {}
  };

  $('aVenue').addEventListener('change', load);
  $('aDj').addEventListener('change', load);
  $('aQ').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
  $('aClear').addEventListener('click', () => { $('aVenue').value = ''; $('aDj').value = ''; $('aQ').value = ''; load(); });
  box.addEventListener('click', e => {
    const s = e.target.closest('[data-sort]');
    if (s) {
      sort = s.dataset.sort;
      box.querySelectorAll('[data-sort]').forEach(b => b.classList.toggle('on', b === s));
      return drawTracks();
    }
    const f = e.target.closest('[data-f]');
    if (f) {
      if (f.dataset.f === 'venue') $('aVenue').value = f.dataset.v;
      else if (f.dataset.f === 'dj') $('aDj').value = f.dataset.v;
      else $('aQ').value = f.dataset.v;
      return load();
    }
    const n = e.target.closest('[data-night]');
    if (n) { pick.value = n.dataset.night; pick.dispatchEvent(new Event('change')); scrollTo(0, 0); }
  });

  // ---- MUSIC AT THIS VENUE (STATUS -> VENUE) ----
  async function loadRules() {
    try {
      const j = await (await fetch('/api/venue-music')).json();
      const r = j.rules || {};
      $('vMusic').hidden = !j.venue;
      $('vmSum').textContent = j.venue ? '· ' + j.venue.name.toUpperCase() : '';
      if ($('vMusic').contains(document.activeElement)) return; // don't overwrite while typing
      $('vmDoors').value = r.doors || '';
      $('vmOff').value = r.musicOff || '';
      $('vmLo').value = r.bpmLow || '';
      $('vmHi').value = r.bpmHigh || '';
      $('vmRep').value = r.repeatDays == null ? 30 : r.repeatDays;
      $('vmNo').value = (r.noPlay || []).join('\n');
      $('vmNotes').value = r.notes || '';
      filled = true;
    } catch (e) {}
  }
  $('vMusic').addEventListener('toggle', () => { if ($('vMusic').open) loadRules(); });
  $('vmForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!unlocked) return needUnlock();
    const r = await post('/api/venue-music', {
      doors: $('vmDoors').value, musicOff: $('vmOff').value, bpmLow: +$('vmLo').value || 0, bpmHigh: +$('vmHi').value || 0,
      repeatDays: $('vmRep').value === '' ? 30 : +$('vmRep').value, noPlay: $('vmNo').value.split('\n'), notes: $('vmNotes').value,
    });
    if (r.ok) { note('vmNote', 'Saved for this venue.'); document.activeElement.blur(); loadRules(); }
    else { let m = 'Couldn\'t save.'; try { m = (await r.json()).error || m; } catch (x) {} note('vmNote', m, true); }
  });
  // The venue picked changes: show its rules.
  let lastVenue;
  setInterval(() => {
    const v = S.status && S.status.venue ? S.status.venue.id : null;
    if (v !== lastVenue) { lastVenue = v; filled = false; loadRules(); }
  }, 1500);

  return { load };
})();
