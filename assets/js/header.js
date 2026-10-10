/* ManiPay — header "Call Us Now!" dropdown, used on every page. Loads after main.js. */
(function () {
  'use strict';
  document.querySelectorAll('[data-call-menu]').forEach(function (menu) {
    var toggle = menu.querySelector('.call-toggle');
    var list = menu.querySelector('.call-list');
    if (!toggle || !list) return;
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      list.hidden = !open;
    };
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(list.hidden);
      if (!list.hidden) { var first = list.querySelector('a'); if (first) first.focus(); }
    });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !list.hidden) { setOpen(false); toggle.focus(); }
    });
  });
})();

/* WhatsApp buttons ([data-wa]) open a chat with +91 81225 44657.
   Anything marked data-wa-chat="91XXXXXXXXXX" opens that number instead —
   e.g. the floating green WhatsApp icon uses +91 93636 22627.
   Runs after main.js and handles the click first, so nothing else can redirect it. */
(function () {
  'use strict';
  var WA = '918122544657';
  var urlFor = function (a) { return 'https://wa.me/' + (a.getAttribute('data-wa-chat') || WA); };
  var fix = function () {
    document.querySelectorAll('[data-wa], [data-wa-chat], a[data-social="whatsapp"]').forEach(function (a) {
      a.href = urlFor(a);
      a.target = '_blank';
      a.rel = 'noopener';
    });
  };
  fix();
  window.addEventListener('load', fix);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-wa], [data-wa-chat], a[data-social="whatsapp"]');
    if (!a) return;
    a.href = urlFor(a);
    e.stopPropagation(); // let the browser open the link; don't let other scripts change it
  }, true);
})();

/* Footer social links — Facebook & Instagram on every page.
   Re-applied after main.js so nothing can swap them back to "#". */
(function () {
  'use strict';
  var LINKS = {
    facebook: 'https://www.facebook.com/profile.php?id=61595397624188',
    instagram: 'https://www.instagram.com/manipaydigital626/'
  };
  var fix = function () {
    Object.keys(LINKS).forEach(function (k) {
      document.querySelectorAll('a[data-social="' + k + '"]').forEach(function (a) {
        a.href = LINKS[k]; a.target = '_blank'; a.rel = 'noopener';
      });
    });
  };
  fix();
  window.addEventListener('load', fix);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-social="facebook"], a[data-social="instagram"]');
    if (!a) return;
    a.href = LINKS[a.getAttribute('data-social')];
    e.stopPropagation();
  }, true);
})();
