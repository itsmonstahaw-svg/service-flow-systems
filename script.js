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


// Our Work carousel: slides one card out of frame and the next one in, like the testimonials track
(function () {
  const track = document.getElementById('workTrack');
  const prevBtn = document.getElementById('workPrev');
  const nextBtn = document.getElementById('workNext');
  if (!track || !prevBtn || !nextBtn) return;

  const cards = Array.from(track.querySelectorAll('.work-card'));
  let current = 0;
  let animating = false;

  function visible() {
    if (window.innerWidth < 600) return 1;
    if (window.innerWidth < 900) return 2;
    return 3;
  }
  function max() { return cards.length - visible(); }
  function cardW() {
    const gap = 32;
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
document.getElementById('contactForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = '✓ Request Received! We\'ll be in touch within 24 hours.';
  btn.style.background = 'linear-gradient(135deg, #2d7a3a, #3a9b4a)';
  btn.disabled = true;
});

// Simple Systems: drop each system pill into the box, one after another, while the section is on screen
(function () {
  const stage = document.getElementById('sysStage');
  if (!stage) return;
  const pills = Array.from(stage.querySelectorAll('.sys-pill'));
  if (!pills.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let i = 0;
  let timer = null;

  function drop() {
    const pill = pills[i];
    pill.classList.remove('is-active');
    void pill.offsetWidth; // restart the animation
    pill.classList.add('is-active');
    i = (i + 1) % pills.length;
  }

  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      if (!timer) { drop(); timer = setInterval(drop, 2200); }
    } else {
      clearInterval(timer);
      timer = null;
    }
  }, { threshold: 0.3 }).observe(stage);
})();

