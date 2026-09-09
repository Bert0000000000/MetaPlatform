# MetaPlatform Artifact、应用与输出中心 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 交付不可变 Artifact、同一权威 Digest 的 Markdown/HTML/PDF/DOCX 输出，以及可装配、发布、安装、升级和回滚的应用中心首发闭环。

**Architecture:** Artifact、Approval 和 Receipt 是产物中心的不可变事实；Template、OutputProfile、ApplicationVersion、ApplicationPackage 和 Installation 是应用中心的控制对象。应用只引用已发布员工、本体、Skill、MCP、Action、数据和角色的固定 Digest；格式、主题或用户偏好变化只产生 Representation，绝不改变 Artifact Digest 或 Runtime 的 Run/Lease 权威。

**Tech Stack:** Python 3.12、FastAPI、Pydantic 2、PostgreSQL、Alembic、RFC 8785、Jinja2、WeasyPrint、python-docx、React/Vite、Playwright、OpenFGA、OPA、MCP、NATS CloudEvents、OpenTelemetry。

**Spec:** docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md; docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md; docs/superpowers/plans/2026-09-01-mvp-01-order-insight-action.md; docs/superpowers/plans/2026-09-01-metaplatform-agile-program-delivery.md.

## Global Constraints

- 产物中心是 ArtifactEnvelope、ArtifactRepresentation、ApprovalRecord、ExecutionReceipt 的唯一事实源；已封存对象不可修改或物理删除。
- 应用中心拥有 Schema、Template、OutputProfile、Application、Package、Installation 生命周期；引用对象的权威永远留在原中心。
- Artifact 生命周期为 created → sealed → retained|withdrawn；Schema/Template 为 draft → in_review → published → deprecated → archived；Application 为 draft → validated → published → deprecated → archived；Installation 为 installed → upgrading → active|rollback_required → rolled_back|suspended → retired。
- Markdown、HTML、PDF、DOCX Representation 必须各自记录 artifact_digest、template_digest、renderer_digest、preference_digest 与 representation_digest；所有格式的 artifact_digest 必须相同。
- ApplicationPackage 仅允许固定的已发布 Release Digest；拒绝 latest、tag-only、install hook、可执行入口及未声明网络/文件/进程能力。
- 所有命令同时校验 Tenant、HumanUser、Employee、Run/Lease、OpenFGA、OPA、用途和审批；模板发现、Artifact 可见、MCP 工具列举均不授予安装、源数据下载或副作用权限。
- REST/MCP/Event/UI 均调用同一服务层；写入使用 Alembic、事务 Outbox、追加审计与稳定错误码。跨租户、未发布依赖、模板注入、签名失败和回滚失败 fail closed，并投影为 CapabilityAvailabilityProjection。
- 生产路径禁止 create_all() 和 InMemoryOutboxWriter；迁移由签名、最小权限 Alembic Job 执行。

---

## File Structure

- mate-platform-backend/packages/mate-kernel/src/mate_kernel/artifact/output_contracts.py: Artifact 输出、模板、应用包和安装契约。
- mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts/: Representation repository 与四格式渲染服务。
- mate-platform-backend/packages/mate-platform/src/mate_platform/application_center/: Template、Application、Package、Installation 服务、权限和审计。
- mate-platform-backend/alembic/versions/20260901_0023_artifact_application_output.py: revision 固定为 0023_artifact_application_output，down_revision 固定为 0022_runtime_employee_host_v1。
- mate-platform-backend/contracts/openapi/services/application-center.yaml: REST 权威接口。
- mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/application_center.py: MCP 发现和受权读取工具。
- metaplatform-frontend/apps/web/src/pages/application-center/: 非聊天式应用、安装与模板管理 UI。
- metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.tsx: 格式选择与安全预览。

## Management Object Matrix

| 对象 | 生命周期操作 | REST / MCP / Event / UI 合同 |
|---|---|---|
| Artifact/Representation | 封存、读取、撤回、生成/失效表示 | GET /artifacts/{digest}/representations/{format}；artifact.get_representation；artifact.representation.created.v1；Artifact 查看器 |
| Schema/Template | 创建、编辑 draft、评审、发布、弃用、归档 | /artifact-schemas、/templates；application.list_templates；template.published.v1；模板管理页 |
| Application/Package | 装配、校验、发布、弃用、归档、签名验证 | /applications、/packages；application.get_projection；application.published.v1；应用装配页 |
| Installation | 安装、升级、暂停、回滚、退役 | /installations；受审批 application.install；installation.changed.v1；租户安装页 |

