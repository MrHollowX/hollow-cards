const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const CARDS_DIRECTORY = path.join(ROOT, 'home-dark-cards');
const SOURCE_FILES = [
  'home-appliance-card.js',
  'home-camera-grid-card.js',
  'home-climate-card.js',
  'home-cover-card.js',
  'home-door-security-card.js',
  'home-energy-overview-card.js',
  'home-entity-status-card.js',
  'home-floating-menu-card.js',
  'home-group-card.js',
  'home-header-card.js',
  'home-light-card.js',
  'home-person-card.js',
  'home-room-tile-card.js',
  'home-status-card.js',
  'home-switch-card.js',
  'home-vacuum-card.js',
];

const sourcePath = (file) => path.join(CARDS_DIRECTORY, file);
const readSource = (file) => fs.readFileSync(sourcePath(file), 'utf8');
const cardType = (file) => file.slice(0, -'.js'.length);

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...values) {
    values.forEach((value) => this.values.add(value));
  }

  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

class FakeStyle {
  setProperty(name, value) {
    this[name] = String(value);
  }

  removeProperty(name) {
    delete this[name];
  }
}

class FakeHTMLElement {
  constructor(localName = '') {
    this.localName = localName;
    this.tagName = localName.toUpperCase();
    this.dataset = {};
    this.classList = new FakeClassList();
    this.style = new FakeStyle();
    this.hidden = false;
    this.disabled = false;
    this.inert = false;
    this.isConnected = true;
    this.parentElement = null;
    this.shadowRoot = null;
    this._attributes = new Map();
    this._children = [];
    this._listeners = new Map();
  }

  attachShadow() {
    const root = new FakeHTMLElement('#shadow-root');
    root.host = this;
    root.activeElement = null;
    this.shadowRoot = root;
    return root;
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  dispatchEvent() {
    return true;
  }

  append(...children) {
    children.forEach((child) => {
      if (child && typeof child === 'object') child.parentElement = this;
      this._children.push(child);
    });
  }

  prepend(...children) {
    children.reverse().forEach((child) => {
      if (child && typeof child === 'object') child.parentElement = this;
      this._children.unshift(child);
    });
  }

  replaceChildren(...children) {
    this._children = [];
    this.append(...children);
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentElement || current.host || null;
    }
    return false;
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }

  removeAttribute(name) {
    this._attributes.delete(name);
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }

  matches() {
    return false;
  }

  focus() {
    this.focused = true;
  }

  blur() {
    this.focused = false;
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, right: 320, bottom: 180, width: 320, height: 180 };
  }

  getRootNode() {
    return this.parentElement?.getRootNode?.() || this;
  }
}

function createRuntime() {
  const registry = new Map();
  const defineCounts = new Map();
  const document = new FakeHTMLElement('document');
  document.hidden = false;
  document.activeElement = null;
  document.documentElement = { clientWidth: 1024, clientHeight: 768 };
  document.createElement = (name) => new FakeHTMLElement(name);

  const window = new FakeHTMLElement('window');
  window.customCards = [];
  window.innerWidth = 1024;
  window.innerHeight = 768;
  window.location = {
    origin: 'https://home.example',
    pathname: '/home-dark/home',
    search: '',
    hash: '',
  };
  window.history = {
    state: null,
    pushState(state, _title, target) {
      this.state = state;
      const url = new URL(target, window.location.origin);
      window.location.pathname = url.pathname;
      window.location.search = url.search;
      window.location.hash = url.hash;
    },
  };
  window.confirm = () => true;
  window.open = () => {};

  const customElements = {
    define(name, constructor) {
      if (registry.has(name)) throw new Error(`Duplicate custom element: ${name}`);
      registry.set(name, constructor);
      defineCounts.set(name, (defineCounts.get(name) || 0) + 1);
    },
    get(name) {
      return registry.get(name);
    },
  };

  class FakeIntersectionObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }

  class FakeResizeObserver {
    observe() {}
    disconnect() {}
  }

  let animationFrame = 0;
  const sandbox = {
    CSS: { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&') },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        Object.assign(this, options);
      }
    },
    Element: FakeHTMLElement,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    HTMLElement: FakeHTMLElement,
    IntersectionObserver: FakeIntersectionObserver,
    ResizeObserver: FakeResizeObserver,
    URL,
    cancelAnimationFrame: () => {},
    clearInterval,
    clearTimeout,
    console,
    customElements,
    document,
    queueMicrotask,
    requestAnimationFrame: () => ++animationFrame,
    setInterval,
    setTimeout,
    window,
  };
  window.requestAnimationFrame = sandbox.requestAnimationFrame;
  window.cancelAnimationFrame = sandbox.cancelAnimationFrame;
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;

  return {
    context: vm.createContext(sandbox),
    customElements,
    defineCounts,
    document,
    registry,
    window,
  };
}

