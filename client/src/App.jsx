import React, { useState, useEffect } from 'react';
import FlipBoard from './components/FlipBoard';
import QlockTwo from './components/QlockTwo';
import useWebSocket from './hooks/useWebSocket';

const ROWS = 8;
const COLS = 24;

function App() {
  const [lines, setLines] = useState(
    Array(ROWS).fill(''.padEnd(COLS, ' '))
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [mode, setMode] = useState('qlock');

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
    </div>
  );
}

export default App;
