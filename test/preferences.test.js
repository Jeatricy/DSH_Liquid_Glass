import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createPreferenceStore, DEFAULTS, normalizePreferences, STORAGE_KEY } from '../src/preferences.js';

const defaults = {
  enabled: true, palette: 'aurora', material: 'clear', opacity: 55, blur: 30,
  flow: { aurora: false, glacier: false, rose: false, rgb: true }, flowDirection: 'down-right', flowSpeed: 3, staticDirection: 'down-right',
};

function page(t, options = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://dsh.test/', ...options,
  });
  t.after(() => dom.window.close());
  return dom.window;
}

function storeFor(t, window) {
  const store = createPreferenceStore(window);
  t.after(() => store.dispose());
  return store;
}

function storageEvent(window, values) {
  window.dispatchEvent(new window.StorageEvent('storage', {
    key: STORAGE_KEY, storageArea: window.localStorage, ...values,
  }));
}

function nextStorageEvent(window) {
  return new Promise(resolve => window.addEventListener('storage', resolve, { once: true }));
}

test('preferences reject invalid types instead of coercing them into settings', () => {
  assert.deepEqual(DEFAULTS, defaults);
  for (const input of [undefined, null, true, 0, 'rose', [], ['rose']]) {
    assert.deepEqual(normalizePreferences(input), defaults, `invalid root: ${String(input)}`);
  }
  const invalid = {
    enabled: 'false', palette: 'ROSE', material: 'CLEAR', opacity: '80', blur: Infinity,
    ignored: 'do not persist this',
    flow: { aurora: 'true', rgb: 'false', white: true }, flowDirection: 'diagonal', flowSpeed: '5', staticDirection: 'constructor',
  };
  assert.deepEqual(normalizePreferences(invalid), defaults);
  assert.equal(invalid.opacity, '80', 'normalization must not mutate caller data');
  assert.equal(invalid.material, 'CLEAR');
  for (const value of [undefined, '0', '24', NaN, Infinity, -Infinity, null, true, false, {}, [], [24]]) {
    assert.deepEqual(normalizePreferences({ opacity: value, blur: value }), defaults);
  }
  for (const material of [undefined, null, '', 'CLEAR', 'FROSTED', 'white', true, 1, {}, [], ['frosted']]) {
    assert.deepEqual(normalizePreferences({ material, palette: 'white', opacity: 72, enabled: false }),
      { ...defaults, palette: 'white', opacity: 72, enabled: false }, `invalid material: ${String(material)}`);
  }
});

test('preferences keep valid choices and round and clamp slider values', () => {
  const cases = [
    [{ opacity: -500, blur: -1 }, { ...defaults, opacity: 35, blur: 12 }],
    [{ opacity: 500, blur: 500 }, { ...defaults, opacity: 90, blur: 42 }],
    [{ opacity: 63.6, blur: 17.4 }, { ...defaults, opacity: 64, blur: 17 }],
    [{ opacity: 35, blur: 42 }, { ...defaults, opacity: 35, blur: 42 }],
    [{ opacity: 90, blur: 12 }, { ...defaults, opacity: 90, blur: 12 }],
    [{ enabled: false, palette: 'glacier' }, { ...defaults, enabled: false, palette: 'glacier' }],
    [{ palette: 'rose' }, { ...defaults, palette: 'rose' }],
    [{ palette: 'rgb' }, { ...defaults, palette: 'rgb' }],
    [{ flow: { aurora: true, rgb: false, white: true }, flowDirection: 'up', flowSpeed: 99 },
      { ...defaults, flow: { ...defaults.flow, aurora: true, rgb: false }, flowDirection: 'up', flowSpeed: 5 }],
    [{ palette: 'white', material: 'frosted' }, { ...defaults, palette: 'white', material: 'frosted' }],
    [{ material: 'clear' }, { ...defaults, material: 'clear' }],
  ];
  for (const [input, expected] of cases) assert.deepEqual(normalizePreferences(input), expected);
  const snapshot = normalizePreferences({ palette: 'rose' });
  assert.ok(Object.isFrozen(snapshot));
  assert.throws(() => { snapshot.palette = 'glacier'; }, TypeError);
  assert.ok(Object.isFrozen(DEFAULTS));
});

