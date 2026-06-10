import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ROWS, COLS } from '@board';
import { FLIP_FULL_MS } from './components/flipTiming';
import './styles/flip.css';

// Expose board dimensions to CSS so the split-flap sizing has no magic numbers.
document.documentElement.style.setProperty('--board-cols', COLS);
document.documentElement.style.setProperty('--board-rows', ROWS);
// Keep the CSS card-flip transition in lockstep with the JS flip timing (#42).
document.documentElement.style.setProperty('--flip-duration', `${FLIP_FULL_MS}ms`);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
