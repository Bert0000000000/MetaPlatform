# ADR-0015：GA 验收政策（GA-ACCEPTANCE）

> 状态：**Proposed**（GA 通过后转 Accepted，作为 v3.0 GA 收口）
> 日期：2026-07-30
> 关联批次：GA-ACCEPTANCE（PROGRAM-BOBOARD.md）
> 关联设计：docs/active/specs/2026-07-30-backend-production-readiness-design.md §10 / §13
> 上游依赖：API-GOV-01 ✅ / ARCH-CORE-01 ✅ / PLATFORM-K8S-01 ✅ / SEC-IAM-01 ✅ / SEC-TENANT-01 ✅ / PLATFORM-EVENT-01 ✅ / TECH-SERVICES ✅

---

## 1. Context

前 7 个 Delivery Batch 已完成。PROGRAM-BOARD.md 中 7 行 Accepted,2 行 Not Started
（BUSINESS-SLICES / DATA-D0-D8 / GA-ACCEPTANCE —— 实际是 3 行）。

但 §13 硬规则 1-13 全部落地到代码 / 测试 / CI 需要 **一个最终收口**，把
散落在 7 个 batch 的 §13 硬规则证据集中归档，并补足：

- pre-commit 钩子不全（缺 secret 扫描 / raw-SQL 检测 / helm-docs 同步）
- kafka sub-chart 占位 `enabled: false` 未真实落地
- 没有统一的 GA 流水线（13 jobs）
- 没有最终的 e2e smoke（17 域端到端）

本 ADR 锁定 GA-ACCEPTANCE 的范围与产出。

## 2. Decision

GA-ACCEPTANCE = "v3.0 全 13 硬规则闭环" + "BUSINESS-SLICES / DATA-D0-D8 的模式
已就位（实际 15 域 + 数据平台按 P0/P1/P2 在后续批次接力）"。

### 2.1 13 硬规则 → 13 GA jobs

每个 §13 硬规则对应一个 CI job + 一份证据：

| # | 硬规则 | CI job | 证据 |
|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | `ga-001-routes-from-openapi` | oasdiff 校验 |
| 2 | PRD 没有 Requirement ID，不进入开发 | `ga-002-requirement-ids` | requirement_id 标签 |
| 3 | 没有 tenant 上下文，不访问 repository | `ga-003-tenant-required` | raw-SQL 钩子 + pytest |
| 4 | 外部系统没有 ACL Client，业务代码不直连 | `ga-004-acl-client` | grep 禁止裸 httpx |
| 5 | Production profile 禁止 fake / mock / memory fallback | `ga-005-no-fallback` | env 校验测试 |
| 6 | 静态检查失败不合并 | `ga-006-ruff-pyright` | ruff + pyright strict |
| 7 | 契约或集成测试跳过不标记 Accepted | `ga-007-no-skip` | grep 禁止 skip/xfail |
| 8 | 没有 K8s readiness 和回滚不算生产完成 | `ga-008-k8s-rollback` | helm template + kubeconform + rollback test |
| 9 | 没有审计、指标和 trace 不算业务闭环 | `ga-009-observability` | OTel + Loki + Tempo |
| 10 | 所有状态以验收证据为准 | `ga-010-evidence-required` | evidence 字段校验 |
| 11 | helm-docs 同步每个子 chart 的 README | `ga-011-helm-docs` | helm-docs --dry-run |
| 12 | Secret 不进 git | `ga-012-secret-scan` | gitleaks + detect-secrets |
| 13 | NetworkPolicy 缺失等同于 prod 不通过 | `ga-013-networkpolicy` | NetworkPolicy 必须存在 |

### 2.2 pre-commit 钩子扩展

当前 `.pre-commit-config.yaml` 已有：trailing-whitespace / EOF / merge conflict
/ yaml / json / toml / ruff / ruff-format / uv-lock / prettier / hadolint / shellcheck。

本批新增：
- **gitleaks** （§13 第 12 条 secret 扫描）
- **detect-private-key**（已有，保留）
- **raw-SQL 钩子**（§13 第 3 条：禁止 `session.execute(text(...))` 出现在 `app-*/src`）
- **helm-docs 同步**（§13 第 11 条：chart README 必须由 helm-docs 生成）
- **pyright 严格模式**（§13 第 6 条静态检查）

