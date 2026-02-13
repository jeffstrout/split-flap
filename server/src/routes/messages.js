import { Router } from 'express';
import { state, broadcast } from '../index.js';

const router = Router();

const ROWS = 8;
const COLS = 24;

// Helper to pad/truncate lines to fit board dimensions
function formatMessage(lines) {
  const formatted = [];
  for (let i = 0; i < ROWS; i++) {
    const line = lines[i] || '';
    formatted.push(line.toUpperCase().substring(0, COLS).padEnd(COLS, ' '));
  }
  return formatted;
}

// GET /api/message - Get current message
router.get('/message', (req, res) => {
  res.json(state.currentMessage);
});

// POST /api/message - Send a new message to the board
router.post('/message', (req, res) => {
  const { lines } = req.body;

  if (!lines || !Array.isArray(lines)) {
    return res.status(400).json({ error: 'lines array is required' });
  }

  state.currentMessage = {
    lines: formatMessage(lines)
  };

  // Broadcast to all connected displays
  broadcast({
    type: 'message',
    data: state.currentMessage
  });

  res.json({ success: true, message: state.currentMessage });
});

// DELETE /api/message - Clear the board
router.delete('/message', (req, res) => {
  state.currentMessage = {
    lines: Array(ROWS).fill(''.padEnd(COLS, ' '))
  };

  // Broadcast clear to all connected displays
  broadcast({
    type: 'message',
    data: state.currentMessage
  });

  res.json({ success: true, message: 'Board cleared' });
});

// GET /api/status - Get board status
router.get('/status', (req, res) => {
  res.json({
    connectedClients: state.clients.size,
    boardDimensions: { rows: ROWS, cols: COLS }
  });
});

// GET /api/test - Display current date and time (one-time)
router.get('/test', (req, res) => {
  const message = generateTimeMessage();

  state.currentMessage = {
    lines: formatMessage(message)
  };

  broadcast({
    type: 'message',
    data: state.currentMessage
  });

  res.json({ success: true, message: state.currentMessage });
});

// POST /api/clock/start - Start the clock (updates every minute on the minute)
router.post('/clock/start', (req, res) => {
  if (state.clockInterval) {
    clearInterval(state.clockInterval);
  }
  if (state.clockTimeout) {
    clearTimeout(state.clockTimeout);
  }

  const updateClock = () => {
    const message = generateTimeMessage();
    state.currentMessage = {
      lines: formatMessage(message)
    };
    broadcast({
      type: 'message',
      data: state.currentMessage
    });
  };

  // Update immediately
  updateClock();

  // Calculate ms until next minute
  const now = new Date();
  const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  // Wait until next minute, then start interval
  state.clockTimeout = setTimeout(() => {
    updateClock();
    state.clockInterval = setInterval(updateClock, 60000);
  }, msUntilNextMinute);

  res.json({ success: true, message: 'Clock started' });
});

// POST /api/clock/stop - Stop the clock
router.post('/clock/stop', (req, res) => {
  if (state.clockInterval) {
    clearInterval(state.clockInterval);
    state.clockInterval = null;
  }
  if (state.clockTimeout) {
    clearTimeout(state.clockTimeout);
    state.clockTimeout = null;
  }
  res.json({ success: true, message: 'Clock stopped' });
});

// POST /api/sound/on - Enable sound
router.post('/sound/on', (req, res) => {
  state.soundEnabled = true;
  broadcast({
    type: 'settings',
    data: { soundEnabled: state.soundEnabled, theme: state.theme }
  });
  res.json({ success: true, soundEnabled: true });
});

// POST /api/sound/off - Disable sound
router.post('/sound/off', (req, res) => {
  state.soundEnabled = false;
  broadcast({
    type: 'settings',
    data: { soundEnabled: state.soundEnabled, theme: state.theme }
  });
  res.json({ success: true, soundEnabled: false });
});

// GET /api/sound - Get sound status
router.get('/sound', (req, res) => {
  res.json({ soundEnabled: state.soundEnabled });
});

// POST /api/theme/dark - Set dark theme (black bg, white text)
router.post('/theme/dark', (req, res) => {
  state.theme = 'dark';
  broadcast({
    type: 'settings',
    data: { soundEnabled: state.soundEnabled, theme: state.theme }
  });
  res.json({ success: true, theme: 'dark' });
});

// POST /api/theme/light - Set light theme (white bg, black text)
router.post('/theme/light', (req, res) => {
  state.theme = 'light';
  broadcast({
    type: 'settings',
    data: { soundEnabled: state.soundEnabled, theme: state.theme }
  });
  res.json({ success: true, theme: 'light' });
});

// GET /api/theme - Get current theme
router.get('/theme', (req, res) => {
  res.json({ theme: state.theme });
});

// Helper function to generate time message
function generateTimeMessage() {
  const now = new Date();

  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
                  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const date = now.getDate();
  const year = now.getFullYear();

  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const lines = [
    '',
    `${dayName}`,
    `${monthName} ${date}, ${year}`,
    '',
    `${hours}:${minutes} ${ampm}`,
    '',
    '',
    ''
  ];

  // Center each line
  return lines.map(line => {
    const padding = Math.floor((COLS - line.length) / 2);
    return ' '.repeat(padding) + line;
  });
}

export default router;
