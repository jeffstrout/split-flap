# Wall-Mounted Kiosk Guide

How to run the display full-screen on a wall-mounted monitor (FR-35–FR-37).

## Launch full-screen

```bash
# macOS
open -a "Google Chrome" --args --kiosk --app=http://<host>:3000

# Linux (Chromium)
chromium-browser --kiosk --app=http://<host>:3000 \
  --noerrdialogs --disable-infobars --incognito
```

The app already:
- fills the viewport and scales each mode to fit (no scrollbars, no clipping);
- hides the mouse cursor (`cursor: none`);
- requests a **Screen Wake Lock** to keep the monitor awake while visible;
- auto-reconnects to the server and re-syncs state (message, settings, mode).

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
curl -X POST http://<host>:3000/api/mode/qlock   # word clock
curl -X POST http://<host>:3000/api/mode/flip    # split-flap board
```
