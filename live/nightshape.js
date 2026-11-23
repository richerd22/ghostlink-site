'use strict';
// THE NIGHT'S SHAPE + GOODNIGHT (#107). The box says which part of the night it is (/api/status `phase`: PRE-DOORS,
// DOORS, NIGHT, LAST HOUR, LAST 15, MUSIC OFF, AFTER, with `phaseEnds`, from tonight's plan / HARD STOP's times) and
// whether GOODNIGHT is up (`goodnight`: the END OF NIGHT card on the TV and every dashboard).
//  - NightShape.dashboard(): one calm block at the top of NOW. PRE-DOORS: READY FOR TONIGHT's verdict + SOUND CHECK.
//    DOORS: who's on. NIGHT: nothing. LAST HOUR / LAST 15: time left + a LAST SONG cue. MUSIC OFF: GOODNIGHT.
//    AFTER (or GOODNIGHT up): the END OF NIGHT card + SET DNA. Plus a GOODNIGHT block in SEND A CREW CALL with the
//    owner's LET HARD STOP SEND GOODNIGHT switch. Uses app.js globals (S, position, post, unlocked, needUnlock,
//    pending, role, ROLES), easy.js (Easy.checks) and endnight.js (EndNight.render).
//  - NightShape.tv(get): TV MODE. A LAST HOUR / LAST 15 tag, a PRE-DOORS / MUSIC OFF line on the idle screen, and the
//    END OF NIGHT card full screen after the night (or when GOODNIGHT is up). Crew calls stay on top.
// Text nodes only.
const NightShape = (() => {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  /** 2 H 10 MIN · 47 MIN · 1:35 (under 2 min). */
  function left(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 120) return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    const m = Math.ceil(s / 60), h = Math.floor(m / 60);
    return h ? h + ' H' + (m % 60 ? ' ' + (m % 60) + ' MIN' : '') : m + ' MIN';
  }
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /** The deck on air: the master playing on air, else any playing on air, else the master playing. */
  function onAir(decks) {
    const ds = decks.filter(d => d && d.load === 'LOADED' && d.playing);
    return ds.find(d => d.onAir && d.master) || ds.find(d => d.onAir) || ds.find(d => d.master) || null;
  }

  /** A typical track length tonight (gaps between PLAYED lines, last 10), 2:30 to 8:00; 5:00 when unknown. */
  function typical(played) {
    const at = (played || []).map(p => p.at).filter(Number.isFinite).slice(-11);
    const gaps = []; for (let i = 1; i < at.length; i++) gaps.push(at[i] - at[i - 1]);
    if (gaps.length < 2) return 300000;
    gaps.sort((a, b) => a - b);
    return Math.min(480000, Math.max(150000, gaps[Math.floor(gaps.length / 2)]));
  }

  /**
   * LAST SONG cue: {text, warn} from the on-air track's time left (rem ms), the time to MUSIC OFF (L ms) and a typical
   * track length (avg ms). Pure (tested under Node).
   */
  function lastSong(rem, L, avg, phase) {
    if (L == null) return null;
    if (rem == null) return { text: 'NOTHING ON AIR', warn: false };
    if (rem >= L - 15000) {
      const over = rem - L;
      return over > 30000 ? { text: 'THIS IS THE LAST SONG · IT RUNS ' + mmss(over) + ' PAST MUSIC OFF', warn: true }
        : { text: 'THIS IS THE LAST SONG', warn: false };
    }
    const after = L - rem;
    if (after <= avg + 30000) return { text: 'NEXT ONE IS THE LAST SONG · ABOUT ' + mmss(after) + ' FOR IT', warn: phase === 'LAST 15' };
    const n = 1 + Math.round(after / avg);
    return { text: 'ABOUT ' + n + ' TRACKS LEFT', warn: false };
  }

  /** What the top block says for a phase: {head, sub, kind} (kind: ready / cue / off / card / none). Pure. */
  function block(st, nowMs) {
    const ph = st && st.phase, ends = st && st.phaseEnds;
    if (st && st.goodnight) return { head: 'GOODNIGHT', sub: 'END OF NIGHT IS UP' + (st.goodnight.by ? ' · ' + st.goodnight.by : ''), kind: 'card' };
    switch (ph) {
      case 'PRE-DOORS': return { head: 'PRE-DOORS', sub: ends ? 'DOORS ' + hm(ends) + ' · IN ' + left(ends - nowMs) : '', kind: 'ready' };
      case 'DOORS': return { head: 'DOORS OPEN', sub: st.dj && st.dj !== 'SOUNDCHECK' ? 'ON THE DECKS ' + st.dj : 'NOBODY ON THE DECKS YET', kind: 'none' };
      case 'LAST HOUR': case 'LAST 15':
        return { head: ph, sub: st.musicOffAt ? 'MUSIC OFF ' + hm(st.musicOffAt) + ' · ' + left(st.musicOffAt - nowMs) + ' LEFT' : '', kind: 'cue' };
      case 'MUSIC OFF': return { head: 'MUSIC OFF', sub: st.musicOffAt ? hm(st.musicOffAt) : '', kind: 'off' };
      case 'AFTER': return { head: 'AFTER', sub: 'THE NIGHT IS DONE', kind: 'card' };
      default: return null; // NIGHT: nothing up top
    }
  }

  // ---------- END OF NIGHT card (shared) ----------
  let card = null, cardNight = '', cardAt = 0;
  async function loadCard(night) {
    if (night === cardNight && Date.now() - cardAt < 60000) return card;
    cardAt = Date.now();
    try {
      const r = await fetch('/api/endofnight' + (night ? '?night=' + encodeURIComponent(night) : ''), { cache: 'no-store' });
      if (r.ok) { card = await r.json(); cardNight = night; }
    } catch (e) { /* keep the last one */ }
    return card;
  }

  // ---------- dashboard ----------
  function dashboard() {
    const now = document.getElementById('now'), body = document.getElementById('nowBody');
    if (!now || !body) return;
    const box = el('div', 'night-shape'); box.id = 'nightShape'; box.hidden = true; box.setAttribute('aria-live', 'polite');
    body.before(box);
    const boxNow = () => Date.now() - (S.skew || 0);
    let sig = '';

    async function goodnight(up) {
      const st = S.status || {};
      if (up && st.phase && !/MUSIC OFF|AFTER/.test(st.phase) && !confirm('Music off isn\'t until ' + (st.musicOffAt ? hm(st.musicOffAt) : 'later') + '. Put the END OF NIGHT card up on the TV and every dashboard now?')) return;
      if (up && (!st.phase || /MUSIC OFF|AFTER/.test(st.phase)) && !confirm('GOODNIGHT: put the END OF NIGHT card up on the TV and every dashboard?')) return;
      if (!unlocked) { pending = null; return needUnlock(); }
      const r = role === 'dj' || typeof ROLES === 'undefined' ? 'BOOTH' : ((ROLES[role] && ROLES[role].label) || 'CREW');
      const res = await post('/api/goodnight', { on: up, from: r });
      if (res.ok) { sig = ''; gnSay(up ? 'GOODNIGHT is up on the TV and the dashboards.' : 'GOODNIGHT taken down.'); }
    }

    function render() {
      const st = S.status;
      if (!st || now.hidden) return;
      const b = block(st, boxNow());
      const decks = Object.values(S.decks || {});
      const d = onAir(decks);
      let cue = null;
      if (b && b.kind === 'cue') {
        const rem = d && d.durationMs ? (d.durationMs - position(d)) / (1 + (d.pitch || 0) / 100) : null;
        cue = lastSong(rem, st.musicOffAt ? st.musicOffAt - boxNow() : null, typical(S.played), st.phase);
      }
      let ready = null;
      if (b && b.kind === 'ready' && typeof Easy !== 'undefined' && Easy.checks) {
        try { const all = Easy.checks(st); ready = all.find(c => c.st === 'fix') || null; ready = { fix: ready, look: all.filter(c => c.st === 'look').length }; } catch (e) { ready = null; }
      }
      const playing = decks.filter(x => x.load === 'LOADED' && x.playing).map(x => x.player);
      const k = JSON.stringify([b, cue, ready && ready.fix && ready.fix.k, ready && ready.look, playing, card && cardNight, st.night]);
      if (k === sig) return;
      sig = k;
      box.hidden = !b;
      box.className = 'night-shape ns-' + (b ? b.head.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'none');
      if (!b) { box.replaceChildren(); return; }
      const head = el('div', 'ns-head');
      head.append(el('b', null, b.head), el('span', null, b.sub));
      const kids = [head];
      if (b.kind === 'ready') {
        const line = el('div', 'ns-line');
        if (ready && ready.fix) line.append(el('b', 'warn', 'FIX FIRST: ' + ready.fix.k), el('span', null, ' ' + ready.fix.say));
        else line.append(el('b', null, 'READY FOR TONIGHT'), el('span', null, ready && ready.look ? ' · ' + ready.look + ' TO LOOK AT' : ' · EVERYTHING CHECKS OUT'));
        const go = el('button', 'mini', 'CHECK'); go.type = 'button'; go.onclick = () => { location.hash = '#status'; };
        line.append(go);
        const sc = el('div', 'ns-line');
        sc.append(el('b', null, 'SOUND CHECK'), el('span', null, playing.length
          ? ' · DECK ' + playing.join(' + ') + ' PLAYING · marked SOUNDCHECK until doors'
          : ' · play anything: it\'s marked SOUNDCHECK until doors'));
        kids.push(line, sc);
      } else if (b.kind === 'cue' && cue) {
        kids.push(el('div', 'ns-cue' + (cue.warn ? ' warn' : ''), cue.text));
      } else if (b.kind === 'off') {
        const line = el('div', 'ns-line');
        const still = d && d.onAir;
        line.append(el('span', null, still ? 'STILL PLAYING ON AIR · ' : 'THE MUSIC IS OFF · '));
        const g = el('button', 'mini', 'GOODNIGHT'); g.type = 'button'; g.onclick = () => goodnight(true);
        line.append(g);
        kids.push(line);
      } else if (b.kind === 'card') {
        const c = el('div', 'ns-card');
        if (card && cardNight === st.night) EndNight.render(c, card); else c.append(el('div', 'line', 'Loading the END OF NIGHT card...'));
        const links = el('div', 'ns-line');
        const full = el('a', 'btn', 'FULL CARD · SAVE'); full.href = 'endnight.html?night=' + encodeURIComponent(st.night || '');
        const dna = el('a', 'btn', 'SET DNA'); dna.href = 'setdna.html?night=' + encodeURIComponent(st.night || '');
        links.append(full, dna);
        if (st.goodnight) { const x = el('button', 'mini', 'TAKE IT DOWN'); x.type = 'button'; x.onclick = () => goodnight(false); links.append(x); }
        kids.push(links, c);
        loadCard(st.night).then(x => { if (x && sig) { sig = ''; } });
      }
      box.replaceChildren(...kids);
    }
    setInterval(() => { try { render(); } catch (e) { /* never break NOW */ } }, 1000);

    // GOODNIGHT block under SEND A CREW CALL (+ the owner's switch for HARD STOP).
    const cs = document.getElementById('crewSend');
    const wrap = el('details', 'crew-send ns-goodnight');
    const sum = el('summary', null, 'GOODNIGHT');
    const what = el('div', 'cs-as', 'The END OF NIGHT card on the TV view and at the top of every NOW, until it\'s taken down or the night is over.');
    const up = el('button', 'cs-go', 'GOODNIGHT'); up.type = 'button';
    const down = el('button', 'mini', 'TAKE IT DOWN'); down.type = 'button';
    const note = el('div', 'note cs-note');
    const hs = el('label', 'cs-check'); const hsBox = el('input'); hsBox.type = 'checkbox';
    hs.append(hsBox, document.createTextNode(' LET HARD STOP SEND GOODNIGHT (owner; its panels and app ask once to confirm)'));
    wrap.append(sum, what, up, down, note, hs);
    if (cs) cs.append(wrap);
    function gnSay(t, warn) { note.textContent = t; note.classList.toggle('warn', !!warn); }
    up.onclick = () => goodnight(true);
    down.onclick = () => goodnight(false);
    setInterval(() => {
      const g = S.status && S.status.goodnight;
      down.hidden = !g; up.hidden = !!g;
      if (!wrap.open) return;
      if (document.activeElement !== hsBox) hsBox.checked = !!(S.status && S.status.goodnightHardStop);
    }, 1000);
    hsBox.addEventListener('change', async () => {
      const want = hsBox.checked;
      if (!unlocked) { hsBox.checked = !want; pending = null; return needUnlock(); }
      const r = await post('/api/goodnight/settings', { hardstop: want });
      if (r.status === 403) { hsBox.checked = !want; gnSay('That switch needs the owner\'s password, not the crew code.', true); return; }
      if (r.ok) gnSay(want ? 'HARD STOP can send GOODNIGHT now (it confirms first).' : 'HARD STOP can\'t send GOODNIGHT.');
    });
  }

  // ---------- TV ----------
  function tv(getStatus, getSkew, focus) {
    const top = document.querySelector('.top .sp'), idle = document.querySelector('.idle > div');
    const tag = el('span', 'tag ns-tag'); tag.hidden = true;
    if (top) top.before(tag);
    const idleLine = el('div', 'ns-idle'); idleLine.hidden = true;
    if (idle) idle.append(idleLine);
    const over = el('div', 'ns-tv'); over.hidden = true;
    const inner = el('div', 'ns-card');
    over.append(inner);
    document.body.append(over);
    let sig = '';
    setInterval(() => {
      try {
        const st = getStatus(), nowMs = Date.now() - (getSkew() || 0);
        if (!st) return;
        const ph = st.phase;
        const t = ph === 'LAST HOUR' || ph === 'LAST 15' ? ph + (st.musicOffAt ? ' · ' + left(st.musicOffAt - nowMs) : '') : '';
        if (tag.textContent !== t) tag.textContent = t;
        tag.hidden = !t; tag.classList.toggle('soon', ph === 'LAST 15');
        const il = ph === 'PRE-DOORS' && st.phaseEnds ? 'DOORS ' + hm(st.phaseEnds) + ' · IN ' + left(st.phaseEnds - nowMs)
          : ph === 'MUSIC OFF' ? 'MUSIC OFF · GOODNIGHT' : '';
        if (idleLine.textContent !== il) idleLine.textContent = il;
        idleLine.hidden = !il;
        const show = !!st.goodnight || (ph === 'AFTER' && !focus());
        over.hidden = !show;
        if (!show) return;
        loadCard(st.night).then(c => {
          const k = c ? JSON.stringify(c) : '';
          if (!c || k === sig) return;
          sig = k;
          EndNight.render(inner, c);
        });
      } catch (e) { /* the TV keeps going */ }
    }, 1000);
  }

  return { dashboard, tv, block, lastSong, typical, left, onAir };
})();
if (typeof module !== 'undefined') module.exports = NightShape;
