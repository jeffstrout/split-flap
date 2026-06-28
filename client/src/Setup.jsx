import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket from './hooks/useWebSocket';
import './styles/setup.css';

// The three user-facing display modes (issue #35). Each composes the server's
// mode + qlockLanguage settings into one choice.
const DISPLAY_MODES = [
  { id: 'en', label: 'English Word Clock', hint: 'QLOCKTWO — IT IS HALF PAST TEN' },
  { id: 'ar', label: 'Arabic Word Clock', hint: 'QLOCKTWO — الساعة السادسة' },
  { id: 'flip', label: 'Info Split Flap', hint: 'Split-flap message board' },
];

// In dev the Vite proxy forwards /api -> :3001; in prod it's same-origin.
const post = (path) => fetch(path, { method: 'POST' });

function selectedFrom({ mode, qlockLanguage }) {
  if (mode === 'flip') return 'flip';
  return qlockLanguage === 'ar' ? 'ar' : 'en';
}

function Setup() {
  const [settings, setSettings] = useState(null); // { mode, qlockLanguage, theme, soundEnabled }
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(null); // { version, commit, builtAt }

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
    // Which build is running — handy for confirming an auto-update landed (#50).
    fetch('/api/version')
      .then((r) => r.json())
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  // Reflect changes made from anywhere (other devices, the display) live.
  useEffect(() => {
    if (lastMessage?.type === 'settings') {
      setSettings((prev) => ({ ...prev, ...lastMessage.data }));
    }
  }, [lastMessage]);

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

        <p className="setup-note">Changes apply to all displays instantly and are saved across restarts.</p>
        {version && (
          <p className="setup-version">
            running {version.commit}
            {version.builtAt && version.builtAt !== 'unknown' ? ` · built ${version.builtAt}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default Setup;
