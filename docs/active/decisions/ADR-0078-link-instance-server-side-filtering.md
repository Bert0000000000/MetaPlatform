# ADR-0078：关系实例的服务端过滤 / 分页与聚合计数

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ONT-QUERY-SEMANTICS（ADR-0077）、EXP-03（LinkInstance）、
  ADR-0021（Kernel 12 基元）

## 1. 背景

`GET /api/v1/ont/v2/link-instances` 此前**没有任何查询参数** —— 只能返回
"当前租户的全部关系实例"。前端关系类型页据此**下载全量再本地筛选**：

```ts
// 改造前（kernel.ts）
/** LinkInstance 浏览：GET /v2/link-instances（全租户列表，按 link_type_rid 客户端过滤）。 */
export async function listLinkInstances(): Promise<KernelLinkInstance[]> { ... }

// 改造前（LinkTypesPage.tsx）
setInstances(await listLinkInstances());              // 全量下载
const countFor = (rid) => instances.filter(...).length; // 本地计数
const filtered = instances.filter(li => li.link_type_rid === linkType.rid); // 本地筛选
```

后果：关系实例随业务增长（N 条边 → N 行 JSON 过网关），页面只为看**一个**关系类型的
实例却要拉全量；"实例数"列也靠全量下载得出。这正是"取消前端下载全量再筛选"要解决的形态。

## 2. 决策

### 2.1 服务端过滤（可组合）

`list_link_instances(tenant_id, *, link_type_rid=None, src=None, dst=None, limit=None, offset=0)`：
过滤全部下推到 SQL（`WHERE` 组合）；**租户谓词恒在**（与 `list_individuals` 同口径）。

### 2.2 服务端分页 + 稳定排序

`limit ∈ [1, 10000]`、`offset ≥ 0`；**恒 `ORDER BY rid`** —— 分页可复现、无重无缺
（沿用 ONT-QUERY-SEMANTICS 的稳定排序原则）。`limit=None` 保留旧的全量语义
（HTTP 层 `limit=0` ⇔ 全量）。

### 2.3 聚合计数（替代"下载全量再计数"）

新增 `GET /api/v1/ont/v2/link-instances/stats`（`ontGetV2LinkInstanceStats`）：
一条 `GROUP BY link_type_rid` 返回 `{by_link_type, total}`。前端"实例数"列改用它。

### 2.4 HTTP 层守门

过滤参数（`link_type_rid`/`src`/`dst`）必须属**当前租户**（否则 403）；
`limit ∉ [0,10000]` 或 `offset < 0` → 422。

### 2.5 契约同步

`ont.yaml` 补 5 个 query 参数 + 新增 stats path → `build_platform.py` 重建
`platform.yaml` → `redocly bundle` 重建 `generated/bundled.yaml`；
`compare_runtime.py` → `missingInRuntime: []`。

## 3. 不做的

- 不做游标分页（`rid` 稳定键 + offset 已可复现；游标属后续优化）。
- 不做按 `marking` 的过滤（沿用既有 RLS/安全策略通道）。
- 不改 LinkInstance 的**写入**路径（基数与并发保护见 ADR-0075）。

## 4. 实施与验证

- **实现**：`pg_repo.list_link_instances`（过滤/分页）、`count_link_instances_by_type`（GROUP BY）、
  `api.py` 两个端点（参数校验 + 跨租户守门）、`ont.yaml`（参数 + stats path）、
  前端 `listLinkInstances(params)` / `getLinkInstanceStats()`、
  `LinkTypesPage` 改为服务端过滤 + 服务端计数（抽屉内按需分页拉取）。
- **测试**：`tests/integration/test_ont_link_instance_server_side_filter.py`（6 项）：
  无过滤全量 / 按类型 / src·dst 可组合 / 分页稳定无重无缺 / limit·offset 校验 /
  计数为**一条 GROUP BY**（语句计数断言）。
- **契约三产物** + `compare_runtime` `missingInRuntime: []`；`tsc -b --noEmit` exit 0。

## 5. 已知边界

1. 前端抽屉单页 `limit=200`（触顶以 `N+` 标注"可能被截断"）；完整翻页 UI 未做。
2. `count_link_instances_by_type` 只按关系类型聚合（按 src/dst 的聚合未提供）。
3. stats 端点复用既有 Requirement ID `FR-ONT-KERNEL01-LISTLINKINSTANCES`（同一能力族）。
