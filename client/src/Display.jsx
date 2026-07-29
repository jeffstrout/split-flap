import React, { useState, useEffect } from 'react';
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

  const { lastMessage } = useWebSocket(wsUrl);

  useEffect(() => {
    if (lastMessage?.type === 'message' && lastMessage.data?.lines) {
      setLines(lastMessage.data.lines);
    }
    if (lastMessage?.type === 'settings') {
      if (lastMessage.data.soundEnabled !== undefined) {
        setSoundEnabled(lastMessage.data.soundEnabled);
      }
      if (lastMessage.data.theme) {
        setTheme(lastMessage.data.theme);
      }
      if (lastMessage.data.mode) {
        setMode(lastMessage.data.mode);
      }
    }
  }, [lastMessage]);

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
