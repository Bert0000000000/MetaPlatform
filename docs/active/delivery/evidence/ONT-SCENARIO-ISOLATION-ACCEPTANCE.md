# ONT-SCENARIO-ISOLATION 验收证据（Scenario 租户隔离 + 实验特性生产禁用边界）

> **批次**：ONT-SCENARIO-ISOLATION（本体 Scenario 越权与跨租户副作用收口）
> **日期**：2026-09-23
> **分支**：`fix/ont-scenario-tenant-isolation`（基于 `origin/main@1c012d7b`）
> **决策**：ADR-0071（`docs/active/decisions/ADR-0071-scenario-tenant-isolation-and-experimental-boundary.md`）
> **operationIds**：`ontCreateV2Scenario` / `ontListV2Scenarios` / `ontAppendV2ScenarioEdit` /
> `ontGetV2ScenarioView` / `ontMergeV2Scenario` / `ontDiscardV2Scenario`（**均为既有端点，本轮不改路径**）
> **Requirement ID**：`FR-ONT-SCENARIO-ISOLATION`

## 1. 问题与根因

G44 把 ACT-08 的 `ScenarioOverlay` HTTP 化时，会话态放在**进程内模块级 dict**
`v2_kernel/api.py::_SCENARIOS`，条目里写了 `tenant_id` 却**从不校验归属**：

- **根因 A（跨租户读）**：`list_scenarios` 遍历整表返回，任何租户都能看到全部租户的
  Scenario（`title` / 编辑计数）。
- **根因 B（跨租户写）**：`view` / `append-edit` / `merge` / `discard` 仅按 `sid` 查找；
  拿到他人 `sid` 即可读、改、**合并落库（业务写入）**、删除他人会话。
- **根因 C（状态冒充）**：内存态不支持多副本 / 重启即失，却以 `status: "active"`
  返回，冒充正式草稿。

## 2. 改动摘要与文件清单

**做了什么**：六个 Scenario 端点统一按**创建时落定的 `tenant_id`** 校验归属（缺失或
归属不符一律 404，不泄露存在性）；`list` 按租户过滤；`append-edit` 的 TOCTOU 窗口翻
404；创建/列表响应显式标注实验态；生产 profile 默认禁用（503，可 opt-in）。

**新增**：

| 文件 | 职责 |
| --- | --- |
| `packages/mate-tech-ont/tests/security/test_scenario_tenant_isolation.py` | 6 项（先红后绿）：list 过滤 / 他人四操作 404 且零写入 / 归属者全流程 / 实验态标注 / 生产禁用 503 / opt-in 放行 |
| `docs/active/decisions/ADR-0071-scenario-tenant-isolation-and-experimental-boundary.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-SCENARIO-ISOLATION-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py` | Scenario 段：新增 `_require_scenarios_enabled()`/`_scenario_entry()` + `_scenarios_enabled()`；六端点接入；创建/列表标注实验态（+33 行，0 删除业务逻辑） |

## 3. 实现要点与安全

- **归属判定以服务端落定值为准**：`entry["tenant_id"]` 在创建时由 `ctx.tenant_id` 写入，
  判定只与 `ctx.tenant_id` 比较；**绝不读客户端传入的 tenant_id**（请求体里根本没有该字段）。
- **404 而非 403**：跨租户与不存在返回同一结果，不泄露资源存在性。
- **写路径前置校验**：`merge` 在构建 overlay **之前**完成归属校验，越权者根本不进入
  `apply_edit_set_now`，业务主库零写入（用例显式断言 merge 前后 base 值不变）。
- **生产禁用闸门 fail-closed**：`MATE_PROFILE ∈ {production, prod, staging}` 默认禁用，
  返回 `503 E503_SCENARIO_DISABLED`；`ONT_SCENARIOS_ENABLED=1` 才放行。
