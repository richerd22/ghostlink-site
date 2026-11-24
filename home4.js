// GHOST LINK home (#143): SEE IT LIVE's EXPAND. The demo window grows to fill the browser in place: the Fullscreen API
// where there is one (laptops, Android), else a fixed layer over the page (iPhone). CLOSE, Esc (also from inside the
// demo: live/ passes it up) or the browser's own back-out end it. On a phone, tapping the window expands it instead of
// leaving the page. With no JavaScript the window is a plain link to live/ (OPEN IT FULL PAGE).
(function () {
  'use strict';
  var win = document.getElementById('demoWin');
  if (!win) return;
  var open = document.getElementById('demoExpand'), close = document.getElementById('demoClose'), full = document.getElementById('demoOpen');
  var tap = win.querySelector('.tap'), frame = win.querySelector('iframe'), root = document.documentElement;
  var big = false, viaFs = false, back = null;
  open.hidden = false;

  function expand() {
    if (big) return;
    big = true; back = document.activeElement;
    win.classList.add('big'); root.classList.add('demo-open');
    open.hidden = true; full.hidden = true; close.hidden = false;
    if (frame.getAttribute('loading') === 'lazy') frame.removeAttribute('loading');
    viaFs = false;
    if (win.requestFullscreen && document.fullscreenEnabled) {
      win.requestFullscreen().then(function () { viaFs = true; }).catch(function () {});
    }
    close.focus();
  }
  function shrink() {
    if (!big) return;
    big = false;
    win.classList.remove('big'); root.classList.remove('demo-open');
    open.hidden = false; full.hidden = false; close.hidden = true;
    if (document.fullscreenElement === win) document.exitFullscreen().catch(function () {});
    viaFs = false;
    if (back && back.focus) try { back.focus({ preventScroll: true }); } catch (e) {}
    win.scrollIntoView({ block: 'nearest' });
  }
  open.addEventListener('click', expand);
  close.addEventListener('click', shrink);
  if (tap) tap.addEventListener('click', function (e) { e.preventDefault(); expand(); });
  // The browser's Esc leaves the Fullscreen API by itself: follow it.
  document.addEventListener('fullscreenchange', function () { if (big && viaFs && !document.fullscreenElement) shrink(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && big) shrink(); });
  window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.gl === 'esc' && big) shrink();
  });
})();
