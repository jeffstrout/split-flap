# Split-Flap Display

A retro split-flap display web application with real-time updates via WebSocket.

## Architecture

- **Client**: React + Vite (port 3000)
- **Server**: Node.js + Express + WebSocket (port 3001)
- **Deployment**: DigitalOcean App Platform

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

## Configuration

Board dimensions are defined in three places (keep in sync):
- `client/src/App.jsx` - ROWS, COLS constants
- `server/src/routes/messages.js` - ROWS, COLS constants
- `server/src/index.js` - initial state padEnd value
- `client/src/styles/flip.css` - width calc divisor

Current: 24 columns x 8 rows

## Kiosk Mode

```bash
# macOS
open -a "Google Chrome" --args --kiosk http://localhost:3000

# Windows
chrome.exe --kiosk http://localhost:3000
```

## Key Files

- `client/src/components/FlipChar.jsx` - Individual character flip animation
- `client/src/components/FlipBoard.jsx` - Board container + audio synthesis
- `client/src/styles/flip.css` - Styling, dimensions, and theme support
- `server/src/routes/messages.js` - API endpoints, clock logic, sound/theme control
- `server/src/index.js` - Express server, WebSocket setup, CORS config
- `.do/app.yaml` - DigitalOcean App Platform deployment spec
- `start.sh` / `stop.sh` / `status.sh` - Local development scripts
