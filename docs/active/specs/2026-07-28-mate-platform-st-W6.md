# W6 子任务卡（ST）：前端 9 apps + 支撑能力

> **源任务卡**：[tasks-W6.md](./2026-07-27-mate-platform-tasks-W6.md)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S5a-S8（2026-07-28 ~ 2026-10-27）
> **里程碑**：M4（前端就绪）
> **ST 总数**：120（拆解自 59 个 TC） — 2026-07-28 完成 120 ST (100%) ✅
> **粒度**：0.5-4 小时 / 单文件 / 单组件 / 单测试

---

## 目录

- [W6-1 P0: portal + dashboard（26 ST）](#w6-1-p0-portal--dashboard26-st)
- [W6-2 P1: ontstudio + kb + mcphub（39 ST）](#w6-2-p1-ontstudio--kb--mcphub39-st)
- [W6-3 P2: apphub + arch + dw + superai（41 ST）](#w6-3-p2-apphub--arch--dw--superai41-st)
- [W6-4 BFF API_MODE 开关（6 ST）](#w6-4-bff-api_mode-开关6-st)
- [W6-5 MSW 浏览器层 Mock（6 ST）](#w6-5-msw-浏览器层-mock6-st)
- [W6-6 Playwright E2E（5 ST）](#w6-6-playwright-e2e5-st)
- [完成度检查表](#完成度检查表)

---
## W6-1 P0: portal + dashboard（30 ST）

> **关键路径**：是 | **优先级**：P0 | **工期**：4 周

### TC-6.1.1 portal 包初始化（2 ST）

#### ST-6.1.1.1 portal apps/portal + Vite + Tailwind

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.1 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/portal/package.json、vite.config.ts、tailwind.config.ts |
| 前置 ST | W1-4 + W6-4 |
| 输出 commit | feat(portal): scaffold (ST-6.1.1.1) |

**改动清单**：
1. pnpm create vite：React 18 + TS
2. Tailwind + PostCSS 配置
3. 加入 workspace

**DoD**：
- [ ] pnpm dev 启动

---

#### ST-6.1.1.2 路由 + login + MSW 接通

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.1 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/portal/src/{router,pages/Login}.tsx |
| 前置 ST | ST-6.1.1.1 |
| 输出 commit | feat(portal): router+msw |

**改动清单**：
1. React Router 路由表
2. /login 页 + MSW worker 启动

**DoD**：
- [ ] 首页 + login 页可访问
- [ ] MSW 接通

---
### TC-6.1.2 portal 状态管理（2 ST）

#### ST-6.1.2.1 useAuthStore (Zustand)

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.2 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/portal/src/store/auth.ts |
| 前置 ST | TC-6.1.1 |
| 输出 commit | feat(portal): auth store |

**改动清单**：
1. Zustand store：token、user、login、logout

**DoD**：
- [ ] 状态结构正确

---

#### ST-6.1.2.2 持久化 + refresh 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.2 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/portal/src/store/auth.ts |
| 前置 ST | ST-6.1.2.1 |
| 输出 commit | feat(portal): auth persist |

**改动清单**：
1. persist middleware
2. 测试：刷新后状态保留

**DoD**：
- [ ] 刷新后状态保留

---
### TC-6.1.3 portal 列表页（3 ST）

#### ST-6.1.3.1 ListPage 通用组件（表格 + 搜索 + 过滤 + 分页）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.3 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/portal/src/components/ListPage.tsx |
| 前置 ST | TC-6.1.2 |
| 输出 commit | feat(portal): ListPage |

**改动清单**：
1. 通用 ListPage：搜索框、过滤侧栏、分页器、Table

**DoD**：
- [ ] 组件可复用

---

#### ST-6.1.3.2 角色 / 用户 / 租户列表 3 页

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.3 |
| 工时 | 6h | 角色 | Frontend |
| 目标文件 | apps/portal/src/pages/{Roles,Users,Tenants}.tsx |
| 前置 ST | ST-6.1.3.1 |
| 输出 commit | feat(portal): 3 lists |

**改动清单**：
1. 3 个 ListPage 实例

**DoD**：
- [ ] 3 列表页走通

---

#### ST-6.1.3.3 列表页单测

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.3 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/portal/tests/lists.test.tsx |
| 前置 ST | ST-6.1.3.2 |
| 输出 commit | test(portal): lists |

**改动清单**：
1. vitest + RTL 测试

**DoD**：
- [ ] 单测全绿

---
### TC-6.1.4 portal 详情页（3 ST）

#### ST-6.1.4.1 DetailDrawer 通用组件 + 表单校验

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.4 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/portal/src/components/DetailDrawer.tsx |
| 前置 ST | TC-6.1.3 |
| 输出 commit | feat(portal): DetailDrawer |

**改动清单**：
1. Drawer 组件 + zod schema 校验

**DoD**：
- [ ] 组件可用

---

#### ST-6.1.4.2 用户 / 角色 创建 + 编辑

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.4 |
| 工时 | 6h | 角色 | Frontend |
| 目标文件 | apps/portal/src/pages/UserDetail.tsx、RoleDetail.tsx |
| 前置 ST | ST-6.1.4.1 |
| 输出 commit | feat(portal): user+role detail |

**改动清单**：
1. 2 个 Drawer 实例

**DoD**：
- [ ] 创建/编辑可用

---

#### ST-6.1.4.3 错误提示 + 表单状态

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.4 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/portal/src/components/DetailDrawer.tsx |
| 前置 ST | ST-6.1.4.2 |
| 输出 commit | feat(portal): error states |

**改动清单**：
1. 错误 toast + loading 状态

**DoD**：
- [ ] 错误态齐

---
### TC-6.1.5 portal 端到端联调（2 ST）

#### ST-6.1.5.1 OpenAPI codegen + API client

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.5 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/portal/src/api/ |
| 前置 ST | TC-6.1.4 |
| 输出 commit | feat(portal): api client |

**改动清单**：
1. `openapi-typescript` 生成 + fetch wrapper

**DoD**：
- [ ] api client 可用

---

#### ST-6.1.5.2 9 成端点对接

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.5 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/portal/src/ |
| 前置 ST | ST-6.1.5.1 |
| 输出 commit | feat(portal): e2e wired |

**改动清单**：
1. 替换 MSW mock → 真实 API

**DoD**：
- [ ] E2E 跑通

---
### TC-6.1.6 portal 打磨（2 ST）

#### ST-6.1.6.1 a11y + i18n

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.6 |
| 工时 | 3h | 角色 | Frontend |
| 目标文件 | apps/portal/src/i18n/、apps/portal/src/a11y/ |
| 前置 ST | TC-6.1.5 |
| 输出 commit | feat(portal): a11y+i18n |

**改动清单**：
1. axe-core a11y 测试
2. react-i18next 中/英

**DoD**：
- [ ] axe 通过
- [ ] 中/英切换

---

#### ST-6.1.6.2 loading / empty / error 三态

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.6 |
| 工时 | 1h | 角色 | Frontend |
| 目标文件 | apps/portal/src/components/states/ |
| 前置 ST | ST-6.1.6.1 |
| 输出 commit | feat(portal): states |

**改动清单**：
1. 通用 Loading / Empty / Error 组件

**DoD**：
- [ ] 三态齐

---
### TC-6.1.7 dashboard 包初始化（2 ST）

#### ST-6.1.7.1 apps/dashboard Vite + Tailwind

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.7 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dashboard/package.json、vite.config.ts |
| 前置 ST | W6-4 |
| 输出 commit | feat(dashboard): scaffold |

**改动清单**：
1. pnpm create vite
2. Tailwind

**DoD**：
- [ ] 启动

---

#### ST-6.1.7.2 路由 + 布局

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.7 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/router.tsx、Layout.tsx |
| 前置 ST | ST-6.1.7.1 |
| 输出 commit | feat(dashboard): router |

**改动清单**：
1. 路由 + 侧栏布局

**DoD**：
- [ ] 路由通

---
### TC-6.1.8 dashboard 状态管理（2 ST）

#### ST-6.1.8.1 时区 + 主题 store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.8 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/store/prefs.ts |
| 前置 ST | TC-6.1.7 |
| 输出 commit | feat(dashboard): prefs store |

**改动清单**：
1. timezone + theme + persist

**DoD**：
- [ ] 持久化

---

#### ST-6.1.8.2 布局选择 store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.8 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/store/layout.ts |
| 前置 ST | ST-6.1.8.1 |
| 输出 commit | feat(dashboard): layout store |

**改动清单**：
1. 卡片位置/可见性 store

**DoD**：
- [ ] 布局持久化

---
### TC-6.1.9 dashboard 统计卡片（2 ST）

#### ST-6.1.9.1 StatCard 通用组件

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.9 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/components/StatCard.tsx |
| 前置 ST | TC-6.1.8、TC-5.8.9 |
| 输出 commit | feat(dashboard): StatCard |

**改动清单**：
1. 数字 + 趋势 + 同比

**DoD**：
- [ ] 组件可用

---

#### ST-6.1.9.2 5 个核心指标卡

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.9 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/pages/Dashboard.tsx |
| 前置 ST | ST-6.1.9.1 |
| 输出 commit | feat(dashboard): 5 stat cards |

**改动清单**：
1. KB 数 / 文档数 / 检索量 / Agent 调用 / LLM Token

**DoD**：
- [ ] 5 卡显示

---
### TC-6.1.10 dashboard 图表（2 ST）

#### ST-6.1.10.1 ECharts 趋势图

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.10 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/components/charts/Trend.tsx |
| 前置 ST | TC-6.1.9 |
| 输出 commit | feat(dashboard): trend chart |

**改动清单**：
1. 折线图 + 时间轴

**DoD**：
- [ ] 趋势图显示

---

#### ST-6.1.10.2 分布图 + 排行榜

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.10 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/components/charts/{Dist,Rank}.tsx |
| 前置 ST | ST-6.1.10.1 |
| 输出 commit | feat(dashboard): dist+rank |

**改动清单**：
1. 饼图 + 排行表

**DoD**：
- [ ] 3 图表齐

---
### TC-6.1.11 dashboard 端到端联调（2 ST）

#### ST-6.1.11.1 tech-obs 数据源接入

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.11 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/api/obs.ts |
| 前置 ST | TC-6.1.10 |
| 输出 commit | feat(dashboard): obs api |

**改动清单**：
1. Prometheus query + Loki query 客户端

**DoD**：
- [ ] 数据源接全

---

#### ST-6.1.11.2 app-kb 数据源接入

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.11 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/api/app-kb.ts |
| 前置 ST | ST-6.1.11.1 |
| 输出 commit | feat(dashboard): app-kb api |

**改动清单**：
1. /stats 端点对接

**DoD**：
- [ ] 端到端通

---
### TC-6.1.12 dashboard 打磨（2 ST）

#### ST-6.1.12.1 可拖拽布局

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.12 |
| 工时 | 3h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/components/Grid.tsx |
| 前置 ST | TC-6.1.11 |
| 输出 commit | feat(dashboard): drag layout |

**改动清单**：
1. react-grid-layout 集成

**DoD**：
- [ ] 可拖拽

---

#### ST-6.1.12.2 暗色主题

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.1.12 |
| 工时 | 1h | 角色 | Frontend |
| 目标文件 | apps/dashboard/src/styles/ |
| 前置 ST | ST-6.1.12.1 |
| 输出 commit | feat(dashboard): dark theme |

**改动清单**：
1. tailwind dark mode

**DoD**：
- [ ] 暗色主题

---## W6-2 P1: ontstudio + kb + mcphub（48 ST）

> **关键路径**：是 | **优先级**：P1 | **工期**：4 周

### TC-6.2.1 ontstudio 初始化（2 ST）

#### ST-6.2.1.1 apps/ontstudio Vite + TS

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.1 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/package.json、vite.config.ts |
| 前置 ST | W6-4 |
| 输出 commit | feat(ontstudio): scaffold |

**改动清单**：
1. pnpm create vite + 加入 workspace

**DoD**：
- [ ] 启动

---

#### ST-6.2.1.2 路由 + 布局 + MSW

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.1 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/router.tsx、Layout.tsx |
| 前置 ST | ST-6.2.1.1 |
| 输出 commit | feat(ontstudio): router+msw |

**改动清单**：
1. 路由表 + 侧栏布局 + MSW

**DoD**：
- [ ] 路由通

---
### TC-6.2.2 ontstudio 状态管理（2 ST）

#### ST-6.2.2.1 ontology + selection store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.2 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/store/ont.ts |
| 前置 ST | TC-6.2.1 |
| 输出 commit | feat(ontstudio): state |

**改动清单**：
1. 当前 ontology + 选中节点 store

**DoD**：
- [ ] store 可用

---

#### ST-6.2.2.2 编辑器状态 + 历史

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.2 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/store/editor.ts |
| 前置 ST | ST-6.2.2.1 |
| 输出 commit | feat(ontstudio): editor state |

**改动清单**：
1. undo/redo 队列

**DoD**：
- [ ] 历史可回滚

---
### TC-6.2.3 ontstudio 本体树形列表（3 ST）

#### ST-6.2.3.1 ClassTree 懒加载

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.3 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/components/ClassTree.tsx |
| 前置 ST | TC-6.2.2、TC-5.4.3 |
| 输出 commit | feat(ontstudio): class tree |

**改动清单**：
1. 树形组件 + 懒加载

**DoD**：
- [ ] 树形显示

---

#### ST-6.2.3.2 右键菜单（CRUD + 跳转）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.3 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/components/ClassTreeContextMenu.tsx |
| 前置 ST | ST-6.2.3.1 |
| 输出 commit | feat(ontstudio): context menu |

**改动清单**：
1. 右键菜单项

**DoD**：
- [ ] 菜单项可点

---

#### ST-6.2.3.3 树形搜索 + 过滤

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.3 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/components/ClassTree.tsx |
| 前置 ST | ST-6.2.3.2 |
| 输出 commit | feat(ontstudio): tree search |

**改动清单**：
1. fuzzy 搜索

**DoD**：
- [ ] 搜索工作

---
### TC-6.2.4 ontstudio 详情/编辑（3 ST）

#### ST-6.2.4.1 属性 tab 编辑

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.4 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/pages/ClassDetail.tsx |
| 前置 ST | TC-6.2.3 |
| 输出 commit | feat(ontstudio): props tab |

**改动清单**：
1. PropertiesTab

**DoD**：
- [ ] 属性可编辑

---

#### ST-6.2.4.2 实例 tab 编辑

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.4 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/pages/ClassDetail.tsx |
| 前置 ST | ST-6.2.4.1 |
| 输出 commit | feat(ontstudio): instances tab |

**改动清单**：
1. InstancesTab

**DoD**：
- [ ] 实例可编辑

---

#### ST-6.2.4.3 关系 tab 编辑

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.4 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/pages/ClassDetail.tsx |
| 前置 ST | ST-6.2.4.2 |
| 输出 commit | feat(ontstudio): relations tab |

**改动清单**：
1. RelationsTab

**DoD**：
- [ ] 3 tab 齐

---
### TC-6.2.5 ontstudio SPARQL 编辑器（2 ST）

#### ST-6.2.5.1 Monaco 集成 + 语法高亮

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.5 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/components/SparqlEditor.tsx |
| 前置 ST | TC-6.2.4、TC-5.4.4 |
| 输出 commit | feat(ontstudio): sparql editor |

**改动清单**：
1. `@monaco-editor/react` + SPARQL 语法

**DoD**：
- [ ] 编辑器工作

---

#### ST-6.2.5.2 结果表 + explain 视图

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.5 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/components/SparqlResult.tsx |
| 前置 ST | ST-6.2.5.1 |
| 输出 commit | feat(ontstudio): sparql result |

**改动清单**：
1. 结果表 + explain 切换

**DoD**：
- [ ] 结果表 + explain 显示

---
### TC-6.2.6 ontstudio 端到端联调 + 打磨（2 ST）

#### ST-6.2.6.1 tech-ont 端到端对接

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.6 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/api/ont.ts |
| 前置 ST | TC-6.2.5 |
| 输出 commit | feat(ontstudio): e2e |

**改动清单**：
1. 替换 mock → real API

**DoD**：
- [ ] 端到端通

---

#### ST-6.2.6.2 ontstudio 打磨（a11y + i18n）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.6 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/ontstudio/src/ |
| 前置 ST | ST-6.2.6.1 |
| 输出 commit | feat(ontstudio): polish |

**改动清单**：
1. axe + i18n + 三态

**DoD**：
- [ ] 打磨齐

---
### TC-6.2.7 kb 初始化（2 ST）

#### ST-6.2.7.1 apps/kb Vite + Tailwind

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.7 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/package.json |
| 前置 ST | W6-4 |
| 输出 commit | feat(kb): scaffold |

**改动清单**：
1. pnpm create vite + workspace

**DoD**：
- [ ] 启动

---

#### ST-6.2.7.2 路由 + 布局

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.7 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/router.tsx、Layout.tsx |
| 前置 ST | ST-6.2.7.1 |
| 输出 commit | feat(kb): router |

**改动清单**：
1. 路由表 + 布局

**DoD**：
- [ ] 路由通

---
### TC-6.2.8 kb 状态管理（2 ST）

#### ST-6.2.8.1 kb + selection store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.8 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/kb/src/store/kb.ts |
| 前置 ST | TC-6.2.7 |
| 输出 commit | feat(kb): state |

**改动清单**：
1. kb + doc selection store

**DoD**：
- [ ] store 可用

---

#### ST-6.2.8.2 上传进度 + 检索 store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.8 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/kb/src/store/upload.ts、search.ts |
| 前置 ST | ST-6.2.8.1 |
| 输出 commit | feat(kb): upload+search state |

**改动清单**：
1. SSE 上传进度 + 检索结果 store

**DoD**：
- [ ] 双 store 可用

---
### TC-6.2.9 kb 知识库列表（2 ST）

#### ST-6.2.9.1 KB 列表页

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.9 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/pages/KBList.tsx |
| 前置 ST | TC-6.2.8、TC-5.8.3 |
| 输出 commit | feat(kb): list |

**改动清单**：
1. 列表页 + 搜索 + 过滤

**DoD**：
- [ ] 列表通

---

#### ST-6.2.9.2 KB 创建 / 删除 Drawer

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.9 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/components/KBDetail.tsx |
| 前置 ST | ST-6.2.9.1 |
| 输出 commit | feat(kb): kb drawer |

**改动清单**：
1. Drawer 表单

**DoD**：
- [ ] CRUD 通

---
### TC-6.2.10 kb 文档上传 + 状态（2 ST）

#### ST-6.2.10.1 拖拽上传 + 分块

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.10 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/components/Upload.tsx |
| 前置 ST | TC-6.2.9、TC-5.8.4 |
| 输出 commit | feat(kb): upload |

**改动清单**：
1. react-dropzone + 分块

**DoD**：
- [ ] 拖拽上传工作

---

#### ST-6.2.10.2 SSE 进度实时显示

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.10 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/components/UploadProgress.tsx |
| 前置 ST | ST-6.2.10.1 |
| 输出 commit | feat(kb): upload sse |

**改动清单**：
1. EventSource 订阅 + 进度条

**DoD**：
- [ ] 实时进度

---
### TC-6.2.11 kb 检索界面（3 ST）

#### ST-6.2.11.1 Query 输入 + 检索结果

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.11 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/pages/Search.tsx |
| 前置 ST | TC-6.2.10、TC-5.6.6 |
| 输出 commit | feat(kb): search ui |

**改动清单**：
1. Query 输入 + 结果列表

**DoD**：
- [ ] 搜索工作

---

#### ST-6.2.11.2 引用高亮

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.11 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/components/SearchResult.tsx |
| 前置 ST | ST-6.2.11.1 |
| 输出 commit | feat(kb): highlight |

**改动清单**：
1. 关键词高亮组件

**DoD**：
- [ ] 高亮工作

---

#### ST-6.2.11.3 过滤器（kb / 来源 / 时间）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.11 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/kb/src/components/SearchFilters.tsx |
| 前置 ST | ST-6.2.11.2 |
| 输出 commit | feat(kb): search filters |

**改动清单**：
1. 过滤侧栏

**DoD**：
- [ ] 过滤工作

---
### TC-6.2.12 kb 端到端 + 打磨（2 ST）

#### ST-6.2.12.1 app-kb 端到端对接

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.12 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/api/app-kb.ts |
| 前置 ST | TC-6.2.11 |
| 输出 commit | feat(kb): e2e |

**改动清单**：
1. mock → real

**DoD**：
- [ ] 端到端通

---

#### ST-6.2.12.2 kb 打磨

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.12 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/kb/src/ |
| 前置 ST | ST-6.2.12.1 |
| 输出 commit | feat(kb): polish |

**改动清单**：
1. axe + i18n + 三态

**DoD**：
- [ ] 打磨齐

---
### TC-6.2.13 mcphub 初始化（2 ST）

#### ST-6.2.13.1 apps/mcphub Vite + Tailwind

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.13 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/package.json |
| 前置 ST | W6-4 |
| 输出 commit | feat(mcphub): scaffold |

**改动清单**：
1. pnpm create vite + workspace

**DoD**：
- [ ] 启动

---

#### ST-6.2.13.2 路由 + 布局

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.13 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/router.tsx、Layout.tsx |
| 前置 ST | ST-6.2.13.1 |
| 输出 commit | feat(mcphub): router |

**改动清单**：
1. 路由表 + 布局

**DoD**：
- [ ] 路由通

---
### TC-6.2.14 mcphub 状态（2 ST）

#### ST-6.2.14.1 tools + resources store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.14 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/store/mcp.ts |
| 前置 ST | TC-6.2.13 |
| 输出 commit | feat(mcphub): state |

**改动清单**：
1. tools + resources cache store

**DoD**：
- [ ] store 可用

---

#### ST-6.2.14.2 调用历史 store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.14 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/store/history.ts |
| 前置 ST | ST-6.2.14.1 |
| 输出 commit | feat(mcphub): history state |

**改动清单**：
1. 调用历史 store

**DoD**：
- [ ] history 可用

---
### TC-6.2.15 mcphub 工具列表 + 详情（2 ST）

#### ST-6.2.15.1 ToolList 页

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.15 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/pages/ToolList.tsx |
| 前置 ST | TC-6.2.14、TC-5.3.8 |
| 输出 commit | feat(mcphub): tool list |

**改动清单**：
1. 工具卡片网格

**DoD**：
- [ ] 列表通

---

#### ST-6.2.15.2 ToolDetail Drawer + JSON Schema 表单

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.15 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/components/ToolDetail.tsx |
| 前置 ST | ST-6.2.15.1 |
| 输出 commit | feat(mcphub): tool detail |

**改动清单**：
1. JSON Schema 自动生成表单

**DoD**：
- [ ] 表单可用

---
### TC-6.2.16 mcphub 调用试运行（2 ST）

#### ST-6.2.16.1 调工具 + 结果展示

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.16 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/components/TryItPanel.tsx |
| 前置 ST | TC-6.2.15 |
| 输出 commit | feat(mcphub): try it |

**改动清单**：
1. 调工具 + 结果渲染

**DoD**：
- [ ] 试运行通

---

#### ST-6.2.16.2 错误处理 + loading 状态

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.16 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/components/TryItPanel.tsx |
| 前置 ST | ST-6.2.16.1 |
| 输出 commit | feat(mcphub): try it states |

**改动清单**：
1. 错误 toast + loading

**DoD**：
- [ ] 错误态齐

---
### TC-6.2.17 mcphub 资源浏览（2 ST）

#### ST-6.2.17.1 ResourceList 页

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.17 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/pages/ResourceList.tsx |
| 前置 ST | TC-6.2.16 |
| 输出 commit | feat(mcphub): resources |

**改动清单**：
1. URI 列表 + 过滤

**DoD**：
- [ ] 列表通

---

#### ST-6.2.17.2 ResourceViewer + 内容渲染

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.17 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/components/ResourceViewer.tsx |
| 前置 ST | ST-6.2.17.1 |
| 输出 commit | feat(mcphub): resource viewer |

**改动清单**：
1. JSON / text / image 渲染

**DoD**：
- [ ] 资源查看器工作

---
### TC-6.2.18 mcphub 端到端 + 打磨（2 ST）

#### ST-6.2.18.1 tech-mcp 端到端对接

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.18 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/api/mcp.ts |
| 前置 ST | TC-6.2.17 |
| 输出 commit | feat(mcphub): e2e |

**改动清单**：
1. mock → real

**DoD**：
- [ ] 端到端通

---

#### ST-6.2.18.2 mcphub 打磨

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.2.18 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/mcphub/src/ |
| 前置 ST | ST-6.2.18.1 |
| 输出 commit | feat(mcphub): polish |

**改动清单**：
1. axe + i18n + 三态

**DoD**：
- [ ] 打磨齐

---
## W6-3 P2: apphub + arch + dw + superai（50 ST）

> **关键路径**：否 | **优先级**：P2 | **工期**：3 周

### TC-6.3.1 apphub 初始化（2 ST）

#### ST-6.3.1.1 apps/apphub Vite + Tailwind

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.1 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/apphub/package.json |
| 前置 ST | W6-4 |
| 输出 commit | feat(apphub): scaffold |

**改动清单**：
1. pnpm create vite + workspace

**DoD**：
- [ ] 启动

---

#### ST-6.3.1.2 路由 + 商店风格布局

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.1 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/router.tsx、Layout.tsx |
| 前置 ST | ST-6.3.1.1 |
| 输出 commit | feat(apphub): router |

**改动清单**：
1. 路由 + 顶栏 + 卡片布局

**DoD**：
- [ ] 路由通

---
### TC-6.3.2 apphub 状态（2 ST）

#### ST-6.3.2.1 apps + categories store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.2 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/store/catalog.ts |
| 前置 ST | TC-6.3.1 |
| 输出 commit | feat(apphub): state |

**改动清单**：
1. apps + categories store

**DoD**：
- [ ] store 可用

---

#### ST-6.3.2.2 installed + filters store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.2 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/store/installed.ts |
| 前置 ST | ST-6.3.2.1 |
| 输出 commit | feat(apphub): installed state |

**改动清单**：
1. 已安装列表 + filter store

**DoD**：
- [ ] installed 可用

---
### TC-6.3.3 apphub 应用列表（2 ST）

#### ST-6.3.3.1 AppCard 通用组件 + 网格

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.3 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/components/AppCard.tsx |
| 前置 ST | TC-6.3.2 |
| 输出 commit | feat(apphub): app card |

**改动清单**：
1. 卡片组件 + 网格布局

**DoD**：
- [ ] 卡片显示

---

#### ST-6.3.3.2 分类 + 搜索 + 评分

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.3 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/pages/Catalog.tsx |
| 前置 ST | ST-6.3.3.1 |
| 输出 commit | feat(apphub): catalog list |

**改动清单**：
1. 分类侧栏 + 搜索 + 评分过滤

**DoD**：
- [ ] 列表 + 过滤齐

---
### TC-6.3.4 apphub 安装/卸载（2 ST）

#### ST-6.3.4.1 安装进度 + 错误回滚

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.4 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/components/InstallButton.tsx |
| 前置 ST | TC-6.3.3 |
| 输出 commit | feat(apphub): install |

**改动清单**：
1. 安装按钮 + 进度 + 错误回滚 UI

**DoD**：
- [ ] 安装流工作

---

#### ST-6.3.4.2 卸载确认 + 清理

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.4 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/components/UninstallButton.tsx |
| 前置 ST | ST-6.3.4.1 |
| 输出 commit | feat(apphub): uninstall |

**改动清单**：
1. 确认对话框 + 卸载调用

**DoD**：
- [ ] 卸载通

---
### TC-6.3.5 apphub 端到端 + 打磨（2 ST）

#### ST-6.3.5.1 app-arch 端到端对接

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.5 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/api/ |
| 前置 ST | TC-6.3.4 |
| 输出 commit | feat(apphub): e2e |

**改动清单**：
1. mock → real

**DoD**：
- [ ] 端到端通

---

#### ST-6.3.5.2 apphub 打磨

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.5 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/apphub/src/ |
| 前置 ST | ST-6.3.5.1 |
| 输出 commit | feat(apphub): polish |

**改动清单**：
1. axe + i18n + 三态

**DoD**：
- [ ] 打磨齐

---
### TC-6.3.6 arch 初始化（2 ST）

#### ST-6.3.6.1 apps/arch Vite + Tailwind

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.6 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/arch/package.json |
| 前置 ST | W6-4 |
| 输出 commit | feat(arch): scaffold |

**改动清单**：
1. pnpm create vite + workspace

**DoD**：
- [ ] 启动

---

#### ST-6.3.6.2 路由 + React Flow 引入

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.6 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/arch/src/router.tsx、Canvas.tsx |
| 前置 ST | ST-6.3.6.1 |
| 输出 commit | feat(arch): router+flow |

**改动清单**：
1. 路由 + React Flow 引入

**DoD**：
- [ ] React Flow 工作

---
### TC-6.3.7 arch 状态（2 ST）

#### ST-6.3.7.1 diagram store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.7 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/arch/src/store/diagram.ts |
| 前置 ST | TC-6.3.6 |
| 输出 commit | feat(arch): state |

**改动清单**：
1. 节点 + 边 store

**DoD**：
- [ ] store 可用

---

#### ST-6.3.7.2 selection + history store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.7 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/arch/src/store/selection.ts |
| 前置 ST | ST-6.3.7.1 |
| 输出 commit | feat(arch): selection state |

**改动清单**：
1. 选中 + undo/redo

**DoD**：
- [ ] history 可用

---
### TC-6.3.8 arch 画布（2 ST）

#### ST-6.3.8.1 拖拽节点 + 连线

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.8 |
| 工时 | 8h | 角色 | Frontend |
| 目标文件 | apps/arch/src/components/Canvas.tsx |
| 前置 ST | TC-6.3.7 |
| 输出 commit | feat(arch): canvas |

**改动清单**：
1. 拖拽节点 + 连线交互

**DoD**：
- [ ] 画布交互工作

---

#### ST-6.3.8.2 保存到后端 + 自动保存

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.8 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/arch/src/components/Canvas.tsx |
| 前置 ST | ST-6.3.8.1 |
| 输出 commit | feat(arch): autosave |

**改动清单**：
1. 自动保存 + 手动保存

**DoD**：
- [ ] 保存工作

---
### TC-6.3.9 arch 模板库（2 ST）

#### ST-6.3.9.1 TemplateGallery 页

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.9 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/arch/src/pages/Templates.tsx |
| 前置 ST | TC-6.3.8 |
| 输出 commit | feat(arch): templates |

**改动清单**：
1. 模板列表 + 预览

**DoD**：
- [ ] 模板库显示

---

#### ST-6.3.9.2 模板应用 + 自定义保存

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.9 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/arch/src/components/TemplateApply.tsx |
| 前置 ST | ST-6.3.9.1 |
| 输出 commit | feat(arch): template apply |

**改动清单**：
1. 模板应用到画布

**DoD**：
- [ ] 应用模板工作

---
### TC-6.3.10 arch 端到端 + 打磨（2 ST）

#### ST-6.3.10.1 arch 后端对接 + 打磨

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.10 |
| 工时 | 8h | 角色 | Frontend |
| 目标文件 | apps/arch/src/ |
| 前置 ST | TC-6.3.9 |
| 输出 commit | feat(arch): e2e+polish |

**改动清单**：
1. mock → real + axe + i18n + 三态

**DoD**：
- [ ] 端到端通 + 打磨齐

---
### TC-6.3.11 dw 初始化（2 ST）

#### ST-6.3.11.1 apps/dw Vite + Tailwind

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.11 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dw/package.json |
| 前置 ST | W6-4 |
| 输出 commit | feat(dw): scaffold |

**改动清单**：
1. pnpm create vite + workspace

**DoD**：
- [ ] 启动

---

#### ST-6.3.11.2 路由 + React Flow 引入

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.11 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dw/src/router.tsx、Canvas.tsx |
| 前置 ST | ST-6.3.11.1 |
| 输出 commit | feat(dw): router+flow |

**改动清单**：
1. 路由 + React Flow

**DoD**：
- [ ] React Flow 工作

---
### TC-6.3.12 dw 状态（2 ST）

#### ST-6.3.12.1 workflow + selection store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.12 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/dw/src/store/workflow.ts |
| 前置 ST | TC-6.3.11 |
| 输出 commit | feat(dw): state |

**改动清单**：
1. workflow store

**DoD**：
- [ ] store 可用

---

#### ST-6.3.12.2 run state store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.12 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/dw/src/store/run.ts |
| 前置 ST | ST-6.3.12.1 |
| 输出 commit | feat(dw): run state |

**改动清单**：
1. workflow run state store

**DoD**：
- [ ] run 可用

---
### TC-6.3.13 dw 画布（节点 + 连线）（2 ST）

#### ST-6.3.13.1 拖拽节点 + 连线

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.13 |
| 工时 | 8h | 角色 | Frontend |
| 目标文件 | apps/dw/src/components/Canvas.tsx |
| 前置 ST | TC-6.3.12 |
| 输出 commit | feat(dw): canvas |

**改动清单**：
1. 节点 + 连线交互

**DoD**：
- [ ] 画布交互

---

#### ST-6.3.13.2 配置面板 + 运行触发

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.13 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/dw/src/components/NodeConfig.tsx |
| 前置 ST | ST-6.3.13.1 |
| 输出 commit | feat(dw): node config |

**改动清单**：
1. 节点配置面板 + 运行按钮

**DoD**：
- [ ] 配置 + 运行工作

---
### TC-6.3.14 dw 节点库（2 ST）

#### ST-6.3.14.1 10 个内置节点定义

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.14 |
| 工时 | 6h | 角色 | Frontend |
| 目标文件 | apps/dw/src/nodes/ |
| 前置 ST | TC-6.3.13 |
| 输出 commit | feat(dw): nodes |

**改动清单**：
1. DB / HTTP / LLM / Agent / Branch 等 10 节点

**DoD**：
- [ ] 10 节点定义齐

---

#### ST-6.3.14.2 节点拖入 + 配置项 schema

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.14 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/dw/src/components/NodeLibrary.tsx |
| 前置 ST | ST-6.3.14.1 |
| 输出 commit | feat(dw): node library |

**改动清单**：
1. 节点库侧栏 + 拖入画布

**DoD**：
- [ ] 节点拖入工作

---
### TC-6.3.15 dw 端到端 + 打磨（2 ST）

#### ST-6.3.15.1 dw 后端对接 + 打磨

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.15 |
| 工时 | 8h | 角色 | Frontend |
| 目标文件 | apps/dw/src/ |
| 前置 ST | TC-6.3.14 |
| 输出 commit | feat(dw): e2e+polish |

**改动清单**：
1. mock → real + axe + i18n + 三态

**DoD**：
- [ ] 端到端 + 打磨齐

---
### TC-6.3.16 superai 初始化（2 ST）

#### ST-6.3.16.1 apps/superai Vite + Tailwind

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.16 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/superai/package.json |
| 前置 ST | W6-4 |
| 输出 commit | feat(superai): scaffold |

**改动清单**：
1. pnpm create vite + workspace

**DoD**：
- [ ] 启动

---

#### ST-6.3.16.2 路由 + 聊天布局

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.16 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/superai/src/router.tsx、ChatLayout.tsx |
| 前置 ST | ST-6.3.16.1 |
| 输出 commit | feat(superai): router |

**改动清单**：
1. 路由 + 会话侧栏布局

**DoD**：
- [ ] 路由通

---
### TC-6.3.17 superai 状态（2 ST）

#### ST-6.3.17.1 sessions + messages store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.17 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/superai/src/store/chat.ts |
| 前置 ST | TC-6.3.16 |
| 输出 commit | feat(superai): chat state |

**改动清单**：
1. 会话 + 消息 store

**DoD**：
- [ ] store 可用

---

#### ST-6.3.17.2 streaming + tool_calls store

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.17 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/superai/src/store/stream.ts |
| 前置 ST | ST-6.3.17.1 |
| 输出 commit | feat(superai): stream state |

**改动清单**：
1. 流式 + 工具调用 store

**DoD**：
- [ ] stream 可用

---
### TC-6.3.18 superai 对话界面（3 ST）

#### ST-6.3.18.1 MessageList + 流式渲染

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.18 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/superai/src/components/MessageList.tsx |
| 前置 ST | TC-6.3.17、TC-5.7.9 |
| 输出 commit | feat(superai): message list |

**改动清单**：
1. 消息列表 + 流式增量渲染

**DoD**：
- [ ] 流式渲染工作

---

#### ST-6.3.18.2 工具调用可视化

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.18 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/superai/src/components/ToolCallCard.tsx |
| 前置 ST | ST-6.3.18.1 |
| 输出 commit | feat(superai): tool viz |

**改动清单**：
1. ToolCallCard 组件 + 折叠展开

**DoD**：
- [ ] 工具调用可视化

---

#### ST-6.3.18.3 输入框 + 引用附件

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.18 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/superai/src/components/Composer.tsx |
| 前置 ST | ST-6.3.18.2 |
| 输出 commit | feat(superai): composer |

**改动清单**：
1. Composer 组件 + 引用附件

**DoD**：
- [ ] Composer 工作

---
### TC-6.3.19 superai 历史 / 收藏（2 ST）

#### ST-6.3.19.1 SessionList + 历史记录

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.19 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/superai/src/components/SessionList.tsx |
| 前置 ST | TC-6.3.18 |
| 输出 commit | feat(superai): session list |

**改动清单**：
1. 会话列表 + 搜索

**DoD**：
- [ ] 历史可用

---

#### ST-6.3.19.2 收藏夹 + 标签

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.19 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/superai/src/components/StarredList.tsx |
| 前置 ST | ST-6.3.19.1 |
| 输出 commit | feat(superai): starred |

**改动清单**：
1. 收藏列表 + 标签

**DoD**：
- [ ] 收藏工作

---
### TC-6.3.20 superai 端到端 + 打磨（2 ST）

#### ST-6.3.20.1 tech-agent 端到端 + 打磨

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.3.20 |
| 工时 | 8h | 角色 | Frontend |
| 目标文件 | apps/superai/src/ |
| 前置 ST | TC-6.3.19 |
| 输出 commit | feat(superai): e2e+polish |

**改动清单**：
1. mock → real + axe + i18n + 三态

**DoD**：
- [ ] 端到端 + 打磨齐

---
## W6-4 BFF API_MODE 开关（6 ST）

> **关键路径**：是 | **优先级**：P0 | **工期**：2d

### TC-6.4.1 BFF 项目初始化（2 ST）

#### ST-6.4.1.1 apps/bff Node + Fastify + TS

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.4.1 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/bff/package.json、tsconfig.json、src/server.ts |
| 前置 ST | TC-1.1.7 |
| 输出 commit | feat(bff): scaffold |

**改动清单**：
1. pnpm create + Fastify + TS
2. 加入 workspace

**DoD**：
- [ ] pnpm dev 启动

---

#### ST-6.4.1.2 透传一个 mock 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.4.1 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/bff/src/routes/health.ts |
| 前置 ST | ST-6.4.1.1 |
| 输出 commit | feat(bff): mock endpoint |

**改动清单**：
1. /health 端点返回 mock

**DoD**：
- [ ] 端点通

---
### TC-6.4.2 API_MODE 路由分发（2 ST）

#### ST-6.4.2.1 mock / live / hybrid router

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.4.2 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/bff/src/router.ts |
| 前置 ST | TC-6.4.1 |
| 输出 commit | feat(bff): api_mode router |

**改动清单**：
1. 根据 env 路由

**DoD**：
- [ ] 3 模式切换

---

#### ST-6.4.2.2 路由配置 + 端到端测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.4.2 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/bff/tests/router.test.ts |
| 前置 ST | ST-6.4.2.1 |
| 输出 commit | test(bff): router |

**改动清单**：
1. 三模式 e2e

**DoD**：
- [ ] 不影响前端代码

---
### TC-6.4.3 BFF 文档 + 部署（2 ST）

#### ST-6.4.3.1 docs/runbooks/bff.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.4.3 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | docs/runbooks/bff.md |
| 前置 ST | TC-6.4.2 |
| 输出 commit | docs(bff): usage |

**改动清单**：
1. runbook + env 说明

**DoD**：
- [ ] 文档齐

---

#### ST-6.4.3.2 BFF Dockerfile + docker-compose

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.4.3 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/bff/Dockerfile、docker-compose.yml |
| 前置 ST | ST-6.4.3.1 |
| 输出 commit | dev(bff): deploy |

**改动清单**：
1. Dockerfile + compose service

**DoD**：
- [ ] Docker 镜像构建

---
## W6-5 MSW 浏览器层 Mock（6 ST）

> **优先级**：P0 | **工期**：3d

### TC-6.5.1 MSW 基础（2 ST）

#### ST-6.5.1.1 MSW worker + handlers/

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.5.1 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/portal/src/mocks/handlers/、apps/portal/src/mocks/browser.ts |
| 前置 ST | TC-6.4.1 |
| 输出 commit | feat(msw): setup |

**改动清单**：
1. handlers/ 目录 + worker 启动

**DoD**：
- [ ] handlers 可加载

---

#### ST-6.5.1.2 MSW 启动 + 测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.5.1 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/portal/src/main.tsx |
| 前置 ST | ST-6.5.1.1 |
| 输出 commit | feat(msw): bootstrap |

**改动清单**：
1. main.tsx 加 worker.start()

**DoD**：
- [ ] 启动工作

---
### TC-6.5.2 OpenAPI → MSW 自动生成（2 ST）

#### ST-6.5.2.1 openapi-typescript codegen

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.5.2 |
| 工时 | 4h | 角色 | Frontend |
| 目标文件 | apps/portal/scripts/gen-mocks.ts |
| 前置 ST | TC-1.6.1、TC-6.5.1 |
| 输出 commit | feat(msw): codegen |

**改动清单**：
1. codegen 脚本

**DoD**：
- [ ] handlers 自动生成

---

#### ST-6.5.2.2 codegen CI 集成

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.5.2 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | .github/workflows/frontend.yml |
| 前置 ST | ST-6.5.2.1 |
| 输出 commit | ci(msw): codegen |

**改动清单**：
1. CI 加 codegen 步骤

**DoD**：
- [ ] 改 OpenAPI 后 PR 自动更新

---
### TC-6.5.3 Storybook 集成（2 ST）

#### ST-6.5.3.1 apps/portal Storybook 配置

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.5.3 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/portal/.storybook/ |
| 前置 ST | TC-6.5.2 |
| 输出 commit | feat(msw): storybook |

**改动清单**：
1. Storybook + MSW 集成

**DoD**：
- [ ] storybook 启动

---

#### ST-6.5.3.2 通用组件 story + mock

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.5.3 |
| 工时 | 2h | 角色 | Frontend |
| 目标文件 | apps/portal/src/components/*.stories.tsx |
| 前置 ST | ST-6.5.3.1 |
| 输出 commit | feat(msw): stories |

**改动清单**：
1. ListPage / DetailDrawer 等组件 story

**DoD**：
- [ ] 每个组件有 story + mock

---
## W6-6 Playwright E2E（5 ST）

> **优先级**：P0 | **工期**：2 周

### TC-6.6.1 Playwright 基础（2 ST）

#### ST-6.6.1.1 Playwright config + demo 测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.6.1 |
| 工时 | 2h | 角色 | QA |
| 目标文件 | playwright.config.ts、tests/e2e/demo.spec.ts |
| 前置 ST | TC-6.4.3 |
| 输出 commit | test(e2e): setup |

**改动清单**：
1. Playwright 配置 + demo spec

**DoD**：
- [ ] pnpm test:e2e 跑通 demo

---

#### ST-6.6.1.2 CI e2e job

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.6.1 |
| 工时 | 2h | 角色 | QA |
| 目标文件 | .github/workflows/frontend.yml |
| 前置 ST | ST-6.6.1.1 |
| 输出 commit | ci(e2e): job |

**改动清单**：
1. CI 加 e2e job

**DoD**：
- [ ] CI e2e job 绿

---
### TC-6.6.2 每 app 关键路径 E2E（2 ST）

#### ST-6.6.2.1 9 apps × 5 关键路径 spec

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.6.2 |
| 工时 | 8h | 角色 | QA |
| 目标文件 | tests/e2e/{portal,dashboard,ontstudio,kb,mcphub,apphub,arch,dw,superai}/*.spec.ts |
| 前置 ST | TC-6.6.1 |
| 输出 commit | test(e2e): all apps |

**改动清单**：
1. 9 apps × 5 spec = 45 spec

**DoD**：
- [ ] 45 spec 全绿

---

#### ST-6.6.2.2 CI e2e 优化 + 并行

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.6.2 |
| 工时 | 4h | 角色 | QA |
| 目标文件 | playwright.config.ts、.github/workflows/frontend.yml |
| 前置 ST | ST-6.6.2.1 |
| 输出 commit | ci(e2e): parallel |

**改动清单**：
1. sharded + parallel workers

**DoD**：
- [ ] CI 中 e2e job 绿 + < 15min

---
### TC-6.6.3 视觉回归（1 ST）

#### ST-6.6.3.1 P0 apps 视觉回归 snapshot

| 字段 | 值 |
|---|---|
| 所属 TC | TC-6.6.3 |
| 工时 | 4h | 角色 | QA |
| 目标文件 | tests/e2e/visual/*.spec.ts |
| 前置 ST | TC-6.6.2 |
| 输出 commit | test(e2e): visual |

**改动清单**：
1. Playwright screenshot + diff
2. baseline 截图归档

**DoD**：
- [ ] 误报率 < 5%

---

## W6 完成度检查表

| W6-n | 路线图 ID | 关键路径 | TC 数 | ST 数 | ST 总工时 | 状态 |
|---|---|---|---|---|---|---|
| W6-1 | §4 W6-1 | 是 | 12 | 26 | ~70h | 🔴 未启动 |
| W6-2 | §4 W6-2 | 是 | 18 | 39 | ~108h | 🔴 未启动 |
| W6-3 | §4 W6-3 | 否 | 20 | 41 | ~110h | 🔴 未启动 |
| W6-4 | §4 W6-4 | 是 | 3 | 6 | ~16h | 🔴 未启动 |
| W6-5 | §4 W6-5 | — | 3 | 6 | ~16h | 🔴 未启动 |
| W6-6 | §4 W6-6 | — | 3 | 5 | ~30h | 🔴 未启动 |
| **合计** | — | — | **59** | **120** | **~346h** | **🔴 未启动** |

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W6 TC（59 条）拆出 ST（120 条） | 单回合执行避免 Token 超限 |
