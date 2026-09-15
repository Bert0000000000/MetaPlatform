# Mate Platform UI 优化工作计划（Calm Density 落地）

> **依据**：[DESIGN-SPEC.md](./DESIGN-SPEC.md) v1.3 · 原型 [index.html](./index.html)
> **性质**：纯前端改造，后端 API 不动
> **制定**：2026-09-14

## 1. 目标

将现有 mate-web（Semi 2.101.1，274 文件）按 Calm Density 设计规范整体重构为「**一级导航 + 页内 tab**」架构，统一设计令牌，消灭散装样式。

## 2. 现状基线（2026-09-14 审计）

| 指标 | 现值 | 目标 |
|------|------|------|
| inline `style={{}}` | **4,526 处** | < 100（仅布局微调） |
| `v-*` 自建类 | 261 处（v-badge 189 等） | 0（退役） |
| `.semi-*` CSS 覆盖 | 0 | 0（保持，禁止新增） |
| 私有 CSS 变量（--muted/--accent/#hex 直写） | 与 Semi token 两套并行 | 单一令牌体系（Semi CSS 变量 + tokens.css） |
| 顶级路由域 | 11 个（约 100+ 路由） | 8 个域 + 页内 tab |
| 页面骨架 | 无约束 | 6 种枚举骨架（规范 §5） |

## 3. 批次分解与依赖

```
UI-P0 令牌+AppShell+骨架组件（串行，先决条件）
  ├─→ UI-P1a 本体域（对象浏览器/数据中心/建模/运维）   ┐
  ├─→ UI-P1b 工作台（bento 首页）                      │ P1 各域可并行
  ├─→ UI-P1c 数字员工（agents+dw 合并）                 │ （独立 worktree/分支）
  ├─→ UI-P1d SuperAI（执行计划+全局 Copilot dock）       │
  ├─→ UI-P1e 平台管理（表格页范式）                     ┘
  └──────────────────────┴─→ UI-P2a 应用中心
                             ├─→ UI-P2b 知识与集成
                             ├─→ UI-P2c 数据与治理（arch 20 页收编）
                             └─→ UI-P2d 清理退役（v-*/inline/旧路由/死代码）
                                      └─→ UI-P3 验收收口（视觉基线+证据）
```

| 批次 | 内容 | 工作量 | 状态 | commit | 提示词 |
|------|------|--------|------|--------|--------|
| **UI-P0** | **DSM 主题包（Semi 官方 SCSS 定制）** + tokens.css（平台布局令牌）+ AppShell v2（Layout/Nav/Tabs 官方组件）+ 新 IA 路由与 301 + 五骨架共享组件（PageHeader/FilterBar/DataTablePro/EmptyState/SheetDetail）+ demo 页 | 2–3 天 | ✅ | `6b0d0448` | [ai-launch-prompt-ui-p0.md](./ai-launch-prompt-ui-p0.md) |
| **UI-P1a** | 本体域：对象浏览器（两栏+SideSheet+满宽 Table）、数据中心（图谱自研组件+血缘+资产）、类型建模、运维 | 2 天 | ✅ | `412e0151` | [ai-launch-prompt-ui-p1.md](./ai-launch-prompt-ui-p1.md) §A |
| **UI-P1b** | 工作台 bento 首页（KPI/动态/待办 HITL/员工状态） | 1 天 | ✅ | `eea984dc` | 同上 §B |
| **UI-P1c** | 数字员工：卡片网格 + dw 九页并入域内 tab | 1–2 天 | ✅ | `6f632322` | 同上 §C |
| **UI-P1d** | SuperAI：执行计划详情（步骤时间线）+ Copilot 全局侧栏接线（HITL 计划卡） | 1–2 天 | ✅ | `c88fdf21` | 同上 §D |
| **UI-P1e** | 平台管理：用户/角色/AI Provider 等表格页（E 骨架 + SideSheet 表单） | 1 天 | ✅ | `933617a6` | 同上 §E |
| **UI-P2a** | 应用中心：C 骨架卡片网格 + 模板市场入口 + 页内 4 tab | 1 天 | ✅ | `30f63802` | [ai-launch-prompt-ui-p2-p3.md](./ai-launch-prompt-ui-p2-p3.md) |
| **UI-P2b** | 知识与集成：4 主 tab + MCP/A2A segmented 子 tab + 知识库 E 骨架 | 1 天 | ✅ | `3f951239` | 同上 |
| **UI-P2c** | 数据与治理：arch 20 页收编为 4 主 tab × 子 tab | 1 天 | ✅ | `f6b8346c` | 同上 |
| **UI-P2d** | 清理退役：v-* 清零、旧私有变量归一到 Semi 令牌、94 个不可达文件删除 | 1–2 天 | ✅ ⚠️ | `17383e24` | 同上 |
| **UI-P3** | 验收收口：8 域 × 双主题视觉基线、⌘K/Copilot/Sheet 交互验证、UI-ACCEPTANCE.md 证据 | 1 天 | ✅ | 见 [UI-ACCEPTANCE.md](./UI-ACCEPTANCE.md) | 同上 |

> ⚠️ **UI-P2d 的一项指标未达**：inline `style={{}}` 收敛到 1,748（目标 < 100）。差距集中在 P1a「只换壳不换画布」约束排除在外的本体过渡页（`OntologyActionPage` 241 处等），已在 [UI-ACCEPTANCE.md](./UI-ACCEPTANCE.md) §2.1 定位并登记。其余指标（`v-*` 261→0、`.semi-*` 覆盖 0）达成。

**总计约 3–4 周**。P1 五个域彼此无依赖，可在独立 worktree 并行。

## 4. 每批次统一 DoD

1. 该域替换后浅色/深色双主题截图对照（Playwright visual-action.spec.ts 模式）
2. 旧路由 301 且相关 Playwright 用例同步更新，全绿
3. **零新增** `.semi-*` CSS 覆盖；该域 inline `style={{}}` 清零（收敛为令牌类）
4. `pnpm build` + 既有测试通过
5. Conventional Commits：`feat(ui-p1a): ...`；PR 引用 DESIGN-SPEC 章节

## 5. 风险与对策

| 风险 | 对策 |
|------|------|
| dev 模式 Semi Button onClick 被 HMR 截断（登录按钮点不动） | 验证脚本走 `fetch → JWT`，或用原生 button；详见 prompt「已知坑」 |
| 并行批次合并冲突（都改 AppShell 路由表） | 路由表集中在 `src/routes/*.ts` 单文件；P0 冻结骨架 API，P1 只增域内路由 |
| 图谱组件性能（大规模节点） | 首版沿用原型物理引擎（≤200 节点）；>500 节点再评估 canvas/quadtree，P1a 不做 |
| 半途新旧混杂期观感割裂 | P0 完成后全站已在同一壳内（内容暂旧），割裂只存在于页面内部，可接受 |

## 6. 度量与验收

- 终态指标见 §2 目标列；UI-P3 出具 `UI-ACCEPTANCE.md`（截图清单 + 指标数据 + 路由对照表）
- 过程跟踪：本文件批次表勾选 + git log `ui-*` 前缀过滤