test('persisted malformed JSON, wrong shapes and invalid fields fall back safely', t => {
  const window = page(t);
  const cases = [
    ['{broken', defaults],
    ['null', defaults],
    ['[]', defaults],
    ['"rose"', defaults],
    ['false', defaults],
    ['{"enabled":"false","palette":"unknown","material":"CLEAR","opacity":"75","blur":1e999}', defaults],
    ['{"enabled":false,"palette":"rose","opacity":99,"blur":12.6,"extra":42}',
      { ...defaults, enabled: false, palette: 'rose', opacity: 90, blur: 13 }],
    ['{"palette":"white","material":"frosted"}',
      { ...defaults, palette: 'white', material: 'frosted' }],
    ['{"palette":"rgb","flowDirection":"left","staticDirection":"default"}',
      { ...defaults, palette: 'rgb', flowDirection: 'left' }],
  ];
  for (const [raw, expected] of cases) {
    window.localStorage.setItem(STORAGE_KEY, raw);
    const store = createPreferenceStore(window);
    try {
      assert.deepEqual(store.getSnapshot(), expected, raw);
      assert.equal(window.localStorage.getItem(STORAGE_KEY), raw, 'loading must not rewrite storage');
    } finally {
      store.dispose();
    }
  }
});

test('legacy storage ignores refraction and solid while preserving current choices on load and save', t => {
  const window = page(t);
  assert.equal(STORAGE_KEY, 'dsh-liquid-glass.preferences.v1');
  const cases = [
    [{ enabled: true, palette: 'aurora', opacity: 35, blur: 12, refraction: 0, solid: false },
      { ...defaults, opacity: 35, blur: 12 }],
    [{ enabled: false, palette: 'glacier', opacity: 68, blur: 22, refraction: 24, solid: true },
      { ...defaults, enabled: false, palette: 'glacier', opacity: 68, blur: 22 }],
    [{ enabled: true, palette: 'rose', material: 'frosted', opacity: 90, blur: 42, refraction: 12, solid: true },
      { ...defaults, palette: 'rose', material: 'frosted', opacity: 90, blur: 42 }],
    [{ enabled: false, palette: 'white', material: 'clear', opacity: 79, blur: 19, refraction: '24', solid: 'true' },
      { ...defaults, enabled: false, palette: 'white', opacity: 79, blur: 19 }],
  ];
  for (const [legacy, expected] of cases) {
    const raw = JSON.stringify(legacy);
    window.localStorage.setItem(STORAGE_KEY, raw);
    const store = createPreferenceStore(window);
    try {
      assert.deepEqual(store.getSnapshot(), expected);
      assert.equal(Object.hasOwn(store.getSnapshot(), 'refraction'), false);
      assert.equal(Object.hasOwn(store.getSnapshot(), 'solid'), false);
      assert.equal(window.localStorage.getItem(STORAGE_KEY), raw, 'loading must not rewrite v1 settings');
      store.update({ enabled: !expected.enabled });
      const saved = { ...expected, enabled: !expected.enabled };
      assert.deepEqual(store.getSnapshot(), saved, 'toggling must retain palette, material, thickness and blur');
      const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      assert.deepEqual(persisted, saved);
      assert.equal(Object.hasOwn(persisted, 'refraction'), false);
      assert.equal(Object.hasOwn(persisted, 'solid'), false);
      const reopened = createPreferenceStore(window);
      try { assert.deepEqual(reopened.getSnapshot(), saved); }
      finally { reopened.dispose(); }
    } finally {
      store.dispose();
    }
  }
});

