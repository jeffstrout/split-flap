# Raspberry Pi Setup (3B+ / 4B / 5)

A step-by-step runbook to turn a fresh Raspberry Pi OS install into the
Split-Flap wall display: the Pi runs the Docker container **and** drives the
HDMI monitor in Chromium kiosk mode. Works on a **Pi 3B+, 4B, or 5** — the steps
are the same; where a step differs by model (kiosk GPU flags, build swap) it's
called out.

> For the Docker architecture and config reference, see [README.md](README.md).
> For kiosk/display tuning, see [KIOSK.md](KIOSK.md).

## Quick install (Pi 4B, one script)

On a **Pi 4B** running **Raspberry Pi OS Lite (64-bit)**, [`install-pi4b.sh`](install-pi4b.sh)
does the whole runbook below unattended — updates the OS, installs Docker, pulls
the (public) GHCR image, starts the container + Watchtower, sets up the
Chromium/cage kiosk, and reboots into the board. No repo clone or GitHub token
needed; the Pi only needs internet access. Run it as the `pi` user:

```bash
curl -fsSL https://gist.githubusercontent.com/jeffstrout/be50eefa386d272ec5225a5d70268e1f/raw/install-pi4b.sh | bash
```

That pulls the script from a public gist, so nothing has to be copied from
another machine. To change the defaults, download it first and edit the three
variables at the top (`TZ_NAME`, `HOST_PORT`, `DEFAULT_MODE`) before running — or just accept them and adjust later at
`/setup`:

```bash
curl -fsSL https://gist.githubusercontent.com/jeffstrout/be50eefa386d272ec5225a5d70268e1f/raw/install-pi4b.sh -o install-pi4b.sh
nano install-pi4b.sh   # edit the vars at the top
bash install-pi4b.sh
```

The script is idempotent — safe to re-run. Prefer the manual steps below for a
3B+/5, for building locally, or to understand what each step does.

> **Trade-off:** the script writes its own `docker-compose.yml` instead of
> cloning, so a Pi built this way has no `.git` and can never `git pull`. It will
> keep running (Watchtower still updates the *image*), but it will never receive
> a **compose** change — a new port, a new env var, a new service — without hand
> editing. If you expect to track this repo, use the manual clone in step 3, or
> convert afterwards with
> [Repairing a non-git install](#repairing-a-non-git-install).

> The gist is a standalone copy of `install-pi4b.sh` in this repo; if the script
> here changes, update the gist too (`gh gist edit be50eefa386d272ec5225a5d70268e1f install-pi4b.sh`).

---

## 0. Use the 64-bit OS

Run 64-bit Raspberry Pi OS on any model — it's required for the `arm64` image
(and on the 1 GB 3B+ it also runs more reliably than 32-bit). Confirm:

```bash
uname -m      # aarch64 = 64-bit (good).  armv7l = 32-bit (re-flash recommended)
```

If `armv7l`, re-flash with **Raspberry Pi Imager → "Raspberry Pi OS (64-bit)"**.
In Imager's settings (gear icon), pre-set the hostname (e.g. `splitflap`), enable
SSH, and add your Wi-Fi — it makes the rest headless. Then update:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

---

## 1. Install Docker + Compose

```bash
curl -sSL https://get.docker.com | sh          # Docker + compose plugin
sudo usermod -aG docker $USER                  # run docker without sudo
sudo reboot                                    # apply the group membership
```

Verify after the reboot:

```bash
docker run --rm hello-world
docker compose version
```

---

## 2. Add swap for the build (optional)

**You can skip this.** The Pi now **pulls a prebuilt image** from GHCR and never
builds from source, so no extra swap is needed for normal setup. Only do this if
you intend to build the image *on the Pi* (see step 4) — the Vite build needs
more than 1 GB of headroom:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
free -h                                         # confirm ~1 GB swap is active
```

(You can set it back to `100` and re-run these commands after building.)

---

## 3. Get the code onto the Pi

The repo is **public** — a plain clone, no token, no GitHub auth on the Pi:

```bash
git clone https://github.com/jeffstrout/split-flap.git
cd split-flap
```

**Clone it; don't copy it.** The Pi pulls its *image* from GHCR, so the checkout
exists only to supply `docker-compose.yml` — but that is exactly what future
changes arrive in. A Pi set up by `rsync` or by the quick-install script has no
`.git`, so `git pull` fails and it silently never receives a compose change
again. That is how one display kept publishing the old port after the fleet
moved to 80. To convert such a Pi, see
[Repairing a non-git install](#repairing-a-non-git-install).

### Repairing a non-git install

If `git pull` says `not a git repository`, this Pi was built by the quick-install
script (or an old `rsync`). Convert it in place — the named volume is keyed to
the directory name, so keeping the path as `~/split-flap` preserves the display's
persisted mode/theme/message:

```bash
cd ~/split-flap && docker compose down && cp .env /tmp/split-flap.env.bak && cd ~ \
  && git clone https://github.com/jeffstrout/split-flap.git ~/split-flap-git \
  && mv ~/split-flap ~/split-flap-generated.bak && mv ~/split-flap-git ~/split-flap \
  && cp /tmp/split-flap.env.bak ~/split-flap/.env \
  && cd ~/split-flap && docker compose pull && docker compose up -d
```

Check `docker volume ls | grep split-flap` before and after: the name must be
unchanged (`split-flap_split-flap-data`). A second volume means the project name
changed and the display will come back with default settings.

---

## 4. Pull and run

```bash
cp .env.example .env                            # optional — defaults are fine
docker compose pull && docker compose up -d     # pulls the image; quick on a 3B+
```

This also starts **Watchtower**, which auto-updates the display whenever a new
image is published (every ~20 min). Check it:

```bash
docker compose logs -f        # Ctrl-C to stop following
curl http://localhost/api/health
curl http://localhost/api/version          # which build is running
```

From any device on the network, open **`http://splitflap.local`** (or
`http://<pi-ip>`) — the `.local` name is the Pi's own hostname, so it only works
if you named the host `splitflap`; check with `hostnamectl` and configure mode/theme/sound at **`/setup`** (the
running build shows at the bottom). Your choice persists across reboots and
updates.

