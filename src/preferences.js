export const PLUGIN_ID = 'dsh-liquid-glass';
export const STORAGE_KEY = 'dsh-liquid-glass.preferences.v1';
export const DEFAULTS = Object.freeze({ enabled: true, palette: 'aurora', material: 'clear', opacity: 55, blur: 30 });

export function normalizePreferences(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const number = (key, min, max) => typeof source[key] === 'number' && Number.isFinite(source[key])
    ? Math.max(min, Math.min(max, Math.round(source[key]))) : DEFAULTS[key];
  return Object.freeze({
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULTS.enabled,
    palette: ['aurora', 'glacier', 'rose', 'white'].includes(source.palette) ? source.palette : DEFAULTS.palette,
    material: ['clear', 'frosted'].includes(source.material) ? source.material : DEFAULTS.material,
    opacity: number('opacity', 35, 90),
    blur: number('blur', 12, 42),
  });
}

export function createPreferenceStore(window) {
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