function evaluateSource(file, runtime = createRuntime()) {
  const source = readSource(file);
  vm.runInContext(
    `(function homeDarkCardModule(){\n${source}\n}).call(window);`,
    runtime.context,
    { filename: sourcePath(file) },
  );
  return runtime;
}

function loadCard(file) {
  const runtime = evaluateSource(file);
  const type = cardType(file);
  return {
    ...runtime,
    Card: runtime.customElements.get(type),
    source: readSource(file),
    type,
  };
}

function fakeNode() {
  return new FakeHTMLElement('span');
}

function settlePromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test('the invariant suite covers exactly the 16 source cards', () => {
  const actual = fs.readdirSync(CARDS_DIRECTORY)
    .filter((file) => file.endsWith('.js'))
    .sort();
  assert.deepEqual(actual, [...SOURCE_FILES].sort());
});

test('all source cards are safe to register twice in one page session', () => {
  const runtime = createRuntime();

  for (let round = 0; round < 2; round += 1) {
    SOURCE_FILES.forEach((file) => evaluateSource(file, runtime));
  }

  SOURCE_FILES.forEach((file) => {
    const type = cardType(file);
    assert.equal(typeof runtime.customElements.get(type), 'function', `${type} is registered`);
    assert.equal(runtime.defineCounts.get(type), 1, `${type} is defined once`);
    assert.equal(
      runtime.window.customCards.filter((entry) => entry?.type === type).length,
      1,
      `${type} picker metadata is de-duplicated`,
    );
  });
  assert.equal(runtime.defineCounts.get('home-cover-card-editor'), 1);
  assert.equal(runtime.window.customCards.length, SOURCE_FILES.length);
});

