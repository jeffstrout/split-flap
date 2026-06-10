import React from 'react';
import FlipChar from './FlipChar';
import { ROW_STAGGER_MS, CHAR_STAGGER_MS } from './flipTiming';

function FlipRow({ text, cols, rowIndex, onFlip }) {
  // Pad or truncate text to fit columns
  const paddedText = text.padEnd(cols, ' ').substring(0, cols);

  return (
    <div className="flip-row">
      {paddedText.split('').map((char, index) => (
        <FlipChar
          key={index}
          char={char}
          delay={rowIndex * ROW_STAGGER_MS + index * CHAR_STAGGER_MS}
          onFlip={onFlip}
        />
      ))}
    </div>
  );
}

export default FlipRow;
