import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

// State persistence (NFR-8). ENABLED BY DEFAULT so the display returns in the
// mode/language/theme it was last set to (issue #35). It persists the last
// message and the sound/theme/mode/language settings, saved on a short interval
// and on shutdown, loaded on boot.
//
// Configuration:
//   PERSIST_FILE=<path>  override the storage path
//   PERSIST_FILE=off     disable persistence entirely
const DEFAULT_FILE = fileURLToPath(new URL('../.state.json', import.meta.url));
const raw = process.env.PERSIST_FILE;
const FILE = raw === 'off' ? null : (raw || DEFAULT_FILE);
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
          qlockLanguage: state.qlockLanguage,
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
