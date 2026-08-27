# 13 硬规则 × CI Workflow 对位矩阵（GOVERN-01 / GOVERN-10）

> 编制：2026-08-07（GOVERN-01 治理收口） · 维护：MatePlatform Architecture Council
>
> 用途：13 硬规则（`docs/superpowers/specs/2026-07-30-backend-production-readiness-design.md` §13）每一条在哪个 CI workflow 的哪个 job 中验证、谁是 owner、对应 GOVERN 批次。
>
> **读法**：✅ = 当前已闭环；🟡 = 部分闭环（标注缺口）；⏳ = 待 GOVERN-10 落地；🔧 = 待修复。

## 0. 全局对位（13 × 9 workflow × owner）

| # | 硬规则（CLAUDE.md §13 编号） | ga-* job | workflow 文件 | owner | 状态 | 关联 GOVERN |
|---|---|---|---|---|---|---|
| ① | Swagger 没有接口，不写 route | `ga-001-openapi` | `.github/workflows/ga-acceptance.yml` | API-GOV | ✅ | GOVERN-08 |
| ② | PRD 没有 Requirement ID | `ga-002-requirement-ids` | `.github/workflows/ga-acceptance.yml` | ARCH-CORE | ✅ | GOVERN-08 |
| ③ | **没有 tenant 上下文，不访问 repository** | `ga-003-tenant`（`forbid_raw_sql`） | `.github/workflows/ga-acceptance.yml` | SEC-TENANT | ✅ | GOVERN-06 + -10 |
| ④ | **外部系统没有 ACL Client** | `ga-004-acl`（`forbid_bare_httpx`） | `.github/workflows/ga-acceptance.yml` | SEC-IAM | ✅ | — |
| ⑤ | **Production profile 禁止 fallback** | `ga-005-fallback`（`forbid_legacy_fallback`） | `.github/workflows/ga-acceptance.yml` | SEC-IAM | ✅ | GOVERN-09 |
| ⑥ | **静态检查失败不合并** | `ga-006-static` | `.github/workflows/ga-acceptance.yml` + `python-ci.yml`（lint/typecheck） | ARCH-CORE | ✅ | — |
| ⑦ | **契约或集成测试跳过不标记 Accepted** | `ga-007-skip-tests`（`forbid_skip_tests`） | `.github/workflows/ga-acceptance.yml` | ARCH-CORE | ✅ | GOVERN-10 |
| ⑧ | **没有 K8s readiness + 回滚** | `ga-008-helm` | `.github/workflows/ga-acceptance.yml` + `platform-k8s-ci.yml`（`helm-template`/`helm-unittest`） | PLATFORM-K8S | ✅ | GOVERN-09 |
| ⑨ | **没有审计、指标、trace** | `ga-009-observability` | `.github/workflows/ga-acceptance.yml` | PLATFORM-OBS | ✅ | GOVERN-09 + -10 |
| ⑩ | **所有状态以验收证据为准** | `ga-010-evidence`（`require_evidence`） | `.github/workflows/ga-acceptance.yml` | ARCH-CORE | ✅ | GOVERN-01 / -10 |
| ⑪ | **helm-docs 同步每个子 chart 的 README** | `ga-011-helm-docs` | `.github/workflows/ga-acceptance.yml` + `platform-k8s-ci.yml`（`helm-docs`） | PLATFORM-K8S | ✅ | GOVERN-09 |
| ⑫ | **Secret 不进 git** | `ga-012-secret-scan`（gitleaks） | `.github/workflows/ga-acceptance.yml` | SEC-IAM | ✅ | — |
| ⑬ | **NetworkPolicy 缺失 = prod 不通过** | `ga-013-networkpolicy`（inventory + rendered coverage） | `.github/workflows/ga-acceptance.yml` | PLATFORM-K8S | ✅ | GOVERN-09 |

> **统计**：13 条中 **13 条 ✅**、**0 条 🟡**、**0 条 ⏳**、**0 条 🔧**。这里的 ✅ 表示规则已有可执行的 CI/测试门禁；不等同于 staging/prod 已完成部署与演练。`ga-001~013` 全部 13 个独立 job 已拆分（GOVERN-10）：`ga-003-tenant` / `ga-004-acl` / `ga-005-fallback` / `ga-007-skip-tests` / `ga-010-evidence` 5 个原 `ga-hooks-and-tests` 复合 job 拆为独立守门，由 `tests/governance/test_hard_rules_ci.py` 机检 13 job 命中。

## 1. CI Workflow × Job 名索引

### 1.1 `architecture-ci.yml`（架构静态守门）
- `arch`（单 job，由 `scripts/ci/architecture_check.py` 驱动）

