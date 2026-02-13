import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import messagesRouter from './routes/messages.js';

const app = express();
const PORT = process.env.PORT || 3001;

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
    lines: Array(8).fill(''.padEnd(24, ' '))
  },
  clients: new Set(),
  clockInterval: null,
  clockTimeout: null,
  soundEnabled: true,
  theme: 'dark' // 'dark' = black bg/white text, 'light' = white bg/black text
};

// Routes
app.use('/api', messagesRouter);

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
      theme: state.theme
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
});
