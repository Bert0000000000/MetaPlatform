# v1.0.2 数据迁移与向后兼容说明

> **目的**：说明如何从 v1.0.1 平滑升级到 v1.0.2，包含数据库迁移、应用数据迁移、API 兼容性、回滚方案。
>
> **配套**：[`01-user-stories.md`](./01-user-stories.md) · [`02-sprint-plan.md`](./02-sprint-plan.md) · [`05-app-service-architecture.md`](./05-app-service-architecture.md)
> **版本**：v1.0.2 (从 v1.0.1 升级)
> **创建日期**：2026-07-13

---

## 〇、迁移总览

| 维度 | v1.0.1 | v1.0.2 | 迁移复杂度 |
|------|--------|--------|-----------|
| **数据库表** | 50 张 | 53 张 (+3 张) | 低（仅新增） |
| **应用元数据** | 1 张 (app) | 1 张 (无变化) | 无 |
| **对象元数据** | 1 张 (app_object) | 1 张 (无变化) | 无 |
| **字段元数据** | 1 张 (schema_json) | 1 张 (无变化) | 无 |
| **对象实例** | ❌ 不存在 | 1 张 (app_object_instance) | 低（新增表） |
| **行级权限** | ❌ 不存在 | 2 张 (policy + audit) | 低（新增表） |
| **lookup 字段** | ❌ 不支持 | ✅ 字段类型扩展 | 中（DDL ALTER） |
| **审计日志** | 1 张 (audit_log) | 1 张 (无变化) | 无 |

**总体迁移风险：低**。v1.0.2 不修改 v1.0.1 任何已有表的结构，所有变更都是**新增**或**增强**。

---

## 一、数据库迁移（Flyway）

### 1.1 迁移脚本清单

需要在 v1.0.2 启动前自动执行的 SQL：

```
db/migration/
├── V1.0.1__baseline.sql                  (v1.0.1 已存在)
├── V1.0.2__001_add_app_object_instance.sql
├── V1.0.2__002_add_row_level_auth.sql
├── V1.0.2__003_add_auth_audit.sql
└── V1.0.2__004_add_perf_indexes.sql
```

### 1.2 V1.0.2__001_add_app_object_instance.sql

```sql
-- 1. 创建对象实例主表（每个对象对应一张 data_obj_{id}）
CREATE TABLE app_object_instance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    object_id BIGINT NOT NULL,
    values_json JSON NOT NULL,
    owner_id BIGINT,
    dept_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_object (object_id),
    INDEX idx_owner (owner_id),
    INDEX idx_dept (dept_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 为 v1.0.1 已存在的每个对象创建数据表 data_obj_{id}
-- 这一步由应用代码在启动时自动执行（参见 AppObjectInstanceService.bootstrap()）
```

### 1.3 V1.0.2__002_add_row_level_auth.sql

