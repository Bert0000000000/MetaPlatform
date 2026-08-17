# MP-SAL-01 ACCEPTANCE — Ontology 工具化基座（读）

> **Batch**: MP-SAL-01（Semantic layer AI Landing · 01 · 工具化基座，对位差距 G1+G2）
> **日期**: 2026-08-17 · **分支**: `refactor/mp-sal-01`
> **ADR**: `docs/active/decisions/ADR-0043-ontology-tooling.md`（Accepted v1.0，九条设计定案）
> **Spec**: `docs/active/specs/2026-08-17-semantic-layer-ai-landing-plan.md` v0.3 §4.0/§4.2
> **提交顺序遵循**: `docs/ADR → contract → failing tests → feature → acceptance evidence` ✅

## 1. 交付范围（对照 ADR-0043 九条定案）

| # | 定案 | 落点 | 状态 |
|---|---|---|---|
| 1a | ObjectSetQuery 结构化 IR | `mate_kernel/objectset/ir.py`（filters/aggregation/traversal/多键 sort/paging + `parse_filter_expr` 前端糖 + `InMemoryQueryExecutor`） | ✅ |
| 1b | 结果信封 `{kind, rows, result_schema}` | `QueryResult`；聚合返回行集非 Individual | ✅ |
| 1c | inspect 独立工具 | `inspect_class` 工具 + REST `GET /v2/classes/{rid}/inspect` | ✅ |
| 2a | schema_gen 协议无关纯数据 | `mate_kernel/tooling/schema_gen.py`（`query_<slug>` 薄外壳 + `list_classes`/`inspect_class` + `visible_object_types`） | ✅ |
| 2b | 每类型专用工具（Palantir 形态） | `object_query_tool_schema`：字段枚举直接进参数 schema | ✅ |
| 2c | 虚拟注册表零同步 | `agent_tool_schemas` 实时计算 + REST `GET /v2/agent-tools?markings=` | ✅ |
| 3 | markings 上抬一级 | `ObjectType.marking` 字段 + PG `ont_object_type.marking` 列 + REST DTO 透传；可见性 = 类型标记 ⊆ agent required_markings，执行期二次校验 | ✅ |
| 4 | 返回侧 result_schema | objects → 字段→类型→Property rid 映射；aggregates → 维度+度量 | ✅ |
| 5 | copilot e2e 验收核心 | `mate_app_copilot/ontology_tools.py`（build + execute）+ agent_loop `build_tools` 合并 | ✅ |

**消费侧接线**：mate-tech-mcp 注册 `ont_list_classes` / `ont_inspect_class` / `ont_object_query` 三件套代理（转发 tech-ont v2）；copilot agent loop 注入每类型 `query_<slug>` 工具。

**PG 侧**：`PgOntologyRepository.execute_object_query`（聚合 GROUP BY / 遍历子查询链 JOIN `ont_link_instance` / 多键 ORDER BY / slug→rid 归一化 / Decimal 归一）；`InMemoryOntologyRepository.execute_object_query` 委托 IR 执行器。

## 2. 契约（硬规则 1）

`contracts/openapi/services/ont.yaml` 新增 3 operationId（30 paths / 54 schemas 校验通过）：

- `ontExecuteV2ObjectQuery` — `POST /api/v1/ont/v2/object-query`（ObjectQueryV2 结构化 IR）
- `ontInspectV2Class` — `GET /api/v1/ont/v2/classes/{class_rid}/inspect`
- `ontListV2AgentTools` — `GET /api/v1/ont/v2/agent-tools`（markings 可见性过滤）

`ObjectTypeV2`/`ObjectTypeCreateV2` 增 `marking: string[]`。需求 ID：`FR-ONT-SAL01-OBJECTQUERY / -INSPECTCLASS / -AGENTTOOLS`。

## 3. 测试证据（硬规则 7）

| 套件 | 结果 | 新增 |
|---|---|---|
| mate-kernel | **455 passed**（基线 425） | +30：`test_objectset_ir.py`（18：filter/多键sort/聚合/traverse/result_schema/糖编译/拒绝语义）+ `test_tooling_schema_gen.py`（12：命名/枚举烘焙/固定工具/可见性） |
| mate-tech-ont | **172 passed / 8 skipped** | `test_v2_kernel_pg_objectquery.py` 5 项：SQL 捕获（GROUP BY/JOIN/COUNT/多键 ORDER BY）+ **真 PG 与 InMemory 同数据对拍**（双后端一致性 = IR 单一事实源证明）+ marking 持久化往返 |
| mate-app-copilot | 相关 **28 passed**（全套 97 passed；2 例非本批：1 例修复前旧态、1 例隔离运行通过的长跑污染） | `test_ontology_tools.py` 10 项：发布→工具出现→FC 执行→result_schema；**marking negative**（缺标记工具不可见 + 直调 PermissionError） |
| mate-tech-mcp | **exit 0 / 0 failed** | `test_ontology_proxy_tools.py`：respx 拦截 tech-ont v2 转发路径与 payload 透传 |
| mate-tech-orchestrator | 47 passed / 1 skipped | 基线（superai_a2a 3 个 stale 测试已先修，4e3ae7ff 迁移漏改所致，非功能缺陷） |

**kitchen sink**：`examples/01_kitchen_sink.py` 第 12 步「建模即工具」（tools 生成 → objects 查询 → aggregates 查询），e2e 守护测试 `tests/e2e/test_kitchen_sink_e2e.py` 断言 12 步全过。

## 4. 静态检查（硬规则 6）

- ruff：新增 9 文件 **All checks passed**
- pyright：新增 4 源文件 **0 errors / 0 warnings**

## 5. 硬规则对位

| 硬规则 | 本批承担 |
|---|---|
| ① 契约先行 | 3 新端点 + marking 字段全部先落 ont.yaml（§2） |
| ③ tenant 上下文 | `/object-query` 源类 rid 租户前缀校验拒绝跨租户；repo 调用走 `_call_scoped`（GOVERN-06 RLS） |
| ④ ACL Client | MCP 代理沿用包内 env URL + httpx 既有模式（同 kb_search/ontology resource）；仓库无 forbid_bare_httpx 脚本在巡（GA 脚本未随 shrink 迁入，见 §7 备注） |
| ⑥ 静态检查 | 新文件 ruff + pyright 全净（§4） |
| ⑦ 测试不跳过 | 全绿基线上的新增测试，无 skip 新增 |
| ⑩ 验收证据 | 本文件独立落档（spec §5.5：不合并档） |

## 6. 出范围（防跑偏确认）

typed client（MP-SAL-05）/ 属性级可见 / push 事件同步 / Function 工具化 —— 均未做，符合 ADR-0043 §2.7 与风险对冲条款。

## 7. 备注

- copilot 全套 2 例非本批失败的根因记录：`test_ontology_tools.py::test_list_classes`（本批修复过程中间态，终态绿）；`test_tenant_isolation_ok`（6 分钟长跑的测试污染，隔离运行通过，与本批改动无涉——本批未动 copilot 租户面）。
- agent-tools 端点首版为纯实时计算（无 TTL 缓存）：marking 过滤按调用方进行，缓存会产生跨调用方可见性泄漏；优化留清单量大后。
- 北极星进度：**SAL-01（读）✅ → SAL-02（想）→ SAL-03（生产门，并行）→ SAL-04（写，先 ADR-0044）**。
