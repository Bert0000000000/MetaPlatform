# ONTOLOGY-IA2-5 验收证据（动作与函数拆分）

> **批次**：IA2-5（ADR-0069 实施切片 6/8）
> **日期**：2026-09-23
> **分支**：`feat/ontology-ia2-3-data-mapping`（IA2-3/4 之上连续提交；worktree `.worktrees/ontology-ia2-3-data`）
> **决策**：ADR-0069；设计规格 `docs/active/specs/2026-09-18-ontology-ia-v2-design.md` §7.5

## 1. 改动摘要与文件清单

**做了什么**：动作类型 / 函数获得 `:rid` 详情路由（真数据 Tab 进 URL）；
Action 编排（OntologyActionPage 2267 行）迁移为 `logic/designer/ActionDesignerPage`；
执行记录升格唯一权威页（自 OpsPage audit tab 抽出，支持 `?action=` 深链）；
OpsPage 摘除 audit（剩版本与发布 + 治理两个 tab，治理归 IA2-6 处理）；
`ActionTypeListPage` 退役（`actionDisplayName` 抽到 `logic/actions/displayName.ts`）。

**新增**：

| 文件 | 职责 |
| --- | --- |
| `logic/actions/ActionTypeDetailPage.tsx` | `:rid[/:tab]`：概览（函数引用/绑定/副作用）/ 参数 / 提交条件 / 运行记录（listActionAudit(actionRid)）——审批页签无真实数据不显示 |
| `logic/functions/FunctionDetailPage.tsx` | `:rid[/:tab]`：概览（语言/source_ref/版本）/ 签名 / 使用方（按 function_ref 过滤 actions） |
| `logic/runs/ActionRunsPage.tsx` | 执行记录唯一权威页：`?action=` 深链过滤（详情页签的放大视图）+ 全量视图 + 搜索分页 |
| `logic/actions/displayName.ts` | `actionDisplayName`（自 ActionTypeListPage 抽出） |

**移动**：`OntologyActionPage.tsx` → `logic/designer/ActionDesignerPage.tsx`（git mv，import 路径与 CSS 引用修正，组件名对齐）。

**修改**：`routes/ontology.tsx`（actions/functions 的 :rid/:tab 路由 + designer 换挂迁移文件 + runs 换挂 ActionRunsPage）、`OpsPage.tsx`（audit tab 与相关状态/列删除）。

**删除**：`actions/ActionTypeListPage.tsx`（组件无路由引用；工具函数已抽走）。

## 2. 数据面（全走既有契约，零新契约）

- **ActionType / Function 详情体**：列表侧按 rid 过滤（后端 `GET /action-types/{rid}` 虽实测 200 但**未契约化**——硬规则 1 禁用未登记接口；`GET /functions/{rid}` 404）。
- **运行记录**：`GET /action-audit?limit&action_rid`（契约已有）。

## 3. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pnpm typecheck` / `pnpm build` | ✅ / ✅ 21.5s |
| `pnpm test:unit` | 65/66（唯一红 = 预存 ProposalConfirmDrawer） |
| `node scripts/check_classes.mjs` | ✅ |
| `ontology-ia-v2-logic-flow.spec.ts`（新增） | **4/4 绿**（Action 详情深链+Tab+刷新+审批页签不显示 / Function 详情+使用方 / 执行记录 ?action= 过滤+全量 / Designer 路由可达） |
| 回归簇 ui-p1a / nav / 矩阵 / model-flow | 6/6 · 5/5 · 28/28 · 5/5 绿 |
| 全量 Playwright | **157 过 / 1 红 / 1 skip**（7.9m）。唯一红 = superai-routing「正式聊天页展示」——2.0 会话整合既有回归（task_322fbacf），非 IA v2 |

## 4. 已知边界与回滚

1. **详情体走列表侧过滤**：租户动作/函数数量当前几十级，无性能问题；后端契约化
   detail 端点后可无缝切换（页面结构不变）。
2. 设计规格的 functions `:rid/versions|dependencies|runs` 段无独立数据面，不渲染。
3. Designer 画布仅验证挂载（编排交互深测在 action-orchestration spec，CI 上因
   栈原因预存红——本地已绿）。
4. 回滚：本批提交组独立可退。

## 5. 结论

IA2-5 准出达成：Action/Function 不在语义模型（IA2-2 迁出复验）；Action Designer
不挂 /ops/actions（正式路由 /logic/designer）；执行记录唯一权威页
（OpsPage audit 已摘）；动作与函数组五页全亮（列表+详情×2+编排+执行记录）。
