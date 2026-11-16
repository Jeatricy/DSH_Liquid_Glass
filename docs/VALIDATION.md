# 验证记录 · 1.6.0

验证环境：DSH 桌面版 0.2.2-rc.3（nightly `win-x64`，发布日期 2026-11-13），Windows 10，Electron 44.7.0；浏览器回归使用本机 Chrome。本记录描述功能交付时的检查，不代表对所有 DSH 版本和操作系统的兼容承诺。

## 本版修复

- **插件被跳过**：0.2.2-rc.3 的 `dsh-app-boot` 会用 `engines.dsh` 校验插件，不满足时把整条 bundle 记为 `skippedBundles` 并静默跳过。1.5.2 只声明了 `0.2.1-rc.5 || 0.2.2-rc.1`，升级后主题完全不加载。现已加入 `0.2.2-rc.3`。
- **用户气泡失去样式**：0.2.2 起用户消息改由 `@deepseek-ai/dsh-client-ui-primitives` 的 `UserMessageBubble` 渲染，`MessageItem.bubble` 这个 CSS-module 类名不再存在（0.2.2-rc.1 起即如此）。现改为命中该组件透传到 DOM 的 `data-message-bubble` 属性，0.2.1 仍保留原来的类名规则。
- **回归脚本读不到新产物**：官方客户端从 0.2.2 起压缩发布，样式表变成模板字符串（`const css$17=\`...\`;const tagId$17=\`...\`;`），旧正则只匹配 `const css = "..."`，导致用例拿不到任何官方样式。现已同时支持两种写法。
- **发送按钮**：底色与前景改用 `--lg-accent` / `--dsw-alias-label-on-color`，深色模式跟随主题，不再固定浅色蓝。

## 与 0.2.2-rc.3 的接口核对

- 样式标签仍是 `style[data-plugin-css="@deepseek-ai/dsh-client-ui-<包>/<模块>.module.css"]`，类名仍是 `<hash>_<local>` 形式；`AppFrame` 的 `frame/centerCol/bottomRow/sidebarCol/rightbarCol`、`SidebarRoot` 的 `root/newSession/brandMark`、`ConversationRoot` 的 `root/header/composerSeat`、`InputBar.primary`、`ContextMeter.panel`、`AssistantMarkdown.root`、`stat-dialog.panel`、`SettingsRoot` 的 `panel/nav/active`、`SidebarRight.panel` 均仍可解析。
- `WorkspaceBrowser.fade` 与 `SettingsRoot.content` 在 0.2.2 中已删除；适配表保留这两项，解析不到时自动跳过，0.2.1 仍生效。
- 主题服务 `theme.overrideTokens(source, tokens)` 与 `validateOverrides` 的入参校验未变；62 个 `--dsw-*` 覆盖项中只有 `--dsw-specific-sidebar-nav-item-hover` 在新版不再定义，保留它不影响 0.2.1，也不会报错。
- 槽位 `settings.general.item`、`sidebar.footer.action` 与 `ctx.slots.inject/register` 用法未变；`Switch` 仍由 `@deepseek-ai/dsh-client-ui-primitives` 导出，props 仍是 `checked/label/onChange`。
- 语义属性 `data-composer-card`、`data-composer-dock`、`data-composer-seat`、`data-menu-material`、`data-trigger-menu`、`data-disclosure-header`、`data-sidebar-right-panel`、`data-dockkit-host/empty`、`data-code-preview`、`data-terminal`、`data-changes-review`、`data-code-block-banner`、`data-ds-dark-theme`、`data-windows-titlebar`、`data-sidebar-collapsed` 均仍存在。
- 客户端模块加载器 `window.__ModuleLoader__.load({id, factory})` 的注册契约未变（新版额外支持可选的 `chunk`）。

## 自动检查

- 35 项 Node/jsdom 单元测试通过：偏好校验与迁移、存储拒绝、跨窗口同步、启停与卸载、原生主题与宿主样式保留、样式监听及清理，以及“只命中已解析组件 + 无条件语义钩子”的适配规则。
- 四组浏览器场景以 0.2.2-rc.3 官方样式通过：浅色 1360×900、深色 1360×900、小屏 390×844、减少动效 1100×840，控制台无报错。
- 新增气泡断言：`data-message-bubble` 保持 20px 圆角、品牌渐变与白字。
- 非小屏场景使用 rc.3 DockKit CSS 检查右栏内部宽度、双列分栏、全屏、收起/重开；浮动面板的视口位置与点击行为保持正常。
- 各场景检查输入、Escape、焦点恢复、控件移除、视口无额外溢出，以及禁用与卸载。

可以运行 `pnpm test` 重现单元测试。浏览器回归需要自行准备官方 SDK 参考资源，步骤见 [开发说明](../README.md#开发与验证)。

## 实机与公开材料

`engines.dsh` 的放行条件按 DSH 的判定方式复核（`semver.satisfies(版本, 范围, { includePrerelease: true })`，OR 列表逐项等值匹配）：0.2.1-rc.5、0.2.2-rc.1、0.2.2-rc.3 通过，0.2.2-rc.2 与 0.2.3 之后的版本仍会被拦下，需在确认兼容后再放开。

公开仓库只包含可复现测试和不含个人数据的[离线示例图](images/preview.png)。个人会话截图、机器配置和原始测试报告保留在本地，未包含在仓库中。浏览器测试生成的报告位于 `artifacts` 目录，并由 Git 忽略。

Windows 原生外轮廓和右上三键仍由桌面壳管理。本插件未修改系统窗口区域，也没有创建替代 DSH 服务。
