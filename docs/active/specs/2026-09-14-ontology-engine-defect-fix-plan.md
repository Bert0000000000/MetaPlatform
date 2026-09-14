# 本体引擎缺陷修复工作计划（P1–P3）

> **日期**：2026-09-14
> **来源**：`docs/active/specs/2026-09-14-ontology-data-validation-report.md` §8 建议
> **范围**：5 个缺陷（F1–F6，其中 F3/F6 同源）
> **总量**：约 6–8 人日
> **提交顺序**：遵循 CLAUDE.md 强约束 —— `docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence`

---

## 0. 总览

| ID | 优先 | 缺陷 | 根因位置 | 修复面 | 工时 | 风险 |
|---|---|---|---|---|---|---|
| **F3+F6** | **P1** | LinkInstance 同 rid 重放被基数校验误判 → 500 | `pg_repo.py:2137` | 后端 1 行 + 异常映射 + 测试 | 0.5d | 低 |
| **F2** | P1 | propose 把 `provenance` 并入 parameters，execute 报 unknown parameter | `pg_repo.py:4201-4205` + `api.py:3096-3104` | 后端参数清洗 | 0.5d | 低 |
| **F4** | P1 | `filter_expr` 用 slug 静默返回 0 行（后端语义漂移） | `sql_compiler.py:30-37` | 字段归一化 + fail-fast | 1d | 中 |
| **F5** | P2 | embedding 401 拖累每次写入 ~700ms（HTTP 路径 24× 慢） | `object_search.py:145-156` + `pg_repo.py:2058` | 配置修复 + 异步化 | 0.5–2d | 中 |
| **F1** | P2 | 部署态 Function 源码不可注入，apply 不执行逻辑 | `pg_repo.py:55,58,2383` · `main.py:80` | resolver 实现 + 接线 + ADR | 3–5d | **高** |

> **排序说明**：上表按"严重度"排（F1 是功能缺口故列 P1/P2 之间）。**执行顺序见 §3**——按"确定性优先、架构性最后"排。

---

## 1. F3 + F6 · LinkInstance 重放误判（P1，0.5d）

### 根因

`pg_repo.create_link_instance` 调用基数校验时**未传** `exclude_rid`：

```python
# pg_repo.py:2137
self._check_link_cardinality(row["link_type_rid"], row["src"], row["dst"])
```

而 `_check_link_cardinality`（`pg_repo.py:2186`）**已支持**该参数，SQL 里就是 `rid != %s`；同一函数的 INSERT 也明写 `ON CONFLICT (rid) DO UPDATE`（upsert 语义）：

```python
# pg_repo.py:2146-2152
ON CONFLICT (rid) DO UPDATE SET link_type_rid = EXCLUDED.link_type_rid, ...
```

结果：**重放同一条 LinkInstance 被判为"src already links to another dst"**。对比 `in_memory.py:660-683` 的实现，那里正确排除了同 rid（`x.rid != li.rid`）——**两后端语义不一致**。

F6 是同源暴露面：`api.py:4603` 的 handler 未捕获 `ValueError`，异常直接冒泡成 **HTTP 500**（应为 409 或幂等 200）。

### 修复

1. `pg_repo.py:2137` → 传 `exclude_rid=row["rid"]`：
   ```python
   self._check_link_cardinality(row["link_type_rid"], row["src"], row["dst"], exclude_rid=row["rid"])
   ```
2. `api.py` `create_link_instance` handler 加异常映射：`ValueError`（基数违规）→ **409 Conflict**，body 带上 link_type/src/dst。
3. 对齐语义后，确认 in_memory 与 pg 对同一输入返回一致结果。

### 测试（先写 failing）

- `test_link_instance_replay_is_idempotent`：同 rid 连续 POST 两次 → 均 200，PG 行数 = 1。
- `test_link_cardinality_n1_rejects_second_edge`：不同 rid、同 src → 409（非 500）。
- 后端一致性参数化测试：同一组操作在 InMemory / PG 两个 repo 上断言相同结果。

