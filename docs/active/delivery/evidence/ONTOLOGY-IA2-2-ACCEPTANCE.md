# ONTOLOGY-IA2-2 验收证据（语义模型拆分）

> **批次**：IA2-2（ADR-0069 实施切片 3/8）
> **日期**：2026-09-18
> **分支**：`feat/ontology-ia-v2-foundation`（PR-2 范围；IA2-1 之后继续）
> **决策**：ADR-0069；设计规格 `docs/active/specs/2026-09-18-ontology-ia-v2-design.md` §7.2

## 1. 改动摘要与文件清单

**做了什么**：`ModelingPage` 容器（7-kind 横向 Tab）消亡，语义模型各基元独立成页；
动作类型 / 函数迁往「动作与函数」组独立成页；对象类型详情路由落地
（`ResourceDetailLayout` 首个接入方，四个真 Tab 进 URL）；lint 从 GovernancePage
拆入「模型校验」；两条预存红 spec 完成根因处置。

**新增**：

| 文件 | 职责 |
| --- | --- |
| `model/KernelPrimitiveListPage.tsx` | 基元清单共享骨架（load/搜索/分页/错误态/刷新——只抽取一次，五页复用） |
| `model/object-types/ObjectTypesPage.tsx` | 建模工作台（OntologyModelingPage 原样承载 + 新建本体入口） |
| `model/object-types/ObjectTypeDetailPage.tsx` | `:rid[/:tab]` 详情：概览/属性/关系/数据源四个真 Tab，切 Tab = 换路由 |
| `model/link-types/LinkTypesPage.tsx` · `interfaces/InterfacesPage.tsx` · `axioms/AxiomsPage.tsx` | 基元独立页（列与搜索串自容器原样搬运） |
| `model/graph/OntologyGraphPage.tsx` | 模型图谱正式路由页 |
| `model/validation/ModelValidationPage.tsx` | 反模式 lint（自 GovernancePage 拆出） |
| `logic/actions/ActionTypesPage.tsx` · `logic/functions/FunctionsPage.tsx` | 动作/函数独立页（从语义模型迁出） |

**修改**：`routes/ontology.tsx`（model 组挂独立页 + `:rid`/`:rid/:tab` 详情路由；
logic 组 actions/functions 挂独立页）、`navigation.ts`（validation 转 active）、
`GovernancePage.tsx`（摘除 lint 区块与相关状态/常量/导入）、`ontology.css`
（详情列表 + lint 列表两组令牌类）。

**删除**：`model/ModelingPage.tsx`（容器拆分完毕，先确认无外部引用再删）。

## 2. 路由变化（本批增量）

| 路由 | 页面 |
| --- | --- |
| `/ontology/model/object-types/:rid` | 详情（默认概览 Tab） |
| `/ontology/model/object-types/:rid/{overview,properties,links,datasources}` | 四个真 Tab（矩阵其余详情段无独立数据面，不渲染不注册） |
| `/ontology/model/validation` | 模型校验（原 GovernancePage lint） |
| model/{link-types,interfaces,axioms,graph}、logic/{actions,functions} | 由挂容器改为独立页面组件 |

## 3. 测试命令与真实结果（2026-09-18 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pnpm typecheck` / `pnpm build` | ✅ / ✅ 22.2s |
| `pnpm test:unit` | 65/66（唯一红 = 预存 ProposalConfirmDrawer） |
| `node scripts/check_classes.mjs` | ✅ 5940 引用 / 871 唯一 / 1001 定义 |
| `ontology-ia-v2-model-flow.spec.ts`（新增） | **5/5 绿**（基元独立页 / 容器 Tab 消亡 / 校验页 / 详情深链+Tab+刷新+返回 / 图谱路由） |
| `ui-p1a-ontology.spec.ts`（建模用例重写为逐页断言） | **6/6 绿**（公理计数回归锁迁至 PageHeader 描述） |
| `ontology-agent-e2e.spec.ts`（**重写**为入口守卫） | **2/2 绿** |
| 回归簇 ui-p0 / ui-p3 / context-navigate / nav / 矩阵 | 48/48 · 12/12 · 4/4 · 5/5 · 28/28 绿 |
| `ontology-dedup.spec.ts` | **仍红，根因已钉死**（见 §5 边界 1） |
| 全量 Playwright | **142 过 / 5 红 / 1 skip**（6.3m）。5 红 = 4 条后端类预存（action-orchestration ×2、superai-routing ×2）+ dedup（§5 边界 1）；**无 IA v2 回归**（agent-e2e 已由预存红转绿） |

