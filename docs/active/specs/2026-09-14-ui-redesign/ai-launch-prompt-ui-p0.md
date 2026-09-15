# UI-P0 启动提示词：主题令牌 + AppShell 骨架 + 共享组件

> 用法：新 AI 会话（Claude Code / Codex）开场**整段粘贴本文件**。
> 前置：`UI-OPTIMIZATION-PLAN.md` 已确认，本批是全部后续批次的先决条件。

---

## 角色

你是 Mate Platform 前端工程师，负责落地已评审定稿的 UI 设计规范「Calm Density」的第一批次（UI-P0）。设计规范与高保真原型已存在，你的工作是把它变成 metaplatform-frontend 的代码地基。**后端零改动。**

## 必读（按序，开工前全部读完）

1. `docs/active/specs/2026-09-14-ui-redesign/DESIGN-SPEC.md` —— 设计规范 v1.3（令牌 §4 / 骨架 §5 / 壳 §3 / 控件预算纪律）
2. `docs/active/specs/2026-09-14-ui-redesign/index.html` —— 高保真原型（单文件可直接打开；壳、tab、SideSheet、⌘K、Copilot dock 的交互以它为准）
3. `CLAUDE.md` —— 项目约束
4. `metaplatform-frontend/apps/web/src/App.tsx` —— 现有路由（11 域约 100+ 路由）
5. `metaplatform-frontend/apps/web/src/contexts/SettingsContext.tsx` —— 现有主题机制（body[theme-mode]，保留）

## 范围

**做**：
1. DSM 主题包 `packages/semi-theme-mate/` + vite 插件接入（见技术规格第一节，**官方定制路线**）
2. `src/styles/tokens.css` —— 平台布局令牌（rail/tab/sheet 宽度与间距 10 档，非 Semi 主题）
3. AppShell v2 组件：`src/components/shell/`（AppShell / IconRail / TopBar / PageTabs / CommandPalette / CopilotDock）
4. 新 IA 路由：8 域 + 页内 tab；旧路由全部 `<Navigate replace>` 301
5. 五骨架共享组件：`src/components/skeleton/`（PageHeader / FilterBar / DataTablePro / EmptyState / SheetDetail）
6. `src/routes/demo` 组件演示页（挂「平台管理」域，验证骨架与令牌）

**不做**：任何业务页面内容重构（那是 UI-P1/P2）、图谱组件、Copilot 对话逻辑（dock 只做挂载与开合）。

## 技术规格

### 主题定制 —— 必须走 Semi 官方路线（DSM 主题包）

Semi 官方主题定制 = **DSM 主题包**（SCSS 变量在构建期替换）。运行时覆盖 `--semi-color-*` 对部分组件（编译期展开的阴影/渐变等）不生效，**禁止**作为主题方案。

1. 手工创建 DSM 兼容主题包 `packages/semi-theme-mate/`（DSM 导出包结构：`package.json` + `scss/variables.scss`），变量取值严格抄 DESIGN-SPEC §4.3（主色 `#3B5BF6`、圆角 8/6 等；变量名以官方 `@douyinfe/semi-theme-default` 源码为准，用 Semi MCP / `semi-ui-skills` skill 核对，不要凭记忆写）。
2. vite 官方插件接入（apps/web/vite.config.ts）：
   ```ts
   import SemiPlugin from '@douyinfe/semi-vite-plugin';
   plugins: [react(), SemiPlugin({ theme: '@mate/semi-theme' })],
   ```
   依赖：`pnpm add -D @douyinfe/semi-vite-plugin sass`，主题包以 workspace 依赖挂到 apps/web。
3. 深色模式继续官方 `body[theme-mode="dark"]`（DSM 包内 dark 变量一并定制），`SettingsContext` 不动。
4. `src/styles/tokens.css` **只放平台布局令牌**（Semi 没有的能力，非覆盖）：`--mp-rail-w/--mp-tabbar-h/--mp-sheet-w` + 间距 10 档 `--mp-space-*`。**该文件禁止出现任何 `--semi-*` 字样**。

间距纪律：业务代码 padding/margin/gap 只允许取 10 档令牌，原型 §4.1 为准。

### 组件映射表（骨架 → Semi 官方组件；实现前用 Semi MCP / skill 核对 API）

| 骨架元素 | Semi 官方组件 | 说明 |
|----------|---------------|------|
| AppShell 布局 | `Layout`（Sider/Header/Content） | 禁止自绘 div 布局 |
| 图标导航栏 rail | `Nav`（vertical 仅图标模式，items/selectedKeys） | 禁止自绘按钮列 |
| 页内主 tab | `Tabs type="line"`（tabBarExtraContent 放右侧动作） | sticky 由容器类控制 |
| 子 tab（segmented） | `Tabs type="button"` | 与主 tab 形成两级视觉 |
| 面包屑 / 徽标 | `Breadcrumb` / `Badge` | |
| 数据表格 | `Table`（rowSelection/sorters/filters/resizable/ellipsis/pagination） | DataTablePro 基于它封装 |
| 详情浮层 | `SideSheet`（width 456 / mask={false} / closeOnEsc / getPopupContainer） | Foundry Selection Preview 范式 |
| 详情属性 / 时间线 / 步骤 | `Descriptions` / `Timeline` / `Steps` | 禁止手写 kv 网格与竖线 |
| 进度 / 卡片 / 列表 / 头像 | `Progress` / `Card(+Meta)` / `List` / `Avatar` | |
| 空状态 | `Empty` + `Illustration` | 禁止自绘图标空态 |
| 表单 / 提示 | `Form`（抽屉内）/ `Toast` / `Banner` | |
| 命令面板 ⌘K | Semi 无此组件 → `Modal` + `Input` + `List` 组合，键盘导航自实现 | 唯一允许的组合件 |
| 力导向图谱 | Semi 无此组件 → 移植原型引擎封装 `ForceGraph.tsx`（P1a） | |