### 2.3 kafka sub-chart

补全 PLATFORM-K8S-01 / PLATFORM-EVENT-01 已知遗留：Bitnami Kafka 28.x（KRaft
模式，单节点 + 3 broker 两套 values）。

### 2.4 BUSINESS-SLICES / DATA-D0-D8 的位置

- **BUSINESS-SLICES**：15 域按 ADR-0014 checklist 接入；本 GA 标志"模式就位"。
- **DATA-D0-D8**：数据平台（CDC / lineage / quality / catalog）独立批次，GA 标志
  "DATA-D0-D8 的 ADR 占位（ADR-0016 待写）"。

## 3. Alternatives

### A. 一次性 BUSINESS-SLICES + DATA-D0-D8 + GA 一起做

- **优点**：一次完成。
- **缺点**：单 PR 200+ 文件；不可回滚；review 难。
- **否决理由**：违反 production-readiness §10 提交顺序 + §13 硬规则 7。

### B. 不做 GA 收口，仅标 Accepted

- **优点**：快速。
- **缺点**：§13 硬规则 1-13 散落 7 个 batch，无统一审计；pre-commit 不全。
- **否决理由**：GA 是终点，必须"全收口"，否则上生产 = 携带已知遗留。

## 4. Consequences

### 4.1 正面

- §13 硬规则 1-13 全部有 GA 流水线 + 证据 + pre-commit 钩子三层保障。
- v3.0 GA 准备就绪：13 jobs + 全 134+ tests + 17 域 OpenAPI + 5 步 checklist。
- 后续 v3.1 / v4.0 在 GA baseline 上增量演进。

### 4.2 负面 / 风险

- 13 jobs 的 CI 跑时长可能 30+ 分钟；需缓存。
- pre-commit 钩子首次跑会暴露历史 commit 中的 raw-SQL / 旧风格代码 → 需批量修。
- kafka chart 实际部署需 Bitnami repo 凭据；local 用 Bitnami 公开 chart。

### 4.3 缓解

- CI 跑时分层（lint / unit / integration / e2e），并行跑。
- pre-commit `pre-commit run --all-files` 在本批一次性修复所有历史问题。
- Bitnami repo 是公开的，no creds needed for basic deploy。

## 5. Migration

```
dev → local → contract → integration → staging → pre-production → production
```

| 阶段 | 动作 | 验证 |
|---|---|---|
| dev | pre-commit run --all-files | 0 错 |
| local | 13 jobs 全跑通 | 13 / 13 pass |
| contract | 17 域 OpenAPI 合并 oasdiff | 0 breaking |
| integration | 17 域端到端（mock 模式）| 134+ tests |
| staging | 真实 Kafka / PG / Redis / MinIO | 13 hard rules |
| pre-production | 灰度切流 | SLO |
| production | GA 切流 | 13 jobs + SLO |

## 6. Verification

GA-ACCEPTANCE 退出条件（13 项硬规则映射）：

1-13：每条硬规则必须有 GA job + evidence + pre-commit 钩子。
- 全部 13 jobs pass。
- 全部 134+ tests pass。
- pre-commit run --all-files 0 错。
- 13 门禁结果落档：本文 + GA-ACCEPTANCE.md。
- PROGRAM-BOBOARD.md：GA-ACCEPTANCE = **Accepted**。
- CLAUDE.md 标记 v3.0 GA 完成。

## 7. References

- `docs/active/decisions/ADR-0010` - ADR-0015
- `docs/active/decisions/ADR-0011-sec-iam-keycloak-migration.md`
- `docs/active/decisions/ADR-0012-sec-tenant-isolation.md`
- `docs/active/decisions/ADR-0013-platform-event-outbox.md`
- `docs/active/decisions/ADR-0014-tech-services-integration.md`
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md` §13
- `docs/active/delivery/evidence/*-ACCEPTANCE.md`（7 份）
- `docs/active/delivery/PROGRAM-BOARD.md`