### Task 1: 固化不可变 Artifact、输出和应用装配契约

**Files:**
- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/artifact/output_contracts.py
- Modify: mate-platform-backend/packages/mate-kernel/src/mate_kernel/artifact/__init__.py
- Create: mate-platform-backend/packages/mate-kernel/tests/test_artifact_output_contracts.py
- Create: mate-platform-backend/tests/conformance/application_center/test_digest_lifecycle_vectors.py

**Interfaces:**
- Consumes: MVP1 ArtifactEnvelope and content_digest(object_type, schema_version, model).
- Produces: ArtifactRepresentation, TemplateVersion, OutputProfile, ApplicationVersion, ApplicationPackage, InstallationCommand, rendering_input_digest() and validate_application_dependencies().

- [ ] **Step 1: Write failing contract tests**

~~~python
def test_every_output_format_keeps_one_artifact_digest() -> None:
    artifact = sample_artifact()
    outputs = [ArtifactRepresentation.for_format(artifact, f, DIGEST) for f in ("markdown", "html", "pdf", "docx")]
    assert {item.artifact_digest for item in outputs} == {artifact.content_digest}

def test_published_application_rejects_floating_dependency() -> None:
    with pytest.raises(ValueError, match="DEPENDENCY_DIGEST_REQUIRED"):
        ApplicationVersion(application_id=APP, state="published", dependencies=[{"kind": "skill", "digest": "latest"}])
~~~

- [ ] **Step 2: Run tests and verify absence**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_artifact_output_contracts.py mate-platform-backend/tests/conformance/application_center/test_digest_lifecycle_vectors.py -q

Expected: FAIL with missing mate_kernel.artifact.output_contracts.

- [ ] **Step 3: Implement frozen contracts and legal transitions**

~~~python
class ArtifactRepresentation(BaseModel):
    model_config = ConfigDict(frozen=True)
    artifact_digest: str
    format: Literal["markdown", "html", "pdf", "docx"]
    template_digest: str
    renderer_digest: str
    preference_digest: str
    representation_digest: str

def validate_application_dependencies(refs: tuple[ReleaseRef, ...]) -> None:
    if any(ref.state != "published" or len(ref.digest) != 64 for ref in refs):
        raise ValueError("DEPENDENCY_DIGEST_REQUIRED")
~~~

Define pure state-transition validators for all four lifecycle groups and reject executable package entries and hook fields.

- [ ] **Step 4: Run contracts and vectors**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-kernel/tests/test_artifact_output_contracts.py mate-platform-backend/tests/conformance/application_center -q

Expected: PASS with immutable-state and Digest conformance.

- [ ] **Step 5: Commit**

~~~bash
git add mate-platform-backend/packages/mate-kernel/src/mate_kernel/artifact mate-platform-backend/packages/mate-kernel/tests/test_artifact_output_contracts.py mate-platform-backend/tests/conformance/application_center
git commit -m "feat(artifact): define output application contracts"
~~~

### Task 2: 建立 Artifact/Application 数据权威、Alembic 与租户隔离

**Files:**
- Create: mate-platform-backend/alembic/versions/20260901_0023_artifact_application_output.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts/repository.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/application_center/repository.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/application_center/audit.py
- Create: mate-platform-backend/tests/migrations/test_artifact_application_upgrade.py
- Create: mate-platform-backend/packages/mate-platform/tests/test_application_center_repository_postgres.py
- Create: mate-platform-backend/tests/security/test_application_center_rls.py

**Interfaces:**
- Consumes: Task 1 contracts and tenant transaction context.
- Produces: ArtifactRepository.get_representation(), ApplicationRepository.create_draft(), publish_version(), create_installation(), transition_installation() and append-only ApplicationAuditEvent.

- [ ] **Step 1: Write failing migration/RLS/immutability tests**

~~~python
async def test_tenant_cannot_read_other_tenant_installation(repo):
    installation = await repo.create_installation(tenant_id="t1", package_digest=DIGEST)
    with pytest.raises(NotFound):
        await repo.get_installation(tenant_id="t2", installation_id=installation.id)

async def test_published_template_cannot_be_mutated(repo):
    template = await repo.publish_template(draft_template())
    with pytest.raises(ImmutableRelease):
        await repo.update_template(template.id, body="changed")
