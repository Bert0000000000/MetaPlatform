# 本体引擎缺陷修复工作计划（P1–P3）

> **日期**：2026-09-14（**当日晚收口**）
> **来源**：`docs/active/specs/2026-09-14-ontology-data-validation-report.md` §8 建议
> **范围**：原计划 5 个缺陷（F1–F6，其中 F3/F6 同源）**+ 实施中新增 4 个**（F7–F10）
> **状态**：**9/9 已修复**；部署态 e2e 已跑通；回归 kernel+ont 1167 passed / llmgw 278 passed
> **提交顺序**：遵循 CLAUDE.md 强约束 —— `docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence`

---

## 0. 总览

| ID | 优先 | 缺陷 | 根因位置 | 状态 |
|---|---|---|---|---|
| **F3+F6** | P1 | LinkInstance 同 rid 重放被基数校验误判 → 500 | `pg_repo.py:2137` | ✅ 已修 |
| **F2** | P1 | propose 把 `provenance` 并入 parameters，execute 报 unknown parameter | `pg_repo.py:4201-4205` | ✅ 已修 |
| **F4** | P1 | `filter_expr` 未知字段**静默返回空集**（非 slug 问题，见 §3 修正） | `sql_compiler.py` / `pg_repo.evaluate_object_set` | ✅ 已修 |
| **F5** | P2 | embedding 401 拖累每次写入 ~700ms | `embeddings.py:433`（key 名不匹配） | ✅ 已修 |
| **F1** | P1 | 部署态 Function 源码不可注入，apply 不执行逻辑 | `pg_repo.py:55/2383` · `engine.py:412` | ✅ 已修（S1–S5 全落地，ADR-0063） |
| **F7** | P1 | RLS 迁移静默 no-op → 全库无 RLS（**F8 上游成因**） | `alembic/.../0013_ont_kernel_rls.py` | ✅ 已修（告警 + 幂等脚本） |
| **F8** | **P0** | **跨租户读取泄漏**（RLS 未开 + 无租户谓词） | `pg_repo.list_individuals/list_link_instances` + 全库 RLS | ✅ 已修（应用层 + 数据库层） |
| **F9** | P2 | `GET /axioms` 恒 500（空串 operand） | `pg_repo._row_to_ax` / 父类公理生成 | ✅ 已修 |
| **F10** | P2 | `audit_id` 撞 `ont_action_audit` 主键 → execute 500 | `engine.py:436`（进程内计数器） | ✅ 已修 |

> **F8 是实施过程中新发现的最严重项**（实测确认跨租户可读），优先级高于原计划的其余项。
> **修复它们的两个前置条件**（不在原计划内，但缺了会打挂线上）：
> ① `threading.local` → `contextvars.ContextVar`（否则 RLS 一开全站读空）；② 部署态需重启容器加载修复。

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

**修正后的准确定位（2026-09-14 实测）** —— 初版把本项描述为「slug 静默返回 0 行」，**不准确**：

| filter | 实测结果 |
| --- | --- |
| `simple == 'a'`（普通 slug） | **正常工作** ✓ —— `slug_to_rid` 用 `_prop_slug`（rid 第 4 段）归一化 |
| `<完整 rid> == 'a'` | 正常工作 ✓ |
| `nosuchfield == 'x'`（未知字段） | **0 行且不报错** ✗ ← **真正的缺陷** |
| `type.sub == 'b'`（含点写法） | DSL 字段正则不允许 slug 含点 → 落到 truthy 分支 → 同样静默 ✗ |

即：**普通 slug 本来就是好的**（我最初的探针失败，是因为探针里的属性 rid 自身 slug 含点，第 4 段被截断 —— 探针写错了，不是平台的问题）。
真正的缺陷只有一条：`_rewrite_filter_fields` 的注释原文「未命中原样保留」——**字段既非完整 rid、也非已知 slug 时，渲染成 `props ->> '<未知键>'` 恒 NULL → 静默返回空集**。
**空集比报错危险得多**：调用方无法区分"没有匹配"与"字段名写错了"。

