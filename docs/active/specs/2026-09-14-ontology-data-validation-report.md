# 本体数据验证报告 · SOP-Bench → Mate Platform

> **日期**：2026-09-14
> **验证对象**：`mate-tech-ont` v2 kernel（12 基元），运行态 `KERNEL_BACKEND=pg`
> **数据源**：`amazon-science/SOP-Bench`（CC BY-NC 4.0，**仅限内部引擎验证**）
> **结论**：**数据层全量导入通过（14 域 / 2154 实例 / 0 失败），12/12 基元在平台层可寻址；但"业务逻辑经平台执行"当前不可验证——部署态 Function 源码无法注入（详见 §5 F1）。**

---

## 1. 一句话结论

SOP-Bench 的 14 个工业域、2154 条实例已**全量导入运行中的 Mate Platform（真实 PG + RLS）**，schema / 实例 / 关系 / 查询四条链路全部验证通过（`14/14` 计数、`14/14` 过滤、`14/14` 回读、租户隔离 `403`）；**但 Function/ActionType 的业务逻辑在部署态是恒等桩**——平台无法经 API 注入 Function 源码，`apply` 只回显参数。因此"用平台复现 SOP ground truth"这件事，本轮由**进程内内核引擎**验证通过（见 §6），而非部署态。

---

## 2. 数据源与合规

| 项 | 值 |
|---|---|
| 仓库 | `amazon-science/SOP-Bench`（41⭐，2026-02 创建，KDD 2026 D&B 投稿中） |
| 许可 | **CC BY-NC 4.0（非商业）** — 仅内部引擎验证，**不得随产品分发** |
| 规模 | 14 个工业域、2154 条带 ground truth 的实例 |
| 每域结构 | `sop.txt`（过程语义）/ `toolspecs.json`（工具签名）/ `tools.py`（mock 实现）/ `test_set_with_{,out}puts.csv`（输入 + GT） |
| 本地缓存 | `.tmp/sop-bench/`（已 gitignore，不入库） |
| 抓取 | [`scripts/ont-bench/fetch_sop_bench.py`](../../../scripts/ont-bench/fetch_sop_bench.py)（gh api 通道） |

**为什么选它**：布局与 12 基元近乎 1:1——`toolspecs.json` 的工具即 ActionType 签名，`tools.py` 即 Function，CSV 行即 Individual，输出列即 ground truth。

---

## 3. 导入结果（全量）

运行态 `/api/v1/ont/v2`，租户 `tenant-default`，后端 `pg`。

| 域 | 列 | 行 | 实例导入 | 主键列 | 过滤校验（完整 rid） | 耗时 s |
|---|---|---|---|---|---|---|
| aircraft_inspection | 22 | 112 | 112 | aircraft_id | cross_check_reporting_response=55 ✓ | 2.15 |
| content_flagging | 19 | 168 | 168 | content_id | final_decision=53 ✓ | 2.60 |
| customer_service | 37 | 156 | 156 | account_id | final_resolution_status=56 ✓ | 2.27 |
| dangerous_goods | 11 | 274 | 274 | product_id | hazard_class=91 ✓ | 4.15 |
| email_intent | 10 | 186 | 186 | email_id | marketplace_id=186 ✓ | 2.84 |
| know_your_business | 25 | 90 | 90 | business_id | date_of_entry=2 ✓ | 1.39 |
| order_fulfillment | 10 | 30 | 30 | order_id | expected_output=14 ✓ | 0.51 |
| patient_intake | 41 | 66 | 66 | patient_id | pharmacy_check=56 ✓ | 1.04 |
| referral_abuse_detection_v1 | 18 | 200 | 200 | account_id | enforcement_action=105 ✓ | 3.18 |
| referral_abuse_detection_v2 | 29 | 200 | 200 | account_id | final_decision=134 ✓ | 3.02 |
| traffic_spoofing_detection | 26 | 200 | 200 | partner_id | source_verification_result=92 ✓ | 3.48 |
| video_annotation | 33 | 125 | 125 | video_id | final status=85 ✓ | 2.20 |
| video_classification | 23 | 197 | 197 | video_id | final_decision=101 ✓ | 3.19 |
| warehouse_package_inspection | 20 | 150 | 150 | po_number | charge_back_amt=34 ✓ | 2.73 |
| **合计** | — | **2154** | **2154（0 失败）** | | **14/14** | **39.1**（≈62 行/s） |

