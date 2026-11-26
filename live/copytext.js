'use strict';
// COPY over plain http (DECISIONS #162). The box is always http (http://192.168.1.202/, http://10.42.0.1/,
// http://ghostlink.local/), and browsers only give navigator.clipboard to https and localhost: on a phone every COPY
// button that called navigator.clipboard.writeText threw, and some had no fallback (Safari on the box's IP said
// nothing at all). This fills navigator.clipboard.writeText in with the old way (a hidden text box + copy), which
// works on a tap over http. Loaded first; a page on https / localhost keeps the real one. No network, no storage.
(() => {
  function oldCopy(text) {
    const t = document.createElement('textarea');
    t.value = String(text == null ? '' : text);
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px'; // 16px: iOS doesn't zoom
    document.body.appendChild(t);
    t.select();
    try { t.setSelectionRange(0, t.value.length); } catch (e) { /* some inputs */ }
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    t.remove();
    return ok;
  }
  window.glCopy = oldCopy;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: text => oldCopy(text) ? Promise.resolve() : Promise.reject(new Error('copy refused')),
    } });
  } catch (e) { /* read-only navigator: the pages' own fallbacks still run */ }
})();
