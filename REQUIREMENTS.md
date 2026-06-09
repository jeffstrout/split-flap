# Split-Flap Display — Requirements Document

**Status:** Draft · **Version:** 0.1 · **Last updated:** 2026-06-09

A retro split-flap (Solari board) web application that renders text on a grid of
animated character tiles and updates all connected displays in real time over
WebSocket. This document captures the **current, implemented** requirements
(verified against the codebase) and the **planned** requirements that scope
future work.

Requirement IDs are stable references for issues, PRs, and commits:
`FR-*` functional, `NFR-*` non-functional, `DR-*` deployment/ops. A `(Planned)`
tag marks requirements that are not yet implemented.

---

## 1. Overview

### 1.1 Purpose

Provide a self-hosted, visually faithful split-flap display that can be driven
by a simple HTTP API and shown full-screen (kiosk) on any browser. Typical uses:
lobby/announcement boards, a desk clock, status/notice displays.

### 1.2 Scope

- A **server** (Node.js + Express + WebSocket) that owns the canonical board
  state and exposes a control API.
- A **client** (React + Vite) that renders the board, animates flips, plays an
  optional mechanical tick sound, and supports light/dark themes.
- Single-board, single-tenant: there is one shared board state; every connected
  client sees the same content. There are no user accounts.

### 1.3 Actors

| Actor | Description |
|-------|-------------|
| **Operator** | Drives the board via the HTTP API (curl, script, integration). |
| **Viewer** | Watches a rendered display (browser/kiosk). Read-only. |
| **System** | The clock feature, which updates the board autonomously. |

### 1.4 Architecture summary

- **Client:** React + Vite, dev port `3000`.
- **Server:** Node.js + Express + `ws`, port `3001` (configurable via `PORT`).
- **Transport:** REST for control, WebSocket for push to displays.
- **State:** In-memory on the server (not persisted).
- **Deploy target:** DigitalOcean App Platform (see §6).

---

## 2. Functional Requirements — Board & Messages

### FR-1 Board dimensions
The board is a fixed grid of **8 rows × 24 columns**. Every broadcast line is
exactly 24 characters, padded with spaces; the board always has 8 lines.

### FR-2 Display a message
`POST /api/message` with `{ "lines": ["LINE 1", "LINE 2", ...] }` sets the board
content and pushes it to all connected displays.
- Each line is uppercased.
- Each line is truncated to 24 characters and right-padded with spaces.
- Missing rows (fewer than 8 supplied) render as blank lines.

### FR-3 Read current message
`GET /api/message` returns the current board state (`{ lines: [...] }`).

### FR-4 Clear the board
`DELETE /api/message` resets all 8 rows to blanks and broadcasts the cleared
state.

### FR-5 Character set
The flip animation cycles, in order, through:
`«space» A–Z 0–9 . , ! ? - : ' " / ( ) @ # $ % & * +`
Characters outside this set render as a space.

### FR-6 Centering helper (clock)
The clock feature horizontally centers each generated line within the 24-column
width. (General message centering for arbitrary `POST` content is **not**
currently performed — callers pre-space their own lines. See FR-22 Planned.)

### FR-7 Board status
`GET /api/status` returns `{ connectedClients, boardDimensions: { rows, cols } }`.

---

## 3. Functional Requirements — Clock

### FR-8 One-shot time display
`GET /api/test` renders the current day, date, year, and 12-hour time (with
AM/PM) to the board once.

### FR-9 Start clock
`POST /api/clock/start` displays the time immediately, then aligns to the wall
clock and refreshes **every minute on the minute**. Starting the clock while it
is already running restarts it cleanly (no duplicate timers).

### FR-10 Stop clock
`POST /api/clock/stop` cancels the pending alignment timeout and the recurring
interval.

---

## 4. Functional Requirements — Settings (Sound & Theme)

### FR-11 Sound state
- `GET /api/sound` returns `{ soundEnabled }`.
- `POST /api/sound/on` / `POST /api/sound/off` toggle the mechanical tick sound.
- Sound is **enabled by default**.
- The client synthesizes the tick locally (Web Audio); the server only
  broadcasts the on/off setting.

### FR-12 Theme state
- `GET /api/theme` returns `{ theme }` (`"dark"` or `"light"`).
- `POST /api/theme/dark` → black background, white text.
- `POST /api/theme/light` → white background, black text.
- Theme is **dark by default**.

### FR-13 Settings broadcast
Any sound or theme change is pushed to all connected clients as a `settings`
WebSocket message.

---

## 5. Functional Requirements — Real-Time Transport & Client

### FR-14 WebSocket protocol
The server pushes two message types to clients:
- `message` — `{ type, data: { lines: [...8 lines of 24 chars...] } }`
- `settings` — `{ type, data: { soundEnabled, theme } }`

On connect, the server immediately sends the current `message` **and** the
current `settings` to the new client.

### FR-15 WebSocket URL auto-detection (client)
The client derives the WebSocket URL at runtime — no build-time config:
- **Dev:** `ws://localhost:3001`
- **Production:** `wss://<host>/api` (routed through the platform)

### FR-16 Auto-reconnect (client)
The client transparently reconnects if the WebSocket drops.
*Current behavior:* fixed retry every 3 seconds, indefinitely.
See NFR-7 (Planned) for backoff.

### FR-17 Flip animation
Each character tile animates through the FR-5 character sequence from its
current glyph to its target glyph, producing the split-flap effect. An optional
tick sound plays per flip when sound is enabled.

### FR-18 Kiosk display
The client must render correctly full-screen for unattended kiosk use
(e.g. Chrome `--kiosk http://localhost:3000`).

---

