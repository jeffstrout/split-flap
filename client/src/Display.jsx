import React, { useState, useEffect, useCallback } from 'react';
import FlipBoard from './components/FlipBoard';
import QlockTwo from './components/QlockTwo';
import Controls from './components/Controls';
import useWebSocket from './hooks/useWebSocket';
import useWakeLock from './hooks/useWakeLock';
import { ROWS, COLS } from '@board';

// The live wall display (route "/"). Renders the active mode from the
// server-pushed settings.
function Display() {
  const [lines, setLines] = useState(
    Array(ROWS).fill(''.padEnd(COLS, ' '))
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [mode, setMode] = useState('qlock');

  // Keep the wall monitor awake (FR-37).
  useWakeLock();

  const wsUrl = import.meta.env.DEV
    ? 'ws://localhost:3001'
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api`;

  // Every frame is handled as it arrives (issue #88). This ran as an effect on a
  // `lastMessage` state slot, which dropped the connect-time `settings` frame —
  // the one carrying the boot mode — whenever React batched it away.
  const handleFrame = useCallback((frame) => {
    if (frame?.type === 'message' && frame.data?.lines) {
      setLines(frame.data.lines);
    }
    if (frame?.type === 'settings') {
      if (frame.data.soundEnabled !== undefined) {
        setSoundEnabled(frame.data.soundEnabled);
      }
      if (frame.data.theme) {
        setTheme(frame.data.theme);
      }
      if (frame.data.mode) {
        setMode(frame.data.mode);
      }
    }
  }, []);

  useWebSocket(wsUrl, handleFrame);

  // Keep Safari's tab/toolbar chrome on the board's own theme. index.html sets
  // this before first paint from the route alone; the theme is user-settable
  // and arrives over the WebSocket, so a light board would otherwise sit under
  // dark browser chrome. The values match .app / .app.theme-light in flip.css.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f5f5' : '#0d0d0d');
  }, [theme]);

  return (
    <div className={`app ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      {mode === 'qlock' ? (
        <QlockTwo theme={theme} />
      ) : (
        <FlipBoard
          lines={lines}
          rows={ROWS}
          cols={COLS}
          soundEnabled={soundEnabled}
          theme={theme}
        />
      )}
      <Controls soundEnabled={soundEnabled} theme={theme} />
    </div>
  );
}

export default Display;
