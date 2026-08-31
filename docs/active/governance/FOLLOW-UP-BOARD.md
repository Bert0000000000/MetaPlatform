# GOVERN-10 FOLLOW-UP Board — 历史失败跟踪与 Sprint 0 收口

> 编制：2026-08-10；本次复核：2026-08-27
> 父计划：`cozy-orbiting-wombat.md §3.3 GOVERN-10` + GOVERN-10-SUBSPEC.md §2
> 关联：`docs/active/governance/HARD-RULES-MATRIX.md` §3（67 个未收口）

GOVERN-10 收口时实测本仓库 pytest 失败 **73 个**，本批修 **6 个**（3 named race + 2 GBK + 1 NP）。原 Board 汇总写 **67 个**，但四行明细相加为 **68 个**；本次保留原始登记口径，并以各 FOLLOW-UP 的确定性门禁结果为当前事实源。

| ID | 范围 | 历史登记 | 文件 | 状态 | 证据 | 关联批次 |
|---|---|---:|---|---|---|---|
| FOLLOW-UP-A | OpenAPI securityScheme parity（copilot / marketplace / ont） | 40 | `infra/tests/test_g5_security_parity.py` + `infra/tests/test_service_security_segments.py` | **Accepted（focused gate）** | `evidence/FOLLOW-UP-A-ACCEPTANCE.md` | Task 1 |
| FOLLOW-UP-B | MCP tool_categories PG fixture（host=`fake`） | 15 | `packages/mate-tech-mcp/tests/test_tool_categories.py` | **Accepted（focused gate）** | `evidence/FOLLOW-UP-B-ACCEPTANCE.md` | Task 2 |
| FOLLOW-UP-C | copilot 跨租户 / NL2SQL / payload / prompt / A2A | 10 | `packages/mate-app-copilot/tests/` | **Accepted（focused gate）** | `evidence/FOLLOW-UP-C-ACCEPTANCE.md` | Tasks 3/5/6 |
| FOLLOW-UP-D | llmgw 跨租户 / DoW / Anthropic / quota | 3 | `packages/mate-tech-llmgw/tests/` | **Accepted（focused gate）** | `evidence/FOLLOW-UP-D-ACCEPTANCE.md` | Tasks 4/7 |
| **合计（原始明细）** | | **68** | | | | |

## FOLLOW-UP-A：OpenAPI securityScheme parity

**结果**：copilot / marketplace / ont 三份 OpenAPI yaml 已按 canonical 21-service inventory 和 operation-level scope 规则收口。

**示例失败**：
- `test_oidc_scopes_valid_and_appropriate[copilot.yaml::POST /api/v1/copilot/ontology/graph/query]`
- `test_write_endpoints_not_read_only[marketplace.yaml::POST /api/v1/marketplace/install]`
- `test_security_schemes_well_formed[marketplace.yaml]`

**证据**：`evidence/FOLLOW-UP-A-ACCEPTANCE.md`。遗留的 `/mcp-protocol` legacy path 迁移仍是独立 API migration item，不被本 focused gate 隐藏。

## FOLLOW-UP-B：MCP tool_categories PG fixture

**结果**：tool-category CRUD 测试已与完整 streamable MCP app 解耦，SQL-store 验证改为本地 SQLite。

**证据**：`evidence/FOLLOW-UP-B-ACCEPTANCE.md`。

## FOLLOW-UP-C：copilot 跨租户 / NL2SQL

**结果**：Copilot SQL/session guard、payload/prompt leak guard 和真实 A2A target authorization 已完成 focused gate。

**证据**：`evidence/FOLLOW-UP-C-ACCEPTANCE.md`。

## FOLLOW-UP-D：llmgw 跨租户 / DoW / Anthropic

**结果**：LLMGW management tenant guard、Redis quota wiring、DoW 和 mock provider boundary 已完成 focused gate。

**证据**：`evidence/FOLLOW-UP-D-ACCEPTANCE.md`。没有把外部 provider credentials 或 live Redis 当作测试前提。

## 跟踪机制

- 月度 ARCH-CORE 复核本 Board；新增失败必须在 7 天内立项 FOLLOW-UP-{A..D+1}
- CI 加 `tests/governance/test_skip_audit.py`：扫描 pytest skip 标记，禁止非 GOVERN-06 解释的 skip
- 4 个子项已完成 focused acceptance；全仓收集/集成基线仍需随 Sprint 0 统一验证，不得由 focused gate 推导生产 GA。

---

**关联**：GOVERN-10-SUBSPEC.md / HARD-RULES-MATRIX.md §3 / ADR-0015 §4
