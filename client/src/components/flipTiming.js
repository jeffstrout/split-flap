// Split-flap animation timing — single source of truth (issue #42).
//
// Speed is configurable at build time via VITE_FLIP_SPEED (a multiplier on the
// original mechanical timing): 1 = original speed, 2 = current default (twice
// as fast). Lower values are gentler on low-power hardware like a Raspberry Pi
// 3B+ — fewer animation frames per second of board churn. Set it through the
// Docker `.env` (FLIP_SPEED -> build arg) or `VITE_FLIP_SPEED=1 npm run build`.
const parsed = Number(import.meta.env.VITE_FLIP_SPEED);
const SPEED = Number.isFinite(parsed) && parsed > 0 ? parsed : 2;

// Base (1x) durations — the original mechanical timing.
const BASE_FLIP_FULL_MS = 80; // one full card flip
const BASE_FLIP_GAP_MS = 30; // pause between consecutive flips
const BASE_ROW_STAGGER_MS = 50; // per-row start offset
const BASE_CHAR_STAGGER_MS = 20; // per-character start offset

export const FLIP_FULL_MS = Math.round(BASE_FLIP_FULL_MS / SPEED);
export const FLIP_HALF_MS = FLIP_FULL_MS / 2; // swap the glyph at the half-flip
export const FLIP_GAP_MS = Math.round(BASE_FLIP_GAP_MS / SPEED);

export const ROW_STAGGER_MS = Math.round(BASE_ROW_STAGGER_MS / SPEED);
export const CHAR_STAGGER_MS = Math.round(BASE_CHAR_STAGGER_MS / SPEED);
