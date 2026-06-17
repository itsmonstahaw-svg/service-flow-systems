// Nav scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// Mobile nav toggle
document.getElementById('navToggle').addEventListener('click', () => {
  document.getElementById('navMobile').classList.toggle('open');
});

// Close mobile nav on link click
document.querySelectorAll('.nav-mobile a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('navMobile').classList.remove('open');
  });
});

// Scroll animations
const animateEls = document.querySelectorAll('[data-animate]');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

animateEls.forEach(el => observer.observe(el));

// Service card staggered animation
const serviceCards = document.querySelectorAll('.service-card');
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const delay = parseInt(entry.target.dataset.delay || 0);
      setTimeout(() => {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, delay);
      cardObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

serviceCards.forEach(card => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(24px)';
  card.style.transition = 'opacity 0.6s ease, transform 0.6s ease, border-color 0.3s, box-shadow 0.3s';
  cardObserver.observe(card);
});

// Trades carousel — infinite loop
(function() {
  const track = document.getElementById('tradesTrack');
  if (!track) return;
  const prevBtn = document.getElementById('tradesPrev');
  const nextBtn = document.getElementById('tradesNext');

  // Clone all cards and append for seamless loop
  const origCards = Array.from(track.querySelectorAll('.trade-card'));
  origCards.forEach(card => track.appendChild(card.cloneNode(true)));
  const total = track.querySelectorAll('.trade-card').length; // originals + clones
  const origCount = origCards.length;

  let current = 0;
  let animating = false;

  function getVisible() {
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 960) return 2;
    return 3;
  }

  function cardWidth() {
    const gap = 16;
    const visible = getVisible();
    return (track.parentElement.offsetWidth - gap * (visible - 1)) / visible + gap;
  }

  function moveTo(index, animate) {
    track.style.transition = animate ? 'transform 0.4s ease' : 'none';
    track.style.transform = `translateX(${-index * cardWidth()}px)`;
  }

  nextBtn.addEventListener('click', () => {
    if (animating) return;
    animating = true;
    current++;
    moveTo(current, true);

    // If we've reached the cloned section, silently jump back
    if (current >= origCount) {
      setTimeout(() => {
        current = current - origCount;
        moveTo(current, false);
        animating = false;
      }, 410);
    } else {
      setTimeout(() => animating = false, 410);
    }
  });

  prevBtn.addEventListener('click', () => {
    if (animating) return;
    animating = true;

    // If at start, jump to equivalent position in clone zone first
    if (current <= 0) {
      current = origCount;
      moveTo(current, false);
      setTimeout(() => {
        current--;
        moveTo(current, true);
        setTimeout(() => animating = false, 410);
      }, 20);
    } else {
      current--;
      moveTo(current, true);
      setTimeout(() => animating = false, 410);
    }
  });

  window.addEventListener('resize', () => moveTo(current, false));
  moveTo(0, false);
  prevBtn.style.opacity = '1';
  nextBtn.style.opacity = '1';
})();

// FAQ accordion
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    // Close all
    document.querySelectorAll('.faq-q').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      b.nextElementSibling.classList.remove('open');
    });
    // Open clicked if it was closed
    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      btn.nextElementSibling.classList.add('open');
    }
  });
});

// Legit banner — auto-scroll + drag
(function () {
  const wrap = document.querySelector('.legit-track-wrap');
  const track = document.getElementById('legitTrack');
  if (!wrap || !track) return;

  // Clone logos for seamless infinite loop
  Array.from(track.querySelectorAll('.legit-logo')).forEach(el =>
    track.appendChild(el.cloneNode(true))
  );

  let scrollX = 0;
  const speed = 0.7;
  let dragging = false, startX = 0, startScroll = 0;

  function loop() {
    if (!dragging) {
      scrollX += speed;
      const half = track.scrollWidth / 2;
      if (scrollX >= half) scrollX -= half;
      wrap.scrollLeft = scrollX;
    }
    requestAnimationFrame(loop);
  }

  // Mouse drag
  wrap.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.pageX;
    startScroll = wrap.scrollLeft;
    wrap.classList.add('dragging');
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    scrollX = wrap.scrollLeft;
    wrap.classList.remove('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    wrap.scrollLeft = startScroll - (e.pageX - startX);
    scrollX = wrap.scrollLeft;
  });

  // Touch drag
  wrap.addEventListener('touchstart', e => {
    startX = e.touches[0].pageX;
    startScroll = wrap.scrollLeft;
    dragging = true;
  }, { passive: true });
  wrap.addEventListener('touchend', () => { dragging = false; scrollX = wrap.scrollLeft; });
  wrap.addEventListener('touchmove', e => {
    wrap.scrollLeft = startScroll - (e.touches[0].pageX - startX);
    scrollX = wrap.scrollLeft;
  }, { passive: true });

  requestAnimationFrame(loop);
})();


