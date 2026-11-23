'use strict';
// THE EAR (DECISIONS #108). a club, Nov 21: the main set was a laptop DJ and GHOST LINK had nothing (no DJ Link from
// Serato / rekordbox on a laptop / Traktor). When no DJ Link deck plays and SOUND IN hears a beat, the box works out
// the BPM, the beat and the big moments (BREAKDOWN / BUILD / THE DROP) from the sound alone: status.ear.
// - DECKS and NOW: one card, "BY EAR · ~124 BPM", never dressed as a deck (no title, art, key, waveform).
// - NETWORK -> SOUND IN: the owner switch LISTEN FOR BPM WHEN NO DECKS (laptop DJs), on unless turned off.
// A DJ Link deck playing always wins: the card goes the moment one plays. Text nodes only.
const Ear = (() => {
  const css = document.createElement('style');
  css.textContent = `
.ear-card { border: 1px solid var(--line); padding: 10px 12px; margin: 8px 0; display: grid; grid-template-columns: auto 1fr auto; gap: 2px 14px; align-items: center; }
.ear-card[hidden] { display: none; }
.ear-card .e-bpm { font-size: 38px; font-weight: 600; line-height: 1; grid-row: 1 / 3; font-variant-numeric: tabular-nums; }
.ear-card .e-lbl { letter-spacing: .12em; font-size: 12px; color: var(--grey); }
.ear-card .e-sec { font-weight: 600; letter-spacing: .06em; }
.ear-card .e-sec.drop { background: var(--fg); color: var(--bg); padding: 0 6px; justify-self: start; }
.ear-card .e-beat { display: flex; gap: 4px; grid-row: 1 / 3; }
.ear-card .e-beat i { width: 12px; height: 12px; border: 1px solid #444; }
.ear-card .e-beat i.on { background: var(--fg); border-color: var(--fg); }
.ear-card .e-note { grid-column: 1 / -1; color: var(--grey); font-size: 12px; margin-top: 4px; }
@media (max-width: 400px) { .ear-card { grid-template-columns: auto 1fr; } .ear-card .e-sec { grid-column: 2; grid-row: 2; } .ear-card .e-beat { grid-row: 3; grid-column: 1 / -1; } .ear-card .e-note { grid-row: 4; } }
@media (max-height: 340px) { .ear-card { padding: 6px 8px; margin: 4px 0; } .ear-card .e-bpm { font-size: 28px; } .ear-card .e-note { display: none; } }`;
  document.head.appendChild(css);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function card() {
    const c = el('div', 'ear-card'); c.hidden = true;
    c.setAttribute('role', 'status');
    const bpm = el('div', 'e-bpm'), lbl = el('div', 'e-lbl'), sec = el('div', 'e-sec'), beat = el('div', 'e-beat'), note = el('div', 'e-note');
    for (let i = 0; i < 4; i++) beat.appendChild(el('i'));
    c.append(bpm, lbl, beat, sec, note);
    c._ = { bpm, lbl, sec, beat, note };
    return c;
  }
  const decksCard = card(), nowCard = card();
  const bar = document.querySelector('#decks .deckbar');
  if (bar) bar.after(decksCard);
  const nowBody = document.getElementById('nowBody');
  if (nowBody) nowBody.before(nowCard);

  /** The ear now, or null: status.ear, only while no deck is in focus; beat 1-4 (0 = where the 1 is isn't known). */
  function now() {
    const e = S.status && S.status.ear;
    if (!e || !e.bpm || S.demo) return null;
    try { if (typeof focusDeck === 'function' && focusDeck()) return null; } catch (x) { /* no decks */ }
    const box = Date.now() - (S.skew || 0), k = Math.floor((box - e.beatAt) / e.beatMs);
    return Object.assign({}, e, { k, at: box - (e.beatAt + k * e.beatMs), beat: e.bar ? (((e.bar - 1 + k) % 4) + 4) % 4 + 1 : 0, box });
  }
  const set = (n, v) => { if (n.textContent !== v) n.textContent = v; };
  function paint(c, e) {
    c.hidden = !e;
    if (!e) return;
    const p = c._;
    set(p.bpm, '~' + Math.round(e.bpm));
    set(p.lbl, 'BPM BY EAR' + (e.conf < 0.3 ? ' · NOT SURE' : ''));
    set(p.sec, e.section === 'GROOVE' ? 'NO DJ LINK DECK PLAYING' : e.section === 'DROP' ? 'THE DROP' : e.section);
    p.sec.classList.toggle('drop', e.section === 'DROP');
    const lit = e.beat ? e.beat - 1 : (e.at < e.beatMs * 0.45 ? 0 : -1);
    [...p.beat.children].forEach((i, k) => { i.classList.toggle('on', k === lit); i.hidden = !e.beat && k > 0; });
    const inS = e.nextDrop ? Math.max(0, Math.ceil((e.nextDrop - e.box) / 1000)) : null;
    set(p.note, inS != null ? 'THE DROP maybe in ~' + inS + ' s (a guess from 8-bar lines).'
      : 'From the sound card (a laptop DJ?). An estimate: no title, no key, no waveform.');
  }
  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (t - last < 50) return; // 20 a second is plenty
    last = t;
    const e = now();
    paint(decksCard, e);
    paint(nowCard, e);
    // NOW's "Nothing playing yet" would contradict the card: hide it while the ear hears a beat
    const nothing = nowBody && nowBody.querySelector(':scope > .empty-note');
    if (nothing && nothing.hidden !== !!e) nothing.hidden = !!e;
  }
  requestAnimationFrame(frame);

  // ---------- the owner switch (NETWORK -> SOUND IN) ----------
  const sound = document.getElementById('sound');
  const box = el('div', 'row local-only'); box.id = 'earSwitchBox';
  const sw = el('button', null, ''); sw.type = 'button'; sw.id = 'earSwitch';
  const swNote = el('span', 'note'); swNote.id = 'earNote';
  box.append(sw, swNote);
  if (sound) sound.appendChild(box);
  const on = () => !(S.status && S.status.earOn === false);
  function label() {
    const t = 'LISTEN FOR BPM WHEN NO DECKS (laptop DJs): ' + (on() ? 'ON' : 'OFF');
    if (sw.textContent !== t) sw.textContent = t;
    box.hidden = !(S.status && S.status.audio && S.status.audio.card);
  }
  setInterval(label, 1000);
  label();
  sw.addEventListener('click', async () => {
    const want = !on();
    let r;
    try { r = await post('/api/ear', { on: want }); } catch (x) { note('earNote', "Couldn't reach the box.", true); return; }
    if (r.status === 401) return; // post() opened the lock
    if (r.status === 403) { note('earNote', "That needs the owner's password, not tonight's crew code.", true); return; }
    if (!r.ok) { note('earNote', "Didn't change (" + r.status + ').', true); return; }
    if (S.status) S.status.earOn = want;
    note('earNote', want ? 'On: with no DJ Link deck playing, the box shows the BPM it hears, marked BY EAR.' : 'Off: nothing by ear.');
    label();
  });
  return { now };
})();