**平台侧清单**（PG 实查，`sopbench` 组）：ObjectType 15 · Individual 2160（2154 患者 + 6 provider）· LinkType 1 · LinkInstance 66 · Function 14 · ActionType 14 · Interface 1 · Axiom 16。

---

## 4. 基元覆盖与验证项

### 4.1 12 基元覆盖（12/12）

| # | 基元 | 平台层验证 | 证据 |
|---|---|---|---|
| 1 | `ClassRef` | ✅ | 全部 rid 通过 `ont.<tenant>.<kind>.<slug>` 校验落库 |
| 2 | `Version` | ✅ | `POST /versions/{class_rid}` → 200，schema 快照 |
| 3 | `Property` | ✅ | 324 列（14 域合计）自动推断 integer/double/string + 数组 |
| 4 | `ObjectType` | ✅ | 15 个注册（14 域 + InsuranceProvider） |
| 5 | `LinkType` | ✅ | `patient ─insured-by→ provider` N:1，含 4 个链接属性 |
| 6 | `ActionType` | ✅ | 14 个注册（schema 层） |
| 7 | `Interface` | ✅ | `scorable`（6 输出列形状契约） |
| 8 | `Individual` | ✅ | 2160 个，含数组多值属性 |
| 9 | `LinkInstance` | ✅ | 66 条，链接属性承载保单细节 |
| 10 | `Axiom` | ✅ | 1 显式 HAS_KEY + 15 自动 subclass（每 ObjectType 一条）|
| 11 | `Function` | ⚠️ 仅注册 | 14 个可注册/版本化，**源码执行不可注入**（F1）|
| 12 | `ObjectSet` | ✅ | 全量查询 + 属性过滤（须完整 rid，F4） |

### 4.2 验证项结果

| 验证 | 方法 | 结果 |
|---|---|---|
| 实例计数一致 | 每域 `object-sets/query` count vs CSV 行数 | **14/14 ✓** |
| 回读一致 | 每域抽 3 条 `GET /individuals/{rid}` 比对原值 | **14/14 × 3/3 ✓** |
| 属性过滤 | 每域对输出列做 `== '<众数>'` 过滤（完整 rid） | **14/14 ✓** |
| 关系一跳遍历 | `GET /individuals/{rid}/around` | ✓ 解析出保险对端 |
| 租户隔离 | 换 `X-Tenant-Id: tenant-other` | **403 拒绝 ✓** |
| HITL 写路径 | `propose → confirm → execute` | ✓ 200 + audit_id + outbox 事件 |
| 基数守门 | N:1 重复建边 | ✓ 被拒（但报 500，见 F3/F6）|

---

## 5. 引擎能力边界与缺陷（findings）

### F1 · P1 · 部署态 Function 源码不可注入，业务逻辑不执行
`pg_repo.upsert_function` 对 `inline://` 前缀的 `source_ref` 一律注册内置**恒等函数**：

```
pg_repo.py:55   _PG_DEFAULT_INLINE_FN = "def main(target, params):\n    return params\n"
pg_repo.py:58   _PG_INLINE_FUNCTIONS: dict[str, str] = {}   # 部署态为空
```

启动日志 `function_executor.initialized backend=memory` → `_SimplePythonExecutor`。实测 `execute` 返回 200 且发 audit/outbox，但目标实例的业务属性**未写入**。
**影响**：SOP 决策逻辑无法经平台 API 部署；`ont_function` 表只存 `source_ref` 指针不存源码。**归因**：GOVERN-05 设计预留 `GitFunctionResolver`/`OCIImageResolver`（SANDBOX-02 / AGENT-EXT-01 后续），当前为已知未接线。

### F2 · P1 · 直接 apply 已退役（410），propose 会把 provenance 折进 parameters
- `POST /action-types/{rid}/apply` → `410 direct action apply is retired`；唯一写路径为 `propose → confirm → execute`（+ `Idempotency-Key` 头）。
- `POST /action-types/{rid}/propose` 收到顶层 `provenance` 时，会将其**合并进 `parameters`**，导致 `execute` 报 `unknown parameter 'provenance'`（实测 404）。调用方必须避免在 propose 里传 `provenance`。

