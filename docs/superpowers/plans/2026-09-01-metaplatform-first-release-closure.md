# MetaPlatform 首发上线收口总计划 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 将现有业务 MVP、产品模块和生产收敛 Gate 收口为一套可追踪、可执行、可证明的首发计划，使全部首发承诺完成后 MetaPlatform 能在选定生产拓扑中安全上线、回退和持续运营。

**Architecture:** 本计划是发布控制面，不替代四个业务 MVP 或组件 Gate。它先冻结首发能力、部署形态和责任人；再将产品主规格要求的六组独立子计划补齐；最后以一个不可伪造的 platform-ga 父 Gate 汇聚需求追踪、组件 Gate、真实业务验收、恢复演练和生产推广证据。业务 MVP 仍按业务闭环交付，平台能力仍按首次进入生产路径时执行对应 Gate。

**Tech Stack:** Python 3.12、JSON Schema、YAML、PowerShell、GitHub Actions、Helm、Kustomize、Flux CD、Kubernetes/RKE2、OpenTelemetry、Prometheus、Perses、Alertmanager、OpenSearch、CloudNativePG/Barman Cloud Plugin、OpenBao、Cosign、Trivy。

**Spec:** docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md; docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md; docs/superpowers/plans/2026-09-01-digital-employee-platform-mvp-roadmap.md; docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md

## Global Constraints

- MetaPlatform 是平台名称；数字员工是其核心能力之一，不能把本计划表述为独立的“数字员工平台”上线。
- 首发必须提供产品主规格定义的 15 个模块的最小、可用、可审计闭环；明确不在运行时的能力必须逐项记录为 NOT_IN_RUNTIME，不能静默遗漏。
- 首发拓扑为混合部署：托管 Kubernetes 生产环境与连接型私有部署都使用同一 TenantRuntime Helm Package；完全断网 Cell 只有在 disconnected-cell-hosts Gate 为 PASSED 时才可进入首发范围。
- PASSED、FAILED、NOT_EXERCISED 是 Gate 的唯一状态。文档评审、mock、本地单机测试、健康检查和 helm template 不能产生 PASSED。
- 每个实际启用组件必须在不可变 production-profile.yaml 中绑定版本、镜像 Digest、配置 Digest、责任人、Gate、RPO/RTO 和回退策略。
- 人类身份只由 Supabase Auth 权威，Keycloak 只承担身份代理、Token Exchange 与服务/runtime 客户端；旧 IAM 只能在批准的兼容窗口内双读，不能再成为运行时授权事实。
- 所有生产 schema 仅由签名、最小权限的 Alembic migration Job 改变；生产业务镜像、服务启动路径和 repository 静态检查中不得出现 create_all()。
- 业务状态变化使用事务 SQL Outbox；生产路径不得以 InMemoryOutboxWriter 产生已投递或已执行的成功结论。
- 发布、授权、审批、删除和外部副作用均须验证租户、策略、Run、Lease 和幂等约束；不可变 Artifact、Approval 和 Receipt 不得被发布过程覆写。
- 所有发布制品和部署包必须固定 Digest、签名、SBOM、许可证与撤销状态；INSECURE_SKIP_SIGNATURE=true 和 LEGACY_LOGIN_COMPAT=true 不得进入生产 profile。

---

## Release Definition

### 首发范围

首发承诺不是“4 个演示场景”，而是产品主规格的 15 个模块各有最小产品闭环。每个模块至少具备：权威对象、生命周期动作、角色/租户授权、审计、API 或管理页面、真实 E2E 与恢复/回退归属。

