// SynthPing lofi player - small audio overlay, plays a shuffled playlist on loop.
// Tracks are CC BY 4.0 by Kevin MacLeod (incompetech.com); see ATTRIBUTION.md.
(() => {
  // `featured: true` makes a track play first on a fresh load (no saved state)
  // and is the track the player tries to autoplay. Browsers block autoplay
  // with sound by default; on the Pi kiosk, launch Chromium with
  // --autoplay-policy=no-user-gesture-required to actually hear it.
  const PLAYLIST = [
    { title: 'Local Forecast - Elevator', src: '/static/audio/local-forecast-elevator.mp3', featured: true },
    { title: 'Dreamy Flashback',  src: '/static/audio/dreamy-flashback.mp3' },
    { title: 'Hidden Agenda',     src: '/static/audio/hidden-agenda.mp3' },
    { title: 'Lobby Time',        src: '/static/audio/lobby-time.mp3' },
    { title: 'Ouroboros',         src: '/static/audio/ouroboros.mp3' },
    { title: 'Werq',              src: '/static/audio/werq.mp3' },
    { title: 'Mistake the Getaway', src: '/static/audio/mistake-the-getaway.mp3' },
    { title: 'Spy Glass',         src: '/static/audio/spy-glass.mp3' },
    { title: 'Easy Lemon',        src: '/static/audio/easy-lemon.mp3' },
  ];
  const LS_KEY = 'synthping-player-v1';

  const root      = document.getElementById('player');
  if (!root) return;
  const audio     = document.getElementById('player-audio');
  const playBtn   = document.getElementById('player-play');
  const skipBtn   = document.getElementById('player-skip');
  const hideBtn   = document.getElementById('player-hide');
  const showBtn   = document.getElementById('player-show');
  const volEl     = document.getElementById('player-vol');
  const titleEl   = document.getElementById('player-title');

  // restore persisted state
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_) {}
  const isFreshLoad = typeof saved.cursor !== 'number';
  let order = shuffle([...PLAYLIST.keys()]);
  // On a fresh load, pull the featured track to the front so it plays first.
  if (isFreshLoad) {
    const fIdx = PLAYLIST.findIndex(t => t.featured);
    if (fIdx >= 0) order = [fIdx, ...order.filter(i => i !== fIdx)];
  }
  let cursor = clampIndex(saved.cursor, order.length);
  let volume = typeof saved.volume === 'number' ? saved.volume : 0.3;
  let collapsed = !!saved.collapsed;

  audio.volume = volume;
  volEl.value = String(Math.round(volume * 100));
  applyCollapsed();
  // Try to autoplay on a fresh load. Browsers reject this without prior user
  // interaction; in that case the play() promise rejects and we just sit on
  // the featured track waiting for the user to click ▶. On a kiosk launched
  // with --autoplay-policy=no-user-gesture-required this actually plays.
  loadTrack(order[cursor], { autoplay: isFreshLoad });

  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ cursor, volume, collapsed }));
    } catch (_) {}
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function clampIndex(n, len) {
    n = Number(n);
    if (!Number.isFinite(n) || n < 0 || n >= len) return 0;
    return n | 0;
  }

  function loadTrack(idx, { autoplay }) {
    const track = PLAYLIST[idx];
    audio.src = track.src;
    titleEl.textContent = track.title;
    if (autoplay) {
      audio.play().catch(err => {
        console.warn('[player] play blocked or failed:', err);
        setPlayingUI(false);
      });
    }
  }

  function next({ autoplay } = { autoplay: true }) {
    cursor = (cursor + 1) % order.length;
    if (cursor === 0) order = shuffle([...PLAYLIST.keys()]);   // reshuffle each cycle
    persist();
    loadTrack(order[cursor], { autoplay });
  }

  function setPlayingUI(playing) {
    playBtn.textContent = playing ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    root.classList.toggle('is-playing', playing);
  }

  function applyCollapsed() {
    root.classList.toggle('is-collapsed', collapsed);
  }

  // events
  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().catch(err => console.warn('[player] play failed:', err));
    } else {
      audio.pause();
    }
  });

  skipBtn.addEventListener('click', () => next({ autoplay: !audio.paused }));

  hideBtn.addEventListener('click', () => { collapsed = true;  applyCollapsed(); persist(); });
  showBtn.addEventListener('click', () => { collapsed = false; applyCollapsed(); persist(); });

  volEl.addEventListener('input', () => {
    volume = Math.max(0, Math.min(1, volEl.value / 100));
    audio.volume = volume;
    persist();
  });

  audio.addEventListener('play',  () => setPlayingUI(true));
  audio.addEventListener('pause', () => setPlayingUI(false));
  audio.addEventListener('ended', () => next({ autoplay: true }));
  audio.addEventListener('error', () => {
    console.warn('[player] track failed, skipping:', PLAYLIST[order[cursor]]?.src);
    next({ autoplay: true });
  });
})();