### 验收

- 重放幂等 ✓；违规返回 **409**（非 500）✓；两后端行为一致 ✓；`import-stats` 场景重跑无 err ✓。

---

## 2. F2 · propose 的 provenance 污染 parameters（P1，0.5d）

### 根因

`pg_repo.propose_action` **有意**把 provenance 并进 parameters：

```python
# pg_repo.py:4201-4205
# ONT-PROV-01：provenance 统一存 parameters（PG JSONB 持久化 + 引擎镜像同源）
params: dict[str, Any] = dict(parameters)
if provenance:
    params["provenance"] = {**(params.get("provenance") or {}), **provenance}
```

但 `execute` → `apply_action` 会用 **action 的参数表**逐键校验 `parameters`，`provenance` 不在表内 → `unknown parameter 'provenance'`（实测 404）。

### 修复（二选一，建议 A）

- **A（推荐）**：`execute` 前剥离保留键——在 `apply_action` 的参数校验处忽略/剥离 `provenance`，并把它路由到 audit/`ApplyOutcome.provenance` 通道。
- **B**：propose 不再并入 parameters，改为 proposal 单独的持久化字段（需加列/迁移）。

A 改动小、不动 schema，且保留 ONT-PROV-01 的审计可见性。

### 测试

- `test_propose_with_provenance_then_execute_succeeds`：propose 带 provenance → confirm → execute → **200**，且 audit 中可见 provenance。
- 回归：`parameters` 里**用户自己**传的字段不受影响。

### 验收

- 带 provenance 的 propose 全链路 200 ✓；provenance 可在审计中查到 ✓。

---

## 3. F4 · filter_expr 后端语义漂移（P1，1d）

### 根因

`props` JSONB 的 key 是**完整 prop rid**（如 `ont.tenant-default.prop.x-y.v1`）。

`sql_compiler._column_expr`（`sql_compiler.py:30-37`）在 `column_for_field` 未命中时直接退回 `(props ->> %s)` 并把**原样字段名**当 JSONB key：

```python
col = self._column_for_field.get(field_name)
if col:
    return col, params
params.append(field_name)
return "(props ->> %s)", params
```

于是 `thing-id == 't1'` 渲染成 `props ->> 'thing-id'` → **恒 NULL → 0 行，且不报错**。
但 `sql_compiler.py:23-24` 的 docstring **声称**接受完整 rid 或简写 slug——**文档与实现不符**；InMemory 侧 `compiler.py:95` 的 `FIELD = RID_FULL | SLUG` 确实两种都支持。

### 修复

1. **归一化**：查询编译前把 slug 解析为目标 ObjectType 的属性 rid（查 `ont_object_type.properties`）。命中 → 用完整 rid；不命中 → 见下。
2. **fail-fast**：无法解析的字段**不得静默返回空集**——抛 `422 Unresolved field: <name>`，附可选字段列表。（这是本次最关键的改动：静默空集比报错危险得多。）
3. 修正 `sql_compiler.py:23-24` docstring，或补上 slug 归一化使文档成真（建议后者 + 保留 fail-fast 兜底）。

### 测试

- `test_filter_expr_accepts_slug_and_full_rid`：两种写法返回相同结果集。
- `test_filter_expr_unknown_field_raises_422`：拼错字段 → 422（**不得** 200 + 空集）。
- 后端一致性：InMemory / PG 同输入同结果。

### 验收

- slug 与完整 rid 等价 ✓；未知字段 422 ✓；两后端一致 ✓；`import_to_platform.py` 的 14/14 过滤校验在**两种写法**下均通过 ✓。

---

## 4. F5 · embedding 401 拖累写入（P2，0.5–2d）

### 根因（2026-09-14 排查确认，代码级）

