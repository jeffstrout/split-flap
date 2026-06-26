# Wall-Mounted Kiosk Guide

How to run the display full-screen on a wall-mounted monitor (FR-35–FR-37).

> **Port:** the single Docker container serves on **8080** by default
> (`http://<host>:8080`). Local non-Docker dev serves on **3000**. Adjust the
> URLs below to match how you're running it.

## Launch full-screen

```bash
# macOS
open -a "Google Chrome" --args --kiosk --app=http://<host>:8080

# Linux (Chromium)
chromium-browser --kiosk --app=http://<host>:8080 \
  --noerrdialogs --disable-infobars --incognito
```

The app already:
- fills the viewport and scales each mode to fit (no scrollbars, no clipping);
- hides the mouse cursor (`cursor: none`);
- requests a **Screen Wake Lock** to keep the monitor awake while visible;
- auto-reconnects to the server and re-syncs state (message, settings, mode).

## Raspberry Pi (HDMI display)

Run the container (see `README.md`), then point the Pi's own browser at it. The
Pi is both the server and the display.

```bash
# Raspberry Pi OS — Chromium kiosk pointing at the local container.
# The GPU flags matter on the Pi 3B+: they force hardware-accelerated
# compositing for the flip animation instead of slower software rendering.
chromium-browser --kiosk --app=http://localhost:8080 \
  --noerrdialogs --disable-infobars --incognito \
  --enable-gpu-rasterization --ignore-gpu-blocklist \
  --enable-zero-copy --disable-features=Translate
```

Performance notes for the **Pi 3B+** (the display is the bottleneck, not the
server):

- The **word-clock modes** (`qlock`) have no flip animation and run smoothly.
- **Full-board split-flap** transitions animate up to ~192 tiles at once and can
  stutter on the 3B+'s single Cortex-A53; the idle 5-second info-screen ticks
  are light. A **Pi 4B** handles the heavy animation noticeably better.
- `FlipChar` is wrapped in `React.memo` to cut re-renders; flip timing lives in
  `client/src/components/flipTiming.js` if you want to slow the animation back
  down for weaker hardware (rebuild required).
- Run **64-bit Raspberry Pi OS** for the smoothest Chromium + `arm64` image.

## Prevent the OS from sleeping / screensaver

The Wake Lock keeps the *display* awake in a focused Chrome tab, but also
disable OS-level sleep for unattended reliability:

```bash
# macOS — keep awake indefinitely (run under the kiosk session)
caffeinate -dimsu &

# Linux (systemd)
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
# GNOME: disable screen blank + auto-suspend
gsettings set org.gnome.desktop.session idle-delay 0
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'
```

## Auto-start on boot
Add the kiosk launch command to the OS autostart (macOS Login Items /
`launchd`, or a Linux `.desktop` autostart entry / `systemd` user service).

## Switching modes
Mode is API-controlled (all displays switch together):

```bash
curl -X POST http://<host>:8080/api/mode/qlock   # word clock
curl -X POST http://<host>:8080/api/mode/flip    # split-flap board
```

## Burn-in mitigation (OLED/plasma only)
The QLOCKTWO clock is static for a full minute. On burn-in-prone panels,
enable a slow pixel-shift at build time (off by default; not needed for LCD):

```bash
VITE_BURN_IN_SHIFT=true npm run build
```

The matrix then drifts a few pixels on a 5-minute cycle. The dark theme is also
gentler on such panels.

## Persistence (optional)
By default state is in-memory and resets on restart. To persist the last
message and the sound/theme/mode settings across restarts, set a writable path:

```bash
PERSIST_FILE=/var/lib/split-flap/state.json npm start
```

State is saved on a short interval and on shutdown, and restored on boot.
