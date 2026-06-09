import React, { useState, useEffect } from 'react';
import { GRID } from '../qlock/matrix.js';
import { timeToWords } from '../qlock/timeToWords.js';
import '../styles/qlock.css';

// Burn-in mitigation (NFR-9). OFF by default — only needed for OLED/plasma
// panels (open question §14.3). Enable at build time with
// VITE_BURN_IN_SHIFT=true. When on, the matrix drifts by a few pixels on a
// slow cycle so no pixel stays lit in the same spot indefinitely.
const BURN_IN_ENABLED =
  import.meta.env.VITE_BURN_IN_SHIFT === 'true' ||
  import.meta.env.VITE_BURN_IN_SHIFT === '1';
const SHIFT_OFFSETS = [
  [0, 0], [3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0], [-3, -3], [0, -3], [3, -3],
];
const SHIFT_INTERVAL_MS = 5 * 60 * 1000; // advance every 5 minutes

// QLOCKTWO word clock (FR-27, FR-30, FR-32, FR-33, FR-34).
// Renders the full 11x10 letter matrix and lights the words for the current
// local time, updating each minute on the minute. Silent by design.
function QlockTwo({ theme }) {
  const [now, setNow] = useState(() => new Date());
  const [shift, setShift] = useState(0);

  // Recompute once per minute, aligned to the minute boundary (FR-32).
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

  // Slow pixel-shift for burn-in mitigation (NFR-9), only when enabled.
  useEffect(() => {
    if (!BURN_IN_ENABLED) return undefined;
    const id = setInterval(
      () => setShift((s) => (s + 1) % SHIFT_OFFSETS.length),
      SHIFT_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, []);

  const { litKeys, dots } = timeToWords(now);
  const [dx, dy] = SHIFT_OFFSETS[shift];
  const matrixStyle = BURN_IN_ENABLED
    ? { transform: `translate(${dx}px, ${dy}px)` }
    : undefined;

  return (
    <div className={`qlock ${theme === 'light' ? 'theme-light' : ''}`}>
      <div
        className="qlock-matrix"
        style={matrixStyle}
        role="img"
        aria-label="word clock"
      >
        {GRID.map((row, r) => (
          <div className="qlock-row" key={r}>
            {row.split('').map((ch, c) => (
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