> **Building on the Pi instead?** Do step 2 (swap) first, then:
> `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build split-flap`
> (slow on a 3B+, ~10–20 min). Prefer building on a Mac/CI.

### Tuning

- **Pi 4B / 5**: no tuning needed — they run the full-board animation
  GPU-accelerated at the default speed. (Make sure the kiosk keeps GPU on; see
  step 5c.)
- **Word-clock modes** (`qlock`) have no flip animation and run smoothly on any Pi.
- **Pi 3B+ only**: if **split-flap** full-board changes feel janky, slow the
  animation to `FLIP_SPEED=1`. This is baked in at build time, so it requires a
  local build (see the note above); the published image is fixed at `3`.

---

## 5. Make the Pi the display (Chromium kiosk on HDMI)

Raspberry Pi OS **Lite** has no desktop or browser, which is ideal for a kiosk —
nothing wasted on a full desktop. We add a minimal fullscreen browser with
**cage** (a tiny Wayland kiosk compositor) launched from a console auto-login.
This setup is verified on a 3B+ and a 4B; no keyboard or mouse is needed.

> **Desktop image instead of Lite?** If `chromium` is already installed and you
> have a desktop session, you can skip cage and drop a
> `~/.config/autostart/*.desktop` entry instead — but the Lite + cage path below
> is lighter and is what these instructions assume.

**a) Install cage + Chromium:**

```bash
sudo apt update
sudo apt install -y cage chromium
ls /usr/bin/chromium*        # note the binary name (usually /usr/bin/chromium)
```

**b) Auto-login the HDMI console as `pi` on boot** (no keyboard needed):

```bash
sudo raspi-config nonint do_boot_behaviour B2   # B2 = Console Autologin
```

**c) Launch the kiosk from that console login.** Append this to `~/.bash_profile`
so it runs only on the physical console (tty1). The block below is for a **Pi 4B
or 5**, which keep GPU acceleration on (their VideoCore VI drives Chromium's GL
ES under Wayland, giving smoother animation). **On a Pi 3B+**, add
`--disable-gpu --disable-gpu-compositing` to the `exec` line — its older
VideoCore IV can't do hardware GL under Wayland and will black-screen otherwise,
so it must render in software (fine for this mostly-CSS board).

The `until` line waits for the container's web server before launching the
browser — important on a cold boot, where Docker + Node take 10–30 s to come up
and Chromium would otherwise land on a "can't reach this page" error and not
retry:

```bash
cat >> ~/.bash_profile <<'EOF'
# Split-Flap kiosk: on the HDMI console (tty1) only, run the board fullscreen
if [ "$(tty)" = "/dev/tty1" ]; then
  # Wait for the container's web server so a cold boot doesn't land on an error page
  until curl -sf http://localhost/api/health >/dev/null 2>&1; do sleep 2; done
  # Clear a stale Chromium profile lock (see "If the screen is black" below)
  rm -f "$HOME/.config/chromium/Singleton"* 2>/dev/null
  # Pi 3B+: add --disable-gpu --disable-gpu-compositing before --test-type
  exec cage -- chromium --kiosk --ozone-platform=wayland \
    --noerrdialogs --disable-infobars --incognito --test-type \
    http://localhost >/home/pi/cage.log 2>&1
fi
EOF

sudo reboot
```

> If `ls` in step (a) showed the binary is `chromium-browser` rather than
> `chromium`, use that name in the `exec` line instead.

On boot the Pi auto-logs into the console, the container auto-starts
(`restart: unless-stopped`), the launcher waits for the server, then cage opens
Chromium fullscreen on the HDMI display. If cage exits, the login re-runs and
relaunches it automatically. Chromium's output (GPU/Wayland messages) goes to
`~/cage.log` for debugging.

### Power-loss recovery

