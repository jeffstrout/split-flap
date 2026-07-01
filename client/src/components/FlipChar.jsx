import React, { useState, useEffect, useRef } from 'react';
import { FLIP_HALF_MS, FLIP_FULL_MS, FLIP_GAP_MS } from './flipTiming';

// Characters available on the flip board (space + letters + numbers + punctuation)
const CHARACTERS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-:\'"/()@#$%&*+';

function FlipChar({ char, delay = 0, onFlip }) {
  const [currentChar, setCurrentChar] = useState(' ');
  const [isFlipping, setIsFlipping] = useState(false);
  const [displayChar, setDisplayChar] = useState(' ');
  const targetChar = useRef(' ');
  const animationRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const newTarget = CHARACTERS.includes(char) ? char : ' ';

    if (newTarget === currentChar) return;

    targetChar.current = newTarget;

    // Clear any existing animation
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (animationRef.current) clearTimeout(animationRef.current);

    // Start flipping after delay
    timeoutRef.current = setTimeout(() => {
      flipToTarget();
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [char, delay]);

  const flipToTarget = () => {
    const currentIndex = CHARACTERS.indexOf(currentChar);
    const targetIndex = CHARACTERS.indexOf(targetChar.current);

    if (currentIndex === targetIndex) return;

    // Flip via the SHORTER direction through the character wheel (issue #60):
    // going the nearer way roughly halves the steps for far-apart glyphs, which
    // cuts the per-change React/animation work so a full board settles in time.
    const N = CHARACTERS.length;
    const forward = (targetIndex - currentIndex + N) % N; // steps flipping forward
    const dir = forward <= N - forward ? 1 : -1;           // +1 forward, -1 backward
    const steps = dir === 1 ? forward : N - forward;

    let step = 0;
    const flipNext = () => {
      if (step >= steps) {
        setCurrentChar(targetChar.current);
        setDisplayChar(targetChar.current);
        setIsFlipping(false);
        return;
      }

      setIsFlipping(true);
      const nextIndex = (((currentIndex + dir * (step + 1)) % N) + N) % N;
      const nextChar = CHARACTERS[nextIndex];

      // Trigger flip sound
      if (onFlip) onFlip();

      // After half the flip animation, change the character
      setTimeout(() => {
        setDisplayChar(nextChar);
      }, FLIP_HALF_MS);

      // After full flip, either continue or stop
      setTimeout(() => {
        setIsFlipping(false);
        step++;
        if (step < steps) {
          animationRef.current = setTimeout(flipNext, FLIP_GAP_MS);
        } else {
          setCurrentChar(targetChar.current);
        }
      }, FLIP_FULL_MS);
    };

    flipNext();
  };

  return (
    <div className="flip-char-container">
      <div className={`flip-char ${isFlipping ? 'flipping' : ''}`}>
        <div className="flip-char-top">
          <span>{displayChar}</span>
        </div>
        <div className="flip-char-bottom">
          <span>{displayChar}</span>
        </div>
        <div className={`flip-card ${isFlipping ? 'flip' : ''}`}>
          <div className="flip-card-front">
            <span>{displayChar}</span>
          </div>
          <div className="flip-card-back">
            <span>{displayChar}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoized: the board has up to ROWS×COLS of these, and Display re-renders on
// every settings WebSocket message. onFlip is a stable useCallback and
// char/delay are deterministic, so memo skips re-renders unless this tile's
// own props change — a meaningful win on low-power hardware (e.g. Pi 3B+).
export default React.memo(FlipChar);