### F3 · P2 · `create_link_instance` 漏传 `exclude_rid`，同 rid 重放被误判
```
pg_repo.py:2137   self._check_link_cardinality(row["link_type_rid"], row["src"], row["dst"])
pg_repo.py:2186   def _check_link_cardinality(..., exclude_rid: str = "")
```
`_check_link_cardinality` **支持** `exclude_rid`（SQL 里 `rid != %s`），但调用点未传；而同一 INSERT 明写 `ON CONFLICT (rid) DO UPDATE`（upsert 语义）。结果：**重放同一条 LinkInstance 被基数校验判为"src already links to another dst"**。InMemory 路径（`in_memory.py:660`）正确排除同 rid —— **两后端语义不一致**。实测：首轮 66 条成功，重跑 66 条全部失败。

### F4 · P2 · `ObjectSet.filter_expr` 后端语义漂移（slug 静默返回 0 行）
- PG 路径：`<完整 rid> == 7` ✓；`thing-id == 't1'` → **0 行，无报错**。
- InMemory 路径的编译器（`objectset/compiler.py:95`）显式支持 `RID_FULL | SLUG` 两种写法。
**影响**：同一 filter_expr 在 dev(memory) 与 prod(pg) 行为不同，且失败是静默的（返回空集而非报错），极易误判为"数据没导进去"。

### F5 · P2 · `ONT_EMBEDDER=llmgw` 且 ARK embedding 端点 401，每次写入白付一个往返
llmgw 日志：`llmgw.embedding.openai.error ... 401 Unauthorized ... /api/plan/v3/embeddings`。
实测写入延迟：**HTTP 路径 720ms/条** vs **进程内仓库 30ms/条（24×）**。每条实例写入都触发一次注定失败的 embedding 调用；同时语义检索功能实际不可用。

### F6 · P3 · 建边失败返回 500（应为 409/422）
与 F3 同源：`ValueError` 未在 handler 层翻译为 4xx，暴露 `Internal Server Error`。

### F7 · P4 · 次要 API 人体工学
- `POST /versions/{class_rid}` 的 body 仍必须带 `class_ref`（路径已有，重复）。
- `DELETE /object-types/{rid}` 对存在的类型返回 405。

---

## 6. 进程内内核验证（业务逻辑层面，补充 F1 的缺口）

部署态无法执行 Function，故 SOP 逻辑复现在**内核层**（同一 `mate_kernel` 代码，InMemory 后端 + `SubprocessExecutor` 真沙箱）验证：

| Pilot | 域 | 结果 |
|---|---|---|
| [`pilot_dangerous_goods.py`](../../../scripts/ont-bench/pilot_dangerous_goods.py) | 单实体 + **真 SOP 公式** | **274/274 精确复现** `hazard_score`+`hazard_class`；沙箱抽样 8/8；ObjectSet 过滤 91/91 |
| [`pilot_patient_intake.py`](../../../scripts/ont-bench/pilot_patient_intake.py) | 关系域 + 多工具编排 | **66 行 × 6 列全对**；LinkType/LinkInstance/基数守门/around 全通过 |

**校准过程中的数据质量发现**（SOP 文本 vs ground truth 不一致，属基准的隐式知识）：
- dangerous_goods：文本写 "more than two" 缺失→UTD，GT 实际为 **≥2**；5 条格式违例 ID 一律 UTD。
- patient_intake：§5.2.1 lifestyle 公式仅覆盖 **33/34** 完整输入行（32 行输入不全）。

---

## 7. 复现步骤

```bash
# 1) 抓数据（14 域，gh api 通道）
python scripts/ont-bench/fetch_sop_bench.py aircraft_inspection content_flagging customer_service \
  dangerous_goods email_intent know_your_business order_fulfillment patient_intake \
  referral_abuse_detection_v1 referral_abuse_detection_v2 traffic_spoofing_detection \
  video_annotation video_classification warehouse_package_inspection

# 2) 全量导入运行中的平台（进程内平台仓库 → 真实 PG + RLS）+ 回读校验
mate-platform-backend/.venv/Scripts/python.exe scripts/ont-bench/import_to_platform.py

# 3) 平台层关系/高级基元验证
mate-platform-backend/.venv/Scripts/python.exe scripts/ont-bench/platform_advanced_primitives.py

# 4) 内核层 SOP 逻辑复现
mate-platform-backend/.venv/Scripts/python.exe scripts/ont-bench/pilot_dangerous_goods.py
mate-platform-backend/.venv/Scripts/python.exe scripts/ont-bench/pilot_patient_intake.py
```

