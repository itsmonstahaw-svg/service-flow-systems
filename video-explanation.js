// /video-explanation: click-to-play explainer video + view analytics.
//
// For every visit that presses play we record: when they started (date + time), how many seconds
// they actually watched (time spent playing, so skipping around doesn't inflate it), how far in they
// got, and the video length. The numbers go out as one "video_watch" record per page view; each
// update carries the running totals under the same view_id, so the receiver keeps the latest one.
//
// Where it goes:
//   - window.dataLayer (Google Tag Manager / GA4), gtag() and fbq() if those are on the page
//   - an HTTP endpoint if #vxPlayer has data-analytics-endpoint="https://..." (the Google Apps Script
//     in tools/video-watch-sheet.gs logs one row per viewer to a Google Sheet; a GoHighLevel inbound
//     webhook or Zapier / Make hook works too)
(function () {
  const player = document.getElementById('vxPlayer');
  const video = document.getElementById('vxVideo');
  const playBtn = document.getElementById('vxPlay');
  if (!player || !video || !playBtn) return;

  const endpoint = (player.dataset.analyticsEndpoint || '').trim();
  const videoId = player.dataset.videoId || 'video';
  const viewId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  const unmuteBtn = document.getElementById('vxUnmute');
  const PREVIEW_MS = 3000;   // how long the loading preview shows before the video starts itself

  // ── playback ──
  // 1) the page loads with a short preview + spinner, then the video starts by itself, with sound
  //    when the browser allows it (otherwise muted, and the first tap turns the sound on).
  //    2) A click at any point starts it with sound, full screen.
  let autoTimer = null;

  function showMutedHint(on) { if (unmuteBtn) unmuteBtn.hidden = !on; }

  function autoStart() {
    autoTimer = null;
    if (player.classList.contains('is-started')) return;
    video.controls = true;
    player.classList.add('is-started');

    // try WITH sound first; browsers only allow that if the visitor has already interacted with the
    // page / site. If it's refused, play muted instead and unmute on their first tap or key press.
    video.muted = false;
    const loud = video.play();
    if (!loud || !loud.then) { showMutedHint(video.muted); return; }
    loud.catch(() => {
      video.muted = true;
      const quiet = video.play();
      if (quiet && quiet.then) {
        quiet.then(() => { showMutedHint(true); unmuteOnFirstTouch(); }).catch(() => {
          // even muted autoplay refused: fall back to a plain play button
          video.controls = false;
          player.classList.remove('is-started');
          player.classList.add('is-blocked');
        });
      }
    });
  }

  // the first real tap / click / key press anywhere on the page turns the sound on
  function unmuteOnFirstTouch() {
    const evs = ['pointerdown', 'keydown', 'touchend'];
    function once() {
      evs.forEach((e) => window.removeEventListener(e, once, true));
      if (video.muted && !video.paused) { video.muted = false; showMutedHint(false); }
    }
    evs.forEach((e) => window.addEventListener(e, once, true));
  }

  // a click (play button, preview, or the video itself): play with sound and go full screen
  function start() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    video.muted = false;
    video.controls = true;
    player.classList.add('is-started');
    player.classList.remove('is-blocked');
    showMutedHint(false);
    if (video.paused) {
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }
    goFullscreen();
  }

  // Must run inside the click, so start() calls it directly. The <video> itself goes full screen so
  // its native controls (and exit button) come along; iPhones only allow this through
  // webkitEnterFullscreen.
  function goFullscreen() {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      if (video.requestFullscreen) {
        const r = video.requestFullscreen();
        if (r && r.catch) r.catch(() => {});
      } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch (e) { /* fullscreen is a nicety, never block playback */ }
  }

  playBtn.addEventListener('click', start);
  if (unmuteBtn) unmuteBtn.addEventListener('click', start);
  video.addEventListener('click', () => {
    if (!player.classList.contains('is-started') || video.muted) start();
  });
  video.addEventListener('volumechange', () => { if (!video.muted) showMutedHint(false); });
  video.addEventListener('ended', () => {
    video.controls = false;
    player.classList.remove('is-started');
    player.classList.add('is-blocked');   // back to the poster with a play button for a replay
    showMutedHint(false);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  });

  autoTimer = setTimeout(autoStart, PREVIEW_MS);

  // ── skipped section ──
  // Optional: data-skip-from / data-skip-to (seconds) on #vxPlayer make the player jump over a part
  // of the video. On /video-explanation that's the "Is your customer list safe? Yes. We never share
  // it..." part (83.07s to 88.45s), whose two ends sit in silence, before its on-screen text and
  // captions. Pages without those attributes play the whole video.
  const SKIP_FROM = parseFloat(player.dataset.skipFrom);
  const SKIP_TO = parseFloat(player.dataset.skipTo);
  const HAS_SKIP = isFinite(SKIP_FROM) && isFinite(SKIP_TO) && SKIP_TO > SKIP_FROM;
  const SKIP_LEN = HAS_SKIP ? SKIP_TO - SKIP_FROM : 0;

  function skipCheck() {
    const t = video.currentTime;
    if (HAS_SKIP && t >= SKIP_FROM && t < SKIP_TO) video.currentTime = SKIP_TO;
  }
  // timeupdate only fires ~4x a second, so while playing check every frame instead
  let skipRaf = 0;
  function skipLoop() {
    skipCheck();
    skipRaf = video.paused ? 0 : requestAnimationFrame(skipLoop);
  }
  video.addEventListener('play', () => { if (!skipRaf) skipRaf = requestAnimationFrame(skipLoop); });
  video.addEventListener('seeked', skipCheck);   // scrubbing into the skipped part lands after it

  // ── tracking state ──
  let startedAt = null;      // Date of the first play
  let watched = 0;           // seconds actually played
  let maxPos = 0;            // furthest point reached
  let lastTime = null;       // previous currentTime while playing
  let plays = 0;
  let lastSentWatched = -1;
  let completed = false;
  const milestonesHit = {};

  function snapshot(event) {
    const dur = video.duration && isFinite(video.duration) ? video.duration - SKIP_LEN : 0;   // length viewers actually get
    const iso = startedAt ? startedAt.toISOString() : null;
    return {
      event: event,
      video_id: videoId,
      view_id: viewId,
      page: location.pathname,
      referrer: document.referrer || '',
      started_at: iso,                                   // ISO timestamp (UTC)
      started_date: startedAt ? startedAt.toLocaleDateString('en-CA') : null,   // YYYY-MM-DD local
      started_time: startedAt ? startedAt.toLocaleTimeString('en-GB') : null,   // HH:MM:SS local
      timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '',
      seconds_watched: Math.round(watched * 10) / 10,
      furthest_second: Math.round(maxPos * 10) / 10,
      video_length: Math.round(dur * 10) / 10,
      percent_watched: dur ? Math.min(100, Math.round((watched / dur) * 100)) : 0,
      percent_reached: dur ? Math.min(100, Math.round((maxPos / dur) * 100)) : 0,
      completed: completed,
      plays: plays,
      device: window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
      user_agent: navigator.userAgent
    };
  }

  function sendToTools(data) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(data);
      if (typeof window.gtag === 'function') {
        window.gtag('event', data.event, {
          video_id: data.video_id,
          seconds_watched: data.seconds_watched,
          percent_watched: data.percent_watched
        });
      }
      if (typeof window.fbq === 'function') window.fbq('trackCustom', data.event, data);
    } catch (e) { /* analytics must never break the page */ }
  }

  function sendToEndpoint(data) {
    if (!endpoint) return;
    const body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }))) return;
    } catch (e) { /* fall through */ }
    try {
      fetch(endpoint, { method: 'POST', body: body, mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' } });
    } catch (e) { /* ignore */ }
  }

  function report(event) {
    if (!startedAt) return;
    const data = snapshot(event);
    sendToTools(data);
    sendToEndpoint(data);
    lastSentWatched = watched;
  }

  // sends the running totals (only if something changed since the last send)
  function flush(event) {
    if (!startedAt || watched === lastSentWatched) return;
    report(event || 'video_watch');
  }

  // ── video events ──
  video.addEventListener('play', () => {
    plays += 1;
    lastTime = video.currentTime;
    if (!startedAt) {
      startedAt = new Date();
      report('video_start');
    }
  });

  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    if (!video.paused && lastTime !== null) {
      const d = t - lastTime;
      // a normal tick is a fraction of a second; bigger jumps are seeks, don't count them
      if (d > 0 && d < 1.5) watched += d;
    }
    lastTime = t;
    const pos = !HAS_SKIP ? t : (t >= SKIP_TO ? t - SKIP_LEN : Math.min(t, SKIP_FROM));   // position without the skipped part
    if (pos > maxPos) maxPos = pos;

    const dur = video.duration - SKIP_LEN;
    if (dur > 0 && isFinite(dur)) {
      [25, 50, 75].forEach((m) => {
        if (!milestonesHit[m] && watched / dur >= m / 100) {
          milestonesHit[m] = true;
          report('video_progress_' + m);
        }
      });
    }
  });

  video.addEventListener('seeked', () => { lastTime = video.currentTime; });
  video.addEventListener('pause', () => { if (!video.ended) flush('video_pause'); });
  video.addEventListener('ended', () => {
    completed = true;
    if (video.duration && isFinite(video.duration)) maxPos = video.duration - SKIP_LEN;
    report('video_complete');
  });

  // leaving the page / switching tabs: send whatever has been watched so far
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush('video_watch');
  });
  window.addEventListener('pagehide', () => flush('video_watch'));
})();
