# MetaPlatform 宿主环境部署与运营保障 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Use the release registry as the state authority; this plan is not completion evidence.

**Goal:** 完成宿主、环境与部署中心以及运营、审计与质量中心的首发产品能力，使同一 TenantRuntime Package 能够在云端生产和连接型私有环境安全发布、观测、降级、恢复和回退，并让用户明确知道当前可用、暂停和恢复中的能力。

**Architecture:** Environment/Deployment bounded context 持有环境身份、租户运行面、Package/Bundle、Deployment 与 Drift；Operations bounded context 持有指标、审计、告警、事件、评测、成本、安全供应链、Gate、备份恢复和 DLQ 重放。Flux/Helm 负责声明式交付，OpenTelemetry/Prometheus/OpenSearch 负责观测，统一 Gate runner 负责真实环境证据。该中心消费 HostCapabilityContract，但不拥有员工、BusinessSession、Run 或 Artifact。完全断网 Cell 只有在 production-profile 明确启用并通过独立 Gate 时进入首发。

**Tech Stack:** Python 3.12、FastAPI、Pydantic 2、PostgreSQL/Alembic、Kubernetes/RKE2、Helm、Flux、OCI Registry、Cosign/Sigstore、Syft/Grype 或同类开源扫描器、OpenTelemetry、Prometheus、Alertmanager、OpenSearch、NATS JetStream、Restic/Velero/pgBackRest、React/Vite、Playwright、PowerShell live runners。

**Spec:** docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md; docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md; docs/superpowers/plans/2026-09-01-metaplatform-database-release-and-upgrade-safety.md; docs/superpowers/plans/2026-09-01-metaplatform-ga-release-and-cutover.md

## Global Constraints

- 首发必选目标是 cloud-production 与 connected-private；二者使用同一签名 TenantRuntime Package 和相同领域契约。环境差异只能进入显式 profile/config，不得形成第二套产品代码。
- Codex、Claude Code、DSH、Hermes 的 Host Gate 独立于 Disconnected Cell Gate；不启用完全断网 Cell 不能免除四宿主验证。
- Environment identity、profile Digest、evidence_valid_until 与 invalidation_inputs 必须进入每条 GateEvidence；证据不可跨环境冒用。
- Deployment 只能消费 Digest 固定、签名通过、有 SBOM/许可证/漏洞结论和回退声明的 Package/Bundle。
- 运行健康不能替代业务验收、身份验证、数据正确性或恢复演练。
- Runtime/Artifact/Identity/Policy/Event/Workflow/Config 的权威不迁移到 Observability 或 GitOps。
- 高危漏洞、禁止许可证、过期例外、过期 Gate、漂移未闭合、恢复未演练或回退不可用一律阻断生产推广。
- 审计为追加式且可验证；日志/Trace 默认脱敏，不采集私有思维链。
- 所有用户可见故障必须投影为 AVAILABLE、READ_ONLY、ACTIONS_PAUSED、WAITING_RECOVERY 或 UNAVAILABLE，并提供独立的 severity/reason、影响、替代路径和恢复通知；severity 不是状态机输入。
- 所有管理对象和接口必须登记到 requirements.yaml、interface-registry.yaml、ownership-matrix.yaml 并绑定 provider/consumer 证据。

---

## Delivery Object Matrix

| Context | 必须交付的管理对象 | 首发生命周期 |
|---|---|---|
| Consumed host evidence | HostType/HostVersion、HostCapabilityContract、ConnectorDefinition/Version、ConnectorInstance | 只读验证、引用和证据过期；对象/API/迁移权威属于 runtime-employee-host 计划，本计划不得重建 |
| Environment | RuntimeEnvironment、TenantRuntime、可选 DisconnectedCell | 创建、预检、查询、扩缩、升级、停用、导出、销毁 |
| Supply/deploy | PackageRegistryEntry、DeploymentBundle、DeploymentPlan、DeploymentExecution、DriftFinding/Reconciliation | 注册、验证、组合、Diff、审批、执行、暂停/继续、回滚、撤销、调和 |
| Observability | Dashboard/SavedQuery、Metric/SLODefinition、Log/Trace/SearchView | 创建、查询、修改视图、版本化 SLO、归档和保留清理 |
| Audit/incident | AuditEvent、InvestigationCase、AlertRule/Route、Incident | 追加、查询/导出、确认、升级、调查、解决、关闭、法律冻结 |
| Quality/cost/security | EvaluationDataset/Suite、EvaluationRun/Comparison、UsageCostRecord/Budget、SecurityFinding/SBOM/License | 创建、版本化、执行、比较、预算/阈值、修复、限时例外、撤销、归档 |
| Gates/recovery | GateDefinition/Evidence、BackupPolicy/Job、RestoreDrill、DLQ/ReplayPlan | 定义、执行、失效、备份、校验、恢复演练、重放审批、对账、归档 |

