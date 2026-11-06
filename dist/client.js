/* dsh-liquid-glass 1.5.2 | MIT | uses DSH shared React and UI primitives */
window.__ModuleLoader__.load({
  id: 'dsh-liquid-glass',
  factory(require) {
'use strict';
const PLUGIN_ID = 'dsh-liquid-glass';
const STORAGE_KEY = 'dsh-liquid-glass.preferences.v1';
const FLOW_DURATIONS = Object.freeze([48, 36, 24, 16, 8]);
const WALLPAPER_DIRECTIONS = Object.freeze({
  left: { label: '← 向左', angle: 270 },
  right: { label: '→ 向右', angle: 90 },
  up: { label: '↑ 向上', angle: 0 },
  down: { label: '↓ 向下', angle: 180 },
  'up-left': { label: '↖ 向左上', angle: 315 },
  'up-right': { label: '↗ 向右上', angle: 45 },
  'down-left': { label: '↙ 向左下', angle: 225 },
  'down-right': { label: '↘ 向右下', angle: 135 },
});
const DEFAULT_FLOW = Object.freeze({ aurora: false, glacier: false, rose: false, rgb: true });
const DEFAULTS = Object.freeze({
  enabled: true, palette: 'aurora', material: 'clear', opacity: 55, blur: 30,
  flow: DEFAULT_FLOW, flowDirection: 'down-right', flowSpeed: 3, staticDirection: 'down-right',
});

function normalizePreferences(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const number = (key, min, max) => typeof source[key] === 'number' && Number.isFinite(source[key])
    ? Math.max(min, Math.min(max, Math.round(source[key]))) : DEFAULTS[key];
  const direction = key => typeof source[key] === 'string' && Object.hasOwn(WALLPAPER_DIRECTIONS, source[key])
    ? source[key] : DEFAULTS[key];
  const flow = Object.fromEntries(Object.entries(DEFAULT_FLOW).map(([palette, defaultEnabled]) => {
    const enabled = source.flow?.[palette];
    return [palette, typeof enabled === 'boolean' ? enabled : defaultEnabled];
  }));
  return Object.freeze({
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULTS.enabled,
    palette: typeof source.palette === 'string' && (source.palette === 'white' || Object.hasOwn(DEFAULT_FLOW, source.palette))
      ? source.palette : DEFAULTS.palette,
    material: ['clear', 'frosted'].includes(source.material) ? source.material : DEFAULTS.material,
    opacity: number('opacity', 35, 90),
    blur: number('blur', 12, 42),
    flow: Object.freeze(flow),
    flowDirection: direction('flowDirection'),
    flowSpeed: number('flowSpeed', 1, FLOW_DURATIONS.length),
    staticDirection: direction('staticDirection'),
  });
}

function createPreferenceStore(window) {
  let storage;
  try { storage = window.localStorage; } catch { /* Private or restricted webview. */ }
  function load(raw) {
    try { return normalizePreferences(JSON.parse(raw ?? storage?.getItem(STORAGE_KEY) ?? 'null')); }
    catch { return normalizePreferences(null); }
  }
  let state = load();
  const listeners = new Set();
  let disposed = false;
  const publish = next => {
    if (disposed || JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const changed = event => {
    if ((event.key === STORAGE_KEY || event.key === null) && (!event.storageArea || event.storageArea === storage)) {
      publish(event.key === null || event.newValue === null ? normalizePreferences(null) : load(event.newValue));
    }
  };
  window.addEventListener('storage', changed);
  return {
    getSnapshot: () => state,
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
    update(patch) {
      if (disposed) return;
      const next = normalizePreferences({ ...state, ...patch });
      try { storage?.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Still apply for this page. */ }
      publish(next);
    },
    reset() { this.update(DEFAULTS); },
    dispose() { disposed = true; window.removeEventListener('storage', changed); listeners.clear(); },
  };
}

// Resolve local CSS-module names from the public, package-owned style tags.
// No CSS hash is pinned and no chat subtree is watched or rewritten.
const SCOPE = 'body[data-dsh-liquid-glass]';
const MODULES = [
  ['ui-layout', 'AppFrame', ['frame'], 'background: transparent; border: 0; border-radius: 0; margin: 0; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;'],
  ['ui-layout', 'AppFrame', ['centerCol'], 'background: transparent; border: 1px solid var(--lg-line); border-radius: 24px; margin: 8px 8px 10px 0;'],
  ['ui-layout', 'AppFrame', ['bottomRow'], 'background: transparent;'],
  ['ui-layout', 'AppFrame', ['sidebarCol'], 'position: relative; background: var(--lg-sidebar-fill); border: 1px solid var(--lg-line); border-radius: 24px; margin: 8px 10px 10px 10px; box-shadow: var(--lg-shadow);'],
  ['ui-layout', 'AppFrame', ['rightbarCol'], 'background: transparent; border: 0;'],
  ['ui-sidebar', 'SidebarRoot', ['root'], 'width: 100% !important; min-width: 0; background: transparent;'],
  ['ui-workspace', 'WorkspaceBrowser', ['fade'], 'display: none;'],
  ['ui-sidebar', 'SidebarRoot', ['newSession'], 'background: var(--lg-surface); border-color: var(--lg-line); box-shadow: var(--lg-small-shadow);'],
  ['ui-sidebar', 'SidebarRoot', ['brandMark'], 'color: var(--lg-accent); filter: drop-shadow(0 2px 6px rgb(10 132 255 / .18));'],
  ['ui-conversation', 'ConversationRoot', ['root'], 'background: transparent;'],
  ['ui-conversation', 'ConversationRoot', ['header'], 'background: var(--lg-surface-soft); border-bottom-color: var(--lg-line); -webkit-backdrop-filter: var(--lg-blur); backdrop-filter: var(--lg-blur);'],
  ['ui-conversation', 'ConversationRoot', ['composerSeat'], 'background: transparent;'],
  ['ui-conversation', 'InputBar', ['primary'], 'background: #0572df; color: #fff; box-shadow: 0 3px 12px rgb(10 132 255 / .22);'],
  ['ui-conversation', 'ContextMeter', ['panel'], 'background: var(--lg-surface-strong); border: 1px solid var(--lg-line); border-radius: 18px; box-shadow: var(--lg-shadow); -webkit-backdrop-filter: var(--lg-blur); backdrop-filter: var(--lg-blur);'],
  ['ui-chat', 'MessageItem', ['bubble'], 'background: linear-gradient(155deg, #0572df, #0863cc); color: #fff; border: 1px solid rgb(255 255 255 / .28); border-radius: 20px; box-shadow: 0 5px 16px rgb(0 100 215 / .16), inset 0 1px 0 rgb(255 255 255 / .23);'],
  ['ui-chat', 'AssistantMarkdown', ['root'], 'background: var(--lg-surface); border: 1px solid var(--lg-line); border-radius: 22px; padding: 16px 20px; box-shadow: var(--lg-small-shadow); min-width: 0; box-sizing: border-box;'],
  ['ui-chat', 'stat-dialog', ['panel'], 'background: var(--lg-surface-strong); border: 1px solid var(--lg-line); border-radius: 20px; box-shadow: var(--lg-shadow); -webkit-backdrop-filter: var(--lg-blur); backdrop-filter: var(--lg-blur);'],
  ['ui-settings-general', 'SettingsRoot', ['panel'], 'background: var(--lg-surface-strong); border: 1px solid var(--lg-line); box-shadow: var(--lg-panel-shadow); -webkit-backdrop-filter: var(--lg-blur); backdrop-filter: var(--lg-blur);'],
  ['ui-settings-general', 'SettingsRoot', ['nav'], 'background: var(--lg-surface-soft); border-right: 1px solid var(--lg-line);'],
  ['ui-settings-general', 'SettingsRoot', ['active'], 'background: var(--lg-surface-strong); box-shadow: var(--lg-small-shadow); color: var(--lg-accent-hover);'],
  ['ui-settings-general', 'SettingsRoot', ['content'], 'background: transparent;'],
  ['ui-sidebar-right', 'SidebarRight', ['panel', 'root'], 'background: transparent;'],
];

function resolveModuleClass(document, packageName, moduleName, localName) {
  const id = `@deepseek-ai/dsh-client-${packageName}/${moduleName}.module.css`;
  const style = [...document.querySelectorAll('style[data-plugin-css]')].find(tag => tag.dataset.pluginCss === id);
  if (!style) return null;
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return style.textContent.match(new RegExp(`\\.([\\w-]+_${escaped})(?![\\w-])`))?.[1] ?? null;
}

function buildAdapterCss(document) {
  const rules = [];
  for (const [packageName, moduleName, names, declarations] of MODULES) {
    const classes = names.map(name => resolveModuleClass(document, packageName, moduleName, name)).filter(Boolean);
    if (!classes.length) continue;
    // Repeating our body gate wins over DSH's platform-specific component rules.
    const selectors = classes.map(name => `${SCOPE}[data-dsh-liquid-glass] .${name}`).join(',\n');
    rules.push(`${selectors} { ${declarations} }`);
    if (moduleName === 'MessageItem') {
      rules.push(`${selectors} :is(a, code) { color: inherit; }`);
      rules.push(`${selectors} ::selection { background: rgb(255 255 255 / .28); }`);
    }
    if (moduleName === 'AssistantMarkdown') {
      rules.push(`@media (max-width: 640px) { ${selectors} { padding: 12px 14px; border-radius: 18px; } }`);
      rules.push(`@media (forced-colors: active) { ${selectors} { background: Canvas; color: CanvasText; border-color: CanvasText; } }`);
    }
  }
  const frame = resolveModuleClass(document, 'ui-layout', 'AppFrame', 'frame');
  const sidebar = resolveModuleClass(document, 'ui-layout', 'AppFrame', 'sidebarCol');
  if (frame && sidebar) {
    rules.push(`${SCOPE}[data-dsh-liquid-glass] .${frame}[data-sidebar-collapsed] .${sidebar} { margin: 0; border: 0; border-radius: 0; box-shadow: none; background: transparent; }`);
    rules.push(`html[data-fullscreen] ${SCOPE} .${frame} { margin: 0; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 0; }`);
  }
  return rules.join('\n');
}


function mountTheme({ document, window, theme, store, css, tokens, controlsCss }) {
  const body = document.body;
  const attributes = ['data-dsh-liquid-glass', 'data-lg-palette', 'data-lg-material', 'data-lg-flow'];
  const properties = ['--lg-opacity', '--lg-blur-size', '--lg-flow-duration', '--lg-static-angle'];
  const previousAttributes = new Map(attributes.map(name => [name, body.getAttribute(name)]));
  const previousProperties = new Map(properties.map(name => [name, [body.style.getPropertyValue(name), body.style.getPropertyPriority(name)]]));
  function makeStyle(name, text) {
    const tag = document.createElement('style');
    tag.dataset.plugin = PLUGIN_ID;
    tag.dataset.pluginCss = `${PLUGIN_ID}/${name}`;
    tag.textContent = text;
    document.head.appendChild(tag);
    return tag;
  }
  const material = makeStyle('theme.css', css);
  const controls = makeStyle('controls.css', controlsCss);
  const adapters = makeStyle('adapters.css', '');
  let releaseTokens = null;
  let disposed = false;
  let scheduled = false;
  const refreshAdapters = () => {
    if (disposed) return;
    const next = buildAdapterCss(document);
    if (next !== adapters.textContent) adapters.textContent = next;
  };
  // Official plugin styles may arrive after this plugin. Observe only <head>
  // metadata, never mutations in conversations, editors or streaming messages.
  const observer = new window.MutationObserver(records => {
    const officialStyle = node => node.nodeType === 1 && node.matches?.('style[data-plugin-css]') && node.dataset.plugin !== PLUGIN_ID;
    const owner = record => record.target.nodeType === 1 ? record.target : record.target.parentElement;
    if (!records.some(record => officialStyle(owner(record)) || [...record.addedNodes, ...record.removedNodes].some(officialStyle)) || scheduled) return;
    scheduled = true;
    window.queueMicrotask(() => { scheduled = false; refreshAdapters(); });
  });
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  refreshAdapters();
  function restoreAppearance() {
    releaseTokens?.();
    releaseTokens = null;
    for (const [name, value] of previousAttributes) {
      if (value === null) body.removeAttribute(name); else body.setAttribute(name, value);
    }
    for (const [name, [value, priority]] of previousProperties) {
      if (value) body.style.setProperty(name, value, priority); else body.style.removeProperty(name);
    }
  }
  function sync() {
    const state = store.getSnapshot();
    if (!state.enabled) { restoreAppearance(); return; }
    body.setAttribute('data-dsh-liquid-glass', '');
    body.setAttribute('data-lg-palette', state.palette);
    body.setAttribute('data-lg-material', state.material);
    body.style.setProperty('--lg-opacity', String(state.opacity / 100));
    body.style.setProperty('--lg-blur-size', `${state.blur}px`);
    if (state.palette === 'white') {
      body.style.removeProperty('--lg-static-angle');
    } else {
      const { angle } = WALLPAPER_DIRECTIONS[state.staticDirection];
      body.style.setProperty('--lg-static-angle', `${angle}deg`);
    }
    if (state.flow[state.palette]) {
      body.setAttribute('data-lg-flow', state.flowDirection);
      body.style.setProperty('--lg-flow-duration', `${FLOW_DURATIONS[state.flowSpeed - 1]}s`);
    } else {
      body.removeAttribute('data-lg-flow');
      body.style.removeProperty('--lg-flow-duration');
    }
    if (!releaseTokens) releaseTokens = theme.overrideTokens(PLUGIN_ID, tokens);
  }
  const unsubscribe = store.subscribe(sync);
  try { sync(); } catch (error) {
    unsubscribe(); observer.disconnect(); restoreAppearance();
    material.remove(); controls.remove(); adapters.remove();
    throw error;
  }
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe(); observer.disconnect(); restoreAppearance();
    material.remove(); controls.remove(); adapters.remove();
  };
}


function createClientPlugin(React, { Switch }, assets) {
  const h = React.createElement;
  function Droplet({ size = 18 }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
      h('path', { d: 'M12 2.5C9.2 6.1 5 10.1 5 14.1a7 7 0 0 0 14 0C19 10.1 14.8 6.1 12 2.5Z', stroke: 'currentColor', strokeWidth: 1.6 }),
      h('path', { d: 'M8.2 14.2a3.8 3.8 0 0 0 3.8 3.8', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }));
  }
  return {
    inject: ['slots', 'theme'],
    apply(ctx) {
      const store = createPreferenceStore(window);
      ctx.effect(() => {
        try {
          const unmount = mountTheme({ document, window, theme: ctx.theme, store, ...assets });
          return () => { unmount(); store.dispose(); };
        } catch (error) { store.dispose(); throw error; }
      }, 'liquid-glass: appearance and reversible material styles');
      function Settings({ compact = false }) {
        const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
        const id = React.useId();
        const flowing = state.flow[state.palette];
        const directionKey = flowing ? 'flowDirection' : 'staticDirection';
        const slider = (key, label, min, max, suffix, hint) => h('div', { className: 'dsh-lg-range', key },
          h('label', { htmlFor: `${id}-${key}` }, label, h('output', { htmlFor: `${id}-${key}` }, `${state[key]}${suffix}`)),
          h('input', { id: `${id}-${key}`, type: 'range', min, max, step: 1, value: state[key],
            onChange: event => store.update({ [key]: Number(event.target.value) }), 'aria-describedby': `${id}-${key}-hint` }),
          h('p', { id: `${id}-${key}-hint`, className: 'dsh-lg-hint' }, hint));
        return h('section', { className: 'dsh-lg-settings', 'aria-label': '液态玻璃主题' },
          h('div', { className: 'dsh-lg-heading' },
            h('div', { className: 'dsh-lg-identity' },
              h('span', { className: 'dsh-lg-icon' }, h(Droplet, { size: 22 })),
              h('div', null, h(compact ? 'h2' : 'h3', null, '液态玻璃'), h('p', null, 'Liquid Glass · 让光与色彩流入工作空间'))),
            h(Switch, { checked: state.enabled, label: '启用液态玻璃主题',
              onChange: enabled => store.update({ enabled }) })),
          h('fieldset', { className: 'dsh-lg-options', disabled: !state.enabled },
            h('legend', { className: 'dsh-lg-sr-only' }, '玻璃外观'),
            h('div', { className: 'dsh-lg-palette-label', id: `${id}-materials` }, '玻璃材质'),
            h('div', { className: 'dsh-lg-materials', role: 'group', 'aria-labelledby': `${id}-materials` },
              ...[['clear', '清透玻璃', '背景清晰，轻透亮边'], ['frosted', '柔雾磨砂', '虚化背景，柔和透光']].map(([material, label, hint]) =>
                h('button', { type: 'button', key: material, className: 'dsh-lg-material', 'aria-pressed': state.material === material,
                  onClick: () => store.update({ material }) }, h('strong', null, label), h('span', null, hint)))),
            h('div', { className: 'dsh-lg-palette-label', id: `${id}-palettes` }, '背景色彩'),
            h('div', { className: 'dsh-lg-palettes', role: 'group', 'aria-labelledby': `${id}-palettes` },
              ...[['white', '雪瓷', '白瓷 · 无彩'], ['aurora', '极光', '粉紫 · 青绿'], ['glacier', '冰湖', '雾蓝 · 湖青'], ['rose', '绯霞', '玫瑰 · 淡紫'], ['rgb', '虹波', 'RGB · 彩虹']].map(([palette, label, subtitle]) =>
                h('button', { type: 'button', key: palette, className: 'dsh-lg-palette', 'data-palette': palette,
                  'aria-pressed': state.palette === palette, onClick: () => store.update({ palette }) },
                  h('span', { className: 'dsh-lg-swatch', 'aria-hidden': true }, h('span', { className: 'dsh-lg-swatch-glass' })),
                  h('span', { className: 'dsh-lg-palette-name' }, label), h('span', { className: 'dsh-lg-hint' }, subtitle)))),
            state.palette !== 'white' && h('div', { className: 'dsh-lg-flow' },
              h('div', { className: 'dsh-lg-flow-row' },
                h('span', null, '背景流动'),
                h(Switch, { checked: flowing, label: '背景流动',
                  onChange: enabled => store.update({ flow: { ...state.flow, [state.palette]: enabled } }) })),
              h('div', { className: 'dsh-lg-flow-row' },
                h('label', { htmlFor: `${id}-direction` }, flowing ? '流动方向' : '静态渐变方向'),
                h('select', { id: `${id}-direction`, value: state[directionKey],
                  onChange: event => store.update({ [directionKey]: event.target.value }) },
                  ...Object.entries(WALLPAPER_DIRECTIONS).map(([direction, { label }]) =>
                    h('option', { key: direction, value: direction }, label)))),
              flowing && slider('flowSpeed', '流动速度', 1, FLOW_DURATIONS.length, ` / ${FLOW_DURATIONS.length}`, '数值越高，颜色流动越快。')),
            slider('opacity', '玻璃厚度', 35, 90, '%', '越低越通透，越高越清晰。'),
            state.material === 'frosted' && slider('blur', '背景虚化', 12, 42, 'px', '柔化面板背后的光与色彩。')),
          h('div', { className: 'dsh-lg-bottom' }, h('span', null, state.enabled ? '明暗随 DSH 外观设置切换' : '已恢复 DSH 原有外观'),
            h('button', { type: 'button', className: 'dsh-lg-reset', onClick: () => store.update(DEFAULTS) }, '恢复默认')));
      }
      function QuickSettings() {
        const dialog = React.useRef(null);
        const trigger = React.useRef(null);
        const title = React.useId();
        const [open, setOpen] = React.useState(false);
        return h(React.Fragment, null,
          h('button', { ref: trigger, type: 'button', className: 'dsh-lg-launcher', title: '液态玻璃外观',
            'aria-label': '液态玻璃外观', 'aria-haspopup': 'dialog',
            onClick: () => { if (!dialog.current.open) { dialog.current.showModal(); setOpen(true); } } },
            h(Droplet)),
          h('dialog', { ref: dialog, className: 'dsh-lg-dialog', role: 'dialog', 'aria-modal': open ? 'true' : undefined, 'aria-labelledby': title,
            onClick: event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect();
              if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current.close(); } },
            onClose: () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); } },
            h('div', { className: 'dsh-lg-dialog-bar' }, h('span', { id: title }, '外观调节'),
              h('button', { type: 'button', className: 'dsh-lg-close', 'aria-label': '关闭外观调节', onClick: () => dialog.current.close() }, '×')),
            h(Settings, { compact: true })));
      }
      ctx.slots.inject('settings.general.item', () => ctx.slots.register({ name: 'settings.general.item', id: 'liquid-glass.settings', order: 12 }, Settings));
      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'liquid-glass.appearance', order: 30 }, QuickSettings));
    },
  };
}

