# Split-Flap Display

A retro split-flap display web application with real-time updates via WebSocket.

## Architecture

- **Client**: React + Vite (port 3000)
- **Server**: Node.js + Express + WebSocket (port 3001)
- **Deployment**: DigitalOcean App Platform
- **Font**: Google Fonts — Roboto Condensed 700 (loaded in `client/index.html`)

## Display Modes & Setup

The display runs in one of three user-facing modes, settable from the setup
screen or the API. Each composes the server's `mode` + `qlockLanguage` settings:

| Mode | `mode` | `qlockLanguage` |
|------|--------|-----------------|
| English Word Clock | `qlock` | `en` |
| Arabic Word Clock (RTL) | `qlock` | `ar` |
| Info Split Flap | `flip` | — |

- In **Info Split Flap** mode the bottom row shows the day/month/date
  (left-justified) and the 24-hour `HH:MM:SS` time (right-justified),
  refreshing every 5 seconds with seconds shown on 5-second increments
  (`00, 05, 10, …`). It runs automatically while in flip mode; a
  custom `POST /api/message` shows until the next tick, and starting the legacy
  minute clock (`/api/clock/start`) takes over.
- **Display**: `/` — the live wall display (kiosk).
- **Setup**: `/setup` (e.g. `http://localhost:3000/setup`) — pick the mode,
  theme, and flip sound. Changes apply to all displays instantly via WebSocket
  and are persisted across restarts (see Persistence below).

## Running the Application

```bash
# Quick start (both services)
./start.sh

# Stop
./stop.sh

# Check status
./status.sh
```

### Manual Start

```bash
# Terminal 1 - Start server
cd server && npm install && npm start

# Terminal 2 - Start client
cd client && npm install && npm run dev
```

## Git Workflow

Branch protection is enforced — edits are blocked on the `main` branch.

```bash
# Always work on a feature branch
git checkout -b feature/my-change

# After changes, commit and push
git add <files>
git commit -m "Description of change"
git push -u origin feature/my-change

# Create PR via GitHub
gh pr create --title "My change" --body "Description"
```

## Deployment

### DigitalOcean App Platform

Configuration is in `.do/app.yaml`. Manual deploys only (`deploy_on_push: false`).

| Component | Type | Route | Source |
|-----------|------|-------|--------|
| `api` | Node.js service | `/api` | `server/` |
| `split-flap-frontend` | Static site | `/` | `client/dist/` |

```bash
# Deploy (requires doctl CLI)
doctl apps create-deployment <app-id>

# View logs
doctl apps logs <app-id> api --type run
```

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `PORT` | Server | HTTP port (default: 3001) |
| `ALLOWED_ORIGINS` | Server | CORS origins (default: localhost:3000,3001) |
| `DEFAULT_MODE` | Server | Boot mode `flip`\|`qlock` (default: `qlock`) |
| `DEFAULT_QLOCK_LANG` | Server | Boot word-clock language `en`\|`ar` (default: `en`) |
| `PERSIST_FILE` | Server | State file path. On by default (`server/.state.json`); set to `off` to disable |

### WebSocket in Production

The client auto-detects the WebSocket URL:
- **Dev**: `ws://localhost:3001` (direct connection)
- **Production**: `wss://<host>/api` (routed through DO App Platform)

No configuration needed — derived from `window.location` at runtime.

## API Endpoints

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/message` | Send message to board |
| `DELETE` | `/api/message` | Clear the board |
| `GET` | `/api/message` | Get current message |
| `GET` | `/api/status` | Check connection status |

### Clock

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/test` | Display current date/time (one-time) |
| `POST` | `/api/clock/start` | Start clock (updates every minute on the minute) |
| `POST` | `/api/clock/stop` | Stop the clock |

