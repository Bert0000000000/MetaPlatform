# LOOP-ROLLOUT-01-ACCEPTANCE

> 状态：In Progress · 2026-08-20
> ADR：ADR-0044 · Cowork/Code 双轨分支与三阶段 Loop 落地
> 第一阶段（Phase A）交付：3 份 ai-launch prompt + PRD 模板 + checklist 模板 + ACCEPTANCE 骨架
> 第二阶段（Phase B）交付：cowork-prd-ci.yml + check_prd_skeleton.py + 本文件填 ✅

---

## §0 13 硬规则门禁（ga-acceptance.yml）

| # | job | 状态 | 证据 | 命令 | commit |
|---|---|---|---|---|---|
| ga-001 | oasdiff | N/A | doc-only 不触发 oasdiff | — | — |
| ga-002 | requirement IDs | N/A | 不修改 contracts/ | — | — |
| ga-003 | forbid_raw_sql | N/A | 不修改 .py 业务代码 | — | — |
| ga-004 | forbid_bare_httpx | N/A | 不修改 .py 业务代码 | — | — |
| ga-005 | forbid_legacy_fallback | N/A | 不修改 .py 业务代码 | — | — |
| ga-006 | ruff + pyright strict | N/A | 不修改 .py 业务代码 | — | — |
| ga-007 | forbid_skip_tests | N/A | 不修改 tests/ | — | — |
| ga-008 | helm lint + kubeconform | N/A | 不修改 infra/helm/ | — | — |
| ga-009 | OTel smoke | N/A | 不修改 OTel config | — | — |
| ga-010 | require_evidence | ✅ | 本文件存在 + 13 行齐全 | `python scripts/ci/require_evidence.py` | (待 Phase B 填) |
| ga-011 | helm-docs | N/A | 不修改 helm | — | — |
| ga-012 | gitleaks | ⬜ | 待 Phase B push 后填 | `gitleaks detect` | — |
| ga-013 | NetworkPolicy | N/A | 不修改 helm | — | — |

> 本 BATCH 为 doc-only + CI 工具自身交付，绝大部分 ga-* 标 N/A；ga-010 由 require_evidence 自动校验，ga-012 在 push 后必跑。

## §1 cowork-prd-ci.yml 自有门禁（双轨轻量 CI）

| job | 状态 | 证据 | 命令 | commit |
|---|---|---|---|---|
| md-lint (pymarkdownlnt) | ⬜ | 待 PR 第一次跑通后填 | `pymarkdownlnt scan --disable-rules md013,md041 docs/active/specs docs/active/delivery/evidence` | — |
| prd-skeleton (check_prd_skeleton.py) | ⬜ | 待脚本验证后填 | `python scripts/ci/check_prd_skeleton.py --prd-dir docs/active/specs --evidence-dir docs/active/delivery/evidence --strict` | — |

## §2 交付物清单

- [x] 3 份 ai-launch prompt 模板（cowork-prd / code-batch / cowork-acceptance）
- [x] ADR-0044（双轨分支 + 三阶段 Loop 决策）
- [ ] `cowork-prd-ci.yml`（Phase B 落地）
- [ ] `scripts/ci/check_prd_skeleton.py`（Phase B 落地）
- [ ] 本文件 13 门禁全 ✅（Phase B 完成后填）

## §3 关联文档

- PRD：`docs/active/specs/2026-08-20-loop-rollout-prd.md`
- integration-checklist：`docs/active/specs/2026-08-20-loop-rollout-integration-checklist.md`
- ADR：`docs/active/decisions/ADR-0044-cowork-code-loop-rollout.md`
- ai-launch prompt：
  - `docs/active/specs/2026-08-20-ai-launch-prompt-cowork-prd.md`
  - `docs/active/specs/2026-08-20-ai-launch-prompt-code-batch.md`
  - `docs/active/specs/2026-08-20-ai-launch-prompt-cowork-acceptance.md`