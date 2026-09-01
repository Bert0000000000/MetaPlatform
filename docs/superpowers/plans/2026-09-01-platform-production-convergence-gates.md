# Platform Production Convergence Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为业务 MVP 实际启用的目标组件建立锁版、兼容、许可证、迁移、故障和恢复证据，使受控 MVP 能逐项转为生产能力。

**Architecture:** 本计划不是独立“平台底座阶段”，也不要求先于 MVP1 全部执行。每项 Gate 只在对应组件首次进入生产路径前执行；失败时保留当前兼容路径并关闭该项生产声明，不能用自研替代物绕过架构评审。

**Tech Stack:** Helm/Kustomize、Kubernetes/RKE2、Supabase Auth、Keycloak（精确安全 patch；2026-09-01 验证基线 26.7.3）、OpenFGA/OPA、LiteLLM、RAGFlow、Valkey、Infinity、SeaweedFS、MemoryCore、Jena、Trino/Iceberg/Polaris、OpenBao、CloudNativePG/Barman Cloud Plugin、OpenTelemetry/OpenSearch、OCI/ORAS/Cosign/Trivy、Flux。

**Spec:** `docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md`

## Global Constraints

- Gate 结果只能是 `PASSED`、`FAILED` 或 `NOT_EXERCISED`，不能把未测试能力记为通过。
- 非 Gate 的产品能力状态使用独立 `capability_status`：`SUPPORTED`、`NOT_SUPPORTED` 或 `NOT_IN_RUNTIME`；它不能写入或替代 Gate `status`。
- 每个 Gate 固定上游 version/commit、container Digest、配置 Digest、SBOM、许可证、测试环境、Git SHA 和 checked_at。
- 失败 Gate 不阻断不依赖它的受控业务 MVP，但阻断对应生产声明、流量切换和旧组件退役。
- 迁移必须保留消费者清单、ID/数据映射、双读/桥接、校验水位和回滚路径。
- 禁止通过分叉上游核心、启用商业目录或加入未批准许可证来“修复”Gate。
- 文中直接运行工作区 venv、pnpm 或模板命令只用于 TDD/开发 preflight，不能写入 `PASSED` 证据；生产 Gate 状态只能由 Digest 锁定的 `test-production-gate.ps1`/`run-plan-tool.ps1` 路径更新。

---

### Task 1: 建立统一 Gate 证据格式和 CI 门

**Files:**
- Create: `acceptance/gates/schema.json`
- Create: `acceptance/gates/environment-schema.json`
- Create: `acceptance/gates/component-matrix.yaml`
- Create: `acceptance/toolchain.lock.yaml`
- Create: `infra/images/plan-toolchain/Dockerfile`
- Create: `scripts/build-plan-toolchain.ps1`
- Create: `scripts/run-plan-tool.ps1`
- Create: `scripts/test-production-gate.ps1`
- Create: `infra/kind/production-gate-cluster.yaml`
- Create: `scripts/verify-production-gates.py`
- Create: `mate-platform-backend/tests/architecture/test_production_gate_evidence.py`
- Modify: `.github/workflows/ga-acceptance.yml`

**Interfaces:**
- Produces: `verify_gate(path: Path) -> GateResult`; matrix key `(gate_id, component, version, image_digest, config_digest)`; exception-safe `test-production-gate.ps1 -Gate <allowlisted-id>` live runner.

- [ ] **Step 1: Write a failing incomplete-evidence test**

```python
def test_passed_gate_requires_sbom_restore_and_failure_evidence():
    gate = load_gate({"status": "PASSED", "version": "1.0"})
    assert validate(gate).codes == {
        "IMAGE_DIGEST_REQUIRED", "SBOM_REQUIRED", "RESTORE_EVIDENCE_REQUIRED", "FAILURE_TEST_REQUIRED"
    }
```