## 4. 浏览器验证

- E2E 双主题截图更新入库：`tests/e2e/screenshots/ui-p1a-{explorer,graph}-{light,dark}.png`
- 详情页 / 基元页断言走真实内核数据（object-types / link-types / lint 等端点实调）。

## 5. 已知边界与回滚

1. **`ontology-dedup.spec.ts` 仍红——工作台既有缺陷，非 IA v2 回归**。根因链（本批逐层钉死）：
   ① spec 默认网关 `localhost:8100` 走 IPv6 挂死（已修，对齐 127.0.0.1）；② 壳按钮文案
   「新建概念」→「新建本体」漂移（已修）；③ 候选 Modal 出现竞态（已修为等待式）；
   ④ **残余**：`ObjectTypeEditorV2Drawer` 提交后 busy 不复位——保存按钮永远停在
   「保存中…」，创建不落库。该组件在本批**逐字节未动**，main 上同症（09-15 基线红）。
   已挂后台任务（task_7a828c99），修复验收 = 本 spec 全绿。
2. `ontology-agent-e2e.spec.ts` 原「NL → proposal → 落库」的被测入口（域内浮动 AI 助手）
   已于 09-17 被主动移除（AI 统一走全局 Copilot）。本批按诚实原则重写为**移除守卫**
   （触发器不再渲染 + 全局 Copilot 可用 + agent-tools 端点存活）；NL 端到端重建属
   Agent 层（ADR-0065 后续），本轮 IA v2 明确不做。
3. 详情页仅四个真 Tab；矩阵中 interfaces/axioms/dependents/history/security 段无独立
   数据面，不渲染（设计规格 §2.5），随批次补。
4. `logic/actions/:rid`、`logic/functions/:rid` 详情路由随 IA2-5 落地。
5. 回滚：本批提交组可独立回退（回退后恢复 ModelingPage 容器与 IA2-1 的 initialKind 挂载）。

## 6. 结论

IA2-2 准出达成：`/model/*` 每页独立 URL 且 URL 可分享/刷新/返回；七个内部主 Tab
消亡；建模工作台原样保留能力不退化；动作/函数不在语义模型；两条预存红一条转绿
（agent 守卫）、一条根因钉死并挂独立修复任务（dedup）。

---

## 附记：5 红处置 + 总览对齐（2026-09-20/21，用户指令追加，`93554d90` + `17fa42b7`）

**全量终局：146 过 / 1 红 / 1 skip**（IA2-2 收口时为 142/5/1）。

| 原 5 红 | 根因 | 处置 | 结果 |
| --- | --- | --- | --- |
| ontology-dedup | 后端 precheck 对全租户 OT **逐个实时 embed**（llmgw 单条 ≈1.6s、批量不省时，数百类型 → 网关 proxy.timeout → 前端 await 永挂） | 预算制（ONT_PRECHECK_EMBED_BUDGET_S 默认 10s）+ embed 文本缓存/批量 + 归一化兜底合并；spec 改失焦豁免 + wait-for-either 动线 | **转绿**（41.1s） |
| action-orchestration ×2 | `mate-app-wfe` 容器未运行（8GB 内存耗尽） | 停 milvus/neo4j 腾内存后 `docker start`（环境处置，无代码） | **转绿** |
| superai-routing ① | `ORCHESTRATOR_DEFAULT_ALLOWED_ACTOR_ROLES` env 后端无人读取 → authorized-snapshot 恒空集；spec 等"已不存在的种子会话" + APIContext 等全流超时丢事件 | orchestrator 启动 seed 接上 env + 回填空授权角色（deny-by-default 不变）；spec 改流式增量读 + 本体直查路径的安全断言等价变换 | **转绿**（1.5m） |
| superai-routing ② | ChatPage **后端会话**模式下流式 routing 事件不渲染 panel（本地会话路径 6.9s 实证正常）——2.0 会话整合既有回归 | 挂独立任务 task_322fbacf；不在 IA v2 范围（Agent 层） | 仍红（已定性） |

**总览页对齐**（用户反馈"菜单没有按照新的调整"）：快捷入口/KPI 卡/审计与同步链接全部改指 IA v2 六域新路径；「AI 提案回归」卡删除（agentMetrics 依赖）→「治理与健康」卡（草稿 + 反模式，真实数据）。总览自此不依赖 Agent 服务（设计规格 §7.1 提前收口）。

**运行面注意**：mate-tech-ont / mate-tech-orchestrator 容器当前为 docker cp 热更——代码已在分支，但**下次容器 recreate 会回退**，合并后需走正常重建。
