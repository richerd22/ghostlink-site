'use strict';
// THE PA for HARD STOP (STATUS -> ANNOUNCEMENTS -> HARD STOP, DECISIONS #101). Two owner switches, both off until the
// owner turns them on, each with one confirm that says what HARD STOP could play:
// - AUTO CALLS: at HARD STOP's 10 MIN / 5 MIN / MUSIC OFF (and LAST CALL when HARD STOP sends one) the box plays the
//   card picked for it, once a night, only while the HARD STOP app's own AUTO CALLS is on too.
// - LET HARD STOP CALL THE PA: panels and the app may play sounds off this board (never EMERGENCY or TEST).
// Shows the app's side too (on / off / not heard from). Names go into the page as text only. Own file: if anything
// here throws, the rest of the dashboard carries on.
const HardStopPa = (() => {
  const box = $('hsPa');
  if (!box) return {};
  let data = null, loadedAt = 0, pendingOn = null;
  const P = () => S.status && S.status.hardstopPa;
  const on = (b, v) => { b.textContent = v ? 'TURN OFF' : 'TURN ON'; b.classList.toggle('on', !!v); b.setAttribute('aria-pressed', String(!!v)); };
  const hhmm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function appLine(p) {
    if (!p || p.at == null) return 'HARD STOP app: not heard from. Its own switches (AUTO CALLS, PANELS CALL THE PA) are in the app.';
    return 'HARD STOP app: AUTO CALLS ' + (p.autoCalls ? 'on' : 'off') + ' · PANELS CALL THE PA ' + (p.panelsCallPa ? 'on' : 'off')
      + (data && data.app && data.app.heardAt ? ' (told the box at ' + hhmm(data.app.heardAt) + ')' : '') + '.';
  }

  function render() {
    const p = P();
    if (!p) return;
    on($('hsPaAuto'), p.box.autoCalls);
    on($('hsPaCall'), p.box.letHardStopCallPa);
    $('hsPaApp').textContent = appLine(p);
    const both = (a, b) => a && b ? 'Both sides on: ' : a ? 'On here; waiting for the app. ' : b ? 'On in the app; off here. ' : '';
    $('hsPaAutoNote').textContent = both(p.box.autoCalls, p.autoCalls) + 'At HARD STOP\'s 10 MIN, 5 MIN and MUSIC OFF the box plays the card below, once each a night.';
    $('hsPaCallNote').textContent = both(p.box.letHardStopCallPa, p.panelsCallPa) + 'HARD STOP\'s panels and app can play sounds off this board (never EMERGENCY or TEST), after a confirm there. Anyone here can STOP.';
    if (box.open && Date.now() - loadedAt > 15000) load();
  }

  async function load() {
    loadedAt = Date.now();
    try {
      const r = await fetch('/api/announce/hardstop');
      if (r.status === 401) { $('hsPaStages').textContent = ''; note('hsPaNote', 'Unlock (crew code or password) to see the cards.'); return; }
      if (!r.ok) return;
      data = await r.json();
      drawStages();
      render();
    } catch (e) {}
  }

  function drawStages() {
    const wrap = $('hsPaStages');
    wrap.textContent = '';
    (data.stages || []).forEach(st => {
      const row = document.createElement('label');
      row.className = 'hs-stage';
      const w = document.createElement('span');
      w.textContent = st.words;
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Card for ' + st.words);
      const opt = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
      opt('', st.picked === '' ? (st.name ? 'PACK\'S: ' + st.name : (st.stage === 'LAST' ? 'NOTHING (pick one)' : 'NOTHING (not in the pack)')) : 'THE PACK\'S CARD');
      opt('none', 'NOTHING');
      (data.choices || []).forEach(c => opt(c.id, c.name));
      sel.value = st.picked && st.picked !== 'none' && !(data.choices || []).some(c => c.id === st.picked) ? '' : st.picked;
      sel.addEventListener('change', () => send({ cards: { [st.stage]: sel.value } }, 'Saved: ' + st.words + '.'));
      row.append(w, sel);
      wrap.appendChild(row);
    });
  }

  async function send(body, done) {
    if (!unlocked) { pending = null; return needUnlock(); }
    $('hsPaAsk').hidden = true;
    const r = await post('/api/announce/hardstop', body);
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && j.ask === 'CONFIRM') { // one confirm, turning ON only
      pendingOn = body;
      $('hsPaAskText').textContent = j.text;
      $('hsPaAsk').hidden = false;
      $('hsPaYes').focus();
      return;
    }
    if (r.status === 403) return note('hsPaNote', j.owner ? "These need the owner's password, not tonight's crew code." : (j.text || 'Not changed.'), true);
    if (r.status === 401) return;
    if (!r.ok) return note('hsPaNote', j.text || 'Not changed.', true);
    data = j; loadedAt = Date.now(); drawStages();
    note('hsPaNote', done || 'Saved.');
  }

  $('hsPaAuto').addEventListener('click', () => { const p = P(); const v = !(p && p.box.autoCalls); send({ autoCalls: v }, v ? 'AUTO CALLS on.' : 'AUTO CALLS off.'); });
  $('hsPaCall').addEventListener('click', () => { const p = P(); const v = !(p && p.box.letHardStopCallPa); send({ letHardStopCallPa: v }, v ? 'HARD STOP can call the PA.' : 'HARD STOP can\'t call the PA.'); });
  $('hsPaYes').addEventListener('click', () => { const b = pendingOn; pendingOn = null; if (b) send(Object.assign({}, b, { confirm: true }), 'On.'); });
  $('hsPaNo').addEventListener('click', () => { pendingOn = null; $('hsPaAsk').hidden = true; note('hsPaNote', 'Left off.'); });
  box.addEventListener('toggle', () => { if (box.open) { loadedAt = 0; render(); } });

  const orig = renderStatus;
  renderStatus = function () {
    orig.apply(this, arguments);
    try { render(); } catch (e) { console.warn('hardstoppa', e); }
  };
  return { render };
})();
