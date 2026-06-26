import { Router } from 'express';
import { state, broadcast } from '../index.js';
import { ROWS, COLS } from '../config.js';

// Reject absurdly long lines outright (they are truncated to COLS for display,
// but this caps payload abuse).
const MAX_LINE_LENGTH = 256;

const router = Router();

// Helper to broadcast the current settings (sound, theme, mode) to all clients
function broadcastSettings() {
  broadcast({
    type: 'settings',
    data: {
      soundEnabled: state.soundEnabled,
      theme: state.theme,
      mode: state.mode,
      qlockLanguage: state.qlockLanguage
    }
  });
}

// Helper to pad/truncate lines to fit board dimensions.
// align: 'left' (default) right-pads; 'center' centers within COLS.
function formatMessage(lines, align = 'left') {
  const formatted = [];
  for (let i = 0; i < ROWS; i++) {
    const raw = (lines[i] || '').toUpperCase().substring(0, COLS);
    if (align === 'center') {
      const leftPad = Math.floor((COLS - raw.length) / 2);
      formatted.push((' '.repeat(leftPad) + raw).padEnd(COLS, ' '));
    } else {
      formatted.push(raw.padEnd(COLS, ' '));
    }
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

  if (!Array.isArray(lines)) {
    return res.status(400).json({ error: 'lines must be an array' });
  }
  if (lines.length > ROWS) {
    return res.status(400).json({ error: `lines may contain at most ${ROWS} entries` });
  }
  if (!lines.every((line) => typeof line === 'string')) {
    return res.status(400).json({ error: 'each line must be a string' });
  }
  if (lines.some((line) => line.length > MAX_LINE_LENGTH)) {
    return res.status(400).json({ error: `each line must be at most ${MAX_LINE_LENGTH} characters` });
  }

  const align = req.body.align ?? 'left';
  if (align !== 'left' && align !== 'center') {
    return res.status(400).json({ error: "align must be 'left' or 'center'" });
  }

  state.currentMessage = {
    lines: formatMessage(lines, align)
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
  // Explicit minute clock takes over from the info screen.
  stopInfoScreen();
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
  broadcastSettings();
  res.json({ success: true, soundEnabled: true });
});

// POST /api/sound/off - Disable sound
router.post('/sound/off', (req, res) => {
  state.soundEnabled = false;
  broadcastSettings();
  res.json({ success: true, soundEnabled: false });
});

// GET /api/sound - Get sound status
router.get('/sound', (req, res) => {
  res.json({ soundEnabled: state.soundEnabled });
});

// POST /api/theme/dark - Set dark theme (black bg, white text)
router.post('/theme/dark', (req, res) => {
  state.theme = 'dark';
  broadcastSettings();
  res.json({ success: true, theme: 'dark' });
});

// POST /api/theme/light - Set light theme (white bg, black text)
router.post('/theme/light', (req, res) => {
  state.theme = 'light';
  broadcastSettings();
  res.json({ success: true, theme: 'light' });
});

// GET /api/theme - Get current theme
router.get('/theme', (req, res) => {
  res.json({ theme: state.theme });
});

// GET /api/mode - Get current display mode
router.get('/mode', (req, res) => {
  res.json({ mode: state.mode });
});

// POST /api/mode/flip - Switch all displays to the split-flap board
router.post('/mode/flip', (req, res) => {
  state.mode = 'flip';
  startInfoScreen();
  broadcastSettings();
  res.json({ success: true, mode: 'flip' });
});

// POST /api/mode/qlock - Switch all displays to the QLOCKTWO word clock
router.post('/mode/qlock', (req, res) => {
  state.mode = 'qlock';
  stopInfoScreen();
  broadcastSettings();
  res.json({ success: true, mode: 'qlock' });
});

// GET /api/qlock/language - Get the QLOCKTWO word-clock language
router.get('/qlock/language', (req, res) => {
  res.json({ qlockLanguage: state.qlockLanguage });
});

// POST /api/qlock/language/en|ar - Set the QLOCKTWO language
router.post('/qlock/language/:lang', (req, res) => {
  const { lang } = req.params;
  if (lang !== 'en' && lang !== 'ar') {
    return res.status(400).json({ error: "language must be 'en' or 'ar'" });
  }
  state.qlockLanguage = lang;
  broadcastSettings();
  res.json({ success: true, qlockLanguage: lang });
});

// GET /api/settings - Consolidated current settings (for the setup screen)
router.get('/settings', (req, res) => {
  res.json({
    mode: state.mode,
    qlockLanguage: state.qlockLanguage,
    theme: state.theme,
    soundEnabled: state.soundEnabled
  });
});

// GET /api/health - Liveness/readiness probe for deployment monitoring
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    connectedClients: state.clients.size,
    mode: state.mode
  });
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

// --- Split-flap info screen (issue #37) ----------------------------------
// Bottom-left: day + month + date (left-justified). Bottom-right: 24h
// HH:MM:SS (right-justified). Runs while in 'flip' mode, refreshing every 10s.
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// Refresh cadence + displayed-seconds granularity. The info screen ticks every
// INFO_STEP_S seconds, aligned to wall-clock multiples (…:00, :10, :20, …), and
// the seconds field is floored to the same step so it advances cleanly.
const INFO_STEP_S = 10;
const INFO_INTERVAL_MS = INFO_STEP_S * 1000;

function generateInfoMessage() {
  const now = new Date();
  const left = `${DAY_ABBR[now.getDay()]} ${MONTH_ABBR[now.getMonth()]} ${now.getDate()}`;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(Math.floor(now.getSeconds() / INFO_STEP_S) * INFO_STEP_S).padStart(2, '0');
  const right = `${hh}:${mm}:${ss}`;

  const gap = Math.max(1, COLS - left.length - right.length);
  const bottom = (left + ' '.repeat(gap) + right).substring(0, COLS).padEnd(COLS, ' ');

  const lines = [];
  for (let i = 0; i < ROWS - 1; i++) lines.push(''.padEnd(COLS, ' '));
  lines.push(bottom);
  return lines;
}

export function startInfoScreen() {
  stopInfoScreen();
  // The info screen owns the board in flip mode — stop the legacy minute clock.
  if (state.clockInterval) { clearInterval(state.clockInterval); state.clockInterval = null; }
  if (state.clockTimeout) { clearTimeout(state.clockTimeout); state.clockTimeout = null; }

  const update = () => {
    state.currentMessage = { lines: generateInfoMessage() };
    broadcast({ type: 'message', data: state.currentMessage });
  };

  update(); // show immediately (seconds already floored to a multiple of INFO_STEP_S)

  // Align the recurring refresh to the next wall-clock INFO_STEP_S boundary so
  // the displayed seconds advance cleanly 00 -> 10 -> 20 ...
  const now = new Date();
  const msToNextBoundary =
    INFO_INTERVAL_MS - (now.getSeconds() % INFO_STEP_S) * 1000 - now.getMilliseconds();
  state.infoTimeout = setTimeout(() => {
    update();
    state.infoInterval = setInterval(update, INFO_INTERVAL_MS);
  }, msToNextBoundary);
}

export function stopInfoScreen() {
  if (state.infoInterval) {
    clearInterval(state.infoInterval);
    state.infoInterval = null;
  }
  if (state.infoTimeout) {
    clearTimeout(state.infoTimeout);
    state.infoTimeout = null;
  }
}

export default router;
