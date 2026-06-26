import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import messagesRouter, { startInfoScreen } from './routes/messages.js';
import { ROWS, COLS } from './config.js';
import { loadPersisted, startPersistence } from './persistence.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Default display mode on boot (FR-25). Falls back to 'qlock' for any
// unrecognized value so the wall display rests on the word clock.
const VALID_MODES = ['flip', 'qlock'];
const DEFAULT_MODE = VALID_MODES.includes(process.env.DEFAULT_MODE)
  ? process.env.DEFAULT_MODE
  : 'qlock';

// Default QLOCKTWO language on boot (issue #33).
const VALID_LANGS = ['en', 'ar'];
const DEFAULT_QLOCK_LANG = VALID_LANGS.includes(process.env.DEFAULT_QLOCK_LANG)
  ? process.env.DEFAULT_QLOCK_LANG
  : 'en';

// CORS configuration
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
];

const envOrigins = process.env.ALLOWED_ORIGINS;
const corsOrigins = envOrigins
  ? envOrigins.split(',').map(o => o.trim()).filter(Boolean)
  : defaultOrigins;

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json());

// Store for current message and connected clients
export const state = {
  currentMessage: {
    lines: Array(ROWS).fill(''.padEnd(COLS, ' '))
  },
  clients: new Set(),
  clockInterval: null,
  clockTimeout: null,
  infoInterval: null,
  infoTimeout: null,
  soundEnabled: true,
  theme: 'dark', // 'dark' = black bg/white text, 'light' = white bg/black text
  mode: DEFAULT_MODE, // 'flip' = split-flap board, 'qlock' = QLOCKTWO word clock
  qlockLanguage: DEFAULT_QLOCK_LANG // 'en' | 'ar' — QLOCKTWO word-clock language
};

// Restore persisted state (NFR-8) — overrides defaults when enabled.
const persisted = loadPersisted();
if (persisted) {
  if (persisted.currentMessage?.lines) state.currentMessage = persisted.currentMessage;
  if (VALID_MODES.includes(persisted.mode)) state.mode = persisted.mode;
  if (['dark', 'light'].includes(persisted.theme)) state.theme = persisted.theme;
  if (typeof persisted.soundEnabled === 'boolean') state.soundEnabled = persisted.soundEnabled;
  if (VALID_LANGS.includes(persisted.qlockLanguage)) state.qlockLanguage = persisted.qlockLanguage;
}
startPersistence(state);

// Start the split-flap info screen if booting into flip mode (issue #37).
if (state.mode === 'flip') startInfoScreen();

// Routes
app.use('/api', messagesRouter);

// Serve the built client from a single container (Docker / Raspberry Pi).
// CLIENT_DIST points at the Vite build output; when unset (local dev) Vite
// serves the client on :3000 and this block is skipped. The WebSocket shares
// this same HTTP server/port, so in production the UI, REST API, and WebSocket
// all run on one port.
const clientDist = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : null;
if (clientDist) {
  const indexHtml = path.join(clientDist, 'index.html');
  app.use(express.static(clientDist));
  // SPA fallback: serve index.html for any non-API GET so client-side routes
  // (e.g. /setup) survive a refresh. /api requests fall through to the 404
  // from the router above; WebSocket upgrades bypass Express entirely.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml);
  });
}

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  state.clients.add(ws);

  // Send current state to newly connected client
  ws.send(JSON.stringify({
    type: 'message',
    data: state.currentMessage
  }));
  ws.send(JSON.stringify({
    type: 'settings',
    data: {
      soundEnabled: state.soundEnabled,
      theme: state.theme,
      mode: state.mode,
      qlockLanguage: state.qlockLanguage
    }
  }));

  ws.on('close', () => {
    console.log('Client disconnected');
    state.clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    state.clients.delete(ws);
  });
});

// Broadcast to all connected clients
export function broadcast(data) {
  const message = JSON.stringify(data);
  state.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket available on ws://localhost:${PORT}`);
  console.log(`Default mode: ${state.mode}`);
});
