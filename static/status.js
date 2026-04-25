// SynthPing status overlay - polls /api/status and renders cards
(() => {
  const grid = document.getElementById('grid');
  const sTotal = document.getElementById('s-total');
  const sUp = document.getElementById('s-up');
  const sDown = document.getElementById('s-down');
  const sUnk = document.getElementById('s-unk');
  const lastSweep = document.getElementById('last-sweep');
  const clockEl = document.getElementById('clock');

  function fmtAge(iso) {
    if (!iso) return '—';
    const ago = (Date.now() - new Date(iso).getTime()) / 1000;
    if (ago < 60) return `${Math.floor(ago)}s ago`;
    if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
    return `${Math.floor(ago / 3600)}h ago`;
  }

  function statusLabel(up) {
    if (up === true) return 'ONLINE';
    if (up === false) return 'OFFLINE';
    return '...';
  }

  function statusClass(up) {
    if (up === true) return 'up';
    if (up === false) return 'down';
    return 'unknown';
  }

  function render(data) {
    sTotal.textContent = data.summary.total;
    sUp.textContent    = data.summary.up;
    sDown.textContent  = data.summary.down;
    sUnk.textContent   = data.summary.unknown;
    lastSweep.textContent = data.last_sweep
      ? `last sweep ${fmtAge(data.last_sweep)} • every ${data.interval}s`
      : 'awaiting first sweep…';

    if (!data.hosts.length) {
      grid.innerHTML = `<div class="empty">no hosts loaded — check hosts.txt</div>`;
      return;
    }

    // build HTML
    const html = data.hosts.map(h => {
      const cls = statusClass(h.up);
      const lbl = statusLabel(h.up);
      const lat = (h.up && h.latency_ms != null)
        ? `${h.latency_ms.toFixed(1)} ms`
        : (h.up === false ? 'no reply' : '—');
      const hist = (h.history || []).map(v =>
        `<span class="${v ? 'ok' : 'bad'}"></span>`
      ).join('');
      return `
        <div class="card ${cls}">
          <div class="row1">
            <div class="name">${escapeHTML(h.hostname)}</div>
            <div class="pill">${lbl}</div>
          </div>
          <div class="ip">${escapeHTML(h.ip)}</div>
          <div class="row2">
            <span>${lat}</span>
            <span>chk ${fmtAge(h.last_check)}</span>
          </div>
          <div class="history">${hist}</div>
        </div>
      `;
    }).join('');
    grid.innerHTML = html;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  async function poll() {
    try {
      const r = await fetch('/api/status', { cache: 'no-store' });
      if (r.ok) render(await r.json());
    } catch (e) {
      // network blip - just keep last view
    }
  }

  function tickClock() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  setInterval(poll, 2000);
  setInterval(tickClock, 1000);
  poll();
  tickClock();
})();
