# SynthPing

Vaporwave ping dashboard for keeping calm during data-center migrations.
Designed for a Raspberry Pi serving a wall-display browser.

## What it does

- Reads `hosts.txt` (`hostname,ipaddress` per line, `#` for comments)
- Pings every host in parallel every few seconds using the system `ping`
- Serves a single web page with an animated synthwave background (sun, mountains, neon grid) and a status overlay on top
- Down hosts pulse red, up hosts glow green, pending hosts are amber
- Hot-reloads `hosts.txt` while running — edit and save, no restart needed

## Install (Raspberry Pi / any Linux)

```bash
sudo apt update
sudo apt install -y python3-pip iputils-ping
pip3 install flask
```

## Run

```bash
cd synthping
# edit hosts.txt with your real hosts
python3 app.py
```

Open `http://<pi-ip>:8080` from any browser. Press F11 for fullscreen on the wall display.

## Configuration (env vars)

| Var | Default | Meaning |
|---|---|---|
| `HOSTS_FILE` | `hosts.txt` | Path to the host list |
| `PING_INTERVAL` | `5` | Seconds between full sweeps |
| `PING_TIMEOUT` | `2` | Per-packet timeout in seconds |
| `PING_COUNT` | `2` | Packets per host. Any reply marks the host up — set higher on flaky links (VPNs, lossy WANs) to reduce false-red flapping. |
| `PING_WORKERS` | `32` | Parallel ping workers |
| `PORT` | `8080` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |

Example:
```bash
PING_INTERVAL=3 PORT=80 sudo -E python3 app.py
```

## Run as a service (optional)

`/etc/systemd/system/synthping.service`:

```ini
[Unit]
Description=SynthPing dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pi/synthping
ExecStart=/usr/bin/python3 /home/pi/synthping/app.py
Restart=on-failure
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now synthping
```

## Audio

A small lofi/synthwave player sits in the bottom-right corner. Five Kevin MacLeod tracks (CC BY 4.0, from incompetech.com) ship in `static/audio/` and play on a shuffled loop. Browsers block autoplay, so the first play is always a user click. Volume defaults to ~30% and is remembered across reloads. The `×` button collapses the player to a `♪` icon; click that to bring it back.

To swap or extend tracks: drop new mp3s into `static/audio/` and edit the `PLAYLIST` array at the top of `static/player.js`. Anything you add must be legally redistributable — keep `ATTRIBUTION.md` updated.

## Kiosk mode on the Pi (optional)

If the Pi is the display itself, autostart Chromium in kiosk mode:

```bash
chromium-browser --kiosk --noerrdefaults --disable-infobars http://localhost:8080
```

Good luck with the migration. 🌴🌅
