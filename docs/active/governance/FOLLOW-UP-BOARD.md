# GOVERN-10 FOLLOW-UP Board — 67 个未收口测试失败跟踪

> 编制：2026-08-10（GOVERN-10 收口后）
> 父计划：`cozy-orbiting-wombat.md §3.3 GOVERN-10` + GOVERN-10-SUBSPEC.md §2
> 关联：`docs/active/governance/HARD-RULES-MATRIX.md` §3（67 个未收口）

GOVERN-10 收口时实测本仓库 pytest 失败 **73 个**，本批修 **6 个**（3 named race + 2 GBK + 1 NP），余下 **67 个** 转入本 Board，按所属范围拆为 4 个 FOLLOW-UP：

| ID | 范围 | 失败数 | 文件 | 状态 | 关联批次 |
|---|---|---:|---|---|---|
| FOLLOW-UP-A | OpenAPI securityScheme parity（copilot / marketplace / ont） | 40 | `infra/tests/test_g5_security_parity.py` (38) + `infra/tests/test_service_security_segments.py` (2) | Planned | TBD |
| FOLLOW-UP-B | MCP tool_categories PG fixture（host=`fake`） | 15 | `packages/mate-tech-mcp/tests/test_tool_categories.py` | Planned | TBD |
| FOLLOW-UP-C | copilot 跨租户 / NL2SQL / payload | 10 | `packages/mate-app-copilot/tests/` | Planned | TBD |
| FOLLOW-UP-D | llmgw 跨租户 / DoW / Anthropic | 3 | `packages/mate-tech-llmgw/tests/` | Planned | TBD |
| **合计** | | **67** | | | |

## FOLLOW-UP-A：OpenAPI securityScheme parity

**现象**：copilot / marketplace / ont 三份 OpenAPI yaml 多个 endpoint 缺 OIDC scopes，或把 write endpoint 标成 read-only。

**示例失败**：
- `test_oidc_scopes_valid_and_appropriate[copilot.yaml::POST /api/v1/copilot/ontology/graph/query]`
- `test_write_endpoints_not_read_only[marketplace.yaml::POST /api/v1/marketplace/install]`
- `test_security_schemes_well_formed[marketplace.yaml]`

**修复方向**：3 份 yaml 补 `x-required-scopes` / 区分 GET/POST；`scripts/validate_traceability.py` 加 `x-security-scheme` 字段校验。

## FOLLOW-UP-B：MCP tool_categories PG fixture

**现象**：测试假设 PG 在 host=`fake`，但本机无此 host。

**修复方向**：conftest 改 `MATE_PG_HOST` 环境变量；CI `docker compose up postgres -d` 等待 ready。

## FOLLOW-UP-C：copilot 跨租户 / NL2SQL

**现象**：10 个测试覆盖 tenant isolation / NL2SQL 危险语句 / oversized payload 拒绝，但实现未对齐。

**修复方向**：`packages/mate-app-copilot` 审计 `auth_middleware` + `nl2sql_validator` + `payload_validator`，与 `packages/mate-platform/tenancy/` 对齐。

## FOLLOW-UP-D：llmgw 跨租户 / DoW / Anthropic

**现象**：cross_tenant_quota_lookup 阻断未实现；DoW burst 未检测；real Anthropic provider call 需 API key。

**修复方向**：`packages/mate-tech-llmgw/quota.py` 跨租户隔离；`burst_detector.py` 实现；CI 用 mock provider。

## 跟踪机制

- 月度 ARCH-CORE 复核本 Board；新增失败必须在 7 天内立项 FOLLOW-UP-{A..D+1}
- CI 加 `tests/governance/test_skip_audit.py`：扫描 pytest skip 标记，禁止非 GOVERN-06 解释的 skip
- PROGRAM-BOARD.md「GOVERN-10 FOLLOW-UP」一行 `In Progress`，4 个子项 `Planned`

---

**关联**：GOVERN-10-SUBSPEC.md / HARD-RULES-MATRIX.md §3 / ADR-0015 §4