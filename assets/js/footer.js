/* ManiPay — shop address + footer service list for every page. Loads after main.js so it overrides
   main.js's shorter list. To change the footer services, edit this list only. */
(function () {
  'use strict';
  var SERVICES = [
    ['credit-card-swipe', 'Credit Card Swipe'],
    ['bill-payment', 'Credit Card Bill Payment'],
    ['money-transfer', 'Online Money Transfer'],
    ['debit-card-loan', 'Debit Card Loan'],
    ['bajaj-emi', 'Bajaj EMI Card Payment'],
    ['pos-swipe', 'POS Swipe Facility'],
    ['gold-loan', 'Gold Loan'],
    ['cash-for-gold', 'Cash for Gold']
  ];
  // Shop address everywhere it appears (overrides the older address inside main.js)
  var ADDRESS = 'No.29/18, Vijayalakshmipuram Main Rd, Rajiv Gandhi Nagar, West Banu Nagar, Ambattur, Chennai, Tamil Nadu 600053';
  document.querySelectorAll('[data-address]').forEach(function (el) { el.textContent = ADDRESS; });
  // Opening hours everywhere they're marked (overrides older hours inside main.js)
  document.querySelectorAll('[data-hours]').forEach(function (el) { el.textContent = 'Mon – Sat: 9:00 AM – 10:00 PM'; });

  // Footer phone numbers open a WhatsApp chat (overrides main.js turning them into tel: links)
  document.querySelectorAll('.footer [data-wa-chat]').forEach(function (a) {
    a.href = 'https://wa.me/' + a.getAttribute('data-wa-chat');
    a.target = '_blank';
    a.rel = 'noopener';
  });

  document.querySelectorAll('[data-footer-services]').forEach(function (ul) {
    ul.innerHTML = SERVICES.map(function (s) {
      return '<li><a href="services.html#' + s[0] + '">' + s[1] + '</a></li>';
    }).join('');
  });
})();
