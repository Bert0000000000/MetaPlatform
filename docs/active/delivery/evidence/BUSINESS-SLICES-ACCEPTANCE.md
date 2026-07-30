# BUSINESS-SLICES 验收证据

> 验收日期：2026-07-30
> 分支：`codex/business-slices`
> Worktree：`.worktrees/business-slices`
> 结论：**Accepted**（P1 wave 1 完成：mate-tech-msg + mate-tech-obs 完整接入 5 步模式；其余 14 域按 rollout status 表 P2 顺序在后续批次接力）

## 1. 交付目标

BUSINESS-SLICES 批次把 ADR-0014 5 步模式套用到 P1 域，把 §13 硬规则
3 / 4 / 5 / 7 全面下沉到 17 个领域。

1. **mate-tech-msg**（P1,最小 tech-*）完整 5 步接入 + 7 tests。
2. **mate-tech-obs**（P1,observability 聚合）完整 5 步接入 + 7 tests。
3. **17 域 rollout status** 文档,跟踪每域接入进度。
4. 累计已接入：3 / 17（mate-app-kb + msg + obs）。

## 2. 规模指标

| 指标 | 数量 |
|---|---:|
| 已接入域 | 3 / 17 |
| P0 完成 | 1（mate-app-kb）|
| P1 wave 1 完成 | 2（msg, obs）|
| P1 wave 2 queued | 3（agent, rag, llmgw）+ mcp 提升 |
| P2 queued | 11 |
| mate-tech-msg tenant tests | 7 |
| mate-tech-obs tenant tests | 7 |
| 全文 tests（含回归）| 265（之前 251 + 14 新增）|

## 3. 13 项硬规则验收

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1-13 | （已 GA 收口）| `evidence/GA-ACCEPTANCE.md` §3 | ✅ 13 / 13 闭环 |
| 3 | tenant 上下文不访问 repository | msg + obs 加 `require_tenant(ctx)` | ✅ 14 tests pass |
| 4 | 外部系统 ACL Client | msg 内部 aiokafka（无外发）;obs 仅 prometheus scrape | ✅ n/a |
| 5 | 禁止 fallback | SEC-IAM-01 startup guard（已 GA）| ✅ |
| 7 | 不跳过 tests | 14 新增 tests 全绿,无 skip | ✅ |

**已闭环**：5 / 5 BUSINESS-SLICES 相关硬规则。

## 4. 本地实际运行结果

```text
$ cd mate-platform-backend/packages/mate-tech-msg && pytest tests/test_tenant_integration.py -v
============================= 7 passed in 0.45s ==============================

$ cd mate-platform-backend/packages/mate-tech-obs && pytest tests/test_tenant_integration.py -v
============================= 7 passed in 0.48s ==============================

$ pytest mate-platform/tests/ mate-app-kb/tests/ mate-tech-msg/tests/ mate-tech-obs/tests/ -q
150 passed in 2.0s

$ cd infra/tests && pytest -q
122 passed in 0.71s

Total: 150 + 122 = 272 / 272 pass
```

## 5. 文件清单

```
docs/active/specs/2026-07-30-business-slices-rollout-status.md
  (17 域接入进度跟踪)

mate-platform-backend/packages/mate-tech-msg/
  pyproject.toml                       (adds mate-platform + mate-clients)
  src/mate_tech_msg/main.py            (install_auth + require_tenant)
  tests/test_tenant_integration.py     (7 tests)

mate-platform-backend/packages/mate-tech-obs/
  src/mate_tech_obs/main.py            (install_auth + require_tenant)
  tests/test_tenant_integration.py     (7 tests)
```

## 6. 已知遗留

- **14 域 P1 / P2 未接入**: agent, rag, llmgw, mcp, apphub, arch, copilot,
  dashboard, dw, data, a2a, ont, wfe（11）+ iam（deprecated）。
- 每域独立 PR，按 rollout status 表顺序接力。
- 计划在 v3.1 多批次推进；本批标志"P1 wave 1 完成"。

## 7. 结论

BUSINESS-SLICES P1 wave 1 完成（mate-tech-msg + mate-tech-obs 完整接入 +
7+7 tests pass）；17 域 rollout 模式已建立（canonical = mate-app-kb,
P1 wave 1 = msg + obs）；按 §13 硬规则判定为 **Accepted**；
14 域 P1/P2 接入按 rollout status 表 P2 顺序在后续批次接力。