### 1.2 `python-ci.yml`（lint + typecheck + 架构测试）
- `lint`（ruff + black）
- `typecheck`（pyright）
- `architecture-tests`（`tests/architecture/`）
- `validate-yaml`（PyYAML 解析校验）

### 1.3 `platform-k8s-ci.yml`（Helm 静态校验）
- `static-checks`
- `helm-lint`
- `helm-template`
- `helm-unittest`
- `helm-docs`

### 1.4 `openapi-ci.yml`（契约闭环）
- `lint-and-bundle`（spectral + oasdiff）
- `traceability`（`scripts/validate_traceability.py`）
- `runtime-parity`（runtime json vs yaml）
- `breaking-change`（ga-001 守门）

### 1.5 `ga-acceptance.yml`（GA 13 硬规则）
- `ga-006-static`（硬规则 ⑥）
- `ga-009-observability`（硬规则 ⑨）
- `ga-011-helm-docs`（硬规则 ⑪）
- `ga-012-secret-scan`（硬规则 ⑫）
- `ga-001-openapi`（硬规则 ①）
- `ga-008-helm`（硬规则 ⑧）
- `ga-013-networkpolicy`（硬规则 ⑬）
- `ga-003-tenant`（硬规则 ③，`forbid_raw_sql`）
- `ga-004-acl`（硬规则 ④，`forbid_bare_httpx`）
- `ga-005-fallback`（硬规则 ⑤，`forbid_legacy_fallback`）
- `ga-007-skip-tests`（硬规则 ⑦，`forbid_skip_tests`）
- `ga-010-evidence`（硬规则 ⑩，`require_evidence`）
- `ga-hooks-and-tests`（pre-commit 聚合 + infra pytest + mate-platform pytest + GOVERN-02/-07 forbid_iam/forbid_legacy_artifacts）
- `ga-002-requirement-ids`（硬规则 ②）

### 1.6 `ci.yml`（顶层）
- `frontend`（pnpm install + build）

### 1.7 `g4-kind-e2e.yml` / `g4-d1-staging-e2e.yml`（E2E）
- `g4-kind-smoke` / `d1-staging-smoke`

## 2. 缺口与补登清单（GOVERN-10 落地动作）

| # | 缺口 | 拟新增 | 关联 | 状态 |
|---|---|---|---|---|
| G1 | `ga-hooks-and-tests` 复合 job 难追溯到单条硬规则 | 拆为 `ga-003-tenant` / `ga-004-acl` / `ga-005-fallback` / `ga-007-skip-tests` / `ga-010-evidence` 5 个独立 job | GOVERN-10 | ✅ 已拆分 |
| G2 | 13 × 8 matrix 无机器断言 | `tests/governance/test_hard_rules_ci.py`：枚举 13 硬规则 × 期望触发 job；CI 在 `ci.yml` 新增 `gov-hard-rules-matrix` job | GOVERN-10 | ✅ 已落地 |
| G3 | 历史上 5 条 🟡 硬规则的真实缺口（③/⑦/⑨/⑩/⑬） | ③/⑦/⑨/⑩/⑬ 已分别具备可执行的租户、skip、OTel、evidence、NetworkPolicy 门禁 | GOVERN-06 / -09 / -10 | ✅ |
| G4 | 矩阵本身无 owner 验收 | 每月 1 号由 ARCH-CORE 复核，纳入 PROGRAM-BOARD 治理 row | GOVERN-01 | ⏳ 待办 |

## 3. 验收标准

- `pytest tests/governance/test_hard_rules_ci.py -v` 全绿 ✅
- `grep -RE 'ga-00[1-9]|ga-01[0-3]' .github/workflows/ga-acceptance.yml` ≥ 13 个 job 名出现（当前 13 个）✅
- HARD-RULES-MATRIX.md 表格 117 格（13 硬规则 × 9 workflow）中 ≥90% 为非 `N/A` 命中 ✅
- 13 硬规则状态分布：13 ✅ / 0 🟡 / 0 ⏳ / 0 🔧（表示门禁已可执行，不表示生产集群演练已完成）
- 73 pre-existing 测试失败 → 6 个治理基础项已修复；FOLLOW-UP-A/B/C/D 的 focused gate 已分别留存证据，剩余全仓基线仍按主计划验证

---

**关联**：GOVERN-01（创建）/ GOVERN-10（机检 + 拆 job）/ ADR-0015 GA 收口 / `docs/active/governance/FOLLOW-UP-BOARD.md`（历史失败明细与 focused gate 证据）。
