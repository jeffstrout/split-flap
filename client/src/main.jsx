import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ROWS, COLS } from '@board';
import './styles/flip.css';

// Expose board dimensions to CSS so the split-flap sizing has no magic numbers.
document.documentElement.style.setProperty('--board-cols', COLS);
document.documentElement.style.setProperty('--board-rows', ROWS);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
