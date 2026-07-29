// GET /api/docs — a self-contained API reference.
//
// The two Python appliances get Swagger from FastAPI; Express has no
// equivalent, and the reference has until now lived in CLAUDE.md on GitHub —
// useless on a LAN with no internet, which is exactly when you reach for it.
// The homelab shell-header contract requires an "API docs" link on every
// appliance (jeffstrout/homelab-standards#5), so it has to resolve to something
// that works offline.
//
// Deliberately dependency-free: no stylesheet link, no fonts, no client bundle.
// It renders from a cold cache on a network with no route to anywhere, which is
// the whole reason it exists. That means it repeats a handful of token values
// inline rather than importing tokens.css — the one place in this repo where
// duplicating them is the correct call, because the alternative is a page that
// fails in the situation it was written for.
//
// Note: FastAPI's /docs pulls swagger-ui from jsdelivr, so ac-monitor's and
// syslog's API docs are the ones that actually break offline. Tracked in
// jeffstrout/homelab-standards#7.

import { Router } from 'express';
import { ROWS, COLS } from '../config.js';

const router = Router();

const GROUPS = [
  {
    name: 'Health & build',
    endpoints: [
      ['GET', '/api/health', 'Liveness probe: status, uptime, connected clients, mode, commit.'],
      ['GET', '/api/version', 'The running build — commit and build time, baked in by CI.'],
      ['GET', '/api/status', 'Connected client count and board dimensions.'],
      ['GET', '/api/settings', 'Consolidated mode, theme, soundEnabled.'],
    ],
  },
  {
    name: 'Board content',
    endpoints: [
      ['POST', '/api/message', 'Set board content. Body: { lines: string[], align?: "left"|"center" }.'],
      ['GET', '/api/message', 'Current board content.'],
      ['DELETE', '/api/message', 'Blank the board.'],
    ],
  },
  {
    name: 'Rotating screens',
    endpoints: [
      ['POST', '/api/screens/:slot', 'Push { lines, align } to slot 1–6; resets that slot’s 15-minute TTL.'],
      ['GET', '/api/screens', 'All slots with content, align, expiresAt and secondsRemaining.'],
      ['GET', '/api/screens/:slot', 'One slot.'],
      ['DELETE', '/api/screens/:slot', 'Clear one slot.'],
      ['DELETE', '/api/screens', 'Clear every slot.'],
    ],
  },
  {
    name: 'Display mode',
    endpoints: [
      ['GET', '/api/mode', 'Current mode: "flip" or "qlock".'],
      ['POST', '/api/mode/flip', 'Switch every display to the split-flap board.'],
      ['POST', '/api/mode/qlock', 'Switch every display to the word clock.'],
    ],
  },
  {
    name: 'Clock & appearance',
    endpoints: [
      ['GET', '/api/test', 'Render the current date and time to the board once.'],
      ['POST', '/api/clock/start', 'Start the legacy minute clock.'],
      ['POST', '/api/clock/stop', 'Stop it.'],
      ['GET', '/api/theme', 'Current theme.'],
      ['POST', '/api/theme/dark', 'Dark theme.'],
      ['POST', '/api/theme/light', 'Light theme.'],
      ['GET', '/api/sound', 'Flip-sound state.'],
      ['POST', '/api/sound/on', 'Enable the flip tick.'],
      ['POST', '/api/sound/off', 'Disable it.'],
    ],
  },
];

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const METHOD_COLOUR = { GET: '#1a7f37', POST: '#0969da', DELETE: '#cf222e' };

function render() {
  const groups = GROUPS.map(
    (g) => `<section>
      <h2>${esc(g.name)}</h2>
      <table>
        <tbody>
        ${g.endpoints
          .map(
            ([method, path, desc]) => `<tr>
              <td><span class="m" style="color:${METHOD_COLOUR[method]}">${esc(method)}</span></td>
              <td><code>${esc(path)}</code></td>
              <td class="d">${esc(desc)}</td>
            </tr>`
          )
          .join('')}
        </tbody>
      </table>
    </section>`
  ).join('');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Split-Flap Display — API</title>
<style>
  :root {
    --canvas:#f6f8fa; --surface:#fff; --border:#d0d7de; --fg:#1f2328; --fg-muted:#59636e;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--canvas);color:var(--fg);font:14px/1.5 var(--sans)}
  header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px;
         background:var(--surface);border-bottom:1px solid var(--border)}
  header h1{font-size:16px;font-weight:600;margin:0}
  header a{color:#0969da;text-decoration:none;font-size:13px;font-weight:500;margin-left:auto}
  header a:hover{text-decoration:underline}
  main{max-width:820px;margin:0 auto;padding:24px 16px 40px}
  p.lead{color:var(--fg-muted);margin:0 0 24px}
  h2{font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;
     color:var(--fg-muted);margin:28px 0 8px}
  table{width:100%;border-collapse:collapse;background:var(--surface);
        border:1px solid var(--border);border-radius:6px;overflow:hidden}
  td{padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:top}
  tr:last-child td{border-bottom:0}
  .m{font-family:var(--mono);font-size:12px;font-weight:600;white-space:nowrap}
  code{font-family:var(--mono);font-size:13px;white-space:nowrap}
  .d{color:var(--fg-muted);width:55%}
  @media (max-width:640px){
    table,tbody,tr,td{display:block;width:auto}
    td{border-bottom:0;padding:2px 12px}
    tr{border-bottom:1px solid var(--border);padding:8px 0}
    .d{width:auto}
  }
</style>
</head><body>
<header>
  <h1>Split-Flap Display — API</h1>
  <a href="/setup">&larr; Back to setup</a>
</header>
<main>
  <p class="lead">
    Board is ${ROWS} rows &times; ${COLS} columns. Lines are uppercased and
    padded or truncated to ${COLS} characters. Every state change is broadcast to
    all connected displays over WebSocket.
  </p>
  ${groups}
</main>
</body></html>`;
}

router.get('/docs', (req, res) => {
  res.type('html').send(render());
});

export default router;
