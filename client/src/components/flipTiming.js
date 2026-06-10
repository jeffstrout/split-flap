// Split-flap animation timing — single source of truth (issue #42).
//
// These are 2x the original speed: the per-flip durations and the per-tile
// stagger were halved. FlipChar drives the JS step timings; FLIP_FULL_MS is
// also pushed to CSS as `--flip-duration` (see main.jsx) so the card transition
// stays in lockstep.
export const FLIP_FULL_MS = 40; // one full card flip (was 80)
export const FLIP_HALF_MS = FLIP_FULL_MS / 2; // swap the glyph at the half-flip
export const FLIP_GAP_MS = 15; // pause between consecutive flips (was 30)

export const ROW_STAGGER_MS = 25; // per-row start offset (was 50)
export const CHAR_STAGGER_MS = 10; // per-character start offset (was 20)