~~~

- [ ] **Step 2: Run PostgreSQL tests and verify they fail**

Run: pwsh -File scripts/test-mvp-postgres.ps1 -Suite application-center

Expected: FAIL because migration and repositories are absent.

- [ ] **Step 3: Implement tables, RLS, audit and Outbox**

Create artifact_representations, artifact_schemas, template_versions, application_versions, application_packages, application_installations, application_installation_history, application_audit_events and transactional Outbox rows. Apply tenant RLS and append-only audit/history triggers; migration downgrade may remove unpublished drafts only and must retain sealed/referenced facts.

- [ ] **Step 4: Verify upgrade, isolation and retained facts**

Run: pwsh -File scripts/test-mvp-postgres.ps1 -Suite application-center; mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/migrations/test_artifact_application_upgrade.py mate-platform-backend/tests/security/test_application_center_rls.py -q

Expected: PASS; tenant crossover fails and rollback retains Artifact/Approval/Receipt references.

- [ ] **Step 5: Commit**

~~~bash
git add mate-platform-backend/alembic/versions/20260901_0023_artifact_application_output.py mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts mate-platform-backend/packages/mate-platform/src/mate_platform/application_center mate-platform-backend/tests/migrations/test_artifact_application_upgrade.py mate-platform-backend/tests/security/test_application_center_rls.py
git commit -m "feat(application): add immutable persistence"
~~~

### Task 3: 交付同一 Artifact Digest 的四格式渲染与安全预览

**Files:**
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts/rendering.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts/renderers/markdown.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts/renderers/html.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts/renderers/pdf.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts/renderers/docx.py
- Modify: metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.tsx
- Create: mate-platform-backend/packages/mate-platform/tests/test_artifact_rendering.py
- Create: metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.test.tsx

**Interfaces:**
- Consumes: sealed Artifact, published TemplateVersion, OutputProfile and user PreferenceSet.
- Produces: render_artifact(envelope, template, format, preference) -> ArtifactRepresentation and ArtifactEnvelopeRenderer.

- [ ] **Step 1: Write failing format-equivalence and injection tests**

~~~python
@pytest.mark.parametrize("format", ["markdown", "html", "pdf", "docx"])
def test_render_references_sealed_artifact(format):
    assert render_artifact(sample_artifact(), published_template(), format, prefs()).artifact_digest == sample_artifact().content_digest

def test_html_preview_removes_script_nodes():
    assert "<script" not in render_artifact(xss_artifact(), published_template(), "html", prefs()).content
~~~

- [ ] **Step 2: Run tests and verify they fail**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_artifact_rendering.py -q; pnpm --dir metaplatform-frontend test ArtifactEnvelopeRenderer.test.tsx

Expected: FAIL because renderers and UI selector are absent.

- [ ] **Step 3: Implement deterministic four-format renderers**

Use Jinja2 strict undefined values, sanitized HTML in a sandboxed iframe, WeasyPrint PDF and python-docx DOCX. Embed Artifact and Representation Digests into HTML meta/PDF/DOCX metadata; use signed download URLs and never use unsanitized dangerouslySetInnerHTML.

- [ ] **Step 4: Verify renderer and denied-access behavior**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_artifact_rendering.py -q; pnpm --dir metaplatform-frontend test ArtifactEnvelopeRenderer.test.tsx

Expected: PASS; preference changes create only a new Representation and denied users get ARTIFACT_ACCESS_DENIED.

- [ ] **Step 5: Commit**

~~~bash
git add mate-platform-backend/packages/mate-platform/src/mate_platform/artifacts metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.tsx metaplatform-frontend/packages/shared/src/renderers/ArtifactEnvelopeRenderer.test.tsx mate-platform-backend/packages/mate-platform/tests/test_artifact_rendering.py
git commit -m "feat(artifact): render markdown html pdf docx"
~~~

### Task 4: 实现应用装配、发布、安装、升级和回滚

**Files:**
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/application_center/service.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/application_center/package.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/application_center/installation.py
- Create: mate-platform-backend/packages/mate-platform/tests/test_application_lifecycle.py
- Create: mate-platform-backend/tests/security/test_application_package_policy.py
- Create: mate-platform-backend/tests/integration/test_application_upgrade_rollback.py