### 修复（已实施）

1. **fail-fast**：`evaluate_object_set` 在归一化前调 `_assert_filter_fields_resolvable` —— 非 rid 且不在已知 slug 集合的字段 → `ValueError`，API 映射 **422**。
2. 只对**非 rid 形态**的字段严格（完整 rid 一律放行，避免误伤继承/跨类属性场景）。
3. **未采纳**：一度加过 `_slug_of` 别名（支持含点 slug）。实测发现那是投机性改动且可能引入 slug 冲突，**已撤掉** —— 含点字段不是归一化 bug，而是 DSL 语法边界。

### 测试

- `test_filter_field_resolution.py`（5 例）：普通 slug ✓ / 完整 rid ✓ / 6 段 rid 的 parts[3] 约定 / 含点写法 → 报错而非静默 / 未知字段 → 报错。

### 验收

- 未知字段 → `ValueError`（API 422）✓；普通 slug 与完整 rid 均正常 ✓；`test_rewrite_keeps_unknown_fields` 等既有单测不变 ✓。

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

### 修复（**已落地** —— ADR-0063 S1–S5）

| 阶段 | 内容 | 结果 |
|---|---|---|
| **S1** | 新增 `GitFunctionResolver`（`git:<40位SHA>:<path>`，进程内缓存，fail-fast） | ✅ 6 测试 |
| **S2** | 删除两处静默兜底（`pg_repo` 恒等函数 / `engine.py` 参数回显）+ 按 scheme 分派 + seed 改造 | ✅ 22 处连带清理 |
| **S3** | flow 路径解析 ActionType 声明的真实 `function_ref`（不再拿 `action_rid` 占位） | ✅ |
| **S4** | production profile 拒绝 `inline://`（硬规则 5） | ✅ |
| **S5** | **部署态 e2e** | ✅ propose→confirm→execute 200，函数结果**真实回写实例属性** |

> **决策澄清（评审产出）**：「源码从 Action 编排来」**不成立** —— 编排层只持 `action_rid` **指针**，
> 不承载源码；而声明式写路径（`ActionType.declarative_edits` / edit-set）**根本不需要源码**。
> 因此 ADR-0063 把作用域收敛到**代码轴**，并把 Function 定位为「声明式表达不了的复杂计算的例外通道」。

> **部署后另暴露 2 处**（本地/单测跑不出来）：PG `set_function_executor` 漏注册已有 Function；
> seed 回填只写 registry 不调 upsert（resolver 注册只发生在 upsert）。详见 §5b 末。

<details>
<summary>原始草案（已被上表取代，保留供对照）</summary>

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
- 交付 `docs/active/decisions/ADR-0063-function-source-resolution.md`（实际文件名）+ ACCEPTANCE 证据。

</details>

---

## 5b. F7–F10 · 实施中新发现（原计划外）

### F7 · RLS 迁移静默 no-op（P1，F8 的上游成因）

`alembic/versions/20260807_0013_ont_kernel_rls.py` 只对**当时已存在**的表开 RLS；而 `ont_*` 表由服务运行时 `pg_repo._ensure_schema()` 按需创建。若迁移先跑，它静默跳过，且注释**谎称**「下次 `alembic upgrade head` 会补上」—— **Alembic 按 revision 记账，已应用的 revision 不会重跑**。实测：`metaplatform` 库 28 张 `ont_*` 表 `rls=false`、零策略，连 `alembic_version` 表都不存在。

**修复**：迁移改为**响亮告警**（列出缺哪些表 + 指向补开脚本），不再谎称会自动补；新增幂等脚本 `scripts/ont/apply_rls.py`（`--dry-run` / `--revert`，按实际存在的、带 `tenant_id` 列的表逐一张开）。

### F8 · 跨租户读取泄漏（**P0**，实测确认）

以 `tenant-default` 身份调 `GET /link-instances` / `GET /individuals`，**返回了 `tenant-canary` 的行**（已实测）。

