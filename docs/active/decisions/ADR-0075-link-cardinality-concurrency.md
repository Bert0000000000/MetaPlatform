# ADR-0075：关系基数校验与写入的跨进程并发保护

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：EXP-03（基数约束）、ADR-0021（Kernel 12 基元 · LinkInstance）、
  ADR-0064（统一 edit-set 执行器）、13 硬规则 #3（tenant 上下文）

## 1. 背景

`ont_link_instance` 的写入有两条可达路径，**基数约束在并发下都不可靠**：

1. **`pg_repo.create_link_instance`（TOCTOU）**：`_check_link_cardinality` 先**自开一个
   连接**做 `SELECT COUNT(...)` 并关闭，随后 `create_link_instance` 再**开另一个连接**
   做 `INSERT` 并提交。两个独立连接/进程可各自数到 0 条边，然后都写入成功 —— 基数约束
   （1:1 / 1:N / N:1）形同虚设。全流程**没有任何数据库约束或锁**，只依赖"检查时恰好没人写"。
2. **`apply_edit_set_now` 的 `add_link`（绕行）**：Action/edit-set 路径**直接**
   `INSERT INTO ont_link_instance`，**完全不做基数校验** —— 已注册 LinkType 的 1:1 约束
   可被 Action 绕过。

## 2. 决策

### 2.1 校验与写入同一事务 + 数据库级端点锁

`create_link_instance`：单连接单事务内

```
_lock_link_endpoints(cur, link_type, src, dst)   -- pg_advisory_xact_lock（事务级）
_check_link_cardinality(..., cur=cur)            -- 同一 cursor 数边
INSERT / ON CONFLICT DO UPDATE
COMMIT
```

`_lock_link_endpoints` 对该 LinkType 的**两个端点**各取一把事务级 advisory lock
（key = `<link_type_rid>|<endpoint>`，**按 key 排序**后依次获取以防死锁）。基数只取决于
这两个端点的既有边数，因此锁住两端点即把「数一遍 + 写一条」串行化；锁随事务提交/回滚
自动释放。**这是数据库锁，不是进程内锁** —— 跨进程、跨副本有效。

### 2.2 可达写入口共用同一约束

`apply_edit_set_now` 的 `add_link` 分支在 INSERT 前调用**同一对** helper
（`_lock_link_endpoints` + `_check_link_cardinality(cur=cur)`），使 Action / 导入等
经 edit-set 的写入口与直插路径遵守同一套约束（目标 #4）。

### 2.3 未注册 LinkType 保持宽松（沿用）

`_check_link_cardinality` 在 LinkType 未注册时仍早退（legacy「先声明后注册」语义）；
本批不改该边界。

## 3. 不做的

- **不建 DB 约束**：基数语义由 LinkType 配置决定（且类型可未注册），无法表达为简单
  CHECK/UNIQUE；advisory lock 更贴合。
- **不用 SERIALIZABLE 隔离级别**：会影响该连接上的全部事务，代价远超收益。
- **不用进程内锁**：跨副本无效（本批要解决的正是这一点）。
- 不改 in-memory 路径（单进程测试语义）。

## 4. 实施与验证

- **实现**：`pg_repo.py`（`_lock_link_endpoints`、`_count_endpoint_edges`、
  `_check_link_cardinality(cur=)`、`create_link_instance` 重写、edit-set `add_link` 接线）。
- **测试**：`tests/integration/test_ont_link_cardinality_concurrency.py`（3 项）：
  ① 两个独立连接并发创建 1:1 同 src 冲突关系 → **最多一个成功**（测试用窗口放大器把
  「校验 → 写入」间隔拉长，令 TOCTOU 可确定性复现）；② 串行对照；③ edit-set `add_link`
  必须受同一约束拒绝。
- **先红后绿**：`git stash` 仅回退实现文件后重跑 → **2 failed / 1 passed**；恢复后 3 passed。
- **证据**：`docs/active/delivery/evidence/ONT-LINK-CARDINALITY-CONCURRENCY-ACCEPTANCE.md`。

## 5. 已知边界

- advisory lock 是**同一数据库内**互斥（多副本连同一 PG → 有效；跨库/跨集群不在本批）。
- key 含 `link_type_rid`（含租户）→ 天然按租户隔离，不会跨租户互相阻塞。
- LinkType 定义在锁外读取（`get_link_type`）；定义与写入并发变更时以"写入时读到的定义"为准。
- `remove_link` 未加端点锁（删除只会放松约束，不会制造违规）。
