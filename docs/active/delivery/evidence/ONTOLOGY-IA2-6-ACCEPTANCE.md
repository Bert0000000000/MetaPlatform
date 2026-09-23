# ONTOLOGY-IA2-6 验收证据（发布与治理拆分）

> **批次**：IA2-6（ADR-0069 实施切片 7/8）
> **日期**：2026-09-23
> **分支**：`feat/ontology-ia2-3-data-mapping`（IA2-3/4/5 之上连续提交；worktree `.worktrees/ontology-ia2-3-data`）
> **决策**：ADR-0069；设计规格 `docs/active/specs/2026-09-18-ontology-ia-v2-design.md` §7.6

## 1. 改动摘要与文件清单

**做了什么**：`GovernancePage`（734 行）与 `OpsPage` 两个大容器消亡，
发布与治理组**七子页**独立成页（导航全亮）；**Agent 指标（8 处 agentMetrics
引用）随 GovernancePage 删除**——本体自此全部页面不依赖 Agent 服务。

**新增**：

| 文件 | 职责 |
| --- | --- |
| `governance/drafts/DraftsPage.tsx` | 草稿：Schema WIP 清单 + **SchemaWipCard（应用/丢弃）随迁**（原 OpsPage release tab + GovernancePage 操作卡合并） |
| `governance/releases/ReleasesPage.tsx` | 版本与发布：分支 / 差异 / 回滚（G41，自 GovernancePage 版本操作区块拆出） |
| `governance/usage/UsagePage.tsx` | 使用量：读写量（近 30 天）+ 生命周期操作（deprecate/delete 含 409 保护） |
| `governance/lint/LintPage.tsx` | 模型检查：**入口页**（链接到 /ontology/model/validation，不重复实现——§7.6） |
| `governance/security/SecurityPage.tsx` | 安全策略：SecurityPolicyCard 原样承载（SEC-12） |
| `governance/import-export/ImportExportPage.tsx` | 导入导出：JSON 导出 / 文件导入回灌 |
| `governance/audit/AuditPage.tsx` | 审计：**平台级汇总**（统计摘要 + 按动作分布 + 速览；明细链接到 logic/runs 唯一权威页，不复制独立状态） |
| `governance/governance.css` | 治理组共用容器样式 |

**修改**：`routes/ontology.tsx`（governance 组挂七页）、`navigation.ts`
（usage/lint/security/import-export/audit 五项 planned → active——**治理组七页全亮**）。

**删除**：`GovernancePage.tsx`（含 AgentTrendChart / agentMetrics 全部依赖）、
`ops/OpsPage.tsx` + `ops/` 目录。

## 2. 路由变化（本批增量）

| 路由 | 页面 |
| --- | --- |
| `/ontology/governance/drafts` | 由挂 OpsPage 改为 DraftsPage（含应用/丢弃操作） |
| `/ontology/governance/releases` | 由挂 GovernancePage 整页改为 ReleasesPage（版本操作） |
| `/ontology/governance/usage` · `lint` · `security` · `import-export` · `audit` | 新注册（五项导航转 active） |

## 3. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pnpm typecheck` / `pnpm build` | ✅ / ✅ 24.7s |
| `pnpm test:unit` | 65/66（唯一红 = 预存 ProposalConfirmDrawer） |
| `node scripts/check_classes.mjs` | ✅ |
| `ontology-ia-v2-governance-flow.spec.ts`（新增） | **6/6 绿**（七子页独立 URL + 容器消亡 / 导航七页全亮 / **Agent 指标已删（逐页断言无「Agent 回归指标」「接受率基线」）** / lint 入口跳转 / 版本操作表单未退化 / 导入导出未退化） |
| ui-p1a（治理用例更新） | **6/6 绿** |
| 回归簇 nav / 矩阵 / logic-flow / dedup | 全绿 |
| 全量 Playwright | **163 过 / 1 红 / 1 skip**（8.2m）。唯一红 = superai-routing「正式聊天页展示」——2.0 会话整合既有回归（task_322fbacf），非 IA v2 |

## 4. 已知边界与回滚

1. **Agent 指标能力移除**：`api/ont/agentMetrics.ts` 模块保留（后端端点仍在），
   但前端本体域零引用——按 ADR-0069 §7.6「删除全部 Agent metrics 区块和依赖」
   执行；若后续要在 Agent 域重建该视图，属 Agent 层批次。
2. Audit 页为汇总视图（不复制明细）——明细与过滤始终在 /ontology/logic/runs。
3. DashboardPage.tsx 仍保留（无引用；归宿 AppHub 待确认，IA2-7 处置）。
4. 回滚：本批提交组独立可退（恢复 OpsPage / GovernancePage 容器挂载）。

## 5. 结论

IA2-6 准出达成：治理每个能力有正式 URL（七子页）；Agent 服务关闭时页面仍正常
（agentMetrics 零引用）；版本 / Diff / Rollback / Import/Export / Usage /
Lifecycle / SecurityPolicy 现有操作全部保留（表单级断言）；两个大容器删除。
**目标 IA 六大功能组的全部子页至此全亮**（除目标 IA 明确预留的 4 个 planned 项：
ObjectSet 构建器 / 保存的查询 / 审批策略 / Side Effects）。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

**13 硬规则 job**：ga-001 ga-002 ga-003 ga-004 ga-005 ga-006 ga-007 ga-008 ga-009 ga-010 ga-011 ga-012 ga-013——本批次 PR 全部通过 CI（11 条 required checks 全绿；
预存红见下）。**证据**：本文件即验收证据（ga-010 数据源）；测试命令与实测数字
见 §3 测试表。**命令**：`pnpm typecheck && pnpm build && pnpm test:unit && node
scripts/check_classes.mjs` + Playwright 全量（详见 §3）。**commit**：见 PR #72
合并提交 `ad368261`（IA2-3~7 全部批次）与各批次验收档头部提交区间。
