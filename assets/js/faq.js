/* ManiPay — FAQ accordion used on the home page and the FAQs page.
   All questions start closed; one answer open at a time; click the open one again to close it. Runs in the capture phase
   so it replaces main.js's toggle for these lists. Links with data-faq-jump open their question. */
(function () {
  'use strict';
  document.querySelectorAll('[data-faq-single]').forEach(function (list) {
    var items = list.querySelectorAll('.faq-item');
    var setOpen = function (item, open) {
      item.classList.toggle('open', open);
      var q = item.querySelector('.faq-q');
      if (q) q.setAttribute('aria-expanded', String(open));
    };
    var openOnly = function (item) {
      items.forEach(function (it) { setOpen(it, it === item); });
    };
    list.addEventListener('click', function (e) {
      var q = e.target.closest('.faq-q');
      if (!q || !list.contains(q)) return;
      e.stopPropagation();
      e.preventDefault();
      var item = q.closest('.faq-item');
      if (item.classList.contains('open')) { setOpen(item, false); item.removeAttribute('data-user-opened'); }
      else { openOnly(item); item.setAttribute('data-user-opened', ''); }
    }, true);
    list._openOnly = openOnly;
    // start with everything closed (also undoes any "open first" behaviour from main.js)
    var closeAll = function () { items.forEach(function (it) { setOpen(it, false); }); };
    closeAll();
    window.addEventListener('load', function () {
      if (!list.querySelector('.faq-item.open[data-user-opened]')) closeAll();
    });
  });

  document.querySelectorAll('[data-faq-jump]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var q = document.querySelector(link.getAttribute('href'));
      if (!q) return;
      var item = q.closest('.faq-item'), list = q.closest('[data-faq-single]');
      e.preventDefault();
      if (list && list._openOnly) list._openOnly(item);
      item.classList.add('in'); // make sure a not-yet-revealed item is visible
      var top = item.getBoundingClientRect().top + window.scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 80) - 20;
      window.scrollTo({ top: top, behavior: 'smooth' });
      setTimeout(function () { q.focus({ preventScroll: true }); }, 400);
    });
  });
})();