> 注：`--backend api` 走 HTTP 网关，因 F5 每条写入多付 ~700ms（2154 条约 26 分钟）；`--backend repo`（默认）用平台自身的 `PgOntologyRepository`（服务同款代码 + 真实 PG + RLS），39s 完成。

---

## 8. 建议

| 优先级 | 建议 | 对应 |
|---|---|---|
| P1 | 补 `GitFunctionResolver`/`OCIImageResolver`（或开放源码注入端点），使部署态能真正执行 Function | F1 |
| P2 | `create_link_instance` 传 `exclude_rid=row["rid"]`；异常翻译为 409；补回归测试 | F3/F6 |
| P2 | 统一 `filter_expr` 两后端语义（PG 支持 slug，或对未解析字段 fail-fast 而非静默空集） | F4 |
| P2 | 修复 embedding 凭证/端点，或对 embedding 失败降级为 fire-and-forget（不阻塞写入） | F5 |
| P3 | propose 不再把 `provenance` 折进 `parameters`；或 execute 显式忽略该键 | F2 |

---

## 9. 证据索引

| 产物 | 路径 |
|---|---|
| 全量导入统计（JSON） | `.tmp/sop-bench/import-stats.json` |
| 数据抓取器 | `scripts/ont-bench/fetch_sop_bench.py` |
| 全量导入 + 校验 | `scripts/ont-bench/import_to_platform.py` |
| 平台高级基元验证 | `scripts/ont-bench/platform_advanced_primitives.py` |
| 内核 pilot（单实体） | `scripts/ont-bench/pilot_dangerous_goods.py` |
| 内核 pilot（关系域） | `scripts/ont-bench/pilot_patient_intake.py` |
| API 探针 | `scripts/ont-bench/probe_platform_api.py` / `probe_platform_api2.py` |

---

## 10. 修复进展（2026-09-14 晚收口）

> 本报告是**时点快照**，保留当时发现。§5 列出的缺陷**已全部修复并验证**，
> 详见 `docs/active/specs/2026-09-14-ontology-engine-defect-fix-plan.md` 与 `docs/active/decisions/ADR-0063-function-source-resolution.md`。

| 原报告项 | 状态 | 关键结果 |
|---|---|---|
| F1 Function 源码不可注入 | ✅ | ADR-0063 S1–S5 落地；**部署态 e2e 跑通**（propose→confirm→execute 200 + 属性真实回写） |
| F2 propose 的 provenance 污染 | ✅ | execute 跳过保留键 |
| F3/F6 LinkInstance 重放 500 | ✅ | 传 `exclude_rid` + 409/422 映射 |
| F4 filter_expr 语义 | ✅ | **结论已修正**：普通 slug 本就正常，真正缺陷是未知字段**静默空集** → 现 fail-fast 422 |
| F5 embedding 401 | ✅ | 根因是 llmgw 取的 key 名不在 `ai.provider.` 命名空间（非凭证/URL/模型问题） |
| — 实施中新发现 | ✅ | **F8 跨租户读取泄漏（P0）** —— 应用层谓词 + ContextVar 修复；另实测确认并修复 2 处端点缺守门（`/functions/{rid}/versions`、`/object-types/{rid}/datasources`）；F7 迁移静默 no-op；F9 `/axioms` 500；F10 `audit_id` 撞主键 |
| — 复查更正 | ⚠️ | **RLS 在本环境不生效**（角色超级用户）；另发现 **16 处端点守门待审**（见修复计划 §5b F8） |

**部署态副作用（已处理）**：为加载修复重启了 `mate-tech-ont`；对 `metaplatform` 实测开启 RLS（26/28 张 `ont_*` 表）；
回填了 12 条历史 `ref://` 函数为 `inline://`（否则其 12 个 ActionType 会因 fail-fast 全部执行失败）。

> ⚠️ **RLS 在本环境实为装饰性**（2026-09-14 二次核查）：应用角色 `meta` 是
> `rolsuper+rolbypassrls`，PostgreSQL 超级用户**恒绕过 RLS**。开 RLS 前后行数一致是真的，
> 但 canary 被挡住**靠的是应用层租户谓词，不是 RLS**。租户隔离目前**完全压在应用层**；
> 需 GOVERN-09 的非特权角色才有第二道防线。详细更正见修复计划 §5b F8。

**最终回归**：`mate-kernel`+`mate-tech-ont` 1167 passed / 0 failed；`mate-tech-llmgw` 278 passed / 0 failed。
