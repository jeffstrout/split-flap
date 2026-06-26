# Raspberry Pi 3B+ Setup

A step-by-step runbook to turn a fresh Raspberry Pi OS install into the
Split-Flap wall display: the Pi runs the Docker container **and** drives the
HDMI monitor in Chromium kiosk mode.

> For the Docker architecture and config reference, see [README.md](README.md).
> For kiosk/display tuning, see [KIOSK.md](KIOSK.md).

---

## 0. Use the 64-bit OS

The 3B+ has only 1 GB RAM, so 64-bit Raspberry Pi OS builds and runs more
reliably than 32-bit. Confirm:

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

## 2. Add swap for the build

The Vite build needs more than 1 GB of headroom. Bump swap to 1 GB:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
free -h                                         # confirm ~1 GB swap is active
```

(You can set it back to `100` and re-run these commands after the first build.)

---

## 3. Get the code onto the Pi

The repo is **private**, so pick one:

**Option A — clone with a GitHub token** (a fine-grained PAT with read access):

```bash
git clone https://github.com/jeffstrout/split-flap.git
# username: jeffstrout   password: <paste your PAT>
cd split-flap
```

**Option B — copy from your Mac** (no GitHub auth on the Pi). Run on the Mac:

```bash
rsync -av --exclude node_modules --exclude dist --exclude .git \
  "/path/to/Flip Board/" pi@splitflap.local:~/split-flap/
```

Then on the Pi: `cd ~/split-flap`.

---

## 4. Build and run

```bash
cp .env.example .env          # optional — defaults are fine
docker compose up -d --build  # first build is slow on a 3B+ (~10–20 min)
```

Check it:

```bash
docker compose logs -f        # Ctrl-C to stop following
curl http://localhost:8080/api/health
```

From any device on the network, open **`http://splitflap.local:8080`** (or
`http://<pi-ip>:8080`) and configure mode/theme/sound at **`/setup`**. Your
choice persists across reboots.

### Tuning for the 3B+

- **Word-clock modes** (`qlock`) have no flip animation and run smoothly — a good
  default for the 3B+.
- If **split-flap** full-board changes feel janky, slow the animation: set
  `FLIP_SPEED=1` in `.env` (1 = original, 2 = default/2x) and rebuild:
  `docker compose up -d --build`.

---

## 5. Make the Pi the display (Chromium kiosk on HDMI)

**a) Boot to desktop with autologin** and **disable screen blanking**:

```bash
sudo raspi-config
#   System Options  → Boot / Auto Login → "Desktop Autologin"
#   Display Options → Screen Blanking   → "No"
#   Finish → reboot
```

**b) Autostart Chromium in kiosk mode** pointing at the local container:

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/splitflap-kiosk.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=Split-Flap Kiosk
Exec=chromium-browser --kiosk --app=http://localhost:8080 --noerrdialogs --disable-infobars --incognito --enable-gpu-rasterization --ignore-gpu-blocklist --disable-features=Translate --check-for-update-interval=31536000
X-GNOME-Autostart-enabled=true
EOF

sudo reboot
```

(If `chromium-browser` is missing: `sudo apt install -y chromium-browser`.)

On boot the Pi auto-logs in, the container is already running
(`restart: unless-stopped`), and Chromium opens full-screen on the HDMI display.

---

## Day-to-day operations

```bash
cd ~/split-flap
docker compose logs -f          # view logs
docker compose restart          # restart the app
docker compose up -d --build    # rebuild after pulling new code / changing .env
docker compose down             # stop (keeps saved settings)
docker compose down -v          # stop AND wipe persisted settings
```

Persisted settings live in the `split-flap-data` Docker volume and survive
reboots and rebuilds — only `down -v` clears them.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build killed / out-of-memory | Confirm swap is active (`free -h`); redo step 2 |
| `docker: permission denied` | You skipped the reboot in step 1 (`usermod -aG docker`) |
| Page unreachable from another device | Use the Pi's IP; check `docker compose ps` shows it `Up` |
| Animation stutters on full-board changes | Set `FLIP_SPEED=1` in `.env`, rebuild |
| Screen sleeps / goes black | Redo the Screen Blanking step; see [KIOSK.md](KIOSK.md) |
