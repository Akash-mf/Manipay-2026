/* ManiPay — contact sections (home + Contact page): phone numbers and the WhatsApp button open a
   WhatsApp chat, and the Google Map shows the shop with a live open/closed badge.
   Runs after main.js, so main.js can't turn these links back into phone calls. */
(function () {
  'use strict';
  document.querySelectorAll('[data-wa-chat]').forEach(function (a) {
    var num = a.getAttribute('data-wa-chat');
    a.href = 'https://wa.me/' + num;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  /* ---------- Google Map, directions and open/closed badge (home + Contact page) ----------
     Runs after main.js, so these override its generic defaults. */
  var MAP_EMBED = 'https://maps.google.com/maps?q=13.125212,80.153243%20(ManiPay%20Credit%20Card%20Services)&z=17&output=embed';
  // Google uses the visitor's current location as the starting point automatically
  var DIRECTIONS = 'https://www.google.com/maps/dir/?api=1&destination=13.125212,80.153243';
  var mapFrame = document.getElementById('mapFrame');
  if (mapFrame && mapFrame.getAttribute('src') !== MAP_EMBED) mapFrame.src = MAP_EMBED;
  document.querySelectorAll('[data-directions]').forEach(function (a) { a.href = DIRECTIONS; });

  // Open / closed badge in Chennai time (Mon–Sat 9 AM – 10 PM)
  var live = document.querySelector('.map-live');
  if (live) {
    var now = new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000); // IST
    var day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    var open = day >= 1 && day <= 6 && mins >= 540 && mins < 1320;
    var text;
    if (open) text = 'Open now · closes 10 PM';
    else if (day >= 1 && day <= 6 && mins < 540) text = 'Closed · opens 9 AM today';
    else if (day === 6 || day === 0) text = 'Closed · opens 9 AM Monday';
    else text = 'Closed · opens 9 AM tomorrow';
    live.lastChild.textContent = text;
    live.classList.toggle('closed', !open);
  }

  /* ---------- "Service" dropdown in the enquiry form: the 13 services on the Services page ---------- */
  var SERVICES = ['Credit Card Swipe / Spot Payment', 'Credit Card Bill Payment / Outstanding Clearing',
    'Online Money Transfer', 'Debit Card Loan', 'Bajaj EMI Card Spot Payment', 'POS Swipe Payment', 'Jewel Loan',
    'Gold Pledge', 'Gold Loan Takeover', 'Loan Takeover from Banks & Pawn Brokers', 'Jewel Sale & Refinancing',
    'Cash for Gold', 'Online Payment Facility'];
  document.querySelectorAll('select[data-service-select]').forEach(function (sel) {
    var keep = sel.value;
    sel.innerHTML = '';
    sel.appendChild(new Option('Select a service', ''));
    SERVICES.forEach(function (s) { sel.appendChild(new Option(s, s)); });
    if (SERVICES.indexOf(keep) !== -1) sel.value = keep;
  });

  /* ---------- Coming from "Enquire now" on the Services page (Contact.html?service=...) ---------- */
  var params = new URLSearchParams(location.search);
  var picked = params.get('service');
  var form = document.getElementById('enquiryForm');
  if (picked && form) {
    var sel = form.querySelector('select[data-service-select]');
    var opt = SERVICES.indexOf(picked) !== -1 ? picked : '';
    if (sel && opt) { sel.value = opt; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    var msg = form.querySelector('#f-msg');
    if (msg && !msg.value) msg.value = 'Hi, I would like to know more about ' + picked + '.';
    setTimeout(function () {
      var name = form.querySelector('#f-name');
      if (name) name.focus({ preventScroll: true });
    }, 300);
  }
})();

/* ---------- Enquiry form → /api/enquiries → WhatsApp notification to ManiPay ----------
   Handles the submit itself (capture phase), so main.js doesn't also send the form. */
(function () {
  'use strict';
  var ENDPOINT = '/api/enquiries';
  var FALLBACK_WA = '918122544657';

  var digits = function (v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return d;
  };
  var RULES = {
    name: function (f) { return f.name.value.trim().length >= 2; },
    phone: function (f) { return /^[6-9]\d{9}$/.test(digits(f.phone.value)); },
    email: function (f) { var v = f.email.value.trim(); return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
    service: function (f) { return !!f.service.value; },
    message: function (f) { return f.message.value.trim().length >= 10; },
    consent: function (f) { return f.consent.checked; }
  };
  var fieldOf = function (el) { return el && el.closest('.field'); };

  function check(form, name) {
    var el = form.elements[name];
    if (!el) return true;
    var ok = RULES[name](form.elements);
    var box = fieldOf(el);
    if (box) box.classList.toggle('invalid', !ok);
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  }

  function status(form, kind, html) {
    var box = form.querySelector('.form-status');
    if (!box) return;
    box.className = 'form-status ' + kind;
    box.innerHTML = html;
  }

  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.id !== 'enquiryForm') return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (form.dataset.sending) return;

    var bad = Object.keys(RULES).filter(function (n) { return !check(form, n); });
    if (bad.length) {
      status(form, '', '');
      var first = form.elements[bad[0]];
      if (first) first.focus();
      return;
    }

    var f = form.elements;
    var data = {
      name: f.name.value.trim(),
      phone: digits(f.phone.value),
      email: f.email.value.trim(),
      service: f.service.value,
      message: f.message.value.trim(),
      consent: f.consent.checked,
      website: f.website ? f.website.value : ''
    };

    var btn = form.querySelector('button[type="submit"]');
    var label = btn ? btn.innerHTML : '';
    form.dataset.sending = '1';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }
    status(form, '', '');

    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, body: j }; }); })
      .then(function (r) {
        if (r.ok) {
          var first = data.name.split(' ')[0];
          form.reset();
          form.querySelectorAll('.field.invalid').forEach(function (x) { x.classList.remove('invalid'); });
          status(form, 'ok', '<svg><use href="#i-check-circle"/></svg><span>Thank you, ' + esc(first) +
            '! Your enquiry has reached our team — we\'ll call or WhatsApp you shortly.</span>');
        } else if (r.body && r.body.fields) {
          r.body.fields.forEach(function (n) { var el = form.elements[n]; if (fieldOf(el)) fieldOf(el).classList.add('invalid'); });
        } else { throw new Error('send failed'); }
      })
      .catch(function () {
        var text = encodeURIComponent('Hi ManiPay, I would like to enquire about ' + data.service + '.\n\n' + data.message + '\n\n— ' + data.name);
        status(form, 'fail', '<svg><use href="#i-wa"/></svg><span>Sorry, we couldn\'t send your message just now. ' +
          '<a href="https://wa.me/' + FALLBACK_WA + '?text=' + text + '" target="_blank" rel="noopener"><strong>Send it on WhatsApp instead</strong></a> or call +91 81225 44657.</span>');
      })
      .then(function () {
        delete form.dataset.sending;
        if (btn) { btn.disabled = false; btn.innerHTML = label; }
      });
  }, true);

  // Clear a field's error as soon as it's fixed
  ['input', 'change'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var el = e.target, form = el && el.form;
      if (!form || form.id !== 'enquiryForm' || !RULES[el.name]) return;
      if (fieldOf(el) && fieldOf(el).classList.contains('invalid')) check(form, el.name);
    });
  });
})();
