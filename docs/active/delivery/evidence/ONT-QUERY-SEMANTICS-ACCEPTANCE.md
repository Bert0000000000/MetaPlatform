# ONT-QUERY-SEMANTICS 验收证据（统一查询语义：源类解析 / 排序 / 分页）

> **批次**：ONT-QUERY-SEMANTICS（浏览 / ObjectSet / Agent 三入口语义归一）
> **日期**：2026-09-23
> **分支**：`feat/ont-query-semantics`（基于 `origin/main@9b6e06b1`）
> **决策**：ADR-0077（`docs/active/decisions/ADR-0077-unified-query-semantics.md`）
> **operationIds**：`ontQueryV2ObjectSet` / `ontEvaluateV2ObjectSet` / `ontListV2Individuals`（路径未变）
> **Requirement ID**：`FR-ONT-QUERY-SEMANTICS`

## 1. 问题与根因（实测）

"查询源类集合"被写了**四份**，语义互不相同 —— 同一组语义参数在不同入口结果不同
（Agent 工具走 IR；用户浏览器走浏览路径）：

| 入口 | Interface 源 | 具体 ObjectType 源 | 排序 |
| --- | --- | --- | --- |
| `list_individuals`（浏览） | 实现类型 + 后代（**parent_class** 闭包） | **仅自身** | `rid` |
| `evaluate_object_set`（legacy DSL） | 实现类型 + 后代（**公理**闭包） | 自身 + 后代（公理闭包） | **只认第一个键** |
| `execute_object_query`（IR / Agent） | **仅实现类型**（无后代） | **仅自身** | 多键，**无稳定决胜键** |
| `InMemory._list_source_allowed`（dev 浏览） | 调**不存在**的 `_allowed_source_set` → `AttributeError` | 仅自身 | — |

已被测试钉死的**应然**语义（`test_ont_g21_closure_objectset.py` /
`test_ont_exp01_hierarchy_polymorphism.py`）：祖先命中全部后代 / 叶子精确 /
**公理禁用退回精确** / Interface → 实现类型 + 后代。即：**legacy 是对的，IR 与浏览是错的，
InMemory 浏览是坏的**。

## 2. 改动摘要与文件清单

**新增**：

| 文件 | 职责 |
| --- | --- |
| `mate-kernel/src/mate_kernel/objectset/source_resolution.py` | **唯一语义实现**：`resolve_source_classes` + `canonicalize_subclass_pairs`（rid/slug 归一） |
| `mate-tech-ont/tests/integration/test_ont_query_semantics_unified.py` | 13 项：源类矩阵 × 三入口对照 / 排序 / null / 分页 / 聚合 / SQL 次数与延迟 |
| `docs/active/decisions/ADR-0077-unified-query-semantics.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-QUERY-SEMANTICS-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `v2_kernel/pg_repo.py` | 新增 `_resolve_source_classes`（类型/接口/公理**一次性批量取**）与 `_order_by_sql`（多键 + **rid 稳定决胜键**）；`list_individuals` / `evaluate_object_set` / `execute_object_query` **三处接线**；删除各自一份的分叉实现（含 `_list_source_allowed`） |
| `mate-kernel/ontology/in_memory.py` | `_expand_source_classes` 变薄调用；浏览路径改用它（并删除调用不存在方法的 `_list_source_allowed`） |

## 3. 统一后的语义（唯一出处 = `source_resolution.py`）

| 情形 | 结果 |
| --- | --- |
| Interface 源（有实现） | 实现类型 + **各自后代闭包** |
| Interface 源（无实现） | **空集**（恒空，不退化成"不过滤"） |
| ObjectType 源 | 自身 + **后代闭包**（沿**启用** subclass 公理） |
| 未注册源 | 仅自身（精确） |
| 公理被禁用 | 退回精确（G21） |

排序：多键 + `slug→rid` 归一 + 未知字段**显式报错** + JSONB 键白名单 + 数值 `::numeric`，
**末尾恒加 `rid`**；浏览固定 `ORDER BY class_rid, rid`。
null 序：`ASC → NULLS LAST` / `DESC → NULLS FIRST`（与 InMemory `_sort_rank` 一致）。
分页：`limit ∈ [1, 10000]`、`offset ≥ 0`（并补测试）。

## 4. 测试命令与真实结果（2026-09-23 实测，真库）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pytest .../integration/test_ont_query_semantics_unified.py -q` | **13 passed** |
| 其中：源类矩阵 × **三入口对照**（父/中/叶/Interface/未注册/无实现类型/禁用公理） | 全部一致 |
| 其中：null 跨引擎对照、多键排序、分页无重无缺、聚合跨引擎对照、分页/字段校验 | 全部通过 |
| `pytest test_ont_g21_closure_objectset.py test_ont_exp01_hierarchy_polymorphism.py test_objectset_parity.py test_ont_g12_g13_query_semantics.py -q` | **27 passed**（既有语义零回归） |
| `pytest packages/mate-tech-ont/tests -q` | **见 §4.1** |
| `ruff check` + `ruff format`（改动文件） | ✅ 净 |