成因链（三者叠加）：
1. `list_individuals` / `list_link_instances` 是 `SELECT *`，**无租户谓词**（同族 `list_object_types` 有 `WHERE tenant_id = %s`）；
2. PG RLS 从未生效（F7）；
3. 更深一层：`tenant_scope` 用 `threading.local`，**不跨 `asyncio.to_thread`** → API 路径下 `_current_tenant()` 恒为 `None` → `_install_rls` 从不执行（**GOVERN-06 第二层防线一直是死的**）。

**修复（两层）**：
- **应用层**：两个方法加 `tenant_id` 参数 + 谓词；API handler 显式传 `ctx.tenant_id`（`list_object_types` 早就是这个"深度防御"写法）；InMemory 与 Protocol 同步。
- **前置**：`threading.local` → **`contextvars.ContextVar`**（实测跨 `to_thread` 可见）。
- **数据库层**：对 `metaplatform` 实开 RLS —— **26/28** 张 `ont_*` 表 `ENABLE + FORCE` + `tenant_isolation` 策略。

**验证**：开启前后行数**完全一致**（49/2176/69）；写入 200 且读回正确；canary 行不可见。

#### ⚠️ 更正：RLS 在本环境**实际不生效**（2026-09-14 二次核查）

后续抽查发现 `GET /object-types/{rid}/datasources` **仍然泄漏** —— 尽管 `ont_backing_datasource` 已开 RLS。根因：

```
meta: rolsuper=True rolbypassrls=True
```

**应用连接角色 `meta` 是超级用户 + BYPASSRLS**；PostgreSQL 中**超级用户恒绕过 RLS**，`FORCE ROW LEVEL SECURITY` 只作用于表 owner，管不住超级用户。
因此：
- 上一段的「canary 行不可见」**靠的是应用层租户谓词，不是 RLS**；把功劳记在 RLS 上是错的。
- `apply_rls.py` 确实把 26 张表开到了 `rls=true force=true`，但**在当前角色下是装饰性的**。
- 真正需要 RLS 生效，须等 **GOVERN-09 提供非特权应用角色**（`security/test_tenant_isolation_hard.py` 早就因此 skip，跳过原因原文即「role bypasses RLS (superuser / BYPASSRLS)」）。

**推论**：**租户隔离目前完全依赖应用层**。凡缺少显式租户谓词/守门的端点即存在泄漏面。

#### 端点守门审计（本次发现，部分已修）

对 `api.py` 中带 `rid` 参数的端点做了启发式审计，**18 处源码层面看不到 rid 前缀守门**（对比 `list_versions` / `get_object_type` 等有）。
其中**已实测确认泄漏并修复**的：

| 端点 | 修复 |
|---|---|
| `GET /functions/{rid}/versions` | 补 rid 前缀守门 → 403（此前可读他租户函数版本元数据含 `source_ref`） |
| `GET /object-types/{rid}/datasources` | 同上（此前可读他租户背挂数据源声明） |

**其余 16 处待审**（`materialization` / `security-policies` / `datasources/sync|cdc` / `action-audit` / `timeseries` / `wip` / `export` / `reasoning/axioms` / `interfaces` 等）：
本审计是**源码启发式**（可能是误报——守门或许在更深处），需逐个实测确认后再决定是否加守门。

### F9 · `GET /axioms` 恒 500（P2）

`_row_to_ax` 对每个 operand 直接构造 `ClassRef`，遇到非法值即抛。库中存在两类：
① `upsert_object_type` 对**无父类**类型生成 `operands=[rid, '']`（空串占位）；
② 闭包路径刻意支持的 **slug 形式** operand（`list_subclass_axioms` 按原始字符串消费，DTO 层无法表示）。

**修复**：生成端不再写空串；读取端跳过无法表示的 operand；`list_axioms` 对单条坏行容错（列表端点不应因一行脏数据整体 500）。

### F10 · `audit_id` 撞 `ont_action_audit` 主键（P2，**部署后暴露**）

