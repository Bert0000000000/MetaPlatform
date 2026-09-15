# UI-P1 启动提示词：核心域替换（A–E 五域，任选其一开工）

> 用法：新 AI 会话开场**整段粘贴本文件 + 你负责的域的章节**。五个域无相互依赖，可并行（各自 worktree/分支）。
> 前置：UI-P0 已合入（AppShell/令牌/五骨架组件可用）。

---

## 通用部分（所有域先读）

你是 Mate Platform 前端工程师，执行 UI-P1 核心域替换。把指定域的页面按设计规范重写为新的骨架与令牌。

**必读**：
1. `docs/active/specs/2026-09-14-ui-redesign/DESIGN-SPEC.md`（§4 令牌 / §5 六骨架 / §6 交互范式 / 控件预算纪律）
2. `docs/active/specs/2026-09-14-ui-redesign/index.html` 原型中**你负责域的屏幕**（视觉与交互的唯一真源）
3. P0 产出：`src/components/shell/`、`src/components/skeleton/`、`src/styles/tokens.css`

**硬性纪律（每个域相同）**：
- **一切按 Semi 官方方式**：主题 = DSM 主题包（P0 已建，不碰）；布局 = `Layout`，导航 = `Nav`/`Tabs`，详情 = `SideSheet`，属性 = `Descriptions`，时间线 = `Timeline`，步骤 = `Steps`，空态 = `Empty+Illustration`，提示 = `Toast`/`Banner`——**Semi 有对应组件就禁止自绘**；官方没有的（⌘K 面板、力导向图谱）才允许组合/自建。写 props 前先用 `semi-ui-skills` skill / Semi MCP 核对，不凭记忆
- 只用官方组件 + 令牌；**禁止**新增 `.semi-*` 覆盖与页面级 `<style>`
- 该域 inline `style={{}}` 清零（间距只用 10 档令牌；一次性布局数值用 `var(--mp-*)`）
- 该域旧 `v-*` 类全部退役
- 页面骨架必须归入六枚举之一；单工作区横向切换控件 ≤2 种
- 业务逻辑/API 调用保持原有 `src/api/*` 不动，只换呈现层
- 旧路由保留 301（P0 已建），新增域内路由只注册在自己的 `src/routes/<domain>.tsx`

**验证**：9250 dev server + admin/admin123（fetch→JWT，Semi Button onClick 在 HMR 下是 noop，勿用它写验证脚本）；Playwright 浅/深双主题截图；`pnpm build`。

**提交**：`feat(ui-p1<小写域字母>): <域> adopts Calm Density`。

---

## §A 本体域（最复杂，建议最强会话）

范围（4 个页内 tab，路由 `/ontology/*`）：
1. **对象浏览器** `/ontology/explorer`：B 骨架 = 左类型树（Semi Tree，240px，可折叠+拖宽）+ **满宽** DataTablePro（列头排序/冻结/列宽）；**详情不用常驻栏**——点击行弹 `SheetDetail`（属性/关系/时间线 tabs + 底部「新标签页打开/编辑」）。对齐原型「对象浏览器」屏与 Foundry Selection Preview 范式。
2. **数据中心** `/ontology/datacenter`：F 骨架，三视图（知识图谱/数据血缘/资产清单）。**图谱组件自建**：直接移植原型 `index.html` 中的力导向引擎（斥力 3400/弹簧 118/向心/阻尼/拖拽钉住/邻接高亮/类型过滤/标签开关），封装为 `src/components/graph/ForceGraph.tsx`（React 化：props 传 nodes/edges/onSelect）。血缘=分层 DAG（原型 buildLineage 可移植）。资产清单=DataTablePro。
3. **类型建模** `/ontology/model`：主 tab + segmented 子 tab（对象/关系/动作/函数/接口/公理）+ 类型清单表（rid/实例数/属性数/主键/发布状态）。
4. **运维** `/ontology/ops`：接入通道表 + 版本 + 审计三个子 tab。

对接现有 `src/api/ont/*`。图谱节点数据来自对象类型与关系（示例数据可 mock，标注 TODO 接 ObjectSet 查询）。

## §B 工作台

`/home`：A 骨架 bento——KPI 四卡（对象总数/员工在线/今日任务/Token，带 sparkline）、今日动态 feed、最近访问、待办审批（HITL 通过/驳回 → Toast + 调用现有审批 API）、数字员工状态列表。数据接 `src/api/dashboard/*`。页内 tab：概览/待办/任务/消息/交付物/我的。

## §C 数字员工

`/agents`：C 骨架卡片网格（头像/角色/能力 tags/三列统计/操作），虚线「招聘新员工」卡；域内 tab 吸收 `/dw/*` 九页（员工/外部 A2A/任务中心/协作/评估/文档处理）。员工详情走 SheetDetail。

## §D SuperAI

`/superai`：D 骨架执行计划详情（状态四卡 + 垂直步骤时间线 + 子任务进度 + 右列参与员工/HITL 记录/成本）；**全局 CopilotDock 接线**（P0 的壳）：上下文条读取当前路由、计划卡片（步骤+费用+需确认标记）→ 确认调用现有 `/superai/schedule` API（注意请求体 **snake_case**：`intent_id`/`plan_id`，否则 422）。域内 tab：会话/执行计划/调度/成本/模板。

## §E 平台管理

`/admin`：E 骨架表格页范式统一（用户与权限/角色/AI Provider/配置/审计/运营/分析），全部 DataTablePro + SheetDetail 表单（新建/编辑用户抽屉：用户名/邮箱/角色/MFA 开关/跨租户开关）。数据接 `src/api/admin/*`。demo 页迁移到 `/admin/demo` 保留。