## 6. Deployment & Operations Requirements

### DR-1 Platform
Deploy to **DigitalOcean App Platform** using `.do/app.yaml`:
- `api` — Node.js service, route `/api`, source `server/`, `basic-xxs` ($5/mo).
- `split-flap-frontend` — static site, route `/`, built from `client/dist/`,
  `catchall_document: index.html`.

### DR-2 Manual deploys
`deploy_on_push: false` for both components. Deploys are explicit
(`doctl apps create-deployment <app-id>`), not automatic on push to `main`.

### DR-3 Environment variables
| Variable | Component | Purpose | Default |
|----------|-----------|---------|---------|
| `PORT` | Server | HTTP/WS port | `3001` |
| `ALLOWED_ORIGINS` | Server | Comma-separated CORS allow-list | `localhost:3000,3001`; in prod set to the app's public URL |

### DR-4 CORS
The server restricts cross-origin requests to `ALLOWED_ORIGINS` (with
credentials), defaulting to the local dev origins.

### DR-5 Production WebSocket routing *(Planned — verify)*
Confirm `wss://<host>/api` works end-to-end through App Platform routing before
first production launch. (Tracked by issue #3.)

### DR-6 Local dev scripts
`start.sh`, `stop.sh`, `status.sh` manage both services locally; the Vite dev
server proxies `/api` → `localhost:3001`.

---

## 7. Non-Functional Requirements

### NFR-1 Performance
Flip animation and WebSocket updates should feel instantaneous on a typical
display. A message broadcast should reach all connected clients within ~100 ms
on a LAN.

### NFR-2 Concurrency
The server supports multiple simultaneous viewers; all see identical state.
Disconnected clients are removed from the broadcast set on `close`/`error`.

### NFR-3 Resilience
WebSocket `error` events must not crash the server; the offending client is
dropped from the set. The client must survive server restarts via FR-16.

### NFR-4 Statelessness / persistence
Board state is intentionally **in-memory**; a server restart resets the board to
blank. Persistence is out of scope for v1 (see NFR-8 Planned).

### NFR-5 Browser support
Modern evergreen browsers (Chrome/Edge/Safari/Firefox) with Web Audio and
WebSocket support.

### NFR-6 Maintainability — single source of dimensions *(Planned)*
ROWS/COLS (currently `8 × 24`) are duplicated across four files
(`client/src/App.jsx`, `server/src/routes/messages.js`, `server/src/index.js`,
`client/src/styles/flip.css`). These should be consolidated to a single shared
constant to prevent drift.

### NFR-7 Reconnect backoff *(Planned)*
Replace the fixed 3 s reconnect (FR-16) with exponential backoff and a cap.

### NFR-8 Optional message persistence *(Planned)*
Optionally persist the last message so it survives a server restart.

---

## 8. Planned Functional Requirements (Backlog)

These are scoped but **not yet implemented**.

### FR-19 Input validation *(Planned)*
Validate `POST /api/message`: `lines` must be an array of strings, enforce
length limits, and reject malformed payloads with a clear `400`. *(Today only
the presence of an array is checked.)*

### FR-20 UI controls for sound & theme *(Planned)*
Add on-screen toggles for sound and theme (currently API-only).

### FR-21 Health endpoint *(Planned)*
`GET /api/health` returning a lightweight liveness/readiness payload for
deployment monitoring.

### FR-22 General message centering *(Planned)*
Optionally auto-center arbitrary `POST /api/message` content (parity with the
clock's centering), or expose an explicit `align` option.

---

## 9. API Reference (Summary)

| Method | Endpoint | Requirement | Description |
|--------|----------|-------------|-------------|
| POST | `/api/message` | FR-2 | Set board content |
| GET | `/api/message` | FR-3 | Get current content |
| DELETE | `/api/message` | FR-4 | Clear the board |
| GET | `/api/status` | FR-7 | Client count + dimensions |
| GET | `/api/test` | FR-8 | One-shot time display |
| POST | `/api/clock/start` | FR-9 | Start minute clock |
| POST | `/api/clock/stop` | FR-10 | Stop clock |
| GET | `/api/sound` | FR-11 | Get sound state |
| POST | `/api/sound/on` \| `/off` | FR-11 | Toggle sound |
| GET | `/api/theme` | FR-12 | Get theme |
| POST | `/api/theme/dark` \| `/light` | FR-12 | Set theme |
| GET | `/api/health` | FR-21 *(Planned)* | Liveness/readiness |

**Message format**

```json
{ "lines": ["LINE 1", "LINE 2", "LINE 3"] }
```

Lines are uppercased and truncated/padded to 24 chars; up to 8 rows.

---

## 10. Out of Scope (v1)

- User accounts, authentication, or per-user boards.
- Multiple independent boards / multi-tenancy.
- Rich content (images, color per tile, fonts beyond the configured one).
- Historical message log or scheduling/queueing of messages.

---

## 11. Open Questions

1. Should production lock down the control API (auth/token), or is network-level
   restriction sufficient for the intended deployment?
2. Is general message centering (FR-22) desired by default, or opt-in per
   request?
3. Target maximum number of concurrent kiosk displays to design/verify against?

---

## 12. Traceability — Requirements ↔ TODO

| TODO (CLAUDE.md) | Requirement |
|------------------|-------------|
| Input validation for message lines | FR-19 |
| Exponential backoff for reconnect | NFR-7 |
| Extract shared ROWS/COLS constants | NFR-6 |
| UI controls for sound/theme | FR-20 |
| Health/status endpoint | FR-21 |
| Message persistence (optional) | NFR-8 |
| Create DO app / verify prod WebSocket | DR-1, DR-5 (issue #3) |
