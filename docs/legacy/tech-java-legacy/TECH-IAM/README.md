# TECH-IAM - 身份认证与权限服务

> Mate Platform IAM 服务（Java 25 + Spring Boot 3.5）。
> v1.3 角色：企业身份、权限、审计；为 Ontology-Native DeerFlow 提供 PermissionSnapshot。

## 关键能力

- 用户 / 角色 / 部门 / 多租户基础管理（V1~V3）
- IAM Outbox 事件（V4）
- **数据权限（行级 + 列级）**（V5，DataPermissionService）
- API Key + 权限范围（V6~V7）
- SSO Provider（V8）
- MFA（V9）
- 审计日志（V10）
- 岗位 / 用户岗位（V12~V13）
- 用户角色 / 用户设置 / 会话（V14~V15）
- ABAC Policy（V16）
- Outbox Topic + Trace（V17）
- **PermissionSnapshot（P0.2.1，新增 V18）**：对象级 / 字段级 / 关系级 / Action 级权限快照，签名 + 5 分钟 TTL，供 Ontology Context Envelope 注入到 DeerFlow / Agent / RAG

## PermissionSnapshot 关键 API

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/v1/iam/permission-snapshots/build` | 构建快照 |
| GET  | `/api/v1/iam/permission-snapshots/{snapshotId}` | 读取并校验快照 |

### 请求体示例

```json
POST /api/v1/iam/permission-snapshots/build
{
  "conceptCode": "Customer",
  "objectId": "CUST-10086",
  "candidates": {
    "actions":    ["ViewCustomer", "EditCustomer", "ChangeDiscount"],
    "relations":  ["HAS_ORDER", "HAS_CONTRACT", "HAS_TICKET"],
    "concepts":   ["Customer", "Order", "Contract"],
    "metrics":    ["customer.revenue_12m", "customer.order_decline_rate"],
    "regions":    ["EAST_CHINA"]
  }
}
```

返回：

```json
{ "code": 0, "data": { "snapshotId": "SNAP-xxxx", "ttlSeconds": "300" } }
```

下游服务（TECH-AGENT / TECH-ONT）把 `snapshotId` 写入 `OntologyContextEnvelope.permissionSnapshotId`，TTL 5 分钟内可信赖使用。

## 权限解析入口

- `PermissionResolverService` 暴露对象级 / 字段级 / 关系级 / Action 级四类权限解析
- `PermissionSnapshotService` 负责签名 + 持久化
- `PermissionAspect` + `@PermissionAnnotation` 提供声明式权限拦截（P0.2.4）

## 配置

- 密钥：`mate.iam.snapshot.secret`（默认 dev，生产必须覆盖）
- TTL：`mate.iam.snapshot.ttl-seconds`（默认 300）
- 启用配置：`--spring.config.import=classpath:application-iam-snapshot.yml`（或挂到 Nacos）
