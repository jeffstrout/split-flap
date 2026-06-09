import React, { useState, useEffect, useRef } from 'react';
import '../styles/controls.css';

// On-screen sound & theme controls (FR-20). Hidden by default for kiosk use;
// revealed on pointer/key activity and auto-hidden after a few seconds. Posts
// to the existing API so all displays stay in sync via WebSocket.
// (Mode switching is intentionally API-only in v1 per FR-25 — no toggle here.)
const HIDE_DELAY_MS = 3000;

export default function Controls({ soundEnabled, theme }) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const reveal = () => {
      setVisible(true);
      document.body.style.cursor = 'auto';
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        document.body.style.cursor = 'none';
      }, HIDE_DELAY_MS);
    };
    window.addEventListener('mousemove', reveal);
    window.addEventListener('keydown', reveal);
    window.addEventListener('touchstart', reveal);
    return () => {
      window.removeEventListener('mousemove', reveal);
      window.removeEventListener('keydown', reveal);
      window.removeEventListener('touchstart', reveal);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const post = (path) => {
    fetch(`/api${path}`, { method: 'POST' }).catch((e) =>
      console.error('control request failed', e)
    );
  };

  return (
    <div className={`controls ${visible ? 'visible' : ''}`}>
      <button
        type="button"
        onClick={() => post(soundEnabled ? '/sound/off' : '/sound/on')}
        aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
      >
        {soundEnabled ? '🔊 Sound' : '🔇 Muted'}
      </button>
      <button
        type="button"
        onClick={() => post(theme === 'dark' ? '/theme/light' : '/theme/dark')}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
      </button>
    </div>
  );
}