| 模块组 | 首发最小闭环 | 不计入首发的扩展能力 |
|---|---|---|
| 个人、组织、身份、租户 | UserProfile、Preference、Consent、DynamicRole、SoD、AccessReview、Tenant、ConfigRelease、Quota 与 FeatureFlag | 商业订阅计费 |
| Runtime、员工、宿主 | Employee Definition/Version/Assignment、Session、WorkItem、Run、Lease、Host/Connector 状态与退役 | 未经验证的新宿主类型 |
| Artifact、审批、应用 | ArtifactSchema、OutputProfile、Markdown/HTML 渲染、模板包、装配型应用、安装/升级/回滚 | 未通过 Gate 的可执行插件 |
| 本体、技能、MCP | 本体建模/发布、Skill/Capability 生命周期、MCP Server/Tool Catalog、凭据与路由治理 | 未通过宿主和沙箱 Gate 的 MCP App UI 扩展 |
| Action、数据、知识、记忆 | Action/Workflow 定义与审批、DataProduct/Pipeline/质量/血缘、RAG/图谱、本体运维、受治理跨宿主记忆 | 未经受控评审的自动记忆晋升 |
| 环境、运营、质量 | Connected Runtime 部署、审计、SLO、告警、事件、评测、预算、备份恢复、发布与回退 | 完全断网 Cell，除非相应 Gate 通过并写入 profile |

### 唯一上线判定

platform-ga 只能在下列全部条件同时成立时写入 PASSED：

1. 发布追踪矩阵中每个首发 Requirement 为 IMPLEMENTED，并具有 E2E、审计、恢复和责任人签字证据。
2. 选定 production-profile.yaml 的每个启用组件及其祖先 Gate 均为当前 Digest 的 PASSED。
3. 四个业务 MVP 均通过真实数据/材料验收；有副作用的 MVP 证明一次确认只产生一次 Receipt，无副作用的 MVP 以 DecisionRecord 结束。
4. 生产与连接型私有部署分别完成预生产回放、灰度、观察期和回退；若首发启用断网 Cell，断网与重连 Gate 同样通过。
5. 业务、身份、策略、Run Ledger、Artifact/Object、事件、工作流、审计与配置在独立故障域完成恢复和业务对账，满足写入 profile 的 RPO/RTO。
6. 值班、发布、安全、数据与业务责任人完成签字；告警路由和 Runbook 已在演练中触发并执行。

任何一项为 FAILED、NOT_EXERCISED、证据 Digest 不匹配、签字过期或未登记例外时，platform-ga=NO-GO。

## File Structure

- docs/superpowers/specs/2026-09-01-metaplatform-first-release-scope.md: 首发范围、15 模块最低交付、责任人和受控例外的权威规格。
- acceptance/release/v1/requirements.schema.json: Requirement、覆盖状态、证据引用和签字的 JSON Schema。
- acceptance/release/v1/requirements.yaml: 15 模块及首发需求的逐项追踪矩阵。
- acceptance/release/v1/production-profile.schema.json: 启用组件、Gate、Digest、RPO/RTO、容量和回退对象的 Schema。
- acceptance/release/v1/production-profile.yaml: 唯一可部署的首发混合拓扑 profile。
- acceptance/release/v1/platform-ga.schema.json: 最终 GA 聚合 Gate 的 Schema。
- acceptance/release/v1/platform-ga.yaml: 目标环境、业务、恢复、发布和签字证据。
- scripts/verify-release-traceability.py: 在 CI 中验证范围、证据、签字、Gate 依赖和 profile 一致性。
- scripts/test-production-release-promotion.ps1: 运行预生产回放、灰度、观察与回退的唯一 live GA runner。
- .github/workflows/ga-acceptance.yml: 调用追踪验证器与 GA runner，拒绝不完整或过期证据。
- docs/superpowers/plans/2026-09-01-metaplatform-control-plane-v1.md: 个人、组织身份权限、租户配置与用户 Bootstrap 实施计划。
- docs/superpowers/plans/2026-09-01-metaplatform-runtime-employee-host-v1.md: Runtime、数字员工、宿主 Connector 控制面实施计划。
- docs/superpowers/plans/2026-09-01-metaplatform-artifact-application-output-v1.md: Artifact/Approval、应用中心、输出模板实施计划。
- docs/superpowers/plans/2026-09-01-metaplatform-ontology-skill-mcp-v1.md: 本体、Skill/Capability、MCP Catalog 实施计划。
- docs/superpowers/plans/2026-09-01-metaplatform-action-data-knowledge-memory-v1.md: Action/Workflow、数据知识、记忆实施计划。
- docs/superpowers/plans/2026-09-01-metaplatform-tenant-deployment-operations-v1.md: 环境部署、运营审计质量、可观测实施计划。
- docs/superpowers/plans/2026-09-01-metaplatform-database-release-and-upgrade-safety.md: 迁移 Job、旧 IAM 退出、N/N-1 与全链路恢复实施计划。
- docs/superpowers/plans/2026-09-01-metaplatform-ga-release-and-cutover.md: 目标环境推广、灰度、回退和签字实施计划。

