# ADR-0079：Axiom 校验的批量加载与版本化缓存

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ADR-0070（Axiom 运行时违规检查）、ONT-QUERY-SEMANTICS（ADR-0077 §5）

## 1. 背景

`v2_kernel/axiom_validation.py`（ADR-0070）的 Core 三条规则在实现上逐条回源：

```python
def _class_chain(repo, rid):
    while cur and cur not in seen:
        ot = repo.get_object_type(ClassRef(cur))   # ← 每级父类一次查询
        cur = ot.parent_class.rid ...
```

- `_scoped_individuals(...)` 对**每个实例**调 `_class_chain`；
- `_check_disjoint` 又对**每个实例**再调一次 `_class_chain`；
- 每条规则各自 `repo.list_individuals(None, tenant)` **全量扫一遍**。

⇒ N 实例 × 类链深度 D = **O(N·D)** 次查询（外加每条规则一次全表）。租户实例上千、
层级三四级时，一次校验就是数千次往返；且**没有任何缓存**。

## 2. 决策

### 2.1 每轮只加载一次模型与实例

`validate_axioms` 开头各取一次：`repo.list_axioms()`、`repo.list_object_types()`、
`repo.list_individuals(None, tenant)`，**所有公理/规则共用**。

### 2.2 类链一次建成映射（实例侧 O(1)）

`_ModelIndex.chain_of: dict[class_rid, frozenset[祖先链(含自身)]]` —— 沿 `parent_class`
一次遍历全部类型建成（带环保护）。未注册类退化为 `{自身}`，与旧 `_class_chain`
（`get_object_type` KeyError 即 break，仍含自身）**语义一致**。

### 2.3 缓存随**模型内容指纹**失效

```python
version = sha256(sorted((type.rid, type.parent_class)) + sorted(enabled subclass axioms))
_CACHE[tenant] = _ModelIndex(chain_of=..., version=version)   # 指纹不一致即重建
```

用**内容指纹**而非时钟：类型/公理一变指纹就变，无需 TTL，也不怕同一秒内的多次修改；
模型未变时投影对象**按引用复用**（用例断言 `is` 同一对象）。

### 2.4 规则签名改为纯函数

三个规则从 `(repo, tenant, ax, target_class)` 改为
`(individuals, index, ax, target_class)` —— 规则内**不再触碰 repo**（无法再回源）。

## 3. 不做的

- 不改返回结构与 HTTP 语义（`{conforms, violations, stats}` 不变）—— ADR-0070 契约不动。
- 不做跨租户共享缓存（缓存按租户键控）。
- 类链仍沿 `parent_class`（与旧实现一致）；不改为按公理闭包（避免语义漂移）。

## 4. 实施与验证

- **实现**：`axiom_validation.py` 重写（`_ModelIndex` / `_model_version` / `_build_chain_map`
  / `_model_index` + 三个纯函数规则）。
- **测试**：`tests/integration/test_ont_axiom_validation_batching.py`（4 项）：
  ① **语句数与实例数无关**（30 vs 60 实例 → 同为 **3 条** SQL，`≤ 6` 护栏）；
  ② 模型未变 → 投影对象按引用复用；③ 模型变更 → 版本指纹变化（缓存失效）；
  ④ 类链查表仍正确驱动 violation（leaf⊑mid⊑base + disjoint(mid,base) 命中）。
- **回归**：`tests/test_axiom_validation.py`（16 项，含 6 项 HTTP）全绿。

## 5. 已知边界

1. 缓存是**进程内**字典（多副本各自一份；内容指纹保证一致，纯读路径无一致性风险）。
2. 每轮仍各取一次类型/公理/实例（3 条语句）—— 未做跨请求的模型缓存
   （那需要更细的失效协议，收益小于风险）。
3. 类链按 `parent_class`，不看禁用公理（与旧实现一致）。