**Interfaces:**
- Consumes: Task 1 ReleaseRefs, Task 2 repository, OpenFGA/OPA decision and optional ApprovalRecord Digest.
- Produces: assemble_application(), publish_application(), install_application(), upgrade_installation() and rollback_installation().

- [ ] **Step 1: Write failing dependency and rollback tests**

~~~python
async def test_failed_upgrade_restores_previous_package(service):
    installed = await service.install_application(package_v1(), actor=ADMIN)
    failed = await service.upgrade_installation(installed.id, package_with_revoked_mcp(), actor=ADMIN)
    assert failed.state == "rollback_required"
    assert (await service.rollback_installation(installed.id, actor=ADMIN)).package_digest == package_v1().content_digest

def test_package_rejects_hook_and_floating_dependency():
    with pytest.raises(PackagePolicyViolation):
        assemble_application(package_with_hook_and_latest_ref())
~~~

- [ ] **Step 2: Run lifecycle tests and verify they fail**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_application_lifecycle.py mate-platform-backend/tests/security/test_application_package_policy.py mate-platform-backend/tests/integration/test_application_upgrade_rollback.py -q

Expected: FAIL because lifecycle service is absent.

- [ ] **Step 3: Implement fixed-release installation and compensating rollback**

Validate all ReleaseRefs as published and tenant-allowed; require OPA/OpenFGA checks and Approval Digest for policy-selected risk. Stage upgrade without side effects, health-check declared capabilities, emit Outbox after commit, and restore prior immutable package on failure without mutating historical rows.

- [ ] **Step 4: Verify lifecycle and signed-package rules**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/packages/mate-platform/tests/test_application_lifecycle.py mate-platform-backend/tests/security/test_application_package_policy.py mate-platform-backend/tests/integration/test_application_upgrade_rollback.py -q

Expected: PASS; failed upgrade cannot leave partial active state.

- [ ] **Step 5: Commit**

~~~bash
git add mate-platform-backend/packages/mate-platform/src/mate_platform/application_center mate-platform-backend/packages/mate-platform/tests/test_application_lifecycle.py mate-platform-backend/tests/security/test_application_package_policy.py mate-platform-backend/tests/integration/test_application_upgrade_rollback.py
git commit -m "feat(application): add governed lifecycle"
~~~

### Task 5: 暴露 REST、MCP、事件和应用中心 UI

**Files:**
- Create: mate-platform-backend/contracts/openapi/services/application-center.yaml
- Modify: mate-platform-backend/contracts/openapi/manifest.yaml
- Create: mate-platform-backend/contracts/events/application-center.v1.json
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/application_center/api.py
- Create: mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/application_center.py
- Create: metaplatform-frontend/apps/web/src/pages/application-center/ApplicationCenterPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/application-center/InstallationDetailPage.tsx
- Create: mate-platform-backend/contracts/tests/test_application_center_contract.py
- Create: mate-platform-backend/packages/mate-tech-mcp/tests/test_application_center_tools.py
- Create: metaplatform-frontend/apps/web/src/pages/application-center/ApplicationCenterPage.test.tsx

**Interfaces:**
- Produces: REST POST/GET /api/v1/applications, POST /publish, POST /installations, POST /installations/{id}/upgrade, POST /rollback, GET /artifacts/{digest}/representations/{format}; MCP application.get_projection, application.list_templates, artifact.get_representation; CloudEvents application.published.v1, installation.changed.v1, artifact.representation.created.v1.

- [ ] **Step 1: Write failing contract and discovery-not-authorization tests**

~~~python
async def test_mcp_discovery_does_not_grant_install(client):
    assert "application.get_projection" in await client.list_tools(subject=READER)
    assert "application.install" not in await client.list_tools(subject=READER)

def test_upgrade_rejects_cross_tenant_installation(api_client):
    assert api_client.post(f"/api/v1/installations/{OTHER_TENANT_ID}/upgrade").status_code == 404
~~~

- [ ] **Step 2: Run contract tests and verify they fail**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/contracts/tests/test_application_center_contract.py mate-platform-backend/packages/mate-tech-mcp/tests/test_application_center_tools.py -q; pnpm --dir metaplatform-frontend test ApplicationCenterPage.test.tsx

Expected: FAIL because OpenAPI, MCP tool and pages are absent.

- [ ] **Step 3: Implement one service command boundary for all transports**

