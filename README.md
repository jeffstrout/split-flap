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

You need Docker + Docker Compose on the Pi. **Build the image on a capable
machine** (your Mac or CI) and run it on the Pi, or build on the Pi if it has
enough free memory — see [Building on a Pi 3B+](#building-on-a-pi-3b) below.

```bash
git clone https://github.com/jeffstrout/split-flap.git
cd split-flap
cp .env.example .env      # optional — defaults work as-is
docker compose up -d --build
```

Then open **`http://<pi-ip>:8080`** from any browser on your network. The Pi
itself can be the display: plug it into a monitor over HDMI and launch Chromium
in kiosk mode (see [KIOSK.md](KIOSK.md)).

The container has `restart: unless-stopped`, so it comes back automatically after
a reboot or power loss.

---

## Configuration

All optional — copy `.env.example` to `.env` and edit. With no `.env`, the
defaults below apply.

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST_PORT` | `8080` | Host port the display + API are served on |
| `DEFAULT_MODE` | `qlock` | Boot mode: `qlock` (word clock) or `flip` (split-flap) |
| `DEFAULT_QLOCK_LANG` | `en` | Word-clock language: `en` or `ar` (Arabic, RTL) |
| `PERSIST_FILE` | `/data/.state.json` | State file on the volume; `off` to disable |

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
- The client is built with `React.memo` on each tile to minimize re-renders, and
  [KIOSK.md](KIOSK.md) documents the Chromium GPU flags worth setting on the Pi.

### Building on a Pi 3B+

The Vite build is memory-hungry and the 3B+ has 1 GB RAM. Prefer building the
image on your Mac/CI. If you must build on the Pi, add swap first:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup && sudo dphys-swapfile swapon
docker compose up -d --build
```

Run the **64-bit** Raspberry Pi OS so the standard `arm64` Node image is used.

---

## Operations

```bash
docker compose logs -f          # follow logs
docker compose pull             # (if using a registry image)
docker compose up -d --build    # rebuild + restart after pulling changes
docker compose down             # stop (keeps the data volume)
docker compose down -v          # stop AND wipe persisted state
```

The persisted state lives in the `split-flap-data` volume and survives
`down`/`up` and rebuilds — only `down -v` clears it.

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

---

## Local development (without Docker)

Runs the client and server as two processes (Vite on :3000 proxies `/api` and
the WebSocket to the server on :3001):

```bash
./start.sh        # starts both; ./stop.sh / ./status.sh to manage
```

See [CLAUDE.md](CLAUDE.md) for the full developer guide, architecture, and the
DigitalOcean App Platform deployment path.
