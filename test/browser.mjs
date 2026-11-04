// Offline regression fixture using official rc.5 module styles and shared React.
// This does not claim to be the authenticated desktop GUI; live checks are separate.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { exerciseDocking } from './docking-fixture.mjs';
const require = createRequire(import.meta.url);
const reactRoot = dirname(require.resolve('react/package.json'));
const domRoot = dirname(require.resolve('react-dom/package.json'));
const domRequire = createRequire(resolve(domRoot, 'package.json'));
const definitions = await Promise.all([
  ['react', resolve(reactRoot, 'cjs/react.development.js')],
  ['scheduler', resolve(dirname(domRequire.resolve('scheduler/package.json')), 'cjs/scheduler.development.js')],
  ['react-dom', resolve(domRoot, 'cjs/react-dom.development.js')],
  ['react-dom/client', resolve(domRoot, 'cjs/react-dom-client.development.js')],
].map(async ([name, path]) => [name, await readFile(path, 'utf8')]));
const sdkRoot = process.env.DSH_SDK_REFERENCE_DIR || '.cache/dsh/node_modules/@deepseek-ai';
const sdkStyles = [];
for (const name of ['theme', 'layout', 'sidebar', 'sidebar-right', 'conversation', 'chat', 'settings-general', 'workspace']) {
  const source = await readFile(`${sdkRoot}/dsh-client-ui-${name}/lib/client.js`, 'utf8');
  for (const match of source.matchAll(/const css(?:\$\d+)? = ("(?:[^"\\]|\\.)*");\s+const tagId(?:\$\d+)? = ("(?:[^"\\]|\\.)*");/g)) {
    sdkStyles.push({ id: JSON.parse(match[2]), css: JSON.parse(match[1]) });
  }
  if (name === 'theme') {
    for (const match of source.matchAll(/var [\w$]+_css_default = ("(?:[^"\\]|\\.)*");/g)) sdkStyles.push({ id: `native-base-${sdkStyles.length}`, css: JSON.parse(match[1]) });
  }
}
const bundle = await readFile('dist/client.js', 'utf8');
const executablePath = [process.env.DSH_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(path => path && existsSync(path));
const browser = await chromium.launch({ executablePath, headless: true });
await mkdir('artifacts', { recursive: true });
const report = { kind: 'offline-browser-regression', officialSdk: '0.2.1-rc.5', results: [] };
try {
  for (const [name, width, height, dark, reduced] of [['light', 1360, 900, false, false], ['dark', 1360, 900, true, false], ['mobile', 390, 844, false, false], ['reduced', 1100, 840, false, true]]) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.route('https://liquid-glass.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body></body></html>' }));
    await page.goto('https://liquid-glass.test/');
    await page.evaluate(({ definitions, sdkStyles, dark }) => {
      window.process = { env: { NODE_ENV: 'development' } };
      const modules = new Map(definitions), cache = new Map();
      window.sharedRequire = id => {
        if (cache.has(id)) return cache.get(id).exports;
        const module = { exports: {} }; cache.set(id, module);
        new Function('module', 'exports', 'require', modules.get(id))(module, module.exports, window.sharedRequire);
        return module.exports;
      };
      for (const { id, css } of sdkStyles) {
        const tag = document.createElement('style'); tag.dataset.pluginCss = id; tag.dataset.plugin = '@deepseek-ai/native'; tag.textContent = css; document.head.append(tag);
      }
      const cls = (pkg, module, local) => {
        const style = sdkStyles.find(s => s.id === `@deepseek-ai/dsh-client-ui-${pkg}/${module}.module.css`);
        return style?.css.match(new RegExp(`\\.([\\w-]+_${local})(?![\\w-])`))?.[1] ?? '';
      };
      document.body.toggleAttribute('data-ds-dark-theme', dark);
      document.body.innerHTML = `<div class="${cls('layout', 'AppFrame', 'frame')} fixture-frame">
        <aside class="${cls('layout', 'AppFrame', 'sidebarCol')} fixture-sidebar"><div style="width:252px" class="${cls('sidebar', 'SidebarRoot', 'root')}">
          <div class="fixture-brand">◒ <span>DeepSeek Harness</span></div><button class="${cls('sidebar', 'SidebarRoot', 'newSession')}">＋ 新建对话</button>
          <div class="fixture-nav">◷　计划任务<br>▧　工作区<br>◇　插件</div><small class="fixture-label">今天</small><div class="fixture-selected">液态玻璃主题设计</div><div class="fixture-nav">重构组件与样式<br>审查项目结构<br>整理开发计划</div><span data-test-fade class="${cls('workspace', 'WorkspaceBrowser', 'fade')}"></span><div class="fixture-footer" id="footer"></div></div></aside>
        <main class="${cls('layout', 'AppFrame', 'centerCol')}"><div class="${cls('conversation', 'ConversationRoot', 'root')}" data-phase="active">
          <header class="${cls('conversation', 'ConversationRoot', 'header')} fixture-header"><span>液态玻璃主题设计</span><span class="fixture-chip">DeepSeek · 编程助手</span></header>
          <div class="fixture-chat" data-conversation-scroll><div class="fixture-notice">组件预览 · 使用官方 DSH 样式 · 示例对话</div>
            <div class="${cls('chat', 'MessageItem', 'userRow')}"><div class="${cls('chat', 'MessageItem', 'bubble')}">让整个工作空间，都拥有通透的液态玻璃质感。</div></div>
            <div class="${cls('chat', 'AssistantMarkdown', 'root')} fixture-answer"><p>让光与色彩，流入你的工作空间。</p><p>透过柔和的磨砂面板，背景呈现出淡淡的粉紫、青绿与湖蓝。文字依然清晰，所有常用操作都触手可及。</p><div class="fixture-code"><div data-code-block-banner>theme.js <button id="copy-code">复制</button></div><pre><span style="color:var(--shiki-token-keyword)">const</span> theme = {
  material: <span style="color:var(--shiki-token-string)">'liquid-glass'</span>,
  blur: <span style="color:var(--shiki-token-constant)">30</span>,
  adaptive: <span style="color:var(--shiki-token-keyword)">true</span>
};</pre></div><p>在侧栏底部打开「液态玻璃」，即可调整色彩、透明度和背景虚化。</p></div>
            <div class="fixture-tools" data-disclosure-header>✓ 主题已就绪　 ·　浅色与深色自动适配</div>
          </div><div class="fixture-composer" data-composer-seat><div data-composer-card><div contenteditable="true" role="textbox" aria-label="消息" data-composer-input class="fixture-input"></div><div class="fixture-composer-tools"><span>＋　◇　工具</span><button aria-label="发送示例" class="fixture-send">↑</button></div></div><div class="fixture-footnote">Liquid Glass · 清透玻璃</div></div>
        </div></main></div>`;
      window.__ModuleLoader__ = { load: descriptor => { window.plugin = descriptor.factory(window.sharedRequire); } };
      window.fixtureClass = cls;
    }, { definitions, sdkStyles, dark });
    await page.addStyleTag({ content: `html,body{margin:0;height:100%;font-family:system-ui,'Microsoft YaHei',sans-serif}*{box-sizing:border-box}button{font:inherit;cursor:pointer}.fixture-frame{grid-template-columns:252px minmax(0,1fr)}.fixture-brand{display:flex;gap:10px;align-items:center;font-size:16px;font-weight:650;padding:22px 10px 28px}.fixture-brand:first-letter{color:#087cf0}.fixture-nav{padding:10px 12px;font-size:13px;line-height:3;color:var(--dsw-alias-label-secondary)}.fixture-label{padding:18px 12px 10px;color:var(--dsw-alias-label-caption)}.fixture-selected{padding:12px;border:1px solid var(--lg-line);border-radius:12px;background:var(--dsw-specific-sidebar-nav-item-active);font-size:13px}.fixture-footer{margin-top:auto;padding:16px 0}.fixture-header{display:flex;justify-content:space-between;align-items:center;min-height:66px!important;padding:16px 26px!important;font-size:14px;font-weight:550}.fixture-chip{font-size:11px;border:1px solid var(--lg-line);border-radius:30px;padding:6px 12px;background:var(--lg-surface)}.fixture-chat{flex:1;overflow:auto;padding:30px max(28px,calc((100% - 760px) / 2));display:flex;flex-direction:column;gap:25px}.fixture-notice{color:var(--dsw-alias-label-caption);font-size:11px;text-align:center}.fixture-answer p{margin:0 0 12px;font-size:14px;line-height:1.85}.fixture-answer p:last-child{margin:14px 0 0}.fixture-code{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-markdown-code-block);border-radius:14px;overflow:hidden}.fixture-code [data-code-block-banner]{font-size:11px;padding:8px 14px;display:flex;justify-content:space-between;border-bottom:1px solid var(--dsw-alias-border-l2)}.fixture-code button{background:transparent;border:0;color:var(--dsw-alias-label-tertiary);font-size:11px}.fixture-code pre{margin:0;padding:16px;font:12px/1.8 Consolas,monospace;overflow-x:auto}.fixture-tools{font-size:12px;color:var(--dsw-alias-label-tertiary)}.fixture-composer{padding:12px 28px 16px;max-width:816px;width:100%;margin:auto}.fixture-input{padding:16px 18px;min-height:75px;font-size:14px;outline:0}.fixture-input:empty:before{content:'有什么我可以帮你的？';color:var(--dsw-alias-label-caption);pointer-events:none}.fixture-composer-tools{display:flex;justify-content:space-between;align-items:center;padding:4px 12px 12px;color:var(--dsw-alias-label-secondary);font-size:12px}.fixture-send{background:#087cf0;color:white;width:32px;height:32px;border:0;border-radius:50%}.fixture-footnote{text-align:center;font-size:10px;margin-top:12px;color:var(--dsw-alias-label-caption)}@media(max-width:640px){.fixture-frame{grid-template-columns:minmax(0,1fr)}.fixture-sidebar{display:none}.fixture-chip{display:none}.fixture-header{padding:16px!important}.fixture-chat{padding:20px 16px;gap:18px}.fixture-composer{padding:10px 16px}.fixture-answer p{font-size:13px}#footer{position:fixed;top:12px;right:10px;z-index:9;display:block}}` });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(dark => {
      const slots = new Map(), cleanup = [];
      const theme = { overrideTokens(_source, tokens) {
        const prior = new Map(Object.keys(tokens).map(name => [name, document.body.style.getPropertyValue(name)]));
        for (const [name, pair] of Object.entries(tokens)) document.body.style.setProperty(name, pair[dark ? 'dark' : 'light']);
        return () => { for (const [name, value] of prior) { if (value) document.body.style.setProperty(name, value); else document.body.style.removeProperty(name); } };
      } };
      window.plugin.apply({ theme, effect(fn) { cleanup.push(fn()); }, slots: { inject(_name, fn) { fn(); }, register(descriptor, component) { slots.set(descriptor.name, component); } } });
      const { createRoot } = window.sharedRequire('react-dom/client');
      const root = createRoot(document.getElementById('footer'));
      root.render(window.sharedRequire('react').createElement(slots.get('sidebar.footer.action'), { wide: true }));
      window.cleanupPlugin = () => { root.unmount(); for (const fn of cleanup.reverse()) fn?.(); };
      document.getElementById('copy-code').onclick = event => { event.target.textContent = '已复制'; };
    }, dark);
    await page.waitForSelector('body[data-dsh-liquid-glass]');
    if (name === 'light') {
      const fixedTop = await page.evaluate(() => {
        document.documentElement.setAttribute('data-windows-titlebar', '');
        document.documentElement.style.setProperty('--dsh-windows-titlebar-height', '40px');
        const button = document.createElement('button');
        button.style.cssText = 'position:fixed;top:8px;left:20px;width:28px;height:28px';
        document.querySelector('.fixture-sidebar').append(button);
        const top = button.getBoundingClientRect().top;
        button.remove(); document.documentElement.removeAttribute('data-windows-titlebar');
        document.documentElement.style.removeProperty('--dsh-windows-titlebar-height');
        return top;
      });
      assert.equal(fixedTop, 8, 'glass sidebar must not re-anchor native fixed titlebar buttons');
    }
    const material = await page.locator('[data-composer-card]').evaluate(el => ({ blur: getComputedStyle(el).backdropFilter, radius: getComputedStyle(el).borderRadius, background: getComputedStyle(el).backgroundColor }));
    assert.equal(material.blur, 'none');
    assert.equal(await page.locator('svg[data-lg-filter], [data-lg-lens]').count(), 0);
    assert.equal(await page.locator('[data-test-fade]').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator('.fixture-sidebar').evaluate(el => getComputedStyle(el).borderRadius), '24px');
    if (width > 640) assert.ok(await page.locator('.fixture-sidebar').evaluate(el => {
      const frame = el.getBoundingClientRect(), button = el.querySelector('button').getBoundingClientRect();
      return button.right < frame.right && button.left > frame.left;
    }), 'sidebar actions must remain inside the rounded panel');
    assert.deepEqual(await page.locator('.fixture-answer').evaluate(el => {
      const s = getComputedStyle(el); return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
    }), Array(4).fill(width < 640 ? '18px' : '22px'));
    assert.equal(material.radius, '26px');
    await page.getByRole('textbox', { name: '消息' }).fill('验证中文输入与玻璃面板');
    assert.equal(await page.getByRole('textbox', { name: '消息' }).innerText(), '验证中文输入与玻璃面板');
    await page.getByRole('textbox', { name: '消息' }).fill('');
    await page.getByRole('button', { name: '复制', exact: true }).click();
    await page.getByRole('button', { name: '已复制', exact: true }).waitFor();
    const shell = await page.locator('.fixture-frame').evaluate(el => {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, border: style.borderTopWidth, radius: style.borderRadius };
    });
    assert.deepEqual(shell, { x: 0, y: 0, width, height, border: '0px', radius: '0px' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), 'outer frame must fit the viewport');
    await page.screenshot({ path: `artifacts/preview-${name}.png`, fullPage: true });
    if (width < 640) await page.evaluate(() => document.body.append(document.getElementById('footer')));
    await page.getByRole('button', { name: '液态玻璃外观', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '外观调节', exact: true });
    await dialog.waitFor();
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.height <= height);
    await dialog.getByRole('button', { name: /纯白/ }).click();
    assert.equal(await page.locator('body').getAttribute('data-lg-palette'), 'white');
    if (!dark) assert.match(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundImage), /rgb\(255, 255, 255\)/);
    await dialog.getByRole('button', { name: /柔雾磨砂/ }).click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-composer-card]')).backdropFilter.includes('blur(30px)'));
    assert.equal(await page.locator('[data-composer-card]').getAttribute('data-lg-lens'), null);
    await dialog.getByRole('slider', { name: /背景虚化/ }).focus(); await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('[data-composer-card]').evaluate(el => getComputedStyle(el).backdropFilter), /blur\(31px\)/);
    await dialog.getByRole('button', { name: /清透玻璃/ }).click();
    assert.equal(await page.locator('[data-composer-card]').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    assert.equal(await dialog.getByRole('slider', { name: /边缘折射/ }).count(), 0);
    assert.equal(await dialog.getByRole('checkbox', { name: /减少透明效果/ }).count(), 0);
    assert.equal(await page.locator('svg[data-lg-filter], [data-lg-lens]').count(), 0);
    if (name === 'light') {
      await page.keyboard.press('Escape');
      await page.screenshot({ path: 'artifacts/preview-white.png', fullPage: true });
      await page.getByRole('button', { name: '液态玻璃外观', exact: true }).click();
    }
    await dialog.getByRole('button', { name: /冰川/ }).click();
    assert.equal(await page.locator('body').getAttribute('data-lg-palette'), 'glacier');
    const slider = dialog.getByRole('slider', { name: /玻璃厚度/ });
    await slider.focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await slider.inputValue(), '56');
    await dialog.getByRole('switch', { name: '启用液态玻璃主题' }).click();
    assert.equal(await page.locator('body').getAttribute('data-dsh-liquid-glass'), null);
    await dialog.getByRole('switch', { name: '启用液态玻璃主题' }).click();
    await dialog.getByRole('button', { name: '恢复默认', exact: true }).click();
    await page.screenshot({ path: `artifacts/controls-${name}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: '液态玻璃外观', exact: true }).evaluate(el => el === document.activeElement), true);
    const docking = width >= 1100 ? await exerciseDocking(page, sdkRoot, name) : null;
    await page.evaluate(() => window.cleanupPlugin());
    assert.equal(await page.locator('style[data-plugin="dsh-liquid-glass"]').count(), 0);
    assert.equal(await page.locator('svg[data-lg-filter], [data-lg-lens]').count(), 0);
    assert.equal(await page.locator('body').getAttribute('data-dsh-liquid-glass'), null);
    assert.equal(await page.evaluate(() => document.body.hasAttribute('data-ds-dark-theme')), dark);
    assert.deepEqual(errors, []);
    report.results.push({ name, viewport: { width, height }, passed: true, material, docking, removedControlsAbsent: true, outerFrameRemoved: true, inputWorks: true, dialogFits: true, keyboardWorks: true, disabledRestoresNative: true, disposedCleanly: true, errors });
    await page.close();
  }
  await writeFile('artifacts/browser-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
