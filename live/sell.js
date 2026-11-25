'use strict';
/*
 * GET READY TO SELL (DECISIONS #112): STATUS -> THE BOX, owner only. A sheet that says in plain words what goes and
 * what stays, KEEP / ERASE THE NIGHTS (ERASE picked), DOWNLOAD A BACKUP FIRST, then a last step: the owner's password
 * and the unit's name typed (or the button held 3 s). The box tells the accounts relay to let go of it, wipes and
 * restarts as a new box. Own file; uses app.js globals ($, post, unlocked, needUnlock). Text nodes only.
 */
const Sell = (() => {
  const host = $('sellBox');
  if (!host) return {};
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };

  const GOES = [
    'Your password: back to the default. The next owner has to pick their own before they can change anything.',
    'Signed-in phones and the crew code.',
    'Share links, and the box\'s id: it gets a new one, and leaves your account.',
    'The unit\'s short name and number.',
    'Venues, with their saved Wi-Fi passwords. The box forgets that Wi-Fi and shows its own GHOST LINK network.',
    'The paired phones, the HARD STOP link (the crew room\'s keys and its internet room invite) and the hub key.',
    'Planned nights, SHOW CONTROL, OSC, rooms, DECK CONTROLS settings, sounds you added, play counts, the wantlist, your own night presets and every other setting.',
    'LIGHTS, VISUALS LINK, API KEYS, sheet links, the crew room\'s keys, WEATHER\'s place, the CURFEW LADDER, DOOR COUNT, ASK THE DJ, HIDE IDS, SET NOTES, the stream clock, RUNNING LATE and what kind of nights you do. The next owner gets the first-run walk.',
    'WATCH FROM HOME\'s GitHub token.',
    'The black box\'s lines: one line says when it was reset.',
  ];
  const STAYS = ['GHOST LINK itself and its updates.', 'The stock sound packs.', 'The DJ cable connection.'];

  let sheet = null, step = 1, nights = 'erase', music = 'erase', info = null, err = '', done = null, busy = false;

  // On STATUS: the button, under BACKUP. #151: HAND OVER is the friendly name for GET READY TO SELL (one wipe).
  host.append(
    el('div', 'buttons', null),
    el('div', 'note', 'Selling GHOST LINK, giving it away, or starting over: the box goes back to new. Owner only, never during a night.'));
  const open = btn('HAND OVER', 'stop', () => start());
  host.firstChild.append(open);

  async function start() {
    if (!unlocked) return needUnlock();
    err = ''; done = null; step = 1; nights = 'erase'; music = 'erase'; info = null;
    try {
      const r = await fetch('/api/sell');
      if (r.status === 401) return needUnlock();
      if (r.status === 403) {
        const j = await r.json().catch(() => ({}));
        if (j.mustChange) return post('/api/sell', {}); // app.js shows "pick your own password first"
        err = 'HAND OVER needs the owner\'s password, not tonight\'s crew code.';
      } else info = await r.json();
    } catch (e) { err = 'The box didn\'t answer.'; }
    show();
  }

  function close() { if (sheet) { sheet.remove(); sheet = null; } }

  function show() {
    close();
    sheet = el('div', 'share sell');
    sheet.addEventListener('click', e => { if (e.target === sheet && !busy && !done) close(); });
    const box = el('div', 'share-box sell-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Hand over');
    sheet.append(box);
    document.body.append(sheet);
    render(box);
  }

  function unitName() { return info && info.unit ? info.unit.name : ''; }
  function unitLabel() { return info && info.unit ? info.unit.label : ''; }

  function render(box) {
    box.textContent = '';
    box.append(el('h3', 'sell-h', 'HAND OVER'));
    if (done) return renderDone(box);
    if (!info) {
      box.append(el('div', 'note warn', err || 'Loading...'));
      box.append(rowOf(btn('CLOSE', null, close)));
      return;
    }
    if (step === 1) {
      box.append(el('div', 'note', 'For selling this GHOST LINK (' + unitLabel() + ', ' + unitName() + '), giving it away or starting over. It gets a new key (links it made stop working), forgets its phones, Wi-Fi and HARD STOP link, and restarts at first-time setup.'));
      box.append(el('small', null, 'THE NIGHTS'));
      const n = info.nights || 0, rec = info.setRecordings || 0;
      box.append(el('div', 'note', 'PLAYED, history, recordings, records and arcade scores: ' + n + (n === 1 ? ' night' : ' nights') +
        (rec ? ', ' + rec + (rec === 1 ? ' set recording' : ' set recordings') : '') + '.'));
      const pick = el('div', 'buttons');
      pick.append(btn('ERASE THE NIGHTS', nights === 'erase' ? 'on' : '', () => { nights = 'erase'; render(box); }),
        btn('KEEP THE NIGHTS', nights === 'keep' ? 'on' : '', () => { nights = 'keep'; render(box); }));
      box.append(pick);
      box.append(el('div', 'note', nights === 'erase'
        ? 'ERASE when it goes to someone else: your sets and where you played go with you, not with the box.'
        : 'KEEP only if the box stays with you or your crew: the next person sees every night\'s tracklist and venue names.'));
      // #151 KEEP MY MUSIC: off by default (someone else's crate)
      box.append(el('small', null, 'THE MUSIC'));
      const s = info.sticks || 0;
      box.append(el('div', 'note', 'The box never copies your library: it reads each stick fresh. It remembers whose USB stick is whose: ' + s + (s === 1 ? ' stick.' : ' sticks.')));
      const mp = el('div', 'buttons');
      mp.append(btn('CLEAR IT', music === 'erase' ? 'on' : '', () => { music = 'erase'; render(box); }),
        btn('KEEP MY MUSIC', music === 'keep' ? 'on' : '', () => { music = 'keep'; render(box); }));
      box.append(mp);
      box.append(el('div', 'note', music === 'erase' ? 'CLEAR when it goes to someone else.' : 'KEEP only when you are starting over with your own sticks.'));
      const bk = el('div', 'buttons');
      const a = el('a', 'btn', 'DOWNLOAD A BACKUP FIRST');
      a.href = '/api/backup.zip'; a.setAttribute('download', '');
      bk.append(a);
      box.append(bk);
      box.append(el('div', 'note', 'The backup holds your venues, nights and password, so a new box of yours can have them back (RESTORE).'));
      box.append(el('small', null, 'GOES'));
      const ul = el('ul', 'sell-list');
      GOES.forEach(t => ul.append(el('li', null, t)));
      box.append(ul);
      box.append(el('small', null, 'STAYS'));
      const ul2 = el('ul', 'sell-list');
      STAYS.forEach(t => ul2.append(el('li', null, t)));
      box.append(ul2);
      if (info.busy) box.append(el('div', 'note warn', info.busy + ' HAND OVER waits until the night is over.'));
      const next = btn('NEXT', null, () => { step = 2; err = ''; render(box); });
      next.disabled = !!info.busy;
      box.append(rowOf(next, btn('CANCEL', null, close)));
      return;
    }
    // Step 2: the password, the name typed (or hold).
    box.append(el('div', 'note', nights === 'erase' ? 'Last step. Erasing everything listed, and the nights. Only a backup brings it back.'
      : 'Last step. Erasing everything listed; keeping the nights. Only a backup brings it back.'));
    const pw = el('input');
    pw.type = 'password'; pw.placeholder = 'owner password'; pw.autocomplete = 'current-password';
    pw.setAttribute('aria-label', 'Owner password');
    const typed = el('input');
    typed.placeholder = unitName(); typed.autocomplete = 'off'; typed.autocapitalize = 'none'; typed.maxLength = 30;
    typed.setAttribute('aria-label', 'Type the unit name to confirm');
    box.append(pw);
    box.append(el('small', null, 'TYPE ' + unitName() + ' TO CONFIRM, OR HOLD THE BUTTON 3 SECONDS'));
    box.append(typed);
    const go = el('button', 'stop sell-go', 'HOLD TO RESET');
    go.type = 'button';
    const matches = () => typed.value.trim().toLowerCase() === unitName().toLowerCase() && unitName() !== '';
    typed.oninput = () => { go.textContent = matches() ? 'HAND OVER' : 'HOLD TO RESET'; };
    let timer = null;
    const cancelHold = () => { clearTimeout(timer); timer = null; go.classList.remove('holding'); };
    go.addEventListener('click', () => { if (matches() && !busy) send(box, pw.value, typed.value); });
    go.addEventListener('pointerdown', () => {
      if (matches() || busy) return;
      go.classList.add('holding');
      timer = setTimeout(() => { cancelHold(); send(box, pw.value, 'HOLD'); }, 3000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => go.addEventListener(ev, cancelHold));
    go.addEventListener('contextmenu', e => e.preventDefault());
    go.disabled = busy;
    box.append(rowOf(go, btn('BACK', null, () => { step = 1; err = ''; render(box); }), btn('CANCEL', null, close)));
    if (busy) box.append(el('div', 'note', 'Telling your account, then wiping. Up to 20 seconds...'));
    if (err) box.append(el('div', 'note warn', err));
    if (!busy) pw.focus();
  }

  async function send(box, password, confirm) {
    if (!password) { err = 'Type the owner password first.'; return render(box); }
    busy = true; err = ''; render(box);
    try {
      const r = await post('/api/sell', { password, confirm, nights, music });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) done = j;
      else if (r.status !== 401) err = j.error || 'Didn\'t work: ' + glWhy(r.status, j);
    } catch (e) { err = 'The box didn\'t answer. If it restarted, it\'s done: open the dashboard again in a minute.'; }
    busy = false; render(box);
  }

  function renderDone(box) {
    box.append(el('div', 'note', 'Done. GHOST LINK is restarting as a new box (about 20 seconds). This phone is signed out.'));
    box.append(el('div', 'note' + (done.release === 'still-listed' ? ' warn' : ''), done.say || ''));
    if (done.account && /^https:\/\//.test(done.account)) { // #151
      const a = el('a', 'btn', 'ALSO LET IT GO IN YOUR ACCOUNT: ' + done.account.replace(/^https:\/\//, '').replace(/\/$/, ''));
      a.href = done.account; a.target = '_blank'; a.rel = 'noopener';
      box.append(rowOf(a));
    }
    box.append(el('div', 'note', 'The box forgot its saved Wi-Fi: unless it\'s on a known network or the DJ cable, it shows its own GHOST LINK network.'));
    box.append(el('div', 'note', 'Next owner: join GHOST LINK, open the dashboard, pick a password on STATUS.'));
    box.append(rowOf(btn('CLOSE', null, () => { close(); setTimeout(() => location.reload(), 300); })));
  }

  function rowOf(...b) { const r = el('div', 'buttons'); r.append(...b); return r; }

  return { start };
})();