test('updates containing only removed preferences clean legacy storage without changing the snapshot', t => {
  const window = page(t);
  const expected = { ...defaults, enabled: false, palette: 'white', material: 'frosted', opacity: 81, blur: 24 };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...expected, refraction: 24, solid: true }));
  const store = storeFor(t, window);
  const before = store.getSnapshot();
  const observed = [];
  store.subscribe(() => observed.push(store.getSnapshot()));

  store.update({ refraction: 0, solid: false });

  assert.deepEqual(before, expected);
  assert.strictEqual(store.getSnapshot(), before, 'removed controls cannot change the current state');
  assert.deepEqual(observed, [], 'ignored fields must not notify React subscribers');
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)), expected);
  assert.deepEqual(storeFor(t, window).getSnapshot(), expected);
});

test('updates persist the complete normalized state and survive a new store', t => {
  const window = page(t);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: false, palette: 'rose', blur: 18 }));
  const store = storeFor(t, window);
  const before = store.getSnapshot();
  assert.strictEqual(store.getSnapshot(), before, 'React subscribers require a stable snapshot');
  const observed = [];
  store.subscribe(() => observed.push(store.getSnapshot()));

  store.update({ enabled: true, opacity: 73.7, material: 'frosted', ignored: 'discard' });
  const expected = { ...defaults, palette: 'rose', material: 'frosted', opacity: 74, blur: 18 };
  assert.deepEqual(store.getSnapshot(), expected);
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)), expected);
  assert.deepEqual(observed, [expected]);
  assert.notStrictEqual(store.getSnapshot(), before);
  assert.ok(Object.isFrozen(store.getSnapshot()));
  const reopened = storeFor(t, window);
  assert.deepEqual(reopened.getSnapshot(), expected);
  const motion = { flow: { ...defaults.flow, rose: true }, flowDirection: 'down-right', flowSpeed: 4, staticDirection: 'up-right' };
  reopened.update({ palette: 'rgb', ...motion });
  assert.deepEqual(storeFor(t, window).getSnapshot(), { ...expected, palette: 'rgb', ...motion });
});

test('invalid material updates reset only that setting', t => {
  const window = page(t);
  const store = storeFor(t, window);
  store.update({ enabled: false, palette: 'white', opacity: 79, blur: 19, material: 'frosted' });
  const observed = [];
  store.subscribe(() => observed.push(store.getSnapshot()));
  store.update({ material: 'FROSTED' });
  const expected = { ...defaults, enabled: false, palette: 'white', opacity: 79, blur: 19 };
  assert.deepEqual(store.getSnapshot(), expected);
  assert.deepEqual(observed, [expected]);
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)), expected);
  assert.deepEqual(storeFor(t, window).getSnapshot(), expected);
});

test('equivalent updates keep snapshot identity, unsubscribe works and reset persists defaults', t => {
  const window = page(t);
  const store = storeFor(t, window);
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  const initial = store.getSnapshot();
  store.update({});
  store.update({ opacity: 55.1, material: 'clear', ignored: true });
  assert.strictEqual(store.getSnapshot(), initial);
  assert.equal(calls, 0);

  store.update({ palette: 'glacier', opacity: 88, enabled: false, material: 'frosted' });
  assert.equal(calls, 1);
  store.reset();
  assert.equal(calls, 2);
  assert.deepEqual(store.getSnapshot(), defaults);
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)), defaults);
  unsubscribe();
  unsubscribe();
  store.update({ palette: 'rose' });
  assert.equal(calls, 2);
});

test('a denied localStorage getter still permits in-memory changes and reset', t => {
  const window = page(t);
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new window.DOMException('Storage is blocked', 'SecurityError'); },
  });
  const store = storeFor(t, window);
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  assert.deepEqual(store.getSnapshot(), defaults);
  assert.doesNotThrow(() => store.update({ palette: 'rose', enabled: false }));
  assert.deepEqual(store.getSnapshot(), { ...defaults, palette: 'rose', enabled: false });
  assert.equal(calls, 1);
  assert.doesNotThrow(() => store.reset());
  assert.deepEqual(store.getSnapshot(), defaults);
  assert.equal(calls, 2);
});

