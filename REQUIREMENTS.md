# Split-Flap Display — Requirements Document

**Status:** Draft · **Version:** 0.4 · **Last updated:** 2026-06-09

A retro split-flap (Solari board) web application that renders text on a grid of
animated character tiles and updates all connected displays in real time over
WebSocket. As of v0.2 the application is a **two-mode wall display**: a
**split-flap** board and a **QLOCKTWO-style word clock**, intended to run
full-screen on a wall-mounted monitor.

This document captures the **current, implemented** requirements (verified
against the codebase) and the **planned** requirements that scope future work.

Requirement IDs are stable references for issues, PRs, and commits:
`FR-*` functional, `NFR-*` non-functional, `DR-*` deployment/ops. A `(Planned)`
tag marks requirements that are not yet implemented.

### Changelog
- **0.4** — Added the setup/config screen at `/setup` with a unified
  display-mode picker and consolidated `GET /api/settings`; state persistence is
  now on by default (FR-39, NFR-8).
- **0.3** — QLOCKTWO is now multilingual: added an Arabic (MSA) word
  clock with RTL rendering and a server-owned language setting (FR-38).
- **0.2** — Added two display modes (split-flap + QLOCKTWO word clock, §6–§7)
  and wall-mounted monitor / kiosk requirements (§8). Mode is server-owned and
  switched via the API; the word clock reads each display's local time and runs
  silently.
- **0.1** — Initial requirements for the split-flap display.

---

## 1. Overview

### 1.1 Purpose

Provide a self-hosted, visually faithful wall display that can be driven by a
simple HTTP API and shown full-screen (kiosk) on any browser. It serves two
purposes from one screen:
- an **announcement / message board** (split-flap), and
- an ambient **word clock** (QLOCKTWO style).

### 1.2 Scope

- A **server** (Node.js + Express + WebSocket) that owns the canonical display
  state — message content, settings, and the active **mode** — and exposes a
  control API.
- A **client** (React + Vite) that renders the active mode full-screen:
  - **split-flap** board with flip animation, optional tick sound, themes;
  - **QLOCKTWO** word clock that lights words in a letter matrix.
- Single-display, single-tenant: there is one shared global state (content,
  settings, mode); every connected client renders the same thing. There are no
  user accounts.

### 1.3 Actors

| Actor | Description |
|-------|-------------|
| **Operator** | Drives the display via the HTTP API (curl, script, integration): sets messages, switches modes, toggles settings. |
| **Viewer** | Watches a rendered display (browser/kiosk). Read-only. |
| **System** | Autonomous behavior: the split-flap clock feature, and the QLOCKTWO word clock that advances each minute. |

### 1.4 Architecture summary

- **Client:** React + Vite, dev port `3000`. Renders `<FlipBoard>` or
  `<QlockTwo>` based on the active mode.
- **Server:** Node.js + Express + `ws`, port `3001` (configurable via `PORT`).
- **Transport:** REST for control, WebSocket for push to displays.
- **State:** In-memory on the server (message, settings, mode). Not persisted.
- **Deploy target:** DigitalOcean App Platform (see §9).

---

## 2. Functional Requirements — Board & Messages (split-flap mode)

### FR-1 Board dimensions
The split-flap board is a fixed grid of **8 rows × 24 columns**. Every broadcast
line is exactly 24 characters, padded with spaces; the board always has 8 lines.

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
The split-flap clock feature horizontally centers each generated line within the
24-column width. (General message centering for arbitrary `POST` content is
**not** currently performed — callers pre-space their own lines. See FR-22.)

### FR-7 Board status
`GET /api/status` returns `{ connectedClients, boardDimensions: { rows, cols } }`.

---

## 3. Functional Requirements — Split-Flap Clock

### FR-8 One-shot time display
`GET /api/test` renders the current day, date, year, and 12-hour time (with
AM/PM) to the split-flap board once.

### FR-9 Start clock
`POST /api/clock/start` displays the time immediately, then aligns to the wall
clock and refreshes **every minute on the minute**. Starting the clock while it
is already running restarts it cleanly (no duplicate timers).

### FR-10 Stop clock
`POST /api/clock/stop` cancels the pending alignment timeout and the recurring
interval.

> The split-flap clock (FR-8–FR-10) and the QLOCKTWO word clock (§7) are
> distinct features. The split-flap clock writes text to the board; QLOCKTWO is
> a separate visual mode.

---

## 4. Functional Requirements — Settings (Sound & Theme)

### FR-11 Sound state
- `GET /api/sound` returns `{ soundEnabled }`.
- `POST /api/sound/on` / `POST /api/sound/off` toggle the mechanical tick sound.
- Sound is **enabled by default**.
- The client synthesizes the tick locally (Web Audio); the server only
  broadcasts the on/off setting. Sound applies to split-flap mode only (see
  FR-34: QLOCKTWO is silent).

