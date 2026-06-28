# Split-Flap Display

A retro split-flap (Solari board) web display with real-time updates over
WebSocket. Runs as a **single Docker container** — one command on a Raspberry
Pi, plug the Pi into a monitor over HDMI, and you have a wall display.

Three display modes, switchable from the setup screen or the API:

- **English Word Clock** — QLOCKTWO-style word clock
- **Arabic Word Clock** — right-to-left, Modern Standard Arabic
- **Info Split-Flap** — animated split-flap board showing the date + 24h clock

---

## Architecture

One container, one port. Express serves the REST API, the WebSocket, **and** the
built React client together — so there's nothing else to run.

```
                    ┌─────────────────────────────────────────┐
                    │  Docker container (port 3001 → host 8080) │
   browser ───────▶ │                                           │
   (kiosk / phone)  │   Express ──┬── GET /            static   │
        │           │             │   React client (Vite build) │
        │  WebSocket │             ├── /api/*          REST      │
        └───────────┼──── ws ─────┴── broadcast to all clients  │
                    │                                           │
                    │   state + settings ──▶ /data/.state.json  │
                    └────────────────────────────│──────────────┘
                                                 ▼
                                      split-flap-data volume
                                   (survives restarts & rebuilds)
```

Settings (mode, theme, sound, language) and the last message are pushed to every
connected client over WebSocket and persisted to a Docker volume, so the display
returns in the mode it was last set to after a reboot.

---

## Quick start (Raspberry Pi)

You need Docker + Docker Compose on the Pi. The Pi **pulls a prebuilt image**
from GHCR — no building on the Pi.

```bash
git clone https://github.com/jeffstrout/split-flap.git
cd split-flap
cp .env.example .env                 # optional — defaults work as-is
docker compose pull && docker compose up -d
```

Then open **`http://<pi-ip>:8080`** from any browser on your network. The Pi
itself can be the display: plug it into a monitor over HDMI and launch Chromium
in kiosk mode (see [KIOSK.md](KIOSK.md)).

> **Setting up a Pi from a fresh OS install?** Follow the step-by-step
> [PI-SETUP.md](PI-SETUP.md) runbook (Docker install, swap, and Chromium
> kiosk autostart).

The container has `restart: unless-stopped`, so it comes back automatically after
a reboot or power loss.

### Automatic updates

The compose file also runs [Watchtower](https://containrrr.dev/watchtower/),
which checks GHCR for a newer image every ~20 minutes and updates the display in
place when one appears — so a push to `main` reaches the wall hands-off. Your
mode/theme/sound/message state lives on a Docker volume and survives updates.

- **See what's running:** `GET /api/version` (also shown at the bottom of
  `/setup`) reports the commit + build time.
- **Pin / roll back:** set `IMAGE_TAG=sha-<short>` in `.env`, then
  `docker compose pull && docker compose up -d`. Set back to `latest` to resume
  auto-updates.
- **Change cadence:** `WATCHTOWER_POLL_INTERVAL` (seconds) in `.env`.
- **Prefer manual updates?** Drop the `watchtower` service and just run
  `docker compose pull && docker compose up -d` when you want the latest, or put
  it on a cron/systemd timer.

---

## Configuration

All optional — copy `.env.example` to `.env` and edit. With no `.env`, the
defaults below apply.

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST_PORT` | `8080` | Host port the display + API are served on |
| `TZ` | `UTC` | Timezone for the clock, IANA name (e.g. `America/Chicago`). Set this or the clock shows UTC |
| `DEFAULT_MODE` | `qlock` | Boot mode: `qlock` (word clock) or `flip` (split-flap) |
| `DEFAULT_QLOCK_LANG` | `en` | Word-clock language: `en` or `ar` (Arabic, RTL) |
| `PERSIST_FILE` | `/data/.state.json` | State file on the volume; `off` to disable |
| `IMAGE_TAG` | `latest` | GHCR image tag to run; pin to `sha-<short>` to freeze/rollback |
| `WATCHTOWER_POLL_INTERVAL` | `1200` | Seconds between auto-update checks (~20 min) |
| `FLIP_SPEED` | `2` | Flip-animation speed. Baked in at **build** time, so it only applies to local builds ([docker-compose.build.yml](docker-compose.build.yml)); the published image is fixed at `2` |

Changing the mode/theme/sound from the **setup screen** (`http://<pi-ip>:8080/setup`)
applies to all displays instantly and persists across restarts.

