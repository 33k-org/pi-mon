#!/usr/bin/env python3
"""
SynthPing - Vaporwave ping dashboard for data center migrations.
Reads hosts.txt (hostname,ipaddress per line, # for comments),
pings them in the background, exposes status via JSON.
"""
import os
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template

# ---- config (env-overridable) ----
HOSTS_FILE = Path(os.environ.get("HOSTS_FILE", "hosts.txt"))
PING_INTERVAL = int(os.environ.get("PING_INTERVAL", "5"))     # seconds between sweeps
PING_TIMEOUT = int(os.environ.get("PING_TIMEOUT", "2"))       # seconds per ping
PING_WORKERS = int(os.environ.get("PING_WORKERS", "32"))      # parallel pings
PORT = int(os.environ.get("PORT", "8080"))
HOST = os.environ.get("HOST", "0.0.0.0")

app = Flask(__name__)

# shared state
_state_lock = threading.Lock()
_status = {}            # ip -> {hostname, ip, up, latency_ms, last_check, last_change, history}
_last_sweep = None
_hosts_mtime = 0


def load_hosts():
    """Read hosts.txt -> list of (hostname, ip). Comments and blanks ignored."""
    if not HOSTS_FILE.exists():
        return []
    out = []
    for raw in HOSTS_FILE.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # allow comma OR whitespace separator, be forgiving
        if "," in line:
            parts = [p.strip() for p in line.split(",", 1)]
        else:
            parts = line.split(None, 1)
        if len(parts) != 2:
            continue
        hostname, ip = parts
        out.append((hostname, ip))
    return out


def ping_one(ip, timeout=PING_TIMEOUT):
    """Return (up: bool, latency_ms: float|None). Uses system ping."""
    try:
        # -c 1: one packet, -W timeout (Linux), -w deadline as fallback
        result = subprocess.run(
            ["ping", "-c", "1", "-W", str(timeout), ip],
            capture_output=True, text=True, timeout=timeout + 1,
        )
        if result.returncode != 0:
            return False, None
        # parse "time=12.3 ms"
        for token in result.stdout.split():
            if token.startswith("time="):
                try:
                    return True, float(token.split("=", 1)[1])
                except ValueError:
                    return True, None
        return True, None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False, None


def sweep():
    """Ping all hosts in parallel and update shared state."""
    global _last_sweep, _hosts_mtime
    try:
        mtime = HOSTS_FILE.stat().st_mtime if HOSTS_FILE.exists() else 0
    except OSError:
        mtime = 0
    hosts = load_hosts()

    with ThreadPoolExecutor(max_workers=PING_WORKERS) as pool:
        results = list(pool.map(lambda hi: (hi, *ping_one(hi[1])), hosts))

    now = datetime.now(timezone.utc).isoformat()
    with _state_lock:
        # if hosts.txt changed, drop entries no longer present
        if mtime != _hosts_mtime:
            current_ips = {ip for _, ip in hosts}
            for ip in list(_status.keys()):
                if ip not in current_ips:
                    del _status[ip]
            _hosts_mtime = mtime

        for (hostname, ip), up, latency in results:
            entry = _status.get(ip, {
                "hostname": hostname, "ip": ip,
                "up": None, "latency_ms": None,
                "last_check": None, "last_change": None,
                "history": [],
            })
            # detect state change
            if entry["up"] is not None and entry["up"] != up:
                entry["last_change"] = now
            elif entry["last_change"] is None:
                entry["last_change"] = now
            entry["hostname"] = hostname
            entry["up"] = up
            entry["latency_ms"] = latency
            entry["last_check"] = now
            # keep last 30 results for sparkline-ish history
            entry["history"].append(1 if up else 0)
            entry["history"] = entry["history"][-30:]
            _status[ip] = entry

        _last_sweep = now


def pinger_loop():
    while True:
        try:
            sweep()
        except Exception as e:
            print(f"[pinger] sweep error: {e}", flush=True)
        time.sleep(PING_INTERVAL)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def api_status():
    with _state_lock:
        # sort: down first (most urgent), then unknown, then up
        def sort_key(e):
            order = 0 if e["up"] is False else (1 if e["up"] is None else 2)
            return (order, e["hostname"].lower())
        hosts = sorted(_status.values(), key=sort_key)
        total = len(hosts)
        up = sum(1 for h in hosts if h["up"] is True)
        down = sum(1 for h in hosts if h["up"] is False)
        unknown = total - up - down
    return jsonify({
        "hosts": hosts,
        "summary": {"total": total, "up": up, "down": down, "unknown": unknown},
        "last_sweep": _last_sweep,
        "interval": PING_INTERVAL,
    })


if __name__ == "__main__":
    if not HOSTS_FILE.exists():
        print(f"[!] {HOSTS_FILE} not found — create it with 'hostname,ipaddress' per line", flush=True)
    t = threading.Thread(target=pinger_loop, daemon=True)
    t.start()
    print(f"[*] SynthPing running on http://{HOST}:{PORT}  (hosts file: {HOSTS_FILE})", flush=True)
    # threaded=True so the JSON endpoint stays responsive while sweeps run
    app.run(host=HOST, port=PORT, threaded=True, debug=False)
