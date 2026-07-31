import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import messagesRouter, { startInfoScreen, screensPayload } from './routes/messages.js';
import docsRouter from './routes/docs.js';
import { ROWS, COLS } from './config.js';
import { loadPersisted, startPersistence } from './persistence.js';
import { MqttPublisher, isEnabled as mqttEnabled, settings as mqttSettings } from './mqtt.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ESM has no __dirname. Needed to resolve server/static regardless of the cwd
// the process was started from — npm start runs from server/, the Docker image
// runs from /app/server, and a dev might run it from the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default display mode on boot (FR-25). Falls back to 'qlock' for any
// unrecognized value so the wall display rests on the word clock.
const VALID_MODES = ['flip', 'qlock'];
const DEFAULT_MODE = VALID_MODES.includes(process.env.DEFAULT_MODE)
  ? process.env.DEFAULT_MODE
  : 'qlock';

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
  // Rotating info screens (issue #48): up to 6 slots, each
  // { lines: string[7], align, expiresAt } or null. Transient by design
  // (15-min TTL) — not persisted. currentSlot is the slot on screen now.
  screens: Array(6).fill(null),
  currentSlot: null,
  rotateInterval: null,
  soundEnabled: true,
  theme: 'dark', // 'dark' = black bg/white text, 'light' = white bg/black text
  mode: DEFAULT_MODE // 'flip' = split-flap board, 'qlock' = QLOCKTWO word clock
};

// Restore persisted state (NFR-8) — overrides defaults when enabled.
const persisted = loadPersisted();
if (persisted) {
  if (persisted.currentMessage?.lines) state.currentMessage = persisted.currentMessage;
  if (VALID_MODES.includes(persisted.mode)) state.mode = persisted.mode;
  if (['dark', 'light'].includes(persisted.theme)) state.theme = persisted.theme;
  if (typeof persisted.soundEnabled === 'boolean') state.soundEnabled = persisted.soundEnabled;
  // A persisted `qlockLanguage` from before #80 is simply ignored: a Pi left in
  // Arabic comes back as the word clock rather than failing to boot.
}
startPersistence(state);

// Start the split-flap info screen if booting into flip mode (issue #37).
if (state.mode === 'flip') startInfoScreen();

// Routes
// Mounted before the message router so /api/docs is not shadowed by any
// parameterised route added there later.
app.use('/api', docsRouter);
app.use('/api', messagesRouter);

// The shared design tokens, served at the same path as on the two FastAPI
// appliances so /api/docs links the identical two stylesheets everywhere.
// Vendored into server/ rather than fetched — the LAN guarantees nothing,
// including itself — and served from here rather than the client bundle so the
// page keeps working with no build step and no external request.
//
// Registered before the SPA fallback below, which would otherwise swallow it.
app.use('/static', express.static(path.join(__dirname, '..', 'static')));

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
    }
  }));
  // Current rotating-screen slots, so /setup can render its previews on load.
  ws.send(JSON.stringify({ type: 'screens', data: screensPayload() }));

  ws.on('close', () => {
    console.log('Client disconnected');
    state.clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    state.clients.delete(ws);
  });
});

// MQTT state + availability (issue #68). Off unless MQTT_HOST is set: no
// broker configured means no client and no error.
const mqtt = new MqttPublisher();

function mqttSnapshot() {
  return {
    mode: state.mode,
    theme: state.theme,
    clients: state.clients.size,
    screens: state.screens,
  };
}

// Publishing rides the existing broadcast path rather than being sprinkled
// through the routes: every settings and screen change already funnels through
// here to reach the displays, so there is exactly one place to keep in step.
export function publishMqtt() {
  mqtt.publishState(mqttSnapshot());
}

// Broadcast to all connected clients
export function broadcast(data) {
  const message = JSON.stringify(data);
  state.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
  // Client counts change on connect/disconnect too, which is not a broadcast —
  // the heartbeat below covers that rather than hooking the socket lifecycle.
  publishMqtt();
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket available on ws://localhost:${PORT}`);
  console.log(`Default mode: ${state.mode}`);

  if (mqttEnabled()) {
    mqtt.start().then(() => {
      console.log(`MQTT -> ${mqttSettings.host}:${mqttSettings.port} (base ${mqttSettings.baseTopic})`);
    }).catch(() => {
      // A broker that is down must not stop the display from serving.
      console.error('MQTT: initial connect failed; will retry in the background');
    });
    // Heartbeat: catches what the broadcast path cannot see — client
    // connect/disconnect, and screen slots that expire on a timer rather than
    // through an API call.
    const beat = setInterval(publishMqtt, 30000);
    if (beat.unref) beat.unref();

    // Publish a clean `offline` on the way out. A graceful disconnect means the
    // broker will NOT fire the will, so without this a planned restart looks
    // identical to the appliance still being up.
    const shutdown = () => { mqtt.stop().finally(() => process.exit(0)); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
});
