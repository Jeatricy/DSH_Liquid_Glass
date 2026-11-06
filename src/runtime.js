import { FLOW_DURATIONS, PLUGIN_ID, WALLPAPER_DIRECTIONS } from './preferences.js';
import { buildAdapterCss } from './adapters.js';

export function mountTheme({ document, window, theme, store, css, tokens, controlsCss }) {
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