// Testimonials carousel
(function () {
  const track = document.getElementById('testiTrack');
  const prevBtn = document.getElementById('testiPrev');
  const nextBtn = document.getElementById('testiNext');
  if (!track) return;

  const cards = Array.from(track.querySelectorAll('.testi-card'));
  let current = 0;
  let animating = false;

  function visible() { return window.innerWidth < 900 ? 1 : 2; }
  function max() { return cards.length - visible(); }
  function cardW() {
    const gap = 24;
    return (track.parentElement.offsetWidth - gap * (visible() - 1)) / visible() + gap;
  }
  function moveTo(idx, animate) {
    track.style.transition = animate ? 'transform 0.4s ease' : 'none';
    track.style.transform = `translateX(${-idx * cardW()}px)`;
  }

  nextBtn.addEventListener('click', () => {
    if (animating) return;
    animating = true;
    current = current >= max() ? 0 : current + 1;
    moveTo(current, true);
    setTimeout(() => animating = false, 420);
  });

  prevBtn.addEventListener('click', () => {
    if (animating) return;
    animating = true;
    current = current <= 0 ? max() : current - 1;
    moveTo(current, true);
    setTimeout(() => animating = false, 420);
  });

  window.addEventListener('resize', () => {
    if (current > max()) current = max();
    moveTo(current, false);
  });

  // Capture first frame of each video as poster
  cards.forEach(card => {
    const video = card.querySelector('video');
    if (!video) return;
    video.addEventListener('loadeddata', function onLoad() {
      video.removeEventListener('loadeddata', onLoad);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      video.currentTime = 0.1;
      video.addEventListener('seeked', function onSeeked() {
        video.removeEventListener('seeked', onSeeked);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        video.poster = canvas.toDataURL('image/jpeg', 0.8);
        video.currentTime = 0;
      }, { once: true });
    }, { once: true });
    video.preload = 'auto';
  });

  moveTo(0, false);
})();

// Pricing feature accordion
document.querySelectorAll('.pacc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    // close all
    document.querySelectorAll('.pacc-btn').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      b.nextElementSibling.classList.remove('open');
    });
    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      btn.nextElementSibling.classList.add('open');
    }
  });
});

// Pricing toggle
(function () {
  const toggle = document.getElementById('pricingToggle');
  if (!toggle) return;
  const amount = document.getElementById('pricingAmount');
  const per = document.getElementById('pricingPer');
  const bonus = document.getElementById('pricingBonus');
  const stripeMonthly = document.getElementById('stripeMonthly');
  const stripeAnnual = document.getElementById('stripeAnnual');
  let isAnnual = false;

  toggle.addEventListener('click', () => {
    isAnnual = !isAnnual;
    toggle.setAttribute('aria-pressed', isAnnual);
    if (isAnnual) {
      amount.textContent = '$873';
      per.textContent = '/yr';
      bonus.textContent = '+ 12 weeks free';
      stripeMonthly.style.display = 'none';
      stripeAnnual.style.display = 'block';
    } else {
      amount.textContent = '$97';
      per.textContent = '/mo';
      bonus.textContent = '';
      stripeMonthly.style.display = 'block';
      stripeAnnual.style.display = 'none';
    }
  });
})();

// Form submission
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = '✓ Request Received! We\'ll be in touch within 24 hours.';
  btn.style.background = 'linear-gradient(135deg, #2d7a3a, #3a9b4a)';
  btn.disabled = true;
});