---

## Raspberry Pi 3B+ notes

The 3B+ works, with a couple of caveats — the heavy part is Chromium rendering
the flip animation, not the server.

- **Word-clock modes are smooth** on the 3B+ (no flip animation — just letter
  highlighting). If you mostly run the word clock, the 3B+ is a fine choice.
- **Full-board split-flap transitions are demanding** — up to ~192 tiles
  animating at once stresses a single Cortex-A53 core. Expect some jank on big
  changes; the idle 5-second info-screen ticks (only a few characters change)
  are fine. A Pi 4B handles the heavy animation noticeably better.
- The client is built with `React.memo` on each tile to minimize re-renders. On
  the 3B+ the kiosk renders in **software** (`--disable-gpu`) — its VideoCore IV
  GPU can't drive Chromium's GL ES under Wayland — which is fine for this
  mostly-CSS board. Setup details in [PI-SETUP.md](PI-SETUP.md) / [KIOSK.md](KIOSK.md).
- **Tune the flip speed** for weaker hardware: the published image ships at the
  default (`2`). For the gentler `1` you currently need a local build —
  set `FLIP_SPEED=1` in `.env` and build with the override (see below). Slower
  flips are gentler on the 3B+ because there's less per-frame churn.

### Building the image yourself

Normally the Pi just pulls the prebuilt GHCR image. To build from source
instead (e.g. to test an unpushed change or bake a custom `FLIP_SPEED`), layer
the build override — **on your Mac/CI, not a 3B+** (the Vite build is
memory-hungry):

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build split-flap
```

If you must build on a 1 GB Pi 3B+, add swap first:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup && sudo dphys-swapfile swapon
```

Run the **64-bit** Raspberry Pi OS so the standard `arm64` Node image is used.

---

## Operations

```bash
docker compose logs -f                       # follow logs (app + watchtower)
docker compose pull && docker compose up -d  # update now (don't wait for the poll)
curl http://<pi-ip>:8080/api/version         # which build is running
docker compose down                          # stop (keeps the data volume)
docker compose down -v                       # stop AND wipe persisted state
```

The persisted state lives in the `split-flap-data` volume and survives
`down`/`up` and image updates — only `down -v` clears it.

---

## API

Full endpoint reference is in [CLAUDE.md](CLAUDE.md#api-endpoints). Common ones
(replace host/port to match your `HOST_PORT`):

```bash
curl -X POST http://<pi-ip>:8080/api/mode/qlock        # word clock
curl -X POST http://<pi-ip>:8080/api/mode/flip         # split-flap board
curl -X POST http://<pi-ip>:8080/api/qlock/language/ar # Arabic word clock
curl -X POST http://<pi-ip>:8080/api/message \
  -H 'Content-Type: application/json' \
  -d '{"lines":["HELLO WORLD"],"align":"center"}'
curl http://<pi-ip>:8080/api/health                    # liveness probe
```

### Rotating info screens

In Info Split-Flap mode the board rotates through up to **6 pushable screens**
(15s each) in the top rows, with the date/time line pinned to the bottom. Any
process on any machine can publish to a slot (`1`–`6`); a slot's content expires
**15 minutes** after its last push and drops out of the rotation. The setup
screen (`/setup`) shows a live, view-only preview of all 6 slots.

```bash
# Push to slot 3 (up to 7 lines; uppercased, padded to 24 chars)
curl -X POST http://<pi-ip>:8080/api/screens/3 \
  -H 'Content-Type: application/json' \
  -d '{"lines":["SERVER A","CPU 42%","MEM 71%"],"align":"center"}'

curl http://<pi-ip>:8080/api/screens                   # inspect all slots + TTLs
curl -X DELETE http://<pi-ip>:8080/api/screens/3       # clear one slot
```

---

## Local development (without Docker)

Runs the client and server as two processes (Vite on :3000 proxies `/api` and
the WebSocket to the server on :3001):

```bash
./start.sh        # starts both; ./stop.sh / ./status.sh to manage
```

See [CLAUDE.md](CLAUDE.md) for the full developer guide, architecture, and the
DigitalOcean App Platform deployment path.
