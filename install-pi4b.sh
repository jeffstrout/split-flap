#!/usr/bin/env bash
# =============================================================================
# Split-Flap — one-shot installer for a freshly imaged Raspberry Pi 4B
# Target OS: Raspberry Pi OS Lite (64-bit).  Run as the `pi` user (NOT root):
#
#     bash install-pi4b.sh
#
# What it does, unattended, then reboots into the wall display:
#   1. verifies 64-bit OS
#   2. installs Docker + compose
#   3. writes ~/split-flap/{docker-compose.yml,.env}   (no repo clone needed —
#      the GHCR image is public)
#   4. pulls the image and starts the container + Watchtower auto-updater
#   5. installs the Chromium/cage kiosk on the HDMI console (tty1)
#
# Safe to re-run. The final reboot launches the fullscreen board automatically.
# =============================================================================
set -euo pipefail

########################  EDIT THESE IF YOU LIKE  ############################
TZ_NAME="America/Chicago"      # IANA timezone for the clock
HOST_PORT="8080"               # port you open in a browser
DEFAULT_MODE="qlock"           # boot mode: qlock (word clock) | flip
DEFAULT_QLOCK_LANG="en"        # word-clock language: en | ar
#############################################################################

APPDIR="$HOME/split-flap"
export DEBIAN_FRONTEND=noninteractive

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# ---- preflight -------------------------------------------------------------
[ "$(id -u)" -ne 0 ] || die "Run as the 'pi' user, not root (don't prefix with sudo)."
command -v sudo  >/dev/null || die "sudo not found — is this Raspberry Pi OS?"
command -v curl  >/dev/null || { sudo apt-get update -y && sudo apt-get install -y curl; }
ARCH="$(uname -m)"
[ "$ARCH" = "aarch64" ] || die "OS is $ARCH, not 64-bit. Reflash 'Raspberry Pi OS Lite (64-bit)'."

# ---- base OS ---------------------------------------------------------------
log "Updating base OS packages (this can take a few minutes)"
sudo apt-get update -y
sudo apt-get full-upgrade -y

# ---- Docker ----------------------------------------------------------------
if ! command -v docker >/dev/null; then
  log "Installing Docker + compose plugin"
  curl -sSL https://get.docker.com | sh
else
  log "Docker already installed — skipping"
fi
sudo usermod -aG docker "$USER" || true      # takes effect after the final reboot
sudo systemctl enable --now docker

# ---- app config (written inline; image is public on GHCR) ------------------
log "Writing compose file + .env to $APPDIR"
mkdir -p "$APPDIR"

cat > "$APPDIR/docker-compose.yml" <<'YAML'
services:
  split-flap:
    image: ghcr.io/jeffstrout/split-flap:${IMAGE_TAG:-latest}
    container_name: split-flap
    restart: unless-stopped
    labels:
      com.centurylinklabs.watchtower.enable: "true"
    ports:
      - "${HOST_PORT:-8080}:3001"
    environment:
      TZ: ${TZ:-UTC}
      DEFAULT_MODE: ${DEFAULT_MODE:-qlock}
      DEFAULT_QLOCK_LANG: ${DEFAULT_QLOCK_LANG:-en}
      PERSIST_FILE: ${PERSIST_FILE:-/data/.state.json}
    volumes:
      - split-flap-data:/data

  watchtower:
    image: containrrr/watchtower
    container_name: split-flap-watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      DOCKER_API_VERSION: ${DOCKER_API_VERSION:-1.40}
      WATCHTOWER_POLL_INTERVAL: ${WATCHTOWER_POLL_INTERVAL:-1200}
      WATCHTOWER_LABEL_ENABLE: "true"
      WATCHTOWER_CLEANUP: "true"

volumes:
  split-flap-data:
YAML

cat > "$APPDIR/.env" <<ENV
HOST_PORT=$HOST_PORT
IMAGE_TAG=latest
WATCHTOWER_POLL_INTERVAL=1200
DOCKER_API_VERSION=1.40
TZ=$TZ_NAME
DEFAULT_MODE=$DEFAULT_MODE
DEFAULT_QLOCK_LANG=$DEFAULT_QLOCK_LANG
PERSIST_FILE=/data/.state.json
ENV

# ---- pull + run (sudo because the docker group isn't active until reboot) ---
log "Pulling image and starting the container (first pull ~1-3 min)"
( cd "$APPDIR" && sudo docker compose pull && sudo docker compose up -d )

log "Waiting for the server to answer /api/health"
ok=""
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$HOST_PORT/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
if [ "$ok" = 1 ]; then log "Server is up."; else
  echo "WARN: health check didn't pass yet — check 'cd $APPDIR && sudo docker compose logs'"
fi

# ---- kiosk (Chromium via cage on the HDMI console) -------------------------
log "Installing kiosk packages (cage + chromium)"
sudo apt-get install -y cage chromium || sudo apt-get install -y cage chromium-browser
CHROMIUM="$(command -v chromium || command -v chromium-browser || true)"
[ -n "$CHROMIUM" ] || die "chromium not found after install."

log "Enabling console auto-login on the HDMI tty"
sudo raspi-config nonint do_boot_behaviour B2

log "Installing the kiosk launcher in ~/.bash_profile"
MARKER="# >>> split-flap kiosk >>>"
if grep -qF "$MARKER" "$HOME/.bash_profile" 2>/dev/null; then
  log "Kiosk launcher already present — leaving it as-is"
else
  cat >> "$HOME/.bash_profile" <<EOF
$MARKER
# On the HDMI console (tty1) only: wait for the server, then open the board.
# Pi 4B keeps GPU acceleration ON (no --disable-gpu; that's a 3B+ workaround).
if [ "\$(tty)" = "/dev/tty1" ]; then
  until curl -sf http://localhost:$HOST_PORT/api/health >/dev/null 2>&1; do sleep 2; done
  exec cage -- $CHROMIUM --kiosk --ozone-platform=wayland \\
    --noerrdialogs --disable-infobars --incognito --test-type \\
    http://localhost:$HOST_PORT >"\$HOME/cage.log" 2>&1
fi
# <<< split-flap kiosk <<<
EOF
fi

log "All set. Configure at:  http://$(hostname).local:$HOST_PORT/setup"
log "Rebooting into the kiosk in 5 seconds…  (Ctrl-C to cancel)"
sleep 5
sudo reboot
