'use strict';
// GHOST MODE (DECISIONS #146): a secret look, on GHOST WRAPPED and BOO'S ARCADE only (never the DJ's screens): the
// page turns into BOO's sheet, white with black ink, zigzag hems. Found by tapping a ghost three times quickly (the
// cover or last card's on WRAPPED; the score card's in the arcade, whose header BOO keeps its own BOOP secret), or by
// typing B O O on a keyboard; the same again turns it off. Remembered on this phone (localStorage ghostMode). Each
// page styles :root.ghost-mode itself. A page that draws on canvases with colours read at start (the arcade) sets
// data-ghostmode-reload on <html> and reloads. Loaded in <head> so the page never flashes the other look.
(() => {
  const root = document.documentElement;
  const KEY = 'ghostMode';
  const get = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  if (get()) root.classList.add('ghost-mode');
  function flip() {
    const on = !root.classList.contains('ghost-mode');
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (root.hasAttribute('data-ghostmode-reload')) { try { sessionStorage.setItem('ghostModeSay', '1'); } catch (e) {} location.reload(); return; }
    root.classList.toggle('ghost-mode', on);
    say(on ? 'GHOST MODE' : 'GHOST MODE OFF');
  }
  function say(t) {
    let n = document.getElementById('ghostModeSay');
    if (!n) {
      n = document.createElement('div'); n.id = 'ghostModeSay'; n.setAttribute('role', 'status');
      n.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:50;font:600 12px "JetBrains Mono",monospace;letter-spacing:.14em;padding:6px 12px;border:1px solid currentColor;background:var(--bg,#000);color:var(--fg,#fff);pointer-events:none';
      document.body.appendChild(n);
    }
    n.textContent = t; n.hidden = false;
    clearTimeout(say.t); say.t = setTimeout(() => { n.hidden = true; }, 2000);
  }
  let taps = [];
  document.addEventListener('click', e => {
    const g = e.target && e.target.closest && e.target.closest('[data-ghostmode], #overGhost');
    if (!g) return;
    const now = Date.now();
    taps = taps.filter(t => now - t < 1500).concat(now);
    if (taps.length >= 3) { taps = []; flip(); }
  });
  let typed = '';
  document.addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    typed = (typed + (e.key || '').toLowerCase()).slice(-3);
    if (typed === 'boo') { typed = ''; flip(); }
  });
  // after a reload into the new look, say it once
  try { if (sessionStorage.getItem('ghostModeSay')) { sessionStorage.removeItem('ghostModeSay'); addEventListener('DOMContentLoaded', () => say(get() ? 'GHOST MODE' : 'GHOST MODE OFF')); } } catch (e) {}
})();
