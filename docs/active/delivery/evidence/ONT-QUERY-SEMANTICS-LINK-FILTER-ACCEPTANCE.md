# ONT-QUERY-SEMANTICS §3 验收证据（关系实例服务端过滤 / 分页 / 聚合计数）

> **批次**：ONT-QUERY-SEMANTICS §3（link-instances 服务端过滤与分页）
> **日期**：2026-09-23
> **分支**：`feat/ont-link-instance-filtering`（基于 `origin/main@9b6e06b1`）
> **决策**：ADR-0078（`docs/active/decisions/ADR-0078-link-instance-server-side-filtering.md`）
> **operationIds**：`ontListV2LinkInstances`（补 5 参数）、`ontGetV2LinkInstanceStats`（新增）
> **Requirement ID**：`FR-ONT-KERNEL01-LISTLINKINSTANCES`（沿用同能力族）+ `FR-ONT-QUERY-SEMANTICS`

## 1. 问题与根因（实测）

`GET /api/v1/ont/v2/link-instances` **无任何查询参数** → 只能返回租户全量关系。
前端关系类型页因此**下载全量再本地筛选**：

- `apps/web/src/api/ont/kernel.ts` 注释自陈"全租户列表，按 link_type_rid **客户端过滤**"；
- `LinkTypesPage.tsx`：`setInstances(await listLinkInstances())`（全量）+ `countFor`（本地计数）
  + 抽屉里 `instances.filter(...)`（本地筛选）。

关系实例随业务线性增长 → 网关/浏览器承压，且只为看一个类型也要拉全量。

## 2. 改动摘要与文件清单

**新增**：

| 文件 | 职责 |
| --- | --- |
| `mate-tech-ont/tests/integration/test_ont_link_instance_server_side_filter.py` | 6 项：过滤/分页/校验/**单条 GROUP BY** 计数 |
| `docs/active/decisions/ADR-0078-link-instance-server-side-filtering.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-QUERY-SEMANTICS-LINK-FILTER-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `v2_kernel/pg_repo.py` | `list_link_instances` 增 `link_type_rid/src/dst/limit/offset`（SQL 下推 + 稳定 `ORDER BY rid`）；新增 `count_link_instances_by_type`（GROUP BY） |
| `v2_kernel/api.py` | `GET /link-instances` 补 5 参数 + 跨租户 403 + limit/offset 422；新增 `GET /link-instances/stats` |
| `contracts/openapi/services/ont.yaml` | GET 补参数；新增 stats path |
| `contracts/openapi/platform.yaml` | 生成物重建（`build_platform.py`）—— `generated/bundled.yaml` 是**构建产物**（`contracts/openapi/generated/` 已被 gitignore），不入库 |
| 前端 `api/ont/kernel.ts` | `listLinkInstances(params)` / `LinkInstanceStats` / `getLinkInstanceStats()` |
| 前端 `pages/ontology/model/link-types/LinkTypesPage.tsx` | 实例数改服务端聚合；抽屉改**服务端过滤 + 分页**（不再全量下载） |

## 3. 实现要点与安全

- **租户**：过滤谓词与租户谓词同在 SQL；HTTP 层过滤 rid 必须属当前租户（否则 403）。
- **稳定分页**：`ORDER BY rid`；`limit ∈ [1,10000]`（HTTP `0` = 全量，兼容旧行为）。
- **计数**：一条 `GROUP BY link_type_rid` —— 用例断言**恰好 1 条语句**。
- **契约同步**：三产物重建 + `compare_runtime` `missingInRuntime: []`。

## 4. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pytest .../integration/test_ont_link_instance_server_side_filter.py -q` | **6 passed**（无过滤全量 / 按类型 / src·dst 可组合 / 分页稳定无重无缺 / limit·offset 校验 / 计数为一条 GROUP BY） |
| `python contracts/scripts/validate_contracts.py` | ✅ exit 0 |
| `python contracts/scripts/build_platform.py` + `redocly bundle` | ✅ 生成物重建 |
| `python contracts/scripts/compare_runtime.py` | ✅ **`missingInRuntime: []`**（重建 runtime 快照后） |
| `pytest packages/mate-tech-ont/tests -q` | **见 §4.1** |
| 前端 `npx tsc -b --noEmit` | ✅ exit 0 |
| `ruff check` + `format`（改动文件） | ✅ 净 |

### 4.1 全量 ont 套件

> **`pytest packages/mate-tech-ont/tests -q` → 545 passed / 0 failed / 0 skipped**（98.10s；
> 基线 539 + 本批新增 6）。

## 5. 已知边界

1. 前端抽屉单页 `limit=200`，触顶标 `N+`（"可能被截断"）；完整翻页 UI 未做。
2. 聚合只按关系类型（按 src/dst 的计数未提供）。
3. stats 端点复用既有 Requirement ID（同能力族），未新增 FR。
4. **回滚**：`git revert` 本批提交即退回（含契约三产物）。

## 6. 结论

**准出达成**：关系实例的过滤、分页、计数全部在**服务端**完成；前端不再下载全量再筛选；
契约三产物同步、runtime parity 无缺口、`tsc` 干净。以 6 项用例（含"计数=一条 GROUP BY"
的语句断言）钉死。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | ✅ `ont.yaml` 补参数 + stats path；`platform.yaml` / `bundled.yaml` 重建；`compare_runtime` `missingInRuntime: []` |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ 沿用 `FR-ONT-KERNEL01-LISTLINKINSTANCES`（同能力族）+ 本档 `FR-ONT-QUERY-SEMANTICS` |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ 过滤谓词与租户谓词同在 SQL；HTTP 层跨租户过滤 rid → 403 |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 无外部调用 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ 非法 `limit`/`offset` 显式 422；无静默全量回落（`limit=0` 是**显式**全量语义） |
| ga-006-static | 6 静态检查失败不合并 | ✅ `ruff` 净；前端 `tsc -b --noEmit` exit 0 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ 6 项全真跑（PG 可达，0 skip） |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 无 K8s 改动；回滚见 §5.4 |
| ga-009-otel | 9 没有审计、指标、trace | N/A 纯读路径；沿用既有 OTel 中间件 |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ 无 secret 入 diff |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
**commit**：`4b074e5b`（实现 + 契约 + 前端）、`5517ed2d`（测试 6 项）、`ea7e5185`（ADR + 本验收证据）——PR #90。