### FR-12 Theme state
- `GET /api/theme` returns `{ theme }` (`"dark"` or `"light"`).
- `POST /api/theme/dark` → black background, white text/letters.
- `POST /api/theme/light` → white background, black text/letters.
- Theme is **dark by default** and applies to **both** modes.

### FR-13 Settings broadcast
Any sound, theme, or **mode** change is pushed to all connected clients as a
`settings` WebSocket message (see FR-14, FR-23).

---

## 5. Functional Requirements — Real-Time Transport & Client

### FR-14 WebSocket protocol
The server pushes two message types to clients:
- `message` — `{ type, data: { lines: [...8 lines of 24 chars...] } }`
- `settings` — `{ type, data: { soundEnabled, theme, mode } }`

On connect, the server immediately sends the current `message` **and** the
current `settings` (including `mode`) to the new client.

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
(e.g. Chrome `--kiosk http://localhost:3000`). See §8 for wall-mount
requirements.

---

## 6. Functional Requirements — Display Modes *(Planned)*

### FR-23 Mode concept
The display operates in exactly one of two modes at a time:
- `flip` — the split-flap board (§2–§5).
- `qlock` — the QLOCKTWO word clock (§7).

Mode is **server-owned global state**, broadcast to all clients in the
`settings` message (FR-14) alongside `soundEnabled` and `theme`. All connected
displays switch together.

### FR-24 Mode API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/mode` | Returns `{ mode }` (`"flip"` or `"qlock"`). |
| `POST` | `/api/mode/flip` | Switch all displays to split-flap. |
| `POST` | `/api/mode/qlock` | Switch all displays to the word clock. |

Each successful change broadcasts the updated `settings`.

### FR-25 Default mode & switching
- The boot/default mode is configurable via the `DEFAULT_MODE` env var
  (`flip` | `qlock`); default **`qlock`** (the wall display's resting state is
  the clock).
- In v1, mode is switched **via the API only** — no on-screen toggle, schedule,
  or automatic switching.
- Mode is in-memory and resets to `DEFAULT_MODE` on server restart (consistent
  with NFR-4).

### FR-26 Mode / content independence
Switching to `qlock` does **not** clear the split-flap message; switching back to
`flip` restores the last message. The server retains `currentMessage`
independent of the active mode.

### FR-39 Setup / configuration screen
A configuration page is served at **`/setup`** (the base URL + `setup`); the live
display remains at `/`. The setup screen:
- Presents a single **display mode** picker with three options — **English Word
  Clock** (`mode=qlock`,`lang=en`), **Arabic Word Clock** (`mode=qlock`,
  `lang=ar`), **Info Split Flap** (`mode=flip`) — composing the existing `mode` +
  `qlockLanguage` settings; selecting one applies to all displays immediately.
- Offers theme (dark/light) and flip-sound (on/off) toggles.
- Hydrates from current server state on load via the consolidated
  `GET /api/settings` (`{ mode, qlockLanguage, theme, soundEnabled }`) and stays
  in sync via the `settings` WebSocket broadcast.

---

## 7. Functional Requirements — QLOCKTWO Word-Clock Mode *(Planned)*

A word clock that displays the time in natural language by illuminating words
within a fixed letter matrix (e.g. **IT IS HALF PAST TEN**), in the style of the
QLOCKTWO Classic (English).

### FR-27 Letter matrix
A fixed **11 columns × 10 rows** (110-cell) grid of letters. The full grid is
always visible; words are highlighted to tell the time. Canonical English
layout (filler letters, shown lowercase here, are **never illuminated**; their
exact glyphs are cosmetic):

```
Row  Cols 1–11        Words formed
 1   I T (l) I S a s A M P M     IT · IS · AM · PM
 2   A (c) Q U A R T E R (d c)   A · QUARTER
 3   T W E N T Y F I V E (x)     TWENTY · FIVE
 4   H A L F (s) T E N (f) T O   HALF · TEN · TO
 5   P A S T (e r u) N I N E     PAST · NINE
 6   O N E (s) S I X T H R E E   ONE · SIX · THREE
 7   F O U R F I V E T W O       FOUR · FIVE · TWO
 8   E I G H T E L E V E N       EIGHT · ELEVEN
 9   S E V E N T W E L V E       SEVEN · TWELVE
10   T E N (s e) O' C L O C K    TEN · O'CLOCK
```

Hour words present: ONE…TWELVE. Minute words: FIVE, TEN, QUARTER, TWENTY, HALF,
plus connectors PAST / TO and prefix IT IS.

### FR-28 Time phrasing (5-minute resolution)
Time is shown to the nearest 5-minute bucket (`m5 = floor(minute / 5) * 5`):