**不是 base URL 错，也不是模型不可用 —— 是 llmgw 的 IAM 取数 key 名与命名空间不匹配。**

- 容器 `ONT_EMBEDDER=llmgw` → `build_env_embedder()`（`object_search.py:145-156`）返回 `LlmgwServiceEmbedder`。
- `_index_individual_embeddings`（`pg_repo.py:3050`）是 **best-effort**（try + SAVEPOINT 吞异常），**不破坏写入正确性**，但调用**同步阻塞** —— 每次写入白付一个失败往返。

**断链点**（llmgw → IAM）：

| 步骤 | 代码 | 行为 |
| --- | --- | --- |
| 1 | `embeddings.py:379-381` | 向 IAM 要 `?prefix=ai.provider.` —— **只能拿到 `ai.provider.*`** |
| 2 | `iam/configs.py:228,256-257` | `_SERVICE_READ_PREFIX = "ai.provider."`，**强制钳回**该前缀（传别的也没用） |
| 3 | `embeddings.py:433` | 却去查 `ai.embedding.default_provider` —— **该 key 不在 `ai.provider.` 下，永远取不到** |
| 4 | → | `resolve_effective_embedding()` 恒返回 `{}` → 回落 env 分支 |
| 5 | `.env:3` | `ARK_API_KEY` 长度 **0**（空）→ 继续回落 `OPENAI_API_KEY`（一把 `sk-cp-` 的非 ARK key） |
| 6 | ARK | 非 ARK key 打 `/api/plan/v3/embeddings` → **401** |

**反证（说明只有这一步错）**：base URL `/api/plan/v3` **正确**（用 IAM 里托管的真 key 实测 → 200；打 `/api/v3/embeddings` 才 401）；模型 `doubao-embedding-vision` **可用**（真实返回 2048 维）；鉴权头 `Bearer` **正确**。IAM 里 `ai.provider.ark.*` 四件套 + `ai.embedding.default_provider=ark` **都已配好且有效**。

**为何能出厂**：`mate-tech-llmgw/tests/test_embedding_admin_config.py` 的 mock 信封里**自带** `ai.embedding.default_provider`，而真实 `service-read` 永远给不出该 key → **单测全绿、线上必挂**（测试与生产契约脱节）。

**实测代价**：HTTP 写入 **720ms/条** vs 进程内 30ms/条（**24×**）。2154 行 HTTP 导入约 26 分钟。

### 修复（分层）

1. **主修（代码，llmgw，推荐）**：`embeddings.py:433` 改为回落到确实存在的 key：
   ```python
   pid = cfg.get("ai.embedding.default_provider", "") or cfg.get("ai.provider.default_active", "")
   ```
   `ai.provider.default_active` 是真实存在的配置键（`iam/seed.py:444` seed），且 **copilot 服务已是此模式**（`mate-app-copilot/clients/base.py:257` 的 `flat.get("ai.provider.default_active", "")`）—— llmgw 是唯一没跟上的。
2. **备选（IAM）**：`configs.py:228/256` 放开 `ai.embedding.` 前缀。**次选** —— 会扩大 service-read 的密钥暴露面。
3. **应急（env，零代码）**：`.env:3` 填 `ARK_API_KEY=ark-…`（compose L555 已透传）。缺点：key 落 .env，违背"正式托管"原则。
4. **降级语义（必做，独立于 1–3）**：`embeddings.py:200-217` 上游失败时**返回 HTTP 200 + `_hash_embedding`**（且 `model=target_model` 误标）→ 调用方无法区分真假。应改为可识别的降级信号（响应标记 / 明确错误码），并加**熔断 + 负缓存**，避免重试放大。
5. **维度错配（latent bug）**：降级 hash 向量固定 **384 维**（`_DEFAULT_DIM=384`），而 `ONT_VECTOR_DIM=2048`、真实模型也是 2048 维 → **上游挂时写入的向量维度是错的**。
6. **可观测**：写入延迟指标 + embedding 失败率告警，避免"失败被吞 + 拖慢全局"再次隐形。
7. **测试补强**：llmgw 侧加一条**契约测试**，断言 `_fetch_iam_configs` 返回的键集合与真实 `service-read` 前缀一致（防同类 mock/生产脱节再发）。

