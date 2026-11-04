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

export function resolveModuleClass(document, packageName, moduleName, localName) {
  const id = `@deepseek-ai/dsh-client-${packageName}/${moduleName}.module.css`;
  const style = [...document.querySelectorAll('style[data-plugin-css]')].find(tag => tag.dataset.pluginCss === id);
  if (!style) return null;
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return style.textContent.match(new RegExp(`\\.([\\w-]+_${escaped})(?![\\w-])`))?.[1] ?? null;
}

export function buildAdapterCss(document) {
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
