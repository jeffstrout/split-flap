import React, { useRef, useCallback, useEffect } from 'react';
import FlipRow from './FlipRow';

function FlipBoard({ lines, rows, cols, soundEnabled, theme }) {
  const audioContextRef = useRef(null);
  const audioBufferRef = useRef(null);
  const lastPlayTime = useRef(0);

  const initAudio = useCallback(async () => {
    if (audioContextRef.current && audioBufferRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return;
    }

    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Create a synthetic tick sound (like a split-flap mechanism)
      const sampleRate = audioContextRef.current.sampleRate;
      const duration = 0.025; // Very short tick
      const buffer = audioContextRef.current.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);

      // Generate a sharp mechanical tick
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 300);
        const tick = Math.sin(t * 4000 * Math.PI) * 0.3;
        const noise = (Math.random() * 2 - 1) * 0.15 * Math.exp(-t * 500);
        data[i] = (tick + noise) * envelope;
      }

      audioBufferRef.current = buffer;
    } catch (e) {
      console.warn('Audio initialization failed:', e);
    }
  }, []);

  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    initAudio();

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [initAudio]);

  const playFlipSound = useCallback(() => {
    if (!soundEnabled) return;
    if (!audioContextRef.current || !audioBufferRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const now = audioContextRef.current.currentTime;
    if (now - lastPlayTime.current < 0.02) return;
    lastPlayTime.current = now;

    try {
      const source = audioContextRef.current.createBufferSource();
      const gainNode = audioContextRef.current.createGain();

      source.buffer = audioBufferRef.current;
      source.playbackRate.value = 0.9 + Math.random() * 0.4;
      gainNode.gain.value = 0.5 + Math.random() * 0.3;

      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, [soundEnabled]);

  return (
    <div className={`flip-board ${theme === 'light' ? 'theme-light' : ''}`} onClick={initAudio}>
      <div className="flip-board-frame">
        {Array(rows)
          .fill(null)
          .map((_, rowIndex) => (
            <FlipRow
              key={rowIndex}
              text={lines[rowIndex] || ''}
              cols={cols}
              rowIndex={rowIndex}
              onFlip={playFlipSound}
              theme={theme}
            />
          ))}
      </div>
    </div>
  );
}

export default FlipBoard;
