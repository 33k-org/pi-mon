// SynthPing scene - synthwave animated background
(() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, horizon = 0;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    horizon = Math.floor(H * 0.55);
  }
  window.addEventListener('resize', resize);
  resize();

  // --- starfield ---
  const stars = [];
  function seedStars() {
    stars.length = 0;
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * (horizon - 20),
        r: Math.random() * 1.4 + 0.2,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }
  seedStars();
  window.addEventListener('resize', seedStars);

  // --- mountains (parallax, two layers) ---
  function genMountains(count, baseHeight, jitter, seed) {
    // deterministic-ish silhouette; we precompute peak heights
    const peaks = [];
    let v = seed;
    for (let i = 0; i <= count; i++) {
      v = (v * 9301 + 49297) % 233280;
      const r = v / 233280;
      peaks.push(baseHeight + r * jitter);
    }
    return peaks;
  }
  const mountainsBack  = genMountains(14, 60,  90,  42);
  const mountainsFront = genMountains(10, 110, 130, 17);

  function drawMountains(peaks, color, glow, yOffset) {
    const step = W / (peaks.length - 1);
    ctx.beginPath();
    ctx.moveTo(0, horizon + yOffset);
    for (let i = 0; i < peaks.length; i++) {
      ctx.lineTo(i * step, horizon - peaks[i] + yOffset);
    }
    ctx.lineTo(W, horizon + yOffset);
    ctx.closePath();
    // fill with dark gradient
    const g = ctx.createLinearGradient(0, horizon - 200, 0, horizon);
    g.addColorStop(0, color);
    g.addColorStop(1, '#0a0014');
    ctx.fillStyle = g;
    ctx.fill();
    // neon outline
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // --- sun ---
  function drawSun(t) {
    const cx = W / 2;
    const cy = horizon - 30;
    const r = Math.min(W, H) * 0.18;

    // glow halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.2);
    halo.addColorStop(0, 'rgba(255, 80, 180, 0.55)');
    halo.addColorStop(1, 'rgba(255, 80, 180, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, horizon + 40);

    // sun disc with vertical gradient
    const sunGrad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    sunGrad.addColorStop(0, '#fff5a8');
    sunGrad.addColorStop(0.45, '#ff9a3c');
    sunGrad.addColorStop(1, '#ff2d6f');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // horizontal cut-out bands (the classic synthwave sun stripes)
    ctx.globalCompositeOperation = 'destination-out';
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const bandY = cy + r * 0.15 + i * (r * 0.13) - ((t * 8) % (r * 0.13));
      const bandH = Math.max(1.5, (i + 1) * 0.8);
      ctx.fillRect(cx - r, bandY, r * 2, bandH);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // --- grid floor ---
  const GRID_SPEED = 60; // px/sec
  const GRID_SPACING = 60; // world units between horizontal lines

  function drawGrid(t) {
    const groundH = H - horizon;
    const cx = W / 2;

    // sky already drawn; ground gradient
    const ground = ctx.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, '#1a0030');
    ground.addColorStop(1, '#05000a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, W, groundH);

    ctx.strokeStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.2;

    // vertical lines (vanishing point at center horizon)
    const vLines = 24;
    for (let i = -vLines; i <= vLines; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, horizon);
      ctx.lineTo(cx + (i / vLines) * W * 1.5, H);
      ctx.stroke();
    }

    // horizontal lines, scrolling toward viewer (perspective)
    const offset = (t * GRID_SPEED) % GRID_SPACING;
    for (let i = 1; i <= 18; i++) {
      // distance from horizon, in "world" units, scrolling
      const worldZ = i * GRID_SPACING - offset;
      // perspective projection: y grows non-linearly toward viewer
      const k = worldZ / (worldZ + 200);
      const y = horizon + k * groundH;
      if (y > H) continue;
      const alpha = Math.min(1, 0.25 + k * 0.9);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0a0014');
    sky.addColorStop(0.55, '#2a0844');
    sky.addColorStop(1, '#7a1466');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);
  }

  function drawStars(t) {
    for (const s of stars) {
      const a = 0.5 + 0.5 * Math.sin(t * 2 + s.tw);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  let start = performance.now();
  function frame(now) {
    const t = (now - start) / 1000;

    drawSky();
    drawStars(t);
    drawSun(t);
    // back range, slightly higher up & dimmer
    drawMountains(mountainsBack,  '#3a0a55', '#a040c0', -8);
    drawMountains(mountainsFront, '#250838', '#ff2d6f',  4);
    drawGrid(t);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