return createClientPlugin(require('react'), require('@deepseek-ai/dsh-client-ui-primitives'), {"css":"/* Liquid Glass for DSH. Every override is gated by our own body attribute.\n   Surfaces use native DSW tokens; code, diff and terminal syntax retain DSH colors. */\nbody[data-dsh-liquid-glass] {\n  --lg-white: 255 255 255;\n  --lg-ink: #1c2538;\n  --lg-secondary: #43516a;\n  --lg-muted: #5c6980;\n  --lg-accent: #0572df;\n  --lg-accent-hover: #0065cf;\n  --lg-line: rgb(255 255 255 / .66);\n  --lg-edge: rgb(255 255 255 / .86);\n  --lg-tint: rgb(10 132 255 / .12);\n  --lg-shadow-color: 47 59 104;\n  --lg-solid: #f3f5fb;\n  --lg-solid-raised: #fcfdff;\n  --lg-wallpaper: linear-gradient(var(--lg-static-angle, 135deg), #ff9a9e 0%, #a18cd1 25%, #84fab0 55%, #8fd3f4 80%, #fccb90 100%);\n  --lg-flow-stops: #ff9a9e 0%, #a18cd1 10%, #84fab0 20%, #8fd3f4 30%, #fccb90 40%, #ff9a9e 50%;\n  --lg-wash: rgb(247 250 255 / .28);\n  --lg-surface: rgb(var(--lg-white) / var(--lg-opacity, .55));\n  --lg-surface-strong: rgb(var(--lg-white) / min(1, calc(var(--lg-opacity, .55) + .23)));\n  --lg-surface-soft: rgb(var(--lg-white) / max(.16, calc(var(--lg-opacity, .55) - .22)));\n  --lg-blur: saturate(180%) blur(var(--lg-blur-size, 30px));\n  --lg-overlay-blur: blur(8px);\n  --lg-sidebar-fill: var(--lg-surface-soft);\n  --lg-small-shadow: 0 2px 8px rgb(var(--lg-shadow-color) / .07), inset 0 1px 0 var(--lg-edge);\n  --lg-shadow: 0 12px 40px -12px rgb(var(--lg-shadow-color) / .24), inset 0 1px 0 var(--lg-edge);\n  --lg-panel-shadow: 0 24px 80px -20px rgb(var(--lg-shadow-color) / .32), inset 0 1px 0 var(--lg-edge);\n  color: var(--lg-ink);\n  background: linear-gradient(var(--lg-wash), var(--lg-wash)), var(--lg-wallpaper);\n  background-attachment: fixed;\n}\nbody[data-dsh-liquid-glass][data-ds-dark-theme] {\n  --lg-white: 29 36 55;\n  --lg-ink: #f2f5ff;\n  --lg-secondary: #d0d9eb;\n  --lg-muted: #adbcd4;\n  --lg-accent: #459eff;\n  --lg-accent-hover: #6ab2ff;\n  --lg-line: rgb(205 224 255 / .17);\n  --lg-edge: rgb(224 236 255 / .24);\n  --lg-tint: rgb(83 158 255 / .20);\n  --lg-shadow-color: 0 5 20;\n  --lg-solid: #202a40;\n  --lg-solid-raised: #2c3750;\n  --lg-wallpaper: linear-gradient(var(--lg-static-angle, 135deg), #443149 0%, #2e2856 25%, #164c4b 55%, #1e3d64 80%, #4b3b49 100%);\n  --lg-flow-stops: #443149 0%, #2e2856 10%, #164c4b 20%, #1e3d64 30%, #4b3b49 40%, #443149 50%;\n  --lg-wash: rgb(9 15 31 / .24);\n}\nbody[data-dsh-liquid-glass][data-lg-palette=\"glacier\"] {\n  --lg-wallpaper: linear-gradient(var(--lg-static-angle, 135deg), #b7caf9, #a9e7ee 50%, #c5c0f2);\n  --lg-flow-stops: #b7caf9 0%, #a9e7ee 17%, #c5c0f2 33%, #b7caf9 50%;\n}\nbody[data-dsh-liquid-glass][data-lg-palette=\"rose\"] {\n  --lg-wallpaper: linear-gradient(var(--lg-static-angle, 135deg), #f7b4c2, #ceb9ed 46%, #f4d9c8);\n  --lg-flow-stops: #f7b4c2 0%, #ceb9ed 17%, #f4d9c8 33%, #f7b4c2 50%;\n}\nbody[data-dsh-liquid-glass][data-ds-dark-theme][data-lg-palette=\"glacier\"] {\n  --lg-wallpaper: linear-gradient(var(--lg-static-angle, 135deg), #222f55, #174d55 50%, #38305c);\n  --lg-flow-stops: #222f55 0%, #174d55 17%, #38305c 33%, #222f55 50%;\n}\nbody[data-dsh-liquid-glass][data-ds-dark-theme][data-lg-palette=\"rose\"] {\n  --lg-wallpaper: linear-gradient(var(--lg-static-angle, 135deg), #542d47, #352a56 46%, #513d3e);\n  --lg-flow-stops: #542d47 0%, #352a56 17%, #513d3e 33%, #542d47 50%;\n}\nbody[data-dsh-liquid-glass][data-lg-palette=\"rgb\"] {\n  --lg-flow-stops: #ffa5ba 0%, #ffd58f 8%, #b2efab 17%, #94e8df 25%, #a0c5ff 33%, #cfadff 42%, #ffa5ba 50%;\n  --lg-wallpaper: repeating-linear-gradient(var(--lg-static-angle, 135deg), var(--lg-flow-stops));\n  background-size: 100% 100%, 200% 200%;\n}\nbody[data-dsh-liquid-glass][data-ds-dark-theme][data-lg-palette=\"rgb\"] {\n  --lg-flow-stops: #77364f 0%, #705023 8%, #335c38 17%, #205a60 25%, #294e80 33%, #583e79 42%, #77364f 50%;\n}\n@media (prefers-reduced-motion: no-preference) and (forced-colors: none) {\n  /* The gradient repeats at 50%. Doubling each moving axis and traveling\n     one viewport along it advances exactly one period, even diagonally. */\n  body[data-dsh-liquid-glass][data-lg-flow]:not([data-lg-palette=\"white\"]) {\n    background-image: linear-gradient(var(--lg-wash), var(--lg-wash)), repeating-linear-gradient(var(--lg-flow-angle, 90deg), var(--lg-flow-stops));\n    background-size: 100% 100%, var(--lg-flow-size, 200% 100%);\n    animation: dsh-lg-flow var(--lg-flow-duration, 24s) linear infinite var(--lg-flow-playback, normal);\n  }\n  body[data-dsh-liquid-glass]:is([data-lg-flow=\"up\"], [data-lg-flow=\"down\"]) {\n    --lg-flow-angle: 180deg;\n    --lg-flow-size: 100% 200%;\n    --lg-flow-end: 0 100%;\n  }\n  body[data-dsh-liquid-glass]:is([data-lg-flow=\"up-left\"], [data-lg-flow=\"down-right\"]) {\n    --lg-flow-angle: 135deg;\n    --lg-flow-size: 200% 200%;\n    --lg-flow-end: 100% 100%;\n  }\n  body[data-dsh-liquid-glass]:is([data-lg-flow=\"down-left\"], [data-lg-flow=\"up-right\"]) {\n    --lg-flow-angle: 45deg;\n    --lg-flow-size: 200% 200%;\n    --lg-flow-start: 0% 100%;\n    --lg-flow-end: 100% 0%;\n  }\n  body[data-dsh-liquid-glass]:is([data-lg-flow=\"right\"], [data-lg-flow=\"down\"], [data-lg-flow=\"up-right\"], [data-lg-flow=\"down-right\"]) {\n    --lg-flow-playback: reverse;\n  }\n}\n@keyframes dsh-lg-flow {\n  from { background-position: 0 0, var(--lg-flow-start, 0% 0); }\n  to { background-position: 0 0, var(--lg-flow-end, 100% 0); }\n}\nbody[data-dsh-liquid-glass][data-lg-palette=\"white\"] {\n  --lg-wallpaper: linear-gradient(#ffffff, #ffffff);\n  --lg-wash: transparent;\n  --lg-solid: #f6f7f9;\n  --lg-solid-raised: #ffffff;\n  --lg-line: rgb(130 144 166 / .24);\n  --lg-edge: #ffffff;\n  --lg-shadow-color: 54 65 82;\n}\nbody[data-dsh-liquid-glass][data-ds-dark-theme][data-lg-palette=\"white\"] {\n  --lg-wallpaper: linear-gradient(#13161d, #13161d);\n  --lg-white: 33 37 45;\n  --lg-solid: #22262e;\n  --lg-solid-raised: #2b3039;\n  --lg-line: rgb(210 218 232 / .22);\n  --lg-edge: rgb(238 243 255 / .30);\n  --lg-shadow-color: 0 0 0;\n}\n/* Clear material uses transparent fills and highlights without background blur. */\nbody[data-dsh-liquid-glass][data-lg-material=\"clear\"] {\n  --lg-blur: none;\n  --lg-overlay-blur: none;\n  --lg-surface: rgb(var(--lg-white) / calc(var(--lg-opacity, .55) * .58));\n  --lg-surface-strong: rgb(var(--lg-white) / min(.98, calc(var(--lg-opacity, .55) + .35)));\n  --lg-surface-soft: rgb(var(--lg-white) / calc(var(--lg-opacity, .55) * .24));\n  --lg-sidebar-fill: rgb(var(--lg-white) / calc(var(--lg-opacity, .55) * .40));\n  --lg-small-shadow: 0 3px 10px rgb(var(--lg-shadow-color) / .05), inset 0 1px 0 var(--lg-edge), inset 0 -1px 0 rgb(var(--lg-white) / .28), inset 1px 0 0 rgb(var(--lg-white) / .45);\n  --lg-shadow: 0 12px 32px -14px rgb(var(--lg-shadow-color) / .25), inset 0 1px 0 var(--lg-edge), inset 1px 0 0 rgb(var(--lg-white) / .48), inset 0 -1px 0 rgb(var(--lg-white) / .30);\n}\nbody[data-dsh-liquid-glass][data-lg-material=\"clear\"] [data-composer-card] {\n  background: linear-gradient(135deg, rgb(var(--lg-white) / .08), transparent 42%, rgb(var(--lg-white) / .04)), rgb(var(--lg-white) / max(.88, var(--lg-opacity, .55)));\n}\nbody[data-dsh-liquid-glass][data-lg-material=\"clear\"] .dsh-lg-dialog::backdrop { backdrop-filter: none; }\nbody[data-dsh-liquid-glass][data-lg-material=\"clear\"] [data-composer-card]:focus-within {\n  border-color: color-mix(in srgb, var(--lg-accent) 32%, var(--lg-edge));\n  box-shadow: var(--lg-shadow), 0 0 0 2px color-mix(in srgb, var(--lg-accent) 9%, transparent);\n}\n/* Scope primary surfaces with DSH's semantic data attributes. Module adapters\n   below are generated from the official style tags, never from guessed hashes. */\nbody[data-dsh-liquid-glass] [data-composer-card] {\n  background: linear-gradient(145deg, rgb(255 255 255 / .16), transparent 55%), var(--lg-surface);\n  border: 1px solid var(--lg-line);\n  border-radius: 26px;\n  box-shadow: var(--lg-shadow);\n  -webkit-backdrop-filter: var(--lg-blur);\n  backdrop-filter: var(--lg-blur);\n  transition: box-shadow .22s ease, border-color .22s ease;\n}\nbody[data-dsh-liquid-glass] [data-composer-card]:focus-within {\n  border-color: color-mix(in srgb, var(--lg-accent) 55%, var(--lg-edge));\n  box-shadow: var(--lg-shadow), 0 0 0 3px color-mix(in srgb, var(--lg-accent) 14%, transparent);\n}\nbody[data-dsh-liquid-glass] [data-menu-material],\nbody[data-dsh-liquid-glass] [data-trigger-menu] {\n  --dsw-elevation-stroke-color: var(--lg-line);\n  --dsw-menu-backdrop-filter: var(--lg-blur);\n}\nbody[data-dsh-liquid-glass] [role=\"dialog\"] {\n  background: var(--lg-surface-strong);\n  border: 1px solid var(--lg-line);\n  border-radius: 26px;\n  box-shadow: var(--lg-panel-shadow);\n  -webkit-backdrop-filter: var(--lg-blur);\n  backdrop-filter: var(--lg-blur);\n}\nbody[data-dsh-liquid-glass] [data-composer-dock] { color: var(--lg-secondary); }\nbody[data-dsh-liquid-glass] [data-disclosure-header] { border-radius: 11px; }\nbody[data-dsh-liquid-glass] :is(button, a, input, select, textarea):focus-visible:where(:not([role=\"switch\"])) {\n  outline: 2px solid var(--lg-accent);\n  outline-offset: 3px;\n}\nbody[data-dsh-liquid-glass] ::selection { background: rgb(10 132 255 / .24); }\n/* Style the dock hosts, not the absolute panel carrier: floating windows are\n   siblings and must keep their native fixed-position geometry. */\nbody[data-dsh-liquid-glass] [data-sidebar-right-panel] :is([data-dockkit-host=\"dock\"], [data-dockkit-empty]) {\n  box-sizing: border-box;\n  margin: 8px 10px 10px 0;\n  border: 1px solid var(--lg-line);\n  border-radius: 24px;\n  background: var(--lg-sidebar-fill);\n  box-shadow: var(--lg-shadow);\n  overflow: hidden;\n}\nbody[data-dsh-liquid-glass] [data-sidebar-right-panel] [data-dockkit-host=\"dock\"] > :first-child {\n  border: 0;\n  border-radius: inherit;\n  background: transparent;\n}\nbody[data-dsh-liquid-glass] [data-sidebar-right-panel=\"fullscreen\"] :is([data-dockkit-host=\"dock\"][data-dockkit-column=\"0\"], [data-dockkit-empty]) {\n  margin-left: 10px;\n}\nbody[data-dsh-liquid-glass] [data-sidebar-right-guide] { padding-inline: clamp(12px, 3vw, 24px); }\n/* Code / terminal / diff surfaces deliberately keep their original syntax tokens.\n   Their substantial fill prevents wallpaper from reducing text contrast. */\nbody[data-dsh-liquid-glass] :is([data-code-preview], [data-changes-review]) {\n  background: var(--dsw-alias-markdown-code-block);\n}\nbody[data-dsh-liquid-glass] :is([data-code-block-banner], [data-terminal]) {\n  border-color: var(--dsw-alias-border-l2);\n}\n@media (prefers-reduced-motion: reduce) {\n  body[data-dsh-liquid-glass] [data-composer-card] { transition: none; }\n}\n@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {\n  body[data-dsh-liquid-glass] {\n    --lg-surface: var(--lg-solid);\n    --lg-surface-strong: var(--lg-solid-raised);\n    --lg-surface-soft: var(--lg-solid);\n    --lg-blur: none;\n  }\n}\n@media (prefers-contrast: more) {\n  body[data-dsh-liquid-glass] {\n    --lg-surface: var(--lg-solid);\n    --lg-surface-strong: var(--lg-solid-raised);\n    --lg-surface-soft: var(--lg-solid);\n    --lg-blur: none;\n  }\n}\n@media (forced-colors: active) {\n  body[data-dsh-liquid-glass] { background: Canvas; color: CanvasText; }\n  body[data-dsh-liquid-glass] :is([data-composer-card], [role=\"dialog\"]) {\n    background: Canvas; color: CanvasText; border: 1px solid ButtonText; box-shadow: none;\n  }\n}\n","tokens":{"--dsw-radius-xs":{"light":"6px","dark":"6px"},"--dsw-radius-sm":{"light":"11px","dark":"11px"},"--dsw-radius-md":{"light":"16px","dark":"16px"},"--dsw-radius-lg":{"light":"20px","dark":"20px"},"--dsw-radius-xl":{"light":"22px","dark":"22px"},"--dsw-radius-panel":{"light":"26px","dark":"26px"},"--dsw-alias-bg-base":{"light":"var(--lg-surface-soft)","dark":"var(--lg-surface-soft)"},"--dsw-alias-bg-layer-1":{"light":"var(--lg-surface)","dark":"var(--lg-surface)"},"--dsw-alias-bg-layer-2":{"light":"var(--lg-surface-strong)","dark":"var(--lg-surface-strong)"},"--dsw-alias-bg-layer-3":{"light":"var(--lg-solid-raised)","dark":"var(--lg-solid-raised)"},"--dsw-alias-bg-module-platform":{"light":"var(--lg-surface)","dark":"var(--lg-surface)"},"--dsw-alias-bg-overlay":{"light":"var(--lg-surface-strong)","dark":"var(--lg-surface-strong)"},"--dsw-alias-bg-mask-1":{"light":"rgb(30 43 76 / .18)","dark":"rgb(4 9 22 / .42)"},"--dsw-alias-bg-mask-2":{"light":"rgb(30 43 76 / .10)","dark":"rgb(4 9 22 / .24)"},"--dsw-alias-label-primary":{"light":"var(--lg-ink)","dark":"var(--lg-ink)"},"--dsw-alias-label-primary-dimmed":{"light":"var(--lg-secondary)","dark":"var(--lg-secondary)"},"--dsw-alias-label-secondary":{"light":"var(--lg-secondary)","dark":"var(--lg-secondary)"},"--dsw-alias-label-tertiary":{"light":"var(--lg-muted)","dark":"var(--lg-muted)"},"--dsw-alias-label-caption":{"light":"var(--lg-muted)","dark":"var(--lg-muted)"},"--dsw-alias-menu-icon":{"light":"var(--lg-secondary)","dark":"var(--lg-secondary)"},"--dsw-alias-brand-primary":{"light":"var(--lg-accent)","dark":"var(--lg-accent)"},"--dsw-alias-brand-text":{"light":"var(--lg-ink)","dark":"var(--lg-ink)"},"--dsw-alias-link":{"light":"var(--lg-accent-hover)","dark":"var(--lg-accent-hover)"},"--dsw-alias-button-primary-fill":{"light":"var(--lg-accent)","dark":"var(--lg-accent)"},"--dsw-alias-button-primary-hover":{"light":"var(--lg-accent-hover)","dark":"var(--lg-accent-hover)"},"--dsw-alias-button-info-fill":{"light":"var(--lg-accent)","dark":"var(--lg-accent)"},"--dsw-alias-button-elevated-fill":{"light":"var(--lg-surface-strong)","dark":"var(--lg-surface-strong)"},"--dsw-alias-button-floating-fill":{"light":"var(--lg-surface-strong)","dark":"var(--lg-surface-strong)"},"--dsw-alias-button-floating-hover":{"light":"var(--lg-surface)","dark":"var(--lg-surface)"},"--dsw-alias-button-ghost-active-fill":{"light":"var(--lg-tint)","dark":"var(--lg-tint)"},"--dsw-alias-button-ghost-active-hover":{"light":"rgb(10 132 255 / .18)","dark":"rgb(10 132 255 / .18)"},"--dsw-alias-interactive-bg-hover":{"light":"rgb(10 132 255 / .09)","dark":"rgb(161 204 255 / .12)"},"--dsw-alias-interactive-bg-active":{"light":"rgb(10 132 255 / .16)","dark":"rgb(161 204 255 / .20)"},"--dsw-alias-interactive-bg-hover-accent":{"light":"rgb(10 132 255 / .14)","dark":"rgb(10 132 255 / .14)"},"--dsw-alias-interactive-bg-hover-solid":{"light":"var(--lg-solid)","dark":"var(--lg-solid)"},"--dsw-alias-border-l1":{"light":"rgb(110 127 163 / .13)","dark":"rgb(196 217 255 / .10)"},"--dsw-alias-border-l2":{"light":"rgb(110 127 163 / .20)","dark":"rgb(196 217 255 / .18)"},"--dsw-alias-border-l3":{"light":"var(--lg-line)","dark":"var(--lg-line)"},"--dsw-alias-border-l4":{"light":"rgb(110 127 163 / .27)","dark":"rgb(196 217 255 / .25)"},"--dsw-alias-state-business-primary":{"light":"var(--lg-accent-hover)","dark":"var(--lg-accent-hover)"},"--dsw-alias-state-business-tertiary":{"light":"var(--lg-tint)","dark":"var(--lg-tint)"},"--dsw-alias-settings-card-fill":{"light":"var(--lg-surface)","dark":"var(--lg-surface)"},"--dsw-alias-settings-card-stroke":{"light":"var(--lg-line)","dark":"var(--lg-line)"},"--dsw-alias-scrollbar-bg-l1":{"light":"rgb(87 105 139 / .30)","dark":"rgb(184 202 233 / .28)"},"--dsw-alias-scrollbar-bg-l2":{"light":"rgb(87 105 139 / .30)","dark":"rgb(184 202 233 / .28)"},"--dsw-alias-scrollbar-hover-l1":{"light":"rgb(87 105 139 / .50)","dark":"rgb(184 202 233 / .48)"},"--dsw-alias-scrollbar-hover-l2":{"light":"rgb(87 105 139 / .50)","dark":"rgb(184 202 233 / .48)"},"--dsw-specific-input-major":{"light":"var(--lg-surface)","dark":"var(--lg-surface)"},"--dsw-specific-selector":{"light":"var(--lg-surface-strong)","dark":"var(--lg-surface-strong)"},"--dsw-specific-sidebar-fill":{"light":"var(--lg-surface-soft)","dark":"var(--lg-surface-soft)"},"--dsw-specific-sidebar-nav-item-active":{"light":"var(--lg-surface-strong)","dark":"var(--lg-surface-strong)"},"--dsw-specific-sidebar-nav-item-active-accent":{"light":"var(--lg-tint)","dark":"var(--lg-tint)"},"--dsw-specific-sidebar-nav-item-hover":{"light":"var(--lg-surface)","dark":"var(--lg-surface)"},"--dsw-specific-menu":{"light":"var(--lg-surface-strong)","dark":"var(--lg-surface-strong)"},"--dsw-menu-surface-fill":{"light":"var(--lg-surface-strong)","dark":"var(--lg-surface-strong)"},"--dsw-alias-menu-group-header-fill":{"light":"var(--lg-solid)","dark":"var(--lg-solid)"},"--dsw-menu-backdrop-filter":{"light":"var(--lg-blur)","dark":"var(--lg-blur)"},"--dsw-focus-ring-color":{"light":"var(--lg-accent)","dark":"var(--lg-accent)"},"--dsw-mask-blur":{"light":"var(--lg-overlay-blur)","dark":"var(--lg-overlay-blur)"},"--dsw-shadow-lv1":{"light":"var(--lg-small-shadow)","dark":"var(--lg-small-shadow)"},"--dsw-shadow-lv2":{"light":"var(--lg-shadow)","dark":"var(--lg-shadow)"},"--dsw-shadow-lv3":{"light":"var(--lg-panel-shadow)","dark":"var(--lg-panel-shadow)"}},"controlsCss":"/* Controls remain available when the material theme is switched off. */\n.dsh-lg-settings { color: var(--dsw-alias-label-primary, #1c2538); font-family: inherit; padding: 20px 0; border-bottom: 1px solid var(--dsw-alias-border-l2, #dde2ec); }\n.dsh-lg-settings * { box-sizing: border-box; }\n.dsh-lg-heading { display: flex; align-items: center; gap: 12px; justify-content: space-between; }\n.dsh-lg-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }\n.dsh-lg-identity h2, .dsh-lg-identity h3 { margin: 0 0 4px; font-size: 17px; font-weight: 650; line-height: 1.4; }\n.dsh-lg-identity p { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-tertiary, #5c6980); }\n.dsh-lg-icon { display: grid; place-items: center; width: 42px; height: 46px; flex: none; border: 1px solid rgb(255 255 255 / .65); border-radius: 15px; color: #1266cb; background: linear-gradient(145deg, #e8deffbb, #d1f5f3bb); box-shadow: 0 4px 16px #46769c14, inset 0 1px 0 #ffffffa0; }\n.dsh-lg-options { border: 0; padding: 0; margin: 22px 0 0; min-width: 0; }\n.dsh-lg-options:disabled { opacity: .48; }\n.dsh-lg-palette-label { font-size: 13px; font-weight: 600; margin-bottom: 10px; }\n.dsh-lg-materials { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }\n.dsh-lg-material { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; padding: 12px; border-radius: 14px; border: 1px solid var(--dsw-alias-border-l2, #dde2ec); background: transparent; color: inherit; text-align: left; font: inherit; cursor: pointer; }\n.dsh-lg-material strong { font-size: 13px; font-weight: 600; }\n.dsh-lg-material span { color: var(--dsw-alias-label-tertiary, #5c6980); font-size: 11px; line-height: 1.5; }\n.dsh-lg-material[aria-pressed=\"true\"] { border-color: #087cf0; background: #087cf009; box-shadow: 0 0 0 2px #087cf016; }\n.dsh-lg-palettes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }\n.dsh-lg-palette { display: flex; align-items: stretch; flex-direction: column; gap: 5px; border: 1px solid var(--dsw-alias-border-l2, #dde2ec); padding: 6px 6px 10px; border-radius: 15px; background: transparent; color: inherit; font: inherit; cursor: pointer; min-width: 0; text-align: center; }\n.dsh-lg-palette[aria-pressed=\"true\"] { border-color: #087cf0; box-shadow: 0 0 0 2px #087cf020; background: #087cf008; }\n.dsh-lg-swatch {\n  --lg-swatch-stops: #ff9a9e, #a18cd1 25%, #84fab0 55%, #8fd3f4 80%, #fccb90;\n  display: grid; place-items: center; height: 58px; border-radius: 10px;\n  background: linear-gradient(135deg, var(--lg-swatch-stops));\n}\n.dsh-lg-palette[data-palette=\"white\"] .dsh-lg-swatch { --lg-swatch-stops: #ffffff, #f3f5f8; border: 1px solid #dce1e9; }\n.dsh-lg-palette[data-palette=\"white\"] .dsh-lg-swatch-glass { border-color: #c4ceda80; box-shadow: 0 4px 10px #33446614, inset 0 1px 0 #fff; }\n.dsh-lg-palette[data-palette=\"glacier\"] .dsh-lg-swatch { --lg-swatch-stops: #b7caf9, #a9e7ee, #c5c0f2; }\n.dsh-lg-palette[data-palette=\"rose\"] .dsh-lg-swatch { --lg-swatch-stops: #f7b4c2, #ceb9ed 46%, #f4d9c8; }\n.dsh-lg-palette[data-palette=\"rgb\"] .dsh-lg-swatch { --lg-swatch-stops: #ffa5ba, #ffd58f, #b2efab, #94e8df, #a0c5ff, #cfadff; }\n.dsh-lg-swatch-glass { width: 58%; height: 32px; border: 1px solid #ffffffb0; border-radius: 10px; background: #ffffff44; box-shadow: 0 4px 10px #33446618, inset 0 1px 0 #ffffff99; }\n.dsh-lg-palette-name { font-size: 13px; font-weight: 600; }\n.dsh-lg-hint { color: var(--dsw-alias-label-tertiary, #5c6980); font-size: 11px; line-height: 1.5; margin: 4px 0 0; }\n.dsh-lg-flow { margin-top: 16px; padding: 12px; border: 1px solid var(--dsw-alias-border-l2, #dde2ec); border-radius: 14px; }\n.dsh-lg-flow-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 500; }\n.dsh-lg-flow-row + .dsh-lg-flow-row, .dsh-lg-flow .dsh-lg-range { margin-top: 12px; }\n.dsh-lg-flow select { font: inherit; color: inherit; background: var(--dsw-alias-bg-layer-3, #fcfdff); border: 1px solid var(--dsw-alias-border-l2, #dde2ec); border-radius: 8px; padding: 5px 8px; }\n.dsh-lg-range { margin-top: 20px; }\n.dsh-lg-range label { display: flex; justify-content: space-between; font-size: 13px; font-weight: 500; }\n.dsh-lg-range output { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #43516a); }\n.dsh-lg-range input { display: block; width: 100%; margin: 12px 0 4px; accent-color: #087cf0; cursor: pointer; }\n.dsh-lg-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; align-items: center; margin-top: 22px; font-size: 11px; color: var(--dsw-alias-label-tertiary, #5c6980); }\n.dsh-lg-reset { font: inherit; font-size: 12px; color: var(--dsw-alias-link, #087cf0); background: transparent; border: 0; border-radius: 8px; cursor: pointer; padding: 5px 7px; }\n.dsh-lg-reset:hover { background: var(--dsw-alias-interactive-bg-hover, #087cf010); }\n.dsh-lg-launcher { box-sizing: border-box; display: inline-grid; place-items: center; width: 32px; height: 32px; padding: 0; color: var(--dsw-alias-label-secondary, #43516a); border: 1px solid transparent; border-radius: 12px; background: transparent; cursor: pointer; -webkit-app-region: no-drag; }\n.dsh-lg-launcher:hover { background: var(--dsw-alias-interactive-bg-hover, #087cf010); color: var(--dsw-alias-link, #087cf0); border-color: var(--dsw-alias-border-l3, #ffffff80); }\n.dsh-lg-dialog { box-sizing: border-box; width: min(480px, calc(100vw - 32px)); max-height: min(740px, calc(100dvh - 48px)); padding: 20px 24px 24px; overflow-y: auto; background: var(--dsw-alias-bg-layer-2, #f7f9fc); color: var(--dsw-alias-label-primary, #1c2538); border: 1px solid var(--dsw-alias-border-l3, #dde2ec); border-radius: 26px; box-shadow: 0 24px 80px #162d5533; -webkit-app-region: no-drag; }\n.dsh-lg-dialog::backdrop { background: #19294833; backdrop-filter: blur(7px); }\n.dsh-lg-dialog .dsh-lg-settings { border: 0; padding: 12px 0 0; }\n.dsh-lg-dialog-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11px; color: var(--dsw-alias-label-tertiary, #5c6980); }\n.dsh-lg-close { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 50%; background: var(--dsw-alias-interactive-bg-hover, #087cf010); color: inherit; font-size: 23px; cursor: pointer; line-height: 1; }\n.dsh-lg-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }\n:is(.dsh-lg-settings, .dsh-lg-dialog) :focus-visible:where(:not([role=\"switch\"])), .dsh-lg-launcher:focus-visible { outline: 2px solid #087cf0; outline-offset: 3px; }\n@media (max-width: 480px) { .dsh-lg-dialog { padding: 16px; } .dsh-lg-identity p { font-size: 11px; } .dsh-lg-palettes { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; } }\n@media (forced-colors: active) { .dsh-lg-palette[aria-pressed=\"true\"] { outline: 2px solid Highlight; } }\n"});
  }
});
