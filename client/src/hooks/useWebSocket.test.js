// Regression test for issue #88: the display booted into the word clock even
// when the mode was set to split-flap.
//
// The hook used to park each frame in a `lastMessage` state slot. On connect the
// server sends `message`, `settings` and `screens` back-to-back; the browser
// dispatches them in one task and React 18 batches the three setState calls into
// a single commit, so a consumer reading `lastMessage` only ever saw the last
// frame. The dropped one was `settings` — the boot mode.
//
// So the property under test is not "the hook stores a frame" but "no frame is
// lost when several are delivered in one task". That needs a real render, hence
// jsdom.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/',
});

// React reads these off the global scope at import time, so they have to be in
// place before react-dom is loaded below.
global.window = dom.window;
global.document = dom.window.document;
// Node >=21 exposes a getter-only `navigator`, so plain assignment throws.
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
global.IS_REACT_ACT_ENVIRONMENT = true;

const { default: React, useState, useCallback, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: useWebSocket } = await import('./useWebSocket.js');

// Minimal stand-in for the browser WebSocket. `emitBurst` delivers several
// frames within a single task, which is exactly how the connect-time frames
// arrive from the server.
let socket = null;
class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    socket = this;
  }
  close() {}
  emitBurst(frames) {
    for (const frame of frames) {
      this.onmessage?.({ data: JSON.stringify(frame) });
    }
  }
}

before(() => {
  global.WebSocket = FakeWebSocket;
  dom.window.WebSocket = FakeWebSocket;
});

after(() => {
  dom.window.close();
});

// Mirrors how Display consumes the hook: a mode that starts at 'qlock' and is
// only ever moved by a `settings` frame.
function Probe({ seen }) {
  const [mode, setMode] = useState('qlock');
  const onFrame = useCallback(
    (frame) => {
      seen.push(frame.type);
      if (frame.type === 'settings' && frame.data.mode) setMode(frame.data.mode);
    },
    [seen]
  );
  useWebSocket('ws://localhost:3001', onFrame);
  return React.createElement('span', { id: 'mode' }, mode);
}

test('every frame in a single-task burst is observed', () => {
  const seen = [];
  const root = createRoot(document.getElementById('root'));

  act(() => {
    root.render(React.createElement(Probe, { seen }));
  });

  act(() => {
    socket.onopen?.();
    socket.emitBurst([
      { type: 'message', data: { lines: [] } },
      { type: 'settings', data: { mode: 'flip', theme: 'dark', soundEnabled: false } },
      { type: 'screens', data: { slots: [] } },
    ]);
  });

  // Before the fix this was ['screens'] — the burst collapsed to its last frame.
  assert.deepStrictEqual(seen, ['message', 'settings', 'screens']);

  act(() => root.unmount());
});

test('a persisted flip mode survives the connect burst', () => {
  const seen = [];
  const root = createRoot(document.getElementById('root'));

  act(() => {
    root.render(React.createElement(Probe, { seen }));
  });

  act(() => {
    socket.onopen?.();
    socket.emitBurst([
      { type: 'message', data: { lines: [] } },
      { type: 'settings', data: { mode: 'flip', theme: 'dark', soundEnabled: false } },
      { type: 'screens', data: { slots: [] } },
    ]);
  });

  // The bug in one assertion: the board is set to flip, so it must not render
  // the word clock.
  assert.strictEqual(document.getElementById('mode').textContent, 'flip');

  act(() => root.unmount());
});