### 测试

- `test_write_not_blocked_when_embedder_down`：embedder 抛错/超时时，写入耗时不受影响（阈值断言）。
- `test_embedding_circuit_breaker_opens_after_n_failures`。
- `test_resolve_effective_embedding_uses_provider_namespace_key`：mock 只给 `ai.provider.*`（真实前缀）时仍能解析出 provider。

### 验收

- embedder 不可用时写入延迟回到 ~30ms 量级 ✓；embedding 恢复后索引能补齐（回填）✓；失败率有指标 ✓；降级向量维度与 `ONT_VECTOR_DIM` 一致 ✓。

---

## 5. F1 · 部署态 Function 源码不可注入（P1 功能缺口，3–5d，需 ADR）

> **ADR 已起草**：`docs/active/decisions/ADR-0063-function-source-resolution.md`
> —— 核心决策 D1/D2/D3 已拍板（分层作用域 / 一刀切删兜底 / 只读 deploy key）。
> 实施按该 ADR §6 的 S1–S5 阶段执行，取代本节的"两步"草案。

### 根因

```python
# pg_repo.py:55
_PG_DEFAULT_INLINE_FN = "def main(target, params):\n    return params\n"
# pg_repo.py:58
_PG_INLINE_FUNCTIONS: dict[str, str] = {}      # 部署态为空
```

`upsert_function`（`pg_repo.py:2383-2393`）对任何 `inline://` 前缀一律注册 `_PG_INLINE_FUNCTIONS.get(ref, _PG_DEFAULT_INLINE_FN)` → **恒等函数**。`ont_function` 表（`pg_repo.py:500`）只存 `source_ref` **不存源码**。启动 `main.py:80` 注入 `_SimplePythonExecutor`（`FUNCTION_BACKEND=memory`）。

**结果**：`apply` 返回 200、发 audit/outbox，但**业务属性不写入**。→ SOP 逻辑无法经平台部署。

**归因**：GOVERN-05 设计预留 `GitFunctionResolver` / `OCIImageResolver`（SANDBOX-02 / AGENT-EXT-01），当前未接线。

### 修复（分两步，先方案后实现）

**Step 1 · 设计（先落 ADR）**
- 决策点：源码来源（Git SHA / OCI digest / 受控 inline 注册端点）？信任边界与签名校验？与 Function Sandbox（ADR-0040，L2 K8s Job）的关系？
- 需澄清一条安全红线：**不允许任意用户经 API 上传并执行代码**——必须走受控来源 + 审批。

**Step 2 · 实现（建议最小闭环）**
1. 实现 `GitFunctionResolver`（`function_resolver.py` 已有 Protocol，缺实现）：`source_ref = git:<sha>:<path>` → 拉取并校验哈希。
2. `pg_repo.upsert_function` 按 `source_ref` scheme 分派 resolver，移除"一律恒等"兜底（未知 scheme → fail-fast，不再静默恒等）。
3. 接线 `set_function_executor`（`main.py:80`）+ `register_function_ref`。
4. 兜底：`_PG_DEFAULT_INLINE_FN` 保留但**仅在显式声明** `inline-default://` 时使用，杜绝静默。

### 测试

- `test_git_resolver_fetches_and_executes`：注册 `git:` 引用的真函数 → apply → 目标属性按函数逻辑写入。
- `test_unknown_source_ref_fails_fast`：未注册 scheme → 明确报错（**不得**静默恒等）。
- 端到端：用 `dangerous_goods` 的 `classify-danger` 真逻辑经**部署态**跑通，断言 274/274。

