/* ManiPay — home page extras (calculator, reviews, map). Loads after main.js. */
(function () {
  'use strict';

  /* ---------- Cash calculator ----------
     Charges = amount × rate%, You receive = amount − charges.
     The rate comes from data-rate on [data-calc] in index.html. */
  var calc = document.querySelector('[data-calc]');
  if (calc) {
    var input = calc.querySelector('#calc-amount');
    var outFee = calc.querySelector('[data-out="fee"]');
    var outGet = calc.querySelector('[data-out="get"]');
    var rate = parseFloat(calc.getAttribute('data-rate')) || 1.85;
    var MAX = 10000000; // ₹1 crore cap keeps the display sane

    var money = function (n) {
      var whole = Math.abs(n % 1) < 0.005;
      return '₹ ' + n.toLocaleString('en-IN', {
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: 2
      });
    };

    var update = function () {
      var digits = input.value.replace(/[^\d]/g, '').slice(0, 8);
      var amount = Math.min(Number(digits) || 0, MAX);
      // re-format what the person typed with Indian digit grouping
      var formatted = amount ? amount.toLocaleString('en-IN') : '';
      if (input.value !== formatted) {
        var fromEnd = input.value.length - (input.selectionEnd || 0);
        input.value = formatted;
        var pos = Math.max(0, formatted.length - fromEnd);
        try { input.setSelectionRange(pos, pos); } catch (e) {}
      }
      var fee = Math.round(amount * rate) / 100;
      outFee.textContent = money(fee);
      outGet.textContent = money(amount - fee);
    };

    input.addEventListener('input', update);
    update();
  }

  /* ---------- Google reviews: automatic carousel + live data from /api/reviews ----------
     3 cards on desktop, 2 on tablet, 1 on mobile (set by --gr-per in home.css).
     Moves to the next group every data-autoplay ms (10 s) and loops forever: after the
     last slide it keeps sliding forward onto copies of the first cards, then silently
     resets, so it never rewinds or jumps. Arrows, dots and swipe still work manually. */
  var gr = document.querySelector('[data-live-reviews]');
  if (gr) {
    var section = gr.closest('section') || document;
    var track = gr.querySelector('.gr-track');
    var prev = gr.querySelector('.gr-prev');
    var next = gr.querySelector('.gr-next');
    var dotsBox = section.querySelector('.gr-dots');
    var index = 0;          // current page (0 … pages-1)
    var busy = false;       // true while a slide animation is running
    var DELAY = parseInt(gr.getAttribute('data-autoplay'), 10) || 10000;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timer = null, hovering = false, focused = false;

    var realCards = function () { return track.querySelectorAll('.gr-card:not(.gr-clone)'); };
    var count = function () { return realCards().length; };
    var perView = function () {
      return parseInt(getComputedStyle(section).getPropertyValue('--gr-per'), 10) || 1;
    };
    var pages = function () { return Math.max(1, Math.ceil(count() / perView())); };
    // first card shown on page p (the last page lines up with the final card, no gaps)
    var firstCard = function (p) { return Math.max(0, Math.min(p * perView(), count() - perView())); };
    var step = function () {
      var card = track.children[0];
      if (!card) return 0;
      return card.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
    };
    var moveTo = function (cardPos, animate) {
      track.classList.toggle('animating', !!animate && !reduceMotion);
      track.style.transform = 'translate3d(' + (-cardPos * step()) + 'px,0,0)';
    };

    // copies of the first group, placed after the last card, for the seamless loop
    var buildClones = function () {
      track.querySelectorAll('.gr-clone').forEach(function (c) { c.remove(); });
      if (pages() < 2) return;
      var cards = realCards(), n = perView();
      for (var i = 0; i < n && i < cards.length; i++) {
        var c = cards[i].cloneNode(true);
        c.classList.add('gr-clone');
        c.setAttribute('aria-hidden', 'true');
        c.removeAttribute('role'); c.removeAttribute('aria-label'); c.removeAttribute('aria-roledescription');
        c.querySelectorAll('a,button').forEach(function (el) { el.setAttribute('tabindex', '-1'); });
        track.appendChild(c);
      }
    };
    var labelCards = function () {
      var cards = realCards(), n = cards.length;
      for (var i = 0; i < n; i++) {
        cards[i].setAttribute('role', 'group');
        cards[i].setAttribute('aria-roledescription', 'slide');
        cards[i].setAttribute('aria-label', (i + 1) + ' of ' + n);
      }
    };
    var buildDots = function () {
      var total = pages();
      dotsBox.innerHTML = '';
      gr.classList.toggle('single', total < 2);
      if (total < 2) return;
      for (var i = 0; i < total; i++) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'gr-dot';
        d.setAttribute('aria-label', 'Go to slide ' + (i + 1) + ' of ' + total);
        d.addEventListener('click', (function (k) { return function () { goTo(k); restart(); }; })(i));
        dotsBox.appendChild(d);
      }
    };
    var paintDots = function () {
      var dots = dotsBox.children;
      for (var i = 0; i < dots.length; i++) {
        if (i === index) dots[i].setAttribute('aria-current', 'true');
        else dots[i].removeAttribute('aria-current');
      }
    };
    // run fn once the slide animation finishes (with a safety timeout)
    var afterSlide = function (fn) {
      if (reduceMotion) { fn(); return; }
      var done = false;
      var finish = function () { if (done) return; done = true; track.removeEventListener('transitionend', onEnd); fn(); };
      var onEnd = function (e) { if (e.target === track) finish(); };
      track.addEventListener('transitionend', onEnd);
      setTimeout(finish, 900);
    };

    var goTo = function (i) {
      if (busy) return;
      var total = pages();
      if (total < 2) return;
      if (i >= total) {
        // past the last slide: slide forward onto the cloned first group, then reset
        busy = true; index = 0; paintDots();
        moveTo(count(), true);
        afterSlide(function () { moveTo(0, false); busy = false; });
        return;
      }
      if (i < 0) {
        // before the first slide: jump (invisibly) to the clones, then slide back to the last group
        busy = true; index = total - 1; paintDots();
        moveTo(count(), false);
        void track.offsetWidth; // flush so the jump isn't animated
        moveTo(firstCard(index), true);
        afterSlide(function () { busy = false; });
        return;
      }
      busy = true; index = i; paintDots();
      moveTo(firstCard(index), true);
      afterSlide(function () { busy = false; });
    };
    var layout = function () {
      busy = false;
      buildClones();
      var total = pages();
      if (dotsBox.children.length !== (total < 2 ? 0 : total)) buildDots();
      if (index > total - 1) index = total - 1;
      paintDots();
      moveTo(firstCard(index), false);
    };

    // autoplay: one slide every DELAY ms, timer restarts after any manual move
    var stop = function () { clearTimeout(timer); timer = null; };
    var start = function () {
      stop();
      if (reduceMotion || hovering || focused || document.hidden || pages() < 2) return;
      timer = setTimeout(function tick() {
        goTo(index + 1);
        timer = setTimeout(tick, DELAY);
      }, DELAY);
    };
    var restart = function () { start(); };
    gr.addEventListener('mouseenter', function () { hovering = true; stop(); });
    gr.addEventListener('mouseleave', function () { hovering = false; start(); });
    gr.addEventListener('focusin', function (e) { if (e.target.matches(':focus-visible')) { focused = true; stop(); } });
    gr.addEventListener('focusout', function (e) { if (!gr.contains(e.relatedTarget)) { focused = false; start(); } });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

    prev.addEventListener('click', function () { goTo(index - 1); restart(); });
    next.addEventListener('click', function () { goTo(index + 1); restart(); });
    gr.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
    });

    // touch / swipe
    var sx = null, sy = null;
    track.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; stop(); }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      sx = sy = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goTo(index + (dx < 0 ? 1 : -1));
      start();
    });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(layout, 120);
    });
    var resetCarousel = function () { index = 0; labelCards(); layout(); buildDots(); paintDots(); start(); };
    resetCarousel();

    var esc = function (t) {
      return String(t).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    var stars = function (n) {
      var r = Math.round(n), out = '';
      for (var i = 1; i <= 5; i++) out += i <= r ? '★' : '<span class="off">★</span>';
      return out;
    };
    var card = function (v) {
      var name = esc(v.name);
      var who = v.profile ? '<a href="' + esc(v.profile) + '" target="_blank" rel="noopener">' + name + '</a>' : name;
      var pic = v.photo
        ? '<img src="' + esc(v.photo) + '" alt="" width="52" height="52" loading="lazy" referrerpolicy="no-referrer">'
        : '<span class="initial" aria-hidden="true">' + esc(v.name.charAt(0).toUpperCase()) + '</span>';
      return '<article class="gr-card">' +
        '<svg class="g" role="img" aria-label="Google review"><use href="#i-google"/></svg>' +
        '<div class="gr-stars" aria-label="' + v.rating + ' out of 5 stars">' + stars(v.rating) + '</div>' +
        '<p class="gr-text">' + esc(v.text) + '</p>' +
        '<div class="gr-who">' + pic + '<div><div class="gr-name">' + who + '</div>' +
        (v.when ? '<span class="gr-when">' + esc(v.when) + '</span>' : '') + '</div></div>' +
        '<span class="gr-verified"><svg aria-hidden="true"><use href="#i-check-circle"/></svg>Verified Google review</span>' +
        '</article>';
    };
    var addReadMore = function () {
      Array.prototype.forEach.call(track.querySelectorAll('.gr-card:not(.gr-clone)'), function (c) {
        var p = c.querySelector('.gr-text');
        if (!p || c.querySelector('.gr-more') || p.scrollHeight <= p.clientHeight + 2) return;
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'gr-more'; b.textContent = 'Read more';
        b.addEventListener('click', function () {
          var open = c.classList.toggle('expanded');
          b.textContent = open ? 'Show less' : 'Read more';
        });
        p.insertAdjacentElement('afterend', b);
      });
      buildClones(); // keep the loop copies identical to the real cards
      moveTo(firstCard(index), false);
    };

    if (window.fetch) {
      fetch('/api/reviews', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
          if (data.rating) {
            var rating = Number(data.rating).toFixed(1);
            document.querySelectorAll('[data-g-rating]').forEach(function (el) { el.textContent = rating; });
            document.querySelectorAll('[data-g-total]').forEach(function (el) { el.textContent = data.total; });
            document.querySelectorAll('[data-g-count]').forEach(function (el) {
              el.textContent = '· ' + data.total + ' reviews'; el.hidden = false;
            });
            var hv = document.querySelector('.hv-google');
            if (hv) hv.setAttribute('aria-label', 'Rated ' + rating + ' from ' + data.total + ' Google reviews');
          }
          if (data.url) {
            document.querySelectorAll('[data-g-link]:not([data-reviews])').forEach(function (a) { a.href = data.url; });
          }
          if (data.reviews && data.reviews.length) {
            track.innerHTML = data.reviews.map(card).join('');
            resetCarousel();
            addReadMore();
          }
        })
        .catch(function () { addReadMore(); /* keep the built-in reviews */ });
    } else {
      addReadMore();
    }
  }
})();
