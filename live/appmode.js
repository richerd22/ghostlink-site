'use strict';
// ?app=hardstop (DECISIONS #133): the box's own pages inside the HARD STOP app's web view (WKWebView). The app has its
// own top bar, so the box's header, tabs and tour step aside, and fixed overlays keep clear of the notch / home bar
// (safe-area insets). Off unless the query is there; once seen it is remembered for this web view's session
// (sessionStorage), so links inside the page keep it. ?app=<anything else> turns it off again.
// It adds ?embed=1 to the address (history.replaceState, no reload): every existing embed rule then applies as-is.
// Loaded first in <head>; nothing else changes without it. No network, no storage beyond the one session flag.
const AppMode = (() => {
  const KEY = 'ghostlink-app';
  /** Pure: what to do for this query string and the stored flag. {on, store: 'hardstop'|null|undefined, search}. */
  function decide(search, stored) {
    const q = new URLSearchParams(search || '');
    let store;
    if (q.has('app')) store = q.get('app') === 'hardstop' ? 'hardstop' : null;
    const on = store !== undefined ? store === 'hardstop' : stored === 'hardstop';
    if (on) {
      if (!q.has('app')) q.set('app', 'hardstop');
      if (!q.has('embed')) q.set('embed', '1');
    }
    const s = q.toString();
    return { on, store, search: s ? '?' + s : '' };
  }
  const CSS = [
    'html.app-hs body > header, html.app-hs .tour, html.app-hs [data-tour], html.app-hs #tourDemo, html.app-hs .rec-pill { display: none !important; }',
    'html.app-hs .demo-bar { top: env(safe-area-inset-top); }',
    'html.app-hs .share { padding: calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); }',
    'html.app-hs .sb-view { padding: calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left)); }',
    'html.app-hs .off-screen { padding: calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); }',
    'html.app-hs .rq-panel { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }',
    'html.app-hs body[data-error]::after { padding-bottom: calc(6px + env(safe-area-inset-bottom)); }',
  ].join('\n');
  function apply(doc, win) {
    let stored = null;
    try { stored = win.sessionStorage.getItem(KEY); } catch (e) { /* private mode: the query alone */ }
    const d = decide(win.location.search, stored);
    try {
      if (d.store === 'hardstop') win.sessionStorage.setItem(KEY, 'hardstop');
      else if (d.store === null) win.sessionStorage.removeItem(KEY);
    } catch (e) { /* not remembered: fine */ }
    if (!d.on) return d;
    doc.documentElement.classList.add('app-hs');
    if (d.search !== win.location.search) {
      try { win.history.replaceState(win.history.state, '', win.location.pathname + d.search + win.location.hash); } catch (e) { /* keep going */ }
    }
    const st = doc.createElement('style');
    st.id = 'appModeCss';
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
    return d;
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') apply(document, window);
  return { decide, apply, KEY, CSS };
})();
if (typeof module !== 'undefined') module.exports = AppMode;