- [ ] **Step 2: Run the architecture test**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_production_gate_evidence.py -q`

Expected: FAIL before schema/verifier creation.

- [ ] **Step 3: Implement schema, verifier and CI invocation**

Require owner, business consumers, current/target endpoints, version/commit, image/config Digests, source/license URLs, transitive SBOM, compatibility commands/results, security checks, backup/restore, failure injection, migration/rollback and status. Every matrix row has a unique `gate_id`, fixed repository-relative `evidence_file` and explicit `parent_gate_ids`. CI rejects `PASSED` when evidence is absent, older than its image/config Digest, names a different Gate, or references a non-PASSED parent; it also scans `acceptance/gates/*.yaml` and rejects orphan evidence, duplicate IDs and files not registered in the matrix. `environment-schema.json` records immutable environment identity, cluster UID, provider/account/region/zone, node/storage failure domain, object endpoint and attesting operator; a Gate that requires independent domains rejects equal or unproven domain IDs.

Build a locked CI tool image containing exact Python 3.12/uv, Node/Corepack/pnpm, Playwright browser/runtime, Docker CLI + Compose plugin, PowerShell, Helm, kubeconform, OPA, ORAS, Cosign, Trivy, Syft, kubectl, Kind and required Kubernetes/RKE2 clients; store every binary/package/browser version/checksum and the final image Digest. `run-plan-tool.ps1` resolves the immutable image reference from `acceptance/toolchain.lock.yaml`, verifies the local/remote manifest Digest, refuses a tag-only image, and mounts only explicitly requested workspace/Docker-socket inputs before running a tool. Production Gate runners use this wrapper for Python, Node, Playwright, Compose and Kubernetes commands; ordinary MVP developer tests may use the repository venv/pnpm lock but cannot produce production Gate evidence.

`test-production-gate.ps1` owns every live Gate lifecycle. For compose-only Gates it creates a unique project; for Kubernetes Gates it creates the required ephemeral cluster(s) from locked node images, installs the selected charts, waits for actual component readiness, exports endpoints only to the child test process, runs migration/compatibility/security/failure-injection/restore/rollback tests with JUnit evidence, collects logs/manifests, and deletes its own project/cluster in `finally`. Its allowlist is exactly the registered Gate IDs: `identity-supabase-keycloak`, `litellm-open-source`, `object-storage`, `knowledge-memory-ontology`, `cnpg-barman-backup`, `storage-catalog-backup`, `audit-supply-chain`, `registry-trust`, `platform-foundation`, `tenant-employee-runtime`, `authorization-openfga-opa`, `messaging-nats-temporal`, `observability-stack`, `business-services`, `tenant-runtime-composition` and `disconnected-cell-hosts`. `-WithDependencies` resolves `parent_gate_ids` topologically and executes/revalidates every selected child before the parent; an unknown or missing Gate ID fails. No Gate can pass from mocked clients or `helm template` alone.

The initial matrix fixes the dependency DAG rather than inferring it from task order: `knowledge-memory-ontology → object-storage`; `cnpg-barman-backup → object-storage`; `storage-catalog-backup → {object-storage, cnpg-barman-backup}`; `platform-foundation → {cnpg-barman-backup, registry-trust, audit-supply-chain}`; `tenant-employee-runtime → {platform-foundation, identity-supabase-keycloak, object-storage, audit-supply-chain}`; `authorization-openfga-opa → {platform-foundation, identity-supabase-keycloak, audit-supply-chain}`; `messaging-nats-temporal → {platform-foundation, cnpg-barman-backup, audit-supply-chain}`; `observability-stack → {platform-foundation, object-storage, audit-supply-chain}`; `business-services → {tenant-employee-runtime, authorization-openfga-opa, messaging-nats-temporal, registry-trust}`; `tenant-runtime-composition → {platform-foundation, tenant-employee-runtime, authorization-openfga-opa, messaging-nats-temporal, registry-trust, observability-stack, business-services}`; `disconnected-cell-hosts → {tenant-runtime-composition, platform-foundation, registry-trust}`. `identity-supabase-keycloak`, `litellm-open-source`, `object-storage`, `audit-supply-chain` and `registry-trust` are roots. A deployment profile may add `knowledge-memory-ontology` or `storage-catalog-backup` to TenantRuntime parents when selected, but cannot remove a listed parent.

- [ ] **Step 4: Build/lock the toolchain and run verifier against the initial all-closed matrix**

Run: `pwsh -File scripts/build-plan-toolchain.ps1 -LockFile acceptance/toolchain.lock.yaml`

Run: `pwsh -File scripts/run-plan-tool.ps1 -- helm version`

Run: `mate-platform-backend/.venv/Scripts/python.exe scripts/verify-production-gates.py acceptance/gates/component-matrix.yaml`

Expected: PASS schema validation with target component Gate `status=NOT_EXERCISED`; the separate capability row records `executable_skill_runtime.capability_status=NOT_SUPPORTED`, and the verifier proves that valid signature/SBOM evidence cannot change it or promote a Gate without a separately approved sandbox Gate; no component is reported production-ready.

- [ ] **Step 5: Commit gate evidence infrastructure**

```bash
git add acceptance/gates/schema.json acceptance/gates/environment-schema.json acceptance/gates/component-matrix.yaml acceptance/toolchain.lock.yaml infra/images/plan-toolchain/Dockerfile infra/kind/production-gate-cluster.yaml scripts/build-plan-toolchain.ps1 scripts/run-plan-tool.ps1 scripts/test-production-gate.ps1 scripts/verify-production-gates.py mate-platform-backend/tests/architecture/test_production_gate_evidence.py .github/workflows/ga-acceptance.yml
git commit -m "test(platform): require production gate evidence"
```

### Task 2: 验证并迁移 Supabase Auth → Keycloak 身份链

**Files:**
- Create: `infra/helm/charts/supabase-auth/Chart.yaml`
- Create: `infra/helm/charts/supabase-auth/values.yaml`
- Modify: `infra/helm/charts/keycloak/Chart.yaml`
- Modify: `infra/helm/charts/keycloak/values.yaml`
- Create: `infra/compose/test-identity-chain.yml`
- Create: `scripts/test-identity-chain.ps1`
- Create: `infra/keycloak/realm/identity-broker.json`
- Create: `mate-platform-backend/services/auth-service/src/mate_auth_service/supabase_broker.py`
- Create: `mate-platform-backend/services/auth-service/tests/test_supabase_keycloak_chain.py`
- Create: `mate-platform-backend/tests/security/test_runtime_token_claims.py`
- Create: `acceptance/gates/identity-supabase-keycloak.yaml`

**Interfaces:**
- Consumes: Supabase OAuth/OIDC discovery/JWKS and a current security-supported, Digest-pinned Keycloak patch (2026-09-01 validation baseline: 26.7.3) for OIDC Identity Brokering/Token Exchange. JWT Authorization Grant is a separate conditional noninteractive sub-gate.
- Produces: short runtime token with the exact claims defined in Architecture §7.1 and an external-identity mapping `(supabase_iss, sub) -> keycloak_link -> platform_user_id`.

- [ ] **Step 1: Write end-to-end claim, replay and revocation tests**

```python
async def test_brokered_login_is_exchanged_for_downscoped_runtime_token(chain):
    code = await chain.login_with_pkce(prelinked_supabase_user())
    token = await chain.exchange_code(code, audience="order-mcp", scopes={"order:read"})
    claims = verify(token)
    assert required_runtime_claims() <= claims.keys()
    assert claims["aud"] == "order-mcp"

async def test_nonce_replay_wrong_audience_and_unlinked_user_are_rejected(chain):
    assert (await chain.replay_authorization_response()).error_code == "OIDC_NONCE_REPLAY"
    assert (await chain.login_with_token(id_token(aud="another-client"))).error_code == "OIDC_AUDIENCE_INVALID"
    assert (await chain.login_with_token(unlinked_user_id_token())).error_code == "IDENTITY_NOT_LINKED"
```

- [ ] **Step 2: Start and run the pinned Supabase/Keycloak identity composition**

Pin `quay.io/keycloak/keycloak:26.7.3` and resolve/store its registry Digest in Gate evidence before deployment; configuration may not use a floating major/minor tag. On later execution, a newer security-supported patch may replace it only by updating the lock/evidence and rerunning the full Gate. The compose project contains isolated PostgreSQL databases, Supabase Auth/OAuth, the locked Keycloak image and test callback client. `test-identity-chain.ps1` is a lower-level helper called by the unified Gate runner; it creates a prelinked de-identified user and writes non-secret endpoints.

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate identity-supabase-keycloak`

Expected: FAIL until broker mapping and claims are implemented. The runner executes real code+PKCE/token exchange, JWKS/revocation, outage and clean restore tests and always tears down in `finally`.

- [ ] **Step 3: Implement broker mapping without a second user authority**

Supabase Auth remains human profile/login authority; Keycloak stores only external identity links and service/runtime clients. The primary path uses Authorization Code + PKCE through Keycloak Identity Brokering. Validate discovery, issuer, subject, client audience, nonce, expiry and asymmetric signature; require administrator/provisioning prelink before first login, test Supabase signing-key overlap/rotation, then perform internal Token Exchange with downscoped audience. Maintain policy/assignment/revocation watermarks; do not accept client-supplied identity claims.

Enable JWT Authorization Grant only if the locked Supabase deployment proves a documented method to acquire a signed assertion whose `aud` is the Keycloak token endpoint, with one-time `jti` persisted for replay prevention. A Supabase access token or ID Token for the browser client is not that assertion. If this sub-gate fails, record `JWT_GRANT=FAILED` while the OIDC broker path may still pass; do not invent a custom STS.

- [ ] **Step 4: Run rollback and current-Keycloak compatibility tests**

Migrate a de-identified user sample, prove stable `(iss, sub) → keycloak_link → platform_user_id`, rotate Supabase JWKS keys with overlap and removal, revoke a Supabase session and assignment, back up/restore Keycloak realm/database, simulate central outage/TTL expiry, then route the sample back to the current Keycloak compatibility path without changing business resource ownership.

Expected: R0 follows configured offline policy; R1-R4 fail closed after token/watermark expiry; rollback restores login for mapped users.

- [ ] **Step 5: Record evidence and commit only after the live chain passes**

```bash
git add infra/helm/charts/supabase-auth infra/helm/charts/keycloak infra/compose/test-identity-chain.yml infra/keycloak/realm/identity-broker.json scripts/test-identity-chain.ps1 mate-platform-backend/services/auth-service/src/mate_auth_service/supabase_broker.py mate-platform-backend/services/auth-service/tests/test_supabase_keycloak_chain.py mate-platform-backend/tests/security/test_runtime_token_claims.py acceptance/gates/identity-supabase-keycloak.yaml
git commit -m "feat(identity): broker supabase users into runtime tokens"
```

### Task 3: 准入 LiteLLM Model/MCP/A2A 开源路径

**Files:**
- Create: `infra/helm/charts/litellm/Chart.yaml`
- Create: `infra/helm/charts/litellm/values.yaml`
- Create: `infra/images/litellm/Dockerfile`
- Create: `infra/images/litellm/requirements.lock`
- Create: `scripts/build-litellm-oss.ps1`
- Create: `mate-platform-backend/tests/compatibility/test_litellm_model_mcp_a2a.py`
- Create: `scripts/verify-litellm-mit-boundary.py`
- Create: `acceptance/inventory/litellm-runtime-imports.json`
- Create: `acceptance/inventory/litellm-runtime-wheels.json`
- Create: `acceptance/gates/litellm-open-source.yaml`

**Interfaces:**
- Produces: independent logical endpoints for Model, MCP and A2A with a shared pinned image only when import/license and fault-domain requirements pass.

- [ ] **Step 1: Write protocol and no-enterprise-import tests**

```python
def test_runtime_image_does_not_import_enterprise(scan_result):
    assert not any(path.startswith("enterprise/") for path in scan_result.imported_paths)

async def test_a2a_task_polling_and_streaming_are_interoperable(gateway, reference_agent):
    task = await gateway.send(reference_agent.card, payload())
    assert await gateway.poll(task.id) == await gateway.collect_stream(task.id)
```

- [ ] **Step 2: Run Model/MCP/A2A compatibility independently**

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/compatibility/test_litellm_model_mcp_a2a.py -q`

Expected: each role reports its own result; A2A failure does not mark Model/MCP failed or passed by association.

- [ ] **Step 3: Pin image/commit and generate import graph plus SBOM**

Build only from the exact MIT source commit and hashed wheel lock. `build-litellm-oss.ps1` produces the final runtime image, then executes representative Model/MCP/A2A requests under Python import tracing. Record every imported module path, installed wheel name/version/hash/license and final image file manifest; reject any `enterprise/` path, editable source, unpinned URL/VCS dependency or wheel absent from the lock. Generate SBOM from the final image Digest, not the build context. Configure OAuth, tenant routing, budgets and audit only with features proven present in that exact image.

- [ ] **Step 4: Exercise failure isolation and current-gateway rollback**

Kill each logical gateway, verify no implicit direct-to-provider/server bypass, preserve Run state, then restore. Mirror a bounded sample, compare ModelReceipt/MCP outputs, and prove route rollback to the current gateway. A2A remains `FAILED` until task polling, streaming and reference-agent interoperability pass.

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate litellm-open-source`

Expected: the runner builds the exact final image, verifies the MIT import/wheel/file inventories and SBOM against its Digest, installs the chart, exercises real Model/MCP/A2A endpoints independently, injects process/network failures and rolls back before exception-safe teardown. A mocked provider/server cannot produce PASS.

- [ ] **Step 5: Commit the verified role configuration and evidence**

```bash
git add infra/helm/charts/litellm infra/images/litellm scripts/build-litellm-oss.ps1 scripts/verify-litellm-mit-boundary.py acceptance/inventory/litellm-runtime-imports.json acceptance/inventory/litellm-runtime-wheels.json mate-platform-backend/tests/compatibility/test_litellm_model_mcp_a2a.py acceptance/gates/litellm-open-source.yaml
git commit -m "infra(gateway): gate litellm open-source roles"
```

### Task 4: 先准入 SeaweedFS，再准入 RAGFlow、MemoryCore 和 Jena

**Files:**
- Create: `infra/helm/charts/seaweedfs/Chart.yaml`
- Create: `infra/helm/charts/seaweedfs/values.yaml`
- Create: `infra/helm/charts/seaweedfs/templates/object-lock-policy.yaml`
- Create: `infra/helm/charts/artifact-object-api/Chart.yaml`
- Create: `infra/helm/charts/artifact-object-api/values.yaml`
- Create: `infra/helm/charts/ragflow-target/Chart.yaml`
- Create: `infra/helm/charts/ragflow-target/values.yaml`
- Create: `infra/helm/charts/memory-core/Chart.yaml`
- Create: `infra/helm/charts/memory-core/values.yaml`
- Create: `infra/helm/charts/memory-core/templates/networkpolicy.yaml`
- Create: `infra/helm/charts/memory-core/templates/reverse-proxy-config.yaml`
- Create: `infra/helm/charts/jena/Chart.yaml`
- Create: `infra/helm/charts/jena/values.yaml`
- Create: `mate-platform-backend/tests/compatibility/test_seaweedfs_object_authority.py`
- Create: `mate-platform-backend/tests/compatibility/test_knowledge_memory_ontology_stack.py`
- Create: `acceptance/gates/object-storage.yaml`
- Create: `acceptance/gates/knowledge-memory-ontology.yaml`

**Interfaces:**
- Produces: security-fixed SeaweedFS S3/object-lock profile and Artifact Object API first; then pinned RAGFlow PostgreSQL/external-Valkey/Infinity/SeaweedFS profile, pinned MemoryCore L0-L3-only profile and Jena immutable version projection profile.

- [ ] **Step 1: Write a target-topology inventory test**

```python
def test_target_bundle_excludes_unselected_services(rendered_images):
    forbidden = {"mysql", "elasticsearch", "minio", "silo"}
    assert forbidden.isdisjoint(image.product for image in rendered_images)

def test_memory_profile_exposes_only_l0_l3(enabled_routes):
    assert enabled_routes <= {"memory/write", "memory/search", "memory/delete", "health"}

def test_object_lock_modes_and_admin_bypass(rendered_config):
    assert rendered_config["audit_worm.mode"] == "COMPLIANCE"
    assert rendered_config["artifact_retention.mode"] == "GOVERNANCE"
    assert rendered_config["admin_bypass"] is False
```

- [ ] **Step 2: Pin and prove the object authority before starting any dependent component**

Pin a SeaweedFS version/image Digest that contains the documented cross-bucket security fix. Test tenant bucket/prefix isolation, multipart/range/presigned URLs, conditional writes, filer metadata/data recovery and encryption. Define retention classes explicitly: audit archives use COMPLIANCE mode with no admin bypass; ordinary governed artifacts use GOVERNANCE mode with separately authorized legal hold/release; version delete markers and lifecycle expiry may not remove retained versions. Verify delete, legal-hold, retention-extension, privileged-admin and restored-object behavior. Supabase Storage remains disabled unless it proves SeaweedFS is its sole binary authority without a second metadata authority.

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/compatibility/test_seaweedfs_object_authority.py -q`

Expected: local contract/unit preflight passes without writing Gate evidence. Only the later `test-production-gate.ps1 -Gate object-storage` live run may set the SeaweedFS/Object API Gate to `PASSED`; RAGFlow, MemoryCore or Jena production composition cannot start before that result.

- [ ] **Step 3: Render dependent charts and run compatibility tests**

Run: `pwsh -File scripts/run-plan-tool.ps1 -- sh -lc "helm template ragflow infra/helm/charts/ragflow-target | kubeconform -strict -summary"`

Run: `mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/compatibility/test_knowledge_memory_ontology_stack.py -q`

Expected: the rendered/packaged deployment contains no MySQL, Elasticsearch, MinIO or Silo service image/chart; disabled client libraries that remain inside the main RAGFlow image are listed in SBOM rather than misreported as services. PDF/DOCX parse/retrieve/delete, object compatibility, MemoryCore isolation/restore and Jena publish/rebuild each report separately. MemoryCore is reachable only through the platform adapter service account and reverse-proxy route allowlist; NetworkPolicy proves a host pod and unrelated service cannot connect.

- [ ] **Step 4: Perform upgrade, backup, restore and permission tests**

Upgrade from the exact prior pinned version, restore PostgreSQL/Valkey/Infinity/SeaweedFS/MemoryCore/Jena into a clean namespace, compare object/index/memory/graph Digests and verify tenant permissions. Do not infer one component's recovery from another's health endpoint.

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate object-storage`

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate knowledge-memory-ontology -WithDependencies`

Expected: the runner installs the real charts into its ephemeral cluster, executes object-lock and tenant-isolation behavior before dependent components, parses/retrieves/deletes fixtures, injects failures, restores each authority into a clean namespace and tears down in `finally`. Template-only or mocked storage/RAG/memory/graph tests cannot set PASS.

- [ ] **Step 5: Record RPO/RTO and rollback**

Record measured data-loss window and recovery duration for each component, revert image/config Digests, and verify historical Artifact evidence still resolves. A combination stays `FAILED` if any required multipart/range/presigned URL, parser migration, SQLite consistency or graph rebuild case fails.

- [ ] **Step 6: Commit pinned profiles and evidence**

```bash
git add infra/helm/charts/seaweedfs infra/helm/charts/artifact-object-api infra/helm/charts/ragflow-target infra/helm/charts/memory-core infra/helm/charts/jena mate-platform-backend/tests/compatibility/test_seaweedfs_object_authority.py mate-platform-backend/tests/compatibility/test_knowledge_memory_ontology_stack.py acceptance/gates/object-storage.yaml acceptance/gates/knowledge-memory-ontology.yaml
git commit -m "infra(knowledge): gate pinned rag memory and ontology stack"
```

### Task 5: 准入外部 Iceberg 发布契约、Polaris、Trino 和 PostgreSQL 备份链

**Files:**
- Create: `infra/helm/charts/polaris/Chart.yaml`
- Create: `infra/helm/charts/polaris/values.yaml`
- Create: `infra/helm/charts/polaris/templates/postgresql-jdbc-config.yaml`
- Create: `infra/helm/charts/polaris/templates/roles-grants.yaml`
- Modify: `infra/helm/charts/trino/values.yaml`
- Modify: `infra/helm/charts/trino/templates/configmap.yaml`
- Create: `mate-platform-backend/contracts/jsonschema/external-iceberg-publication-v1.schema.json`
- Create: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/services/external_iceberg_publication.py`
- Create: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/external_iceberg_publication_routes.py`
- Modify: `mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/app.py`
- Modify: `mate-platform-backend/contracts/openapi/services/data.yaml`
- Create: `infra/helm/charts/external-iceberg-publication-api/Chart.yaml`
- Create: `infra/helm/charts/external-iceberg-publication-api/values.yaml`
- Create: `infra/helm/charts/external-iceberg-publication-api/templates/deployment.yaml`
- Create: `infra/helm/charts/external-iceberg-publication-api/templates/service.yaml`
- Create: `infra/helm/charts/external-iceberg-publication-api/templates/networkpolicy.yaml`
- Create: `infra/helm/charts/cloudnative-pg/Chart.yaml`
- Create: `infra/helm/charts/cloudnative-pg/values.yaml`
- Create: `infra/helm/charts/cloudnative-pg/templates/cluster.yaml`
- Create: `infra/helm/charts/cloudnative-pg/templates/objectstore.yaml`
- Create: `infra/helm/charts/cloudnative-pg/templates/scheduled-backup.yaml`
- Create: `infra/helm/charts/cloudnative-pg-operator/Chart.yaml`
- Create: `infra/helm/charts/cloudnative-pg-operator/values.yaml`
- Create: `infra/helm/charts/barman-cloud-plugin/Chart.yaml`
- Create: `infra/helm/charts/barman-cloud-plugin/values.yaml`
- Create: `infra/helm/charts/cert-manager/Chart.yaml`
- Create: `infra/helm/charts/cert-manager/values.yaml`
- Create: `infra/helm/charts/backup-object-store/Chart.yaml`
- Create: `infra/helm/charts/backup-object-store/values.yaml`
- Create: `infra/helm/charts/backup-object-store/templates/storage-placement.yaml`
- Create: `mate-platform-backend/tests/compatibility/test_s3_catalog_stack.py`
- Create: `mate-platform-backend/tests/compatibility/test_external_iceberg_publication.py`
- Create: `mate-platform-backend/tests/security/test_iceberg_commit_authorization.py`
- Create: `mate-platform-backend/contracts/tests/test_external_iceberg_publication_runtime.py`
- Create: `mate-platform-backend/tests/security/test_external_publisher_network_policy.py`
- Create: `mate-platform-backend/tests/recovery/test_polaris_postgresql_restore.py`
- Create: `mate-platform-backend/tests/recovery/test_cloudnativepg_barman_plugin.py`
- Create: `mate-platform-backend/tests/recovery/test_backup_fault_domain.py`
- Create: `acceptance/gates/environments/storage-backup-two-domain.yaml`
- Create: `acceptance/gates/cnpg-barman-backup.yaml`
- Create: `acceptance/gates/storage-catalog-backup.yaml`

**Interfaces:**
- Consumes: Task 4 approved SeaweedFS object authority and externally governed Iceberg publishers.
- Produces: PostgreSQL/JDBC-backed Polaris as sole Iceberg Catalog, Trino read-only connector, deployable guarded external-publication ingress plus one-time commit-authorization contract; independent `cnpg-barman-backup` Gate; parent `storage-catalog-backup` Gate. MetaPlatform does not write Iceberg data/metadata files in this baseline.

- [ ] **Step 1: Write authority and security configuration tests**

```python
def test_only_polaris_catalog_and_read_only_trino(rendered_config):
    assert rendered_config["seaweedfs.catalog.enabled"] is False
    assert rendered_config["trino.iceberg.security"] == "READ_ONLY"
    assert rendered_config["polaris"] == "sole-catalog"

def test_unattested_external_snapshot_is_rejected(publication_service):
    result = publication_service.register({"snapshot_id": 42})
    assert result.error_code == "ICEBERG_PUBLICATION_ATTESTATION_REQUIRED"

def test_commit_token_binds_table_uuid_metadata_and_digest(authorizer):
    token = authorizer.issue(validated_publication())
    assert authorizer.commit(token, changed_metadata_location()).error_code == "COMMIT_BINDING_MISMATCH"
```

- [ ] **Step 2: Validate external publisher snapshots before exposing them to Trino**

The external publisher—not MetaPlatform—is responsible for Iceberg data/metadata files and initiating the final Polaris catalog commit. It first uploads immutable files and submits an attestation to `POST /api/v1/data/iceberg/publications`; at this point Trino has no table visibility and the publisher has no standing production-catalog write credential. Require tenant/data-product, Polaris catalog/namespace/table identifier, Iceberg table UUID, schema/version, snapshot/parent snapshot, metadata location and metadata-file Digest, object-manifest Digest, publisher principal, permission watermark, created time and rollback snapshot. `GET /api/v1/data/iceberg/publications/{id}` exposes validation state. After validating every referenced object against Task 4 SeaweedFS and the current table parent, `POST /{id}/commit-authorizations` issues a short-lived, one-use authorization cryptographically bound to all identifiers/Digests. The external publisher presents it to the guarded `POST /{id}/commit` ingress, which alone owns a narrowly scoped Polaris production commit credential and commits exactly the bound metadata; any changed table UUID, parent, metadata location/Digest or replay fails. The token itself is not logged or stored in response artifacts. Test duplicate commit, concurrent parent conflict, orphan manifest, rollback, token replay and publisher revocation.

Register the routes in the existing data ASGI composition and OpenAPI, then deploy the dedicated ingress profile with mTLS/DPoP publisher authentication, no public anonymous route, egress only to Polaris/SeaweedFS/OpenBao, and NetworkPolicy that prevents other platform pods or Trino from reaching the commit endpoint. Runtime tests boot ASGI, compare routes/statuses to `data.yaml`, install the chart and prove a direct Polaris write or bypass of the guarded ingress is denied.

Polaris production values use its supported PostgreSQL/JDBC persistence, never the quick-start in-memory metastore. Back up and restore catalog/realm/principal/role/grant/table-registration metadata into a clean deployment, then prove Trino resolves the same table UUID/snapshot and that revoked principals remain revoked.

- [ ] **Step 3: Test least privilege and source-side enforcement**

Verify Trino cannot write through catalog or S3 credentials, cannot access another tenant catalog/bucket, and cannot bypass governed views/field policy with crafted SQL. Store logical/physical query Digests and source watermarks.

- [ ] **Step 4: Restore catalog and PostgreSQL backups**

Install and pin CloudNativePG operator, cert-manager and Barman Cloud Plugin before creating the tenant Cluster; the plugin deployment/CRD/RBAC lives in the operator namespace and the compatibility test binds operator, plugin, PostgreSQL major and Kubernetes versions. Configure scheduled base backups, WAL archiving and retention. The backup S3 endpoint is a separately deployed backup object cluster in another attested failure domain and with separate credentials; a second bucket, node label, volume or credential on the primary host/SeaweedFS cluster does not pass. `storage-backup-two-domain.yaml` must validate against Task 1 environment schema and prove distinct cluster UID plus provider/region/zone/storage-domain/object-endpoint identities. A single-host Kind run may validate functionality but must leave `cnpg-barman-backup=NOT_EXERCISED`; it can never produce the production PASS. Restore PostgreSQL to a new Cluster in the backup domain from base backup + WAL at a recorded target time, prove RPO/RTO and tenant RLS/PgBouncer behavior, then restore Polaris PostgreSQL metadata and compare realm/principal/grant/table/Iceberg Digests. Primary SeaweedFS recovery is already proven in Task 4. Do not package the GPL-3.0 standalone Barman distribution.

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate cnpg-barman-backup -WithDependencies -EnvironmentProfile acceptance/gates/environments/storage-backup-two-domain.yaml`

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate storage-catalog-backup -WithDependencies`

Expected: the runner verifies two distinct attested domains before installation, installs real operator/plugin/cert-manager, Polaris/PostgreSQL, Trino and independent backup store, executes one-use commit authorization against the live catalog, removes access to the entire primary domain, performs PITR and clean Polaris restore in the backup domain, records RPO/RTO and tears down only runner-owned resources in `finally`. In-memory Polaris, single-host Kind, equal domain IDs, same-fault-domain backup or mocked S3/catalog clients cannot pass.

- [ ] **Step 5: Commit storage/catalog gate evidence**

```bash
git add infra/helm/charts/polaris infra/helm/charts/trino infra/helm/charts/cloudnative-pg infra/helm/charts/cloudnative-pg-operator infra/helm/charts/barman-cloud-plugin infra/helm/charts/cert-manager infra/helm/charts/backup-object-store infra/helm/charts/external-iceberg-publication-api mate-platform-backend/contracts/jsonschema/external-iceberg-publication-v1.schema.json mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/services/external_iceberg_publication.py mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/external_iceberg_publication_routes.py mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/app.py mate-platform-backend/contracts/openapi/services/data.yaml mate-platform-backend/tests/compatibility/test_s3_catalog_stack.py mate-platform-backend/tests/compatibility/test_external_iceberg_publication.py mate-platform-backend/tests/security/test_iceberg_commit_authorization.py mate-platform-backend/contracts/tests/test_external_iceberg_publication_runtime.py mate-platform-backend/tests/security/test_external_publisher_network_policy.py mate-platform-backend/tests/recovery/test_polaris_postgresql_restore.py mate-platform-backend/tests/recovery/test_cloudnativepg_barman_plugin.py mate-platform-backend/tests/recovery/test_backup_fault_domain.py acceptance/gates/environments/storage-backup-two-domain.yaml acceptance/gates/cnpg-barman-backup.yaml acceptance/gates/storage-catalog-backup.yaml
git commit -m "infra(storage): gate object catalog and backup stack"
```

### Task 6: 强化审计、供应链和敏感可观测数据

**Files:**
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/audit/hash_chain.py`
- Create: `mate-platform-backend/packages/mate-platform/src/mate_platform/observability/redaction.py`
- Create: `infra/helm/charts/openbao/Chart.yaml`
- Create: `infra/helm/charts/openbao/values.yaml`
- Create: `infra/helm/charts/openbao/templates/statefulset.yaml`
- Create: `infra/helm/charts/openbao/templates/networkpolicy.yaml`
- Create: `infra/openbao/policies/runtime.hcl`
- Create: `infra/openbao/policies/signer.hcl`
- Create: `infra/openbao/pki/intermediate-role.json`
- Create: `infra/helm/charts/oci-registry/Chart.yaml`
- Create: `infra/helm/charts/oci-registry/values.yaml`
- Create: `infra/helm/charts/oci-registry/templates/networkpolicy.yaml`
- Create: `mate-platform-backend/packages/mate-clients/src/mate_clients/openbao.py`
- Create: `mate-platform-backend/tests/security/test_audit_tamper_evidence.py`
- Create: `mate-platform-backend/tests/security/test_observability_redaction.py`
- Create: `mate-platform-backend/tests/security/test_openbao_secrets_pki.py`
- Create: `mate-platform-backend/tests/recovery/test_openbao_raft_restore.py`
- Create: `mate-platform-backend/tests/security/test_registry_trust.py`
- Create: `mate-platform-backend/tests/recovery/test_registry_restore.py`
- Create: `acceptance/gates/audit-supply-chain.yaml`
- Create: `acceptance/gates/registry-trust.yaml`

**Interfaces:**
- Produces: OpenBao HA/Raft, seal/bootstrap, PKI, dynamic database credentials and signing service; `append_audit(record) -> SignedAuditRecord`; `redact_span(span, policy) -> ExportableSpan`; WORM archive receipt; independent `registry-trust` Gate for OCI storage, signature/admission, revocation, backup and restore.

- [ ] **Step 1: Write tamper and secret-leak tests**

```python
def test_middle_record_mutation_breaks_chain(verifier, signed_records):
    signed_records[2]["action"] = "changed"
    assert verifier.verify(signed_records).error_code == "AUDIT_CHAIN_BROKEN"

def test_prompt_and_api_key_are_not_exported(redactor):
    span = redactor.export(span_with(prompt="secret", api_key="sk-test"))
    assert "secret" not in json.dumps(span)
    assert "sk-test" not in json.dumps(span)
```

- [ ] **Step 2: Gate OpenBao before using production secrets or signing**

Pin an unmodified OpenBao image Digest and MPL-2.0 evidence. Deploy an odd-numbered integrated-Raft HA cluster with TLS, narrowly scoped Kubernetes auth roles, audit devices and a documented seal/unseal mechanism; root/bootstrap tokens are one-time and removed from runtime. Configure intermediate PKI, short-lived service certificates, dynamic PostgreSQL credentials, Artifact/audit signing keys and rotation/revocation. Test standby failover, policy denial, credential expiry, key rotation with old-signature verification, Raft snapshot restore into a clean cluster and loss of one failure domain. Applications reach only named roles through `OpenBaoClient`; no application receives broad secret-list privileges.

Run: `pwsh -File scripts/run-plan-tool.ps1 -- sh -lc "helm template openbao infra/helm/charts/openbao | kubeconform -strict -summary"`

Expected: configuration preflight passes but does not set a Gate result. The later `audit-supply-chain` live runner owns HA/failover, dynamic credential, PKI/signing rotation and clean-cluster restore evidence with locked image/config Digests.

- [ ] **Step 3: Implement per-record hash/signature and local-first telemetry**

Sign each audit record with a dedicated key, link prior hash, archive to object-lock/WORM storage and verify batch manifests. Keep tenant OTel Collector local; default Prompt/Response bodies off, apply field redaction/security labels/secret scan, and export only central allowlist fields.

- [ ] **Step 4: Generate complete supply-chain evidence**

For every runtime image and declarative Employee/Ontology/Deployment package, generate transitive SBOM, scan licenses/vulnerabilities, sign by Digest and test revocation. A SkillPackage containing executable entry remains rejected with `executable_skill_runtime.capability_status=NOT_SUPPORTED`; its sandbox Gate remains `status=NOT_EXERCISED`, and signing/SBOM do not enable it. Track model, embedding, OCR, parser, weights, example data and MCP Apps documentation licenses separately.

- [ ] **Step 5: Pass registry trust independently of TenantRuntime/business services**

Install the Digest-pinned OCI Distribution Registry with tenant repositories, TLS, immutable tag policy, garbage-collection safety, object backup and clean restore. Push Employee/Ontology/Deployment packages by Digest, verify Cosign key/keyless trust and revocation, and reject unsigned/changed manifests with the standalone trust-policy evaluator used later by admission; then restore repository manifests/blobs/trust policy into a clean registry. Kubernetes admission-controller behavior belongs to the downstream PlatformFoundation Gate. This Gate has no dependency on PlatformFoundation, TenantRuntime or an MVP business service, so MVP3 may consume it without a cycle.

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate registry-trust`

Expected: real push/pull/sign/revoke/admission/backup/restore pass; an in-memory or mocked registry cannot pass.

- [ ] **Step 6: Run tamper, WORM restore and redaction tests**

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate audit-supply-chain -WithDependencies`

Expected: PASS; tampering is detected before archive batch close and no protected content reaches central exports.

- [ ] **Step 7: Commit secret, audit, registry and supply-chain evidence**

```bash
git add infra/helm/charts/openbao infra/openbao infra/helm/charts/oci-registry mate-platform-backend/packages/mate-clients/src/mate_clients/openbao.py mate-platform-backend/packages/mate-platform/src/mate_platform/audit/hash_chain.py mate-platform-backend/packages/mate-platform/src/mate_platform/observability/redaction.py mate-platform-backend/tests/security/test_openbao_secrets_pki.py mate-platform-backend/tests/recovery/test_openbao_raft_restore.py mate-platform-backend/tests/security/test_audit_tamper_evidence.py mate-platform-backend/tests/security/test_observability_redaction.py mate-platform-backend/tests/security/test_registry_trust.py mate-platform-backend/tests/recovery/test_registry_restore.py acceptance/gates/audit-supply-chain.yaml acceptance/gates/registry-trust.yaml
git commit -m "feat(audit): add tamper evidence and safe telemetry"
```

### Task 7: 准入集群级 PlatformFoundation

**Files:**
- Create: `infra/helm/charts/platform-foundation/Chart.yaml`
- Create: `infra/helm/charts/platform-foundation/values.yaml`
- Create: `infra/helm/charts/envoy-gateway/Chart.yaml`
- Create: `infra/helm/charts/envoy-gateway/values.yaml`
- Create: `infra/helm/charts/cilium/Chart.yaml`
- Create: `infra/helm/charts/cilium/values.yaml`
- Create: `infra/helm/charts/external-secrets/Chart.yaml`
- Create: `infra/helm/charts/external-secrets/values.yaml`
- Create: `infra/helm/charts/gatekeeper/Chart.yaml`
- Create: `infra/helm/charts/sigstore-policy-controller/Chart.yaml`
- Create: `infra/helm/charts/flux-controllers/Chart.yaml`
- Create: `infra/kustomize/platform-foundation/connected/kustomization.yaml`
- Create: `mate-platform-backend/tests/compatibility/test_platform_foundation.py`
- Create: `mate-platform-backend/tests/compatibility/test_cnpg_barman_compatibility.py`
- Create: `mate-platform-backend/tests/recovery/test_platform_foundation_upgrade.py`
- Create: `acceptance/gates/platform-foundation.yaml`

**Interfaces:**
- Consumes: Task 5 `cnpg-barman-backup` Gate with the exact operator/Barman Cloud Plugin/cert-manager compatibility evidence.
- Produces: cluster-scoped CRDs/controllers and versioned API contract for Cilium, Envoy Gateway, CloudNativePG operator, Barman Cloud Plugin, cert-manager, External Secrets Operator, Gatekeeper/Sigstore Policy Controller and Flux. It owns no tenant workload or business data.

- [ ] **Step 1: Pin the operator/plugin compatibility graph**

Lock chart versions and image Digests, supported Kubernetes/RKE2 versions and CRD API versions. The matrix explicitly proves CloudNativePG operator ↔ PostgreSQL major ↔ Barman Cloud Plugin compatibility; the plugin is installed in the CNPG operator namespace with its CRD/RBAC and cert-manager dependency. No child chart may silently install a second copy of a controller.

- [ ] **Step 2: Install and upgrade an ephemeral cluster foundation**

Install CRDs/controllers first, wait for established CRDs and controller readiness, then run one minor upgrade and rollback with existing custom resources. Validate Cilium network enforcement, Envoy Gateway ownership, certificate issuance, External Secrets projection, signed-image admission, Flux pull reconciliation and CNPG/Barman backup object creation.

Run: `pwsh -File scripts/run-plan-tool.ps1 -- sh -lc "helm template platform-foundation infra/helm/charts/platform-foundation | kubeconform -strict -summary"`

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate platform-foundation`

Expected: the template check is only a preflight. The live runner creates the ephemeral cluster, installs CRDs/controllers in dependency order, exercises admission/network/certificate/backup APIs, performs upgrade/rollback with existing CRs, and tears down in `finally`. All cluster-scoped APIs are owned by one locked foundation release; a TenantRuntime cannot install or mutate their CRDs/controllers.

- [ ] **Step 3: Commit the PlatformFoundation Gate**

```bash
git add infra/helm/charts/platform-foundation infra/helm/charts/envoy-gateway infra/helm/charts/cilium infra/helm/charts/cloudnative-pg-operator infra/helm/charts/barman-cloud-plugin infra/helm/charts/cert-manager infra/helm/charts/external-secrets infra/helm/charts/gatekeeper infra/helm/charts/sigstore-policy-controller infra/helm/charts/flux-controllers infra/kustomize/platform-foundation/connected mate-platform-backend/tests/compatibility/test_platform_foundation.py mate-platform-backend/tests/compatibility/test_cnpg_barman_compatibility.py mate-platform-backend/tests/recovery/test_platform_foundation_upgrade.py acceptance/gates/platform-foundation.yaml
git commit -m "infra(foundation): gate cluster controllers and crds"
```

### Task 8: 准入 Namespaced TenantRuntime 生产集成面

**Files:**
- Create: `infra/helm/charts/tenant-runtime/Chart.yaml`
- Create: `infra/helm/charts/tenant-runtime/values.yaml`
- Create: `infra/helm/charts/tenant-runtime/templates/gateway.yaml`
- Create: `infra/helm/charts/tenant-runtime/templates/networkpolicies.yaml`
- Create: `infra/helm/charts/supabase-data-plane/Chart.yaml`
- Create: `infra/helm/charts/supabase-data-plane/values.yaml`
- Create: `infra/helm/charts/opensearch/Chart.yaml`
- Create: `infra/helm/charts/opensearch/values.yaml`
- Create: `infra/helm/charts/perses/Chart.yaml`
- Create: `infra/helm/charts/perses/values.yaml`
- Create: `infra/kustomize/tenant-runtime/connected/kustomization.yaml`
- Create: `infra/flux/tenant-runtime/helmrelease.yaml`
- Create: `mate-platform-backend/tests/compatibility/test_tenant_runtime_composition.py`
- Create: `mate-platform-backend/tests/security/test_tenant_runtime_network_policy.py`
- Create: `mate-platform-backend/tests/recovery/test_tenant_runtime_control_dependencies.py`
- Create: `acceptance/gates/tenant-employee-runtime.yaml`
- Create: `acceptance/gates/authorization-openfga-opa.yaml`
- Create: `acceptance/gates/messaging-nats-temporal.yaml`
- Create: `acceptance/gates/observability-stack.yaml`
- Create: `acceptance/gates/business-services.yaml`
- Create: `acceptance/gates/tenant-runtime-composition.yaml`

**Interfaces:**
- Consumes: Task 7 `platform-foundation` API contract, Task 6 independent `registry-trust`, plus individually passed identity, authorization, database, object, secret/PKI, messaging/workflow, observability, tenant-employee-runtime and business-service Gate IDs.
- Produces: one purely namespaced `TenantRuntime` Helm package and connected Kustomize/Flux profile; it does not install CRDs/controllers or turn any failed child component into PASS.

- [ ] **Step 1: Write composition and authority tests**

```python
def test_single_external_gateway_and_object_authority(rendered_runtime):
    assert rendered_runtime.gateway_controllers == {"envoy-gateway"}
    assert rendered_runtime.object_authorities == {"seaweedfs"}

def test_component_failure_is_not_masked_by_runtime_health(gate_matrix):
    gate_matrix["openfga"].status = "FAILED"
    assert gate_matrix["tenant-runtime"].status != "PASSED"
```

- [ ] **Step 2: Render the connected profile and validate deployment boundaries**

Compose only namespaced Gateway API routes/policies, CloudNativePG Cluster/PgBouncer, PostgREST/Realtime/Edge/Studio, OpenFGA/OPA, Artifact Object API, NATS/Temporal, OCI Registry, local OTel Collector, OpenSearch/Perses and selected business services against Task 7 controllers. Supabase Storage is disabled unless Task 4 passes its facade sub-gate. Studio and admin UIs have internal-only routes. Each workload has a dedicated service account, resource limits, probes, disruption budget and default-deny NetworkPolicy; no service receives a tenant database owner credential.

Run: `pwsh -File scripts/run-plan-tool.ps1 -- sh -lc "helm template tenant-runtime infra/helm/charts/tenant-runtime | kubeconform -strict -summary"`

- [ ] **Step 3: Install in an ephemeral connected RKE2/Kind test cluster**

Exercise login/bootstrap, employee package verification, OpenFGA/OPA decision, RLS/PgBouncer pool reuse, Artifact upload/read, NATS event, Temporal wait/replay, registry signature policy, local telemetry redaction and an MVP health route. Kill each control dependency separately and assert the Architecture fault-domain table. A general `/healthz` cannot substitute for component-level identity, authorization, restore or cross-tenant tests.

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate tenant-runtime-composition -WithDependencies`

Expected: the runner installs the namespaced release into the already live Foundation cluster, exercises real login/bootstrap/CAS/Lease/policy/object/event/workflow/registry/telemetry/business paths, kills each dependency, restores it, records Flux rollback and tears down in `finally`. Each required child has a real Gate ID and artifact: `tenant-employee-runtime` proves CAS/Lease/fencing/side-effect behavior; `authorization-openfga-opa`, `messaging-nats-temporal`, Task 6 `registry-trust`, `observability-stack` and each `business-services` entry prove their own behavior/recovery. The parent TenantRuntime is `PASSED` only when Task 7 and all selected child IDs pass.

- [ ] **Step 4: Verify Flux rollout, rollback and ownership**

Promote one signed config Digest, observe reconciliation, inject an invalid package/signature, prove admission rejection, then roll back to the prior Digest. Flux uses pull mode and no central process stores a long-lived customer-cluster administrator credential. Record ownership and rollback for Envoy, Supabase data plane, OpenFGA/OPA, Temporal/NATS, Registry, Object API, OpenSearch/Perses and each business service.

- [ ] **Step 5: Commit the connected TenantRuntime Gate**

```bash
git add infra/helm/charts/tenant-runtime infra/helm/charts/supabase-data-plane infra/helm/charts/opensearch infra/helm/charts/perses infra/kustomize/tenant-runtime/connected infra/flux/tenant-runtime mate-platform-backend/tests/compatibility/test_tenant_runtime_composition.py mate-platform-backend/tests/security/test_tenant_runtime_network_policy.py mate-platform-backend/tests/recovery/test_tenant_runtime_control_dependencies.py acceptance/gates/tenant-employee-runtime.yaml acceptance/gates/authorization-openfga-opa.yaml acceptance/gates/messaging-nats-temporal.yaml acceptance/gates/observability-stack.yaml acceptance/gates/business-services.yaml acceptance/gates/tenant-runtime-composition.yaml
git commit -m "infra(runtime): gate connected tenant composition"
```

### Task 9: 交付 Disconnected Cell 和完整宿主兼容门

**Files:**
- Create: `infra/disconnected-cell/kustomization.yaml`
- Create: `infra/disconnected-cell/identity-broker.yaml`
- Create: `infra/disconnected-cell/local-supabase-auth.yaml`
- Create: `infra/disconnected-cell/local-registry.yaml`
- Create: `infra/disconnected-cell/tenant-runtime-patch.yaml`
- Create: `infra/disconnected-cell/policy-bundle.yaml`
- Create: `infra/disconnected-cell/openbao-patch.yaml`
- Create: `infra/disconnected-cell/trusted-time.yaml`
- Create: `infra/disconnected-cell/openbao-bootstrap-process.md`
- Create: `infra/disconnected-cell/rke2-config.yaml`
- Create: `infra/disconnected-cell/flux-source.yaml`
- Create: `scripts/build-deployment-bundle.ps1`
- Create: `scripts/install-disconnected-cell.ps1`
- Create: `scripts/test-disconnected-cell-reconnect.ps1`
- Create: `mate-platform-backend/tests/compatibility/test_disconnected_cell.py`
- Create: `mate-platform-backend/tests/security/test_disconnected_cell_time_and_seal.py`
- Create: `acceptance/gates/disconnected-cell-hosts.yaml`

**Interfaces:**
- Consumes: Task 7 passed PlatformFoundation、Task 8 passed connected TenantRuntime and every component selected for the Cell.
- Produces: signed `DeploymentBundle` containing pinned images, governance packages, local identity/bootstrap/policy/OCI/GitOps/secrets sources, revocation watermarks and offline expiry; four-host Capability Contract.

- [ ] **Step 1: Write offline-expiry and host capability tests**

```python
def test_high_risk_action_fails_after_offline_expiry(cell):
    cell.disconnect_control_plane()
    cell.advance_beyond_policy_ttl()
    assert cell.call("ontology.publish").error_code == "OFFLINE_POLICY_EXPIRED"

def test_host_matrix_never_infers_mcp_apps(host_matrix):
    assert all(h.mcp_apps in {"verified", "unsupported", "not_exercised"} for h in host_matrix)

def test_clock_rollback_fails_high_risk_closed(cell):
    cell.rollback_wall_clock(minutes=10)
    assert cell.call("ontology.publish").error_code == "TRUSTED_TIME_INVALID"
```

- [ ] **Step 2: Build and verify a signed offline bundle**

Run: `powershell -File scripts/build-deployment-bundle.ps1 -Output acceptance/artifacts/disconnected-cell`

Expected: bundle manifest lists every image/package Digest, signature, SBOM, trust root, revocation list, policy watermark and maximum offline validity; it includes the RKE2 installer/channel artifacts, local OCI Registry, Flux source, OpenBao initialization/seal parameters and procedure, identity configuration, TenantRuntime packages, model/embedding assets and recovery tools; verification works without internet. It must not contain plaintext or commonly decryptable Shamir unseal/recovery shares. Actual shares are encrypted separately to distinct custodian PGP keys and delivered out of band, or the Cell uses a separately passed local HSM/KMS seal Gate; threshold and recovery tests prove duty separation.

- [ ] **Step 3: Install into a network-isolated RKE2 test cell**

Install with `install-disconnected-cell.ps1` into a network-isolated RKE2 test cell. Human identity authority is either the customer's local OIDC IdP or the bundled local Supabase Auth, selected explicitly in the signed cell profile; local Keycloak issues/restores the same Runtime Token contract. Verify local user lifecycle/MFA/revocation/audit, stable `(issuer, sub)` mapping, Bootstrap, package load, Run/Lease, R0 read policy, R1-R4 expiry failure, local Registry/Flux/OpenBao, audit archive and backup/restore. If neither local identity authority is configured, prove new registration/login/linking is disabled and only pre-issued finite offline credentials work.

The Cell uses a protected local NTP/PTP appliance or hardware-backed time source selected in the signed profile. Enforce maximum drift/holdover, monotonic last-seen time and clock-rollback detection for tokens, policy TTLs and bundles; backward jump or expired holdover fails R1-R4 closed. Test network loss, ten-minute rollback, forward jump and full power-cycle recovery. Reconnect using a signed newer governance bundle; reject rollback, conflicting or revoked versions without overwriting tenant business facts.

Run: `pwsh -File scripts/test-production-gate.ps1 -Gate disconnected-cell-hosts -WithDependencies`

Expected: the runner builds/verifies the offline bundle, creates a network-isolated test cell, installs without internet, executes identity/time/seal/power-cycle/backup/reconnect/rollback and host-contract tests, collects evidence, and destroys only its test cell in `finally`. A preexisting cluster or internet fallback cannot produce PASS.

- [ ] **Step 4: Exercise Codex, Claude Code, DSH and Hermes exact versions**

For each host, test Skills/plugin behavior, MCP connection/refresh, identity propagation, structuredContent, Artifact fallback, resume and known security limitations. The stable Connector/Bootstrap path is required; native dynamic per-employee plugin install and MCP Apps are not assumed.

- [ ] **Step 5: Commit bundle source and evidence**

```bash
git add infra/disconnected-cell scripts/build-deployment-bundle.ps1 scripts/install-disconnected-cell.ps1 scripts/test-disconnected-cell-reconnect.ps1 mate-platform-backend/tests/compatibility/test_disconnected_cell.py mate-platform-backend/tests/security/test_disconnected_cell_time_and_seal.py acceptance/gates/disconnected-cell-hosts.yaml
git commit -m "infra(edge): gate disconnected cell and host compatibility"
```
