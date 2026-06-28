# syntax=docker/dockerfile:1
#
# Single-container build for the Split-Flap display. Express serves the REST
# API, the WebSocket, AND the built React client all on one port — so the whole
# app runs as one container on a Raspberry Pi (or any Docker host).
#
# Build this image on a capable machine (your Mac or CI), NOT on the Pi 3B+ —
# the Vite build is memory-hungry. The Pi only runs the slim final image.
# node:20-bookworm-slim is multi-arch (arm64 + armhf + amd64), so the same
# Dockerfile produces a Pi-native image.

# ── Stage 1: build the React client ────────────────────────────────────────
FROM node:20-bookworm-slim AS client-build
WORKDIR /build

# Flip-animation speed multiplier baked into the client bundle at build time
# (1 = original, 2 = default/2x; lower is gentler on a Pi 3B+). Set via the
# Docker `.env` FLIP_SPEED -> compose build arg.
ARG VITE_FLIP_SPEED=2
ENV VITE_FLIP_SPEED=$VITE_FLIP_SPEED

# Install client deps first (cached unless the lockfile changes).
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# The client imports the shared board dimensions from the server package at
# build time (Vite "@board" alias → ../server/src/config.js), so that file must
# be present at the sibling path before `vite build`.
COPY client ./client
COPY server/src/config.js ./server/src/config.js
RUN cd client && npm run build      # → /build/client/dist

# ── Stage 2: runtime — server serves API + WebSocket + static client ────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Build provenance baked into the image so the running app can report which
# version it is (GET /api/version, shown on /setup). CI passes these on every
# push to main; they default to "dev"/"unknown" for local builds.
ARG GIT_SHA=dev
ARG BUILD_TIME=unknown
ENV APP_COMMIT=$GIT_SHA
ENV APP_BUILD_TIME=$BUILD_TIME
# Standard OCI labels (also used by docker/metadata-action in CI).
LABEL org.opencontainers.image.source="https://github.com/jeffstrout/split-flap" \
      org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.created="$BUILD_TIME"

# tzdata so the info-screen clock can honor a local timezone via the TZ env var
# (the slim base image only knows UTC). Set TZ in docker-compose / .env.
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Local timezone for the clock; override via docker-compose / .env (e.g.
# TZ=America/Chicago). Defaults to UTC.
ENV TZ=UTC
# Tells the server to serve the built client from this path (single container).
ENV CLIENT_DIST=/app/client/dist
# Persist message + settings on the mounted /data volume (survives restarts).
ENV PERSIST_FILE=/data/.state.json
# One port serves the UI, the REST API, and the WebSocket.
ENV PORT=3001

# Server production deps only.
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server
COPY --from=client-build /build/client/dist ./client/dist

VOLUME ["/data"]
EXPOSE 3001

WORKDIR /app/server
CMD ["node", "src/index.js"]
