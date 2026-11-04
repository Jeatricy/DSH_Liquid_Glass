import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { buildAdapterCss, resolveModuleClass } from '../src/adapters.js';
import { createClientPlugin } from '../src/client.js';
import { createPreferenceStore, PLUGIN_ID, STORAGE_KEY } from '../src/preferences.js';
import { mountTheme } from '../src/runtime.js';
import { compileTheme } from '../scripts/build.mjs';

const themeSource = `body[data-dsh-liquid-glass] {
  --lg-surface: rgb(240 245 255 / .55);
  --dsw-alias-bg-base: var(--lg-surface);
  --dsw-alias-label-primary: #172033;
  --dsw-radius-panel: 26px;
  background: var(--lg-surface);
}
body[data-dsh-liquid-glass][data-ds-dark-theme] {
  --lg-surface: rgb(29 36 55 / .55);
  --dsw-alias-label-primary: #f2f5ff;
}
body[data-dsh-liquid-glass] [data-menu-material] {
  --dsw-menu-backdrop-filter: blur(30px);
}`;
const assets = {
  ...compileTheme(themeSource),
  controlsCss: '.dsh-lg-settings { display: grid; }',
};
const expectedTokens = {
  '--dsw-alias-bg-base': { light: 'var(--lg-surface)', dark: 'var(--lg-surface)' },
  '--dsw-alias-label-primary': { light: '#172033', dark: '#f2f5ff' },
  '--dsw-radius-panel': { light: '26px', dark: '26px' },
};

function page(t) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><main id="conversation"></main></body></html>', {
    url: 'https://dsh.test/',
  });
  t.after(() => dom.window.close());
  return dom.window;
}

function themeService(t) {
  const overrides = [];
  const active = new Set();
  const theme = {
    overrideTokens: t.mock.fn((id, tokens) => {
      const dispose = t.mock.fn(() => active.delete(dispose));
      overrides.push({ id, tokens, dispose });
      active.add(dispose);
      return dispose;
    }),
  };
  return { theme, overrides, active };
}

function runtime(t, window, options = {}) {
  const store = createPreferenceStore(window);
  const service = themeService(t);
  let unmount;
  t.after(() => { unmount?.(); store.dispose(); });
  unmount = mountTheme({ document: window.document, window, store, ...service, ...assets, ...options });
  return { store, unmount, ...service };
}

function ownedStyles(document) {
  return [...document.querySelectorAll(`style[data-plugin="${PLUGIN_ID}"]`)];
}

function adapterStyle(document) {
  return document.querySelector(`style[data-plugin-css="${PLUGIN_ID}/adapters.css"]`);
}

function officialStyle(document, packageName, moduleName, css) {
  const style = document.createElement('style');
  style.dataset.plugin = `@deepseek-ai/dsh-client-${packageName}`;
  style.dataset.pluginCss = `@deepseek-ai/dsh-client-${packageName}/${moduleName}.module.css`;
  style.textContent = css;
  return style;
}

function allStyleRules(sheet) {
  const rules = [];
  function visit(list) {
    for (const rule of list) {
      if (rule.selectorText && rule.style) rules.push(rule);
      if (rule.cssRules) visit(rule.cssRules);
    }
  }
  visit(sheet.cssRules);
  return rules;
}

function trackObservers(window) {
  const NativeObserver = window.MutationObserver;
  const observers = [];
  window.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      const entry = { callbacks: 0, disconnects: 0, observations: [] };
      super((records, observer) => { entry.callbacks += 1; callback(records, observer); });
      this.entry = entry;
      observers.push(entry);
    }
    observe(target, options) {
      this.entry.observations.push({ target, options });
      return super.observe(target, options);
    }
    disconnect() {
      this.entry.disconnects += 1;
      return super.disconnect();
    }
  };
  return observers;
}

function bodyState(body) {
  return {
    attributes: Object.fromEntries([...body.attributes]
      .filter(({ name }) => name !== 'style').map(({ name, value }) => [name, value])),
    declarations: Object.fromEntries(Array.from(body.style, name => [name, {
      value: body.style.getPropertyValue(name), priority: body.style.getPropertyPriority(name),
    }])),
    content: body.innerHTML,
  };
}