| Bucket | Phrase | Hour used |
|--------|--------|-----------|
| :00 | IT IS [hour] O'CLOCK | current |
| :05 | IT IS FIVE PAST [hour] | current |
| :10 | IT IS TEN PAST [hour] | current |
| :15 | IT IS A QUARTER PAST [hour] | current |
| :20 | IT IS TWENTY PAST [hour] | current |
| :25 | IT IS TWENTY FIVE PAST [hour] | current |
| :30 | IT IS HALF PAST [hour] | current |
| :35 | IT IS TWENTY FIVE TO [next hour] | next |
| :40 | IT IS TWENTY TO [next hour] | next |
| :45 | IT IS A QUARTER TO [next hour] | next |
| :50 | IT IS TEN TO [next hour] | next |
| :55 | IT IS FIVE TO [next hour] | next |

### FR-29 Hour selection
Hours use 12-hour names (TWELVE for 0/12). For all **TO** buckets (:35–:55) the
displayed hour is the **next** hour, wrapping 12 → 1.

### FR-30 Corner dots
Four dots, one in each corner of the matrix, indicate the minutes between
5-minute buckets: light `minute % 5` of them (0–4 dots).

### FR-31 "IT IS" prefix
`IT IS` is illuminated **at all times** by default. *(Option to show it only on
the hour and half-hour — the QLOCKTWO factory default — is deferred; see Open
Questions §14.)*

### FR-32 Update cadence
The word clock recomputes and re-renders **every minute, aligned to the minute
boundary**, and also renders correctly immediately on mount and on mode switch.

### FR-33 Time source (local clock)
Each display computes the time from **its own local system clock** — there is no
server tick for QLOCKTWO. All displays in the same timezone show identical
output. (Multi-timezone or perfectly-synced displays would require a
server-driven variant; out of scope for v1 — see §13, §14.)

### FR-34 Rendering, theme & sound
- All 110 letters are always rendered; **active** letters are bright/lit while
  **inactive** letters are dimmed (not hidden), mimicking the QLOCKTWO surface.
- Respects the global theme (FR-12): dark = dim grey letters on black with lit
  white words; light = the inverse.
- QLOCKTWO mode is **silent** — the flip tick (FR-11) does not play in this mode.
- Word changes may use a subtle fade transition (cosmetic; not required for v1).

### FR-38 Word-clock language (English / Arabic)
The QLOCKTWO language is server-owned global state (`en` | `ar`), broadcast in
`settings` alongside `mode`/`theme`. Each language is a pack (letter matrix +
phrasing rules); the client renders the active pack and applies `dir`/font.
- `GET /api/qlock/language` → `{ qlockLanguage }`
- `POST /api/qlock/language/en` · `POST /api/qlock/language/ar`
- Boot default via `DEFAULT_QLOCK_LANG` env (default `en`).
- **Arabic** uses Modern Standard Arabic, fraction-based phrasing
  (ربع/ثلث/نصف with و/إلا) and right-to-left rendering.

---

## 8. Functional Requirements — Wall-Mounted Monitor / Kiosk *(Planned)*

The primary deployment is a browser running full-screen on a wall-mounted
monitor.

### FR-35 Full-screen responsive scaling
Both modes scale to fit the monitor viewport while preserving aspect ratio and
centering content:
- split-flap (wide, 24×8) scales to fit width without clipping;
- QLOCKTWO (near-square, 11×10) scales to fit and is centered, letterboxed on
  wide (16:9) monitors.
No horizontal/vertical scrollbars; no clipped tiles or letters.

### FR-36 Unattended operation
The display launches full-screen in a browser kiosk on boot and runs
indefinitely without interaction. It recovers automatically from server or
network interruptions via the reconnect behavior (FR-16) and re-syncs state
(message, settings, mode) on reconnect.

### FR-37 Display hygiene
For unattended wall use the display must: hide the mouse cursor, and prevent the
OS screensaver / monitor sleep while running. (Configured at the
kiosk/OS level; the app should not itself trigger sleep.)

---

## 9. Deployment & Operations Requirements

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
| `DEFAULT_MODE` | Server | Boot mode (`flip` \| `qlock`) | `qlock` *(Planned, FR-25)* |
| `DEFAULT_QLOCK_LANG` | Server | Boot word-clock language (`en` \| `ar`) | `en` *(FR-38)* |
| `PERSIST_FILE` | Server | State file path; `off` disables | `server/.state.json` *(NFR-8)* |

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

## 10. Non-Functional Requirements

### NFR-1 Performance
Flip animation and WebSocket updates should feel instantaneous on a typical
display. A message or mode broadcast should reach all connected clients within
~100 ms on a LAN.

### NFR-2 Concurrency
The server supports multiple simultaneous viewers; all see identical state.
Disconnected clients are removed from the broadcast set on `close`/`error`.

