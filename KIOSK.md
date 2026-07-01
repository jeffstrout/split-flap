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

The Pi is both the server and the display. On **Raspberry Pi OS Lite** (no
desktop) the verified setup is **cage** (a minimal Wayland kiosk compositor) +
Chromium, launched from a console auto-login. Full step-by-step:
[PI-SETUP.md](PI-SETUP.md#5-make-the-pi-the-display-chromium-kiosk-on-hdmi).

```bash
# On the Pi (Raspberry Pi OS Lite):
sudo apt install -y cage chromium

# Pi 4B / 5 — keep GPU acceleration on (VideoCore VI drives Chromium's GL ES
# under Wayland fine, giving smoother flip animation):
cage -- chromium --kiosk --ozone-platform=wayland \
  --noerrdialogs --disable-infobars --incognito --test-type \
  http://localhost:8080

# Pi 3B+ — add --disable-gpu: its older VideoCore IV can't give Chromium a
# working GL ES context under Wayland (hardware GL black-screens), so render in
# software (fine for this mostly-CSS board):
cage -- chromium --kiosk --ozone-platform=wayland \
  --noerrdialogs --disable-infobars --incognito \
  --disable-gpu --disable-gpu-compositing --test-type \
  http://localhost:8080
```

> The boot-time autostart launcher in [PI-SETUP.md](PI-SETUP.md#5-make-the-pi-the-display-chromium-kiosk-on-hdmi)
> wraps this with `until curl -sf .../api/health; do sleep 2; done` so a cold
> boot waits for the container's web server before opening Chromium — otherwise
> the browser can beat the server and land on an error page. (Not needed for the
> manual launch above, where the server is already running.)

> ⚠️ On the **3B+**, don't force the hardware GPU path
> (`--enable-gpu-rasterization --ignore-gpu-blocklist`) — Chromium's GPU process
> crashes and the screen stays black; software rendering (`--disable-gpu`) is
> correct there. On a **4B/5** a black screen is unusual — check `~/cage.log`, and
> if the GPU path is at fault, fall back to `--disable-gpu` as a workaround.

Performance notes by model (rendering is the bottleneck, not the server):

- **Word-clock modes** (`qlock`) have no flip animation and run smoothly on any Pi.
- **Pi 4B / 5** run the full-board split-flap animation GPU-accelerated at the
  default speed — no tuning needed.
- **Pi 3B+** (software-rendered): full-board transitions animate up to ~192 tiles
  at once and can stutter on its single Cortex-A53; the idle info-screen ticks are
  light. `FlipChar` is wrapped in `React.memo` to cut re-renders. If the animation
  feels too busy, **slow the flip down** by building with `FLIP_SPEED=1`
  (1 = original speed, 3 = default/3x) via `docker-compose.build.yml`.
- Run **64-bit Raspberry Pi OS** for the `arm64` image on any model.

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
