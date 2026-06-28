import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket from './hooks/useWebSocket';
import { ROWS, COLS } from '@board';
import './styles/setup.css';

// The three user-facing display modes (issue #35). Each composes the server's
// mode + qlockLanguage settings into one choice.
const DISPLAY_MODES = [
  { id: 'en', label: 'English Word Clock', hint: 'QLOCKTWO — IT IS HALF PAST TEN' },
  { id: 'ar', label: 'Arabic Word Clock', hint: 'QLOCKTWO — الساعة السادسة' },
  { id: 'flip', label: 'Info Split Flap', hint: 'Split-flap message board' },
];

// Rotating screens occupy the top rows; the bottom row is the date/time line.
const CONTENT_ROWS = ROWS - 1;

// In dev the Vite proxy forwards /api -> :3001; in prod it's same-origin.
const post = (path) => fetch(path, { method: 'POST' });
const del = (path) => fetch(path, { method: 'DELETE' });

function selectedFrom({ mode, qlockLanguage }) {
  if (mode === 'flip') return 'flip';
  return qlockLanguage === 'ar' ? 'ar' : 'en';
}

// Faithful, static (non-animated) preview of one screen's content area: a
// CONTENT_ROWS × COLS grid of fixed tiles. A space is a blank tile, not empty
// space — it's colored by the active theme (dark → black, light → white) via
// .screen-tile so padding and alignment read exactly as on the wall display.
function ScreenPreview({ lines }) {
  const tiles = [];
  for (let r = 0; r < CONTENT_ROWS; r++) {
    const line = (lines && lines[r]) || '';
    for (let c = 0; c < COLS; c++) {
      const ch = line[c] || ' ';
      tiles.push(
        <span className="screen-tile" key={`${r}-${c}`}>
          {ch === ' ' ? '' : ch}
        </span>
      );
    }
  }
  return (
    <div className="screen-grid" style={{ '--cols': COLS }} aria-hidden="true">
      {tiles}
    </div>
  );
}

// "MM:SS" remaining until expiresAt, or null when empty/expired.
function formatRemaining(expiresAt, now) {
  if (!expiresAt) return null;
  const secs = Math.max(0, Math.round((expiresAt - now) / 1000));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function Setup() {
  const [settings, setSettings] = useState(null); // { mode, qlockLanguage, theme, soundEnabled }
  const [saving, setSaving] = useState(false);
  const [screens, setScreens] = useState(null); // [{ slot, lines, align, expiresAt }]
  const [now, setNow] = useState(() => Date.now());

  const wsUrl = import.meta.env.DEV
    ? 'ws://localhost:3001'
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api`;
  const { lastMessage } = useWebSocket(wsUrl);

  // Hydrate from current server state on load.
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setSettings({ mode: 'qlock', qlockLanguage: 'en', theme: 'dark', soundEnabled: true }));
    fetch('/api/screens')
      .then((r) => r.json())
      .then((d) => setScreens(d.slots))
      .catch(() => setScreens([]));
  }, []);

  // Reflect changes made from anywhere (other devices, the display, publishers)
  // live: settings and the rotating-screen slots both arrive over WebSocket.
  useEffect(() => {
    if (lastMessage?.type === 'settings') {
      setSettings((prev) => ({ ...prev, ...lastMessage.data }));
    }
    if (lastMessage?.type === 'screens' && lastMessage.data?.slots) {
      setScreens(lastMessage.data.slots);
    }
  }, [lastMessage]);

  // Tick once a second so the per-slot TTL countdowns advance between pushes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const chooseDisplayMode = useCallback(async (id) => {
    setSaving(true);
    try {
      if (id === 'flip') {
        await post('/api/mode/flip');
      } else {
        await post(`/api/qlock/language/${id}`);
        await post('/api/mode/qlock');
      }
    } finally {
      setSaving(false);
    }
  }, []);

  const setTheme = (theme) => post(`/api/theme/${theme}`);
  const setSound = (on) => post(`/api/sound/${on ? 'on' : 'off'}`);

  if (!settings) {
    return <div className="setup theme-dark"><p className="setup-loading">Loading…</p></div>;
  }

  const selected = selectedFrom(settings);
  const themeClass = settings.theme === 'light' ? 'theme-light' : 'theme-dark';
  const anyPopulated = (screens || []).some((s) => s.lines);

  return (
    <div className={`setup ${themeClass}`}>
      <div className="setup-card">
        <header className="setup-header">
          <h1>Display Setup</h1>
          <a className="setup-link" href="/">View display →</a>
        </header>

        <section className="setup-section">
          <h2>Mode</h2>
          <div className="setup-modes">
            {DISPLAY_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`setup-mode ${selected === m.id ? 'active' : ''}`}
                aria-pressed={selected === m.id}
                disabled={saving}
                onClick={() => chooseDisplayMode(m.id)}
              >
                <span className="setup-mode-label">{m.label}</span>
                <span className="setup-mode-hint">{m.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="setup-section setup-row">
          <div>
            <h2>Theme</h2>
            <div className="setup-toggle">
              <button type="button" className={settings.theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
              <button type="button" className={settings.theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
            </div>
          </div>
          <div>
            <h2>Flip sound</h2>
            <div className="setup-toggle">
              <button type="button" className={settings.soundEnabled ? 'active' : ''} onClick={() => setSound(true)}>On</button>
              <button type="button" className={!settings.soundEnabled ? 'active' : ''} onClick={() => setSound(false)}>Off</button>
            </div>
          </div>
        </section>

        <section className="setup-section">
          <div className="setup-screens-head">
            <h2>Screens</h2>
            {anyPopulated && (
              <button type="button" className="setup-clear-all" onClick={() => del('/api/screens')}>
                Clear all
              </button>
            )}
          </div>
          <p className="setup-screens-hint">
            Up to {screens?.length ?? 6} screens rotate in Info Split Flap mode (15s each); the
            date/time line stays pinned. Push content with <code>POST /api/screens/&lt;slot&gt;</code>;
            data expires 15 minutes after its last push.
          </p>
          <div className="setup-screens">
            {(screens || []).map((s) => {
              const remaining = formatRemaining(s.expiresAt, now);
              return (
                <div key={s.slot} className={`setup-screen ${s.lines ? 'populated' : 'empty'}`}>
                  <div className="setup-screen-meta">
                    <span className="setup-screen-slot">Slot {s.slot}</span>
                    {s.lines ? (
                      <span className="setup-screen-ttl">expires in {remaining}</span>
                    ) : (
                      <span className="setup-screen-ttl muted">empty</span>
                    )}
                    {s.lines && (
                      <button
                        type="button"
                        className="setup-screen-clear"
                        onClick={() => del(`/api/screens/${s.slot}`)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <ScreenPreview lines={s.lines} />
                </div>
              );
            })}
          </div>
        </section>

        <p className="setup-note">Changes apply to all displays instantly and are saved across restarts.</p>
      </div>
    </div>
  );
}

export default Setup;