function assertNoAppearance(body) {
  for (const name of ['data-dsh-liquid-glass', 'data-lg-palette', 'data-lg-material']) {
    assert.equal(body.hasAttribute(name), false, `${name} should be released`);
  }
  for (const name of ['--lg-opacity', '--lg-blur-size']) {
    assert.equal(body.style.getPropertyValue(name), '', `${name} should be released`);
    assert.equal(body.style.getPropertyPriority(name), '', `${name} priority should be released`);
  }
}

function assertRemovedStateAbsent(body) {
  assert.equal(body.hasAttribute('data-lg-solid'), false, 'removed solid mode must not be created');
  assert.equal(body.style.getPropertyValue('--lg-refraction-strength'), '', 'removed refraction must not be created');
}

test('compileTheme extracts native light/dark pairs while preserving material and component CSS', t => {
  const compiled = compileTheme(themeSource);
  assert.deepEqual(compiled.tokens, expectedTokens);
  assert.ok(!Object.hasOwn(compiled.tokens, '--lg-surface'));
  assert.ok(!Object.hasOwn(compiled.tokens, '--dsw-menu-backdrop-filter'), 'component-scoped values stay in CSS');
  const window = page(t);
  const style = window.document.createElement('style');
  style.textContent = compiled.css;
  window.document.head.appendChild(style);
  const rules = allStyleRules(style.sheet);
  assert.equal(rules.length, 3);
  const light = rules.find(rule => rule.selectorText === 'body[data-dsh-liquid-glass]');
  const dark = rules.find(rule => rule.selectorText === 'body[data-dsh-liquid-glass][data-ds-dark-theme]');
  for (const rule of [light, dark]) {
    assert.ok(rule, 'both native theme modes retain their gated material rule');
    for (let i = 0; i < rule.style.length; i += 1) {
      assert.ok(!rule.style[i].startsWith('--dsw-'), 'root native declarations belong to the theme service');
    }
  }
  assert.equal(light.style.getPropertyValue('--lg-surface'), 'rgb(240 245 255 / .55)');
  assert.equal(dark.style.getPropertyValue('--lg-surface'), 'rgb(29 36 55 / .55)');
  assert.equal(light.style.getPropertyValue('background'), 'var(--lg-surface)');
  assert.equal(rules[2].style.getPropertyValue('--dsw-menu-backdrop-filter'), 'blur(30px)');
});

test('compileTheme supports Windows line endings and rejects a dark token without a light value', () => {
  assert.deepEqual(compileTheme(themeSource.replaceAll('\n', '\r\n')).tokens, expectedTokens);
  assert.throws(() => compileTheme(`body[data-dsh-liquid-glass][data-ds-dark-theme] {
  --dsw-alias-bg-base: #000;
}`), /Missing light value for --dsw-alias-bg-base/);
});

test('the shipped theme compiles into reversible tokens and still has gated light and dark material', async t => {
  const source = await readFile(new URL('../src/theme.css', import.meta.url), 'utf8');
  const compiled = compileTheme(source);
  assert.deepEqual(compiled.tokens['--dsw-alias-bg-mask-1'], {
    light: 'rgb(30 43 76 / .18)', dark: 'rgb(4 9 22 / .42)',
  });
  assert.deepEqual(compiled.tokens['--dsw-alias-bg-layer-1'], {
    light: 'var(--lg-surface)', dark: 'var(--lg-surface)',
  });
  for (const [name, values] of Object.entries(compiled.tokens)) {
    assert.match(name, /^--dsw-/);
    assert.deepEqual(Object.keys(values).sort(), ['dark', 'light']);
    assert.equal(typeof values.light, 'string');
    assert.equal(typeof values.dark, 'string');
    assert.ok(values.light && values.dark, `${name} needs both native modes`);
  }
  const window = page(t);
  const { overrides, unmount } = runtime(t, window, compiled);
  assert.deepEqual(overrides[0].tokens, compiled.tokens);
  const material = window.document.querySelector(`style[data-plugin-css="${PLUGIN_ID}/theme.css"]`);
  const roots = allStyleRules(material.sheet).filter(rule => [
    'body[data-dsh-liquid-glass]', 'body[data-dsh-liquid-glass][data-ds-dark-theme]',
  ].includes(rule.selectorText));
  assert.ok(roots.some(rule => rule.style.getPropertyValue('--lg-ink') === '#1c2538'));
  assert.ok(roots.some(rule => rule.style.getPropertyValue('--lg-ink') === '#f2f5ff'));
  for (const rule of roots) {
    for (let i = 0; i < rule.style.length; i += 1) assert.ok(!rule.style[i].startsWith('--dsw-'));
  }
  unmount();
  assert.equal(overrides[0].dispose.mock.callCount(), 1);
});