test('a denied getItem does not prevent loading safe defaults or later saving', t => {
  const window = page(t);
  t.mock.method(window.Storage.prototype, 'getItem', () => {
    throw new window.DOMException('Read is blocked', 'SecurityError');
  });
  const store = storeFor(t, window);
  assert.deepEqual(store.getSnapshot(), defaults);
  assert.doesNotThrow(() => store.update({ blur: 40 }));
  assert.equal(store.getSnapshot().blur, 40);
  assert.equal(window.localStorage.length, 1);
});

test('quota rejection keeps the new preference usable without claiming persistence', t => {
  const window = page(t, { storageQuota: 0 });
  const store = storeFor(t, window);
  const observed = [];
  store.subscribe(() => observed.push(store.getSnapshot()));
  assert.doesNotThrow(() => store.update({ opacity: 81, material: 'frosted' }));
  assert.deepEqual(store.getSnapshot(), { ...defaults, opacity: 81, material: 'frosted' });
  assert.deepEqual(observed, [{ ...defaults, opacity: 81, material: 'frosted' }]);
  assert.equal(window.localStorage.getItem(STORAGE_KEY), null);
  assert.deepEqual(storeFor(t, window).getSnapshot(), defaults, 'unsaved state is local to the existing store');
});

test('same-origin windows synchronize through real storage events in both directions', { timeout: 5000 }, async t => {
  const window = page(t);
  const frame = window.document.createElement('iframe');
  window.document.body.appendChild(frame);
  const otherWindow = frame.contentWindow;
  const first = storeFor(t, window);
  const second = storeFor(t, otherWindow);
  let firstCalls = 0;
  let secondCalls = 0;
  first.subscribe(() => { firstCalls += 1; });
  second.subscribe(() => { secondCalls += 1; });

  // jsdom's same-origin frame shares storage and emits actual StorageEvents.
  // No hand-written synchronization bridge stands in for the browser here.
  let delivered = nextStorageEvent(otherWindow);
  first.update({ palette: 'glacier', opacity: 67, enabled: false, material: 'frosted' });
  const event = await delivered;
  assert.equal(event.key, STORAGE_KEY);
  assert.strictEqual(event.storageArea, otherWindow.localStorage);
  assert.deepEqual(second.getSnapshot(), { ...defaults, palette: 'glacier', opacity: 67, enabled: false, material: 'frosted' });
  assert.equal(firstCalls, 1);
  assert.equal(secondCalls, 1);

  delivered = nextStorageEvent(window);
  second.update({ enabled: true, blur: 41, material: 'clear' });
  await delivered;
  assert.deepEqual(first.getSnapshot(), {
    ...defaults, palette: 'glacier', opacity: 67, blur: 41,
  });
  assert.deepEqual(second.getSnapshot(), first.getSnapshot());
  assert.equal(firstCalls, 2);
  assert.equal(secondCalls, 2);

  delivered = nextStorageEvent(otherWindow);
  first.update({ palette: 'white' });
  await delivered;
  assert.deepEqual(second.getSnapshot(), {
    ...defaults, palette: 'white', opacity: 67, blur: 41,
  });
  assert.deepEqual(first.getSnapshot(), second.getSnapshot());
  assert.equal(firstCalls, 3);
  assert.equal(secondCalls, 3);
});

test('real cross-window legacy writes ignore removed fields and the next save drops them', { timeout: 5000 }, async t => {
  const window = page(t);
  const frame = window.document.createElement('iframe');
  window.document.body.appendChild(frame);
  const otherWindow = frame.contentWindow;
  const store = storeFor(t, otherWindow);
  const expected = { ...defaults, enabled: false, palette: 'rose', material: 'frosted', opacity: 73, blur: 21 };
  const observed = [];
  store.subscribe(() => observed.push(store.getSnapshot()));

  let delivered = nextStorageEvent(otherWindow);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...expected, refraction: 24, solid: true }));
  await delivered;
  const snapshot = store.getSnapshot();
  assert.deepEqual(snapshot, expected);
  assert.deepEqual(observed, [expected]);

  delivered = nextStorageEvent(otherWindow);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...expected, refraction: 0, solid: false }));
  await delivered;
  assert.strictEqual(store.getSnapshot(), snapshot, 'only removed options changed in the other window');
  assert.deepEqual(observed, [expected]);

  delivered = nextStorageEvent(window);
  store.update({ palette: 'white' });
  const saved = { ...expected, palette: 'white' };
  assert.deepEqual(JSON.parse((await delivered).newValue), saved);
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)), saved);
  assert.deepEqual(storeFor(t, window).getSnapshot(), saved);
});