## Required Interface Surfaces

| Surface | 首发接口 |
|---|---|
| REST/OpenAPI | /hosts、/connectors、/environments、/tenant-runtimes、/packages、/bundles、/deployments、/drift、/dashboards、/slos、/audit、/alerts、/incidents、/evaluations、/budgets、/security-findings、/gates、/backups、/restore-drills、/dlq/replay-plans |
| MCP | get_capability_availability、get_deployment_status、query_operational_evidence；只读且按用户/员工/租户/Run 授权 |
| Events | EnvironmentChanged、DeploymentChanged、DriftDetected、SLOBreached、AlertRaised、IncidentChanged、GateEvidenceChanged、RestoreDrillCompleted、CapabilityAvailabilityChanged |
| UI | 环境/租户运行面、制品/Bundle、发布/回滚、漂移、观测/审计、告警/事件、评测/预算、安全供应链、Gate、备份恢复、DLQ，以及用户故障降级视图 |
| Delivery | Helm values schema、Flux manifests、signed OCI artifacts、production-profile、Gate evidence、runbook 和 notification contract |

### Task 1: Freeze operations contracts and authority

**Files:**
- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/deployment/contracts.py
- Create: mate-platform-backend/packages/mate-kernel/src/mate_kernel/operations/contracts.py
- Create: mate-platform-backend/packages/mate-kernel/tests/test_deployment_operations_contracts.py
- Create: mate-platform-backend/alembic/versions/20260901_0026_deployment_operations_v1.py (revision = 0026_deployment_operations_v1; down_revision = 0025_action_data_knowledge_memory_v1)
- Create: mate-platform-backend/tests/migrations/test_0026_deployment_operations_v1.py
- Modify: acceptance/release/v1/requirements.yaml
- Modify: acceptance/release/v1/interface-registry.yaml
- Modify: acceptance/release/v1/ownership-matrix.yaml
- Modify: acceptance/release/v1/production-profile.yaml

**Interfaces:**
- Produces EnvironmentIdentity, TenantRuntimeRef, PackageDigest, DeploymentExecutionId, GateEvidenceRef, RestoreDrillRef and CapabilityAvailabilityProjection.
- Consumes TenantId, HostCapabilityContractRef, ConfigReleaseDigest, ApplicationPackageDigest and Runtime/Artifact/Identity recovery checkpoints.
- Every mutable command requires tenant, human/service subject, expected_version, idempotency_key and correlation_id.

- [ ] Write failing state-machine tests for every Delivery Object Matrix lifecycle, stable errors and immutable evidence.
- [ ] Write failing migration tests for tenant RLS, append-only Audit/Gate/Restore ledgers, uniqueness, retention metadata, Outbox and legal hold.
- [ ] Implement contracts and 0026 expand migration; do not add production create_all or in-memory audit/outbox fallback.
- [ ] Populate object × operation × REST/MCP/Event/UI Requirement and InterfaceRecord rows plus bounded-context DRI.
- [ ] Run: pytest mate-platform-backend/packages/mate-kernel/tests/test_deployment_operations_contracts.py mate-platform-backend/tests/migrations/test_0026_deployment_operations_v1.py -q
- [ ] Commit: git commit -m "feat(kernel): define deployment and operations contracts"

### Task 2: Deliver environment, package and deployment lifecycle

**Files:**
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/deployment/domain.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/deployment/repository.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/deployment/service.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/deployment/api.py
- Create: mate-platform-backend/packages/mate-platform/tests/test_deployment_lifecycle.py
- Create: deploy/charts/tenant-runtime/Chart.yaml
- Create: deploy/charts/tenant-runtime/values.schema.json
- Create: deploy/charts/tenant-runtime/templates/deployment-controller.yaml
- Create: deploy/flux/tenant-runtime/kustomization.yaml
- Create: metaplatform-frontend/apps/web/src/pages/deployment/EnvironmentPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/deployment/DeploymentPage.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/deployment-lifecycle.spec.ts

**Interfaces:**
- REST: RuntimeEnvironment/TenantRuntime CRUD and lifecycle; PackageRegistry read/register/revoke; Bundle draft/validate/release/revoke; DeploymentPlan create/read/update-before-approval/cancel; Execution approve/start/pause/resume/cancel/rollback; Drift list/accept-until/reconcile.
- Events: TenantRuntimeChanged, PackageRevoked, DeploymentChanged and DriftDetected.
- GitOps: every execution records desired-state commit, chart/config/image/policy/migration Digests and actual cluster identity.

