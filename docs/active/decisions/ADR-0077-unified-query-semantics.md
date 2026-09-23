# ADR-0077：统一查询语义（源类解析单一实现 · 稳定排序 · 分页与字段校验）

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ADR-0021（Kernel 12 基元）、ADR-0043（ObjectSet IR）、EXP-01（层级/Interface）、
  ONT-G21（子类闭包对查询可见）、ADR-0070（Axiom 校验）

## 1. 背景

"查询源类集合"这一件事在代码里被写了**四份**，语义彼此不同，导致**同一组语义参数
在不同入口给出不同结果**（Agent 工具走 IR 路径，用户浏览器走浏览路径）：

| 入口 | Interface 源 | 具体 ObjectType 源 | 排序 |
| --- | --- | --- | --- |
| `list_individuals`（浏览/对象浏览器） | 实现类型 + 后代（**parent_class** 闭包） | **仅自身** | `rid` |
| `evaluate_object_set`（legacy ObjectSet DSL） | 实现类型 + 后代（**公理**闭包） | 自身 + 后代（公理闭包） | **只认第一个键** |
| `execute_object_query`（ObjectSet IR / Agent） | **仅实现类型**（无后代） | **仅自身** | 多键，**无稳定决胜键** |
| `InMemory._list_source_allowed`（dev 浏览） | 调用**不存在**的 `_allowed_source_set` → `AttributeError` | 仅自身 | — |

已被测试钉死的**应然**语义（`test_ont_g21_closure_objectset.py` /
`test_ont_exp01_hierarchy_polymorphism.py`）：

- 祖先查询命中全部后代（`test_ancestor_query_hits_all_descendants`）；
- 叶子精确（`test_leaf_query_exact_only`）；
- **公理被禁用 → 退回精确**（`test_disabled_axiom_falls_back_to_exact`）；
- Interface 源 → 实现类型 + 后代（`test_interface_source_with_descendants`）。

也就是说：**legacy 路径是对的，IR 与浏览路径是错的**，而 InMemory 的浏览路径是坏的。

## 2. 决策

### 2.1 单一语义实现（不复刻第二份）

新增 **`mate_kernel/objectset/source_resolution.py`**，把规则写成**一个纯函数**
`resolve_source_classes(source_rid, *, object_types, interface_rids, subclass_pairs)`，
两个 repo 各自只负责"把自己的数据取出来喂进去"：

- PG：`PgOntologyRepository._resolve_source_classes`（类型/接口/公理**一次性批量取**）；
- InMemory：`_expand_source_classes` 变成薄调用；浏览路径改用它，
  删除坏掉的 `_list_source_allowed`。

**规则（唯一出处）**：

| 情形 | 结果 |
| --- | --- |
| Interface 源（有实现） | 实现类型 + **各自后代闭包** |
| Interface 源（无实现） | **空集**（恒空结果，绝不退化成"不过滤"） |
| ObjectType 源 | 自身 + **后代闭包**（沿**启用**的 subclass 公理） |
| 未注册源 | 仅自身（精确；legacy 宽容） |
| 公理被禁用 | 该边不参与闭包 → 自然退回精确（G21） |

公理 operand 历史上有 **rid / slug 两种写法**，统一在 `canonicalize_subclass_pairs`
归一为完整 rid 再求闭包（否则跨写法的传递链连不起来）。

### 2.2 排序：多键 + **稳定决胜键**

新增 `PgOntologyRepository._order_by_sql(keys, slug_to_rid, rid_type)`，
`execute_object_query` 与 `evaluate_object_set` 共用：多键、slug 归一、
未知字段**显式报错**、JSONB 键白名单、数值 `::numeric` 其余 `::text`，
**末尾恒加 `rid`** —— 同键值集的分页顺序唯一（此前 IR 无 sort 时甚至不带 `ORDER BY`）。
浏览路径固定 `ORDER BY class_rid, rid`。

### 2.3 分页与字段校验显式化

`ObjectSetQuery`/`ObjectSet` 的 `paging_limit ∈ [1, 10000]`、`offset ≥ 0`（已有，本批补测试）；
排序/过滤字段必须可解析（`_require_resolvable_field`），未知字段报错而非静默回落。

### 2.4 null 语义显式化

`ASC → NULLS LAST`、`DESC → NULLS FIRST`（PG 默认），与 InMemory `_sort_rank`
（None 恒为最低档）一致 —— 由跨引擎对照用例钉死。

### 2.5 契约变更（有意差异 → 归一，显式记录）

**变更**：浏览路径（`list_individuals` / `GET /individuals?class_rid=`）对**具体
ObjectType** 过去只做**精确匹配**（`test_object_type_listing_stays_exact_match`
明确写"PLANT 不含其子类 C1（既有行为不变）"），而查询路径（ObjectSet/Agent）
按 G21 闭包**含后代**。本批把两者**统一为闭包语义**（父子类规则一处定义）。

**为什么**：目标要求"同一语义参数得到相同结果"，且验收要求"两种查询入口结果对照"；
两条路径对同一 `class_rid` 给出不同对象集正是本批要消灭的分叉。该差异此前是
「只改了 Interface 那一半」的**兼容性残留**（`list_individuals` 自身注释即写
"与 ObjectSet/IR 查询路径同语义"），并非有意的产品语义。

**影响与保障**：`test_v2_kernel_interface_query.py` 的该断言随之更新为
`test_object_type_listing_follows_subclass_closure`（PLANT → [C1, P1]；叶子仍精确）。
**叶子类型、Interface 无实现、未注册源**三种情形行为不变。

## 3. 不做的

- **不改浏览路径的入参形态**（不加 filters/sort 到 `/individuals`）：目标 §6 要求
  "逐步共用 ObjectSet 输入、不重构导航"，本批先统一**语义**，入口形态演进留待后续。
- 不动 Agent 工具（`copilot/ontology_tools.py`）的调用面 —— 它走
  `execute_object_query`，**自动继承**统一语义。
- 不改 `list_individuals` 的返回类型（仍 `list[Individual]`）。

## 4. 实施与验证

- **实现**：`source_resolution.py`（新增）、`in_memory.py`（薄调用 + 修浏览路径）、
  `pg_repo.py`（`_resolve_source_classes` / `_order_by_sql` + 三处接线）。
- **测试**：`tests/integration/test_ont_query_semantics_unified.py`（13 项）：
  源类矩阵（父/中/叶/Interface/未注册/无实现类型/禁用公理）× **三入口对照**；
  多键排序、null 跨引擎对照、稳定分页无重无缺；分页与字段校验；聚合跨引擎对照；
  SQL 语句数与延迟记录。
- **回归**：`test_ont_g21_closure_objectset` / `test_ont_exp01_hierarchy_polymorphism` /
  `test_objectset_parity` / `test_ont_g12_g13_query_semantics` 全绿。

## 5. 已知边界

1. 三个入口的**共同语义面是"对象集合（rid 集合）"**；浏览仍无 filters/sort（§3）。
2. `_resolve_source_classes` 每次查询都重读类型/接口/公理（批量，但未缓存）；
   版本化缓存属下一批（Axiom 校验批量加载/缓存同批）。
3. 遍历（traversal）后的最终类集合取 LinkType 声明，不递归展开后代（既有行为）。
