# MP-ONT-V1-SUNSET-NOTICE

> 编制：2026-08-07 · 维护：MatePlatform Architecture Council
> 关联：GOVERN-03 / ADR-0021 / `evidence/MP-ONT-KERNEL-01-ACCEPTANCE.md`
> 状态：**Active**（v1 → v2 过渡期） · 退役日期：**2026-12-31**

## 1. 范围

`mate-tech-ont`（port 8007）8 个 v1 router 全部进入 Sunset 流程；其覆盖的 endpoint 全部由 KERNEL-01 v2_kernel router（`/api/v1/ont/v2/*`）替代。

| v1 prefix | v1 router 模块 | v2 替代 prefix | v2 主要 operationId |
|---|---|---|---|
| `/api/v1/ont`（classes/relations） | `api/ontology.py` | `/api/v1/ont/v2/object-types` `/api/v1/ont/v2/link-types` | `ontCreateV2ObjectType` / `ontGetV2ObjectType` / `ontListV2ObjectTypes` |
| `/api/v1/ont/instances` | `instances/api.py` | `/api/v1/ont/v2/individuals` | `ontCreateV2Individual` / `ontGetV2Individual` |
| `/api/v1/ont/sparql` | `sparql/api.py` | `/api/v1/ont/v2/object-sets:evaluate` | `ontPostV2ObjectSetEvaluate` |
| `/api/v1/ont/explain` | `sparql/explain.py` | `/api/v1/ont/v2/object-sets:evaluate`（explain 字段） | 同上 |
| `/api/v1/ont/versions` | `versioning/api.py` | `/api/v1/ont/v2/versions/{class_rid:path}` | `ontPostV2Version` / `ontGetV2Version` |
| `/api/v1/ont/inference` | `inference/api.py` | `/api/v1/ont/v2/object-sets:evaluate` + `/axioms` | `ontPostV2ObjectSetEvaluate` / `ontCreateV2Axiom` |
| `/api/v1/ont/shacl` | `inference/shacl_api.py` | `/api/v1/ont/v2/axioms` | `ontCreateV2Axiom`（SHACL 子集） |
| `/api/v1/ont/federation` | `federation.py` | `/api/v1/ont/v2/object-sets:evaluate`（跨 rid 命名空间合并） | `ontPostV2ObjectSetEvaluate`（`across_tenants=false` 默认拒绝） |

## 2. 已落地的 Sunset 标记（GOVERN-03 第 1 步）

`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/main.py:44-58`：

```python
_DEPRECATION_HEADERS = {
    "Deprecation": "true",
    "Sunset": "Wed, 31 Dec 2026 23:59:59 GMT",
    "Link": '</api/v1/ont/v2/>; rel="successor-version"',
}
```

`_deprecation_headers` 中间件对 v1 prefix 自动注入；`_enforce_tenant_per_request` 白名单扩到 `/openapi.json` `/docs` `/redoc`，过渡期运维可读 OpenAPI。

## 3. 客户端迁移指引

```bash
# 灰度 30 天（2026-08-07 ~ 2026-09-07）
# 1. 检查 v1 调用方：grep -RE '/api/v1/ont/(instances|sparql|versions|inference|shacl|federation|classes|relations)' metaplatform-frontend/apps/web/src
# 2. 替换 v2 path；DTO 字段差异见下表
# 3. 灰度结束：把客户端全部切换到 v2
```

## 4. DTO 字段差异（高层）

- `InstanceCreate.payload` → `IndividualCreate.props`
- `Instance.props` → `Individual.props`（同义）
- `RelationCreate.from_class / to_class` → `LinkInstanceCreate.source_rid / target_rid`
- `Version.version` → `Version.version_number`（KERNEL-01 §2 不可变 Version 改）
- `SPARQLQuery.query` → `ObjectSetQuery.filter_expr`（DSL 替代 SPARQL）

## 5. 退役时间表

| 阶段 | 日期 | 动作 |
|---|---|---|
| T0 | 2026-08-07 | Sunset 头 + 白名单（GOVERN-03 第 1 步） |
| T1 | 2026-09-07 | 灰度结束；前端全面切 v2 |
| T2 | 2026-11-30 | v1 router 代码移 `_legacy/v1/`，加 `DeprecationWarning` 启动日志 |
| T3 | 2026-12-31 | 物理移除 v1 router；compose 端口收回 |

## 6. 验收

```bash
# v1 endpoint 必带 Sunset 头
curl -i http://localhost:8007/api/v1/ont/classes | grep -i 'sunset:'
# → Sunset: Wed, 31 Dec 2026 23:59:59 GMT

# v2 endpoint 不带 Sunset 头
curl -i http://localhost:8007/api/v1/ont/v2/object-types | grep -i 'sunset:' || echo "v2 has no sunset header (expected)"
```

## 7. 关联

- ADR-0021（Kernel 12 primitives 冻结）
- MP-ONT-KERNEL-01-ACCEPTANCE（已 Accepted）
- GOVERN-04（KERNEL-01 12 基元 PG 全量落地，T2/T3 阶段并发）
- GOVERN-05（Function 调度实接，T2 阶段并发）