- [ ] Write failing tests for environment identity, secret reference only, same-package profile differences, approval, maintenance window, safe cleanup and old-active-version preservation.
- [ ] Implement repositories/services/APIs and signed OCI/Helm/Flux flow; block unsigned, mutable-tag, forbidden-license or unresolved high-risk packages.
- [ ] Implement cloud-production and connected-private overlays from one values schema; keep disconnected Cell absent unless explicitly enabled.
- [ ] Implement UI environment/package/Bundle/Diff/approval/progress/log/rollback/drift workflows, including readonly degraded views.
- [ ] Prove failed deployment deletes only resources created by that execution, leaves the old active version, and produces rollback evidence.
- [ ] Commit: git commit -m "feat(deployment): deliver tenant runtime release lifecycle"

### Task 3: Deliver observability, audit, incident and evaluation products

**Files:**
- Create: mate-platform-backend/packages/mate-tech-obs/src/mate_tech_obs/operations/domain.py
- Create: mate-platform-backend/packages/mate-tech-obs/src/mate_tech_obs/operations/service.py
- Create: mate-platform-backend/packages/mate-tech-obs/src/mate_tech_obs/api/operations.py
- Create: mate-platform-backend/packages/mate-tech-obs/tests/test_operations_lifecycle.py
- Create: deploy/observability/otel-collector.yaml
- Create: deploy/observability/prometheus-rules.yaml
- Create: deploy/observability/alertmanager-routes.yaml
- Create: metaplatform-frontend/apps/web/src/pages/operations/OperationsOverviewPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/operations/AuditIncidentPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/operations/EvaluationBudgetPage.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/operations-audit.spec.ts

**Interfaces:**
- REST: Dashboard/SavedQuery CRUD; SLO draft/release/retire; audit query/export/legal-hold; investigation create/update/close; alert rule/route CRUD/silence-with-expiry; incident acknowledge/escalate/resolve/close; evaluation dataset/suite/run/compare; budget/rule/forecast.
- Events: SLOBreached, AlertRaised, IncidentChanged, EvaluationCompleted and BudgetThresholdReached.
- Correlation keys: tenant_id, user_id, employee_version, session_id, run_id, subrun_id, tool_id, workflow_execution_id and deployment_id.

- [ ] Write failing tests for cross-tenant observability denial, log redaction, immutable AuditEvent, signed export, expiring silence, protected security alerts and version-bound evaluation.
- [ ] Establish minimum logs/metrics/Trace/audit/error alerts in PI-1; extend to all module SLOs and operational UI by PI-5.
- [ ] Implement incident linkage to deployments, Runs, services, data watermark and recovery evidence; implement three owned post-incident actions maximum per Retro.
- [ ] Implement UI dashboards, trace correlation, audit export, investigations, alerts, incidents, evaluations and budgets.
- [ ] Prove health-green with broken IAM/data/recovery does not satisfy Gate or Feature Done.
- [ ] Commit: git commit -m "feat(operations): deliver observable audited service management"

### Task 4: Deliver supply-chain policy and production Gates

**Files:**
- Create: acceptance/gates/schemas/security-supply-chain-v1.schema.json
- Modify: acceptance/gates/component-matrix.yaml
- Modify: acceptance/gates/gate-dependency-dag.yaml
- Create: scripts/test-supply-chain-gate.ps1
- Create: scripts/test-environment-bound-gate.ps1
- Create: mate-platform-backend/tests/architecture/test_security_release_policy.py
- Create: metaplatform-frontend/apps/web/src/pages/operations/SecurityGatePage.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/security-gate.spec.ts

**Interfaces:**
- Produces SecurityFinding, SBOMRef, LicenseDecision, ExceptionApproval and GateEvidence.
- Gate states are PASSED, FAILED and NOT_EXERCISED; capability states cannot replace them.
- Every exception requires severity, owner, approver, compensating control, expires_at and remediation SLA.

- [ ] Write failing policy tests: critical or actively exploited vulnerabilities have no default exception; high severity blocks unless an approved short-lived exception and compensating control satisfy policy; forbidden licenses and missing SBOM/signature always block.
- [ ] Define first-release remediation SLA and exception maximum lifetime in production-profile; make expired exception automatically invalidate GateEvidence.
- [ ] Generate signed SBOM/provenance, verify image/chart/config Digests and run secret/license/vulnerability scans.
- [ ] Make environment ID, runner identity, time, profile Digest and invalidation inputs mandatory; reject local/mock evidence for target production Gates.
- [ ] Implement UI finding triage, owner/SLA, exception, revocation, Gate DAG and evidence detail.
- [ ] Commit: git commit -m "test(supply-chain): enforce production security gates"

### Task 5: Deliver backup, restore, DLQ replay and user degradation

