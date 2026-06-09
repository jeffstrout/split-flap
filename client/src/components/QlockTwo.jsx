import React, { useState, useEffect } from 'react';
import { getLanguage } from '../qlock/lang/index.js';
import { timeToWords } from '../qlock/timeToWords.js';
import '../styles/qlock.css';

// Burn-in mitigation (NFR-9) — see issue #12.
const BURN_IN_ENABLED =
  import.meta.env.VITE_BURN_IN_SHIFT === 'true' ||
  import.meta.env.VITE_BURN_IN_SHIFT === '1';
const SHIFT_OFFSETS = [
  [0, 0], [3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0], [-3, -3], [0, -3], [3, -3],
];
const SHIFT_INTERVAL_MS = 5 * 60 * 1000;

// QLOCKTWO word clock (FR-27, FR-30, FR-32, FR-33, FR-34). Language-aware
// (issue #33): renders the active language pack's letter matrix, RTL-aware,
// updating each minute on the minute. Silent by design.
function QlockTwo({ theme, language = 'en' }) {
  const [now, setNow] = useState(() => new Date());
  const [shift, setShift] = useState(0);

  const pack = getLanguage(language);
  const cols = pack.grid[0].length;

  useEffect(() => {
    let intervalId;
    const tick = () => setNow(new Date());
    const current = new Date();
    const msToNextMinute =
      (60 - current.getSeconds()) * 1000 - current.getMilliseconds();
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!BURN_IN_ENABLED) return undefined;
    const id = setInterval(
      () => setShift((s) => (s + 1) % SHIFT_OFFSETS.length),
      SHIFT_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, []);

  const { litKeys, dots } = timeToWords(now, pack);
  const [dx, dy] = SHIFT_OFFSETS[shift];

  const matrixStyle = {
    '--qlock-cols': cols,
    direction: pack.dir,
    fontFamily: pack.fontFamily,
    ...(BURN_IN_ENABLED ? { transform: `translate(${dx}px, ${dy}px)` } : {}),
  };

  return (
    <div className={`qlock ${theme === 'light' ? 'theme-light' : ''}`}>
      <div
        className="qlock-matrix"
        style={matrixStyle}
        role="img"
        aria-label="word clock"
      >
        {pack.grid.map((row, r) => (
          <div className="qlock-row" key={r}>
            {Array.from(row).map((ch, c) => (
              <span
                key={c}
                className={`qlock-cell ${litKeys.has(`${r}-${c}`) ? 'lit' : ''}`}
              >
                {ch}
              </span>
            ))}
          </div>
        ))}
        {/* Corner dots: 1-4 minutes past the 5-minute bucket (FR-30). */}
        <span className={`qlock-dot tl ${dots >= 1 ? 'lit' : ''}`} />
        <span className={`qlock-dot tr ${dots >= 2 ? 'lit' : ''}`} />
        <span className={`qlock-dot br ${dots >= 3 ? 'lit' : ''}`} />
        <span className={`qlock-dot bl ${dots >= 4 ? 'lit' : ''}`} />
      </div>
    </div>
  );
}

export default QlockTwo;