**组件优先级纪律**：Semi 有对应组件就禁止自绘同类 UI（含 Tag/Tooltip/Popover/Dropdown/Switch/Skeleton/ScrollList/Highlight 等）；官方没有的才允许组合/自建，自建件内部元素也尽量复用 Semi 基础件。

### AppShell v2 组件树

```
<AppShell>                          // Semi Layout
  <Sider> <IconRail domains={8}/>   // Semi Nav(vertical)
  <Layout>
    <Header> TopBar                 // Breadcrumb + Input(⌘K) + 环境徽标 + Badge(Bell) + 布局切换
    <Content>
      <PageTabs/>                   // Semi Tabs type="line"
      <Outlet/>
    </Content>
  </Layout>
  <CopilotDock/>                    // 右侧 376px 可收起（P0 仅壳 + 开合）
  <CommandPalette/>                 // Ctrl+K（Semi 组合件，见映射表）
</AppShell>
```

布局模式切换（侧栏 rail / 顶栏一级 tab）：`data-nav="side|top"` 挂在 `#app` 根，CSS 控制显隐，偏好写 localStorage。

### 新 IA 与 301 路由表（8 域）

| 新域 | 路由前缀 | 吸收（旧路由 → 301 目标） |
|------|----------|---------------------------|
| 工作台 | `/home/*` | `/dashboard`、`/dashboard/{my-apps,messages,notifications,deliverables,portal,aiops,settings}` → `/home` 或域内 tab；`/dashboard/my-agents` → `/agents` |
| 本体 | `/ontology/*` | `/ontology?tab=*` → `/ontology/{explorer,datacenter,model,ops}`；`/ontology/datacenter` → `/ontology/datacenter` |
| 数字员工 | `/agents/*` | `/agents/*` 保留；`/dw/{employees,tasks,collaborations,evaluations,learning,documents,extraction,obs}` → `/agents` 域内 tab；`/dw/a2a` → `/agents/external` |
| SuperAI | `/superai/*` | 16 条旧路由 → `/superai/{chat,plans,schedules,cost,templates}`；`/superai/tasks` → `/superai/plans`；`/wfe/action-orchestration/:id` → `/superai/plans/:id` |
| 应用中心 | `/apps/*` | `/apps`、`/market(place)?/*` → `/apps/{mine,market,templates,designer}`；`/apps/:appId/*` 详情保留 |
| 知识与集成 | `/ki/*` | `/knowledge/*` → `/ki/kb/*`；`/mcp/*` 全部 → `/ki/mcp/*`（子路径透传） |
| 数据与治理 | `/gov/*` | `/arch/*` 全部 → `/gov/{business,data,tech,governance}/*`（子路径透传） |
| 平台管理 | `/admin/*` | `/admin/*` 域内归并为 `{org,platform,ops}` 三 tab；demo 页挂 `/admin/demo` |

301 实现统一放 `src/routes/legacy-redirects.tsx`，一个文件列全（并行批次不碰它以外的新路由注册）。

### 共享组件契约（P1 各域依赖，P0 冻结 API）

- `PageHeader({title, desc, actions})`
- `FilterBar({search, filters, right})`
- `DataTablePro`：Semi Table 封装（rowSelection、列头排序/列宽/显隐、40px 行高、底部「已选 n 项 · 清除」+ 分页）
- `SheetDetail({title, open, onClose, footer})`：Semi SideSheet（`width=456, mask={false}, closeOnEsc`，容器内渲染）
- `EmptyState({icon, title, desc, actions})`：基于 Semi `Empty` + `Illustration`

## 环境与验证

- dev：`metaplatform-frontend/apps/web` → `pnpm dev`（9250），后端 gateway 8100；登录 `POST /api/v1/iam/auth/login` `{"username":"admin","password":"admin123"}` 取 JWT
- 视觉证据：Playwright `visual-action.spec.ts` 模式（浅/深双主题各截）
- `pnpm build` 必须通过

## 已知坑（前人踩过）

1. dev 模式 React 18 + vite HMR 下 Semi Button onClick 会被截断（noop）——登录等验证脚本走原生 `fetch`，或用原生 `<button>`
2. Windows 后端测试必须用 `mate-platform-backend/.venv`；本批纯前端一般用不到
3. `body[theme-mode]` 是 Semi 官方深色开关，settings 里已有逻辑，**不要**另起炉灶

## DoD（缺一不可）

- [ ] 全部现有页面能在新壳内打开（内容可以是旧页面），浅/深主题正常
- [ ] 旧路由 301 全量生效（对照上表抽查 20 条）
- [ ] Ctrl+K 命令面板可开合、可过滤、Enter 跳转
- [ ] demo 页五骨架组件齐全且只用令牌间距
- [ ] `grep -r "\.semi-" src/*.css src/**/*.css` 为 0；本批新增代码 0 处 inline style
- [ ] `pnpm build` 通过；Playwright 既有用例更新后全绿
- [ ] 提交：`feat(ui-p0): tokens + AppShell + skeleton components`，PR 描述引用 DESIGN-SPEC §3/§4/§5