### Task 1: 固定首发范围与逐项需求追踪

**Files:**
- Create: docs/superpowers/specs/2026-09-01-metaplatform-first-release-scope.md
- Create: acceptance/release/v1/requirements.schema.json
- Create: acceptance/release/v1/requirements.yaml
- Create: scripts/verify-release-traceability.py
- Create: mate-platform-backend/tests/architecture/test_release_traceability.py

**Interfaces:**
- Produces: Requirement { id, module, title, release_status, implementation_plan, acceptance_evidence, recovery_evidence, gate_ids, owner, approver }.
- Consumes: 15 module identifiers from the product spec and Gate evidence registered in acceptance/gates/component-matrix.yaml.

- [ ] **Step 1: Write failing traceability tests**

~~~python
def test_each_first_release_module_has_a_closed_requirement() -> None:
    result = verify_requirements(REQUIREMENTS, GATE_MATRIX)
    assert result.errors == []

def test_enabled_requirement_rejects_missing_e2e_or_recovery_evidence() -> None:
    result = verify_requirement({"release_status": "IMPLEMENTED", "acceptance_evidence": []})
    assert result.codes == {"E2E_EVIDENCE_REQUIRED", "RECOVERY_EVIDENCE_REQUIRED"}
~~~

- [ ] **Step 2: Implement the Schema and matrix entries**

Create one requirement record for every minimum capability in the Release Definition table. Restrict release_status to PLANNED, IMPLEMENTED, NOT_IN_RUNTIME, RETIRED; require NOT_IN_RUNTIME records to include an approved reason, risk statement and replacement release. Require IMPLEMENTED records to contain immutable evidence references, responsible owner, independent approver and all required Gate IDs.

- [ ] **Step 3: Validate the matrix in CI**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_release_traceability.py -q

Expected: PASS only when all 15 module groups are represented and no enabled requirement lacks plan, test, recovery evidence or owner.

- [ ] **Step 4: Commit the release scope control**

~~~bash
git add docs/superpowers/specs/2026-09-01-metaplatform-first-release-scope.md acceptance/release/v1/requirements.schema.json acceptance/release/v1/requirements.yaml scripts/verify-release-traceability.py mate-platform-backend/tests/architecture/test_release_traceability.py
git commit -m "docs(release): lock first release scope and traceability"
~~~

### Task 2: 补齐六组产品实施计划并建立覆盖关系

**Files:**
- Create: docs/superpowers/plans/2026-09-01-metaplatform-control-plane-v1.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-runtime-employee-host-v1.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-artifact-application-output-v1.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-ontology-skill-mcp-v1.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-action-data-knowledge-memory-v1.md
- Create: docs/superpowers/plans/2026-09-01-metaplatform-tenant-deployment-operations-v1.md
- Modify: docs/superpowers/plans/2026-09-01-digital-employee-platform-mvp-roadmap.md
- Modify: acceptance/release/v1/requirements.yaml

**Interfaces:**
- Consumes: each product module's authority, lifecycle CRUD and acceptance requirements.
- Produces: six independently executable plans; each Requirement maps to exactly one primary plan and may name dependencies on MVP1–MVP4.

- [ ] **Step 1: Specify plan boundaries without duplicating authority**

Write plans in the product-spec order: control plane; runtime/employee/host; artifact/application/output; ontology/skill/MCP; action/data/knowledge/memory; tenant/deployment/operations. Each plan must declare its authority boundaries and consume existing UserProfile, EmployeeVersion, RunContext, ArtifactEnvelope, OntologyPackage and ActionPlan contracts instead of recreating them.

- [ ] **Step 2: Give every plan executable tasks**

Each child plan must follow the repository plan format: exact files, stable interfaces, failing tests, live test commands, rollback tests and commit boundaries. It must include CRUD lifecycle behavior, RBAC/ABAC checks, tenant isolation, append-only audit and a real E2E flow for every first-release Requirement it owns.

