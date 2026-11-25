'use strict';
// #156 WATCH FROM HOME: OLDER NIGHTS. Richard (Nov 25): "you should have a choice of them being able to see that or
// not, prob default at off". Under STATUS -> WATCH FROM HOME: one line that says what a viewer outside the venue sees
// (SHOWS: TONIGHT ONLY / SHOWS: TONIGHT + OLDER NIGHTS) and the owner's switch. Off by default. The box decides what
// actually goes out (web/RemoteNights.java); this only shows it and flips it. Never on WATCH FROM HOME itself.
// app.js's loadRemote() hands every /api/remote answer to show() (and hide() when the phone is locked).
const WatchScope = (() => {
  let older = false;

  function show(j) {
    if (!j || document.body.classList.contains('remote')) return;
    older = !!j.olderNights;
    $('remoteShows').textContent = 'SHOWS: ' + (j.shows || (older ? 'TONIGHT + OLDER NIGHTS' : 'TONIGHT ONLY'));
    $('remoteOlder').textContent = 'OLDER NIGHTS: ' + (older ? 'ON' : 'OFF');
    $('remoteOlder').classList.toggle('on', older);
    $('remoteShowsRow').hidden = false;
    $('remoteOlderRow').hidden = false;
  }

  function hide() {
    $('remoteShowsRow').hidden = true;
    $('remoteOlderRow').hidden = true;
  }

  $('remoteOlder').addEventListener('click', async () => {
    if (!unlocked) { pending = null; return needUnlock(); }
    const next = !older;
    if (next && !confirm('Show the older nights from outside the venue too?\n\nOnce tonight is shared, anyone with the WATCH FROM HOME link sees every older night\'s PLAYED and the all-nights numbers (no venue names). Off: only a night that was shared.')) return;
    const r = await post('/api/remote/nights', { older: next });
    if (r.status === 403) return note('remoteNote', "OLDER NIGHTS needs the owner's password, not tonight's crew code.", true);
    if (r.ok) show(await r.json());
  });

  return { show, hide };
})();
