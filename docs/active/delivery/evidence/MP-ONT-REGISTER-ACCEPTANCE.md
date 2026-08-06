# MP-ONT-REGISTER-01 — Acceptance Evidence

**Date**：2026-08-06
**Branch**：`refactor/mp-ont-register-01`
**Author**：Codex
**Status**：✅ **Accepted**

## 范围

落地 `OntologyMarketplaceClient`（mate-clients）+ 解锁 `OntologyInstaller`（mate-platform），关闭 MARKETPLACE-CONSUMER-01 最后一个子 spec。

## 交付物

| # | 文件 | 状态 |
|---|---|---|
| 1 | `packages/mate-clients/src/mate_clients/marketplace/ontology.py` | NEW |
| 2 | `packages/mate-clients/tests/test_marketplace_ontology_client.py` | NEW |
| 3 | `packages/mate-platform/src/mate_platform/marketplace/jobs/installer_ontology.py` | M（去 blocked-on 标记）|
| 4 | `packages/mate-platform/tests/test_marketplace_installer_ontology.py` | NEW |
| 5 | `docs/active/decisions/ADR-0027-mp-ont-register-01.md` | NEW |
| 6 | `docs/active/delivery/PROGRAM-BOARD.md` | M（更新 MP-ONT-REGISTER-01 状态）|

## Canonical Endpoint

- `POST {base_url}/api/v1/ont/v2/object-types`（`mate-tech-ont` 默认端口 8007）
- operation_id：`ontPostV2ObjectType`（v4 RUNTIME-MVP-01 已落地）
- Payload：`ObjectTypeDTO { rid, primary_key, properties, display_name, interfaces }`

## Envelope

```python
{
    "rid": "ot.employee.1.0.0",          # 来自后端 / 客户端兜底
    "name": "example-object-type",       # 来自后端 display_name / manifest.name
    "registered_digest": "<sha256(blob)>",  # 后端回则用，否则客户端用 sha256(blob)
    "status": "registered",
}
```

满足硬规则 #14：`registered_digest == manifest.digest`。

## 测试矩阵

### mate-clients（OntologyMarketplaceClient）

| Test | 验证 |
|---|---|
| `test_register_ontology_posts_to_canonical_endpoint` | URL + BearerAuth + `X-Tenant-Id` header + envelope |
| `test_register_ontology_payload_shape` | 转发 `rid/primary_key/properties/display_name/interfaces` |
| `test_register_ontology_digest_fallback` | 后端不回 `registered_digest` 时客户端兜底 `sha256(blob)` |
| `test_set_tenant_rebinds_auth` | `set_tenant` 重新绑定 middleware，token 不变 |
| `test_register_ontology_without_auth_sends_no_auth_headers` | dev profile no-auth 路径 |
| `test_register_ontology_default_primary_key` | manifest 缺字段时默认 `primary_key=["id"]` |

**期望**：6 passed / 0 failed

### mate-platform（OntologyInstaller）

| Test | 验证 |
|---|---|
| `test_ontology_installer_happy_path` | digest verify + register + commit + installed file |
| `test_ontology_installer_digest_mismatch_rolls_back` | manifest.digest != sha256(blob) → DigestMismatch + rollback |
| `test_ontology_installer_hard_rule_14_rolls_back` | 后端 registered_digest != manifest.digest → DigestMismatch + rollback |
| `test_ontology_installer_real_client_returns_envelope` | 真实 OntologyMarketplaceClient + MockTransport 全链路 |

**期望**：4 passed / 0 failed

## 13 硬规则对位

| # | 规则 | 实施 |
|---|---|---|
| 3 | 没有 tenant 不访问 repository | dev profile 可无 auth；带 auth 必须 tenant_id |
| 4 | 外部系统必须有 ACL Client | `BearerAuth` + `OutgoingAuthMiddleware(tenant_id=...)` |
| 5 | Production profile 禁 fallback | digest 兜底仅 dev profile |
| 6 | 静态检查 ruff | ruff 0 errors |
| 12 | Secret 不进 git | 测试用 stub BearerAuth |
| 14 | registered_digest == manifest.digest | `BaseInstaller.run` 硬规则校验 |

## 验收运行（2026-08-07 实测）

```bash
# mate-clients
cd packages/mate-clients
ruff check src/mate_clients/marketplace/ontology.py tests/test_marketplace_ontology_client.py
# → All checks passed!

pytest tests/test_marketplace_ontology_client.py -v
# → 6 passed, 0 failed, 0 skipped

# mate-platform
cd packages/mate-platform
ruff check src/mate_platform/marketplace/jobs/installer_ontology.py tests/test_marketplace_installer_ontology.py
# → All checks passed!

pytest tests/test_marketplace_installer_ontology.py -v
# → 4 passed, 0 failed, 0 skipped

# 回归（三 installer 全量）
pytest tests/test_marketplace_installer_agent.py tests/test_marketplace_installer_mcp.py tests/test_marketplace_installer_ontology.py -q
# → 12 passed, 0 failed, 0 skipped
```

> 注：本机 `pytest-of-houuu` 临时目录 ACL 损坏导致 tmp_path fixture 报
> `PermissionError`，已通过 `PYTEST_DEBUG_TEMPROOT=C:\Users\houuu\AppData\Local\Temp\pytest-alt`
> 用户环境变量重定向绕过（2026-08-07 修复）。

## 后续

- MARKETPLACE-CONSUMER-01 → Accepted（最后一个子 spec 闭环）
- SEC-TENANT-01 owner 在 MARKETPLACE-CONSUMER-01 ACCEPTANCE 显式签字（marketplace_install 带 tenant_id 留痕）

## References

- ADR-0027（Accepted）
- ADR-0020 MARKETPLACE-CONSUMER-01（umbrella）
- ADR-0025 / ADR-0026（sibling patterns）
- ADR-0022 RUNTIME-MVP-01（canonical endpoint 来源）