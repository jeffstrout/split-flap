import React, { useState, useEffect, useRef } from 'react';

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

    // Calculate steps (always flip forward through the character set)
    let steps;
    if (targetIndex >= currentIndex) {
      steps = targetIndex - currentIndex;
    } else {
      steps = CHARACTERS.length - currentIndex + targetIndex;
    }

    let step = 0;
    const flipNext = () => {
      if (step >= steps) {
        setCurrentChar(targetChar.current);
        setDisplayChar(targetChar.current);
        setIsFlipping(false);
        return;
      }

      setIsFlipping(true);
      const nextIndex = (currentIndex + step + 1) % CHARACTERS.length;
      const nextChar = CHARACTERS[nextIndex];

      // Trigger flip sound
      if (onFlip) onFlip();

      // After half the flip animation, change the character
      setTimeout(() => {
        setDisplayChar(nextChar);
      }, 40);

      // After full flip, either continue or stop
      setTimeout(() => {
        setIsFlipping(false);
        step++;
        if (step < steps) {
          animationRef.current = setTimeout(flipNext, 30);
        } else {
          setCurrentChar(targetChar.current);
        }
      }, 80);
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

export default FlipChar;