### Sound

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sound` | Get current sound status |
| `POST` | `/api/sound/on` | Enable flip sound |
| `POST` | `/api/sound/off` | Disable flip sound |

Sound is **enabled by default**. The mechanical tick sound plays automatically when characters flip.

### Theme

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/theme` | Get current theme |
| `POST` | `/api/theme/dark` | Set dark theme (black background, white text) |
| `POST` | `/api/theme/light` | Set light theme (white background, black text) |

Theme is **dark by default**.

### Mode

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/mode` | Get current display mode |
| `POST` | `/api/mode/flip` | Switch all displays to the split-flap board |
| `POST` | `/api/mode/qlock` | Switch all displays to the QLOCKTWO word clock |

### Word-clock language

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/qlock/language` | Get word-clock language |
| `POST` | `/api/qlock/language/en` | English word clock |
| `POST` | `/api/qlock/language/ar` | Arabic word clock (RTL) |

### Settings & health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Consolidated `{ mode, qlockLanguage, theme, soundEnabled }` (used by `/setup`) |
| `GET` | `/api/health` | Liveness/readiness probe `{ status, uptime, connectedClients, mode }` |

### Message Format

```json
{
  "lines": [
    "LINE 1",
    "LINE 2",
    "LINE 3"
  ]
}
```

Lines are uppercased and truncated/padded to 24 chars (max 8 rows). Pass `"align": "center"` to center each line; default is left-aligned.

## WebSocket Protocol

The server pushes state to all connected clients via WebSocket. Two message types:

### `message` — Board content

```json
{
  "type": "message",
  "data": {
    "lines": [
      "        HELLO WORLD     ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        "
    ]
  }
}
```

Each line is exactly 24 characters, padded with spaces. Always 8 lines.

### `settings` — Sound, theme, mode, language

```json
{
  "type": "settings",
  "data": {
    "soundEnabled": true,
    "theme": "dark",
    "mode": "qlock",
    "qlockLanguage": "en"
  }
}
```

Sent on connect and whenever sound, theme, mode, or word-clock language changes.

## Configuration

Board dimensions have a single source of truth: `server/src/config.js`
(`ROWS`, `COLS` = 8 x 24). The client imports it at build time via the Vite
`@board` alias (inlined into the bundle); CSS reads `--board-rows`/`--board-cols`
set from it in `main.jsx`. The QLOCKTWO letter matrices live in
`client/src/qlock/lang/{en,ar}.js`.

### Persistence

State (last message + mode/language/theme/sound) is persisted **on by default**
to `server/.state.json` and restored on boot, so the display returns in the mode
it was last set to. Override the path with `PERSIST_FILE=<path>`, or disable with
`PERSIST_FILE=off`. (`server/src/persistence.js`)

### Supported Characters

The flip animation cycles through this character set in order:

```
 ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-:'"/()@#$%&*+
```

(Space, then A-Z, 0-9, and punctuation.) Unsupported characters are displayed as spaces.

## Kiosk Mode

```bash
# macOS
open -a "Google Chrome" --args --kiosk http://localhost:3000

# Windows
chrome.exe --kiosk http://localhost:3000
```

## Key Files

### Client

- `client/index.html` - HTML shell, Google Fonts (Roboto Condensed 700)
- `client/vite.config.js` - Vite config with dev proxy (`/api` → localhost:3001)
- `client/src/main.jsx` - React entry point
- `client/src/App.jsx` - Path router (`/` display, `/setup` config)
- `client/src/Display.jsx` - Live display: WebSocket state + active-mode render
- `client/src/Setup.jsx` - Setup/config screen (mode, theme, sound)
- `client/src/components/QlockTwo.jsx` - QLOCKTWO word clock (EN/AR, RTL)
- `client/src/components/Controls.jsx` - On-screen sound/theme controls
- `client/src/qlock/` - Word-clock matrices (`lang/en.js`, `lang/ar.js`) + `timeToWords.js`
- `client/src/components/FlipBoard.jsx` - Board container + audio synthesis
- `client/src/components/FlipRow.jsx` - Row of characters, maps text to FlipChar
- `client/src/components/FlipChar.jsx` - Individual character flip animation
- `client/src/components/flipTiming.js` - Flip animation timing (single source; 2x speed)
- `client/src/hooks/useWebSocket.js` - Auto-reconnecting WebSocket hook
- `client/src/styles/flip.css` - Styling, dimensions, animations, theme support

