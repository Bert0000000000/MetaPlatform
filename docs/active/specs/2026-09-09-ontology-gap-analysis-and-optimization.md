# Palantir Ontology 深度对位 —— 本体引擎差距分析与优化方案

> **日期**：2026-09-09
> **性质**：差距分析 + 优化方案（不含代码改动；供后续 Batch 立项使用）
> **调研来源**：
> - 官方文档全量调研（50+ 页），本地材料：`D:\WenChao_AI_Brain\...\Palantir Ontology 调研\00~06`（6 份，2026-09-09）
> - 本仓库实现：`mate-kernel/src/mate_kernel/ontology/`（12 基元）+ `mate-tech-ont/src/mate_tech_ont/v2_kernel/`（服务层，57 路由）+ `mate_kernel/objectset/`（查询 IR）+ `mate_kernel/action/engine.py`（Action 引擎）
> - 前端实现：`metaplatform-frontend/apps/web/src/pages/ontology/`（Ontology Shell 六 tab，~12.8k 行）+ `api/ont/kernel.ts`（前端 API 客户端）
> - 蓝图基线：`docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4；SAL-01~04 已收口（ADR-0043/0044）
>
> **一句话结论**：Mate 本体引擎的**动能层骨架（Action/HITL/proposal/audit）和查询 IR 已达 Palantir 雏形水准，部分能力（subclass 推理、强制 HITL、去重 precheck）甚至是 Palantir 没有的**；但**语义层表达力（层级一等化/struct/共享属性/派生属性/vector）、Action 声明式编辑模型、数据平面绑定（backing datasources）、行列级安全、检索生产化**五个方向存在结构性差距；**前端 UI 缺整个 L6 应用面**（实例浏览器/对象主页/人工 Action 表单/治理面），其中实例浏览的后端 API 已齐但无页面消费。共识别 **44 项差距**（后端 34 + 前端 10），按 6 个波次 + 1 条并行 UI 轨道组织为 26 个候选 Batch。

---

## 1. 对位方法

Palantir Ontology 分层（调研材料 00 §二）：L0 数据支撑 / L1 安全横切 / L2 语义层 / L3 动能层 / L4 API 出口 / L5 AI 消费 / L6 应用层。本文按同一坐标系逐层对位 Mate 实现，每条差距给出：**Palantir 能力 → Mate 现状（代码证据）→ 弥补逻辑**。

差距定级：
- **P0 结构性**：不动它，"数字孪生/操作层"定位就不成立
- **P1 能力性**：功能缺口，影响可用性/AI 消费
- **P2 工程性**：规模化/治理/运维缺口

---

## 2. 现状盘点 —— 已实现且对位 Palantir 的能力（不要低估）

| Mate 能力 | 代码证据 | Palantir 对位 | 状态 |
|---|---|---|---|
| 12 基元 Protocol/dataclass | `mate_kernel/ontology/types/`（5 类型）+ `instances/` + `reasoning/` + `query/` | Object/Link/Action/Interface/Function/ObjectSet 全覆盖 | ✅ 骨架齐 |
| Action = 写入唯一入口 + proposal HITL | `action/engine.py`（pending→confirmed→executed/rejected/withdrawn/reverted 六态） | Action types（Palantir 直接执行；**Mate 强制 HITL 是更严的变体**，决策 B3） | ✅ 超集语义 |
| Proposal 持久化 + 幂等 + 事件 + 审计 | `ont_proposal/_event/_idempotency/_execution/_action_audit` 表 | Action log / audit | ✅ |
| submission_criteria + side_effects(outbox) + 回滚 hook | `engine.py:93-139, 295-427` | Rules / side effects（简化版） | 🟡 雏形 |
| ObjectSet 结构化查询 IR | `objectset/ir.py`：filters + traversal（link 跳）+ aggregation + sort + paging；PG 编译器 `pg_repo.py:1800+` | Object Set Service（读服务） | 🟡 无 OR/NOT |
| **subclass 层级 + 推理** | `reasoning/engine.py`：R1 传递闭包 / R2 same_as 并查集 / R3 传递属性；**ONT-G21 后代闭包注入 ObjectSet 查询**（`pg_repo.py:1821`） | **Palantir 无此能力**（靠 Interface 组合） | ✅ 差异化优势 |
| Interface 基元 + implements 校验 | `types/interface.py` | Interfaces（多态契约） | 🟡 声明有、消费无 |
| 类型版本：snapshot/branch/diff/rollback | `pg_repo.py`（branch_object_type / diff / rollback）+ `versioning/` | Ontology branching（per-type 粒度） | 🟡 |
| 对象语义检索（OAG）+ 对象卡片 | `object_search.py`（embedder 协议 + hash 离线兜底 + cosine）+ `ont_object_embedding` | Semantic search（dev 形态） | 🟡 JSONB 无索引 |
| 类型去重 precheck | `similarity.py`（MP-DEDUP-01，embedding+slug 兜底，merge 建议） | Department Silos 反模式的人肉版 | ✅ 差异化 |
| Agent 工具虚拟注册表 | `/agent-tools`（从 ont_object_types 实时算 query_* 工具 + marking 过滤） | Functions as AI-ready tools | 🟡 只读面 |
| 租户隔离 + 类型级 marking | RLS（`_install_rls`）+ `ObjectType.marking` + 工具可见性过滤 | Markings（类型级） | 🟡 无行/列级 |
| SHACL 校验 / OWL 导入导出 / SPARQL legacy / 联邦查询 | `inference/shacl_engine.py`、`owl/io.py`、`sparql/`、`federation.py` | Palantir 无对应（自建差异） | 🟡 legacy 待收编 |
| 富属性格式枚举 | `property_.py` PropertyFormat：geojson/latlon/timeseries/image/audio/video（SAL-07） | Geo/Media/时序属性 | 🟡 仅枚举，无存储/算子 |

**前端现状（Ontology Shell 六 tab，`pages/ontology/`）**：

| 前端能力 | 代码证据 | Palantir 对位 | 状态 |
|---|---|---|---|
| 概念模型（类型管理 + 去重提示 + 新建 drawer） | `OntologyModelingPage.tsx`（841 行）：领域分组列表 + 概念表 + 状态过滤 + 相似度提示（771 行） | Ontology Manager（对象类型视图，弱化版） | 🟡 仅类型级 |
| 关系类型 / 动作类型管理 | `RelationshipTypeListPage.tsx` / `ActionTypeListPage.tsx` | Ontology Manager 对应视图 | 🟡 |
| 数据中心（数据源/CDC/ETL/血缘/指标/调度六视图） | `OntologyDatacenterPage.tsx` + 6 个 View 组件 | Data Lineage / 数据健康（超出 Palantir Ontology 范围的自建面） | ✅ |
| Action 编排（定义 + 流程） | `OntologyActionPage.tsx`（2512 行）：分组表单 + basic/io/relations/flow 四详情 tab | Workshop（工作流定义侧） | 🟡 |
| 知识图谱（类型级画布） | `OntologyGraphPage.tsx`：类型节点 + link 边 + 领域分列布局 | Ontology Manager 链接类型图（对应） | 🟡 无实例级 |
| AI 助手 + HITL 闭环 | `useOntologyAssistant` + `ProposalConfirmDrawer`（413 行）+ `OntologyStagingPreview`（477 行） | AIP Agent 提案审核（**差异化：Palantir 无强制 HITL**） | ✅ |
| 前端 API 客户端 | `api/ont/kernel.ts`：types/links/actions/functions/**individuals**/proposals/precheck/merge/flow 全覆盖 | OSDK（弱化版） | ✅ 覆盖面好 |

**结论**：底盘存在且方向正确。差距集中在**表达力、事务模型、数据绑定、安全粒度、检索工程化**五条线 + **前端 L6 应用面整体缺位**，而非推倒重来。

---

## 3. 差距清单（34 项，按 Palantir 层组织）

### 3.1 L0 数据支撑层 —— 最大结构性差距（4 项）

| # | 差距 | Palantir | Mate 现状 | 定级 |
|---|---|---|---|---|
| G1 | **无数据源绑定（backing datasources）** | object type 由 datasets/streams 经 Funnel 索引成对象；本体是企业数据的映射 | `ont_individual` 仅由 Action/propose 直接写入（`pg_repo.py` upsert）。批量数据（CSV/表/CDC）无法"成为"对象 | **P0** |
| G2 | **无 MDO（多数据源对象类型）** | 一个类型多个数据源拼接 + 字段级冲突优先级 | 无概念 | P1 |
| G3 | **无 materialization/writeback 回流** | 对象最新状态物化成 dataset 供下游管道消费（分钟级传播） | 无；本体是数据"终点"而非"中转" | P1 |
| G4 | **无双流合并语义** | 管道数据 + 用户编辑（object edits）合并为最新表示 | 只有用户/AI 编辑单流 | P1 |

> **影响**：当前本体只能承载"人工/AI 维护的小规模对象宇宙"（订单评审种子、HR/IT 编排种子等），无法兑现"组织数字孪生"。这是 Palantir Ontology 的立身之本（Ontology sits **atop** the data plane）。
> **归属建议**：G1-G4 与 DATA-D0-D8（CDC/管道）强耦合，建议独立立项而非混入引擎优化。

### 3.2 L1 安全横切（3 项）

| # | 差距 | Palantir | Mate 现状 | 定级 |
|---|---|---|---|---|
| G5 | **无对象级（行）/属性级（列）安全策略** | object security policies（配在类型上，行过滤）+ property policies（列→null）= 单元格级 | 仅租户 RLS + 类型级 marking（`types/object_type.py:22`）；查询结果不按策略过滤 | **P0**（多租户敏感数据前提） |
| G6 | **marking 无血缘传播 / 读时不联动** | marking 沿 lineage 强制传播；读时强制（read-time enforcement） | marking 只影响工具可见性（`/agent-tools`），Individual.marking 存了但查询不过滤 | P1 |
| G7 | **无 scoped session（目的限制）** | 会话级 markings 子集选择，GDPR/HIPAA 目的限制 | 无 | P2（合规场景触发再做） |

### 3.3 L2 语义层 —— 表达力核心差距（10 项）

| # | 差距 | Palantir | Mate 现状 | 定级 |
|---|---|---|---|---|
| G8 | **层级非一等建模概念** | 官方立场"组合优于深层次级"：Interface 多态 + 能力组合 | subclass 走 axiom 记录（`ont_axiom`），ObjectType **无 parent 字段**、管理面无层级树；Interface 声明了（`implements_interface`）但**不可作为查询源**（`ObjectSetQuery.source` 只收 ObjectType rid）、`required_links`/`polymorphic_action_constraints` 是不校验的占位字符串（`types/interface.py:19-20`） | **P0**（用户点名例子，详见 §4） |
| G9 | **无共享属性（shared properties）** | 跨类型一致建模（一改全改） | 属性按类型私有（`ont_property` 每类型一份） | P1 |
| G10 | **无派生属性（derived properties）** | 查询时计算（聚合/选取），随 Action 联动，安全继承 | `property_.py` docstring 提 derived 但**无字段无机制** | P1 |
| G11 | **无 struct 嵌套属性** | 语义分组 + AI 元数据范式（llmConfidence/llmReasoning/source） | props 是扁平 `(ClassRef, value)` 元组 | P1 |
| G12 | **无数组/多值属性 + reducer** | 多值属性（数组/集合 + first/latest reducer） | 无 | P2 |
| G13 | **无 vector 属性类型** | embedding 是一等属性 + `nearestNeighbors` 查询算子 | embedding 在旁路表 `ont_object_embedding`，非属性；查询无 KNN 算子 | **P0**（AI 消费地基） |
| G14 | **值类型系统薄弱** | value types 注册表 + 类型校验 | `Property.type_id` 是自由字符串，无注册表无校验 | P1 |
| G15 | **LinkType 语义缺口** | 两端独立命名（各自 display name，双向可读）；cardinality 强制；同两类型多 link 合法且有约束 | `cardinality` **存而不校验**（`pg_repo.py:1321` 仅写入）；无两端命名（`types/link_type.py`）；自引用未验证 | P1 |
| G16 | **展示/描述元数据缺失** | description（AI 可导航性关键）、render hints、statuses、type classes、type groups | ObjectType 无 description；Property 仅 title；无 render hint/status | P1（小改大收益） |
| G17 | **时序属性无存储与算子** | 时间序列属性 + 时间查询（Time Machine 反模式的正解） | `TIMESERIES` 格式只是"series rid 引用"（`property_.py:26`），无 series store、无时间窗口算子 | P1 |

### 3.4 L3 动能层（6 项）

| # | 差距 | Palantir | Mate 现状 | 定级 |
|---|---|---|---|---|
| G18 | **Action 编辑模型是"函数副作用"而非"声明式 edit-set"** | Action = 参数 + 声明式 edits（改属性/建删 link/建删对象打包**单事务**，单次最多 1 万对象）+ 可选 function-backed | `apply()` 单 target_iid，靠 `function_result` 回写 target.props（`engine.py:295`）；无声明式 edit 集、无批量 | **P0** |
| G19 | **校验体系简陋** | 参数校验（必填/类型/范围）+ entry validation + submission criteria（结构化） | `SimpleRuleEvaluator` 仅 4 种字符串表达式（`==`/`!=`/`startswith`/`in`，`engine.py:103-139`）；参数无校验 | **P0** |
| G20 | **副作用未投递** | notifications + webhooks（重试/签名/审计） | side_effects 只 emit outbox 事件名（占位）；无通知通道绑定、无 webhook 投递器 | P1 |
| G21 | **无通用 Action revert** | action reverts（逆编辑） | 仅 proposal 级 revert（补偿执行，PRD-02）；Action 本身不记逆编辑 | P1 |
| G22 | **无 Scenario（情景沙盒）** | 临时/持久/合并三形态；会话内 fork + 10 分钟 rebase + merge-action 单事务落地 | proposal.expected_diff + preview 是**单 Action 级雏形**；无本体状态 fork、无多方案并排 | P1（注：Palantir 自身也是 Beta） |
| G23 | **Function 工程化缺口** | 版本化对齐本体分支、别名、单测 stub、发布为 API（query functions）、流式输出 | `ont_function` 表 + K8s Job L2 沙箱执行已有（SAL-03）；无版本/别名/测试桩/API 发布 | P1 |

### 3.5 L4 API 出口（3 项）

| # | 差距 | Palantir | Mate 现状 | 定级 |
|---|---|---|---|---|
| G24 | **无 typed client 生成（OSDK 等价）** | 从本体定义生成 TS/Py/Java 类型化客户端；"改定义即改 API" | `/agent-tools` 生成 JSON Schema（仅 query_*）；`mate-clients/sdk` 是通用 OpenAPI 封装，非本体感知 | P1 |
| G25 | **无 WebSocket/推送订阅** | object 变更订阅 | outbox 事件已有（`ont_outbox_event`），缺订阅面 | P2 |
| G26 | **无 searchAround 便捷遍历** | 一跳关系遍历 API（上限 10 万对象） | IR 有 traversal 但无独立端点、无规模保护 | P2 |

### 3.6 L5 AI 消费（3 项）

| # | 差距 | Palantir | Mate 现状 | 定级 |
|---|---|---|---|---|
| G27 | **语义检索是 dev 形态** | 托管 embedding + vector property + nearestNeighbors（K≤500，可按相关性排序）+ hybrid（keyword+vector+RRF）+ HyDE | JSONB 存向量 + **进程内 cosine 全表扫**（`object_search.py` 注释自认 dev 形态）；pgvector 升级路径未走（tech-rag 已有 halfvec+HNSW 成熟经验） | **P0** |
| G28 | **无 chunk 对象管道** | 文档→media set→chunk→chunk 对象（link 回源文档）→检索溯源 | tech-rag 的 kb_chunks 与本体对象宇宙完全分离；无"文档块即对象"建模 | P1 |
| G29 | **Agent 工具面窄** | Functions 即工具（读/聚合/编辑/写全覆盖） | `/agent-tools` 只暴露 query_*（读）；aggregate/traverse/propose 不在注册表 | P1 |

### 3.7 L6 治理（5 项）

| # | 差距 | Palantir | Mate 现状 | 定级 |
|---|---|---|---|---|
| G30 | **无使用量指标** | Reads/Writes/Interactions/Active users per type，驱动变更影响评估与退役决策 | Action 侧有审计；读路径无计数 | P1 |
| G31 | **无清理退役生命周期** | Snooze/Deprecate/Delete 分级 + 基于使用的删除保护 | 仅 archived 标志（list 过滤） | P2 |
| G32 | **无反模式 lint** | 8 大反模式各有症状指标（可自动化） | MP-DEDUP-01 覆盖"部门孤岛"一条；其余 7 条无检查 | P2 |
| G33 | **无破坏性变更门禁** | 删除/破坏性改动须输入实体名显式确认 + WIP 暂存 + 冲突合并 | branch/diff/rollback 有；保存无门禁、无 WIP | P2 |
| G34 | **无验证评估套件** | 三段式业务问题题库 + 人机四象限盲测 + 回归评估 | 无 | P2（方法论资产） |

### 3.8 L6 前端 UI 应用面（10 项）—— 整层缺位

> Palantir 调研材料 01 §五：L6 七大应用（Object Views / Object Explorer / Quiver / Workshop / Slate / Carbon / Map）是"语义层的用户面出口"——本体价值最终通过它们兑现。Mate 前端目前只有**类型管理面（Ontology Manager 弱化版）**，缺**实例消费面**。

| # | 差距 | Palantir | Mate 现状 | 定级 |
|---|---|---|---|---|
| G35 | **无对象实例浏览器（Object Explorer 等价）** | 零配置实例搜索/过滤/聚合 + **Search Arounds** 沿关系一跳跳转 + 批量 Action，面向非技术用户 | **无任何实例浏览页面**。后端 `/individuals`、`/object-sets:evaluate`、`/object-query`、`/object-search`、`/link-instances` 全部已通；前端 `kernel.ts` 的 `listIndividuals` 已导出但零调用 | **P0**（用户价值最大且零后端依赖） |
| G36 | **无对象主页（Object Views 等价）** | 每个对象一张"主页"：属性卡 + 关联对象（link 双向导航）+ 指标 + 嵌入分析 + 可执行 Action 按钮 | 无对象详情页；概念详情页只展示 schema | **P0** |
| G37 | **无人工 Action 执行表单** | 用户在对象上执行 Action：参数表单（按 parameters schema 渲染）→ 校验 → 提交 → 副作用 | 写路径只有 AI proposal 一条（ProposalConfirmDrawer 是**确认 AI 提案**，不是人工发起）；`ActionTypeListPage.tsx:4` 自注"kernel 尚无执行记录查询接口"，执行历史空态 | **P0**（写闭环的人肉侧） |
| G38 | **无语义搜索 UI** | Object Explorer / Workshop 搜索栏吃语义检索（vector + 关键词） | `/object-search`（OAG 对象卡片）无前端入口；只有 AI 助手内部使用 | P1 |
| G39 | **概念模型页缺层级与 Interface 管理** | Ontology Manager：类型分组/接口列表/实现关系/层级导航 | `OntologyModelingPage.tsx:245` `interfaces: []` 是死占位；领域列表平铺无层级树；无 Interface 管理页 | P0（与后端 G8/EXP-01 配对交付） |
| G40 | **属性编辑器薄弱** | 属性编辑器：struct/数组/派生/共享属性/render hints/required/格式全套 | 新建概念 drawer 仅基础字段（FormDrawer + TextInput）；无属性高级编辑 | P1（与 EXP-02/04 配对） |
| G41 | **治理面缺失** | OMA 六视图：Usage（谁/何时/哪个应用在读）/ History / WIP 暂存 / 破坏性确认 / Cleanup 退役 / Export-Import | 后端有 branch/diff/rollback API 无 UI；无 usage 视图；无退役管理 | P1（与 GOV-16/17 配对） |
| G42 | **图可视化仅类型级** | 实例级探索（对象邻居、路径、Search Around 图形化）；Map 地理组件 | `OntologyGraphPage.tsx` 只画类型 schema 图；SAL-07 的 geojson/latlon 属性无地图组件 | P2 |
| G43 | **执行历史/审计 UI 空壳** | Action log / metrics / observability（近 30 天使用与监控） | 执行历史空态占位；`ont_action_audit` 表有数据无查询接口无 UI | P1（后端需补 1 个查询端点） |
| G44 | **无 Scenario 模拟 UI** | Workshop Scenario Manager widget + 多情景叠加图表 + Apply to Scenario 按钮 | 无（后端也无，见 G22） | P2（挂起，随 ACT-08 决策） |

---

## 4. 专项澄清：用户点名的"本体支持层级"

"层级"在本体语境下有**四种不同含义**，对位结论各不相同：

| 层级含义 | Palantir | Mate 现状 | 真实差距 |
|---|---|---|---|
| ① **类型继承**（is-a） | **明确不做**——四原则之四"组合优于深层次级"，深继承链被列为反模式；用 Interface 做多继承 | **已有** subclass 公理（R1 闭包）且 ONT-G21 注入查询 | 无差距，甚至是超集。**注意不要去建深继承** |
| ② **Interface 多态**（能力组合） | Interface 是一等查询/工作流目标：面向接口编程、新实现类型自动兼容 | `implements_interface` 校验存在；但查询源不支持 Interface rid、约束是占位串、工具注册表不感知 Interface | **真差距（G8 主体）**：声明了契约却无处消费 |
| ③ **实例层级**（组织树/BOM/父子件） | 用**自引用 LinkType** 建模（parent-child link）+ 传递属性遍历 | LinkType 支持自引用（src=dst 未禁止）；R3 传递闭包已有 | 小差距：两端命名（G15）+ 传递遍历 API 化（G26）+ 写入校验 |
| ④ **本体/命名空间层级**（多本体、共享本体） | shared ontologies + Marketplace 跨本体引用（不支持跨本体 link） | federation.py 联邦查询（legacy） | 方向不同；暂无共享本体需求，**建议不做** |

**结论**：层级的弥补方案 = **把 Interface 变成可查询的多态源 + ObjectType 加 parent_class 字段让 ①有管理面 + 自引用 link 的遍历与校验补齐**，而不是建深继承体系。

---

## 5. 优化方案 —— 6 波次 20 后端 Batch + 并行 UI 轨道 6 Batch

> 组织原则：**先表达力（引擎内核）→ 再事务模型（写路径正确性）→ 再 AI 消费（差异化价值）→ 后数据绑定/治理（依赖其他批次）**；**UI 轨道并行**，其中 UI-01 零后端依赖可立即开工。每 Batch 遵循项目提交顺序（ADR → contract → failing tests → feature → evidence）。

### Wave 0（并行 UI 轨道）：前端应用面 —— 用户价值最快兑现

| Batch | 内容 | 覆盖差距 | 关键设计 |
|---|---|---|---|
| **ONT-UI-01 对象浏览器 + 对象主页**（零后端依赖，可立即开工） | 新增"对象数据"tab：① 类型选择器 + 实例列表（`/individuals` 分页）+ 按属性过滤/排序（`/object-sets:evaluate`）；② 对象主页：属性卡 + **关联对象双向导航**（`/link-instances` 按 link type 分组）+ 一跳 Search Around 跳转；③ 顶部语义搜索框（`/object-search`，对象卡片直链对象主页） | G35, G36, G38 | 纯消费现有 API；Semi Table + 卡片布局对齐现有页面风格；Search Around = 对象主页上的关联对象区点击跳转（跨类型面包屑） |
| **ONT-UI-02 人工 Action 执行表单** | 对象主页/对象列表上的"执行 Action"入口：按 ActionType.parameters 动态渲染表单（必填/类型校验前端侧先行）→ 提交走 `propose → confirm → execute` 三步（人工发起默认自确认，复用 ProposalConfirmDrawer 展示 expected_diff） | G37 | 与 AI proposal 同一条 HITL 管道（审计不旁路）；后端仅需补"执行历史查询"端点（查 `ont_action_audit`，配合 UI-04） |
| **ONT-UI-03 概念模型升级**（配对 EXP-01/02/04 后端） | ① 领域列表 → 层级树（parent_class 渲染缩进树 + Interface 分组）；② Interface 管理页（列表 + 实现关系图 + 约束查看）；③ 属性编辑器 v2：struct/数组/派生/共享属性/render hints/描述字段 | G39, G40 | 等后端字段就绪后接；数据结构前后端契约走 `kernel.ts` 类型同步 |
| **ONT-UI-04 执行历史 + 治理面**（配对 GOV-16/17） | ① Action 执行历史列表（actor/时间/参数/结果/proposal 链接/副作用事件）；② 类型 Usage 视图（Reads/Writes/活跃用户）；③ 版本历史/branch/diff/rollback 操作面（后端 API 已有）；④ Cleanup 退役管理（Snooze/Deprecate/Delete + 使用量保护提示） | G41, G43 | 执行历史是 G43 后端补端点后的第一个消费者 |
| **ONT-UI-05 图与富属性可视化**（配对 SAL-07/EXP-04） | ① 实例级图：对象主页"图谱视图"（ego 图 + 邻居展开，逐步加载）；② geojson/latlon 属性渲染地图组件（Semi 无地图，评估 leaflet/deck.gl 轻量接入或先静态 GeoJSON 渲染）；③ timeseries 属性迷你图（sparkline） | G42 | 类型级 GraphPage 保留；实例图做独立轻量视图，不做通用图编辑器 |
| **ONT-UI-06 Scenario 模拟 UI**（挂起，随 D-Scenario 决策） | Workshop Scenario Manager 等价：多情景并排对比 + Apply to Scenario 开关 | G44 | 仅当后端 ACT-08 立项才做 |

### Wave 1：语义层表达力（P0 为主，纯内核改动，无外部依赖）

| Batch | 内容 | 覆盖差距 | 关键设计 |
|---|---|---|---|
| **ONT-EXP-01 层级与多态** | ① `ObjectType.parent_class: ClassRef \| None`（一等字段 + 环检测 + 管理面层级树 API）；② ObjectSet 查询源接受 Interface rid → 编译期展开为实现类型 UNION（复用 G21 的类集合展开机制）；③ Interface `required_links` / `polymorphic_action_constraints` 从占位串升级为结构化约束并在 LinkType 注册与 Action apply 时校验 | G8 | subclass 公理层保留（推理用），parent_class 成为声明式糖（自动生成 subclass 公理，单一事实源）；Interface 查询展开与 G21 共用 `descendant_closure` 基建 |
| **ONT-EXP-02 Property 体系** | ① struct 属性（嵌套 schema + `llmConfidence/llmReasoning/source` AI 元数据范式作为内置 struct 模板）；② 派生属性（`derived: DerivedSpec \| None`，v1 支持声明式聚合表达式：count/sum/avg over link；v2 function_ref）；③ 共享属性注册表（跨类型引用同一 Property 定义）；④ value-type 注册表 + type_id 校验；⑤ 数组属性 + reducer（first/latest） | G9-G12, G14 | 派生属性查询时计算（PG 端子查询 / 内存端后计算双执行器，对齐 ObjectSet 双 repo 形态）；安全语义：派生值继承源属性权限 |
| **ONT-EXP-03 Link 与遍历** | ① LinkType 两端独立命名（src_display_name/dst_display_name，双向可读）；② cardinality 写入强制校验（建 LinkInstance 时检查 1:1/1:N 约束）；③ 同类型对多 link / 自引用约束检查；④ searchAround API（一跳遍历端点 + 上限保护） | G15, G26 | 校验放 repo 层（PG 唯一索引/查询 + InMemory 双实现，硬规则 ⑦ 契约测试） |
| **ONT-EXP-04 元数据与描述** | ObjectType/Property/LinkType 补 description（必填门禁可选）、render_hints、status、type_groups | G16 | description 直接喂 `/agent-tools` 与 OAG 检索文本（AI 可导航性，调研材料 02 §命名："为人类可读性**和智能体可导航性**双优化"） |

### Wave 2：动能层事务模型（写路径正确性）

| Batch | 内容 | 覆盖差距 | 关键设计 |
|---|---|---|---|
| **ONT-ACT-05 声明式 edit-set** | Action 升级为：parameters + **声明式 edits 列表**（`set_property` / `create_object` / `delete_object` / `add_link` / `remove_link`，每条带 target 选择器）+ 可选 function_ref（function 返回 edits）；单事务原子提交；批量对象上限（v1 1000） | G18 | 现有 function_result 回写模式保留为兼容路径；edit-set 先 dry-run 生成 expected_diff（复用 proposal preview），提交时同一事务落库 |
| **ONT-ACT-06 校验体系** | ① 参数 schema 校验（必填/类型/范围/枚举）；② submission_criteria 从 mini-DSL 升级为结构化规则（复用 ObjectSet 的 Condition IR，支持 AND/OR 组合）；③ entry validation（编辑前置校验，如"目标对象状态必须为 X"） | G19 | SimpleRuleEvaluator 保留做兼容，新结构化规则并行；proposal preview 时预评估并展示"将违反的规则" |
| **ONT-ACT-07 副作用投递 + revert** | ① outbox 事件 → 通知通道（站内/邮件/webhook）绑定 + webhook 签名与重试；② Action 级逆编辑记录（edit-set 的反操作自动生成，revert 端点执行） | G20, G21 | 逆编辑 = edit-set 的代数逆（set_property 存旧值 / add_link ↔ remove_link / create ↔ delete）；proposal revert（已有）与 action revert 统一到一个补偿框架 |
| **ONT-ACT-08 Scenario 最小版** | 会话级本体状态 fork（内存 overlay repo：读穿透主库 + 写留在 overlay）+ merge-action（把 overlay 编辑作为单 edit-set 事务提交）+ TTL 清理 | G22 | Palantir 也是 Beta，故取最小集：**Temporary 形态**（会话内）优先，Persisted（情景即对象）看需求；rebase 简化为 merge 时冲突检测；overlay repo 实现 `OntologyRepository` 协议即可复用全部读路径 |

### Wave 3：AI 消费升级（差异化价值，工程依赖少）

| Batch | 内容 | 覆盖差距 | 关键设计 |
|---|---|---|---|
| **ONT-AI-09 向量检索生产化** | `ont_object_embedding.embedding` JSONB → **pgvector halfvec + HNSW**（对齐 tech-rag kb_chunks v3 迁移经验）；vector 成为一等 PropertyFormat + `nearestNeighbors` 查询算子进 ObjectSet IR；hybrid search（关键词+向量+RRF 融合）端点 | G13, G27 | embedding 写入路径复用现有 embedder 协议；HNSW 索引 DDL 幂等迁移（`CREATE TABLE IF NOT EXISTS` 自愈风格延续）；RRF 公式 `Σ[1/(k+r(d))]` 照调研材料 03 |
| **ONT-AI-10 chunk 对象管道** | 标准化"文档块即对象"：chunk ObjectType 模板 + chunk→sourceDoc LinkType + tech-rag kb_chunks 双向同步（或直读） | G28 | 溯源 = link 回源文档（Palantir 的关键设计）；与 mate-app-kb 的文档宇宙打通而非平行造 |
| **ONT-AI-11 工具面扩展 + 评估套件** | `/agent-tools` 增加 aggregate_* / traverse_* / propose_*（写工具带 HITL 标记）；评估题库 schema + 人机四象限对比跑批 | G29, G34 | 写工具必须走 propose（HITL 决策 B3 不破）；题库格式：三段式命题（情境→成因→影响）+ 结果四象限统计 |

### Wave 4：安全粒度（多租户敏感数据的前提）

| Batch | 内容 | 覆盖差距 | 关键设计 |
|---|---|---|---|
| **ONT-SEC-12 行列级策略** | object security policies（类型上配行过滤表达式，复用 Condition IR）+ property policies（列级 → 返回 null 而非报错）；**查询读时强制**（ObjectSet 编译器注入策略谓词；semantic search 结果过滤） | G5, G6 | 策略求值进 SQL 编译层（PG）与 InMemory 执行器双实现；与租户 RLS 叠加而非替代；marking 查询过滤先行（Individual.marking 已存） |
| **ONT-SEC-13 typed client（OSDK-lite）** | 从本体定义生成 Python 类型化客户端（dataclass + 类型安全查询构造器 + propose/confirm 流封装），发布到 `mate-clients/sdk/` | G24 | 生成器输入 = `/agent-tools` 的 schema（已有）+ 属性元数据；CI 门禁：schema 变更 → 客户端再生成（"改定义即改 API"） |

### Wave 5：数据平面绑定（最大工程，依赖 DATA 批次）

| Batch | 内容 | 覆盖差距 | 关键设计 |
|---|---|---|---|
| **ONT-DATA-14 数据源绑定 + 索引管道** | ObjectType 增加 `backing_datasources`；批量索引管道（dataset/表 → 对象同步，字段映射声明）；与用户编辑双流合并（edited overlay 语义） | G1, G4 | 本质是 Mate 版"Funnel"最小实现：定时/触发同步 + 主键映射 + upsert；先批后流；**建议与 DATA-D0-D8 CDC 批次联合立项** |
| **ONT-DATA-15 MDO + materialization** | 多数据源拼类型 + 字段级优先级；对象最新状态物化回流（outbox → dataset 视图） | G2, G3 | materialization = 订阅 ont_outbox_event 写回数据平面（下游管道可消费） |

### Wave 6：治理与规模化

| Batch | 内容 | 覆盖差距 |
|---|---|---|
| **ONT-GOV-16 使用量指标** | 读路径计数（Reads per type，middleware 埋点）+ Writes（action audit 已有）+ 活跃用户；per-type usage 端点 + 前端 | G30 |
| **ONT-GOV-17 变更门禁 + 退役** | 破坏性变更显式确认（type-the-name）；类型生命周期 Snooze/Deprecate/Delete + 使用保护（有读量的类型禁删） | G31, G33 |
| **ONT-GOV-18 反模式 lint** | 8 大反模式自动化检查（God Object：常 null 属性率；Kitchen Sink：技术列模式；Action Sprawl：单类型 Action>10；Time Machine：版本建对象模式检测……）挂 CI | G32 |
| **ONT-GOV-19 时序与多值存储** | TIMESERIES 背后真 series store（PG 时序表或复用 metrics 栈）+ 时间窗口查询算子 | G17 |

（G7 scoped session / G25 WebSocket 订阅 / G31 部分 / 共享本体：**挂起不做**，见 §6。）

### 依赖图与建议节奏

```
Wave0 ONT-UI-01（零依赖，立即可做）→ UI-02（小后端补点）→ UI-04/05（随治理/富属性）
Wave1 ONT-EXP-01→02→03→04（纯内核，无外部依赖）─┬→ UI-03 概念模型升级
Wave2 ONT-ACT-05→06→07→08（依赖 EXP-01 约束、EXP-02 参数 schema）→ UI-02 深化
Wave3 ONT-AI-09→10→11（09 独立；10 依赖 09；11 依赖 ACT-05）→ UI-01 语义搜索深化
Wave4 ONT-SEC-12/13（12 依赖 EXP-02 Condition IR；13 依赖 EXP-04）→ UI-04 治理面
Wave5 ONT-DATA-14→15（D1 已拍板全量纳入；复用 mate-tech-etl/CDC 栈，排 Wave 1-4 后）
Wave6 GOV-16~19（随时可插，互相独立）→ UI-04
```

**推荐第一波 = Wave 1（后端表达力）+ ONT-UI-01（对象浏览器）并行**：
- Wave 1 四个 Batch 全是 `mate-kernel` + `v2_kernel` 内核改动，不动部署拓扑、不等数据栈，直接回应"层级/表达力"痛点；
- ONT-UI-01 零后端依赖（API 全部现成），是**用户可见价值最大、交付最快**的一件，且为后续所有 UI Batch 铺路（对象主页是 Action 表单/图视图/Scenario 的宿主）。
- 二者无文件交集（kernel/pg_repo vs metaplatform-frontend），可双线推进。

---

## 6. 明确不做（Anti-scope）

1. **不引入 Palantir 任何开源组件**（自建原则 v0.4 锁死，ADR-0021）。
2. **不建深类型继承体系**（Palantir 反模式 + 我们已有 subclass 公理；parent_class 只做浅层声明）。
3. **不做共享本体/跨本体 link**（Palantir 也不支持跨本体 link；federation.py legacy 保留）。
4. **不追 OSv2 规模指标**（数百亿对象/2000 属性上限——我们 PG 单租户规模远不需要）。
5. **Scenario 只做 Temporary 最小版**（Palantir 自身 Beta；Persisted 形态等真实需求）。
6. **G7 scoped session 挂起**（无 GDPR/HIPAA 合规场景前不做）。
7. **不做通用无代码应用搭建器（Workshop 等价）**——UI 轨道只做本体**直接消费面**（对象浏览器/对象主页/Action 表单/治理视图），不做 Layouts+Events 通用应用搭建平台；render hints 元数据留给未来第三方应用消费。
8. **不删 legacy 路径**（OWL/SPARQL/SHACL/Neo4j repo——13 硬规则 #5 的 fallback 纪律；仅在 production profile 拒载）。
9. **UI 技术栈不换**——继续 Semi Design + 现有 shell/路由/`kernel.ts` 客户端模式（2026-08-13 全量迁移刚收口）；地图组件按最小侵入评估，不引入重型可视化框架。

---

## 7. 决策点 —— 已全部拍板（2026-09-10）

| # | 决策 | 结论 | 影响 |
|---|---|---|---|
| D1 | Wave 5 数据平面绑定是否纳入本轮 | ✅ **全量纳入本轮**（ONT-DATA-14/15 转正式 Batch，排在 Wave 1-4 之后执行；本体的"数字孪生"定位本轮兑现） | 总 Batch 数 26；Wave 5 设计基线：复用 `mate-tech-etl` / `debezium_engine.py`（blueprint 敏感区 #18-19）与数据中心 UI 已有的 CDC/ETL/数据源视图，本体侧补 backing_datasources 声明 + 索引管道 + 双流合并 |
| D2 | Interface 多态 vs subclass 层级主次 | ✅ **Interface 一等 + parent_class 浅声明**（Interface 可作查询源；parent_class 限 1 层，自动生成 subclass 公理，单一事实源） | EXP-01 设计基线锁定；UI-03 层级树按"1 层 parent + Interface 分组"渲染 |
| D3+D7 | 写路径 HITL 政策 | ✅ **AI 发起强制显式确认；人工表单发起"预览即确认"一步式**（expected_diff 展示 + 确认按钮，同一条 propose→confirm→execute 管道，审计不旁路） | ACT-05 edit-set 与 UI-02 Action 表单的交互基线锁定；B3 决策（每次 ≥1 HITL）对 AI 路径保持不变 |
| D4 | 派生属性 v1 形态 | ✅ 声明式聚合先行（count/sum/avg over link 三算子）；function_ref 进 v2（查询进沙箱成本高，需缓存） | EXP-02 范围锁定 |
| D5 | embedder 供给 | ✅ 接 llmgw（复用平台 LLM Gateway + ARK embedding 通道）；HashEmbedder 留离线兜底；废弃 object_search.py 独立 OPENAI_* env 直连 | AI-09 设计基线锁定 |
| D6 | UI 轨道首件 | ✅ **ONT-UI-01（对象浏览器 + 对象主页）**；首发组合 = Wave 1（EXP-01~04）+ UI-01 双线并行（零文件交集） | 执行顺序锁定 |

**执行顺序（决策后定稿）**：

```
第 1 步（并行双线）：Wave 1 EXP-01→02→03→04（内核表达力） ‖ ONT-UI-01 对象浏览器+对象主页
第 2 步：Wave 2 ACT-05→06→07→08（动能事务模型） + UI-02 Action 表单
第 3 步：Wave 3 AI-09→10→11（向量检索/chunk/工具面）
第 4 步：Wave 4 SEC-12/13（行列安全/typed client） + UI-04 治理面
第 5 步：Wave 5 DATA-14→15（数据平面绑定，D1 已确认全量纳入）
第 6 步：Wave 6 GOV-16~19（治理，可穿插） + UI-03/05 随对应后端就绪
挂起：G7 scoped session / G25 WebSocket / G44 Scenario UI / G23 Function 工程
```

---

## 8. 差距 → 方案 全量对位表（速查）

| 差距 | 波次/Batch | 差距 | 波次/Batch |
|---|---|---|---|
| G1-G4 数据绑定 | W5 / DATA-14~15 | G18 edit-set | W2 / ACT-05 |
| G5-G6 行列安全 | W4 / SEC-12 | G19 校验 | W2 / ACT-06 |
| G7 scoped session | 挂起 | G20 副作用 | W2 / ACT-07 |
| G8 层级/多态 | W1 / EXP-01 | G21 revert | W2 / ACT-07 |
| G9-G12 属性体系 | W1 / EXP-02 | G22 Scenario | W2 / ACT-08 |
| G13 vector 属性 | W3 / AI-09 | G23 Function 工程 | 挂起（SAL-03 已有执行面） |
| G14 值类型 | W1 / EXP-02 | G24 typed client | W4 / SEC-13 |
| G15 Link 语义 | W1 / EXP-03 | G25 WebSocket | 挂起 |
| G16 元数据 | W1 / EXP-04 | G26 searchAround | W1 / EXP-03 |
| G17 时序 | W6 / GOV-19 | G27 检索生产化 | W3 / AI-09 |
| G28 chunk 管道 | W3 / AI-10 | G29 工具面 | W3 / AI-11 |
| G30 使用量 | W6 / GOV-16 | G31 退役 | W6 / GOV-17 |
| G32 lint | W6 / GOV-18 | G33 门禁 | W6 / GOV-17 |
| G34 评估套件 | W3 / AI-11 | G35 对象浏览器 | W0 / UI-01 |
| G36 对象主页 | W0 / UI-01 | G37 Action 表单 | W0 / UI-02 |
| G38 语义搜索 UI | W0 / UI-01 | G39 层级/Interface UI | W0 / UI-03 |
| G40 属性编辑器 | W0 / UI-03 | G41 治理面 | W0 / UI-04 |
| G42 图/富属性可视化 | W0 / UI-05 | G43 执行历史 | W0 / UI-04 |
| G44 Scenario UI | 挂起（随 D-Scenario） | | |