```sql
CREATE TABLE row_level_auth_policy (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    object_id BIGINT NOT NULL,
    role_code VARCHAR(64) NOT NULL,
    strategy VARCHAR(16) NOT NULL,
    custom_expression TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_object_role (object_id, role_code),
    INDEX idx_object (object_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 1.4 V1.0.2__003_add_auth_audit.sql

```sql
CREATE TABLE row_level_auth_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    policy_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    action VARCHAR(16) NOT NULL,
    before_value TEXT,
    after_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_policy (policy_id),
    INDEX idx_actor (actor_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 1.5 V1.0.2__004_add_perf_indexes.sql

```sql
-- 为 v1.0.1 的常用查询加索引
ALTER TABLE app_object
    ADD INDEX idx_app_code (code),
    ADD INDEX idx_app_created (created_at);

ALTER TABLE app_object_field_schema
    ADD INDEX idx_field_object_code (object_id, code);

-- DataCenter 实例查询的常见字段
ALTER TABLE app_object_instance
    ADD INDEX idx_values_owner ((CAST(values_json->>'$.owner_id' AS UNSIGNED))),
    ADD INDEX idx_values_status ((CAST(values_json->>'$.status' AS CHAR(32))));
```

---

## 二、应用数据迁移

### 2.1 v1.0.1 已存在的对象 → 自动初始化数据表

**问题**：v1.0.1 没有对象实例概念，只有对象元数据。v1.0.2 引入对象实例后，每个 v1.0.1 已存在的对象需要：

1. 创建一个 `data_obj_{id}` 数据表
2. 字段类型映射到 DDL 列类型

**实现**：在 `metaplatform-app-service` 启动时调用：

```java
@Component
public class DataTableBootstrapper implements ApplicationRunner {
    
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 1. 列出所有 v1.0.1 已存在的对象
        List<AppObjectEntity> allObjects = appObjectRepository.findAll();
        
        // 2. 对每个对象，检查 data_obj_{id} 是否存在
        for (AppObjectEntity obj : allObjects) {
            if (!tableExists("data_obj_" + obj.getId())) {
                // 3. 解析 schema_json, 生成 DDL
                List<FieldView> fields = parseSchema(obj.getSchemaJson());
                String ddl = generateCreateTableDDL(obj.getId(), fields);
                
                // 4. 执行 DDL
                jdbcTemplate.execute(ddl);
                
                log.info("Bootstrapped data table for object {}: {}", obj.getId(), obj.getCode());
            }
        }
    }
}
```

### 2.2 字段类型 → DDL 列类型映射

| 字段类型 (v1.0.1) | DDL 列类型 (v1.0.2) |
|--------------------|---------------------|
| `string` | `VARCHAR(255)` |
| `text` | `TEXT` |
| `number` | `DECIMAL(18, 4)` |
| `integer` | `BIGINT` |
| `boolean` | `TINYINT(1)` |
| `date` | `DATE` |
| `datetime` | `DATETIME` |
| `select` | `VARCHAR(64)` |
| `lookup` (新增) | `BIGINT` + INDEX |

### 2.3 v1.0.1 schema_json 兼容性

v1.0.2 解析 v1.0.1 的 schema_json 完全兼容，因为：

- v1.0.2 在 `FieldRequest` 中增加了 `lookup` 字段，但 v1.0.1 的 schema_json 没有这个字段（自然兼容）
- v1.0.2 的 `FieldView` 是 v1.0.1 的超集

**示例**：

v1.0.1 schema_json（无 lookup）：
```json
{
  "fields": [
    {"code": "name", "type": "string", "required": true},
    {"code": "amount", "type": "number"}
  ]
}
```

v1.0.2 解析后正常加载，UI 显示 2 个字段。如果用户**新增** lookup 字段，会写回：

```json
{
  "fields": [
    {"code": "name", "type": "string", "required": true},
    {"code": "amount", "type": "number"},
    {"code": "customer_id", "type": "lookup", "lookup": {"objectId": 5, "displayField": "name"}}
  ]
}
```

---

## 三、API 向后兼容

### 3.1 v1.0.1 API 行为不变

| 端点 | v1.0.1 行为 | v1.0.2 行为 | 兼容性 |
|------|-------------|-------------|--------|
| GET /apps/{id}/objects | 返回全部 | 加可选 page/size，无参数时行为不变 | ✅ 完全兼容 |
| POST /apps/{id}/objects | 不允许包含 fields | 不允许包含 fields | ✅ 完全兼容 |
| PUT /apps/{id}/objects/{oid}/fields/{code} | type 字段被忽略 | type 字段被忽略 | ✅ 完全兼容 |
| GET /apps/{id}/objects/{oid}/fields | 返回字段列表 | 返回字段列表（lookup 字段多 `lookup` 子对象） | ✅ 字段扩展 |
| GET /public/forms/{formId} | 200 | 200 + ETag 头（可忽略） | ✅ 完全兼容 |

### 3.2 ETag 协议兼容

v1.0.1 实现的 ETag/If-Match 协议（AC-103.6）完全保留：

```bash
# v1.0.1 客户端不发送 If-Match (向后兼容)
PUT /apps/1/objects/2/fields/name
→ 200 OK  # v1.0.2 也接受

# v1.0.2 客户端发送 If-Match (新增能力)
PUT /apps/1/objects/2/fields/name
If-Match: "5"
→ 200 OK (版本匹配) 或 412 (版本不匹配)
```

### 3.3 客户端无感知升级

v1.0.1 前端部署 v1.0.2 后端：

- ✅ 旧 API 调用全部正常工作
- ⚠️ 新能力（lookup/列表增强/导入导出）需要 v1.0.2 前端才能使用

---

## 四、回滚方案

### 4.1 从 v1.0.2 回滚到 v1.0.1

**步骤**：

```bash
# 1. 关闭 v1.0.2 服务
systemctl stop metaplatform-app-service-v1.0.2

# 2. 启动 v1.0.1 服务
systemctl start metaplatform-app-service-v1.0.1

# 3. 数据库无需回滚（新表不影响 v1.0.1）
```

**数据保留**：

- 新增表（`app_object_instance`, `row_level_auth_*`）保留不动
- 数据表（`data_obj_*`）保留不动
- v1.0.1 启动时**不会**使用这些新表，但也不会删除

### 4.2 完全回滚（包括删除新表）

**仅在 v1.0.2 发布 < 24h 且无用户数据时执行**：

```sql
-- DROP 新表
DROP TABLE IF EXISTS row_level_auth_audit;
DROP TABLE IF EXISTS row_level_auth_policy;
DROP TABLE IF EXISTS app_object_instance;

-- DROP 所有动态生成的数据表
-- ⚠️ 警告：data_obj_* 含用户数据, 删除前确认已备份
SELECT CONCAT('DROP TABLE IF EXISTS ', table_name, ';')
FROM information_schema.tables
WHERE table_schema = 'metaplatform'
  AND table_name LIKE 'data_obj_%';

-- 逐条执行生成的 DROP 语句
```

### 4.3 部分回滚

如果只是某个特性有问题：

| 特性 | 回滚方法 |
|------|---------|
| lookup 字段 | 删除该字段，DDL 不回滚（保留列） |
| 行级权限 | 删除对应 `row_level_auth_policy` 记录 |
| CSV 导入导出 | 仅禁用前端入口，后端可保留代码 |
| 性能优化 (Caffeine) | 通过配置 `cache.enabled=false` 关闭 |

---

## 五、迁移验证

### 5.1 自动化验证脚本

`tools/m3-migrate-v1.0.1-to-v1.0.2.ps1`：

```powershell
$ErrorActionPreference = 'Stop'
$apiBase = 'http://localhost:8092/api'

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> v1.0.1 -> v1.0.2 migration verification" -ForegroundColor Cyan

# 1. 验证 v1.0.1 应用数据完整
$apps = Invoke-RestMethod -Uri "$apiBase/apps" -Headers @{Authorization='Bearer dev'}
$ts = Get-Date -Format 'HHmmss'
$before = $apps.data.Count
Pass "v1.0.1 apps count: $before"

# 2. 创建 v1.0.1 应用（模拟升级前）
$app1 = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers @{Authorization='Bearer dev'} -ContentType 'application/json' -Body (@{
    code = "mig_test_$ts"; name = "迁移测试"; icon = "test"
} | ConvertTo-Json)
Pass "create app id=$($app1.data.id)"

# 3. 创建对象（v1.0.1 模式）
$obj1 = Invoke-RestMethod -Uri "$apiBase/apps/$($app1.data.id)/objects" -Method Post -Headers @{Authorization='Bearer dev'} -ContentType 'application/json' -Body (@{
    code = "order_$ts"; name = "订单"; description = "test"
    fields = @(@{code="name";name="Name";type="string";required=$true})
} | ConvertTo-Json)
Pass "create object id=$($obj1.data.id)"

# 4. 验证数据表已自动生成
$tables = Invoke-RestMethod -Uri "$apiBase/admin/tables" -Headers @{Authorization='Bearer dev'}
$tableName = "data_obj_$($obj1.data.id)"
if ($tables.data | Where-Object { $_.name -eq $tableName }) {
    Pass "data table $tableName auto-created"
} else {
    Fail "data table $tableName NOT created"
}

# 5. v1.0.2 创建实例
$instance = Invoke-RestMethod -Uri "$apiBase/apps/$($app1.data.id)/objects/$($obj1.data.id)/instances" -Method Post -Headers @{Authorization='Bearer dev'} -ContentType 'application/json' -Body (@{
    name = "订单001"
} | ConvertTo-Json)
Pass "v1.0.2 create instance id=$($instance.data.id)"

# 6. 验证 v1.0.1 端点仍可用
$obj2 = Invoke-RestMethod -Uri "$apiBase/apps/$($app1.data.id)/objects/$($obj1.data.id)" -Headers @{Authorization='Bearer dev'} -Method Get
if ($obj2.data.code -eq "order_$ts") {
    Pass "v1.0.1 GET object still works"
} else {
    Fail "v1.0.1 API broken"
}

# 7. 验证 ETag 协议
$etag = $obj2.Headers.ETag  # PowerShell WebRequest
if ($etag) {
    Pass "ETag header present: $etag"
} else {
    Fail "ETag missing - v1.0.1 AC-103.6 broken"
}

# 8. 验证行级权限端点
$authList = Invoke-RestMethod -Uri "$apiBase/apps/$($app1.data.id)/objects/$($obj1.data.id)/auth-policies" -Headers @{Authorization='Bearer dev'}
Pass "row-level auth endpoint accessible (empty list)"

# 9. 清理
Invoke-RestMethod -Uri "$apiBase/apps/$($app1.data.id)" -Method Delete -Headers @{Authorization='Bearer dev'} | Out-Null
Pass "cleanup"

Write-Host ""
Write-Host "==> v1.0.1 -> v1.0.2 migration PASSED" -ForegroundColor Green
```

### 5.2 手动验证清单

```
□ 启动 v1.0.2 服务无错误
□ Flyway 迁移脚本全部执行成功
□ v1.0.1 应用列表可正常显示
□ v1.0.1 对象列表可正常显示
□ v1.0.1 对象详情页字段全部正确
□ v1.0.1 表单可正常打开和提交
□ v1.0.1 流程可正常发起和审批
□ ETag 头正确返回（curl -I 验证）
□ 应用模板可导出
□ 应用模板可导入（v1.0.1 → v1.0.2）
```

---

## 六、已知迁移边界 case

### 6.1 字段名冲突

如果 v1.0.1 已存在名为 `id`、`created_at`、`updated_at` 的字段，会与 v1.0.2 新增的系统字段冲突：

**解决方案**：在 data table bootstrap 时，v1.0.2 的系统字段加前缀：

```sql
-- v1.0.2 系统字段
__id, __created_at, __updated_at, __owner_id, __dept_id
-- 业务字段保持原名
name, amount, customer_id
```

### 6.2 大量数据

如果 v1.0.1 对象 > 1000 个，启动时间可能 > 30 秒（DDL 创建耗时）。

**解决方案**：启动时异步 bootstrap，前端 loading 状态。

### 6.3 大字段

如果 v1.0.1 schema 有 `text` 字段且单行 > 65KB（MySQL TEXT 上限），需要切换到 LONGTEXT。

---

## 七、迁移时间预估

| 数据量 | 迁移耗时 | 备注 |
|--------|---------|------|
| 10 个对象 | < 10s | 无实例数据 |
| 100 个对象 | < 30s | 无实例数据 |
| 1000 个对象 | ~5min | 启动慢 |
| 10000 行实例 | < 1s | INSERT 即可 |
| 100w 行实例 | ~5min | INSERT 优化 |

---

## 八、迁移前后对比表

| 维度 | v1.0.1 | v1.0.2 |
|------|--------|--------|
| 数据库表数 | 50 | 53 |
| Flyway 脚本 | ~50 | ~54 |
| API 端点数 | ~22 | ~40 |
| 文档数 | 6 | 7 |
| 测试用例 | 48 | 56 |
| 部署文件变更 | - | 0（仅 jar 替换） |
| 配置文件变更 | - | 0（向后兼容） |
| 数据迁移 | - | 自动（启动触发） |

---

## 九、迁移联系窗口

- **数据迁移问题**：联系 Tech Lead
- **API 兼容问题**：联系后端架构师
- **UI 兼容问题**：联系前端架构师
- **紧急回滚**：见 §4 流程

---

## 十、相关文档

- [v1.0.1 README](../v1.0.1/README.md) — 前置版本
- [v1.0.2 README](./README.md) — 当前版本
- [架构演进说明](./05-app-service-architecture.md) — 数据库 schema 增量
- [测试报告模板](./04-test-report-template.md) — 迁移验证报告