- [ ] **Step 3: Bind existing MVP work rather than copying it**

Update the roadmap plan index so MVP1–MVP4 remain the business acceptance source for order, contract, ontology factory and ontology operations. The new product plans may depend on their contracts but cannot duplicate their migrations, Artifact digests, Lease rules or business E2E suites.

- [ ] **Step 4: Verify plan coverage**

Run: mate-platform-backend/.venv/Scripts/python.exe scripts/verify-release-traceability.py acceptance/release/v1/requirements.yaml acceptance/gates/component-matrix.yaml

Expected: every IMPLEMENTED or PLANNED first-release Requirement points to a single primary plan and at least one real acceptance test path.

- [ ] **Step 5: Commit plan-set closure**

~~~bash
git add docs/superpowers/plans/2026-09-01-metaplatform-*-v1.md docs/superpowers/plans/2026-09-01-digital-employee-platform-mvp-roadmap.md acceptance/release/v1/requirements.yaml
git commit -m "docs(release): complete first release implementation plan set"
~~~

### Task 3: 锁定生产 Profile、迁移权威与单一身份路径

**Files:**
- Create: acceptance/release/v1/production-profile.schema.json
- Create: acceptance/release/v1/production-profile.yaml
- Create: scripts/verify-production-profile.py
- Create: mate-platform-backend/tests/architecture/test_production_profile.py
- Create: docs/superpowers/plans/2026-09-01-metaplatform-database-release-and-upgrade-safety.md
- Modify: acceptance/gates/component-matrix.yaml
- Modify: docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md

**Interfaces:**
- Produces: EnabledComponent { component, version, image_digest, config_digest, gate_id, owner, rpo, rto, rollback } and one locked ProductionProfile.
- Consumes: Gate DAG, signed container/package metadata and the Supabase→Keycloak runtime-token contract.

- [ ] **Step 1: Write failing profile and authority tests**

~~~python
def test_profile_rejects_enabled_component_without_passing_gate() -> None:
    result = verify_profile(profile_with("ragflow", gate_status="NOT_EXERCISED"))
    assert result.codes == {"ENABLED_COMPONENT_GATE_NOT_PASSED"}

def test_production_sources_cannot_create_schema_or_use_legacy_iam() -> None:
    assert production_source_violations() == []
~~~

- [ ] **Step 2: Implement immutable profile validation**

