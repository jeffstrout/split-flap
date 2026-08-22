import React, { useState, useEffect, useRef } from 'react';
import { FLIP_HALF_MS, FLIP_FULL_MS, FLIP_GAP_MS } from './flipTiming';

// Characters available on the flip board (space + letters + numbers + punctuation)
const CHARACTERS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-:\'"/()@#$%&*+';

function FlipChar({ char, delay = 0, onFlip }) {
  const [displayChar, setDisplayChar] = useState(' ');
  const [isFlipping, setIsFlipping] = useState(false);

  // shownRef mirrors what's actually on the flap, read synchronously so a new
  // animation always starts from the glyph currently displayed (no backward
  // jump on interruption). targetRef is where the active/last animation is
  // heading. genRef supersedes stale animations, and timersRef holds EVERY
  // pending timeout so an interruption or unmount cancels all of them.
  //
  // The previous version tracked only the initial-delay and between-step
  // timeouts; the two per-step timeouts (glyph swap + step end) were untracked,
  // so a superseded animation's late setDisplayChar could land after the new
  // one settled, leaving the shown glyph out of sync with state. Combined with
  // an early-return guard, a cell whose new target was a space (nearly all of
  // them) then never repainted — a stray character stuck across screen changes.
  const shownRef = useRef(' ');
  const targetRef = useRef(' ');
  const genRef = useRef(0);
  const timersRef = useRef([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const setShown = (c) => {
    shownRef.current = c;
    setDisplayChar(c);
  };

  useEffect(() => {
    const newTarget = CHARACTERS.includes(char) ? char : ' ';
    // Already settled on, or already animating toward, this glyph — nothing to do.
    if (newTarget === targetRef.current) return;

    targetRef.current = newTarget;
    const gen = ++genRef.current;   // supersede any in-flight animation
    clearTimers();

    const start = setTimeout(() => flipToTarget(gen), delay);
    timersRef.current.push(start);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, delay]);

  const flipToTarget = (gen) => {
    if (gen !== genRef.current) return;

    const N = CHARACTERS.length;
    const currentIndex = CHARACTERS.indexOf(shownRef.current);
    const targetIndex = CHARACTERS.indexOf(targetRef.current);
    if (currentIndex === targetIndex) {
      setIsFlipping(false);
      return;
    }

    // Flip via the SHORTER direction through the character wheel (issue #60):
    // going the nearer way roughly halves the steps for far-apart glyphs, which
    // cuts the per-change React/animation work so a full board settles in time.
    const forward = (targetIndex - currentIndex + N) % N; // steps flipping forward
    const dir = forward <= N - forward ? 1 : -1;           // +1 forward, -1 backward
    const steps = dir === 1 ? forward : N - forward;

    let step = 0;
    const flipNext = () => {
      if (gen !== genRef.current) return;   // superseded → bail
      if (step >= steps) {
        setShown(targetRef.current);
        setIsFlipping(false);
        return;
      }

      setIsFlipping(true);
      const nextIndex = (((currentIndex + dir * (step + 1)) % N) + N) % N;
      const nextChar = CHARACTERS[nextIndex];

      // Trigger flip sound
      if (onFlip) onFlip();

      // After half the flip animation, change the character
      const half = setTimeout(() => {
        if (gen !== genRef.current) return;
        setShown(nextChar);
      }, FLIP_HALF_MS);
      timersRef.current.push(half);

      // After full flip, either continue or stop
      const full = setTimeout(() => {
        if (gen !== genRef.current) return;
        setIsFlipping(false);
        step++;
        if (step < steps) {
          const gap = setTimeout(flipNext, FLIP_GAP_MS);
          timersRef.current.push(gap);
        } else {
          setShown(targetRef.current);
        }
      }, FLIP_FULL_MS);
      timersRef.current.push(full);
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
