'use strict';
// OPEN ON A PHONE (DECISIONS #162): the box's real addresses right now (GET /api/addresses), each with a QR and COPY.
// Richard, Nov 26: "opening the dash in Safari at the actual ip url would b dope". Shown on STATUS under READY FOR
// TONIGHT and in the share card (tap GHOST LINK, top left, in every window including the corner one). The best one
// first with its QR; the rest one tap away. Text nodes only. Needs copytext.js for COPY over http.
const Addr = (() => {
  /** Pure: the rows as the page shows them, best first ([{kind, url, label, here}] from the box). */
  function rows(list) {
    const order = { wifi: 0, hotspot: 1, lan: 2, name: 3, cable: 4 };
    return (list || []).filter(a => a && /^http:\/\/[a-z0-9.:-]+\/$/i.test(a.url || ''))
      .slice().sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
  }
  const bare = u => String(u).replace(/^http:\/\//, '').replace(/\/$/, '');

  if (typeof document === 'undefined') return { rows, bare };

  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const css = el('style');
  css.textContent = `
    .addr-box { display: grid; gap: 8px; margin: 10px 0; }
    .addr-row { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; border: 1px solid var(--line, #222); padding: 8px 10px; }
    .addr-row small { grid-column: 1 / -1; color: var(--grey, #9a9a9a); font-size: 12px; letter-spacing: .06em; }
    .addr-row code { font-size: 18px; font-weight: 600; overflow-wrap: anywhere; }
    .addr-row .addr-btns { display: flex; gap: 6px; }
    .addr-row img { grid-column: 1 / -1; width: 168px; height: 168px; background: #fff; padding: 6px; image-rendering: pixelated; }
    .addr-more { font: inherit; font-size: 12px; background: none; color: var(--grey, #9a9a9a); border: 0; padding: 2px 0; text-align: left; cursor: pointer; letter-spacing: .08em; }`;
  document.head.appendChild(css);

  function row(a, withQr) {
    const r = el('div', 'addr-row');
    const code = el('code', null, bare(a.url));
    const btns = el('div', 'addr-btns');
    const copy = el('button', 'mini', 'COPY'); copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(a.url); copy.textContent = 'COPIED'; }
      catch (e) { copy.textContent = 'HOLD TO COPY'; }
      setTimeout(() => { copy.textContent = 'COPY'; }, 2500);
    });
    const qrBtn = el('button', 'mini', 'QR'); qrBtn.type = 'button';
    const img = el('img'); img.alt = 'QR code for ' + bare(a.url); img.hidden = !withQr;
    if (withQr) img.src = '/api/qr.svg?text=' + encodeURIComponent(a.url);
    qrBtn.addEventListener('click', () => { img.hidden = !img.hidden; if (!img.src) img.src = '/api/qr.svg?text=' + encodeURIComponent(a.url); });
    btns.append(copy, qrBtn);
    r.append(el('small', null, a.label + (a.here ? ' · THIS PAGE' : '')), code, btns, img);
    return r;
  }

  /**
   * Draw into box: the first address with its QR, the rest behind OTHER ADDRESSES. opts: title (a heading line),
   * qr (false = the QR one tap away), skip (an address already shown, without http://), all (every row, no fold).
   */
  async function show(box, opts) {
    if (!box) return;
    opts = opts || {};
    let list = [];
    try { const r = await fetch('/api/addresses', { cache: 'no-store' }); if (r.ok) list = rows((await r.json()).addresses); } catch (e) { /* older box */ }
    if (opts.skip) list = list.filter(a => bare(a.url) !== opts.skip);
    if (!list.length) { box.hidden = true; return; }
    const wrap = el('div', 'addr-box');
    if (opts.title) wrap.append(el('small', null, opts.title));
    if (opts.all) { list.forEach(a => wrap.append(row(a, false))); box.replaceChildren(wrap); box.hidden = false; return; }
    wrap.append(row(list[0], opts.qr !== false));
    const rest = list.slice(1);
    if (rest.length) {
      const more = el('button', 'addr-more', 'OTHER ADDRESSES (' + rest.length + ') ▸'); more.type = 'button';
      const hid = el('div', 'addr-box'); hid.hidden = true;
      rest.forEach(a => hid.append(row(a, false)));
      more.addEventListener('click', () => { hid.hidden = !hid.hidden; more.textContent = (hid.hidden ? 'OTHER ADDRESSES (' + rest.length + ') ▸' : 'OTHER ADDRESSES ▾'); });
      wrap.append(more, hid);
    }
    box.replaceChildren(wrap);
    box.hidden = false;
  }

  // STATUS: under READY FOR TONIGHT. The share card (tap GHOST LINK): the other ways in, under the one it shows.
  const st = document.getElementById('openPhone');
  if (st) show(st, { title: 'OPEN ON A PHONE · scan it, or type it in Safari / Chrome' });
  const sb = document.getElementById('shareBtn'), so = document.getElementById('shareOther');
  if (sb && so) sb.addEventListener('click', () => setTimeout(() => {
    const shown = (document.getElementById('shareAddr') || {}).textContent || '';
    show(so, { title: 'OTHER WAYS IN', all: true, skip: shown });
  }));
  return { rows, bare, show };
})();
if (typeof module !== 'undefined') module.exports = Addr;
