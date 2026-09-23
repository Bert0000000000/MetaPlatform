# ONTOLOGY-IA2-ACCEPTANCE —— IA v2 页面结构重构总验收（IA2-0 ~ IA2-7 全八批收口）

> **日期**：2026-09-23
> **决策**：ADR-0069（Accepted）
> **设计规格**：`docs/active/specs/2026-09-18-ontology-ia-v2-design.md`（权威路由矩阵）
> **批次证据**：`ONTOLOGY-IA2-{0,1,2,3,4,5,6}-ACCEPTANCE.md`（含各自实测数字与边界）
> **PR**：IA2-0~2 已随 PR #66 合并（`dbbaef52`）；IA2-3~7 在分支
> `feat/ontology-ia2-3-data-mapping`（12+ 提交，本文件随批提交）

## 1. 一句话结论

**八批全部收口**：本体域从「6 横向 Tab + 页面内 useState 导航」重构为
「左侧工作区导航 + 六大功能组 + 全子页正式 URL + 路由即状态」；目标 IA 的
全部子页亮灯（仅剩 4 个设计规格明确预留的 planned 项）；本体所有页面零
Agent 服务依赖；全部既有操作能力经表单级断言验证不退化。

## 2. 最终信息架构（全部 active）

```text
本体
├── 总览                       /ontology（零 Agent 依赖，治理与健康卡）
├── 语义模型
│   ├── 对象类型(+工作台/:rid 详情) /ontology/model/object-types
│   ├── 关系类型 / 接口 / 公理 / 模型图谱 / 模型校验      （5 子页）
├── 数据映射
│   ├── 对象映射 / 同步任务 / 本体血缘                     （3 子页）
├── 对象与查询
│   ├── 对象浏览(:rid 段路由详情) / 聚合分析 / 地图视图    （3 子页）
├── 动作与函数
│   ├── 动作类型(:rid 详情) / 函数(:rid 详情) / Action 编排 / 执行记录（4 子页）
└── 发布与治理
    └── 草稿 / 版本与发布 / 使用量 / 模型检查(入口) / 安全策略 / 导入导出 / 审计（7 子页）
```

**planned（按设计预留，不渲染不注册）**：ObjectSet 构建器 / 保存的查询 /
审批策略 / Side Effects。

## 3. 容器消亡清单（绞杀式迁移完成）

| 容器 | 消亡批次 |
| --- | --- |
| `ModelingPage`（7 内部 Tab） | IA2-2 |
| `DatacenterPage`（3 内部视图） | IA2-3 |
| `AppsPage` | IA2-4 |
| `OpsPage`（3 内部 Tab） | IA2-5 摘 audit → IA2-6 删除 |
| `GovernancePage`（734 行 + Agent 指标） | IA2-6 |
| `ActionTypeListPage` | IA2-5 |
| 死文件：`datacenter.css` 残件、零引用 `DashboardPage`（归宿 AppHub） | IA2-7 |

## 4. 硬性约束逐条核验（§11 验收标准）

| 约束 | 证据 |
| --- | --- |
| 每个 active 子页面有正式 URL | governance-flow / model-flow / data-flow / logic-flow / navigation specs 全绿 |
| 刷新不丢位置 / 前进后退 / 深链 | object-flow 4/4（含关系跳转浏览器返回、旧 ?id= 迁移、?page= 保持） |
| 面包屑 / ⌘K 正确 | ONTOLOGY_NAV 单一配置源驱动（navigation.ts）；nav spec 绿 |
| 旧路径全部可达 | legacy-redirects 矩阵 28/28 绿（保留一个发布周期） |
| 无路由循环 / 无重复注册 | 路由矩阵唯一权威（设计规格 §4 + 表驱动 E2E） |
| 对象消费闭环不退化 | object-flow + ui-p1a（Sheet/ActionForm/Proposal 组件链原样） |
| Action 编排不退化 | logic-flow（Designer 迁移后路由可达）+ action-orchestration spec |
| 版本 / Diff / Rollback / Import/Export / Usage / Security 不退化 | governance-flow 表单级断言 |
| Agent 服务不可用不影响本体 | **agentMetrics 前端零引用**（governance-flow 逐页断言 + grep 证实） |
| 无 `.semi-*` 覆盖 / 无新增静态 inline style | check_classes 全绿；新增 CSS 全令牌取值 |
| 无 Mock 冒充 / 无空壳正式页面 | planned 项不渲染不注册；详情页无数据面的 Tab 不显示 |
| 1024/1440/1920 双主题 | **visual spec 6/6 绿**（三视口不遮挡 + 双主题 12 张截图归档 + 键盘可达） |
| TypeScript / Build / Unit / E2E | 详见 §5 |