for (const dark of [false, true]) {
  test(`enable, disable, re-enable and unmount preserve the host's ${dark ? 'dark' : 'light'} appearance`, t => {
    const window = page(t);
    const { document } = window;
    const { body } = document;
    if (dark) body.setAttribute('data-ds-dark-theme', 'native-dark');
    body.setAttribute('data-host-mode', 'normal');
    body.style.setProperty('--dsw-alias-label-primary', '#123456', 'important');
    body.style.setProperty('--another-plugin', 'keep-me', 'important');
    body.style.setProperty('--lg-unrelated', 'keep-this-too');
    body.style.setProperty('color', 'rgb(10, 20, 30)');
    const hostStyle = document.createElement('style');
    hostStyle.textContent = 'main { display: block; }';
    document.head.appendChild(hostStyle);
    const conversation = document.querySelector('#conversation');
    conversation.innerHTML = '<p data-message="existing">Native <code>content</code></p>';
    const originalContent = conversation.innerHTML;
    const { store, unmount, overrides, active } = runtime(t, window);
    const tags = ownedStyles(document);

    const assertHost = () => {
      assert.equal(body.getAttribute('data-ds-dark-theme'), dark ? 'native-dark' : null);
      assert.equal(body.getAttribute('data-host-mode'), 'normal');
      assert.equal(body.style.getPropertyValue('--dsw-alias-label-primary'), '#123456');
      assert.equal(body.style.getPropertyPriority('--dsw-alias-label-primary'), 'important');
      assert.equal(body.style.getPropertyValue('--another-plugin'), 'keep-me');
      assert.equal(body.style.getPropertyPriority('--another-plugin'), 'important');
      assert.equal(body.style.getPropertyValue('--lg-unrelated'), 'keep-this-too');
      assert.equal(body.style.getPropertyValue('color'), 'rgb(10, 20, 30)');
      assert.equal(conversation.innerHTML, originalContent);
      assert.ok(hostStyle.isConnected);
    };
    assertHost();
    assert.equal(tags.length, 3);
    assert.equal(body.getAttribute('data-dsh-liquid-glass'), '');
    assert.equal(body.getAttribute('data-lg-palette'), 'aurora');
    assert.equal(body.getAttribute('data-lg-material'), 'clear');
    assertRemovedStateAbsent(body);
    assert.equal(body.style.getPropertyValue('--lg-opacity'), '0.55');
    assert.equal(body.style.getPropertyValue('--lg-blur-size'), '30px');
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0].id, PLUGIN_ID);
    assert.deepEqual(overrides[0].tokens, expectedTokens);
    assert.equal(active.size, 1);

    store.update({ palette: 'rose', opacity: 76, blur: 41, material: 'frosted' });
    assert.equal(body.getAttribute('data-lg-palette'), 'rose');
    assert.equal(body.getAttribute('data-lg-material'), 'frosted');
    assertRemovedStateAbsent(body);
    assert.equal(body.style.getPropertyValue('--lg-opacity'), '0.76');
    assert.equal(body.style.getPropertyValue('--lg-blur-size'), '41px');
    assert.equal(overrides.length, 1, 'material changes should not stack token overrides');
    assert.deepEqual(ownedStyles(document), tags, 'updates reuse the mounted styles');
    assertHost();

    store.update({ enabled: false });
    assertNoAppearance(body);
    assert.equal(overrides[0].dispose.mock.callCount(), 1);
    assert.equal(active.size, 0);
    assertHost();
    store.update({ palette: 'glacier', blur: 18, material: 'clear' });
    assertNoAppearance(body);
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0].dispose.mock.callCount(), 1);

    store.update({ enabled: true });
    assert.equal(body.getAttribute('data-lg-palette'), 'glacier');
    assert.equal(body.getAttribute('data-lg-material'), 'clear');
    assertRemovedStateAbsent(body);
    assert.equal(body.style.getPropertyValue('--lg-opacity'), '0.76');
    assert.equal(body.style.getPropertyValue('--lg-blur-size'), '18px');
    assert.equal(overrides.length, 2);
    assert.deepEqual(overrides[1].tokens, expectedTokens);
    assert.equal(active.size, 1);
    assertHost();

    store.update({ palette: 'white' });
    assert.equal(body.getAttribute('data-lg-palette'), 'white');
    assert.equal(body.getAttribute('data-lg-material'), 'clear');
    assertRemovedStateAbsent(body);
    assert.equal(overrides.length, 2);
    assert.deepEqual(ownedStyles(document), tags);
    assertHost();

    unmount();
    unmount();
    assertNoAppearance(body);
    assert.equal(ownedStyles(document).length, 0);
    assert.ok(tags.every(style => !style.isConnected));
    assert.equal(active.size, 0);
    assert.equal(overrides[0].dispose.mock.callCount(), 1);
    assert.equal(overrides[1].dispose.mock.callCount(), 1);
    assertHost();
    store.update({ enabled: false });
    store.update({ enabled: true });
    assertNoAppearance(body);
    assert.equal(overrides.length, 2, 'unmount must release the preference subscription');
  });
}

