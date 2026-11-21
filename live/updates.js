'use strict';
// UPDATES (STATUS -> THE BOX, DECISIONS #66): this build and the one before it, CHECK (internet), INSTALL (owner, hold),
// WHEN THE MUSIC STOPS, INSTALL FROM FILE (a .glu from this phone or laptop: the venue path with no internet) and
// GO BACK TO PREVIOUS (owner, hold). The box refuses while a deck is playing; a new build that doesn't stay healthy
// puts the old one back by itself. Own file: if anything here throws, the rest of the dashboard carries on.
const Updates = (() => {
  const box = $('updBox');
  if (!box) return {};
  box.innerHTML = `
    <dl class="facts" id="updFacts"></dl>
    <div class="note" id="updState"></div>
    <div class="buttons">
      <button type="button" id="updCheck">CHECK</button>
      <button type="button" id="updInstall" class="hold" hidden>INSTALL</button>
      <button type="button" id="updLater" hidden>WHEN THE MUSIC STOPS</button>
      <button type="button" id="updCancel" hidden>CANCEL</button>
      <label class="btn" id="updFileBtn">INSTALL FROM FILE<input type="file" id="updFile" accept=".glu,application/zip,application/octet-stream" hidden></label>
      <button type="button" id="updBack" class="hold" hidden>GO BACK TO PREVIOUS</button>
    </div>
    <div class="note" id="updNote"></div>
    <div class="note">Owner only. Never during music: the box waits. <button type="button" class="q" data-tip aria-label="More">?</button></div>
    <div class="note tip" hidden>CHECK looks online for a new version. No internet at the venue: get the update file from GHOST LINK support onto your phone, then INSTALL FROM FILE. INSTALL and GO BACK: tap, then hold 1 s. GHOST LINK restarts (about 20 s). If a new version doesn't start properly, the box goes back to the old one by itself. Only files signed by GHOST LINK install.</div>`;

  let key = '';
  const clockOf = t => t ? clock(t) : '';
  const say = (t, warn) => note('updNote', t || '', warn);

  async function send(path, body) {
    if (!unlocked) { pending = null; return needUnlock(); }
    const r = await post(path, body);
    const j = await r.json().catch(() => ({}));
    if (r.status === 403) say("Updates need the owner's password, not tonight's crew code.", true);
    else if (!r.ok && r.status !== 401) say(j.error || "Didn't work (" + r.status + ').', true);
    else if (r.ok) { const u = j.status || j; say(u.error || '', !!u.error); show(u); }
    return r;
  }

  function show(u) {
    if (!u || u.onBox === undefined) return;
    const k = JSON.stringify(u);
    if (k === key) return;
    key = k;
    const a = u.available, p = u.pending, last = u.last;
    $('updFacts').innerHTML = `<dt>THIS BOX</dt><dd>${esc(u.current || 'unknown')}</dd>` +
      (u.previous ? `<dt>BEFORE IT</dt><dd>${esc(u.previous)}</dd>` : '');
    let st;
    if (u.busy) st = u.busy.toUpperCase() + '...';
    else if (u.off) st = u.off;
    else if (p) st = 'TRYING ' + p.to + ': it confirms itself after 2 minutes healthy, or goes back to ' + p.from + '.';
    else if (a) st = (a.ready ? 'READY TO INSTALL ' : 'UPDATE AVAILABLE ') + a.version + (a.notes ? ': ' + a.notes.replace(/\n/g, ' · ') : '') +
      (u.whenMusicStops ? ' · Installs after 5 minutes with no music.' : '');
    else if (u.upToDate) st = 'UP TO DATE' + (u.checkedAt ? ' (checked ' + clockOf(u.checkedAt) + ')' : '') + '.';
    else st = 'Tap CHECK when the box has internet, or INSTALL FROM FILE.';
    if (!a && !u.busy && !p && last && last.at && Date.now() - last.at < 3 * 86400e3) {
      const when = ' (' + clockOf(last.at) + ')';
      if (last.result === 'rolled-back') st = 'Last update: ' + last.to + " didn't start properly, so the box went back to " + last.from + when + '. ' + st;
      else if (last.result === 'ok') st = 'Last update: ' + last.to + ' installed OK' + when + '. ' + st;
      else if (last.result === 'went-back') st = 'Went back to ' + last.to + when + '. ' + st;
      else if (last.result === 'stuck') st = 'The last update failed and could not go back by itself' + when + ': ask support. ' + st;
    }
    $('updState').textContent = st;
    $('updState').classList.toggle('warn', !!(last && (last.result === 'rolled-back' || last.result === 'stuck') && !a));
    const idle = !u.busy && !u.off && !p;
    $('updInstall').hidden = !(a && idle && !u.whenMusicStops);
    $('updInstall').textContent = $('updInstall').dataset.label = a ? 'INSTALL ' + a.version : 'INSTALL';
    $('updLater').hidden = !(a && idle && !u.whenMusicStops);
    $('updCancel').hidden = !((a && a.ready) || u.whenMusicStops) || !!u.busy;
    $('updBack').hidden = !(u.previous && idle);
    $('updBack').textContent = $('updBack').dataset.label = u.previous ? 'GO BACK TO ' + u.previous : 'GO BACK TO PREVIOUS';
    $('updCheck').disabled = !!u.busy || !!u.off;
    $('updFileBtn').classList.toggle('off', !!u.busy || !!u.off);
    if (u.error) say(u.error, true);
  }

  $('updCheck').addEventListener('click', async () => {
    say('Checking...');
    await send('/api/update/check');
  });
  holdable($('updInstall'), async () => {
    const r = await send('/api/update/install', { when: 'now' });
    if (r && r.ok) say('Installing. GHOST LINK restarts in a moment; this page reconnects by itself.');
  });
  $('updLater').addEventListener('click', () => send('/api/update/install', { when: 'music-off' }));
  $('updCancel').addEventListener('click', () => send('/api/update/cancel'));
  holdable($('updBack'), async () => {
    const r = await send('/api/update/back');
    if (r && r.ok) say('Going back. GHOST LINK restarts in a moment; this page reconnects by itself.');
  });
  $('updFileBtn').addEventListener('click', e => { if (!unlocked) { e.preventDefault(); needUnlock(); } });
  $('updFile').addEventListener('change', async () => {
    const f = $('updFile').files[0];
    $('updFile').value = '';
    if (!f) return;
    if (f.size > 64 * 1024 * 1024) return say('That file is too big for a GHOST LINK update (64 MB at most).', true);
    say('Sending ' + f.name + ' to the box and checking its signature...');
    try {
      const r = await fetch('/api/update/file', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: f });
      if (r.status === 401) { setUnlocked(false); return needUnlock(); }
      const j = await r.json().catch(() => ({}));
      if (r.status === 403) return say("Updates need the owner's password, not tonight's crew code.", true);
      if (!r.ok) return say(j.error || "Couldn't use that file.", true);
      say(j.version + ' is signed and ready. INSTALL now (hold), or WHEN THE MUSIC STOPS.');
      show(j.status);
    } catch (e) { say('The file didn\'t reach the box. Stay on its Wi-Fi and try again.', true); }
  });

  if (typeof GOTO !== 'undefined') GOTO.push(['UPDATES · check, install, go back', 'status/updates', 'update updates upgrade version install new go back rollback file']);
  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { if (S.status) show(S.status.update); } catch (e) { console.warn('updates', e); }
  };
  return { show };
})();