### 验收

- 部署态 apply **真正执行**业务逻辑 ✓；未知来源 fail-fast ✓；`dangerous_goods` 端到端复现 GT ✓（把本会话"内核层验证"升级为"平台层验证"）。
- 交付 `docs/active/decisions/ADR-00xx-function-source-resolution.md` + ACCEPTANCE 证据。

---

## 6. 推荐执行顺序

```
第 1 批（0.5–1.5d，确定性高、低风险，先拿绿）
  F3+F6  →  F2
   └─ 都是小改动 + 明确回归，适合建立"两后端一致性"测试脚手架

第 2 批（1d，纠错价值最高）
  F4  ← 依赖第 1 批建立的"两后端一致性"测试范式

第 3 批（0.5–3d，含运维/架构）
  F5（先修凭证 → 再异步化）
  F1（先 ADR → 再实现）   ← 最后做，因为它改的是引擎执行语义

贯穿：F3/F4 都要补 InMemory×PG 双后端一致性测试，这是本次暴露的系统性问题
```

**依赖**：
- F4 的 fail-fast 需先确定"字段可解析性"的数据来源（ObjectType properties）——与 F1 无关，可独立做。
- F5 的异步化若引入队列，与 F1 的 Function Sandbox 执行器**不同**，不要混在一起。

---

## 7. 回归与验收策略

| 层 | 手段 |
|---|---|
| 单元 | 每缺陷先写 failing test（仓库既有 `pytest` 套件，`mate-kernel/tests` + `mate-tech-ont/tests`） |
| 双后端一致性 | 新增参数化 fixture：同一操作序列在 InMemory / PG 上断言同结果（防 F3/F4 类漂移再发） |
| 端到端 | 复用 `scripts/ont-bench/import_to_platform.py`（14 域 / 2154 实例）+ `platform_advanced_primitives.py`（9/9）作为回归基线 |
| 静态 | `ruff` + `pyright`（硬规则 #6） |
| 证据 | 每项修复附 ACCEPTANCE 段落，更新 `HARD-RULES-MATRIX` / `FOLLOW-UP-BOARD` |

**回归基线（当前值，修复后不得劣化）**：
- 全量导入 `2154/2154`、`0 失败`、`14/14` 计数/过滤/回读
- 平台高级基元 `9/9`
- 内核 pilot `274/274`、`66×6`

---

## 8. 里程碑

| 里程碑 | 内容 | 出口 |
|---|---|---|
| **M1 · 快修**（第 1 批） | F3+F6、F2 | 4 项测试绿；双后端一致性脚手架就位 |
| **M2 · 纠错**（第 2 批） | F4 | slug/rid 等价 + 未知字段 422；导入回归仍 14/14 |
| **M3 · 韧性**（第 3 批） | F5 | 写入延迟指标回落；embedder 故障不阻塞 |
| **M4 · 能力**（第 3 批） | F1 | ADR 通过 + 部署态 apply 真执行 + `dangerous_goods` 274/274 平台层复现 |

---

## 9. 本期不做（scope guard）

- 不引入外部编排/规则引擎框架（沿用自研约束）。
- 不改 Function Sandbox 的 L2 K8s 执行路径（归 SANDBOX-02）。
- 不重构 `propose` 的存储模型（F2 走方案 A）。
- 不为 14 个 SOP 域补真实业务逻辑实现（那是数据集价值，不是引擎缺陷）。

---

## 附：证据索引

| 项 | 路径 |
|---|---|
| 缺陷原始记录 | `docs/active/specs/2026-09-14-ontology-data-validation-report.md` §5 |
| 回归脚本 | `scripts/ont-bench/{import_to_platform,platform_advanced_primitives}.py` |
| 双后端实现对比 | `mate-kernel/.../ontology/in_memory.py:660` vs `mate-tech-ont/.../v2_kernel/pg_repo.py:2133` |
