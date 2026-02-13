---
name: express-websocket-server
description: Express route patterns, WebSocket broadcasting, state management, and API conventions for the Split-Flap server. Use when creating or modifying API endpoints, WebSocket logic, or server configuration.
---

# Express/WebSocket Server Patterns

## Route File Structure

Routes live in `server/src/routes/`. The main route file is `messages.js`:

```javascript
import express from 'express';
import { state, broadcast } from '../index.js';

const router = express.Router();

const ROWS = 8;
const COLS = 24;

router.post('/message', (req, res) => {
  const { lines } = req.body;
  if (!lines || !Array.isArray(lines)) {
    return res.status(400).json({ error: 'lines array is required' });
  }

  // Format and pad lines
  const formatted = Array(ROWS).fill('').map((_, i) => {
    const line = (lines[i] || '').toUpperCase();
    const padded = line.length < COLS
      ? ' '.repeat(Math.floor((COLS - line.length) / 2)) + line
      : line;
    return padded.padEnd(COLS, ' ').slice(0, COLS);
  });

  state.currentMessage = { lines: formatted };
  broadcast({ type: 'message', data: state.currentMessage });
  res.json({ success: true, lines: formatted });
});

export default router;
```

## Server State

All state is in-memory in `server/src/index.js`:

```javascript
export const state = {
  currentMessage: { lines: Array(8).fill(''.padEnd(24, ' ')) },
  clients: new Set(),        // WebSocket connections
  clockInterval: null,       // Clock timer
  clockTimeout: null,        // Clock alignment timeout
  soundEnabled: true,
  theme: 'dark'
};
```

## WebSocket Broadcasting

Every state change must be broadcast to all connected clients:

```javascript
import { state, broadcast } from '../index.js';

// After updating state:
broadcast({ type: 'message', data: state.currentMessage });
broadcast({ type: 'settings', data: { soundEnabled: state.soundEnabled, theme: state.theme } });
```

Message types:
- `message` — board content (lines array)
- `settings` — sound/theme configuration

## Adding a New Route

1. Add the route handler in `server/src/routes/messages.js`
2. If it changes displayed state, call `broadcast()` after updating `state`
3. If it adds a new setting, include it in the `settings` WebSocket message
4. Update CLAUDE.md API endpoint tables

## Adding a New API Endpoint File

1. Create `server/src/routes/newroute.js` following the pattern above
2. Import in `server/src/index.js`: `import newRouter from './routes/newroute.js';`
3. Register: `app.use('/api', newRouter);`

## CORS Configuration

```javascript
const envOrigins = process.env.ALLOWED_ORIGINS;
const corsOrigins = envOrigins
  ? envOrigins.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001'];
```

Production uses `ALLOWED_ORIGINS` env var set to `${_self.PUBLIC_URL}` in `.do/app.yaml`.

## Board Dimensions

ROWS (8) and COLS (24) are defined in:
- `server/src/index.js` — initial state
- `server/src/routes/messages.js` — formatting logic
- `client/src/App.jsx` — React constants
- `client/src/styles/flip.css` — CSS width calculation

**All four must stay in sync.**

## Clock Feature

The clock uses a two-phase approach:
1. `setTimeout` to align to the next minute boundary
2. `setInterval(60000)` for subsequent updates

Always clear both `clockTimeout` and `clockInterval` before starting a new clock.
