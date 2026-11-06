import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// Exercise the installed SDK's DockKit CSS, including its carrier's inline geometry.
// These fixtures never call DSH APIs or create real terminal/browser sessions.
export async function exerciseDocking(page, sdkRoot, name) {
  const directory = `${sdkRoot}/dsh-web-frontend/dist/assets`;
  const stylesheet = (await readdir(directory)).find(file => /^index-.*\.css$/.test(file));
  const frontend = await readFile(`${directory}/${stylesheet}`, 'utf8');
  const hash = frontend.match(/\._tabCell_([\w]+)_\d+/)?.[1];
  assert.ok(hash, 'Official docking CSS must be present');
  const dockCss = frontend.slice(frontend.indexOf(`._split_${hash}_`));
  const names = ['surface', 'tabLayout', 'tabCell', 'tabHost', 'pane', 'tabStrip', 'stripFill', 'stripChrome', 'floatingCell', 'float'];
  const classes = Object.fromEntries(names.map(local => {
    const found = dockCss.match(new RegExp(`\\.(_${local}_${hash}_\\d+)`))?.[1];
    assert.ok(found, `Missing DockKit ${local}`); return [local, found];
  }));
  await page.addStyleTag({ content: dockCss });
  await page.evaluate(classes => {
    const cls = window.fixtureClass, frame = document.querySelector('.fixture-frame');
    window.dockSavedFrameStyle = frame.getAttribute('style');
    frame.style.gridTemplateColumns = '252px minmax(0,1fr) 520px';
    frame.style.setProperty('--dsh-windows-sidebar-width', '252px');
    document.documentElement.setAttribute('data-windows-titlebar', '');
    document.documentElement.style.setProperty('--dsh-windows-titlebar-height', '40px');
    const column = document.createElement('div');
    column.className = cls('layout', 'AppFrame', 'rightbarCol');
    column.id = 'fixture-right-column';
    column.innerHTML = `<div class="${cls('sidebar-right', 'SidebarRight', 'panel')}" data-sidebar-right-panel="push" data-sidebar-right-open style="width:520px;--dsh-sidebar-width:520px">
      <div class="${cls('sidebar-right', 'SidebarRight', 'panelBody')}"><div class="${classes.surface}">
        <div class="${classes.tabLayout}" data-test-dock-layout style="grid-template-columns:minmax(0,1fr)">
          <div class="${classes.tabCell}" data-dockkit-host="dock" data-dockkit-column="0" style="grid-area:1/1">
            <section class="${classes.tabHost} ${classes.pane}" data-dockkit-pane="guide" data-dockkit-column="0">
              <header class="${classes.tabStrip}" style="height:48px"><span>开始</span><span class="${classes.stripFill}"></span><span class="${classes.stripChrome}"><button data-sidebar-right-mode="fullscreen" aria-label="展开右栏">⛶</button><button data-sidebar-right-toggle aria-label="收起右栏">◫</button></span></header>
              <div style="flex:1;min-height:0;overflow:auto"><div class="${cls('sidebar-right', 'GuideBody', 'guide')}" data-sidebar-right-guide>
                <button class="${cls('sidebar-right', 'GuideBody', 'entry')}">工作区文件</button><button class="${cls('sidebar-right', 'GuideBody', 'entry')}">新建终端</button><button class="${cls('sidebar-right', 'GuideBody', 'entry')}">浏览器</button>
              </div></div>
            </section>
          </div>
          <div class="${classes.floatingCell}" data-dockkit-host="float" style="grid-area:1/1"><section class="${classes.tabHost} ${classes.pane} ${classes.float}" data-dockkit-float="preview" style="left:50px;top:170px;width:160px;height:100px"><button data-test-float-button>浮动控件验证</button></section></div>
        </div>
      </div></div></div>`;
    frame.append(column);
    window.floatClickCount = 0;
    column.querySelector('[data-test-float-button]').onclick = () => window.floatClickCount++;
    column.querySelector('[data-sidebar-right-toggle]').onclick = () => column.querySelector('[data-sidebar-right-panel]').removeAttribute('data-sidebar-right-open');
  }, classes);
  const panel = page.locator('#fixture-right-column [data-sidebar-right-panel]');
  const dock = page.locator('#fixture-right-column [data-dockkit-host="dock"]');
  const float = page.locator('[data-dockkit-float="preview"]');
  const floatBefore = await float.boundingBox();
  assert.equal(floatBefore.x, 50);
  assert.equal(floatBefore.y, 170);
  await page.getByRole('button', { name: '浮动控件验证' }).click();
  assert.equal(await page.evaluate(() => window.floatClickCount), 1);
  const layout = await dock.evaluate(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    const left = document.querySelector('.fixture-sidebar').getBoundingClientRect();
    const controls = el.querySelector('[data-sidebar-right-toggle]').getBoundingClientRect();
    const inner = el.firstElementChild.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, right: r.right, leftTop: left.top, leftBottom: left.bottom, radius: s.borderRadius,
      fill: s.backgroundColor, leftFill: getComputedStyle(document.querySelector('.fixture-sidebar')).backgroundColor,
      controlsFit: controls.left >= r.left && controls.right <= r.right && controls.top >= r.top,
      innerFits: inner.right <= r.right && inner.bottom <= r.bottom };
  });
  assert.equal(layout.radius, '24px');
  assert.equal(layout.fill, layout.leftFill);
  assert.equal(layout.top, layout.leftTop);
  assert.equal(layout.bottom, layout.leftBottom);
  assert.equal(layout.right, (await page.viewportSize()).width - 10);
  assert.ok(layout.controlsFit && layout.innerFits);
  await page.screenshot({ path: `artifacts/right-sidebar-${name}.png`, fullPage: true });

  await page.evaluate(() => {
    const layout = document.querySelector('[data-test-dock-layout]');
    const second = layout.querySelector('[data-dockkit-host="dock"]').cloneNode(true);
    second.style.gridColumn = '2';
    second.dataset.dockkitColumn = '1'; second.querySelector('[data-dockkit-pane]').dataset.dockkitColumn = '1';
    second.querySelector('[data-dockkit-pane]').dataset.dockkitPane = 'second';
    layout.style.gridTemplateColumns = 'minmax(0,1fr) minmax(0,1fr)';
    layout.append(second);
  });
  const split = await dock.evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; }));
  assert.equal(split.length, 2); assert.ok(split[0].right < split[1].left); assert.ok(split.every(r => r.width > 0));
  assert.deepEqual(await float.boundingBox(), floatBefore, 'split layout must not re-anchor floating panes');

  await page.evaluate(() => {
    const layout = document.querySelector('[data-test-dock-layout]');
    layout.querySelector('[data-dockkit-host="dock"][data-dockkit-column="1"]').remove();
    layout.style.gridTemplateColumns = 'minmax(0,1fr)';
    const panel = document.querySelector('#fixture-right-column [data-sidebar-right-panel]');
    panel.dataset.sidebarRightPanel = 'fullscreen'; panel.style.width = '100vw'; panel.style.setProperty('--dsh-sidebar-width', '100vw');
  });
  const expanded = await dock.boundingBox();
  assert.equal(expanded.x, 262);
  assert.equal(expanded.x + expanded.width, (await page.viewportSize()).width - 10);
  assert.equal(await dock.evaluate(el => getComputedStyle(el).borderRadius), '24px');
  assert.deepEqual(await float.boundingBox(), floatBefore, 'fullscreen must not re-anchor floating panes');
  await page.getByRole('button', { name: '收起右栏' }).click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#fixture-right-column [data-dockkit-host="dock"]')).visibility === 'hidden');
  await page.getByRole('button', { name: '浮动控件验证' }).click();
  assert.equal(await page.evaluate(() => window.floatClickCount), 2);
  assert.deepEqual(await float.boundingBox(), floatBefore);
  await panel.evaluate(el => el.setAttribute('data-sidebar-right-open', ''));
  await dock.waitFor({ state: 'visible' });

  await page.evaluate(() => {
    document.getElementById('fixture-right-column').remove();
    const frame = document.querySelector('.fixture-frame');
    if (window.dockSavedFrameStyle === null) frame.removeAttribute('style'); else frame.setAttribute('style', window.dockSavedFrameStyle);
    document.documentElement.removeAttribute('data-windows-titlebar');
    document.documentElement.style.removeProperty('--dsh-windows-titlebar-height');
  });
  return { rounded: true, matchesLeftSurface: true, inlineWidthFits: true, splitFits: true, fullscreenFits: true, collapseReopen: true, floatingPositionAndClicksPreserved: true };
}
