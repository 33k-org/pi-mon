# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SynthPing — a Flask-served, single-page vaporwave ping dashboard intended to run on a Raspberry Pi driving a wall display during data-center migrations. No build step, no test suite, no linter config; everything is hand-edited Python / vanilla JS / inline CSS.

## Run

```bash
pip3 install flask        # only runtime dep besides system `ping`
python3 app.py            # serves http://0.0.0.0:8080
```

Env-var knobs (all optional): `HOSTS_FILE`, `PING_INTERVAL` (s), `PING_TIMEOUT` (s), `PING_WORKERS`, `HOST`, `PORT`. There are no CLI flags.

## Layout — do not flatten

Flask requires `templates/index.html` and `static/*.js` next to `app.py`. **Do NOT move these files back to the project root** — `app.py` will 500 with `TemplateNotFound: index.html` and the JS will 404. An earlier version of this repo stored them flat; that was a bug, fixed in `fix/flask-folder-layout`.

Layout:

```
app.py
hosts.txt
templates/index.html
static/scene.js
static/status.js
```

`synthping.tar.gz` is a legacy release artifact with the same correct layout under a top-level `synthping/` directory.

## Architecture

**`app.py`** — single-process Flask app with one background thread.

- Module-level shared state (`_status: dict[ip -> entry]`, `_last_sweep`, `_hosts_mtime`) guarded by `_state_lock`. Every read/write of `_status` must hold the lock; the JSON endpoint and the sweep both touch it.
- `pinger_loop()` (daemon thread, started in `__main__`) calls `sweep()` every `PING_INTERVAL` seconds.
- `sweep()` reloads `hosts.txt` each pass, fans out to `ThreadPoolExecutor(max_workers=PING_WORKERS)`, and shells out to the system `ping` binary (Linux flags: `-c 1 -W <timeout>`). When `hosts.txt`'s mtime changes, entries for removed IPs are dropped from `_status` so stale hosts don't linger.
- Per-host entry carries `up`, `latency_ms`, `last_check`, `last_change`, and a `history` list capped at the last 30 sweeps (used for the sparkline). State changes are detected by comparing previous `up` to new `up`.
- `/api/status` returns hosts sorted **down → unknown → up**, then alphabetical — the UI relies on this order; don't sort client-side.

**Frontend** (`static/scene.js`, `static/status.js`) — two independent scripts on one page; they don't share state.

- `scene.js` draws the synthwave background to `<canvas id="scene">`. Performance is **intentional and load-bearing on Pi-class hardware**:
  - Sky, stars, sun, and mountains are baked once into an offscreen canvas (`bgCanvas`) on resize and blitted each frame.
  - Only the perspective grid animates; everything else is static.
  - `shadowBlur` is used only during the one-time bake — adding it to the per-frame grid draw will tank FPS on a Pi.
  - DPR is hard-pinned to 1 (a HiDPI monitor would otherwise quadruple canvas pixel count).
  - FPS is capped (default 30) and the loop pauses on `visibilitychange`. Honors `prefers-reduced-motion`.
  - URL query params: `?fps=N` (5–60) and `?static=1` (skip animation entirely).
- `status.js` polls `/api/status` every 2s and rebuilds the card grid via `innerHTML` (host values are run through `escapeHTML`). Card colour comes from CSS classes `up` / `down` / `unknown`; the `down` class also drives the pulsing `@keyframes alarm` in `index.html`.

## Hosts file

`hosts.txt` is `hostname,ipaddress` per line; `#` comments and blank lines are skipped, and whitespace is also accepted as a separator. Hot-reloaded on every sweep — do not add caching or restart logic for it.
