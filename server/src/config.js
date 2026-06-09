// Split-flap board dimensions — the single source of truth.
//
// The server imports this directly; the client imports it at BUILD time via a
// Vite alias (`@board`) so the values are inlined into the bundle (no runtime
// dependency on the server package). The QLOCKTWO matrix has its own single
// source in client/src/qlock/matrix.js.
export const ROWS = 8;
export const COLS = 24;
