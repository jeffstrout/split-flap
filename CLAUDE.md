# Split-Flap Display

A retro split-flap display web application with real-time updates via WebSocket.

## Architecture

- **Client**: React + Vite (port 3000)
- **Server**: Node.js + Express + WebSocket (port 3001)
- **Deployment**: DigitalOcean App Platform
- **Font**: Google Fonts — Roboto Condensed 700 (loaded in `client/index.html`)

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

Lines are automatically uppercased and centered. Max 24 characters per line, 8 rows.

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

### `settings` — Sound and theme

```json
{
  "type": "settings",
  "data": {
    "soundEnabled": true,
    "theme": "dark"
  }
}
```

Sent on connect and whenever sound or theme changes.

## Configuration

Board dimensions are defined in four places (keep in sync):
- `client/src/App.jsx` - ROWS, COLS constants
- `server/src/routes/messages.js` - ROWS, COLS constants
- `server/src/index.js` - initial state padEnd value
- `client/src/styles/flip.css` - width calc divisor (`24` in the width calculation)

Current: 24 columns x 8 rows

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
- `client/src/App.jsx` - Root component, WebSocket state management
- `client/src/components/FlipBoard.jsx` - Board container + audio synthesis
- `client/src/components/FlipRow.jsx` - Row of characters, maps text to FlipChar
- `client/src/components/FlipChar.jsx` - Individual character flip animation
- `client/src/hooks/useWebSocket.js` - Auto-reconnecting WebSocket hook
- `client/src/styles/flip.css` - Styling, dimensions, animations, theme support

### Server

- `server/src/index.js` - Express server, WebSocket setup, CORS config, state
- `server/src/routes/messages.js` - API endpoints, clock logic, sound/theme control

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
- [ ] Add input validation for message lines (check array element types, length limits)
- [ ] Add exponential backoff to WebSocket reconnect (currently retries every 3s forever)
- [ ] Extract shared ROWS/COLS constants to avoid duplication across 4 files
- [ ] Add `React.memo` to FlipChar to prevent unnecessary re-renders

### Features
- [ ] Add UI controls for sound/theme toggle (currently API-only)
- [ ] Add a health/status endpoint (`GET /api/health`) for deployment monitoring
- [ ] Consider message persistence (optional — currently in-memory only)

### DevOps
- [x] Set up GitHub Actions for automated PR review (`pr-claude-code-review.yml`)
- [x] Add GitHub Issue templates (`ai-task.yml`)
- [x] Add GitHub labels (`ai-ready`, `ai-in-progress`, `ai-review`, `ai-failed`, `needs-clarification`)
- [ ] Add `ANTHROPIC_API_KEY` as GitHub repo secret (required for PR review workflow)
- [ ] Test `start.sh` / `stop.sh` / `status.sh` on a clean machine