test('cross-window removal and storage.clear reset preferences to defaults', { timeout: 5000 }, async t => {
  const window = page(t);
  const frame = window.document.createElement('iframe');
  window.document.body.appendChild(frame);
  const otherWindow = frame.contentWindow;
  const store = storeFor(t, otherWindow);

  let delivered = nextStorageEvent(otherWindow);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: false, palette: 'rose', material: 'frosted', opacity: 72 }));
  await delivered;
  assert.deepEqual(store.getSnapshot(), { ...defaults, enabled: false, palette: 'rose', material: 'frosted', opacity: 72 });
  delivered = nextStorageEvent(otherWindow);
  window.localStorage.removeItem(STORAGE_KEY);
  await delivered;
  assert.deepEqual(store.getSnapshot(), defaults);

  delivered = nextStorageEvent(otherWindow);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ blur: 42, palette: 'white' }));
  await delivered;
  assert.deepEqual(store.getSnapshot(), { ...defaults, blur: 42, palette: 'white' });
  delivered = nextStorageEvent(otherWindow);
  window.localStorage.clear();
  assert.equal((await delivered).key, null);
  assert.deepEqual(store.getSnapshot(), defaults);
});

test('storage events ignore other keys and sessionStorage and normalize incoming data', t => {
  const window = page(t);
  const store = storeFor(t, window);
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  const initial = store.getSnapshot();
  storageEvent(window, { key: 'another-plugin', newValue: '{"enabled":false}' });
  storageEvent(window, { storageArea: window.sessionStorage, newValue: '{"enabled":false}' });
  storageEvent(window, { key: null, storageArea: window.sessionStorage });
  assert.strictEqual(store.getSnapshot(), initial);
  assert.equal(calls, 0);

  storageEvent(window, { newValue: '{"palette":"rose","opacity":400,"blur":"20","enabled":false,"material":"FROSTED","refraction":"0"}' });
  assert.deepEqual(store.getSnapshot(), { ...defaults, palette: 'rose', opacity: 90, enabled: false });
  assert.equal(calls, 1);
  const changed = store.getSnapshot();
  storageEvent(window, { newValue: '{"enabled":false,"opacity":90,"palette":"rose"}' });
  assert.strictEqual(store.getSnapshot(), changed);
  assert.equal(calls, 1, 'equivalent cross-window state must not republish');
  storageEvent(window, { newValue: '{invalid json' });
  assert.deepEqual(store.getSnapshot(), defaults);
  assert.equal(calls, 2);
});

test('disposing removes the storage listener and permanently stops writes and notifications', t => {
  const window = page(t);
  const added = t.mock.method(window, 'addEventListener');
  const removed = t.mock.method(window, 'removeEventListener');
  const writes = t.mock.method(window.Storage.prototype, 'setItem');
  const store = storeFor(t, window);
  const registration = added.mock.calls.find(call => call.arguments[0] === 'storage');
  assert.ok(registration, 'the live store must listen for cross-window changes');
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.update({ palette: 'rose' });
  const lastSnapshot = store.getSnapshot();
  const writeCount = writes.mock.callCount();
  store.dispose();
  assert.ok(removed.mock.calls.some(call => call.arguments[0] === 'storage'
    && call.arguments[1] === registration.arguments[1]), 'remove the exact registered listener');
  assert.doesNotThrow(() => store.dispose());
  assert.doesNotThrow(unsubscribe);
  store.subscribe(() => { calls += 100; });
  store.update({ enabled: false });
  store.reset();
  storageEvent(window, { newValue: '{"palette":"glacier"}' });
  assert.strictEqual(store.getSnapshot(), lastSnapshot);
  assert.equal(writes.mock.callCount(), writeCount);
  assert.equal(calls, 1);
});
