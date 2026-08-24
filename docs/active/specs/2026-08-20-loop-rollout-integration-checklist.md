# LOOP-ROLLOUT-01 · Per-app Integration Checklist

> 模板母本：`docs/active/specs/2026-07-30-per-app-integration-checklist.md`
> 本 BATCH 范围特殊（meta / doc + CI 工具），7 节裁剪后如下。

---

## §1 架构位（本 BATCH 的架构位 = Loop 自身）

- [ ] Loop 三阶段模型文档化（ADR-0044）
- [ ] 分支策略明确：`main` / `codex/<batch>` / `cowork/<batch>-prd` / `cowork/<batch>`
- [ ] Loop 节点交接物：PRD + checklist + ACCEPTANCE + ADR
- [ ] 不破坏现有 v3.0 GA / v3.1 / v4 主线
- 证据：ADR-0044 + LOOP-ROLLOUT-01 PRD §0
- 命令：`grep "分支策略" docs/active/decisions/ADR-0044-cowork-code-loop-rollout.md`

## §2 服务身份（本 BATCH 不引入新服务）

- [ ] 不新增 Python service / Java engine / K8s deployment
- [ ] 仅新增 1 个 GitHub Actions workflow（cowork-prd-ci.yml）
- 证据：cowork-prd-ci.yml
- 命令：`grep "name: cowork-prd-ci" .github/workflows/cowork-prd-ci.yml`

## §3 租户隔离（N/A）

- [ ] 本 BATCH 不涉及跨租户数据流
- 证据：N/A
- 命令：—

## §4 事件（Outbox / Kafka / DLQ）

- [ ] 不新增 / 不修改任何 Kafka topic
- [ ] 不引入新 Outbox 事件
- 证据：N/A
- 命令：—

## §5 审计、指标、Trace

- [ ] 不引入新 OTel span / metric
- [ ] cowork-prd-ci.yml 仅打 Actions 自身日志
- 证据：cowork-prd-ci.yml
- 命令：`grep -c "otel\|opentelemetry" .github/workflows/cowork-prd-ci.yml` 输出 0

## §6 Helm / K8s

- [ ] 不修改 `infra/helm/`
- [ ] 不修改 NetworkPolicy
- 证据：N/A
- 命令：—

## §7 验收证据

- [ ] LOOP-ROLLOUT-01-ACCEPTANCE.md 存在
- [ ] 13 门禁行齐全（即使 N/A 也要标 N/A + 理由）
- [ ] §1~§2 自有门禁全 ✅
- 证据：`docs/active/delivery/evidence/LOOP-ROLLOUT-01-ACCEPTANCE.md`
- 命令：`python scripts/ci/require_evidence.py`