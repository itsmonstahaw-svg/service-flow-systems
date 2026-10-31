// /video-explanation: click-to-play explainer video + view analytics.
//
// For every visit that presses play we record: when they started (date + time), how many seconds
// they actually watched (time spent playing, so skipping around doesn't inflate it), how far in they
// got, and the video length. The numbers go out as one "video_watch" record per page view; each
// update carries the running totals under the same view_id, so the receiver keeps the latest one.
//
// Where it goes:
//   - window.dataLayer (Google Tag Manager / GA4), gtag() and fbq() if those are on the page
//   - an HTTP endpoint if #vxPlayer has data-analytics-endpoint="https://..." (e.g. a GoHighLevel
//     inbound webhook, Zapier / Make hook, or a Google Apps Script URL that appends a Sheet row)
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

  // ── playback ──
  function start() {
    video.muted = false;
    video.controls = true;
    player.classList.add('is-started');
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
    goFullscreen();
  }

  // Clicking the big screen opens it full screen. Must run inside the click, so start() calls it
  // directly. The <video> itself goes full screen so its native controls (and exit button) come along;
  // iPhones only allow this through webkitEnterFullscreen.
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
  video.addEventListener('click', () => { if (!player.classList.contains('is-started')) start(); });
  video.addEventListener('ended', () => {
    video.controls = false;
    player.classList.remove('is-started');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  });

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
    const dur = video.duration && isFinite(video.duration) ? video.duration : 0;
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
      plays: plays
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
    if (t > maxPos) maxPos = t;

    const dur = video.duration;
    if (dur && isFinite(dur)) {
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
    if (video.duration && isFinite(video.duration)) maxPos = video.duration;
    report('video_complete');
  });

  // leaving the page / switching tabs: send whatever has been watched so far
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush('video_watch');
  });
  window.addEventListener('pagehide', () => flush('video_watch'));
})();
