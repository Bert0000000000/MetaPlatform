# ONT-QUERY-SEMANTICS §5 验收证据（Axiom 校验批量加载 + 版本化缓存）

> **批次**：ONT-QUERY-SEMANTICS §5（Axiom 校验的查询放大收口）
> **日期**：2026-09-23
> **分支**：`feat/ont-axiom-validation-batching`（基于 `origin/main@9b6e06b1`）
> **决策**：ADR-0079（`docs/active/decisions/ADR-0079-axiom-validation-batching.md`）
> **operationIds**：`ontValidateV2Axioms`（ADR-0070，**契约与响应结构不变**）
> **Requirement ID**：`FR-QUERY-SEMANTICS-AXIOM-BATCH`

## 1. 问题与根因（实测）

`axiom_validation.py` 的类链逐级回源、且**逐实例**调用：

```python
def _class_chain(repo, rid):
    while cur and cur not in seen:
        ot = repo.get_object_type(ClassRef(cur))   # 每级父类一次查询
```

- `_scoped_individuals` 对**每个实例**调一次；
- `_check_disjoint` 又对**每个实例**再调一次；
- 每条规则各自 `list_individuals(None, tenant)` **全量扫**。

⇒ **O(N 实例 × D 深度)** 次查询 + 每规则一次全表；无任何缓存。

## 2. 改动摘要与文件清单

**新增**：

| 文件 | 职责 |
| --- | --- |
| `mate-tech-ont/tests/integration/test_ont_axiom_validation_batching.py` | 4 项：语句数常量级 / 缓存复用 / **模型变更即失效** / 类链驱动 violation |
| `docs/active/decisions/ADR-0079-axiom-validation-batching.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-QUERY-SEMANTICS-AXIOM-BATCH-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `v2_kernel/axiom_validation.py` | 重写：`_ModelIndex`（类→祖先链映射）+ `_model_version`（**模型内容指纹**）+ `_model_index`（按 (租户, 指纹) 缓存）；三条规则改为纯函数 `(individuals, index, ax, target_class)`；模型/实例每轮各加载一次 |

## 3. 实现要点与安全

- **每轮一次**：`list_axioms` / `list_object_types` / `list_individuals` 各一次，所有公理共用。
- **类链查表**：实例侧 O(1) 字典查；未注册类退化为 `{自身}` —— 与旧 `_class_chain` 语义一致。
- **失效靠内容指纹**（非时钟/TTL）：`sha256(类型(rid,parent) + 启用公理(kind,operands))`；
  模型一变指纹即变，同秒内多次修改也不会漏失效。模型未变时投影**按引用复用**。
- **规则不再触碰 repo**：纯函数签名让"逐实例回源"在结构上不可能复活。
- 响应结构与 HTTP 语义**不变**（`{conforms, violations, stats}`）。

## 4. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pytest .../integration/test_ont_axiom_validation_batching.py -q` | **4 passed** |
| 其中：语句数与实例数无关 | **30 实例 = 3 条 SQL；60 实例 = 3 条 SQL**（`≤ 6` 护栏） |
| `pytest .../tests/test_axiom_validation.py -q` | **16 passed**（含 6 项 HTTP；语义零回归） |
| `pytest packages/mate-tech-ont/tests -q` | **见 §4.1** |
| `ruff check` + `format` | ✅ 净 |

### 4.1 全量 ont 套件

> **`pytest packages/mate-tech-ont/tests -q` → 543 passed / 0 failed / 0 skipped**（102.32s；
> 基线 539 + 本批新增 4）。

## 5. 已知边界

1. 缓存是**进程内**（多副本各一份；内容指纹保证一致，纯读路径无一致性风险）。
2. 每轮仍各取一次类型/公理/实例（3 条语句）；未做跨请求的模型缓存。
3. 类链按 `parent_class`（与旧实现一致），不看禁用公理。
4. **回滚**：`git revert` 本批提交即退回（纯 Python，无契约/迁移变更）。

## 6. 结论

**准出达成**：Axiom 校验的查询放大从 **O(N·D)** 降到**常量级 3 条语句**（30/60 实例同值），
且缓存**随模型内容指纹自动失效**；违规判定语义与 HTTP 行为零回归。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | ✅ 未改路径/契约（响应结构不变） |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ `FR-QUERY-SEMANTICS-AXIOM-BATCH`（本文件 §头部） |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ 实例经 `list_individuals(None, tenant_id)`；公理按 rid 租户前缀过滤；缓存按租户键控 |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 无外部调用 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ 模型/实例加载失败即抛出（不静默返回 conforms） |
| ga-006-static | 6 静态检查失败不合并 | ✅ `ruff check`/`format` 净 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ 4 + 16 项全真跑（PG 可达，0 skip） |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 无 K8s 改动；回滚见 §5.4 |
| ga-009-otel | 9 没有审计、指标、trace | N/A 纯计算路径；沿用既有 OTel 中间件 |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ 无 secret 入 diff |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
