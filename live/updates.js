'use strict';
// UPDATES (STATUS -> THE BOX, DECISIONS #66, #138). One plain card: UP TO DATE, or NEW: <what's new> with
// UPDATE TONIGHT AFTER MUSIC OFF (or UPDATE OVERNIGHT with no night planned) and UPDATE NOW (hold; only when nothing
// stops it: no music, no recording, not within 3 hours of tonight's start until MUSIC OFF / GOODNIGHT). The rest sits
// under MORE: what's new in plain words, AUTO-UPDATE (OFF / QUIET HOURS ONLY), CHECK, INSTALL FROM FILE (the venue
// path with no internet), GO BACK TO <previous> (hold), system files. From WATCH FROM HOME the card only shows the
// state, plus UPDATE AFTER TONIGHT for a link the owner gave UPDATES: the box installs in its own quiet window, never
// on the spot. Own file: if anything here throws, the rest of the dashboard carries on.
const Updates = (() => {
  const box = $('updBox');
  if (!box) return {};
  box.innerHTML = `
    <div class="upd-card" id="updCard">
      <div class="upd-head" id="updHead">UPDATES</div>
      <div class="note" id="updState"></div>
      <div class="buttons">
        <button type="button" id="updQueue" hidden>UPDATE TONIGHT AFTER MUSIC OFF</button>
        <button type="button" id="updNow" class="hold" hidden>UPDATE NOW</button>
        <button type="button" id="updUnqueue" hidden>DON'T UPDATE</button>
      </div>
      <div class="note" id="updNote"></div>
      <details class="upd-more" id="updMore">
        <summary>WHAT'S NEW · AUTO-UPDATE · GO BACK</summary>
        <div id="updLog" class="upd-log"></div>
        <div class="local-only">
          <div class="upd-auto"><small>AUTO-UPDATE</small><button type="button" data-auto="off">OFF</button><button type="button" data-auto="quiet">QUIET HOURS ONLY</button></div>
          <div class="note" id="updAutoNote"></div>
          <div class="buttons">
            <button type="button" id="updCheck">CHECK</button>
            <label class="btn" id="updFileBtn">INSTALL FROM FILE<input type="file" id="updFile" accept=".glu,application/zip,application/octet-stream" hidden></label>
            <button type="button" id="updBack" class="hold" hidden>GO BACK TO PREVIOUS</button>
            <button type="button" id="updCancel" hidden>REMOVE THE WAITING FILE</button>
          </div>
          <div class="note" id="updOs"></div>
          <div class="note">Owner only. Never mid-set: the box waits. <button type="button" class="q" data-tip aria-label="More">?</button></div>
          <div class="note tip" hidden>The box looks for updates by itself on its normal internet (venue Wi-Fi). An update never starts while a deck plays, while a set records, or from 3 hours before tonight's start until MUSIC OFF or GOODNIGHT. UPDATE TONIGHT AFTER MUSIC OFF installs once the decks have been quiet 5 minutes after the night; with no night planned it waits for a quiet morning. Every update is signed by GHOST LINK and checked before anything changes; the new version must report healthy within a minute and stay up 2 minutes, or the box goes back by itself. The old version stays on the box: GO BACK puts it back, no internet needed. No internet at the venue: get the file from support onto your phone, then INSTALL FROM FILE.</div>
        </div>
      </details>
    </div>`;

  let key = '', me = null, last = null;
  const clockOf = t => t ? clock(t) : '';
  const say = (t, warn) => note('updNote', t || '', warn);
  const firstLine = s => (s || '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
  const remote = () => document.body.classList.contains('remote');
  const mayQueueFromHere = () => !!(me && me.link && me.controls && (me.link.scopes || []).includes('updates'));

  async function loadMe() {
    try { me = await (await fetch('/api/share/me', { cache: 'no-store' })).json(); } catch (e) { me = null; }
    key = '';
    if (last) show(last);
  }

  async function send(path, body) {
    if (!unlocked && !(remote() || mayQueueFromHere())) { pending = null; return needUnlock(); }
    const r = await post(path, body);
    const j = await r.json().catch(() => ({}));
    if (r.status === 403) say(j.error && /View only/.test(j.error) ? 'From outside the venue this needs a link with UPDATE AFTER TONIGHT.' : "Updates need the owner's password, not tonight's crew code.", true);
    else if (!r.ok && r.status !== 401) say(j.error || "Didn't work (" + r.status + ').', true);
    else if (r.ok) { const u = j.status || j; say(u.error || '', !!u.error); key = ''; show(u); }
    return r;
  }

  function block(title, ver, text) {
    if (!text) return null;
    const d = document.createElement('div');
    const h = document.createElement('b');
    h.textContent = title + (ver ? ' ' + ver : '');
    d.appendChild(h);
    const ul = document.createElement('ul');
    text.split('\n').map(x => x.trim()).filter(Boolean).forEach(l => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); });
    d.appendChild(ul);
    return d;
  }

  function show(u) {
    if (!u || u.onBox === undefined) return;
    last = u;
    const k = JSON.stringify(u) + (me ? JSON.stringify(me) : '') + remote();
    if (k === key) return;
    key = k;
    const a = u.available, p = u.pending, lr = u.last, q = u.queued, blocked = u.nowBlocked;
    const idle = !u.busy && !u.off && !p;
    let head, st = '';
    if (u.busy) { head = 'UPDATING'; st = u.busy + '...'; }
    else if (p) { head = 'UPDATING'; st = 'Trying ' + p.to + ': it confirms itself after 2 minutes healthy, or goes back to ' + p.from + ' by itself.'; }
    else if (u.off) { head = 'UPDATES'; st = u.off; }
    else if (a) {
      head = 'NEW: ' + (firstLine(a.notes) || a.version);
      if (q) st = a.version + ' is queued' + (q.by === 'link' && q.link ? ' (from "' + q.link + '")' : q.by === 'auto' ? ' by AUTO-UPDATE' : '') + '. ' + (u.queueWhen || '');
      else if (blocked) st = a.version + '. Not now: ' + blocked;
      else st = a.version + (a.ready ? ', checked and ready.' : ', signed by GHOST LINK.') + ' This box runs ' + u.current + '.';
    } else if (u.upToDate) { head = 'UP TO DATE'; st = (u.current || '') + (u.checkedAt ? ' · checked ' + clockOf(u.checkedAt) : ''); }
    else { head = 'UPDATES'; st = (u.current ? 'This box runs ' + u.current + '. ' : '') + (remote() ? '' : 'CHECK when the box has internet, or INSTALL FROM FILE.'); }
    if (!a && !u.busy && !p && lr && lr.at && Date.now() - lr.at < 3 * 86400e3) {
      const when = ' (' + clockOf(lr.at) + ')';
      if (lr.result === 'rolled-back') st = lr.to + " didn't start properly, so the box went back to " + lr.from + ' by itself' + when + '. ' + st;
      else if (lr.result === 'ok') st = 'Updated to ' + lr.to + when + '. ' + st;
      else if (lr.result === 'went-back') st = 'Went back to ' + lr.to + when + '. ' + st;
      else if (lr.result === 'stuck') st = 'The last update failed and could not go back by itself' + when + ': ask support. ' + st;
    }
    $('updHead').textContent = head;
    $('updState').textContent = st;
    const bad = !!(lr && (lr.result === 'rolled-back' || lr.result === 'stuck') && !a);
    $('updState').classList.toggle('warn', bad);
    $('updCard').classList.toggle('new', !!a);
    // The main buttons.
    const outside = remote();
    const canQueue = a && idle && !q && (!outside || mayQueueFromHere());
    $('updQueue').hidden = !canQueue;
    $('updQueue').textContent = outside ? 'UPDATE AFTER TONIGHT' : (u.queueLabel || 'UPDATE TONIGHT AFTER MUSIC OFF');
    $('updNow').hidden = !(a && idle && !q && !blocked && !outside);
    $('updUnqueue').hidden = !(a && q && !u.busy && (!outside || mayQueueFromHere()));
    if (outside && a && !mayQueueFromHere()) say('From outside the venue you can see this. To queue it from home, the owner makes a link with UPDATE AFTER TONIGHT.');
    // MORE: what's new, AUTO-UPDATE, CHECK / FILE / GO BACK, system files.
    const log = $('updLog');
    log.textContent = '';
    const n = u.notes || {};
    [a ? block('NEW', a.version, a.notes) : null, block('THIS BOX', u.current, n.current), block('BEFORE IT', u.previous, n.previous)]
      .forEach(b => { if (b) log.appendChild(b); });
    if (!log.firstChild) log.textContent = 'This box runs ' + (u.current || 'an unnamed build') + (u.previous ? '; before it ' + u.previous : '') + '. Release notes come with each update.';
    const au = u.auto || { mode: 'off', asked: false };
    box.querySelectorAll('[data-auto]').forEach(b => b.classList.toggle('on', b.dataset.auto === au.mode));
    note('updAutoNote', au.mode === 'quiet' ? 'New versions queue themselves and install after a night or on a quiet morning. Never mid-set.'
      : au.asked ? 'Off: the box tells you when there is a new version; you choose when.' : 'Off for now. First run asks you.');
    $('updBack').hidden = !(u.previous && idle);
    $('updBack').textContent = $('updBack').dataset.label = u.previous ? 'GO BACK TO ' + u.previous : 'GO BACK TO PREVIOUS';
    $('updCancel').hidden = !(a && a.ready) || !!u.busy;
    $('updCheck').disabled = !!u.busy || !!u.off;
    $('updFileBtn').classList.toggle('off', !!u.busy || !!u.off);
    const os = u.os || {}, waiting = (os.waiting || []).length, ol = os.last;
    let ot = '';
    if (ol && ol.result && ol.at && Date.now() - ol.at < 7 * 86400e3)
      ot = ol.result === 'ok' ? 'System files updated with ' + ol.version + (ol.restored ? ' (put back by GO BACK).' : '.')
        : ol.result === 'same' ? '' : 'System files were not changed (' + (ol.why || ol.result) + '). The old ones are in place.';
    if (waiting && !os.on) ot = (ot ? ot + ' ' : '') + 'This version also carries ' + waiting + ' system file' + (waiting === 1 ? '' : 's') + ' (Wi-Fi watcher, beacon); support turns system updates on.';
    note('updOs', ot, !!(ol && (ol.result === 'rolled-back' || ol.result === 'error')));
    if (u.error) say(u.error, true);
  }

  $('updQueue').addEventListener('click', () => send('/api/update/after-tonight', { on: true }));
  $('updUnqueue').addEventListener('click', () => send('/api/update/after-tonight', { on: false }));
  holdable($('updNow'), async () => {
    const r = await send('/api/update/install', { when: 'now' });
    if (r && r.ok) say('Updating. GHOST LINK restarts in a moment (about 20 s); this page reconnects by itself.');
  });
  box.querySelectorAll('[data-auto]').forEach(b => b.addEventListener('click', () => send('/api/update/auto', { mode: b.dataset.auto })));
  $('updCheck').addEventListener('click', async () => { say('Checking...'); await send('/api/update/check'); });
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
      say(j.version + ' is signed and ready.');
      key = '';
      show(j.status);
    } catch (e) { say('The file didn\'t reach the box. Stay on its Wi-Fi and try again.', true); }
  });

  loadMe();
  if (typeof GOTO !== 'undefined') GOTO.push(['UPDATES · new version, update tonight, auto-update, go back', 'status/updates', 'update updates upgrade version install new go back rollback file auto firmware changelog whats new']);
  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { if (S.status) show(S.status.update); } catch (e) { console.warn('updates', e); }
  };
  return { show, _me: m => { me = m; key = ''; if (last) show(last); } };
})();
