// SynthPing scene - synthwave animated background (perf-optimized)
//
// Key optimizations vs original:
//  - Static layers (sky, stars, sun, mountains) rendered ONCE to an offscreen
//    canvas and just blitted each frame. No more per-frame gradients or shadowBlur.
//  - Animated layer is just the grid (the only thing that actually moves).
//  - Frame rate capped to 30fps (configurable). Synthwave doesn't need 60fps.
//  - Animation pauses when the tab/window is hidden.
//  - shadowBlur removed from per-frame draws (it was the #1 GPU cost).
//  - Honors prefers-reduced-motion: shows a static frame, no animation at all.

(() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });

  // perf knobs - tweak via URL: ?fps=20  ?static=1
  const params = new URLSearchParams(location.search);
  const TARGET_FPS = Math.max(5, Math.min(60, parseInt(params.get('fps') || '30', 10)));
  const FORCE_STATIC = params.get('static') === '1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STATIC_ONLY = FORCE_STATIC || reducedMotion;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  // Cap devicePixelRatio. On a Pi this is usually 1 anyway, but a HiDPI monitor
  // can make the canvas 4x bigger and tank perf. We force 1.
  const DPR = 1;

  let W = 0, H = 0, horizon = 0;
  let bgCanvas = null;       // offscreen: sky+stars+sun+mountains (static)
  let bgCtx = null;
  let running = true;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    horizon = Math.floor(H * 0.55);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    buildBackground();
  }

  // ---- background (rendered once, blitted every frame) ----
  function buildBackground() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = W;
    bgCanvas.height = H;
    bgCtx = bgCanvas.getContext('2d', { alpha: false });

    drawSky(bgCtx);
    drawStars(bgCtx);
    drawSun(bgCtx);
    drawMountains(bgCtx, mountainsBack,  '#3a0a55', '#a040c0', -8);
    drawMountains(bgCtx, mountainsFront, '#250838', '#ff2d6f',  4);
    // ground gradient is part of the static layer too
    const ground = bgCtx.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, '#1a0030');
    ground.addColorStop(1, '#05000a');
    bgCtx.fillStyle = ground;
    bgCtx.fillRect(0, horizon, W, H - horizon);
  }

  // --- starfield (now drawn ONCE into bg) ---
  function drawStars(c) {
    // No twinkle anymore - it forced full-canvas redraw every frame.
    // 100 fixed stars, deterministic positions.
    let v = 12345;
    const rand = () => { v = (v * 9301 + 49297) % 233280; return v / 233280; };
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
      const x = rand() * W;
      const y = rand() * (horizon - 20);
      const r = rand() * 1.4 + 0.3;
      c.globalAlpha = 0.4 + rand() * 0.6;
      c.fillRect(x, y, r, r);
    }
    c.globalAlpha = 1;
  }

  // --- mountains ---
  function genMountains(count, baseHeight, jitter, seed) {
    const peaks = [];
    let v = seed;
    for (let i = 0; i <= count; i++) {
      v = (v * 9301 + 49297) % 233280;
      peaks.push(baseHeight + (v / 233280) * jitter);
    }
    return peaks;
  }
  const mountainsBack  = genMountains(14, 60,  90,  42);
  const mountainsFront = genMountains(10, 110, 130, 17);

  function drawMountains(c, peaks, color, glow, yOffset) {
    const step = W / (peaks.length - 1);
    c.beginPath();
    c.moveTo(0, horizon + yOffset);
    for (let i = 0; i < peaks.length; i++) {
      c.lineTo(i * step, horizon - peaks[i] + yOffset);
    }
    c.lineTo(W, horizon + yOffset);
    c.closePath();
    const g = c.createLinearGradient(0, horizon - 200, 0, horizon);
    g.addColorStop(0, color);
    g.addColorStop(1, '#0a0014');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = glow;
    c.lineWidth = 1.5;
    // shadowBlur ONLY runs once during background bake, not per frame
    c.shadowColor = glow;
    c.shadowBlur = 12;
    c.stroke();
    c.shadowBlur = 0;
  }

  // --- sun (static now: no scrolling bands) ---
  function drawSun(c) {
    const cx = W / 2;
    const cy = horizon - 30;
    const r = Math.min(W, H) * 0.18;

    const halo = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.2);
    halo.addColorStop(0, 'rgba(255, 80, 180, 0.55)');
    halo.addColorStop(1, 'rgba(255, 80, 180, 0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, W, horizon + 40);

    const sunGrad = c.createLinearGradient(cx, cy - r, cx, cy + r);
    sunGrad.addColorStop(0, '#fff5a8');
    sunGrad.addColorStop(0.45, '#ff9a3c');
    sunGrad.addColorStop(1, '#ff2d6f');
    c.fillStyle = sunGrad;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();

    // Fixed horizontal cut-out bands (no longer scrolling - was forcing
    // the sun to be redrawn every frame). The classic look survives.
    c.globalCompositeOperation = 'destination-out';
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const bandY = cy + r * 0.15 + i * (r * 0.13);
      const bandH = Math.max(1.5, (i + 1) * 0.8);
      c.fillRect(cx - r, bandY, r * 2, bandH);
    }
    c.globalCompositeOperation = 'source-over';
  }

  function drawSky(c) {
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0a0014');
    sky.addColorStop(0.55, '#2a0844');
    sky.addColorStop(1, '#7a1466');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, horizon);
  }

  // ---- the only thing that actually animates ----
  const GRID_SPEED = 60;
  const GRID_SPACING = 60;

  function drawGrid(t) {
    const groundH = H - horizon;
    const cx = W / 2;

    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1;
    // NO shadowBlur here - this draws every frame and it was the killer.
    // The mountain glow already gives the scene its neon feel.

    // vertical lines
    const vLines = 24;
    ctx.beginPath();
    for (let i = -vLines; i <= vLines; i++) {
      ctx.moveTo(cx, horizon);
      ctx.lineTo(cx + (i / vLines) * W * 1.5, H);
    }
    ctx.stroke();

    // horizontal scrolling lines
    const offset = (t * GRID_SPEED) % GRID_SPACING;
    for (let i = 1; i <= 18; i++) {
      const worldZ = i * GRID_SPACING - offset;
      const k = worldZ / (worldZ + 200);
      const y = horizon + k * groundH;
      if (y > H) continue;
      ctx.globalAlpha = Math.min(1, 0.25 + k * 0.9);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- main loop with FPS cap ----
  let start = performance.now();
  let lastFrame = 0;

  function frame(now) {
    if (!running) return;
    if (STATIC_ONLY) {
      // draw once and stop
      ctx.drawImage(bgCanvas, 0, 0);
      drawGrid(0);
      return;
    }
    if (now - lastFrame >= FRAME_INTERVAL) {
      lastFrame = now;
      const t = (now - start) / 1000;
      ctx.drawImage(bgCanvas, 0, 0);
      drawGrid(t);
    }
    requestAnimationFrame(frame);
  }

  // pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      lastFrame = 0;
      requestAnimationFrame(frame);
    }
  });

  // debounced resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (STATIC_ONLY) {
        ctx.drawImage(bgCanvas, 0, 0);
        drawGrid(0);
      }
    }, 200);
  });

  resize();
  requestAnimationFrame(frame);
})();
