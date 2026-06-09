import { readFileSync, writeFileSync } from 'fs';

// Optional persistence (NFR-8). OFF by default — enable by setting
// PERSIST_FILE to a writable path. Persists the last message and the
// sound/theme/mode settings so they survive a restart. Saved on a short
// interval and on shutdown; loaded on boot.
const FILE = process.env.PERSIST_FILE;
export const persistenceEnabled = Boolean(FILE);

const SAVE_INTERVAL_MS = 10000;

export function loadPersisted() {
  if (!persistenceEnabled) return null;
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    return null; // first run or unreadable — start fresh
  }
}

export function startPersistence(state) {
  if (!persistenceEnabled) return;

  const save = () => {
    try {
      writeFileSync(
        FILE,
        JSON.stringify({
          currentMessage: state.currentMessage,
          mode: state.mode,
          theme: state.theme,
          soundEnabled: state.soundEnabled,
        })
      );
    } catch (e) {
      console.error('persistence save failed:', e);
    }
  };

  const interval = setInterval(save, SAVE_INTERVAL_MS);
  if (interval.unref) interval.unref();

  const shutdown = () => {
    save();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`Persistence enabled -> ${FILE}`);
}