test('restoration preserves pre-existing owned attributes, inline values and !important priority', t => {
  const window = page(t);
  const { body } = window.document;
  body.setAttribute('data-dsh-liquid-glass', 'previous-owner');
  body.setAttribute('data-lg-palette', 'previous-palette');
  body.setAttribute('data-lg-material', 'previous-material');
  body.style.setProperty('--lg-opacity', '.83', 'important');
  body.style.setProperty('--lg-blur-size', '15px', 'important');
  const baseline = bodyState(body);
  const { store, unmount, overrides } = runtime(t, window);
  assert.equal(body.getAttribute('data-lg-material'), 'clear');
  assert.equal(body.style.getPropertyValue('--lg-blur-size'), '30px');
  for (const name of ['--lg-opacity', '--lg-blur-size']) {
    assert.equal(body.style.getPropertyPriority(name), '', `${name} must be controlled while enabled`);
  }
  store.update({ enabled: false });
  assert.deepEqual(bodyState(body), baseline);
  store.update({ material: 'frosted', blur: 42 });
  assert.deepEqual(bodyState(body), baseline, 'disabled changes must preserve the prior owner');
  store.update({ enabled: true, palette: 'rose', opacity: 42 });
  assert.equal(body.style.getPropertyValue('--lg-opacity'), '0.42');
  assert.equal(body.getAttribute('data-lg-material'), 'frosted');
  assert.equal(body.style.getPropertyValue('--lg-blur-size'), '42px');
  unmount();
  assert.deepEqual(bodyState(body), baseline);
  assert.equal(overrides.length, 2);
  assert.ok(overrides.every(override => override.dispose.mock.callCount() === 1));
  store.update({ material: 'clear', blur: 12 });
  assert.deepEqual(bodyState(body), baseline, 'unmounted updates must not overwrite the restored owner');
});

test('removed solid and refraction DOM state belongs to the host throughout the lifecycle', t => {
  const window = page(t);
  const { body } = window.document;
  body.setAttribute('data-lg-solid', 'host-solid');
  body.style.setProperty('--lg-refraction-strength', '7', 'important');
  const assertHostState = (solid, strength, priority) => {
    assert.equal(body.getAttribute('data-lg-solid'), solid);
    assert.equal(body.style.getPropertyValue('--lg-refraction-strength'), strength);
    assert.equal(body.style.getPropertyPriority('--lg-refraction-strength'), priority);
  };
  const { store, unmount } = runtime(t, window);
  assertHostState('host-solid', '7', 'important');
  store.update({ material: 'frosted', palette: 'white', opacity: 80, refraction: 24, solid: false });
  assertHostState('host-solid', '7', 'important');

  body.setAttribute('data-lg-solid', 'host-changed');
  body.style.setProperty('--lg-refraction-strength', '19');
  store.update({ enabled: false });
  assertNoAppearance(body);
  assertHostState('host-changed', '19', '');
  store.update({ enabled: true });
  assertHostState('host-changed', '19', '');

  body.removeAttribute('data-lg-solid');
  body.style.removeProperty('--lg-refraction-strength');
  store.update({ enabled: false });
  assertRemovedStateAbsent(body);
  store.update({ enabled: true });
  assertRemovedStateAbsent(body);

  body.setAttribute('data-lg-solid', 'host-before-unmount');
  body.style.setProperty('--lg-refraction-strength', '11', 'important');
  unmount();
  assertNoAppearance(body);
  assertHostState('host-before-unmount', '11', 'important');
});