## 5. 最终测试基线（2026-09-23 实测）

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` / `pnpm build` | ✅ / ✅ |
| `pnpm test:unit` | 65/66（唯一红 = 预存 ProposalConfirmDrawer，历史遗留） |
| `node scripts/check_classes.mjs` | ✅ |
| Playwright 全量 | **169 过 / 1 红 / 1 skip**（终局实跑 8.6m；IA2-0 收口时为 8 红）——唯一红 = superai-routing「正式聊天页展示」，2.0 会话整合既有回归（已挂独立任务 task_322fbacf，非 IA v2 范围） |
| IA v2 新增 spec | navigation 5 / legacy-redirects 28 / model-flow 5 / data-flow 3 / object-flow 4 / logic-flow 4 / governance-flow 6 / visual 6 = **61 条** |

## 6. 已知边界登记（全部已在批次验收档立据）

1. **排序未进 URL**（IA2-4）：需 DataTablePro 受控排序改造（共享组件，9 使用方）——独立任务。
2. **血缘按 ObjectType 过滤**（IA2-3）：血缘派生端点无 ObjectType 维度，第一版整图。
3. **资产清单 Gov 迁移**（IA2-3）：`AssetsInventoryPage` 保留组件不挂路由，归宿数据与治理域——**Gov 侧迁移待登记任务**。
4. **Action/Function 详情体走列表侧过滤**（IA2-5）：`GET /action-types/{rid}` 后端有但未契约化（硬规则 1 禁用）；契约化后可无缝切换。
5. **Analysis/Map 共享 ObjectSet 输入未统一**（IA2-4，规格允许首批保留）。
6. **本体 DashboardPage 已删**（IA2-7，零引用；归宿 AppHub——AppHub 侧集成待登记）。
7. superai-routing 1 条预存红（Agent 层，task_322fbacf）。

## 7. 回滚与运维

- 每批提交组独立可回退（各验收档 §回滚）。
- 旧路径 301 与新路由并存——**至少保留一个发布周期**（ADR-0069 不变量 2）；
  删除前记录命中次数。
- 本地运行面：dev server 9250 + gateway 8100（容器栈全量在跑）；后端零改动
  （IA v2 全程未新增/未修改任何 OpenAPI 契约）。

## 8. Program Board 登记

| Batch | 状态 | 证据 |
| --- | --- | --- |
| ONTOLOGY-IA2-0 | **Accepted** | ONTOLOGY-IA2-0-BASELINE.md |
| ONTOLOGY-IA2-1 | **Accepted** | ONTOLOGY-IA2-1-ACCEPTANCE.md |
| ONTOLOGY-IA2-2 | **Accepted** | ONTOLOGY-IA2-2-ACCEPTANCE.md |
| ONTOLOGY-IA2-3 | **Accepted** | ONTOLOGY-IA2-3-ACCEPTANCE.md |
| ONTOLOGY-IA2-4 | **Accepted** | ONTOLOGY-IA2-4-ACCEPTANCE.md |
| ONTOLOGY-IA2-5 | **Accepted** | ONTOLOGY-IA2-5-ACCEPTANCE.md |
| ONTOLOGY-IA2-6 | **Accepted** | ONTOLOGY-IA2-6-ACCEPTANCE.md |
| ONTOLOGY-IA2-7 | **Accepted** | 本文件 |

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

**13 硬规则 job**：ga-001 ga-002 ga-003 ga-004 ga-005 ga-006 ga-007 ga-008 ga-009 ga-010 ga-011 ga-012 ga-013——本批次 PR 全部通过 CI（11 条 required checks 全绿；
预存红见下）。**证据**：本文件即验收证据（ga-010 数据源）；测试命令与实测数字
见 §3 测试表。**命令**：`pnpm typecheck && pnpm build && pnpm test:unit && node
scripts/check_classes.mjs` + Playwright 全量（详见 §3）。**commit**：见 PR #72
合并提交 `ad368261`（IA2-3~7 全部批次）与各批次验收档头部提交区间。