### NFR-3 Resilience
WebSocket `error` events must not crash the server; the offending client is
dropped from the set. The client must survive server restarts via FR-16.

### NFR-4 Statelessness / persistence
Display state (message, settings, mode) is intentionally **in-memory**; a server
restart resets to defaults **unless** persistence is enabled (NFR-8, on by
default), which restores the last message and settings.

### NFR-5 Browser support
Modern evergreen browsers (Chrome/Edge/Safari/Firefox) with Web Audio and
WebSocket support.

### NFR-6 Maintainability — single source of dimensions *(Planned)*
Split-flap ROWS/COLS (`8 × 24`) are duplicated across four files
(`client/src/App.jsx`, `server/src/routes/messages.js`, `server/src/index.js`,
`client/src/styles/flip.css`). These should be consolidated to a single shared
constant. The QLOCKTWO matrix (FR-27) should likewise live in one shared module.

### NFR-7 Reconnect backoff *(Planned)*
Replace the fixed 3 s reconnect (FR-16) with exponential backoff and a cap.

### NFR-8 State persistence (on by default)
The last message and the mode/language/theme/sound settings are persisted to
`server/.state.json` and restored on boot, so the display returns in the mode it
was last set to. Override the path with `PERSIST_FILE`, or disable with
`PERSIST_FILE=off`.

### NFR-9 Burn-in mitigation *(Planned)*
QLOCKTWO is static for a full minute, risking image retention on OLED/plasma
panels. Mitigate via subtle periodic pixel-shift of the matrix, a brightness
cap, and/or favoring the dark theme. Required only for burn-in-prone panels.

### NFR-10 Resolution & aspect-ratio independence
Layout must adapt to common monitor resolutions and orientations (16:9
landscape primary) without clipping content in either mode (see FR-35).

---

## 11. Planned Functional Requirements (Backlog)

These are scoped but **not yet implemented** and are not part of the two-mode
feature above.

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
split-flap clock's centering), or expose an explicit `align` option.

---

## 12. API Reference (Summary)

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
| GET | `/api/mode` | FR-24 *(Planned)* | Get current mode |
| POST | `/api/mode/flip` \| `/qlock` | FR-24 *(Planned)* | Switch display mode |
| GET | `/api/qlock/language` | FR-38 | Get word-clock language |
| POST | `/api/qlock/language/en` \| `/ar` | FR-38 | Set word-clock language |
| GET | `/api/settings` | FR-39 | Consolidated current settings |
| GET | `/api/health` | FR-21 *(Planned)* | Liveness/readiness |

**Message format**

```json
{ "lines": ["LINE 1", "LINE 2", "LINE 3"] }
```

Lines are uppercased and truncated/padded to 24 chars; up to 8 rows.

---

## 13. Out of Scope (v1)

- User accounts, authentication, or per-user displays.
- Multiple independent displays / multi-tenancy; **per-display mode** (mode is
  a single global setting in v1).
- Multi-timezone or sub-second-synchronized word clocks (QLOCKTWO uses each
  display's local clock — FR-33).
- On-screen / scheduled / automatic mode switching (API-only in v1 — FR-25).
- Additional QLOCKTWO languages beyond English and Arabic (FR-38).
- Rich content (images, per-tile color, fonts beyond the configured one),
  historical message log, or message scheduling/queueing.

---

## 14. Open Questions

1. **Boot default mode** — default is `DEFAULT_MODE=qlock` (resting clock).
   Confirm, or prefer `flip`?
2. **"IT IS" behavior** — always lit (current FR-31 default) vs only on the hour
   and half-hour (QLOCKTWO factory default)? Worth a settings toggle?
3. **Burn-in** — what panel type is the wall monitor (LCD vs OLED)? Determines
   whether NFR-9 mitigation is needed.
4. **API security** — should the control API require auth/token in production, or
   is network-level restriction sufficient?
5. **Multi-timezone** — will displays ever span timezones (which would push
   QLOCKTWO to a server-driven time source)?
6. **General message centering** (FR-22) — default on, or opt-in per request?
7. **Target concurrent displays** — how many simultaneous kiosks to design and
   verify against?

---

## 15. Traceability — Requirements ↔ Work Items

| Work item | Requirement(s) |
|-----------|----------------|
| **QLOCKTWO word-clock wall display (this revision)** | FR-23–FR-37, NFR-9, NFR-10, DR-3 (`DEFAULT_MODE`) |
| Input validation for message lines | FR-19 |
| Exponential backoff for reconnect | NFR-7 |
| Extract shared ROWS/COLS (+ QLOCKTWO matrix) constants | NFR-6 |
| UI controls for sound/theme | FR-20 |
| Health/status endpoint | FR-21 |
| Message persistence (optional) | NFR-8 |
| Create DO app / verify prod WebSocket | DR-1, DR-5 (issue #3) |
