/* ManiPay — Services page category filter (All / Payments / Loans / Gold Services / Transfers).
   Each card lists its categories in data-cat, e.g. data-cat="gold loans".
   Runs in the capture phase so it replaces main.js's filter on this page. */
(function () {
  'use strict';
  var bar = document.querySelector('[data-svc-filters]');
  var grid = document.querySelector('[data-services-grid]');
  if (!bar || !grid) return;
  var chips = bar.querySelectorAll('[data-filter]');
  var cards = grid.querySelectorAll('.service');
  var empty = document.createElement('p');
  empty.className = 'svc-empty';
  empty.hidden = true;
  empty.textContent = 'No services in this category yet.';
  grid.insertAdjacentElement('afterend', empty);

  var matches = function (card, cat) {
    return cat === 'all' || (' ' + (card.getAttribute('data-cat') || '') + ' ').indexOf(' ' + cat + ' ') !== -1;
  };

  var apply = function (cat, animate) {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === cat)); });
    var shown = 0;
    cards.forEach(function (card) {
      var show = matches(card, cat);
      card.classList.add('in');            // never leave a card stuck in its fade-in start state
      card.hidden = !show;
      card.classList.remove('svc-enter');
      if (show) {
        shown++;
        if (animate) { void card.offsetWidth; card.classList.add('svc-enter'); }
      }
    });
    empty.hidden = shown > 0;
  };

  bar.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-filter]');
    if (!chip || !bar.contains(chip)) return;
    e.stopPropagation();
    e.preventDefault();
    var cat = chip.getAttribute('data-filter');
    if (chip.getAttribute('aria-pressed') === 'true' && cat !== 'all') cat = 'all'; // tap again to reset
    apply(cat, true);
  }, true);

  // Arrow keys move between chips
  bar.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var list = Array.prototype.slice.call(chips);
    var i = list.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length].focus();
  });

  apply('all', false);
})();

/* "Enquire now" opens the Contact page form (service passed in the link).
   Handled first so older scripts can't turn it into a WhatsApp chat. */
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('[data-enquire-link]');
  if (a) e.stopPropagation();
}, true);