// Nav: Products dropdown (click/tap toggle; hover and focus are handled in CSS)
(function () {
  const dd = document.querySelector('.nav-dropdown');
  if (!dd) return;
  const btn = dd.querySelector('.nav-dropdown-btn');
  function setOpen(open) {
    dd.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!dd.classList.contains('open')); });
  document.addEventListener('click', (e) => { if (!dd.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
})();

// ── YouTube facade helpers ──
// Every video on the site starts as a lightweight thumbnail (.yt-thumb) with our own
// gold play button on top; the real YouTube embed is only created once someone clicks,
// so no page load has to pull in YouTube's player for a video nobody plays.
function buildYouTubeIframe(ytId, className, title) {
  const iframe = document.createElement('iframe');
  iframe.className = className;
  iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`;
  iframe.title = title || 'YouTube video player';
  iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
  iframe.setAttribute('allowfullscreen', '');
  iframe.style.border = '0';
  return iframe;
}

// Simple version: swap the thumbnail for a plain embed. Used anywhere we don't need to know
// when playback starts/stops (the hero video, and the testimonials.html page grid).
function wireYouTubeFacade(frame) {
  const thumb = frame.querySelector('.yt-thumb');
  const playBtn = frame.querySelector('button');
  const ytId = frame.dataset.ytId;
  if (!thumb || !playBtn || !ytId || frame.dataset.wired) return;
  frame.dataset.wired = 'true';

  function start() {
    if (frame.classList.contains('is-started')) return;
    frame.classList.add('is-started');
    const iframe = buildYouTubeIframe(ytId, thumb.className.replace('yt-thumb', '').trim(), thumb.alt);
    thumb.replaceWith(iframe);
  }
  playBtn.addEventListener('click', start);
  thumb.addEventListener('click', start);
}
document.querySelectorAll('#heroVideoFrame, .testi-vcard-frame').forEach(wireYouTubeFacade);

// Lazy-loads the YouTube IFrame API (only needed by the homepage carousel below, since that's
// the only place that has to know play/pause state); resolves once window.YT.Player exists.
let ytApiPromise = null;
function loadYouTubeAPI() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(); return; }
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof prevReady === 'function') prevReady();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

// Tracked version: same facade swap, but builds a real YT.Player so the carousel below can
// hear PLAYING/PAUSED/ENDED and react (pause its own auto-scroll while someone's watching).
function wireYouTubeFacadeTracked(frame, onStateChange) {
  const thumb = frame.querySelector('.yt-thumb');
  const playBtn = frame.querySelector('button');
  const ytId = frame.dataset.ytId;
  if (!thumb || !playBtn || !ytId || frame.dataset.wired) return;
  frame.dataset.wired = 'true';

  function start() {
    if (frame.classList.contains('is-started')) return;
    frame.classList.add('is-started');
    const mount = document.createElement('div');
    mount.className = thumb.className.replace('yt-thumb', '').trim();
    thumb.replaceWith(mount);
    loadYouTubeAPI().then(() => {
      new YT.Player(mount, {
        videoId: ytId,
        playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
        events: {
          onStateChange: (e) => { if (onStateChange) onStateChange(e); },
        },
      });
    });
  }
  playBtn.addEventListener('click', start);
  thumb.addEventListener('click', start);
}

// Homepage testimonials carousel: shows 2 cards, always advances forward (never backward),
// auto-advances every 3s, and loops seamlessly via cloned cards (same trick as the trades carousel).
// Autoplay stays off the whole time any testimonial video is playing, even across two videos
// or if the mouse leaves the carousel mid-playback, so it never scrolls out from under someone.
(function () {
  const track = document.getElementById('testiTrack');
  const nextBtn = document.getElementById('testiNext');
  if (!track || !nextBtn) return;

  const origCards = Array.from(track.querySelectorAll('.testi-hcard'));
  origCards.forEach((card) => track.appendChild(card.cloneNode(true)));
  const origCount = origCards.length;

  let current = 0;
  let animating = false;
  let timer = null;
  let hovering = false;
  const playingVideos = new Set();
  const players = new Set(); // every YT.Player created so far, for pausing on manual next

  function visible() { return window.innerWidth < 700 ? 1 : 2; }
  function cardW() {
    const gap = 32;
    const v = visible();
    return (track.parentElement.offsetWidth - gap * (v - 1)) / v + gap;
  }
  function moveTo(idx, animate) {
    track.style.transition = animate ? 'transform 0.5s ease' : 'none';
    track.style.transform = `translateX(${-idx * cardW()}px)`;
  }
  function next() {
    if (animating) return;
    animating = true;
    current++;
    moveTo(current, true);
    if (current >= origCount) {
      // silently rewind to the equivalent real position once the clone is fully in view
      setTimeout(() => {
        current -= origCount;
        moveTo(current, false);
        animating = false;
      }, 520);
    } else {
      setTimeout(() => animating = false, 520);
    }
  }
  function startTimer() {
    stopTimer();
    timer = setInterval(next, 3000);
  }
  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  // single source of truth: only autoplay when nothing is playing and the mouse isn't over it
  function syncAutoplay() {
    if (playingVideos.size > 0 || hovering) stopTimer();
    else startTimer();
  }

  // covers both the original cards and the clones appended above
  track.querySelectorAll('.testi-hcard-media').forEach((media) => {
    wireYouTubeFacadeTracked(media, (e) => {
      players.add(e.target);
      if (e.data === YT.PlayerState.PLAYING) {
        playingVideos.add(media);
      } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
        playingVideos.delete(media);
      }
      syncAutoplay();
    });
  });

  nextBtn.addEventListener('click', () => {
    // don't leave a video quietly playing off-screen once we've scrolled past it
    players.forEach((p) => { try { p.pauseVideo(); } catch (err) {} });
    next();
  });
  track.addEventListener('mouseenter', () => { hovering = true; syncAutoplay(); });
  track.addEventListener('mouseleave', () => { hovering = false; syncAutoplay(); });

  window.addEventListener('resize', () => moveTo(current, false));

  moveTo(0, false);
  syncAutoplay();
})();

// VSL (landing page): a muted 4-second GIF-style loop plays until someone clicks;
// the click swaps in the YouTube video, which starts from 0:00 with sound.
(function () {
  const root = document.getElementById('vsl');
  if (!root) return;
  const frame = document.getElementById('vslFrame');
  const video = document.getElementById('vslVideo');
  const bigPlay = document.getElementById('vslBigPlay');
  const soundCta = document.getElementById('vslSoundCta');
  const ytId = root.dataset.ytId;

  const PREVIEW_START = 119; // the GIF-style loop starts at 1:59...
  const PREVIEW_LENGTH = 4;  // ...and repeats for 4 seconds (1:59 to 2:03)
  let started = false;

  function play() {
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }
  function enforcePreviewStart() {
    if (!started && isFinite(video.duration) && video.duration > PREVIEW_START + 10 &&
        video.currentTime < PREVIEW_START - 1) {
      video.currentTime = PREVIEW_START;
    }
  }
  video.addEventListener('loadedmetadata', enforcePreviewStart);
  if (video.readyState >= 1) enforcePreviewStart();

  // jump back to the start of the 4-second clip as soon as it ends
  const loopTimer = setInterval(() => {
    if (started) { clearInterval(loopTimer); return; }
    if (video.paused) return;
    if (video.currentTime >= PREVIEW_START + PREVIEW_LENGTH - 0.05 || video.currentTime < PREVIEW_START - 1) {
      video.currentTime = PREVIEW_START;
    }
  }, 40);
  // (safety net) if the file ever runs out, go back to the start of the clip
  video.addEventListener('ended', () => {
    if (!started) { video.currentTime = PREVIEW_START; play(); }
  });

  // click: swap the loop for the YouTube player, from the beginning, with sound
  function start() {
    if (started) return;
    started = true;
    root.classList.remove('is-preview');
    root.classList.add('is-loading');
    video.pause();

    const iframe = document.createElement('iframe');
    iframe.className = 'vsl-yt';
    iframe.src = 'https://www.youtube.com/embed/' + ytId + '?autoplay=1&rel=0&playsinline=1&modestbranding=1';
    iframe.title = 'Service Flow Systems video';
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    iframe.setAttribute('allowfullscreen', '');

    let shown = false;
    function show() {
      if (shown) return;
      shown = true;
      root.classList.remove('is-loading');
      root.classList.add('is-started');
      video.removeAttribute('src'); // stop fetching the preview file
      video.load();
    }
    iframe.addEventListener('load', show);
    setTimeout(show, 4000);
    frame.appendChild(iframe);
  }
  [video, bigPlay, soundCta].forEach((el) => el.addEventListener('click', start));

  // while it's still just a preview, only play it while it's on screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (started) return;
      if (entries[0].isIntersecting) play();
      else video.pause();
    }, { threshold: 0.25 }).observe(frame);
  }
})();
