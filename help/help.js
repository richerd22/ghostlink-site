// GHOST LINK help center: search over every help page (read in the browser, no outside services) and COPY buttons.
// Add a line to PAGES when you add a page: [path from help/, title, group].
(function () {
  'use strict';

  var PAGES = [
    ["../start-here/index.html", "GETTING STARTED", "START"],
    ["../manual/index.html", "OWNER'S MANUAL", "MANUAL"],
    ["quick-start.html", "QUICK START", "START"],
    ["guide.html", "USER'S GUIDE", "GUIDE"],
    ["new-unit.html", "NEW UNIT", "START"],
    ["how-to/venue-wifi.html", "ADD A VENUE'S WI-FI", "HOW TO"],
    ["how-to/wifi-mode.html", "PICK THE WI-FI MODE", "HOW TO"],
    ["how-to/plan-a-night.html", "PLAN A NIGHT", "HOW TO"],
    ["how-to/name-a-set.html", "NAME A SET OR SAY WHOSE USB", "HOW TO"],
    ["how-to/share-the-tracklist.html", "SHARE THE TRACKLIST", "HOW TO"],
    ["how-to/get-the-tracklist.html", "GET THE TRACKLIST OR PLAYLIST", "HOW TO"],
    ["how-to/black-box.html", "DOWNLOAD THE BLACK BOX", "HOW TO"],
    ["how-to/crew-code.html", "GIVE THE CREW CODE", "HOW TO"],
    ["how-to/restart-reading.html", "RESTART READING A DECK", "HOW TO"],
    ["how-to/turn-it-off.html", "TURN IT OFF", "HOW TO"],
    ["how-to/share-the-dashboard.html", "SHARE THE DASHBOARD", "HOW TO"],
    ["how-to/watch-from-home.html", "WATCH FROM HOME", "HOW TO"],
    ["how-to/listen-only.html", "MAKE IT GO QUIET", "HOW TO"],
    ["how-to/record-a-set.html", "RECORD A SET", "HOW TO"],
    ["how-to/lights-and-visuals.html", "HOOK UP LIGHTS AND VISUALS", "HOW TO"],
    ["how-to/stop-at-curfew.html", "STOP THE MUSIC AT CURFEW", "HOW TO"],
    ["how-to/music-at-this-venue.html", "SET A VENUE'S MUSIC NOTES", "HOW TO"],
    ["how-to/all-nights.html", "LOOK BACK AT EVERY NIGHT", "HOW TO"],
    ["how-to/arcade.html", "PLAY BOO'S ARCADE", "HOW TO"],
    ["gear.html", "GEAR TO BUY", "START"],
    ["roles/dj.html", "FOR THE DJ", "BY ROLE"],
    ["roles/photo.html", "FOR PHOTO AND VIDEO", "BY ROLE"],
    ["roles/vj.html", "FOR VISUALS", "BY ROLE"],
    ["roles/lights.html", "FOR LIGHTS", "BY ROLE"],
    ["roles/tech.html", "FOR THE TECH", "BY ROLE"],
    ["roles/manager.html", "FOR THE MANAGER", "BY ROLE"],
    ["how-to/index.html", "HOW TO", "HOW TO"],
    ["faq.html", "FAQ", "FAQ"],
    ["known-issues.html", "KNOWN ISSUES", "ISSUES"],
    ["hard-stop.html", "USING IT WITH HARD STOP", "HARD STOP"],
    ["advance/for-djs.html", "FOR DJS", "ADVANCE KIT"],
    ["advance/for-photo.html", "FOR PHOTO AND VIDEO", "ADVANCE KIT"],
    ["advance/for-crew.html", "FOR LIGHTS, VISUALS AND SOUND", "ADVANCE KIT"],
    ["advance/for-bar.html", "FOR BAR AND SECURITY", "ADVANCE KIT"],
    ["advance/for-venues.html", "FOR VENUES", "ADVANCE KIT"],
    ["advance/for-first-time.html", "FIRST TIME SEEING THIS BOX?", "ADVANCE KIT"],
    ["advance/index.html", "ADVANCE KIT", "ADVANCE KIT"],
    ["advance/venue-to-headliner.html", "VENUE → HEADLINER", "ADVANCE KIT"],
    ["advance/venue-to-opener.html", "VENUE → OPENER", "ADVANCE KIT"],
    ["advance/venue-to-local-dj.html", "VENUE → LOCAL DJ", "ADVANCE KIT"],
    ["advance/venue-to-photographer.html", "VENUE → PHOTOGRAPHER", "ADVANCE KIT"],
    ["advance/venue-to-crew.html", "VENUE → LD / VJ / FOH", "ADVANCE KIT"],
    ["advance/venue-to-bar-security.html", "VENUE → BAR / SECURITY", "ADVANCE KIT"],
    ["advance/tour-to-venue.html", "TOUR → VENUE", "ADVANCE KIT"],
    ["advance/tour-to-opener.html", "TOUR → OPENER", "ADVANCE KIT"],
    ["advance/tour-to-local-crew.html", "TOUR → LOCAL CREW", "ADVANCE KIT"],
    ["advance/dj-to-venue.html", "DJ → VENUE", "ADVANCE KIT"],
    ["advance/anyone-to-first-time.html", "ANYONE → FIRST TIME SEEING THIS BOX", "ADVANCE KIT"]
  ];

  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? me.replace(/help\.js(\?.*)?$/, '') : '';

  // ---------- COPY buttons ----------
  function copyText(text, btn) {
    function done() { var t = btn.textContent; btn.textContent = 'COPIED'; setTimeout(function () { btn.textContent = t; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', '');
      t.style.position = 'absolute'; t.style.left = '-9999px';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      t.remove();
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (b) {
    b.addEventListener('click', function () {
      var el = document.getElementById(b.getAttribute('data-copy'));
      if (el) copyText(el.textContent, b);
    });
  });

  // ---------- search ----------
  var q = document.getElementById('q');
  if (!q) return;
  var out = document.getElementById('results'), msg = document.getElementById('qmsg');
  var docs = null, loading = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function norm(s) { return s.toLowerCase().replace(/[-\u2010\u2011]/g, ''); } // "wifi" finds Wi-Fi

  // Read each page once and split it into its sections (one per h2), so a result jumps to the right place.
  function load() {
    if (loading) return loading;
    loading = Promise.all(PAGES.map(function (p) {
      return fetch(ROOT + p[0]).then(function (r) { return r.ok ? r.text() : ''; }).then(function (text) {
        var d = new DOMParser().parseFromString(text, 'text/html');
        var art = d.querySelector('article');
        var list = [];
        if (!art) return list;
        var cur = { url: p[0], title: p[1], head: '', text: '' };
        list.push(cur);
        Array.prototype.forEach.call(art.children, function (el) {
          if (el.tagName === 'H1') return;
          if (el.tagName === 'H2') {
            cur = { url: p[0] + (el.id ? '#' + el.id : ''), title: p[1], head: clean(el.textContent), text: '' };
            list.push(cur);
          } else if (el.tagName === 'SECTION' && el.id && el.querySelector('h2')) { // the manual: one section per chapter
            var h = el.querySelector('h2');
            cur = { url: p[0] + '#' + el.id, title: p[1], head: clean(h.textContent).replace(/^\d+\s*/, ''), text: clean(el.textContent.replace(h.textContent, '')) };
            list.push(cur);
          } else cur.text += ' ' + clean(el.textContent);
        });
        return list;
      }).catch(function () { return []; });
    })).then(function (all) {
      docs = [].concat.apply([], all);
      if (!docs.length) msg.textContent = 'Search works on the website. The sections are listed below.';
      return docs;
    });
    return loading;
  }

  function search(text) {
    var terms = norm(text).split(/\s+/).filter(function (t) { return t.length > 1; });
    if (!terms.length) { out.innerHTML = ''; msg.textContent = ''; return; }
    var hits = [];
    docs.forEach(function (d) {
      var title = norm(d.title + ' ' + d.head), body = norm(d.text), score = 0;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i], inT = title.indexOf(t) >= 0, n = body.split(t).length - 1;
        if (!inT && !n) return;
        score += (inT ? 6 : 0) + Math.min(n, 5);
      }
      if (!d.head && !d.text.trim()) return;
      hits.push({ d: d, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    hits = hits.slice(0, 12);
    msg.textContent = hits.length ? '' : 'Nothing for "' + text + '". Try one word, like wi-fi or played.';
    out.innerHTML = hits.map(function (h) {
      var d = h.d, body = d.text, at = -1;
      var pats = terms.map(function (t) { return t.split('').map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('-?'); });
      pats.some(function (p) { var m = new RegExp(p, 'i').exec(body); at = m ? m.index : -1; return at >= 0; });
      var start = Math.max(0, at - 50), snip = (start ? '...' : '') + body.slice(start, start + 150) + (body.length > start + 150 ? '...' : '');
      var safe = esc(snip);
      pats.forEach(function (p) { safe = safe.replace(new RegExp('(' + p + ')', 'ig'), '<mark>$1</mark>'); });
      return '<li><a href="' + esc(d.url) + '"><b>' + esc(d.title + (d.head ? ' · ' + d.head : '')) + '</b><span>' + safe + '</span></a></li>';
    }).join('');
  }

  var timer = null;
  function run() {
    var v = q.value.trim();
    if (!v) { out.innerHTML = ''; msg.textContent = ''; return; }
    if (docs) return search(v);
    msg.textContent = 'Reading the help pages...';
    load().then(function () { if (docs.length) { msg.textContent = ''; search(q.value.trim()); } });
  }
  q.addEventListener('focus', load, { once: true });
  q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 120); });
  var pre = new URLSearchParams(location.search).get('q');
  if (pre) { q.value = pre; run(); }
})();