**SQL 次数与延迟**（5 实例矩阵，语句计数包裹 `_cursor`）：

```text
[QSEM] browse SQL=4  ir SQL=6  合计耗时=119.3ms
```

→ 两入口都是**常量级**语句数（批量取类型/接口/公理 + 一条数据查询），**不随实例数放大**；
回归护栏断言 `browse ≤ 6`、`ir ≤ 8`（防"逐行回查"退化）。

### 4.1 全量 ont 套件

> **`pytest packages/mate-tech-ont/tests -q` → 552 passed / 0 failed / 0 skipped**（105.14s；
> 基线 539 + 本批新增 13）。首次跑出的唯一红是
> `test_object_type_listing_stays_exact_match`（浏览对具体类型"精确匹配"的旧契约），
> 已按统一语义更新为 `test_object_type_listing_follows_subclass_closure`
> 并在 ADR-0077 §2.5 显式登记该**契约变更**。

## 5. 目标 §6（浏览 / 分析 / 地图共用 ObjectSet 输入）的落实状态

| 入口 | 数据源 | 本批后与 ObjectSet 的关系 |
| --- | --- | --- |
| **分析**（`AnalysisPage`） | `getObjectQueryAggregation` → `POST /v2/object-sets/query` | **已共用 ObjectSet 输入**（既有） |
| **地图**（`MapPage`） | `getObjectQueryRows` → `POST /v2/object-sets/query` | **已共用 ObjectSet 输入**（既有） |
| **对象浏览器**（`ObjectExplorerPage`） | `listIndividuals({classRid,limit,offset})` | 入口仍是浏览端点，但**源类解析已与 ObjectSet 同一实现**（本批核心） |
| 导航 / 路由 | `routes/ontology.tsx`、`OntologyTabLayout` | **未改动**（目标明确要求不重构导航） |

即：分析与地图本来就走 ObjectSet；本批把**浏览**的源类语义（子类/Interface 闭包）
统一到同一实现，三者对"同一 `class_rid` 查什么"给出**一致**结果。浏览入口**参数面**
（filters/sort 直接走 ObjectSet）属"逐步"的下一步，未在本批强行改造（避免动导航与入口形态）。

## 6. 已知边界

1. 三入口的**共同语义面是"对象集合（rid 集合）"**；浏览入口仍无 filters/sort
   （参数面收敛见 §5 末行，属后续批次）。
2. `_resolve_source_classes` 每次查询重读类型/接口/公理（批量，但**未缓存**）；
   版本化缓存与 Axiom 校验批量加载见 PR #91（目标 §5）。
3. 遍历（traversal）后的最终类集合取 LinkType 声明，**不递归展开后代**（既有行为，未变）。
4. 关系实例的服务端过滤/分页（目标 §3）见 PR #90。
5. **回滚**：`git revert` 本批提交即退回（纯 Python，无迁移/契约变更）。

## 7. 结论

**准出达成**：源类解析、排序、null、分页规则**一处定义、三入口一致**；
原本四处互不相同的实现收敛为一个纯函数 + 两个薄适配；
`InMemory` 浏览路径的坏调用一并修复。以 13 项用例（含三入口逐项对照与 SQL 预算）钉死。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | ✅ 未改路径/契约（仅语义归一） |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ `FR-ONT-QUERY-SEMANTICS`（本文件 §头部） |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ 解析取数经 `tenant_scope`；公理按源 rid 的租户段过滤；测试用专用租户 `qsem` |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 无外部调用 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ 未知排序字段**报错**而非静默回落；无实现类型的 Interface 返回**空集**而非"不过滤" |
| ga-006-static | 6 静态检查失败不合并 | ✅ `ruff check`/`format` 净 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ 13 项全真跑（PG 可达，0 skip） |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 无 K8s 改动；回滚见 §5.5 |
| ga-009-otel | 9 没有审计、指标、trace | N/A 纯查询语义；沿用既有 OTel 中间件 |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ 无 secret 入 diff |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
**commit**：`31e14444`（源类解析统一 + 稳定排序）、`1132cce8`（13 项对照测试）、`0dbb19e0`（ADR-0077 + 本证据）、`f8b47c52`（§6 落实状态）——PR #89。