`engine.py:436` 用**进程内计数器** `audit-{len(self._audit)+1}`。容器重启后计数归零 → 生成 `audit-1` → 与库里既有行撞主键 → `execute` 500。

**修复**：加进程唯一前缀 `audit-<6位hex>-<n>`（保留 `audit-` 前缀与计数器语义）。

**部署后才暴露的还有 2 处**（本地/单测跑不出来，因 executor 与 upsert 的顺序不同）：
- PG `set_function_executor` **只赋值 executor，从不给已有 Function 注册 `function_ref`**（InMemory 版本有遍历）。而启动顺序是 `seed_demo()` → `_inject_function_executor()`，seed 创建的函数永不被 ActionService 认知 → `FunctionNotRegistered`。
- seed 的函数源码回填走了 `continue`，只写 `_PG_INLINE_FUNCTIONS` 不调 `upsert_function`，而 resolver 注册只发生在 upsert 里 → 新进程仍解析不到。

---

## 6. 推荐执行顺序（**实际执行序**）

```
第 1 批  F3+F6 → F2 → F4 → F9 → F8(应用层)   ✅ 全绿
第 2 批  F5（根因：key 名不匹配，非凭证问题）  → 降级维度可配置 + degraded 标记  ✅
第 3 批  F1（ADR-0063 S1–S5：Git resolver → 删兜底 → flow 路径 → prod 守门 → e2e）  ✅
第 4 批  F10（部署后暴露）→ F7（迁移）→ F8 数据库层（RLS 实开）  ✅
```

**实施中的两个硬前置**（原计划未预见）：
1. **`contextvars` 替换 `threading.local`** —— 不先做，开 RLS 会让全站读空；
2. **容器重启加载修复** —— 容器挂载主工作目录的 `packages/`，但 Python 进程需重启才加载新代码。
   中间窗口若已开 RLS，服务会读空 —— 故顺序必须是「先重启 → 再开 RLS」。

**贯穿项**：InMemory×PG 双后端一致性测试（F3/F4 同源暴露）。仍未补齐的同类隐患：见 §9。

---

## 7. 回归与验收策略

| 层 | 手段 |
|---|---|
| 单元 | 每缺陷先写 failing test（仓库既有 `pytest` 套件，`mate-kernel/tests` + `mate-tech-ont/tests`） |
| 双后端一致性 | 新增参数化 fixture：同一操作序列在 InMemory / PG 上断言同结果（防 F3/F4 类漂移再发） |
| 端到端 | 复用 `scripts/ont-bench/import_to_platform.py`（14 域 / 2154 实例）+ `platform_advanced_primitives.py`（9/9）作为回归基线 |
| 静态 | `ruff` + `pyright`（硬规则 #6） |
| 证据 | 每项修复附 ACCEPTANCE 段落，更新 `HARD-RULES-MATRIX` / `FOLLOW-UP-BOARD` |

**回归基线（修复后实测值，不得劣化）**：
- `mate-kernel` + `mate-tech-ont`：**1167 passed / 0 failed / 8 skipped**
- `mate-tech-llmgw`：**278 passed / 0 failed**
- 平台高级基元 `9/9`、内核 pilot `274/274` 与 `66×6`（未触及）
- 部署态 e2e：`propose→confirm→execute` 200 + 属性回写 ✓

> ⚠️ 三包**合在同一 pytest 进程**跑会多出 3 个 llmgw 失败（既有跨包隔离问题，见 §9），非本次引入。

---

## 8. 里程碑（**全部达成**）

| 里程碑 | 内容 | 出口 | 结果 |
|---|---|---|---|
| **M1 · 快修** | F3+F6、F2、F9 | 测试绿 | ✅ 4+1 测试 |
| **M2 · 纠错** | F4、F8（应用层） | 未知字段 422；不再跨租户泄漏 | ✅ 5+2 测试 |
| **M3 · 韧性** | F5 | 根因修复 + 降级可辨识 | ✅ 4 测试 |
| **M4 · 能力** | F1（S1–S5）、F10、F7、F8（数据库层） | 部署态 apply 真执行 | ✅ **部署态 e2e 跑通，属性真实回写** |

