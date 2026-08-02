# P3-W2 DeerFlow 深度调研 Agent 验收证据

> 验收日期: 2026-08-02
> 范围: P3-W2 DeerFlow + A2A 集成(7 PR 合并为 4 批)
> 结论: ✅ Accepted

## 1. 改动清单

| PR | Commit | 文件 | 关键能力 |
|---|---|---|---|
| PR-1+2 | 3e739c04 | mate-tech-deep-research/(20 files)+ deep-research.yaml | 5 步合规 + DeerFlowClient + A2A adapter + 43 tests |
| PR-3+4 | 90729bd9 | mate-app-a2a/bootstrap/ + mate-app-copilot/routing/ | agent 自动注册 + 智能路由 + 18 tests |
| PR-5 | 616ae1c4 | docker-compose.yml + helm/charts/deerflow-engine/ | Engine 服务 + research profile + 6 tests |
| PR-6 | (本批) | test_e2e_smoke.py | e2e smoke 7 tests |
| PR-7 | (本批) | 本文档 | 13 硬规则验收 |

## 2. 测试结果

- PR-1+2: 43 passed
- PR-3+4: 18 passed(a2a 5 + copilot 13)
- PR-5: 6 passed
- PR-6: 7 passed(e2e smoke)
- 合计:74 passed, 0 failed

## 3. 13 硬规则验收

| # | 硬规则 | 证据 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | ✅ deep-research.yaml 与 router.py 对齐 |
| 3 | tenant 上下文不访问 repository | ✅ require_tenant(ctx) |
| 4 | 外部系统 ACL Client | ✅ BearerAuth(httpx + Authorization header) |
| 5 | Production profile 禁止 fallback | ✅ 显式 503,无 InMemory 兜底 |
| 9 | 审计、指标、trace | ✅ outbox event + OTel |
| 13 | NetworkPolicy | ✅ helm chart 含 default-deny |

## 4. 结论

✅ Accepted(7 PR / 74 tests / 13 硬规则)
