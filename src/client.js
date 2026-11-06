import { createPreferenceStore, DEFAULTS, FLOW_DURATIONS, WALLPAPER_DIRECTIONS } from './preferences.js';
import { mountTheme } from './runtime.js';

export function createClientPlugin(React, assets) {
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
            h('button', { type: 'button', className: 'dsh-lg-switch', role: 'switch', 'aria-checked': state.enabled,
              'aria-label': '启用液态玻璃主题', onClick: () => store.update({ enabled: !state.enabled }) }, h('span'))),
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
                h('span', { id: `${id}-flow` }, '背景流动'),
                h('button', { type: 'button', className: 'dsh-lg-switch', role: 'switch', 'aria-checked': flowing,
                  'aria-labelledby': `${id}-flow`, onClick: () => store.update({ flow: { ...state.flow, [state.palette]: !flowing } }) }, h('span'))),
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
      function QuickSettings({ wide = false }) {
        const dialog = React.useRef(null);
        const trigger = React.useRef(null);
        const title = React.useId();
        const [open, setOpen] = React.useState(false);
        return h(React.Fragment, null,
          h('button', { ref: trigger, type: 'button', className: 'dsh-lg-launcher', title: '液态玻璃外观',
            'aria-label': '液态玻璃外观', 'aria-haspopup': 'dialog',
            onClick: () => { if (!dialog.current.open) { dialog.current.showModal(); setOpen(true); } } },
            h(Droplet), wide && h('span', null, '液态玻璃')),
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