**最终回归**：`mate-kernel` + `mate-tech-ont` **1167 passed / 0 failed**；`mate-tech-llmgw` **278 passed / 0 failed**。

---

## 9. 本期不做 / 已知遗留

**不做（沿用）**：
- 不引入外部编排/规则引擎框架（沿用自研约束）。
- 不改 Function Sandbox 的 L2 K8s 执行路径（归 SANDBOX-02）。
- 不重构 `propose` 的存储模型（F2 走方案 A）。
- 不为 14 个 SOP 域补真实业务逻辑实现（那是数据集价值，不是引擎缺陷）。

**已知遗留（本次未处理）**：
| 项 | 说明 |
|---|---|
| **RLS 在本环境不生效** | 应用角色 `meta` 是 `rolsuper+rolbypassrls` → 超级用户恒绕过 RLS。26 张表虽已 `ENABLE+FORCE`，实为**装饰性**。**租户隔离完全压在应用层**。需 GOVERN-09 提供非特权角色才有第二道防线。 |
| **16 处端点守门待审** | 带 `rid` 的端点中 18 处源码层面无前缀守门；已实测确认并修复 2 处（`/functions/{rid}/versions`、`/object-types/{rid}/datasources`），其余待逐个实测。见 §5b F8 末。 |
| `ont_function_version` / `ont_type_version` 无 `tenant_id` 列 | ⚠️ **更正**：不是 `ont_function_alias`（它有 `tenant_id` 且已开 RLS）。这两张表无该列故无法行级隔离，读取依赖 **rid 内嵌的租户前缀** + 端点守门。 |
| `FUNCTION_BACKEND` vs `SANDBOX_BACKEND` | 两个开关语义部分重叠，合并留待 GOVERN-01（ADR-0063 §2.5）。 |
| ~~ObjectSet 其它静默路径~~ | ✅ **已修**：`sort` / `group_by` 未知字段现 fail-fast（`_require_resolvable_field`）。派生属性内部的 `continue` 保留（非用户输入，且已有 try 保护）。 |
| ~~跨包测试隔离~~ | ✅ **已修**：`test_ont_l5_search_boost.py::TestHyDEEnrich` 两处 `os.environ.pop("SERVICE_CLIENT_SECRET")` **不还原**，永久污染 pytest 进程 → llmgw 运行时读到空。改用 `monkeypatch.delenv`（自动还原）。合跑 1449 passed / 0 failed。 |

---

## 附：证据索引

| 项 | 路径 |
|---|---|
| 缺陷原始记录 | `docs/active/specs/2026-09-14-ontology-data-validation-report.md` §5 |
| 决策记录（F1） | `docs/active/decisions/ADR-0063-function-source-resolution.md` |
| 回归脚本 | `scripts/ont-bench/{import_to_platform,platform_advanced_primitives}.py` |
| RLS 幂等脚本（F7/F8） | `scripts/ont/apply_rls.py` |
| 双后端实现对比 | `mate-kernel/.../ontology/in_memory.py` vs `mate-tech-ont/.../v2_kernel/pg_repo.py` |
| F3/F8 回归测试 | `mate-tech-ont/tests/test_ont_exp03_link_semantics.py`、`tests/test_ont_list_tenant_scope.py` |
| F2/F4 回归测试 | `mate-tech-ont/tests/integration/test_ont_proposal_provenance.py`、`test_ont_filter_field_resolution.py` |
| F9 回归测试 | `mate-tech-ont/tests/test_ont_g21_closure_objectset.py::TestListAxiomsSafe` |
| F5 回归测试 | `mate-tech-llmgw/tests/test_embedding_admin_config.py`、`test_llmgw_embeddings.py` |
| F1-S1 回归测试 | `mate-kernel/tests/test_function_resolver_git.py` |