REST/MCP handlers call Task 4 services and pass human/employee/tenant/Run context. MCP discovery exposes filtered metadata only; mutation requires policy and approval proof. UI renders fixed dependency Digests, audit links, status/degradation and rollback control; it is a workbench, not a generic chat client.

- [ ] **Step 4: Verify contracts, events and UI**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/contracts/tests/test_application_center_contract.py mate-platform-backend/packages/mate-tech-mcp/tests/test_application_center_tools.py -q; pnpm --dir metaplatform-frontend test ApplicationCenterPage.test.tsx

Expected: PASS; discovery never authorizes mutation and unavailable install shows ACTIONS_PAUSED.

- [ ] **Step 5: Commit**

~~~bash
git add mate-platform-backend/contracts/openapi/services/application-center.yaml mate-platform-backend/contracts/openapi/manifest.yaml mate-platform-backend/contracts/events/application-center.v1.json mate-platform-backend/packages/mate-platform/src/mate_platform/application_center/api.py mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/application_center.py metaplatform-frontend/apps/web/src/pages/application-center mate-platform-backend/contracts/tests/test_application_center_contract.py mate-platform-backend/packages/mate-tech-mcp/tests/test_application_center_tools.py
git commit -m "feat(application): expose governed transports"
~~~

### Task 6: 验收跨中心 E2E、故障降级与恢复

**Files:**
- Create: mate-platform-backend/tests/e2e/test_artifact_application_output_flow.py
- Create: mate-platform-backend/tests/e2e/test_application_recovery_flow.py
- Create: metaplatform-frontend/apps/web/e2e/application-center.spec.ts
- Create: scripts/test-application-center-e2e.ps1
- Modify: acceptance/release/v1/requirements.yaml
- Modify: acceptance/release/v1/interface-registry.yaml

**Interfaces:**
- Consumes: Task 1–5, live PostgreSQL/object storage, signed application package and permitted human user.
- Produces: immutable E2E, recovery and interface evidence for Artifact/Application/Output Requirements.

- [ ] **Step 1: Write failing full-flow assertion**

~~~python
async def test_report_render_install_upgrade_rollback_and_restore(stack):
    artifact = await stack.order_employee.create_report(real_deidentified_order())
    outputs = [await stack.render(artifact, f) for f in ("markdown", "html", "pdf", "docx")]
    assert {item.artifact_digest for item in outputs} == {artifact.content_digest}
    installation = await stack.install_signed_application(actor=stack.admin)
    await stack.force_upgrade_health_failure(installation.id)
    assert (await stack.restore_tenant_and_reconcile()).installation_digest == installation.package_digest
~~~

- [ ] **Step 2: Run E2E and verify it fails**

Run: pwsh -File scripts/test-application-center-e2e.ps1

Expected: FAIL until all services and live paths exist.

- [ ] **Step 3: Implement isolated runner and evidence collection**

Create a unique compose project/tenant, apply migrations, use approved de-identified data, execute REST/MCP/browser flows, inject renderer and revoked-dependency failure, restore to an independent target, reconcile Artifact/Installation/Audit Digests, collect JUnit/evidence, then destroy only runner-owned resources in finally.

- [ ] **Step 4: Verify E2E, recovery and browser behavior**

Run: pwsh -File scripts/test-application-center-e2e.ps1; mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/e2e/test_artifact_application_output_flow.py mate-platform-backend/tests/e2e/test_application_recovery_flow.py -q

Expected: PASS with four output forms, tenant isolation, visible degradation and restored facts.

- [ ] **Step 5: Commit**

~~~bash
git add mate-platform-backend/tests/e2e metaplatform-frontend/apps/web/e2e/application-center.spec.ts scripts/test-application-center-e2e.ps1 acceptance/release/v1/requirements.yaml acceptance/release/v1/interface-registry.yaml
git commit -m "test(application): prove release flow"
~~~

## Self-Review

- Tasks 1–3 deliver immutable Artifact authority and Markdown/HTML/PDF/DOCX with one Artifact Digest.
- Tasks 1, 2 and 4 cover Template/Application/Package/Installation CRUD lifecycle, release pinning, approval, audit, install, upgrade and rollback.
- Tasks 5–6 cover REST/MCP/Event/UI, discovery-not-authorization, tenant policy, failure/degradation, true E2E and recovery.
- No task assigns Runtime, employee, ontology publication or business Action authority to the application center.
