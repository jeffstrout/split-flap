---
name: react-flipboard-client
description: React component patterns, flip animation system, audio synthesis, WebSocket hook, and theming for the Split-Flap client. Use when building or modifying UI components, animations, or client-side logic.
---

# React Flip Board Client Patterns

## Component Hierarchy

```
App (state: lines, soundEnabled, theme)
  └─ FlipBoard (audio synthesis, onFlip callback)
      └─ FlipRow (maps text to characters) × 8
          └─ FlipChar (animation logic) × 24 per row
```

## State Management

All state lives in `App.jsx` and comes from the WebSocket:

```jsx
const [lines, setLines] = useState(Array(ROWS).fill(''.padEnd(COLS, ' ')));
const [soundEnabled, setSoundEnabled] = useState(true);
const [theme, setTheme] = useState('dark');
```

State is set from WebSocket messages — there is no local UI for changing settings.

## WebSocket Hook

`hooks/useWebSocket.js` provides:
- Auto-reconnect on disconnect (3-second delay)
- JSON message parsing
- `lastMessage` reactive value

The WebSocket URL is dynamic:
- Dev: `ws://localhost:3001` (via `import.meta.env.DEV`)
- Production: `wss://<host>/api` (derived from `window.location`)

## Flip Animation System (FlipChar.jsx)

Character set (ordered): `' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-:\'"/()@#$%&*+'`

When target changes:
1. Calculate steps to cycle forward through the character set (wraps around)
2. Stagger start delay: `rowIndex * 50 + charIndex * 20` ms
3. Per-flip: 80ms CSS animation, character swaps at 40ms midpoint
4. Inter-flip gap: 30ms

The animation uses CSS 3D transforms (rotateX) on a `.flip-card` element.

## Audio Synthesis (FlipBoard.jsx)

Procedurally generated via Web Audio API:
- Sine wave at ~4kHz × 0.3 amplitude (core tick)
- White noise × 0.15 amplitude (mechanical texture)
- Exponential decay envelope (25ms duration)
- Randomized playback rate (0.9–1.3×) and gain (0.5–0.8)
- Throttled: won't play if < 20ms since last play

Audio buffer is created on first user interaction (click/keydown/touch) to satisfy browser autoplay policies.

## Theming

Two themes via CSS class on root `.app` element:
- `.theme-dark` — black background, white text (default)
- `.theme-light` — white background, black text

Both themes use gradients on flip cards for 3D depth. Any new CSS must include both variants.

## Adding a New Component

1. Create in `client/src/components/`
2. Import and use in `App.jsx` or `FlipBoard.jsx`
3. Pass state down as props from `App`
4. If it needs server data, use the WebSocket hook or add an API call

## CSS Structure

All styles in `client/src/styles/flip.css`:
- `.app` — full viewport container
- `.flip-board` — grid container
- `.flip-row` — row of characters
- `.flip-char` — individual character cell
- `.flip-char-top` / `.flip-char-bottom` — static halves
- `.flip-card` — animated flipping element
- `.flip-card-front` / `.flip-card-back` — card faces

Width calculation: `calc((100vw - 4vw) / 24 - 0.4vw)` — the `24` divisor must match COLS.
