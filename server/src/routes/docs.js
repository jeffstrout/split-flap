// GET /api/docs — the fleet's shared API reference page.
//
// Same page, same path, same shape on every appliance
// (jeffstrout/homelab-standards docs/style-guide.md). The two FastAPI boxes
// render theirs from app.openapi(); this one declares its list, because Express
// has no schema to introspect. That difference is invisible on the page and is
// the only reason this file holds endpoint prose at all — keep GROUPS in step
// with the routers when you add an endpoint.
//
// The fleet converged ON this page rather than away from it. It was the only
// API reference that worked offline, which is why the other two dropped Swagger
// from their header links: swagger-ui loads from cdn.jsdelivr.net and renders
// an empty shell with no route out (jeffstrout/homelab-standards#7).
//
// It used to inline a partial copy of the design tokens, which was correct at
// the time — the client's CSS lives in the Vite bundle, so there was no served
// stylesheet to link. server/static now carries the vendored tokens.css and
// components.css, so this links the same two files the other appliances do and
// the duplication is gone. Still zero external requests, which is the property
// that matters and must not regress.

import { Router } from 'express';
import { ROWS, COLS } from '../config.js';

const router = Router();

const GROUPS = [
  {
    name: 'Health & build',
    blurb:
      'Liveness, provenance and the consolidated settings the setup screen reads.',
    endpoints: [
      ['GET', '/api/health', 'Liveness probe: status, uptime, connected clients, mode, commit.'],
      ['GET', '/api/version', 'The running build — commit and build time, baked in by CI.'],
      ['GET', '/api/status', 'Connected client count and board dimensions.'],
      ['GET', '/api/settings', 'Consolidated mode, theme, soundEnabled.'],
    ],
  },
  {
    name: 'Board content',
    blurb:
      'Set what the board shows. Every change is broadcast to all connected displays.',
    endpoints: [
      ['POST', '/api/message', 'Set board content. Body: { lines: string[], align?: "left"|"center" }.'],
      ['GET', '/api/message', 'Current board content.'],
      ['DELETE', '/api/message', 'Blank the board.'],
    ],
  },
  {
    name: 'Rotating screens',
    blurb:
      'Up to 6 slots rotate in the top 7 rows during flip mode, 15 seconds each. Pushed data expires 15 minutes after its last push.',
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
    blurb:
      'Switch every display between the split-flap board and the word clock.',
    endpoints: [
      ['GET', '/api/mode', 'Current mode: "flip" or "qlock".'],
      ['POST', '/api/mode/flip', 'Switch every display to the split-flap board.'],
      ['POST', '/api/mode/qlock', 'Switch every display to the word clock.'],
    ],
  },
  {
    name: 'Clock & appearance',
    blurb:
      'The legacy minute clock, plus theme and flip-sound settings.',
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

// Consequence, not the GET-green/POST-blue convention: a blue POST badge is a
// label, not something you can act on, and blue is reserved for things that are
// (homelab-standards docs/style-guide.md). safe / mutates / destroys.
const METHOD_MOD = { GET: 'get', HEAD: 'get', POST: 'post', PUT: 'post', PATCH: 'post', DELETE: 'delete' };

const BUILD = {
  commit: process.env.APP_COMMIT || 'dev',
  builtAt: process.env.APP_BUILD_TIME || 'unknown',
};

function render() {
  const total = GROUPS.reduce((n, g) => n + g.endpoints.length, 0);

  const sections = GROUPS.map(
    (g) => `<section class="hl-section">
      <h2 class="hl-section-title">${esc(g.name)}</h2>
      ${g.blurb ? `<p class="hl-note">${esc(g.blurb)}</p>` : ''}
      <div class="hl-table-wrap"><table class="hl-table"><tbody>
        ${g.endpoints
          .map(
            ([method, path, desc]) => `<tr>
              <td><span class="hl-method hl-method--${METHOD_MOD[method] || 'get'}">${esc(method)}</span></td>
              <td><code class="hl-code">${esc(path)}</code></td>
              <td>${esc(desc)}</td>
            </tr>`
          )
          .join('')}
      </tbody></table></div>
    </section>`
  ).join('');

  const build = [BUILD.commit, BUILD.builtAt !== 'unknown' ? BUILD.builtAt.slice(0, 10) : '']
    .filter(Boolean)
    .join(' · ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Split-Flap Display — API</title>
<meta name="theme-color" content="#f6f8fa">
<!-- Vendored and served by this process. No CDN: this page has to render on a
     LAN with no route to anywhere, which is when it is needed most. -->
<link rel="stylesheet" href="/static/tokens.css">
<link rel="stylesheet" href="/static/components.css">
<style>
  body {
    margin: 0; background: var(--hl-canvas); color: var(--hl-fg);
    font: var(--hl-text-base)/var(--hl-leading) var(--hl-font-sans);
  }
  .hl-table td { vertical-align: top; }
  .hl-table td:nth-child(3) { color: var(--hl-fg-muted); }
</style>
</head>
<body>
<header class="hl-header">
  <h1 class="hl-header-name">Split-Flap Display — API</h1>
  <span class="hl-header-spacer"></span>
  <nav class="hl-header-nav">
    <a class="hl-header-link" href="/setup">&larr; Setup</a>
    <a class="hl-header-link" href="/api/health" target="_blank" rel="noopener">Health</a>
    <a class="hl-header-link" href="/api/screens" target="_blank" rel="noopener">Screens&nbsp;JSON</a>
    <a class="hl-header-link" href="/">View display &rarr;</a>
  </nav>
</header>
<main class="hl-page">
  <p class="hl-note">
    Board is ${ROWS} rows &times; ${COLS} columns. Lines are uppercased and
    padded or truncated to ${COLS} characters. Every state change is broadcast to
    all connected displays over WebSocket.
  </p>
  ${sections}
</main>
<footer class="hl-footer">
  <span class="hl-num">${total}</span>&nbsp;endpoints
  <span class="hl-footer-spacer"></span>
  <span class="hl-footer-meta">${esc(build || 'dev')}</span>
</footer>
</body>
</html>`;
}

router.get('/docs', (req, res) => {
  res.type('html').send(render());
});

export default router;
