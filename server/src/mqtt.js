// MQTT state + Home Assistant discovery, with a Last Will (issue #68).
//
// Implements jeffstrout/homelab-standards docs/mqtt.md natively. This is Node,
// so the shared `homelab_appliance` Python package does not apply — but the
// topic scheme and discovery payload shapes are language agnostic and MUST
// match ac-monitor's `mqtt_out.py`, because Home Assistant entities across the
// fleet are already bound to that shape.
//
//   split_flap/status                 -> "online" | "offline"  (retained, LWT)
//   homeassistant/<comp>/split_flap/<key>/config               (retained)
//   split_flap/<domain>/<name>        -> state
//
// WHY A WALL DISPLAY PUBLISHES STATE
// It is the flakiest reporter in the fleet — WiFi-only at about -64 dBm through
// walls — and it is the one host whose death nobody notices, because you find
// out by walking past it. The LWT makes the broker announce `offline` on its
// behalf, so absence becomes the signal. Syslog cannot do that (push-only:
// quiet and dead look identical) and neither can ping (ICMP is answered by the
// kernel, so a box with wedged userspace still replies).
//
// SCOPE: the appliance's own state, never its content. Pushing content TO the
// board is already POST /api/screens/<n>; republishing board text here would
// make MQTT a second, lagging copy of something that already has an interface.
//
// DISABLED BY DEFAULT. No MQTT_HOST means no client and no error — not a
// background reconnect loop against a broker that was never configured.

const DOMAIN = 'split_flap';

export const settings = {
  host: process.env.MQTT_HOST || '',
  port: Number(process.env.MQTT_PORT) || 1883,
  username: process.env.MQTT_USER || '',
  password: process.env.MQTT_PASS || '',
  baseTopic: process.env.MQTT_BASE_TOPIC || DOMAIN,
  discoveryPrefix: process.env.MQTT_DISCOVERY_PREFIX || 'homeassistant',
};

export const isEnabled = (cfg = settings) => Boolean(cfg.host);
export const statusTopic = (cfg = settings) => `${cfg.baseTopic}/status`;

// The HA device every entity hangs off. `identifiers` is the join key —
// changing it orphans existing entities and creates duplicates, so it is
// chosen once and then frozen.
function device(cfg) {
  return {
    identifiers: [cfg.baseTopic],
    name: 'Split-Flap Display',
    manufacturer: 'DIY',
    model: 'Raspberry Pi + HDMI wall display',
  };
}

// --- pure message builders ---------------------------------------------------
// (topic, payload, retain) triples, so discovery payloads are assertable with
// no broker running. Same reason ac-monitor's builders are pure.

function entity(cfg, key, name, stateTopic, extra) {
  return {
    name,
    unique_id: `${cfg.baseTopic}_${key}`,
    state_topic: stateTopic,
    availability_topic: statusTopic(cfg),
    device: device(cfg),
    ...extra,
  };
}

export function discoveryMessages(cfg = settings) {
  const base = cfg.baseTopic;
  const out = [];
  const add = (component, key, payload) =>
    out.push([
      `${cfg.discoveryPrefix}/${component}/${base}/${key}/config`,
      JSON.stringify(payload),
      true,
    ]);

  add('sensor', 'mode', entity(cfg, 'mode', 'Mode', `${base}/mode`, { icon: 'mdi:view-dashboard' }));
  add('sensor', 'theme', entity(cfg, 'theme', 'Theme', `${base}/theme`, { icon: 'mdi:theme-light-dark' }));
  add('sensor', 'clients', entity(cfg, 'clients', 'Connected Clients', `${base}/clients`, {
    state_class: 'measurement',
    icon: 'mdi:monitor-multiple',
  }));
  add('sensor', 'screens_active', entity(cfg, 'screens_active', 'Active Screens', `${base}/screens/active`, {
    state_class: 'measurement',
    icon: 'mdi:table',
  }));
  // The availability topic doubles as this entity's state topic: "is the
  // display reachable" and "what does the LWT say" are the same question, so
  // giving it a second topic would let the two disagree.
  add('binary_sensor', 'online', entity(cfg, 'online', 'Display Online', statusTopic(cfg), {
    device_class: 'connectivity',
    payload_on: 'online',
    payload_off: 'offline',
  }));
  return out;
}

// `snapshot` is the server's live state; kept as an argument rather than
// imported so this stays testable and free of a circular import with index.js.
export function stateMessages(snapshot, cfg = settings) {
  const base = cfg.baseTopic;
  const now = Date.now();
  const activeScreens = (snapshot.screens || []).filter(
    (s) => s && s.expiresAt > now
  ).length;
  return [
    [`${base}/mode`, String(snapshot.mode ?? ''), false],
    [`${base}/theme`, String(snapshot.theme ?? ''), false],
    [`${base}/clients`, String(snapshot.clients ?? 0), false],
    [`${base}/screens/active`, String(activeScreens), false],
  ];
}

// --- publisher ---------------------------------------------------------------

async function defaultClientFactory(cfg) {
  // Imported lazily so a deployment with no broker never loads the library.
  const { connect } = await import('mqtt');
  return connect({
    host: cfg.host,
    port: cfg.port,
    username: cfg.username || undefined,
    password: cfg.password || undefined,
    // BEFORE the connection is established — a broker only honours a will
    // supplied at connection time. This ordering is the entire feature.
    will: { topic: statusTopic(cfg), payload: 'offline', retain: true, qos: 0 },
  });
}

export class MqttPublisher {
  constructor({ clientFactory = defaultClientFactory, config = settings } = {}) {
    this.factory = clientFactory;
    this.config = config;
    this.client = null;
    this.connected = false;
    this._discovered = false;
  }

  async start() {
    if (!isEnabled(this.config) || this.client) return;
    const client = await this.factory(this.config);
    this.client = client;
    // `connect` fires on every successful (re)connection, not just the first.
    // mqtt.js reconnects on its own without telling us — and by then the
    // broker has already published our retained LWT `offline` on our behalf.
    // Without re-announcing, a broker restart (every Home Assistant update is
    // one) leaves HA showing the display unavailable while it is running fine:
    // a stuck false `offline`, which for a fleet using the LWT as dead-device
    // detection is as damaging as missing a real one.
    client.on('connect', () => {
      this.connected = true;
      this._discovered = false;
      this._publish([[statusTopic(this.config), 'online', true]]);
    });
    client.on('close', () => { this.connected = false; });
    // MQTT must never be able to break the display. Swallow, don't throw.
    client.on('error', () => {});
    return client;
  }

  _publish(messages) {
    if (!this.client) return;
    for (const [topic, payload, retain] of messages) {
      this.client.publish(topic, payload, { retain: Boolean(retain) });
    }
  }

  // Called on every settings/screen change and on a heartbeat. Cheap and
  // idempotent, so callers never have to decide whether a change is worth
  // publishing.
  publishState(snapshot) {
    if (!this.client || !this.connected) return;
    if (!this._discovered) {
      this._publish(discoveryMessages(this.config));
      this._discovered = true;
    }
    this._publish(stateMessages(snapshot, this.config));
  }

  // Clean shutdown publishes `offline` explicitly: a graceful disconnect means
  // the broker will NOT fire the will.
  async stop() {
    if (!this.client) return;
    try {
      this._publish([[statusTopic(this.config), 'offline', true]]);
      await new Promise((resolve) => this.client.end(false, {}, resolve));
    } catch {
      /* best effort — teardown must not throw */
    } finally {
      this.client = null;
      this.connected = false;
      this._discovered = false;
    }
  }
}