Require every enabled component to reference one exact matrix row and matching image/config Digests. Reject tag-only references, missing RPO/RTO, absent rollback, unowned components, INSECURE_SKIP_SIGNATURE=true, LEGACY_LOGIN_COMPAT=true, create_all( and InMemoryOutboxWriter in production paths.

- [ ] **Step 3: Plan and implement safe migration/identity convergence**

The database-safety plan must create a dedicated, signed, least-privilege Alembic Job; require pre-migration snapshot, 0015 → 0020 upgrade/restart regression, schema expand-contract compatibility, PITR recovery and post-migration reconciliation. It must remove legacy IAM from runtime routes, OpenAPI manifests and authorization facts after the approved compatibility window, while retaining a tested rollback route that does not create a second identity authority.

- [ ] **Step 4: Run validation**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_production_profile.py -q

Expected: an enabled component with NOT_EXERCISED, a mutable image tag, a legacy IAM route or runtime DDL fails validation.

- [ ] **Step 5: Commit profile and safety controls**

~~~bash
git add acceptance/release/v1/production-profile.schema.json acceptance/release/v1/production-profile.yaml scripts/verify-production-profile.py mate-platform-backend/tests/architecture/test_production_profile.py docs/superpowers/plans/2026-09-01-metaplatform-database-release-and-upgrade-safety.md acceptance/gates/component-matrix.yaml docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md
git commit -m "feat(release): lock production profile and migration authority"
~~~

### Task 4: 建立可观测、SLO、应急与全链路恢复计划

**Files:**
- Create: docs/superpowers/plans/2026-09-01-metaplatform-tenant-deployment-operations-v1.md
- Create: acceptance/release/v1/slo-catalog.yaml
- Create: acceptance/release/v1/on-call-raci.yaml
- Create: acceptance/release/v1/runbook-index.yaml
- Create: acceptance/release/v1/recovery-drill.schema.json
- Create: acceptance/release/v1/recovery-drill.yaml
- Modify: docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md

**Interfaces:**
- Produces: SLO { service, sli, objective, window, error_budget, alert_rule }, Runbook { alert_id, responder_role, diagnose, mitigate, recover, verify }, and a signed recovery drill result.
- Consumes: OTel/OpenInference telemetry, Prometheus, Perses, Alertmanager, OpenSearch, CNPG/Object/Registry/Identity/Policy/Workflow backup evidence.

- [ ] **Step 1: Define numeric service objectives**

Create SLO entries for login/token exchange, authorized read, Run transition, Artifact read/write, approval consumption, action execution, MCP discovery/call, RAG retrieval and deployment reconciliation. Each entry states measurement query, rolling window, availability/latency/error objective, alert threshold, error-budget action and capacity owner.

- [ ] **Step 2: Define accountable operations**

Assign release manager, on-call primary/backup, security incident lead, data recovery lead, business approver and communications owner. Every alert rule maps to one Runbook, escalation route and quarterly drill. A missing assignment blocks GA.

- [ ] **Step 3: Define the whole-tenant recovery drill**

Recover into an independent failure domain: PostgreSQL Run Ledger and audit, SeaweedFS objects, Identity links/keys, OpenFGA/OPA policy, NATS streams, Temporal histories, OCI Registry, OpenBao, deployment config and observations. Reconcile expected business facts; assert no duplicate side effects, no broken Artifact Digest chain and no RPO/RTO breach.

- [ ] **Step 4: Validate operations evidence**

Run: mate-platform-backend/.venv/Scripts/python.exe scripts/verify-release-traceability.py acceptance/release/v1/requirements.yaml acceptance/gates/component-matrix.yaml

Expected: all production requirements reference numeric SLO/RPO/RTO, an alert route, a Runbook and recovery evidence; health probes alone are rejected.

- [ ] **Step 5: Commit operational readiness assets**

~~~bash
git add docs/superpowers/plans/2026-09-01-metaplatform-tenant-deployment-operations-v1.md acceptance/release/v1/slo-catalog.yaml acceptance/release/v1/on-call-raci.yaml acceptance/release/v1/runbook-index.yaml acceptance/release/v1/recovery-drill.schema.json acceptance/release/v1/recovery-drill.yaml docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md
git commit -m "docs(operations): define SLO incident and recovery readiness"
~~~

### Task 5: 实现最终 GA 聚合 Gate 与真实生产推广

**Files:**
- Create: acceptance/release/v1/platform-ga.schema.json
- Create: acceptance/release/v1/platform-ga.yaml
- Create: scripts/test-production-release-promotion.ps1
- Create: mate-platform-backend/tests/architecture/test_platform_ga_evidence.py
- Create: docs/superpowers/plans/2026-09-01-metaplatform-ga-release-and-cutover.md
- Modify: scripts/test-production-gate.ps1
- Modify: .github/workflows/ga-acceptance.yml

**Interfaces:**
- Produces: PlatformGA { release_id, production_profile_digest, requirement_matrix_digest, parent_gates, business_e2e, recovery_drill, promotion, signatures, status }.
- Consumes: all release traceability, component Gate and production profile evidence.

- [ ] **Step 1: Write failing aggregate-Gate tests**

~~~python
def test_platform_ga_requires_closed_requirements_and_passing_parents() -> None:
    result = validate_ga(ga_with(requirement_status="PLANNED", parent_status="PASSED"))
    assert result.codes == {"REQUIREMENT_NOT_IMPLEMENTED"}

def test_platform_ga_rejects_mocked_business_e2e() -> None:
    result = validate_ga(ga_with(e2e_provenance="page.route"))
    assert result.codes == {"MOCKED_PRODUCTION_E2E_FORBIDDEN"}
~~~

- [ ] **Step 2: Implement the platform-ga evidence schema**

Require exact profile, requirement-matrix and toolchain Digests; every enabled component Gate; all business E2E identities; independent recovery drill; pre-production data replay provenance; change approval; promotion window; observation window; explicit auto/manual rollback threshold; and named signatures for business, security, data, operations and release owners.

- [ ] **Step 3: Implement the only production promotion runner**

test-production-release-promotion.ps1 must create no production resources before verifying the signed Release Manifest. It runs against an approved pre-production target using de-identified data, deploys an allowlisted first tenant or traffic slice, waits through the locked observation window, evaluates SLO/error budget/alert state, then either records promotion or executes the declared rollback. It always exports manifests, logs, metrics, audit correlation IDs and rollback result; it never changes platform-ga to PASSED on a mocked endpoint or a local Compose environment.

- [ ] **Step 4: Run GA evidence tests**

Run: mate-platform-backend/.venv/Scripts/python.exe -m pytest mate-platform-backend/tests/architecture/test_platform_ga_evidence.py -q

Expected: missing stakeholder signature, failed child Gate, stale Digest, mock E2E, missing recovery drill or absent rollback result fails validation.

- [ ] **Step 5: Commit GA release controls**

~~~bash
git add acceptance/release/v1/platform-ga.schema.json acceptance/release/v1/platform-ga.yaml scripts/test-production-release-promotion.ps1 mate-platform-backend/tests/architecture/test_platform_ga_evidence.py docs/superpowers/plans/2026-09-01-metaplatform-ga-release-and-cutover.md scripts/test-production-gate.ps1 .github/workflows/ga-acceptance.yml
git commit -m "test(release): require platform GA promotion evidence"
~~~

### Task 6: 按波次实施、验证并宣告首发状态

**Files:**
- Modify: acceptance/release/v1/requirements.yaml
- Modify: acceptance/release/v1/production-profile.yaml
- Modify: acceptance/release/v1/platform-ga.yaml
- Modify: acceptance/gates/component-matrix.yaml
- Create: acceptance/release/v1/release-readiness-report.md

**Interfaces:**
- Consumes: committed implementation plans, signed Gate evidence, real E2E and recovery/promotion evidence.
- Produces: immutable release-readiness report with GO or NO-GO only.

- [ ] **Step 1: Execute in dependency waves**

Execute W0 release scope/profile/Gate framework; W1 control plane plus runtime/artifact foundation; W2 MVP1 real order loop; W3 application/capability/MCP and action/data/knowledge/memory products; W4 MVP2–MVP4 and all selected target components; W5 operations, mixed deployment, recovery and GA promotion. Do not start a later wave when its prerequisite Requirement or Gate is FAILED or NOT_EXERCISED.

- [ ] **Step 2: Run the complete evidence suite**

Run: pwsh -File scripts/test-production-gate.ps1 -Gate platform-ga -WithDependencies

Run: pwsh -File scripts/test-production-release-promotion.ps1 -ReleaseManifest acceptance/release/v1/platform-ga.yaml

Expected: both commands finish with PASSED only for the locked production profile, current Digests, real target environment and recorded rollback capability.

- [ ] **Step 3: Publish the readiness report**

The report lists every enabled requirement and Gate with exact evidence Digest, time, environment identity, owner and status. It must state NO-GO whenever one required item is not PASSED; it may state GO only after the two commands above pass and all required stakeholder signatures are valid.

- [ ] **Step 4: Commit release decision evidence**

~~~bash
git add acceptance/release/v1/requirements.yaml acceptance/release/v1/production-profile.yaml acceptance/release/v1/platform-ga.yaml acceptance/gates/component-matrix.yaml acceptance/release/v1/release-readiness-report.md
git commit -m "docs(release): record MetaPlatform first release decision"
~~~

## Self-Review

- 产品范围：Task 1 强制覆盖 15 个模块；Task 2 按产品主规格的六组边界产出独立可执行计划，避免用单体计划掩盖缺口。
- 上线安全：Task 3 收口组件选择、迁移和身份权威；Task 4 收口 SLO、告警、值班和全链路恢复；Task 5 收口真实环境推广与回退。
- 证据完整性：Task 6 只允许 platform-ga 汇聚当前 Digest、真实 E2E、恢复、推广和签字；所有未执行项目继续显示 NOT_EXERCISED。
- 术语和接口：Requirement、ProductionProfile、PlatformGA 的状态和 Digest 引用在全部任务中一致；没有以健康检查、mock 或文档评审替代生产证据。
