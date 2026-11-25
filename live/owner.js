'use strict';
/*
 * OWNERSHIP (DECISIONS #151): STATUS -> THE BOX -> YOUR ACCOUNT, owner only, and the one optional card FIRST RUN ends
 * with: KEEP IT IN YOUR ACCOUNT? (KEEP IT / NOT NOW). The account is optional: nothing on the box needs it, nothing is
 * gated, NOT NOW is never asked again.
 *  - Not claimed: KEEP IT shows the code and a QR to <site>/claim/#CODE (the code in the #fragment only).
 *  - WAITING FOR THE OWNER: another account holds this box; it moves when they let it go (or in 7 days).
 *  - CLAIMED (no email shown): EMAILS ME ABOUT UPDATES on/off, the account link, HAND OVER.
 *  - #152 ASK ONCE: while the account says the owner never answered (askUpdates), one small question on top:
 *    TELL ME WHEN GHOST LINK HAS AN UPDATE? YES / NO THANKS. Either answer is the same signed switch (POST
 *    /api/owner/emails), which ends the asking. No nag, nothing gated; the switch below stays.
 * Own file; uses app.js globals ($, unlocked, needUnlock, glWhy). Network text goes in as text nodes only.
 */
const Owner = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const send = async (path, body) => {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GhostLink-Dashboard': '1' }, body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, j };
    } catch (e) { return { ok: false, status: 0, j: { error: "The box didn't answer." } }; }
  };
  const get = async fresh => {
    try {
      const r = await fetch('/api/owner' + (fresh ? '?fresh=1' : ''), { cache: 'no-store' });
      if (!r.ok) return { status: r.status };
      return await r.json();
    } catch (e) { return null; }
  };
  const day = ms => { try { return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase(); } catch (e) { return ''; } };
  const short = u => String(u || '').replace(/^https:\/\//, '').replace(/\/$/, '');

  let st = null, claim = null, poll = null;

  /** The code + QR + what the account said, into `box`. `after` (optional): what NEXT does. Polls while it waits. */
  function claimView(box, after) {
    box.textContent = '';
    if (!claim) return;
    box.append(el('small', null, 'YOUR CODE (10 MINUTES)'));
    box.append(el('div', 'own-code', claim.code));
    if (claim.qr) {
      const qr = new DOMParser().parseFromString(claim.qr, 'image/svg+xml').documentElement;
      if (qr && qr.nodeName === 'svg') { const w = el('div', 'own-qr'); w.append(document.importNode(qr, true)); box.append(w); }
      box.append(el('p', 'own-note', 'Scan it with your phone: the account page opens with the code filled in, and asks for your email if you\'re not signed in.'));
      const a = el('a', 'btn', 'OPEN ON THIS PHONE'); a.href = claim.claimUrl; a.target = '_blank'; a.rel = 'noopener';
      box.append(row(a));
    } else {
      box.append(el('p', 'own-note', 'Type this code on your account\'s CLAIM page when it\'s open. The box works the same either way.'));
    }
    if (!claim.deposited) box.append(el('p', 'own-note', 'No internet on the box right now: the code reaches your account once it has some (or from this phone).'));
    const said = el('p', 'own-state', 'WAITING FOR YOUR PHONE...');
    box.append(said);
    if (after) box.append(row(btn('NEXT', 'fr-main', () => { stop(); after(); })));
    stop();
    const until = Date.now() + 10 * 60000;
    poll = setInterval(async () => {
      if (Date.now() > until) { stop(); said.textContent = 'The code ended. KEEP IT again makes a new one.'; return; }
      const s = await get(true);
      if (!s || !s.state) return;
      st = s;
      if (s.claimed) { stop(); said.textContent = 'CLAIMED. It\'s in your account now.'; mount(); }
      else if (s.pending) { stop(); said.textContent = waiting(s); mount(); }
    }, 5000);
  }
  function stop() { if (poll) { clearInterval(poll); poll = null; } }
  function waiting(s) {
    return 'WAITING FOR THE OWNER. Another account holds this box. It moves to yours when they let it go'
      + (s.until ? ', or by itself on ' + day(s.until) : ', or by itself in 7 days') + '.';
  }
  function row(...b) { const r = el('div', 'buttons'); r.append(...b); return r; }

  async function keep(box, after) {
    const r = await send('/api/owner/claim', {});
    if (r.status === 401) { needUnlock(); return false; }
    if (!r.ok) {
      box.textContent = '';
      if (r.j && (r.j.claimed || r.j.pending)) { st = r.j; mount(); box.append(el('p', 'own-state', r.j.claimed ? 'CLAIMED. It\'s in your account already.' : waiting(r.j))); }
      else box.append(el('p', 'own-note warn', r.j.error || ('Didn\'t work: ' + glWhy(r.status, r.j))));
      if (after) box.append(row(btn('NEXT', 'fr-main', after)));
      return false;
    }
    claim = r.j;
    // The box had no internet: hand the signed offer to the accounts relay from this phone (as CLAIM THIS BOX does).
    if (!claim.deposited && claim.relay && /^https:\/\//.test(claim.relay)) {
      try {
        const offer = { box: claim.box, pub: claim.pub, code: claim.code, exp: claim.exp, sig: claim.sig,
          kind: claim.kind, number: claim.number, label: claim.label, name: claim.name };
        const rr = await fetch(claim.relay + '/api/boxes/claim-offer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(offer) });
        claim.deposited = rr.status === 201;
      } catch (e) { /* no internet here either */ }
    }
    claimView(box, after);
    return true;
  }

  // ---------- FIRST RUN's last card ----------
  /** True when FIRST RUN should end with KEEP IT IN YOUR ACCOUNT? (never answered, not claimed). */
  async function wantsCard() {
    const s = await get(false);
    if (!s || !s.state) return false;
    st = s;
    return !!s.offer;
  }

  /** The card, inside FIRST RUN's sheet box. `done` closes the walk. */
  function card(box, done) {
    box.append(el('p', 'fr-lead', 'Optional. It puts this box in your account (the same one for GHOST LINK and HARD STOP): its version and updates in one place, links you made, and an email when an update is out. Everything on the box works the same without it.'));
    const slot = el('div', 'own-slot');
    box.append(slot);
    const r = el('div', 'fr-row');
    const notNow = btn('NOT NOW', 'ghostbtn', async () => { await send('/api/owner/answer', { answer: 'notnow' }); done(); });
    const keepIt = btn('KEEP IT', 'fr-main', async () => {
      keepIt.disabled = notNow.disabled = true;
      r.remove();
      await keep(slot, done);
    });
    r.append(notNow, keepIt);
    box.append(r);
    box.append(el('p', 'fr-foot', 'NOT NOW is the end of it: no reminder. Later, if you want: STATUS -> YOUR ACCOUNT.'));
  }

  // ---------- STATUS -> YOUR ACCOUNT ----------
  async function mount(fresh) {
    const host = $('ownerBox');
    if (!host) return;
    if (fresh || !st) { const s = await get(fresh); if (s && s.state) st = s; else if (s && (s.status === 401 || s.status === 403)) st = null; }
    host.textContent = '';
    const cb = $('slClaimBtn'); // SHARE's CLAIM THIS BOX: only while the box isn't claimed
    if (cb) cb.hidden = !!(st && !st.mayClaim);
    if (!st) {
      host.append(el('div', 'note', 'Whether this box is in your account (optional). Owner only: unlock to see it.'));
      return;
    }
    const acct = st.account, acctShort = st.accountShort || short(acct);
    if (st.claimed) {
      host.append(el('div', 'note own-state', 'CLAIMED. This box is in your account.'));
      if (pure.askShown(st)) host.append(askOnce(host));
      if (st.updates !== null && st.updates !== undefined) {
        const on = !!st.updates;
        const b = btn('EMAILS ME ABOUT UPDATES: ' + (on ? 'ON' : 'OFF'), on ? 'on' : '', async () => {
          b.disabled = true;
          const r = await send('/api/owner/emails', { updates: !on });
          if (r.ok) st = Object.assign(st, r.j); else host.append(el('div', 'note warn', r.j.error || glWhy(r.status, r.j)));
          mount();
        });
        host.append(row(b));
        host.append(el('div', 'note', 'One email when an update for GHOST LINK is out, from "GHOST LINK". Never anything else.'));
      }
      const a = el('a', 'btn', acctShort.toUpperCase()); a.href = acct; a.target = '_blank'; a.rel = 'noopener';
      const h = btn('HAND OVER', 'stop', () => { if (typeof Sell !== 'undefined' && Sell.start) Sell.start(); });
      host.append(row(a, h));
      host.append(el('div', 'note', 'Selling it or giving it away: HAND OVER wipes it for the next owner. Then let it go in your account too.'));
      return;
    }
    if (st.pending) {
      host.append(el('div', 'note own-state', waiting(st)));
      return;
    }
    host.append(el('div', 'note', 'Not in an account. That\'s fine: everything works without one. KEEP IT puts it in yours (one for GHOST LINK and HARD STOP).'));
    const slot = el('div', 'own-slot');
    const k = btn('KEEP IT IN YOUR ACCOUNT', null, async () => { if (!unlocked) return needUnlock(); k.disabled = true; await keep(slot); k.disabled = false; });
    host.append(row(k), slot);
  }

  /** #152 ASK ONCE: the one question. Either answer posts the switch; the account then stops asking. */
  function askOnce(host) {
    const q = el('div', 'own-ask');
    q.style.margin = '8px 0 18px'; // its own little block, apart from the switch below
    q.append(el('div', 'note', 'TELL ME WHEN GHOST LINK HAS AN UPDATE?'));
    const answer = async on => {
      yes.disabled = no.disabled = true;
      const r = await send('/api/owner/emails', { updates: on });
      if (r.status === 401) { yes.disabled = no.disabled = false; return needUnlock(); }
      if (r.ok) { st = Object.assign(st, r.j); mount(); return; }
      yes.disabled = no.disabled = false;
      host.append(el('div', 'note warn', r.j.error || glWhy(r.status, r.j)));
    };
    const yes = btn('YES', null, () => answer(true));
    const no = btn('NO THANKS', 'ghostbtn', () => answer(false));
    q.append(row(yes, no));
    return q;
  }
  const pure = { askShown: s => !!(s && s.claimed && s.askUpdates === true) };
  if (typeof document === 'undefined') return pure;

  if ($('ownerBox')) mount();
  // Opening the section (after an unlock, say) asks the account again.
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'go-account' && e.target.open) mount(true); }, true);
  // Unlocking or locking STATUS (app.js toggles #status.locked): ask again, so the section matches.
  const stEl = $('status');
  if (stEl && typeof MutationObserver === 'function') {
    let was = stEl.classList.contains('locked');
    new MutationObserver(() => { const now = stEl.classList.contains('locked'); if (now !== was) { was = now; mount(true); } })
      .observe(stEl, { attributes: true, attributeFilter: ['class'] });
  }
  return Object.assign({ wantsCard, card, mount, state: () => st }, pure);
})();
if (typeof module !== 'undefined') module.exports = Owner;
