'use strict';
// WHAT'S MIXCLOUD CHECK? (DECISIONS #159). One tap on the "?" next to the MIXCLOUD CHECK line opens a small sheet: what
// the line means (Mixcloud's rule for DJ shows: 4 tracks by one artist, 3 in a row; 3 from one release, 2 in a row),
// and how the other places a set goes handle music, in plain words, no promises. The words come from the box
// (GET /api/rec/platforms, StreamSafe.explain) so the numbers are the ones it checks. Text nodes only. Own file.
const Platforms = (() => {
  const WHY = "WHAT'S THIS?";
  let sheet = null, data = null;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const css = document.createElement('style');
  css.textContent = `
    .pf-why { font: inherit; font-size: 11px; letter-spacing: .08em; background: none; color: inherit; border: 1px solid currentColor;
      padding: 0 6px; min-height: 20px; margin: 0 0 0 2px; cursor: pointer; vertical-align: baseline; opacity: .85; }
    .pf-sheet { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.72); display: flex; align-items: flex-start; justify-content: center; overflow: auto; padding: 12px; }
    .pf-card { background: var(--bg, #000); color: var(--fg, #fff); border: 1px solid var(--line, #333); max-width: 560px; width: 100%; padding: 14px 16px; display: grid; gap: 10px; }
    .pf-card h3 { margin: 0; font-size: 14px; letter-spacing: .1em; }
    .pf-card p { margin: 0; font-size: 13px; line-height: 1.45; }
    .pf-card .pf-p { border-top: 1px solid var(--line, #333); padding-top: 8px; display: grid; gap: 4px; }
    .pf-card .pf-p b { font-size: 12px; letter-spacing: .1em; }
    .pf-card .pf-p small, .pf-card > small { color: var(--grey, #9a9a9a); font-size: 11px; }
    .pf-card .pf-tag { font-size: 10px; letter-spacing: .1em; border: 1px solid currentColor; padding: 0 4px; margin-left: 6px; }
    .pf-card button.pf-done { justify-self: start; }
    @media (max-height: 480px) { .pf-card { padding: 10px 12px; gap: 6px; } .pf-card p { font-size: 12px; } }`;
  document.head.appendChild(css);

  /** The small "WHAT'S THIS?" button for a line (its own click never reaches the line: the line's tap hides it tonight). */
  function button() {
    const b = el('button', 'pf-why', WHY);
    b.type = 'button';
    b.title = 'What MIXCLOUD CHECK means, and other places a set goes';
    b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); open(); });
    return b;
  }

  async function open() {
    if (!data) {
      try { data = await (await fetch('/api/rec/platforms')).json(); } catch (e) { data = null; }
    }
    if (sheet) sheet.remove();
    sheet = el('div', 'pf-sheet');
    sheet.setAttribute('role', 'dialog');
    const card = el('div', 'pf-card');
    sheet.appendChild(card);
    sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    if (!data) { card.append(el('h3', null, WHY), el('p', null, "Couldn't reach the box. Try again in a moment.")); }
    else {
      card.append(el('h3', null, data.title || "WHAT'S MIXCLOUD CHECK?"), el('p', null, data.what || ''));
      (data.platforms || []).forEach(p => {
        const box = el('div', 'pf-p');
        const h = el('b', null, p.name);
        if (p.checked) h.appendChild(el('span', 'pf-tag', 'CHECKED HERE'));
        box.append(h, el('p', null, p.rule));
        if (p.how) box.appendChild(el('p', null, p.how));
        if (p.source) box.appendChild(el('small', null, 'From: ' + p.source + (data.checked ? ' (checked ' + data.checked + ')' : '')));
        card.appendChild(box);
      });
    }
    const done = el('button', 'pf-done', 'DONE'); done.type = 'button';
    done.addEventListener('click', close);
    card.appendChild(done);
    document.body.appendChild(sheet);
    done.focus({ preventScroll: true }); sheet.scrollTop = 0;
  }
  function close() { if (sheet) { sheet.remove(); sheet = null; } }
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  return { WHY, button, open, close };
})();