test('appliance card CSS keeps every button selector card-scoped', () => {
  const { Card } = loadCard('home-appliance-card.js');
  const css = new Card()._css();
  let inspected = 0;

  for (const match of css.matchAll(/([^{}]+)\{/g)) {
    const header = match[1].trim();
    if (!header || header.startsWith('@')) continue;
    header.split(',').map((selector) => selector.trim()).forEach((selector) => {
      if (!/\bbutton\b/.test(selector)) return;
      inspected += 1;
      assert.match(selector, /^home-appliance-card(?:\b|\s|>)/, selector);
    });
  }
  assert.ok(inspected >= 8, 'the test inspected the appliance button rule set');
});

test('cover editor hooks are static and expose the current editor contract', () => {
  const { Card, customElements } = loadCard('home-cover-card.js');
  assert.equal(Object.hasOwn(Card, 'getConfigElement'), true);
  assert.equal(Object.hasOwn(Card, 'getStubConfig'), true);
  assert.equal(Object.hasOwn(Card.prototype, 'getConfigElement'), false);
  assert.equal(Card.getConfigElement().localName, 'home-cover-card-editor');
  assert.deepEqual(
    { ...Card.getStubConfig() },
    {
      kind: 'blinds',
      entity: 'cover.example',
      name: 'Blinds',
      half_open_position: 50,
      show_tilt_buttons: true,
    },
  );
  assert.equal(typeof customElements.get('home-cover-card-editor'), 'function');
});

test('cover tilt controls require SET_TILT_POSITION and preserve zero values', () => {
  const { Card } = loadCard('home-cover-card.js');
  const card = new Card();
  card.setConfig({ kind: 'blinds', entity: 'cover.blind', show_tilt_buttons: true });
  const room = card._config.rooms[0];
  card._hass = {
    states: {
      'cover.blind': {
        state: 'open',
        attributes: { supported_features: 128, current_position: 50, current_tilt_position: 0 },
      },
    },
  };

  const html = card._renderEntity(room, 'cover.blind', 0);
  assert.equal((html.match(/data-tilt-position=/g) || []).length, 4);
  assert.match(html, /data-tilt-position="0"/);
  assert.equal(card._serviceSupported('cover.blind', 'set_cover_tilt_position'), true);

  card._hass.states['cover.blind'].attributes.supported_features = 16 | 32 | 64;
  assert.doesNotMatch(card._renderEntity(room, 'cover.blind', 0), /data-tilt-position=/);
  assert.equal(card._serviceSupported('cover.blind', 'set_cover_tilt_position'), false);

  const calls = [];
  card._call = (...args) => calls.push(args);
  card._invokeButton({
    dataset: { entity: 'cover.blind', position: '0' },
    hasAttribute: (name) => name === 'data-position',
  });
  card._invokeButton({
    dataset: { entity: 'cover.blind', tiltPosition: '0' },
    hasAttribute: (name) => name === 'data-tilt-position',
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'cover.blind');
  assert.equal(calls[0][1], 'set_cover_position');
  assert.equal(calls[0][2].position, 0);
  assert.equal(calls[1][0], 'cover.blind');
  assert.equal(calls[1][1], 'set_cover_tilt_position');
  assert.equal(calls[1][2].tilt_position, 0);
});

test('cover availability disables UI and blocks unavailable service calls', () => {
  const { Card } = loadCard('home-cover-card.js');
  const card = new Card();
  card.setConfig({ kind: 'blinds', entity: 'cover.blind' });
  const calls = [];
  card._hass = {
    states: {
      'cover.blind': {
        state: 'unavailable',
        attributes: {
          supported_features: 255,
          current_position: 50,
          current_tilt_position: 25,
        },
      },
    },
    callService: (...args) => calls.push(args),
  };

  const html = card._renderEntity(card._config.rooms[0], 'cover.blind', 0);
  const controls = html.match(/<(?:button|input)\b[^>]*>/g) || [];
  assert.ok(controls.length >= 8);
  controls.forEach((control) => assert.match(control, /\sdisabled(?:\s|>)/));
  assert.equal(card._call('cover.blind', 'open_cover'), undefined);
  assert.equal(calls.length, 0);

  card._hass.states['cover.blind'].state = 'open';
  card._call('cover.blind', 'open_cover');
  assert.equal(calls.length, 1);
});

test('room tile uses a semantic button and property-based dynamic DOM updates', () => {
  const { Card } = loadCard('home-room-tile-card.js');
  const render = Card.prototype._render.toString();
  assert.match(render, /<button class="tile" type="button">/);
  assert.match(render, /this\._name\.textContent\s*=\s*String\(c\.name\)/);
  assert.match(render, /this\._mainicon\.setAttribute\('icon'/);
  assert.match(render, /this\._icons\.replaceChildren\(\.\.\.iconNodes\)/);
  assert.doesNotMatch(render, /this\._name\.innerHTML/);
  assert.doesNotMatch(render, /\$\{c\.name\}/);
});

test('entity status horizontal layout keeps one row without filler background', () => {
  const { Card } = loadCard('home-entity-status-card.js');
  const card = new Card();
  const css = card._css();
  const horizontalRule = css.match(/\.metrics\.horizontal\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(Card.prototype._render.toString(), /Math\.max\(1, Math\.min\(6, metrics\.length\)\)/);
  assert.match(horizontalRule, /flex-direction:row/);
  assert.doesNotMatch(horizontalRule, /display:grid/);
  assert.doesNotMatch(horizontalRule, /background:/);
  assert.match(
    css,
    /\.metrics\.horizontal\.metric-vertical\s*\{[^}]*grid-template-columns:repeat\(var\(--metric-count\),minmax\(0,1fr\)\)/s,
  );
  assert.match(css, /\.metrics\.horizontal\.metric-vertical \.metric \+ \.metric::before/);
});

test('header omits the feels-like temperature from its weather summary', () => {
  const source = readSource('home-header-card.js');
  assert.doesNotMatch(source, /class="apparent"/);
  assert.doesNotMatch(source, /apparentTemperature/);
  assert.doesNotMatch(source, /Feels \$\{/);
  assert.doesNotMatch(source, /\.apparent\{/);
});

test('status show_aqi false avoids state reads and removes the AQI metric', () => {
  const { Card } = loadCard('home-status-card.js');
  const card = new Card();
  card.setConfig({
    house_mode_entity: 'input_select.mode',
    pm25_entity: 'sensor.pm25',
    pm10_entity: 'sensor.pm10',
    aqi_entity: 'sensor.aqi',
    show_aqi: false,
  });

  const mode = { state: 'Home', attributes: { options: ['Home'] }, last_updated: new Date().toISOString() };
  const pm25 = { state: '5', attributes: { unit_of_measurement: 'µg/m³' }, last_updated: mode.last_updated };
  const pm10 = { state: '10', attributes: { unit_of_measurement: 'µg/m³' }, last_updated: mode.last_updated };
  let aqiReads = 0;
  const states = {
    'input_select.mode': mode,
    'sensor.pm25': pm25,
    'sensor.pm10': pm10,
  };
  Object.defineProperty(states, 'sensor.aqi', {
    configurable: true,
    enumerable: true,
    get() {
      aqiReads += 1;
      return { state: '42', attributes: {} };
    },
  });

  card._shell = true;
  card._card = fakeNode();
  card._homeIcon = fakeNode();
  card._title = fakeNode();
  card._modeLabel = fakeNode();
  card._modeTrigger = fakeNode();
  card._modeValue = fakeNode();
  card._modeOptionsPanel = fakeNode();
  card._detailsToggle = fakeNode();
  card._detailsIcon = fakeNode();
  card._details = fakeNode();
  card._metricsContainer = fakeNode();
  card._updated = fakeNode();
  const metric = () => ({
    element: fakeNode(),
    icon: fakeNode(),
    label: fakeNode(),
    status: fakeNode(),
    value: fakeNode(),
  });
  card._metrics = { pm25: metric(), pm10: metric(), aqi: metric() };
  card._optionKey = JSON.stringify(['Home']);
  card._hass = { states };
  card._render();

  assert.equal(aqiReads, 0);
  assert.equal(card._metrics.aqi.element.hidden, true);
  assert.equal(card._metrics.aqi.element.dataset.entity, '');
  assert.equal(card._metricsContainer.style.gridTemplateColumns, 'repeat(2,minmax(0,1fr))');
});

test('status mode requests ignore stale failures and reconcile current authority', async () => {
  const { Card } = loadCard('home-status-card.js');
  const card = new Card();
  card.setConfig({
    house_mode_entity: 'input_select.mode',
    pm25_entity: 'sensor.pm25',
    pm10_entity: 'sensor.pm10',
  });
  const state = { state: 'Home', attributes: { options: ['Home', 'Away', 'Night'] } };
  const requests = [];
  card._hass = {
    states: { 'input_select.mode': state },
    callService: () => {
      const request = deferred();
      requests.push(request);
      return request.promise;
    },
  };
  card._render = () => {};

  try {
    card._selectMode('Away');
    await settlePromises();
    card._selectMode('Night');
    await settlePromises();
    assert.equal(requests.length, 2);

    requests[0].reject(new Error('stale request failed'));
    await settlePromises();
    assert.equal(card._pendingMode, 'Night');

    state.state = 'Night';
    requests[1].resolve();
    await settlePromises();
    assert.equal(card._pendingMode, '');
    assert.equal(card._pendingModeTimer, null);
  } finally {
    card._invalidateModeRequest();
  }
});

test('person presence is exact-home and authoritative states are not GPS-overridden', () => {
  const { Card } = loadCard('home-person-card.js');
  const card = new Card();
  card.setConfig({ entity: 'person.alex', show_location: true, show_proximity: true });
  assert.equal(card._presence('home'), 'home');
  assert.equal(card._presence('Home'), 'away');
  assert.equal(card._presence('work'), 'away');

  const nodes = {
    avatar: fakeNode(),
    avatarIcon: fakeNode(),
    avatarImage: fakeNode(),
    battery: fakeNode(),
    batteryIcon: fakeNode(),
    batteryValue: fakeNode(),
    button: fakeNode(),
    details: fakeNode(),
    name: fakeNode(),
    statusIcon: fakeNode(),
    statusValue: fakeNode(),
  };
  card._ensureShell = () => {
    card._nodes = nodes;
    card._shellReady = true;
  };
  card._hass = {
    config: { unit_system: { length: 'km' } },
    states: {
      'person.alex': {
        state: 'not_home',
        attributes: { friendly_name: 'Alex', latitude: 44, longitude: 26 },
      },
      'zone.home': {
        state: '0',
        attributes: { friendly_name: 'Home', latitude: 44, longitude: 26, radius: 100 },
      },
    },
  };
  let coordinateLookups = 0;
  card._zoneAtCoordinates = () => {
    coordinateLookups += 1;
    return card._hass.states['zone.home'];
  };
  card._render();

  assert.equal(coordinateLookups, 0);
  assert.equal(nodes.button.dataset.presence, 'away');
  assert.equal(nodes.statusValue.textContent, 'Away');
});

test('person zone scans are cached by hass states identity', () => {
  const { Card } = loadCard('home-person-card.js');
  const card = new Card();
  const target = {
    'person.alex': { state: 'away', attributes: {} },
    'zone.home': {
      state: '0',
      attributes: { friendly_name: 'Home', latitude: 44, longitude: 26, radius: 100 },
    },
    'zone.work': {
      state: '0',
      attributes: { friendly_name: 'Work', latitude: 44.4, longitude: 26.1, radius: 75 },
    },
  };
  let scans = 0;
  const states = new Proxy(target, {
    ownKeys(object) {
      scans += 1;
      return Reflect.ownKeys(object);
    },
  });
  card._hass = { states };

  const first = card._zoneIndex();
  const second = card._zoneIndex();
  assert.equal(first, second);
  assert.equal(scans, 1);
  assert.equal(first.zones.length, 2);
  assert.equal(first.byName.get('work'), target['zone.work']);
});

test('floating menu defaults to six live routes and route/resize updates do not rebuild', () => {
  const { Card, window } = loadCard('home-floating-menu-card.js');
  Card._instances.clear();
  Card._lastKnownRoute = '';
  Card._lastSyncedPath = '';
  const card = new Card();
  let builds = 0;
  let positions = 0;
  card._buildMenu = () => {
    builds += 1;
    card._menu = fakeNode();
  };
  card._schedulePosition = () => {
    positions += 1;
  };
  card.setConfig({});

  assert.deepEqual(
    Array.from(card._config.tabs, (tab) => tab.id),
    ['home', 'lights', 'climate', 'blinds', 'media', 'vacuum'],
  );
  assert.equal(card._config.tabs.find((tab) => tab.id === 'blinds').path, '/home-dark/blinds');
  assert.equal(builds, 1);

  card._connected = true;
  Card._instances.add(card);
  Card._syncInstances();
  window.location.hash = '#living-room';
  Card._handleLocationChanged();
  window.location.pathname = '/home-dark/lights';
  Card._handleLocationChanged();
  Card._handleResize();

  assert.equal(builds, 1);
  assert.equal(positions, 1);
  card.setConfig({ current: 'lights', view_path: 'lights' });
  assert.equal(builds, 1, 'highlight and view arbitration changes keep the existing menu DOM');
  Card._instances.clear();
});

test('camera snapshot configuration enforces the refresh contract', () => {
  const { Card } = loadCard('home-camera-grid-card.js');
  const baseConfig = {
    camera_groups: [{ title: 'Entry', cameras: [{ entity: 'camera.entry' }] }],
  };
  const card = new Card();
  card._render = () => {};
  card.setConfig(baseConfig);
  assert.equal(card._config.snapshot_refresh_seconds, 30);
  card.setConfig({ ...baseConfig, snapshot_refresh_seconds: 0 });
  assert.equal(card._config.snapshot_refresh_seconds, 0);
  card.setConfig({ ...baseConfig, snapshot_refresh_seconds: 5 });
  assert.equal(card._config.snapshot_refresh_seconds, 5);
  card.setConfig({ ...baseConfig, snapshot_refresh_seconds: 300 });
  assert.equal(card._config.snapshot_refresh_seconds, 300);
  assert.throws(() => card.setConfig({ ...baseConfig, snapshot_refresh_seconds: 4 }));
  assert.throws(() => card.setConfig({ ...baseConfig, snapshot_refresh_seconds: 301 }));
  assert.throws(() => card.setConfig({ ...baseConfig, snapshot_refresh_seconds: true }));
});

test('camera snapshot sources update only while active and clear when unavailable', () => {
  const { Card, document } = loadCard('home-camera-grid-card.js');
  const card = new Card();
  const state = { state: 'idle', attributes: { access_token: 'first', friendly_name: 'Entry' } };
  card._config = {
    camera_icon: 'mdi:video-outline',
    unavailable_icon: 'mdi:camera-off-outline',
    snapshot_refresh_seconds: 30,
  };
  card._hass = { states: { 'camera.entry': state } };
  card._connected = true;
  card._isIntersecting = false;
  card._isWithinViewport = () => true;

  const record = {
    available: false,
    config: { entity: 'camera.entry', name: '' },
    image: fakeNode(),
    labelIcon: fakeNode(),
    labelText: fakeNode(),
    loadedSnapshotBase: '',
    openLive: fakeNode(),
    pill: fakeNode(),
    pillText: fakeNode(),
    snapshotBase: '',
    snapshotDirty: false,
    tile: fakeNode(),
    unavailable: fakeNode(),
    unavailableIcon: fakeNode(),
  };
  card._groups = [{ cameras: [record] }];
  card._patchGroups = () => card._patchCamera(record);

  card._patchCamera(record);
  assert.equal(record.image.hasAttribute('src'), false);
  assert.equal(card._refreshSnapshots(false), 0);

  card._isIntersecting = true;
  assert.equal(card._refreshSnapshots(false), 1);
  const activeSource = record.image.getAttribute('src');
  assert.match(activeSource, /^\/api\/camera_proxy\/camera\.entry\?token=first&_/);

  document.hidden = true;
  state.attributes.access_token = 'second';
  card._patchCamera(record);
  assert.equal(record.snapshotDirty, true);
  assert.equal(card._refreshSnapshots(false), 0);
  assert.equal(record.image.getAttribute('src'), activeSource);

  state.state = 'unavailable';
  card._patchCamera(record);
  assert.equal(record.image.hasAttribute('src'), false);
  assert.equal(record.available, false);
  assert.equal(record.snapshotDirty, false);
});

test('camera disconnect stops observers and refresh timers', () => {
  const { Card } = loadCard('home-camera-grid-card.js');
  const card = new Card();
  let disconnected = 0;
  card._connected = true;
  card._intersectionObserver = {
    disconnect() {
      disconnected += 1;
    },
  };
  card._refreshActive = true;
  card._refreshTimer = setTimeout(() => {}, 10_000);
  card.disconnectedCallback();
  assert.equal(disconnected, 1);
  assert.equal(card._connected, false);
  assert.equal(card._refreshActive, false);
  assert.equal(card._refreshTimer, null);
});

test('door security snapshot refresh and age lifecycle are defined and safe', () => {
  const { Card } = loadCard('home-door-security-card.js');
  const card = new Card();
  card.setConfig({
    camera_entity: 'camera.entry',
    lock_entity: 'lock.front',
    snapshot_refresh_seconds: 5,
  });

  const image = fakeNode();
  const fallback = fakeNode();
  fallback.lastElementChild = fakeNode();
  card._image = image;
  card._fallback = fallback;
  card._shell = true;
  card._connected = true;
  card._isIntersecting = true;
  card._hass = {
    states: {
      'camera.entry': {
        state: 'idle',
        attributes: { access_token: 'first', friendly_name: 'Entry' },
      },
    },
  };

  card._updateCameraImage(card._state('camera.entry'));
  const firstSource = image.getAttribute('src');
  assert.match(firstSource, /^\/api\/camera_proxy\/camera\.entry\?token=first&_=/);
  assert.equal(card._cameraAvailable, true);
  assert.equal(typeof card._patchCameraPreview, 'function');
  assert.equal(typeof card._clearAgeTimer, 'function');
  assert.equal(typeof card._onAgeTimer, 'function');

  card._refreshSnapshot(false);
  assert.notEqual(image.getAttribute('src'), firstSource);

  card._hass.states['camera.entry'].state = 'unavailable';
  card._patchCameraPreview(card._state('camera.entry'));
  assert.equal(card._cameraAvailable, false);
  assert.equal(image.hasAttribute('src'), false);
});

test('door lock command rechecks the authoritative state before acting', () => {
  const { Card } = loadCard('home-door-security-card.js');
  const card = new Card();
  card.setConfig({ camera_entity: 'camera.entry', lock_entity: 'lock.front' });
  const calls = [];
  card._hass = {
    states: { 'lock.front': { state: 'unlocked', attributes: {} } },
    callService: (...args) => calls.push(args),
  };

  assert.equal(card._callLock('unlock'), false);
  assert.equal(calls.length, 0);
  assert.equal(card._callLock('lock'), true);
  assert.equal(calls.length, 1);
});

test('door security supports hiding the visible lock name', () => {
  const source = readSource('home-door-security-card.js');
  assert.match(source, /show_lock_name:c\.show_lock_name!==false/);
  assert.match(source, /visibleLockState=this\._c\.show_lock_name\?`\$\{this\._c\.lock_label\}: \$\{lockStateText\}`:lockStateText/);
  assert.match(source, /this\._lockState\.textContent=visibleLockState/);
});

test('climate availability gates services and focused controls defer state renders', () => {
  const { Card } = loadCard('home-climate-card.js');
  const card = new Card();
  card.setConfig({
    entity: 'climate.main',
    additional_entities: [{ entity: 'climate.extra' }],
    additional_entities_collapsible: false,
  });
  const calls = [];
  card._hass = {
    states: {
      'climate.main': { state: 'unavailable', attributes: {} },
      'climate.extra': { state: 'cool', attributes: { friendly_name: 'Extra' } },
    },
    callService: (...args) => calls.push(args),
  };
  assert.equal(card._call('set_hvac_mode', { hvac_mode: 'cool' }), null);
  assert.equal(calls.length, 0);
  assert.match(card._additionalControls(), /climate\.extra|Extra/);

  card._hasTargetInteractionFocus = () => true;
  let renders = 0;
  card._render = () => {
    renders += 1;
  };
  card.hass = card._hass;
  assert.equal(card._deferredRender, true);
  assert.equal(renders, 0);
});

test('climate disconnect clears stale focus and deferred interaction state', () => {
  const { Card } = loadCard('home-climate-card.js');
  const card = new Card();
  card.setConfig({ entity: 'climate.main' });
  card._wired = true;
  card._focusedControl = fakeNode();
  card._menuFocusTransition = true;
  card._menuRenderAllowed = true;
  card._openMenu = 'hvac_mode';
  card._deferredRender = true;
  card._queuedFocusMenu = 'hvac_mode';
  card._pointerFocusControl = fakeNode();
  card.disconnectedCallback();

  assert.equal(card._focusedControl, null);
  assert.equal(card._menuFocusTransition, false);
  assert.equal(card._menuRenderAllowed, false);
  assert.equal(card._openMenu, null);
  assert.equal(card._deferredRender, false);
  assert.equal(card._queuedFocusMenu, null);
  assert.equal(card._pointerFocusControl, null);
});

test('vacuum actions require availability and current feature bits', () => {
  const { Card } = loadCard('home-vacuum-card.js');
  const card = new Card();
  card.setConfig({ entity: 'vacuum.robot' });
  const calls = [];
  const vacuum = { state: 'unknown', attributes: { supported_features: 8192 } };
  card._hass = {
    states: { 'vacuum.robot': vacuum },
    callService: (...args) => calls.push(args),
  };
  assert.equal(card._call('start'), false);
  vacuum.state = 'idle';
  assert.equal(card._call('start'), true);
  assert.equal(calls.length, 1);
  assert.equal(card._call('locate'), false);
  assert.equal(calls.length, 1);
});

test('vacuum structure updates defer during menus and flush after interaction', () => {
  const { Card, document } = loadCard('home-vacuum-card.js');
  const card = new Card();
  card.setConfig({
    entity: 'vacuum.robot',
    select_entities: [{ entity: 'select.mode' }],
  });
  document.activeElement = null;
  card._shellReady = true;
  card._structureKey = 'old';
  card._structureDirty = true;
  card._deferredStructure = false;
  card._openMenu = 'select.mode';
  let syncs = 0;
  card._syncStructure = (nextKey) => {
    syncs += 1;
    card._structureKey = nextKey;
    card._structureDirty = false;
    card._deferredStructure = false;
  };
  card._patchState = () => {};

  assert.equal(card._flushDeferredStructure(), false);
  assert.equal(syncs, 0);
  assert.equal(card._deferredStructure, true);

  card._openMenu = '';
  assert.equal(card._flushDeferredStructure(), true);
  assert.equal(syncs, 1);
  assert.equal(card._deferredStructure, false);
});

test('light and switch rows block unavailable toggles and retain visible focus', () => {
  const lightRuntime = loadCard('home-light-card.js');
  const light = new lightRuntime.Card();
  light.setConfig({ entity: 'light.test' });
  assert.equal(light._c.tap_action.action, 'more-info');
  const lightCalls = [];
  light._hass = {
    states: { 'light.test': { state: 'unknown', attributes: {} } },
    callService: (...args) => lightCalls.push(args),
  };
  assert.equal(light._toggleLight('light.test'), false);
  light._hass.states['light.test'].state = 'on';
  assert.equal(light._toggleLight('light.test'), true);
  assert.equal(lightCalls.length, 1);
  assert.match(light._css(), /\.row-left:focus-visible[\s\S]{0,160}outline\s*:/);

  const switchRuntime = loadCard('home-switch-card.js');
  const switchCard = new switchRuntime.Card();
  switchCard.setConfig({ entity: 'switch.test' });
  const switchCalls = [];
  switchCard._hass = {
    states: { 'switch.test': { state: 'unavailable', attributes: {} } },
    callService: (...args) => switchCalls.push(args),
  };
  assert.equal(switchCard._callToggle('switch.test'), false);
  switchCard._hass.states['switch.test'].state = 'off';
  assert.equal(switchCard._callToggle('switch.test'), true);
  assert.equal(switchCalls.length, 1);
  assert.match(switchCard._css(), /\.row-left:focus-visible[\s\S]{0,180}outline\s*:/);
});

test('row control refresh paths preserve active slider/focus DOM', () => {
  const { Card: LightCard } = loadCard('home-light-card.js');
  const light = new LightCard();
  light.setConfig({ entity: 'light.test' });
  light._hass = { states: { 'light.test': { state: 'on', attributes: { brightness: 128 } } } };
  light._dragging = true;
  light._lastRenderSignature = 'before-drag';
  light._render();
  assert.equal(light._lastRenderSignature, 'before-drag');
  assert.equal(light._shell, undefined);

  const { Card: SwitchCard } = loadCard('home-switch-card.js');
  const connected = SwitchCard.prototype.connectedCallback.toString();
  assert.match(connected, /_patchRelativeDetails\(\)/);
  assert.doesNotMatch(connected, /this\._render\(\)/);
});
