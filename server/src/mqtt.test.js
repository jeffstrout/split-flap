// MQTT publisher tests (issue #68).
//
// No broker, no network. The client is injected, which is the whole reason the
// message builders are pure and the publisher takes a factory — the behaviour
// worth testing here (will ordering, reconnect re-announcement, clean-stop
// offline) is invisible until the day it matters, which is the day the display
// dies and nobody notices.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MqttPublisher,
  discoveryMessages,
  stateMessages,
  isEnabled,
  statusTopic,
} from './mqtt.js';

const CFG = {
  host: '10.0.0.5',
  port: 1883,
  username: '',
  password: '',
  baseTopic: 'split_flap',
  discoveryPrefix: 'homeassistant',
};

class FakeClient {
  constructor() {
    this.published = [];
    this.handlers = {};
    this.ended = false;
  }
  on(event, fn) { this.handlers[event] = fn; }
  emit(event, ...args) { this.handlers[event]?.(...args); }
  publish(topic, payload, opts = {}) {
    this.published.push([topic, payload, Boolean(opts.retain)]);
  }
  end(_force, _opts, cb) { this.ended = true; cb?.(); }
  topics() { return this.published.map(([t]) => t); }
  find(topic) { return this.published.filter(([t]) => t === topic); }
}

function publisher(fake, config = CFG) {
  return new MqttPublisher({ clientFactory: async () => fake, config });
}

async function connected(fake, config = CFG) {
  const pub = publisher(fake, config);
  await pub.start();
  fake.emit('connect');
  return pub;
}

// --- enablement --------------------------------------------------------------

test('disabled with no host — no client, no error', async () => {
  const fake = new FakeClient();
  const pub = publisher(fake, { ...CFG, host: '' });
  await pub.start();
  assert.equal(pub.client, null);
  assert.deepEqual(fake.published, []);
});

test('isEnabled keys off the host alone', () => {
  assert.equal(isEnabled({ ...CFG, host: '' }), false);
  assert.equal(isEnabled(CFG), true);
});

// --- availability ------------------------------------------------------------

test('announces retained online on connect', async () => {
  const fake = new FakeClient();
  await connected(fake);
  assert.deepEqual(fake.find(statusTopic(CFG)), [['split_flap/status', 'online', true]]);
});

test('reconnect re-announces online and re-sends discovery', async () => {
  // The bug this exists for: mqtt.js reconnects silently, and by then the
  // broker has already published our retained LWT offline on our behalf.
  const fake = new FakeClient();
  const pub = await connected(fake);
  pub.publishState({ mode: 'flip', theme: 'dark', clients: 1, screens: [] });
  fake.published.length = 0;

  fake.emit('connect');
  pub.publishState({ mode: 'flip', theme: 'dark', clients: 1, screens: [] });

  assert.ok(fake.find('split_flap/status').some(([, p, r]) => p === 'online' && r));
  assert.ok(fake.topics().includes('homeassistant/sensor/split_flap/mode/config'));
});

test('stop() publishes offline, because a clean disconnect fires no will', async () => {
  const fake = new FakeClient();
  const pub = await connected(fake);
  await pub.stop();
  assert.ok(fake.find('split_flap/status').some(([, p, r]) => p === 'offline' && r));
  assert.ok(fake.ended);
  assert.equal(pub.client, null);
});

// --- discovery ---------------------------------------------------------------

test('discovery covers every entity the contract lists, retained', () => {
  const msgs = discoveryMessages(CFG);
  const topics = msgs.map(([t]) => t);
  for (const t of [
    'homeassistant/sensor/split_flap/mode/config',
    'homeassistant/sensor/split_flap/theme/config',
    'homeassistant/sensor/split_flap/clients/config',
    'homeassistant/sensor/split_flap/screens_active/config',
    'homeassistant/binary_sensor/split_flap/online/config',
  ]) {
    assert.ok(topics.includes(t), `missing ${t}`);
  }
  assert.ok(msgs.every(([, , retain]) => retain === true), 'discovery must be retained');
});

test('every entity points at the availability topic', () => {
  for (const [, payload] of discoveryMessages(CFG)) {
    assert.equal(JSON.parse(payload).availability_topic, 'split_flap/status');
  }
});

test('unique_id and device identifiers are namespaced to the appliance', () => {
  // The device identifier is the HA join key: changing it orphans existing
  // entities and creates duplicates.
  for (const [, payload] of discoveryMessages(CFG)) {
    const p = JSON.parse(payload);
    assert.ok(p.unique_id.startsWith('split_flap_'), p.unique_id);
    assert.deepEqual(p.device.identifiers, ['split_flap']);
  }
});

test('the connectivity sensor reads the availability topic directly', () => {
  const [, payload] = discoveryMessages(CFG).find(([t]) => t.includes('binary_sensor'));
  const p = JSON.parse(payload);
  assert.equal(p.state_topic, 'split_flap/status');
  assert.equal(p.device_class, 'connectivity');
  assert.equal(p.payload_on, 'online');
  assert.equal(p.payload_off, 'offline');
});

test('base topic and discovery prefix are configurable', () => {
  const cfg = { ...CFG, baseTopic: 'flap2', discoveryPrefix: 'ha' };
  const topics = discoveryMessages(cfg).map(([t]) => t);
  assert.ok(topics.every((t) => t.startsWith('ha/')));
  assert.ok(topics.some((t) => t.includes('/flap2/')));
  assert.equal(statusTopic(cfg), 'flap2/status');
});

// --- state -------------------------------------------------------------------

test('state messages carry mode, theme, clients and active screens', () => {
  const now = Date.now();
  const msgs = stateMessages(
    {
      mode: 'flip',
      theme: 'light',
      clients: 3,
      screens: [
        { expiresAt: now + 60000 },
        null,
        { expiresAt: now - 1000 }, // expired — must not count
      ],
    },
    CFG
  );
  assert.deepEqual(msgs, [
    ['split_flap/mode', 'flip', false],
    ['split_flap/theme', 'light', false],
    ['split_flap/clients', '3', false],
    ['split_flap/screens/active', '1', false],
  ]);
});

test('state is not retained — it is live, and a stale retained value would lie', () => {
  const msgs = stateMessages({ mode: 'qlock', theme: 'dark', clients: 0, screens: [] }, CFG);
  assert.ok(msgs.every(([, , retain]) => retain === false));
});

test('board content is never published', () => {
  // Scope guard: MQTT carries the appliance's state, not what is on the board.
  const msgs = stateMessages(
    { mode: 'flip', theme: 'dark', clients: 1, screens: [], currentMessage: { lines: ['SECRET'] } },
    CFG
  );
  assert.ok(!JSON.stringify(msgs).includes('SECRET'));
});

test('discovery is sent once, state on every publish', async () => {
  const fake = new FakeClient();
  const pub = await connected(fake);
  const snap = { mode: 'flip', theme: 'dark', clients: 1, screens: [] };
  pub.publishState(snap);
  pub.publishState(snap);
  const topics = fake.topics();
  assert.equal(topics.filter((t) => t === 'homeassistant/sensor/split_flap/mode/config').length, 1);
  assert.equal(topics.filter((t) => t === 'split_flap/mode').length, 2);
});

test('publishState before connect is a no-op rather than a crash', () => {
  const pub = publisher(new FakeClient());
  assert.doesNotThrow(() => pub.publishState({ mode: 'flip', theme: 'dark', clients: 0, screens: [] }));
});

test('a client error does not throw — MQTT must never break the display', async () => {
  const fake = new FakeClient();
  await connected(fake);
  assert.doesNotThrow(() => fake.emit('error', new Error('ECONNREFUSED')));
});
