// SynthPing lofi player - small audio overlay, plays a shuffled playlist on loop.
// Tracks are CC BY 4.0 by Kevin MacLeod (incompetech.com); see ATTRIBUTION.md.
(() => {
  const PLAYLIST = [
    { title: 'Dreamy Flashback',  src: '/static/audio/dreamy-flashback.mp3' },
    { title: 'Hidden Agenda',     src: '/static/audio/hidden-agenda.mp3' },
    { title: 'Lobby Time',        src: '/static/audio/lobby-time.mp3' },
    { title: 'Ouroboros',         src: '/static/audio/ouroboros.mp3' },
    { title: 'Werq',              src: '/static/audio/werq.mp3' },
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
  let order = shuffle([...PLAYLIST.keys()]);
  let cursor = clampIndex(saved.cursor, order.length);
  let volume = typeof saved.volume === 'number' ? saved.volume : 0.3;
  let collapsed = !!saved.collapsed;

  audio.volume = volume;
  volEl.value = String(Math.round(volume * 100));
  applyCollapsed();
  loadTrack(order[cursor], { autoplay: false });

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