The display is fully unattended: pull the power and reapply it, and the Pi boots,
Docker auto-starts the container (`restart: unless-stopped`), the console
auto-logs in, and the kiosk waits for the server and opens the board — no
keyboard or manual step. Confirm Docker is set to start at boot once:

```bash
systemctl is-enabled docker        # should print "enabled"
```

The surest test is to actually power-cycle it and watch it come back to the board.

### If the screen is black but SSH works

Almost always a stale **Chromium profile lock**. Chromium writes the machine's
hostname into `~/.config/chromium/Singleton*` and refuses to start if the lock
names a different host — so **renaming the Pi** guarantees this, and an unclean
power cut can cause it too:

```
The profile appears to be in use by another Chromium process (1630)
on another computer (OfficeDisplay).
```

It fails hard rather than degrading, because the launcher uses `exec`: Chromium
dying takes the login shell with it, so getty respawns, fails again, and gives up
at its restart limit. `systemctl status getty@tty1` shows
`failed (Result: start-limit-hit)` and nothing renders.

Diagnose with the tail of `~/cage.log`, then:

```bash
rm -f ~/.config/chromium/Singleton* && sudo systemctl reset-failed getty@tty1.service && sudo systemctl restart getty@tty1.service
```

The `rm` line in the autostart block above prevents a recurrence; a Pi set up
before that line existed needs it added by hand. Ignore any
`EGL_BAD_PARAMETER` lines in `cage.log` — those are normal on a Pi and appear
even on a healthy boot.

> **Renaming the Pi** (`hostnamectl set-hostname`) also needs `/etc/hosts`
> updated in the same pass, or every `sudo` prints `unable to resolve host`:
>
> ```bash
> sudo hostnamectl set-hostname NEWNAME && sudo sed -i "s/^127\.0\.1\.1.*/127.0.1.1\tNEWNAME/" /etc/hosts
> ```
>
> Clear the Chromium lock afterwards, then reboot.

---

## Day-to-day operations

```bash
cd ~/split-flap
docker compose logs -f                       # view logs (app + watchtower)
docker compose restart                       # restart the app
docker compose pull && docker compose up -d  # update now (don't wait for the poll)
docker compose down                          # stop (keeps saved settings)
docker compose down -v                       # stop AND wipe persisted settings
```

New images install themselves via Watchtower; the `pull && up -d` line just
forces it immediately. Persisted settings live in the `split-flap-data` Docker
volume and survive reboots and updates — only `down -v` clears them.

> **After an update, reload the kiosk to pick up client-side changes.** An image
> update swaps the server + the browser bundle, and the display's WebSocket
> reconnects — so **data** (screens, mode, theme) refreshes immediately. But the
> Chromium kiosk keeps running the **page it already loaded**, so changes to the
> client **code** (e.g. the flip animation, the `/setup` UI) don't appear until
> the page reloads. Force a reload with a reboot, or just relaunch the kiosk:
>
> ```bash
> sudo systemctl restart getty@tty1   # relaunches cage + Chromium (no full reboot)
> # or: sudo reboot
> ```
>
> Tip: `curl -s http://localhost/api/version` reports the *served* build; if
> the display looks unchanged after it advances, the kiosk just needs a reload.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build killed / out-of-memory | Only when building on the Pi: confirm swap is active (`free -h`); redo step 2. Or just pull the prebuilt image |
| Display didn't auto-update | Check `docker compose logs watchtower`; force it with `docker compose pull && docker compose up -d`; confirm the running build at `/api/version` |
| `/api/version` shows the new build but the display's animation/UI looks unchanged | The kiosk is still showing the pre-update page — client code only reloads when the page does. `sudo systemctl restart getty@tty1` (or `sudo reboot`) |
| Watchtower logs `client version 1.25 is too old. Minimum supported API version is 1.40` | Docker API mismatch — ensure `DOCKER_API_VERSION` is set on the `watchtower` service (it is in the current `docker-compose.yml`); `git pull` then `docker compose up -d` to recreate it |
| `docker: permission denied` | You skipped the reboot in step 1 (`usermod -aG docker`) |
| Page unreachable from another device | Use the Pi's IP; check `docker compose ps` shows it `Up` |
| Animation stutters on full-board changes (3B+) | Build locally with `FLIP_SPEED=1` (see step 4 note). A 4B/5 shouldn't need this |
| Console shows a **login prompt**, not the board | The kiosk session didn't launch — check `cat ~/cage.log` and that step 5b/5c ran; restart with `sudo systemctl restart getty@tty1` |
| Screen is **black** (cursor or blank) with `connectedClients: 1` | Chromium's GPU process is crashing. **3B+**: make sure `--disable-gpu --disable-gpu-compositing` are in the `~/.bash_profile` launch line. **4B/5**: unusual — check `~/cage.log` for `eglCreateContext`/GL errors and, if the GPU path is at fault, add `--disable-gpu` as a fallback |
| `chromium`/`cage` not found | `sudo apt install -y cage chromium`; match the binary name in `~/.bash_profile` |
