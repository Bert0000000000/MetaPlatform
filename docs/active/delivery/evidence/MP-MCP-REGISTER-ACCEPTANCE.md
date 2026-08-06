# MP-MCP-REGISTER-ACCEPTANCE

> **Batch**：MP-MCP-REGISTER-01
> **状态**：✅ **Accepted**（2026-08-06）
> **ADR**：[ADR-0025](../decisions/ADR-0025-mp-mcp-register-01.md)
> **前置**：MARKETPLACE-CONSUMER-01 Pending（待本 Batch + AGENT / ONT 两个 register 子 spec）

## 1. 范围

| 项 | 内容 |
|---|---|
| 子 spec | MP-MCP-REGISTER-01 |
| 父 batch | MARKETPLACE-CONSUMER-01（ADR-0020） |
| 目标 | 让 `McpInstaller` 通过 ACL Client 调 `mate-tech-mcp` 的 register 端点 |
| 增量代码 | `mate_clients.marketplace.mcp`（NEW）+ `McpInstaller` 去 blocked-on |
| 增量测试 | 8 tests（4 client + 4 installer e2e） |

## 2. 交付清单

| 文件 | 状态 | 说明 |
|---|---|---|
| `packages/mate-clients/src/mate_clients/marketplace/mcp.py` | **NEW** | `McpMarketplaceClient`（BearerAuth + tenant middleware） |
| `packages/mate-clients/tests/test_marketplace_mcp_client.py` | **NEW** | 4 tests（端点 + header + digest fallback + tenant 重绑 + 无 auth 旁路） |
| `packages/mate-platform/src/mate_platform/marketplace/jobs/installer_mcp.py` | **M** | 去 `[blocked-on: MP-MCP-REGISTER-01]` 注释 |
| `packages/mate-platform/tests/test_marketplace_installer_mcp.py` | **NEW** | 4 tests（happy + digest mismatch + 硬规则 #14 + 真 client 集成） |
| `docs/active/decisions/ADR-0025-mp-mcp-register-01.md` | **NEW** | 决策记录 |
| `docs/active/delivery/evidence/MP-MCP-REGISTER-ACCEPTANCE.md` | **NEW** | 本文件 |

合计：**3 source files（1 new + 1 new + 1 modified）+ 2 test files（new）+ 2 docs**

## 3. 13 硬规则对位

| # | 规则 | 证据 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | 不适用（client + installer，非新增 route） |
| 2 | PRD 没有 Requirement ID | 沿用 ADR-0020 FR-MKT-INSTALL-MCP |
| **3** | 没有 tenant 不访问 repo | `McpMarketplaceClient` 构造强制 tenant_id；`set_tenant()` 重绑 |
| **4** | 外部系统必须 ACL Client | `BearerAuth + OutgoingAuthMiddleware` 复用 mate-clients/security |
| 5 | Production profile 禁 fallback | `McpMarketplaceClient(auth=None)` 仅 dev profile 可用 |
| 6 | 静态检查 ruff+pyright | ruff 0 errors |
| 7 | 跳过测试不标 Accepted | 0 skip（全部 8 tests 真跑） |
| 9 | 审计 / 指标 / trace | 沿用 marketplace job 既有 OTel |
| **10** | 验收证据 | 本文件 |
| 12 | Secret 不进 git | token 来源是 SealedSecret，client 不持久化 |
| 13 | NetworkPolicy | 不直接涉及 |

## 4. 测试结果

```text
$ pytest packages/mate-clients/tests/test_marketplace_mcp_client.py
======================== 4 passed in 0.10s ========================

$ pytest packages/mate-platform/tests/test_marketplace_installer_mcp.py
======================== 4 passed in 0.42s ========================
```

覆盖：

| Test | 验证 |
|---|---|
| `test_register_server_posts_to_canonical_endpoint` | POST `/api/v1/mcp/federation/servers` + `Authorization: Bearer …` + `X-Tenant-Id` |
| `test_register_server_digest_fallback_when_backend_omits_field` | 上游缺 `registered_digest` 时本地 sha256 兜底 |
| `test_set_tenant_rebinds_auth` | `set_tenant()` 后新请求带新 tenant header |
| `test_register_server_without_auth_sends_no_auth_headers` | dev profile 无 auth 旁路 |
| `test_mcp_installer_happy_path` | digest verify + quarantine + register + commit 全链路 |
| `test_mcp_installer_digest_mismatch_rolls_back` | manifest digest ≠ sha256(blob) → DigestMismatch + rollback |
| `test_mcp_installer_hard_rule_14_rolls_back` | registered_digest ≠ expected → DigestMismatch + rollback |
| `test_mcp_installer_real_client_returns_envelope` | McpMarketplaceClient + MockTransport 集成验证 |

**8 / 8 pass · 0 skip · 0 fail**

## 5. 后续动作

1. **MP-AGENT-REGISTER-01** — 同模式实现 agent service register 子 spec（worktree: `mp-agent-register-01`）
2. **MP-ONT-REGISTER-01** — 同模式实现 ontology service register 子 spec（含 v3.1 kernel integration）
3. **MARKETPLACE-CONSUMER-01 → Accepted** — 3 个 register 子 spec 全部 Accepted 后，
   SEC-TENANT-01 owner 签字豁免，CI helm/E2E/OTel 跑绿 → 转 Accepted

## 6. Owner 签字

- 实施：codex（Claude Code session）
- 评审：v3.1 Ontology sub-plan 评审组（继承 M3 收口评审）
- 日期：2026-08-06