**Files:**
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/resilience/backup_service.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/resilience/replay_service.py
- Create: mate-platform-backend/packages/mate-platform/src/mate_platform/resilience/availability_projection.py
- Create: mate-platform-backend/packages/mate-platform/tests/test_backup_restore_replay.py
- Create: mate-platform-backend/packages/mate-platform/tests/test_capability_availability_projection.py
- Create: scripts/test-tenant-restore-drill.ps1
- Create: metaplatform-frontend/apps/web/src/pages/operations/RecoveryPage.tsx
- Create: metaplatform-frontend/apps/web/src/components/availability/CapabilityAvailabilityBanner.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/recovery-degradation.spec.ts

**Interfaces:**
- REST: BackupPolicy CRUD; BackupJob read/cancel; RestoreDrill create/read/reconcile/sign; DLQ query; ReplayPlan create/update-before-approval/approve/cancel/reconcile; capability availability read/subscribe.
- MCP: get_capability_availability returns user-readable status and permitted alternatives, not secrets or hidden capabilities.
- Events: BackupCompleted, RestoreDrillCompleted, ReplayPlanChanged, CapabilityAvailabilityChanged and RecoveryCompleted.

- [ ] Write failing tests for encrypted backup coverage, restore to independent failure domain, deletion tombstone/legal hold, bounded replay, authorization/Lease/idempotency recheck and business reconciliation.
- [ ] Implement progressive recovery: PI-1 database/Artifact/identity minimum drill; PI-3 Temporal/NATS incremental drill; PI-5 full tenant drill; PI-6 final-candidate revalidation.
- [ ] Reconcile Run Ledger, Artifact/Object, identity, policy, events, workflow, audit, config and memory facts after restore; backup success alone is insufficient.
- [ ] Implement failure-domain projections and UI banners/actions for identity, policy, data, knowledge, model, MCP, action, workflow, event, memory and deployment failures.
- [ ] Prove recovery notification clears only after authoritative health and reconciliation; prove DLQ replay cannot duplicate a protected effect.
- [ ] Commit: git commit -m "feat(resilience): deliver recovery replay and degradation experience"

### Task 6: Validate hybrid operations and release interfaces

**Files:**
- Create: acceptance/release/v1/evidence/deployment-operations-cloud.yaml
- Create: acceptance/release/v1/evidence/deployment-operations-connected-private.yaml
- Create: mate-platform-backend/tests/contract/test_deployment_operations_consumers.py
- Create: metaplatform-frontend/apps/web/tests/e2e/hybrid-operations.spec.ts
- Modify: acceptance/release/v1/requirements.yaml
- Modify: acceptance/release/v1/interface-registry.yaml
- Modify: acceptance/release/v1/sprint-board.yaml
- Modify: acceptance/release/v1/production-profile.yaml

**Interfaces:**
- Consumes current final-candidate package, schema, interface registry and four independent HostCapabilityContract evidence records.
- Produces environment-specific promotion, observation, rollback, recovery, SLO and provider/consumer contract evidence.

- [ ] Deploy the same signed Bundle to cloud-production-equivalent and connected-private-equivalent targets; verify only approved profile fields differ.
- [ ] Run tenant isolation, four-host contracts, deployment, drift, observability, audit, alert, incident, evaluation, security, backup/restore, replay and user degradation E2E.
- [ ] Perform canary/first-tenant promotion, locked observation and automatic/manual rollback in both target classes.
- [ ] Invalidate and rerun evidence when code, schema, image, chart, policy, configuration, environment or host version Digest changes.
- [ ] Set each enabled InterfaceRecord to RELEASED only when provider, every declared consumer, UI E2E and rollback evidence pass for the current candidate.
- [ ] Commit: git commit -m "test(platform): validate hybrid deployment and operations"

## Exit Criteria

- Delivery Object Matrix 的每个对象具有完整生命周期、租户/权限、审计、REST、Event、UI 和失败恢复证据。
- cloud-production 与 connected-private 使用同一签名 TenantRuntime Package；两类环境均完成灰度、观察、回退与独立故障域恢复。
- 四宿主独立 Host Gate 全部 PASSED；Disconnected Cell 是否启用不影响该判定。
- 最低可观测从 PI-1 开始，PI-5 完成全域 SLO/告警/事件/评测/预算/安全/恢复产品界面。
- 安全供应链策略包含严重级别阈值、修复 SLA、限时例外、例外到期失效和禁止许可证规则。
- 用户在每个已选故障域都能看到准确的可用范围、暂停能力、替代路径与恢复通知。
- 所有当前 production-profile Gate 和 InterfaceRecord 均有效且 RELEASED；任何过期证据、未闭合漂移、未演练恢复/回退或未签责任均为 NO-GO。
