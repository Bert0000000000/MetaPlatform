# ADR-0071：Scenario 租户归属隔离与实验特性生产禁用边界

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ADR-0044（assisted action）、ACT-08 / G44（Scenario 会话沙盒）、
  13 硬规则 #3（无 tenant 上下文不访问 repository）、#5（production profile 禁止 fallback）

## 1. 背景

G44 把 ACT-08 的 `ScenarioOverlay` HTTP 化，暴露了 6 个端点（建/列/追加编辑/合并
视图/落库合并/丢弃）。其会话态存在**进程内模块级 dict** `_SCENARIOS`（`v2_kernel/api.py`），
条目里虽写了 `tenant_id`，但**没有任何一个操作校验归属**：

1. `list_scenarios` 直接遍历整表 → 返回**全部租户**的 Scenario（泄露 title / 编辑计数）；
2. `view` / `append-edit` / `merge` / `discard` 仅按 `sid` 查找 → 拿到他人 `sid` 即可读、
   改、合并（产生业务写入）、删除他人会话；
3. `merge` 还把他人会话的编辑经审计管道落库 → **跨租户副作用**。

同时，内存态**不支持多副本 / 重启即失**，却被当作可用草稿返回（`status: "active"`）。

## 2. 决策

### 2.1 租户归属一律以创建时落定的 `tenant_id` 为准

- 新增 `_scenario_entry(request, sid)`：取当前认证租户拥有的条目；**缺失或归属不符
  一律 404**（不泄露存在性，也不区分「不存在」与「不是你的」）。
- 六个端点全部改走该 helper；`list_scenarios` 按 `entry["tenant_id"] == ctx.tenant_id`
  过滤；`append/edit` 的 TOCTOU 窗口（归属校验与回放之间被丢弃）翻 404。
- **绝不信任客户端传入的 tenant_id**：租户只来自 `ctx`（AuthMiddleware 注入）。

### 2.2 Scenario 暂定「实验特性」，生产 profile 默认禁用（fail-closed）

- 在真正持久化 + 多副本安全之前，Scenario 是实验能力，**不得冒充正式草稿**：
  创建响应改 `status: "experimental"` 并新增 `persistence: "in_memory"`；列表行同标。
- 生产禁用闸门 `_require_scenarios_enabled()`：`MATE_PROFILE ∈ {production, prod, staging}`
  时默认禁用，六个端点返回 **503 `E503_SCENARIO_DISABLED`**；需要时用
  `ONT_SCENARIOS_ENABLED=1` 显式 opt-in（运维已知情）。

## 3. 不做的

- **不做持久化**：不新增 PG 表 / 迁移，不改 `ScenarioOverlay`（内核引擎不动）——
  持久化 + 多副本是后续独立批次（本 ADR 只关闭隔离与越权，并把边界显式化）。
- 不做 TTL / 自动 rebase（沿用 ACT-08 v1 边界）。
- 不改 12 基元 / Action 执行路径 / 前端（Scenario 无前端消费面）。

## 4. 实施与验证

- **实现**：`mate_tech_ont/v2_kernel/api.py`（Scenario 段 +33 行，0 删除业务逻辑）。
- **测试**：`packages/mate-tech-ont/tests/security/test_scenario_tenant_isolation.py`
  6 项（先红后绿）：list 按租户过滤 / 他人 view·edit·merge·discard 全 404 且 merge
  零业务写入 / 归属者全流程仍绿 / 创建标注实验态 / 生产禁用 503 / opt-in 放行。
- **回归**：`test_ont_g44_scenarios.py`（4）+ `test_ont_act08_scenario.py`（4）保持绿。
- **证据**：`docs/active/delivery/evidence/ONT-SCENARIO-ISOLATION-ACCEPTANCE.md`。

## 5. 已知边界

- 会话仍为**进程内**态：多副本下各副本各持一份，重启即失——这正是生产默认禁用的原因；
  单副本 dev/测试可用。
- 无 TTL / 无容量上限（沿用 ACT-08 v1 边界，登记为后续任务）。
- Scenario 端点**未纳入 OpenAPI 契约**（G44 落地时即如此，既有债务）；本 ADR 不改契约，
  登记为后续「路由入契约」批次的输入。
