// GHOST LINK site: the waitlist form. (SEE IT LIVE is the real dashboard in live/, built by bin/site.)
(function () {
  'use strict';

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ---------- waitlist ----------
  var form = document.getElementById('wl-form');
  if (form) {
    var msg = document.getElementById('wl-msg'), note = form.elements.note, count = document.getElementById('wl-count');
    note.addEventListener('input', function () { count.textContent = note.value.length + ' / 500'; });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var f = form.elements;
      if (f._honey.value) return; // a bot filled the hidden field
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'SENDING...';
      msg.className = 'form-msg'; msg.textContent = '';
      var body = {
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        role: f.role.value,
        city: f.city.value.trim(),
        shows_per_month: f.shows.value,
        message: f.note.value.trim(),
        news: f.news.checked ? 'yes' : 'no',
        _subject: 'GHOST LINK waitlist',
        _template: 'table',
        _honey: ''
      };
      fetch('https://formsubmit.co/ajax/hello@thirdpolararch.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || j.success === false || j.success === 'false') throw new Error('not ok');
        });
      }).then(function () {
        var done = el('div', 'done');
        done.setAttribute('tabindex', '-1');
        done.appendChild(el('h3', '', "YOU'RE ON THE LIST."));
        done.appendChild(el('p', '', "We'll be in touch. - Third Polar Arch"));
        form.replaceWith(done); done.focus();
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'JOIN THE WAITLIST';
        msg.className = 'form-msg warn';
        msg.innerHTML = 'That didn\'t go through. Try again in a minute, or email us at ' +
          '<a href="mailto:hello@thirdpolararch.com?subject=GHOST%20LINK%20waitlist">hello@thirdpolararch.com</a>.';
      });
    });
  }
})();
