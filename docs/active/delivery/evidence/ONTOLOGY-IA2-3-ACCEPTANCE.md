# ONTOLOGY-IA2-3 验收证据（数据映射拆分）

> **批次**：IA2-3（ADR-0069 实施切片 4/8）
> **日期**：2026-09-22
> **分支**：`feat/ontology-ia2-3-data-mapping`（基于 `main@15b55c5a`，worktree `.worktrees/ontology-ia2-3-data`）
> **决策**：ADR-0069；设计规格 `docs/active/specs/2026-09-18-ontology-ia-v2-design.md` §7.3

## 1. 改动摘要与文件清单

**做了什么**：`DatacenterPage` 容器（三视图内部 Tab）消亡，数据映射三子页独立成页；
全局资产清单移出本体导航（保留组件待 Gov 迁移）；左侧导航「数据映射」组自此三页全亮。

**新增**：

| 文件 | 职责 |
| --- | --- |
| `data/mappings/ObjectMappingsPage.tsx` | 对象映射（背挂数据源声明 + 字段映射，DATA-14/15） |
| `data/sync/SyncJobsPage.tsx` | 同步任务（每类型最近一轮同步健康快照，原「数据接入」下半区升格独立页） |
| `data/lineage/OntologyLineagePage.tsx` | 本体血缘（分层 DAG，派生自数据平台控制面） |
| `data/assets/AssetsInventoryPage.tsx` | 全局资产清单——**保留组件但不挂本体路由**（归宿数据与治理域，Gov 侧迁移单独跟踪） |
| `data/data-sections.css` | 分节样式（mappings/sync 共用，自 datacenter.css 拆出） |
| `data/mappings/backing-datasource.css` | 声明表单样式（随 BackingDatasourcePanel 迁移） |

**移动**：`datacenter/BackingDatasourcePanel.tsx` → `data/mappings/`（import 路径与 CSS 引用同步修正）。

**修改**：`routes/ontology.tsx`（data 组挂三新页 + sync 路由注册）、`navigation.ts`
（sync 转 active——**数据映射组三页全亮**）、`OverviewPage.tsx`（同步健康卡链接
改指 `/ontology/data/sync`）。

**删除**：`datacenter/DatacenterPage.tsx` + `datacenter/datacenter.css`（拆分完毕，无外部引用后删）。

## 2. 路由变化（本批增量）

| 路由 | 页面 |
| --- | --- |
| `/ontology/data/sync` | 同步任务（新注册；`/ontology/data` 组根仍 redirect 到 mappings） |
| `/ontology/data/mappings` | 由挂容器改为 ObjectMappingsPage |
| `/ontology/data/lineage` | 由挂容器改为 OntologyLineagePage |
| ~~资产清单视图~~ | 不再从本体可达（`/ontology/datacenter` 301 → mappings；导航无入口） |

## 3. 测试命令与真实结果（2026-09-22 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pnpm typecheck` / `pnpm build` | ✅ / ✅ 40.5s |
| `pnpm test:unit` | 65/66（唯一红 = 预存 ProposalConfirmDrawer） |
| `node scripts/check_classes.mjs` | ✅ 5936 引用 / 870 唯一 / 1001 定义 |
| `ontology-ia-v2-data-flow.spec.ts`（新增） | **3/3 绿**（三子页独立 URL + 容器 Tab 消亡 / 导航 sync 可达 / 资产清单不在本体路由） |
| `ui-p1a-ontology.spec.ts`（数据映射用例重写） | **6/6 绿** |
| 回归簇 nav / 矩阵 / model-flow / context-navigate / agent 守卫 / dedup | 5/5 · 28/28 · 5/5 · 4/4 · 2/2 · 1/1 绿 |
| 全量 Playwright | **149 过 / 1 红 / 1 skip**（7.4m）。唯一红 = superai-routing「正式聊天页展示」——2.0 会话整合既有回归（task_322fbacf），非 IA v2 |

## 4. 浏览器验证

- data-flow spec 断言走真实 DOM（背挂数据源工具条 `.mp-dc-ingest-bar`、血缘节点 `.mp-graph-ln-node`、
  同步表壳 `.mp-tablepro`），双主题截图沿用 ui-p1a 视觉证据。

## 5. 已知边界与回滚

1. **资产清单 Gov 迁移未做**：`AssetsInventoryPage` 保留可用组件、不挂路由
   （ADR-0069 §7.3：数据资产迁移牵涉 Gov 域，单独跟踪——**待登记 Gov 侧任务**）。
2. **血缘按 ObjectType 过滤未做**：设计规格的「只显示与 ObjectType / Mapping 相关的链路」
   需要血缘派生端点带 ObjectType 维度（当前无此维度），第一版整图与拆分前一致，不造假过滤。
3. CDC / Paimon / Iceberg / Data Product 的数据面配置页不在本体范围（归数据与治理域）。
4. 回滚：本批提交组独立可退（回退后恢复 DatacenterPage 容器与 IA2-1 的 initialView 挂载）。

## 6. 结论

IA2-3 准出达成：本体只显示与本体映射直接相关的数据面（三子页）；不再承担全局数据资产门户
（assets 摘出本体导航）；同步和映射功能不丢失（sync 升格独立页 + mappings 保留声明面板）；
容器内部视图 Tab 消亡。
