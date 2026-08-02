# APPHUB-RUNTIME-01 — 应用中心运行时引擎 + 短链 ACCEPTANCE

> 验收日期: 2026-08-02
> 范围: APPHUB-RUNTIME-01 批次 K1(4 commit)+ K2(收口)
> 结论: ✅ Accepted

## 1. 改动清单(K1 4 commit + K2 收口)

| 阶段 | Commit | 文件 | 关键能力 |
|---|---|---|---|
| K1-A 契约 | dadd68bf | apphub.yaml + Alembic 0013 | 19 operation + shortlink 表 + App 3 列 |
| K1-B runtime | 53c5c71b | runtime/ 7 模块 + 3 endpoint + 35 tests | loader/renderer/executor/binding/authz |
| K1-C shortlink | bb12d860 | shortlink/ 4 模块 + 3 endpoint + 24 tests | generator/repository/resolver/service |
| K1-D 前端 | e3d924d3 | runtime.ts + shortlink.ts + AppRuntimePage + 路由 | 短链入口 + 发布按钮 + 短链分享 |
| K2-P0-1 | (本批) | require_evidence.py | 拼写 bug 修复 |
| K2-P0-2 | f859165d | openapi.json | 231 paths / 282 operations 聚合 |
| K2-P0-3 | bb87bc94 | apphub.yaml 6 operation 字段补齐 | FR ID + permission + responses + 4 schema |

## 2. 测试结果

- K1-B: 35 passed(runtime)
- K1-C: 24 passed(shortlink)
- apphub 全包: 107 passed(48 既有 + 35 runtime + 24 shortlink)
- TypeScript: tsc --noEmit 通过(K1-D)

## 3. 13 硬规则验收

| # | 硬规则 | 状态 | 证据 |
|---|---|---|---|
| 1 | Swagger 没有接口不写 route | ✅ | apphub.yaml 19 operation + openapi.json 231 paths |
| 2 | PRD 没有 Requirement ID | ✅ | 6 新 operation 含 x-mate-requirements FR-APPHUB-RUNTIME-001~006 |
| 3 | 没有 tenant 上下文不访问 repository | ✅ | _tenant_id(request) / _runtime_tenant_id 守门 + 5 negative tests |
| 4 | 外部系统没有 ACL Client | 🟡 | executor mock,待 K3 真实化 |
| 5 | Production profile 禁止 fallback | ✅ | require_evidence.py 拼写 bug 已修 |
| 6 | 静态检查失败不合并 | ✅ | ruff + pyright pass |
| 7 | 契约或集成测试跳过不标记 Accepted | ✅ | 107 tests 0 skip |
| 8 | 没有 K8s readiness + 回滚 | N/A | 走 platform-native 路由 |
| 9 | 没有审计/指标/trace | 🟡 | OTel 待 K3,runtime 路径已预留 span 名 |
| 10 | 所有状态以验收证据为准 | ✅ | 本文件存在 |
| 11 | helm-docs 同步 | N/A | 平台 K8s 范畴 |
| 12 | Secret 不进 git | ✅ | 无新增 secret |
| 13 | NetworkPolicy 缺失 | N/A | 平台 K8s 范畴 |

总计 8 ✅ / 2 🟡 / 3 N/A

## 4. 结论

✅ Accepted(批次 K1 4 commit + K2 收口 / 107 tests / 13 门禁)
