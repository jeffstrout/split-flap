import React from 'react';
import FlipChar from './FlipChar';

function FlipRow({ text, cols, rowIndex, onFlip }) {
  // Pad or truncate text to fit columns
  const paddedText = text.padEnd(cols, ' ').substring(0, cols);

  return (
    <div className="flip-row">
      {paddedText.split('').map((char, index) => (
        <FlipChar
          key={index}
          char={char}
          delay={rowIndex * 50 + index * 20}
          onFlip={onFlip}
        />
      ))}
    </div>
  );
}

export default FlipRow;
