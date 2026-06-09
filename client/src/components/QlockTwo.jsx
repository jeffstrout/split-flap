import React, { useState, useEffect } from 'react';
import { GRID } from '../qlock/matrix.js';
import { timeToWords } from '../qlock/timeToWords.js';
import '../styles/qlock.css';

// QLOCKTWO word clock (FR-27, FR-30, FR-32, FR-33, FR-34).
// Renders the full 11x10 letter matrix and lights the words for the current
// local time, updating each minute on the minute. Silent by design.
function QlockTwo({ theme }) {
  const [now, setNow] = useState(() => new Date());

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

  const { litKeys, dots } = timeToWords(now);

  return (
    <div className={`qlock ${theme === 'light' ? 'theme-light' : ''}`}>
      <div className="qlock-matrix" role="img" aria-label="word clock">
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
