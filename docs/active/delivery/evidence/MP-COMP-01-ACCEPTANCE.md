# MP-COMP-01 ACCEPTANCE — Composition Kernel（cordis 范式自建）+ Orchestrator 能力反应式试点

> 状态：**Accepted** · 收口日期：2026-08-17 · ADR：`docs/active/decisions/ADR-0042-composition-kernel.md`
> 调研依据：`cordiverse/paper` 88 页论文精读 + cordis 源码核验（报告 `.tmp-research/cordis/cordis-analysis.html`）

## 1. 交付物

| 交付 | 位置 | 规模 |
|---|---|---|
| 组合内核 | `mate-platform-backend/packages/mate-platform/src/mate_platform/composition/`（errors / effect / fiber / context / __init__） | 674 行，零 I/O、零新依赖 |
| 内核不变量测试 | `packages/mate-platform/tests/composition/`（6 文件） | 19 tests |
| orchestrator 试点 | `scheduler/capability_runtime.py` + `api/capabilities.py` + `main.py` lifespan + `dispatcher.py` overlay + `api/app.py` attach/detach 钩子 + `role_registry.iter_all()` | ~330 行 |
| 试点测试 | `tests/test_capability_runtime.py` + `tests/test_capability_api.py` | 9 tests |
| OpenAPI 契约 | `contracts/openapi/services/orchestrator.yaml`（capabilities 3 端点 + TrackCapabilityRequest schema） | 硬规则① |

## 2. 四条形式化不变量 → 测试对位（论文定理）

| ID | 不变量 | 论文 | 测试 |
|---|---|---|---|
| I1 | load→unload 后 coeffect store 回到观测等价态 | Thm 7（up to ≃） | `test_invariant_recovery.py`（2） |
| I2 | provider 卸载时依赖者全部先达终态 | Thm 63 / Alg 5 L25 | `test_invariant_ordering.py`（3，含级联孙-子-provider、async 逆） |
| I3 | 依赖环永不 ACTIVE、use() 时报告、无死锁 | Thm 66 / §6.5 | `test_invariant_cycle.py`（2，wait_for 兜底） |
| I4 | 转换中 target 翻转正确链式、无双发 | §4.3.3 | `test_invariant_inertia.py`（4，含 provider 身份变更） |

另：effect scope 4（LIFO / async 逆序 / guard 边界中断 / apply 抛错部分逆）、coeffects 4（set 通知回退 / isolate / 父链穿透 / 身份-值区分）。

## 3. 试点端到端场景

1. **工具注销 → 角色失活**：`DELETE /capabilities/{name}` → role fiber PENDING、激活标记逆回收
2. **工具回归 → 自动复激活**：重新 `POST /capabilities` → role fiber ACTIVE（无需重启）
3. **dispatch 拒绝已失活能力**：overlay 在陈旧 binding 调 MCP 之前拒绝（404 "not available"）
4. **回退硬门槛**：裸 `TestClient`（lifespan 未跑）→ capabilities 端点 503、healthz 200、dispatch/roles/plans 行为与从前一致

## 4. 验证记录（2026-08-17，Windows / mate-platform-backend/.venv）

```
pytest packages/mate-platform/tests/composition           → 19 passed
pytest packages/mate-platform/tests                        → 287 passed（全量回归零影响）
pytest packages/mate-tech-orchestrator/tests               → 44 passed + 3 既有失败
                                                             （test_superai_a2a_* 经基线对比确认为
                                                              pre-existing，与本 Batch 无关）
pyright packages/.../composition + mate-tech-orchestrator/src → 0 errors（strict）
ruff check（两包）                                          → 干净（S105 为既有文件告警）
```

## 5. 提交链

| Commit | 内容 |
|---|---|
| 16cfa90c | docs(adr): ADR-0042 composition kernel |
| 47933149 | test(composition): I1-I4 invariant red tests |
| 6770a174 | test(composition): align guard/cycle/mid-load semantics with paper |
| 2abb491c | feat(composition): effect scopes, coeffects, inertial fibers |
| 7baa6ab1 | feat(orchestrator): reactive capability runtime pilot |

## 6. 后续项（出 Batch 范围，ADR-0042 §6 记账）

- MCP center → orchestrator 能力通知接线（端点已就位）
- intercept/policy（Marketplace 第三方权限模型，论文 §6.3）
- ActionType proposal 状态机用 acquisition/emission 词汇重写
- 开放问题：同 key 多 provider 仲裁、FAILED fiber 重试策略