test('unmounting while disabled leaves no owned appearance state behind', t => {
  const window = page(t);
  const { body } = window.document;
  const baseline = bodyState(body);
  const { store, unmount, overrides, active } = runtime(t, window);
  store.update({ palette: 'white', material: 'frosted', blur: 42 });
  assert.equal(body.getAttribute('data-lg-material'), 'frosted');
  assert.equal(body.style.getPropertyValue('--lg-blur-size'), '42px');
  assertRemovedStateAbsent(body);
  store.update({ enabled: false });
  assertNoAppearance(body);
  assert.deepEqual(bodyState(body), baseline);
  store.update({ material: 'clear', blur: 12 });
  assertNoAppearance(body);
  assert.deepEqual(bodyState(body), baseline);
  unmount();
  unmount();
  store.update({ enabled: true, material: 'frosted', blur: 42 });
  assertNoAppearance(body);
  assert.deepEqual(bodyState(body), baseline);
  assert.equal(ownedStyles(window.document).length, 0);
  assert.equal(active.size, 0);
  assert.equal(overrides.length, 1);
  assert.equal(overrides[0].dispose.mock.callCount(), 1);
});

test('disabled legacy preferences ignore removed fields and do not acquire tokens until enabled', t => {
  const window = page(t);
  const legacy = { enabled: false, palette: 'glacier', opacity: 68, blur: 22, refraction: 24, solid: true };
  const expected = { enabled: false, palette: 'glacier', material: 'clear', opacity: 68, blur: 22 };
  const raw = JSON.stringify(legacy);
  window.localStorage.setItem(STORAGE_KEY, raw);
  const baseline = bodyState(window.document.body);
  const { store, unmount, overrides } = runtime(t, window);
  assert.deepEqual(store.getSnapshot(), expected);
  assert.equal(window.localStorage.getItem(STORAGE_KEY), raw);
  assert.deepEqual(bodyState(window.document.body), baseline);
  assertNoAppearance(window.document.body);
  assertRemovedStateAbsent(window.document.body);
  assert.equal(overrides.length, 0);
  store.update({ enabled: true });
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)), { ...expected, enabled: true });
  assert.equal(overrides.length, 1);
  assert.equal(window.document.body.getAttribute('data-lg-palette'), 'glacier');
  assert.equal(window.document.body.getAttribute('data-lg-material'), 'clear');
  assert.equal(window.document.body.style.getPropertyValue('--lg-opacity'), '0.68');
  assert.equal(window.document.body.style.getPropertyValue('--lg-blur-size'), '22px');
  assertRemovedStateAbsent(window.document.body);
  unmount();
  assertNoAppearance(window.document.body);
  assert.deepEqual(bodyState(window.document.body), baseline);
});

test('native appearance changes made while mounted survive disable and unmount', t => {
  const window = page(t);
  const { body } = window.document;
  const { store, unmount } = runtime(t, window);
  body.setAttribute('data-ds-dark-theme', 'changed-by-host');
  body.style.setProperty('--dsw-alias-bg-base', '#101820', 'important');
  body.style.setProperty('--another-plugin', 'changed-during-mount');
  store.update({ enabled: false });
  assert.equal(body.getAttribute('data-ds-dark-theme'), 'changed-by-host');
  assert.equal(body.style.getPropertyValue('--dsw-alias-bg-base'), '#101820');
  assert.equal(body.style.getPropertyPriority('--dsw-alias-bg-base'), 'important');
  store.update({ enabled: true });
  body.removeAttribute('data-ds-dark-theme');
  unmount();
  assert.equal(body.hasAttribute('data-ds-dark-theme'), false);
  assert.equal(body.style.getPropertyValue('--dsw-alias-bg-base'), '#101820');
  assert.equal(body.style.getPropertyValue('--another-plugin'), 'changed-during-mount');
});