- **实验态显式标注**：创建响应 `status: "experimental"` + `persistence: "in_memory"`，
  列表行带 `persistence`——不把内存状态冒充正式草稿。
- **不做的**（ADR-0071 §3）：不做持久化 / 多副本（登记为后续批次）、不做 TTL、
  不动内核 `ScenarioOverlay`、不动前端（无消费面）。

## 4. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pytest packages/mate-tech-ont/tests/security/test_scenario_tenant_isolation.py -q`（**修复前**） | **4 failed / 2 passed** —— list 跨租户可见、他人四操作可用、未标实验态、生产未禁用，四类问题全部复现 |
| `pytest packages/mate-tech-ont/tests/security/test_scenario_tenant_isolation.py -q`（**修复后**） | **6 passed** |
| `pytest .../test_ont_g44_scenarios.py .../test_ont_act08_scenario.py -q` | **8 passed**（既有 Scenario 行为无回归） |
| `pytest packages/mate-tech-ont/tests -q` | **见 §4.1（全量结果）** |
| `ruff check` + `ruff format --check`（改动 2 文件） | ✅ All checks passed / 2 files already formatted |

### 4.1 全量 ont 套件

> **`pytest packages/mate-tech-ont/tests -q` → 516 passed / 0 failed / 0 skipped**（59.48s；
> 基线 510 + 本批新增 6；含 PG 门控集成用例——本机 PG 可达故无 skip）。

## 5. 已知边界

1. **会话仍为进程内态**：多副本各持一份、重启即失——这正是生产默认禁用的依据；
   单副本 dev/测试可用。持久化 + 多副本是后续独立批次。
2. **无 TTL / 无容量上限**（沿用 ACT-08 v1 边界）。
3. **Scenario 端点未纳入 OpenAPI 契约**：G44 落地时即未登记（既有债务），本批不改契约；
   作为后续「本体路由入契约」批次的输入（硬规则 #1 的既有偏差，非本批引入）。
4. **未做浏览器实证**：Scenario 无前端消费面（前端零引用），无法也无需 UI 证据；
   端点级由 6 项 HTTP 用例覆盖。
5. **回滚**：纯增量，`git revert` 本批提交组即退回；`ONT_SCENARIOS_ENABLED` 未设置时行为
   与「生产禁用」一致。

## 6. 结论

**准出达成**：跨租户读/写/副作用与状态冒充四类风险全部关闭，且由**先红后绿**的 6 项用例
钉死；既有 Scenario 行为零回归。生产禁用边界显式化并可 opt-in。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

**13 硬规则 job 对位**（逐条给本批落点或说明为何不适用）：

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | ⚠️ 6 个 Scenario 端点**本就未入契约**（G44 既有债务）；本批**不改路径、不改契约**，登记为后续批次（见 §5.3） |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ `FR-ONT-SCENARIO-ISOLATION`（本文件 §头部）；因端点未入契约，暂不写入 REQUIREMENT-MATRIX（避免 operationId 不在契约中导致 traceability 失配） |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ **本批核心**：六端点归属校验（缺失/不符 404）+ list 租户过滤；负例 1 项（他人四操作全 404 + merge 零写入） |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 本批不新增外部调用 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ 内存态**不**降级冒充草稿：生产默认 503 禁用，`ONT_SCENARIOS_ENABLED=1` 才放行 |
| ga-006-static | 6 静态检查失败不合并 | ✅ `ruff check` + `ruff format --check` 净 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ 本批 6 项全真跑，**0 skip** |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 本批无 K8s 改动；回滚见 §5.5 |
| ga-009-otel | 9 没有审计、指标、trace | ✅ 越权命中写 `ont.scenario.access_denied` 结构化告警日志（含 scenario_id/tenant/reason） |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 本批无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ 无 secret 入 diff |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 本批无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
**commit**：`f9b21c08`（ADR-0071 + 失败测试）、`8a221f43`（实现）、`d059db3f`（本验收证据）——PR #82。
