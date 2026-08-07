# ADR-0029: DW 数字员工 tenant 命名空间隔离

> 状态：**Accepted v1.0** · 日期：2026-08-07 · 决策人：MatePlatform Architecture Council
>
> 签字：`__/__________`（纸质档填写位）
>
> 上游：ADR-0012（SEC-TENANT-01 5 层隔离）；13 硬规则 #3（"没有 tenant 上下文不访问 repository"）
> 关联：ADR-0028（数字员工 prompt 单一数据源）；MP-AGENT-*-01 / SUPER-COPILOT-01

## 1. 背景

`mate-tech-dw` 的 in-memory seed 硬编码员工 id 为 `dw-emp-1..7`，所有 tenant 共用同一份员工数据。这意味着：

- 不同 tenant 通过 `GET /api/v1/dw/employees` 看到**完全相同的员工 id 集合**（仅 tenant 上下文不同）
- 跨租户数据隔离失效：员工、任务、评估等实体虽然在 `_EMPLOYEES[tenant_id]` dict 里按租户存储，但**员工的 id 命名空间全局共享**，与底层字典 key 隔离的方式不一致
- SEC-TENANT-01 的硬规则 #3 要求"没有 tenant 上下文不访问 repository"——这条规则在 DW 员工层被违反

测试断言也直接暴露：`test_tenant_isolation_ok` 期望"两个 tenant 看到 disjoint 的员工 id"，baseline 永远失败（497 passed / 1 failed）。

## 2. 决策

**DW 数字员工 id 采用 tenant-scoped 命名空间**：

- 格式：`dw-emp-<tenant_alias>-<n>`
- `tenant_alias = tenant_id.split("tenant-", 1)[-1]`（如 `tenant-acme` → `acme`，`tenant-globex` → `globex`）
- acme 看到 `dw-emp-acme-1..7`，globex 看到 `dw-emp-globex-1..7`——互不重叠
- 实现位置：`mate_tech_dw.repositories.in_memory._emp_id(tenant_id, n)` helper

**强约束**：

1. 所有 seed 函数引用员工 id 必须用 `_emp_id(tenant_id, n)`，禁止硬编码 `dw-emp-N`
2. 测试用 `ACME_E1..7` / `GLOBEX_E1..2` 常量引用（conftest 提供），禁止在测试里写 `dw-emp-N` 字面量
3. **PG 持久化时（TD-6）**：employee 表主键必须为 `(tenant_id, id)` 复合键——确保 PG 层也彻底租户隔离
4. **单租户内的 employee id 仍要唯一**（不需要全局唯一）；如后续需要全局唯一，可升级为 uuid

## 3. 实施细节

### 3.1 Repository 改造

`mate_tech_dw/repositories/in_memory.py`：

```python
def _tenant_alias(tenant_id: str) -> str:
    return tenant_id.split("tenant-", 1)[-1]

def _emp_id(tenant_id: str, n: int) -> str:
    return f"dw-emp-{_tenant_alias(tenant_id)}-{n}"
```

11 个 seed 函数（`auth_login` / `collaboration` / `commit` / `document` / `employee` / `employee_task` / `evaluation` / `extract` / `knowledge_base` / `learning_extract` / `learning_feedback` / `trace`）全部用 `_emp_id` 生成员工 id。

### 3.2 测试 conftest 同步

```python
ACME_E1 = "dw-emp-acme-1"   # ...
ACME_E7 = "dw-emp-acme-7"
GLOBEX_E1 = "dw-emp-globex-1"
GLOBEX_E2 = "dw-emp-globex-2"
```

60+ 处 `dw-emp-N` 引用改为常量；后续新增测试引用员工 id 也必须用 `ACME_EN` / `GLOBEX_EN` 而非字面量。

### 3.3 端到端影响

- 详情页 `/agents/EMP-ONT-001` 仍然能正常打开——`EMP-ONT-001` 是 `code` 字段，与 `id`（`dw-emp-acme-1`）独立
- 列表页员工条目显示不变（仅 id 内部结构变化，前端不展示 id）

## 4. 验收

- pytest `test_tenant_isolation_ok` 由 baseline failed → passed
- pytest `test_upload_isolation` 同样 passed（文档也走 tenant-scoped id）
- DW + kernel 全量 498 passed / 0 failed（baseline 1 failed）
- 端到端：同一 seed tenant 看到 `dw-emp-{alias}-1..7`；不同 tenant id 集合 disjoint

## 5. 影响

- **正向**：跨租户员工隔离生效；SEC-TENANT-01 硬规则 #3 在 DW 范围落实；测试可真实断言隔离
- **负面**：每个引用员工 id 的代码点都要用 `_emp_id`/`ACME_EN` 替换字面量；这是单次迁移成本，已完成
- **风险**：DW 未来接 PG 时若用 `id` 作主键会冲突；本 ADR 已明确 `(tenant_id, id)` 复合键约束

## 6. 备选方案

- **A. 全局 uuid 唯一 id**（暂缓：调试可读性差；TD-6 接 PG 时可作为可选升级路径）
- **B. 仅 in-memory 区分（tenant_id 字典 key）**（不足：PG 持久化时仍会冲突；必须 tenant-scoped id）
- **C. 走 BFF 路径单租户 + DW 单租户多实例**（拒绝：架构复杂度上升、无收益）

## 7. 参考

- `docs/active/decisions/ADR-0012-business-slices-slo.md`（SEC-TENANT-01 5 层隔离）
- `mate_tech_dw/repositories/in_memory.py:_tenant_alias / _emp_id`
- `mate_tech_dw/tests/conftest.py:ACME_E*/GLOBEX_E*`
- `docs/active/delivery/V31-ONTOLOGY-BOARD.md`（v3.1 数字员工子计划）