test('failed token registration rolls back styles, observer and store subscription', t => {
  const window = page(t);
  const observers = trackObservers(window);
  const store = createPreferenceStore(window);
  t.after(() => store.dispose());
  window.document.body.setAttribute('data-lg-material', 'host-material');
  window.document.body.style.setProperty('--lg-opacity', '.8', 'important');
  window.document.body.style.setProperty('--lg-refraction-strength', '9', 'important');
  const baseline = bodyState(window.document.body);
  const failure = new Error('Theme service refused the override');
  const overrideTokens = t.mock.fn(() => { throw failure; });
  assert.throws(() => mountTheme({
    document: window.document, window, store, theme: { overrideTokens }, ...assets,
  }), error => error === failure);
  assert.deepEqual(bodyState(window.document.body), baseline);
  assert.equal(ownedStyles(window.document).length, 0);
  assert.equal(observers.length, 1);
  assert.equal(observers[0].disconnects, 1);
  assert.doesNotThrow(() => store.update({ palette: 'rose' }));
  assert.equal(overrideTokens.mock.callCount(), 1, 'a failed mount must unsubscribe');
});

test('module resolution uses the official package and complete local name, without pinned hashes', t => {
  const window = page(t);
  const { document } = window;
  document.head.appendChild(officialStyle(document, 'ui-conversation', 'SidebarRoot', '.wrong_root { color: red; }'));
  const unrelated = document.createElement('style');
  unrelated.textContent = '.unowned_root { color: red; }';
  document.head.appendChild(unrelated);
  assert.equal(resolveModuleClass(document, 'ui-sidebar', 'SidebarRoot', 'root'), null);
  const official = officialStyle(document, 'ui-sidebar', 'SidebarRoot', `
    .decoy_rooted, .decoy_root-disabled, .decoy_root_extra { color: red; }
    .build_A91_x_root:hover { color: blue; }
  `);
  document.head.appendChild(official);
  assert.equal(resolveModuleClass(document, 'ui-sidebar', 'SidebarRoot', 'root'), 'build_A91_x_root');
  assert.equal(resolveModuleClass(document, 'ui-sidebar', 'SidebarRoot', 'missing'), null);
  official.textContent = '.entirely_new_Z8_root { color: green; }';
  assert.equal(resolveModuleClass(document, 'ui-sidebar', 'SidebarRoot', 'root'), 'entirely_new_Z8_root');
  official.remove();
  assert.equal(resolveModuleClass(document, 'ui-sidebar', 'SidebarRoot', 'root'), null);
});

test('adapters only target resolved components while the plugin body gate is enabled', t => {
  const window = page(t);
  const { document } = window;
  assert.equal(buildAdapterCss(document), '');
  document.head.appendChild(officialStyle(document, 'ui-layout', 'AppFrame', '.layout_H71_frame { background: white; }'));
  document.head.appendChild(officialStyle(document, 'ui-chat', 'MessageItem', '.chat_N52_bubble { background: gray; }'));
  const frame = document.createElement('div');
  frame.className = 'layout_H71_frame';
  const bubble = document.createElement('p');
  bubble.className = 'chat_N52_bubble';
  bubble.innerHTML = '<a href="#">link</a><code>code</code>';
  const unrelated = document.createElement('div');
  unrelated.className = 'foreign_frame';
  document.body.append(frame, bubble, unrelated);
  const style = document.createElement('style');
  style.textContent = buildAdapterCss(document);
  document.head.appendChild(style);
  const rules = allStyleRules(style.sheet);
  const frameRule = rules.find(rule => rule.selectorText.includes('.layout_H71_frame'));
  const bubbleRule = rules.find(rule => rule.selectorText.endsWith('.chat_N52_bubble'));
  const textRule = rules.find(rule => rule.selectorText.includes(':is(a, code)'));
  assert.ok(frameRule && bubbleRule && textRule);
  for (const [property, expected] of Object.entries({
    background: 'transparent', width: '100%', height: '100%', 'box-sizing': 'border-box',
  })) {
    assert.equal(frameRule.style.getPropertyValue(property), expected, `the full-viewport frame must retain ${property}`);
  }
  for (const property of ['border', 'border-radius', 'margin', 'top', 'left']) {
    assert.match(frameRule.style.getPropertyValue(property), /^0(?:px)?$/, `the full-viewport frame must have zero ${property}`);
  }
  assert.equal(textRule.style.getPropertyValue('color'), 'inherit');
  for (const rule of rules) {
    assert.match(rule.selectorText, /^body\[data-dsh-liquid-glass\]/);
    assert.equal(unrelated.matches(rule.selectorText), false);
  }
  assert.equal(frame.matches(frameRule.selectorText), false);
  assert.equal(bubble.matches(bubbleRule.selectorText), false);
  document.body.setAttribute('data-dsh-liquid-glass', '');
  assert.equal(frame.matches(frameRule.selectorText), true);
  assert.equal(bubble.matches(bubbleRule.selectorText), true);
  assert.equal(bubble.querySelector('a').matches(textRule.selectorText), true);
  assert.equal(bubble.querySelector('code').matches(textRule.selectorText), true);
  document.body.removeAttribute('data-dsh-liquid-glass');
  assert.equal(frame.matches(frameRule.selectorText), false);
  assert.equal(bubble.querySelector('a').matches(textRule.selectorText), false);
});