### Server

- `server/src/index.js` - Express server, WebSocket setup, CORS, state, persistence wiring
- `server/src/routes/messages.js` - API endpoints (message, clock, sound, theme, mode, language, settings, health)
- `server/src/config.js` - Single source of truth for board dimensions
- `server/src/persistence.js` - State persistence (on by default)

### Config & DevOps

- `.do/app.yaml` - DigitalOcean App Platform deployment spec
- `.gitignore` - Git ignore rules (node_modules, dist, logs, .env, IDE files)
- `.mcp.json` - GitHub MCP server config for Claude Code
- `start.sh` / `stop.sh` / `status.sh` - Local development scripts

## Claude Code

### Slash Commands

| Command | Description |
|---------|-------------|
| `/deploy` | Deploy main branch to DigitalOcean with pre-flight checks |
| `/onboard` | Deep exploration of a task before implementation |
| `/ticket` | End-to-end GitHub Issue workflow (read → branch → implement → PR) |
| `/pr-review` | Review a PR against project standards |

### Agents

| Agent | Model | Description |
|-------|-------|-------------|
| `code-reviewer` | opus | Review checklist for Node/Express, React, CSS, WebSocket |
| `github-workflow` | sonnet | Branch naming, commit format, PR conventions |

### Skills

| Skill | Description |
|-------|-------------|
| `express-websocket-server` | Server route patterns, WebSocket broadcasting, state management |
| `react-flipboard-client` | Component hierarchy, flip animation, audio synthesis, theming |

### GitHub Integration

- **PR review workflow**: `.github/workflows/pr-claude-code-review.yml` — auto-reviews PRs using Claude (requires `ANTHROPIC_API_KEY` repo secret)
- **Issue template**: `.github/ISSUE_TEMPLATE/ai-task.yml` — structured template for AI tasks
- **Labels**: `ai-ready`, `ai-in-progress`, `ai-review`, `ai-failed`, `needs-clarification`
- **Briefing doc**: `.claude/docs/autonomous-workflow-briefing.md`

### Branch Protection

Edits on `main` are blocked by a PreToolUse hook. Always work on a feature branch.

## TODO

### Infrastructure (before first deploy)
- [ ] Create DigitalOcean app: `doctl apps create --spec .do/app.yaml`
- [ ] Record the app ID in `.do/app.yaml` and `/deploy` command
- [ ] Record the production URL in `/deploy` command health check
- [ ] Verify WebSocket works through DO App Platform routing (`wss://<host>/api`)
- [ ] Test full deploy cycle: push to main → `/deploy` → verify in browser

### Code Quality
- [x] Add input validation for message lines (check array element types, length limits)
- [ ] Add exponential backoff to WebSocket reconnect (currently retries every 3s forever)
- [x] Extract shared ROWS/COLS constants (now `server/src/config.js` + `@board` alias)
- [ ] Add `React.memo` to FlipChar to prevent unnecessary re-renders

### Features
- [x] Add UI controls for sound/theme toggle (`Controls.jsx`, plus `/setup`)
- [x] Add a health/status endpoint (`GET /api/health`) for deployment monitoring
- [x] Message + settings persistence (`server/src/persistence.js`, on by default)

### DevOps
- [x] Set up GitHub Actions for automated PR review (`pr-claude-code-review.yml`)
- [x] Add GitHub Issue templates (`ai-task.yml`)
- [x] Add GitHub labels (`ai-ready`, `ai-in-progress`, `ai-review`, `ai-failed`, `needs-clarification`)
- [ ] Add `ANTHROPIC_API_KEY` as GitHub repo secret (required for PR review workflow)
- [ ] Test `start.sh` / `stop.sh` / `status.sh` on a clean machine
