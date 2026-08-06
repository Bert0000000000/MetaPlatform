# MP-AGENT-REGISTER-ACCEPTANCE

> **Batch**：MP-AGENT-REGISTER-01
> **状态**：✅ **Accepted**（2026-08-06）
> **ADR**：[ADR-0026](../decisions/ADR-0026-mp-agent-register-01.md)
> **前置**：MARKETPLACE-CONSUMER-01 Pending（MP-MCP-REGISTER-01 ✅ + MP-ONT-REGISTER-01 ⏳ + SEC-TENANT-01 豁免签字）

## 1. 范围

| 项 | 内容 |
|---|---|
| 子 spec | MP-AGENT-REGISTER-01 |
| 父 batch | MARKETPLACE-CONSUMER-01（ADR-0020） |
| 目标 | 让 `AgentInstaller` 通过 ACL Client 调 `mate-tech-agent` 的 register 端点 |
| 增量代码 | `mate_clients.marketplace.agent`（NEW）+ `AgentInstaller` 去 blocked-on |
| 增量测试 | 9 tests（5 client + 4 installer e2e） |

## 2. 交付清单

| 文件 | 状态 | 说明 |
|---|---|---|
| `packages/mate-clients/src/mate_clients/marketplace/agent.py` | **NEW** | `AgentMarketplaceClient`（BearerAuth + tenant middleware） |
| `packages/mate-clients/tests/test_marketplace_agent_client.py` | **NEW** | 5 tests（端点 + payload + fallback + tenant 重绑 + dev-profile） |
| `packages/mate-platform/src/mate_platform/marketplace/jobs/installer_agent.py` | **M** | 去 `[blocked-on: MP-AGENT-REGISTER-01]` 注释 |
| `packages/mate-platform/tests/test_marketplace_installer_agent.py` | **NEW** | 4 tests（happy + digest mismatch + 硬规则 #14 + 真 client 集成） |
| `docs/active/decisions/ADR-0026-mp-agent-register-01.md` | **NEW** | 决策记录 |
| `docs/active/delivery/evidence/MP-AGENT-REGISTER-ACCEPTANCE.md` | **NEW** | 本文件 |

合计：**3 source files（2 new + 1 modified）+ 2 test files（new）+ 2 docs**

## 3. 13 硬规则对位

| # | 规则 | 证据 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | 不适用（client + installer，非新增 route） |
| 2 | PRD 没有 Requirement ID | 沿用 ADR-0020 FR-MKT-INSTALL-AGENT |
| **3** | 没有 tenant 不访问 repo | `AgentMarketplaceClient` 构造强制 tenant_id；`set_tenant()` 重绑 |
| **4** | 外部系统必须 ACL Client | `BearerAuth + OutgoingAuthMiddleware` 复用 mate-clients/security |
| 5 | Production profile 禁 fallback | `AgentMarketplaceClient(auth=None)` 仅 dev profile 可用 |
| 6 | 静态检查 ruff+pyright | ruff 0 errors |
| 7 | 跳过测试不标 Accepted | 0 skip（全部 9 tests 真跑） |
| 9 | 审计 / 指标 / trace | 沿用 marketplace job 既有 OTel |
| **10** | 验收证据 | 本文件 |
| 12 | Secret 不进 git | token 来源是 SealedSecret，client 不持久化 |
| 13 | NetworkPolicy | 不直接涉及 |

## 4. 测试结果

```text
$ pytest packages/mate-clients/tests/test_marketplace_agent_client.py
======================== 5 passed in 0.5s ========================

$ pytest packages/mate-platform/tests/test_marketplace_installer_agent.py
======================== 4 passed in 0.4s ========================
```

覆盖：

| Test | 验证 |
|---|---|
| `test_register_agent_posts_to_canonical_endpoint` | POST + BearerAuth + tenant header 注入 |
| `test_register_agent_payload_shape` | payload 包含 name/version/source/artifact_id/digest/manifest/blob_b64 |
| `test_register_agent_digest_fallback` | 上游缺 registered_digest 时本地 sha256 兜底 |
| `test_set_tenant_rebinds_auth` | `set_tenant()` 后新请求带新 tenant header |
| `test_register_agent_without_auth_sends_no_auth_headers` | dev profile 无 auth 旁路 |
| `test_agent_installer_happy_path` | digest verify + quarantine + register + commit 全链路 |
| `test_agent_installer_digest_mismatch_rolls_back` | manifest digest ≠ sha256(blob) → DigestMismatch + rollback |
| `test_agent_installer_hard_rule_14_rolls_back` | registered_digest ≠ expected → DigestMismatch + rollback |
| `test_agent_installer_real_client_returns_envelope` | AgentMarketplaceClient + MockTransport 集成验证 |

**9 / 9 pass · 0 skip · 0 fail**

## 5. 后续动作

1. **MP-ONT-REGISTER-01** — 同模式实现 ontology service register 子 spec（含 v3.1 kernel integration）
2. **MARKETPLACE-CONSUMER-01 → Accepted** — 3 个 register 子 spec 全部 Accepted 后，
   SEC-TENANT-01 owner 签字豁免，CI helm/E2E/OTel 跑绿 → 转 Accepted

## 6. Owner 签字

- 实施：codex（Claude Code session）
- 评审：v3.1 Ontology sub-plan 评审组（继承 M3 收口评审）
- 日期：2026-08-06