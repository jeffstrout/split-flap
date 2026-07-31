// Boot smoke tests.
//
// These spawn the real entry point as a child process rather than importing it.
// That is the point: the failure they exist to catch is module *evaluation*
// order, which only happens on a fresh load of index.js, and an in-process
// import would also bind a port and leak a live server into the rest of the
// suite.
//
// Why flip mode specifically: booting into flip calls startInfoScreen() during
// module evaluation, so it reaches broadcast() -> publishMqtt() while the rest
// of the module is still evaluating. A singleton declared below that point is
// in its temporal dead zone, and the server crash-loops on boot. That shipped
// once (the MQTT publisher, #86) and reached the wall display, because every
// other test boots nothing and the default mode is qlock — the one path that
// never calls it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('./index.js', import.meta.url));

// Boots the server on its own port and resolves once /api/health answers.
// Rejects with the child's stderr if it dies first — a crash-on-boot should
// report the stack that caused it, not a bare timeout.
async function boot(env, port) {
  const child = spawn(process.execPath, [ENTRY], {
    env: { ...process.env, PERSIST_FILE: 'off', PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  let exited = null;
  child.stderr.on('data', (d) => { stderr += d; });
  child.stdout.resume();
  // 'close', not 'exit': exit fires before the stderr pipe drains, so reporting
  // on it yields "exited with 1" and an empty stack — useless in exactly the
  // case this test exists for.
  child.on('close', (code) => { exited = code; });

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (exited !== null) {
      throw new Error(`server exited with ${exited} during boot:\n${stderr}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return { child, health: await res.json() };
    } catch {
      // not listening yet — keep polling until the deadline
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill('SIGKILL');
  throw new Error(`server never became healthy:\n${stderr}`);
}

async function stop(child) {
  child.kill('SIGKILL');
  await new Promise((resolve) => child.on('exit', resolve));
}

test('boots into flip mode without crashing', async () => {
  const { child, health } = await boot({ DEFAULT_MODE: 'flip' }, 3197);
  try {
    assert.equal(health.status, 'ok');
    assert.equal(health.mode, 'flip');
  } finally {
    await stop(child);
  }
});

test('boots into flip mode with MQTT configured', async () => {
  // MQTT_HOST set but pointing nowhere: an unreachable broker must not stop the
  // display from serving, and it exercises the publish path that the crash came
  // through with a client actually constructed.
  const { child, health } = await boot(
    { DEFAULT_MODE: 'flip', MQTT_HOST: '127.0.0.1', MQTT_PORT: '1' },
    3198,
  );
  try {
    assert.equal(health.status, 'ok');
    assert.equal(health.mode, 'flip');
  } finally {
    await stop(child);
  }
});

test('boots into qlock mode without crashing', async () => {
  const { child, health } = await boot({ DEFAULT_MODE: 'qlock' }, 3199);
  try {
    assert.equal(health.mode, 'qlock');
  } finally {
    await stop(child);
  }
});