test('late official styles and replacements resolve their current hashes and remove stale adapters', async t => {
  const window = page(t);
  const { document } = window;
  runtime(t, window);
  const adapter = adapterStyle(document);
  assert.equal(adapter.textContent, '');
  const first = officialStyle(document, 'ui-layout', 'AppFrame', '.late_a1_frame { background: white; }');
  document.head.appendChild(first);
  await nextTurn();
  assert.match(adapter.textContent, /\.late_a1_frame(?:\s|,|\{)/);
  const second = officialStyle(document, 'ui-layout', 'AppFrame', '.rebuilt_z9_frame { background: black; }');
  first.replaceWith(second);
  await nextTurn();
  assert.match(adapter.textContent, /\.rebuilt_z9_frame(?:\s|,|\{)/);
  assert.doesNotMatch(adapter.textContent, /late_a1_frame/);
  second.remove();
  await nextTurn();
  assert.equal(adapter.textContent, '');
});

test('an official style populated after insertion gets an adapter once its CSS arrives', async t => {
  const window = page(t);
  const { document } = window;
  runtime(t, window);
  const style = officialStyle(document, 'ui-sidebar', 'SidebarRoot', '');
  document.head.appendChild(style);
  await nextTurn();
  assert.equal(adapterStyle(document).textContent, '');
  style.textContent = '.loaded_later_72_root { background: white; }';
  await nextTurn();
  assert.match(adapterStyle(document).textContent, /\.loaded_later_72_root(?:\s|,|\{)/);
});

test('an in-place official stylesheet hash change updates the live adapter', async t => {
  const window = page(t);
  const { document } = window;
  const style = officialStyle(document, 'ui-sidebar', 'SidebarRoot', '.before_hmr_1_root { background: white; }');
  document.head.appendChild(style);
  runtime(t, window);
  assert.match(adapterStyle(document).textContent, /before_hmr_1_root/);
  style.textContent = '.after_hmr_2_root { background: black; }';
  await nextTurn();
  assert.match(adapterStyle(document).textContent, /\.after_hmr_2_root(?:\s|,|\{)/);
  assert.doesNotMatch(adapterStyle(document).textContent, /before_hmr_1_root/);
  style.firstChild.data = '.text_node_3_root { background: gray; }';
  await nextTurn();
  assert.match(adapterStyle(document).textContent, /\.text_node_3_root(?:\s|,|\{)/);
  assert.doesNotMatch(adapterStyle(document).textContent, /after_hmr_2_root/);
});

test('the observer ignores conversation mutations and disconnects on unmount', async t => {
  const window = page(t);
  const { document } = window;
  const observers = trackObservers(window);
  const { unmount } = runtime(t, window);
  assert.equal(observers.length, 1);
  const observer = observers[0];
  assert.ok(observer.observations.length > 0);
  assert.ok(observer.observations.every(({ target }) => target === document.head), 'streaming content must not be observed');
  await nextTurn();
  const callsBefore = observer.callbacks;
  document.querySelector('#conversation').textContent = 'A streaming message changed';
  document.body.style.setProperty('--host-update', 'blue');
  await nextTurn();
  assert.equal(observer.callbacks, callsBefore);
  unmount();
  assert.equal(observer.disconnects, 1);
  document.head.appendChild(officialStyle(document, 'ui-layout', 'AppFrame', '.post_unmount_frame { color: red; }'));
  await nextTurn();
  assert.equal(observer.callbacks, callsBefore, 'disconnect must stop delivery, not merely ignore callbacks');
  assert.equal(ownedStyles(document).length, 0);
});

test('queued adapter work cannot revive styles after unmount', async t => {
  const window = page(t);
  const pending = [];
  t.mock.method(window, 'queueMicrotask', callback => pending.push(callback));
  const { unmount } = runtime(t, window);
  const adapter = adapterStyle(window.document);
  window.document.head.appendChild(officialStyle(window.document, 'ui-layout', 'AppFrame', '.queued_hash_frame { color: red; }'));
  await nextTurn();
  assert.equal(pending.length, 1, 'the late style should schedule an adapter refresh');
  unmount();
  for (const callback of pending) callback();
  assert.equal(adapter.textContent, '', 'even the detached style must not be rewritten after disposal');
  assert.equal(adapter.isConnected, false);
  assert.equal(ownedStyles(window.document).length, 0);
  assertNoAppearance(window.document.body);
});

function installBrowserGlobals(t, window) {
  for (const [name, value] of Object.entries({ window, document: window.document })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }
}

test('the client effect releases both the runtime observer and storage listener on uninstall', async t => {
  const window = page(t);
  const observers = trackObservers(window);
  const added = t.mock.method(window, 'addEventListener');
  const removed = t.mock.method(window, 'removeEventListener');
  const { theme, overrides, active } = themeService(t);
  installBrowserGlobals(t, window);
  let uninstall;
  t.after(() => uninstall?.());
  const plugin = createClientPlugin(React, assets);
  plugin.apply({
    theme,
    effect(setup) { uninstall = setup(); },
    slots: { inject(_name, setup) { setup(); }, register() {} },
  });
  assert.equal(typeof uninstall, 'function');
  assert.equal(active.size, 1);
  assert.equal(window.document.body.getAttribute('data-lg-material'), 'clear');
  assertRemovedStateAbsent(window.document.body);
  const listener = added.mock.calls.find(call => call.arguments[0] === 'storage')?.arguments[1];
  assert.equal(typeof listener, 'function');
  window.dispatchEvent(new window.StorageEvent('storage', {
    key: STORAGE_KEY,
    newValue: JSON.stringify({ enabled: true, palette: 'white', material: 'frosted', opacity: 74, blur: 21, refraction: 24, solid: true }),
    storageArea: window.localStorage,
  }));
  assert.equal(window.document.body.getAttribute('data-lg-palette'), 'white');
  assert.equal(window.document.body.getAttribute('data-lg-material'), 'frosted');
  assert.equal(window.document.body.style.getPropertyValue('--lg-opacity'), '0.74');
  assert.equal(window.document.body.style.getPropertyValue('--lg-blur-size'), '21px');
  assertRemovedStateAbsent(window.document.body);
  uninstall();
  assert.ok(removed.mock.calls.some(call => call.arguments[0] === 'storage' && call.arguments[1] === listener));
  assert.equal(observers[0].disconnects, 1);
  assert.equal(overrides[0].dispose.mock.callCount(), 1);
  assert.equal(active.size, 0);
  assert.equal(ownedStyles(window.document).length, 0);
  assertNoAppearance(window.document.body);
  const callsAfterUninstall = observers[0].callbacks;
  window.dispatchEvent(new window.StorageEvent('storage', {
    key: STORAGE_KEY, newValue: '{"enabled":true,"palette":"rose"}', storageArea: window.localStorage,
  }));
  window.document.head.appendChild(officialStyle(window.document, 'ui-layout', 'AppFrame', '.uninstalled_frame { color: red; }'));
  await nextTurn();
  assert.equal(observers[0].callbacks, callsAfterUninstall);
  assert.equal(overrides.length, 1);
  assert.equal(ownedStyles(window.document).length, 0);
  assertNoAppearance(window.document.body);
});
