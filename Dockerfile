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

ENV NODE_ENV=production
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
