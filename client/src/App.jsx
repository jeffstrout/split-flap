import React from 'react';
import Display from './Display';
import Setup from './Setup';

// Tiny path-based router. "/setup" -> config screen; everything else -> the
// live display. Navigation uses plain links (full reload), which is fine for a
// kiosk + an occasional config visit, and works with the static-site
// catchall_document in production.
function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function App() {
  return currentPath() === '/setup' ? <Setup /> : <Display />;
}

export default App;
