# v1.0.2 增量架构：metaplatform-app-service 演进说明

> **目的**：描述 v1.0.2 在 metaplatform-app-service 上的架构增量：关联对象 + 导入导出 + 行级权限 + 性能优化。
>
> **配套**：[`01-user-stories.md`](./01-user-stories.md) · [`02-sprint-plan.md`](./02-sprint-plan.md) · [`../v1.0.1/05-app-service-architecture.md`](../v1.0.1/05-app-service-architecture.md)
> **前置文档**：v1.0.1 的应用中心微服务基础架构

---

## 〇、v1.0.1 → v1.0.2 架构演进总览

### 0.1 v1.0.1 已落地的能力

- AppObject CRUD（应用 + 对象元数据）
- AppObjectField CRUD（字段元数据）
- FormSchema / PageEditor（表单 schema）
- 简单流程引擎（start → userTask → end）
- 公开表单提交（PublicForm）
- ETag / If-Match 协议（AC-103.6）

### 0.2 v1.0.2 新增能力

| 能力 | 主要改动 | 新增类 | 新增端点数 |
|------|---------|--------|-----------|
| **关联字段** (lookup) | `FieldRequest` 新增 lookup 配置 | `LookupConfig` | 0（增强现有） |
| **实例 CRUD** | 新增 `AppObjectInstance` 数据表 + Service | `AppObjectInstanceService`, `AppObjectInstanceController` | 7 |
| **高级列表 API** | 实例查询支持分页/排序/过滤 | 同上 | 0（增强现有） |
| **CSV 导入导出** | 新增 `CsvImportService` | `CsvImportService`, `CsvExportService` | 3 |
| **应用模板导入导出** | 新增 `AppTemplateService` | `AppTemplateService`, `AppTemplateController` | 2 |
| **行级权限** | 新增 `RowLevelAuthService` + DSL 解析器 | `RowLevelAuthService`, `AuthDslParser`, `RowLevelAuthController` | 4 |
| **批量操作** | 实例批量删除/更新 | `AppObjectInstanceService` 增强 | 2 |
| **缓存层** | Caffeine 缓存 schema | `CaffeineConfig` | 0（基础设施） |
| **ETag 304** | PublicForm GET 缓存 | `PublicFormController` 增强 | 0（增强现有） |

**总计新增 18 个 API 端点 + 3 个新 Service + 1 个 DSL 解析器**

---

## 一、新增模块详解

### 1.1 AppObjectInstance（对象实例）

**目的**：v1.0.1 只管理"对象元数据"，v1.0.2 首次引入"对象实例"（即业务数据行）。

**数据模型**：

```java
@Entity
@Table(name = "app_object_instance")
public class AppObjectInstanceEntity {
    @Id @GeneratedValue(strategy = IDENTITY)
    private Long id;
    
    @Column(name = "object_id", nullable = false, index = true)
    private Long objectId;     // 关联到 app_objects.id
    
    // 业务字段以 JSONB 存储，便于动态 schema
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "values_json", columnDefinition = "JSON")
    private Map<String, Object> valuesJson;
    
    // 行级权限
    @Column(name = "owner_id", index = true)
    private Long ownerId;      // 创建人
    
    @Column(name = "dept_id", index = true)
    private Long deptId;       // 部门
    
    // audit
    @CreationTimestamp
    private Instant createdAt;
    
    @UpdateTimestamp
    private Instant updatedAt;
}
```

**Service 接口**：

```java
public interface AppObjectInstanceService {
    Page<InstanceView> list(String appRef, Long objectId, QueryRequest req);
    InstanceView get(String appRef, Long objectId, Long instanceId);
    InstanceView create(String appRef, Long objectId, Map<String, Object> values);
    InstanceView update(String appRef, Long objectId, Long instanceId, Map<String, Object> values);
    void delete(String appRef, Long objectId, Long instanceId);
    int batchDelete(String appRef, Long objectId, List<Long> ids);
    int batchUpdate(String appRef, Long objectId, List<Long> ids, String fieldCode, Object newValue);
}
```

**Controller**：

```java
@RestController
@RequestMapping("/api/apps/{appId}/objects/{oid}/instances")
public class AppObjectInstanceController {
    @GetMapping       // 列表（分页+排序+过滤+行级权限）
    @GetMapping("/{id}")   // 详情
    @PostMapping      // 新建
    @PutMapping("/{id}")   // 更新
    @DeleteMapping("/{id}") // 删除
    @PostMapping("/batch-delete")  // 批量删除
    @PostMapping("/batch-update")  // 批量更新
}
```

### 1.2 Lookup（关联字段）

**配置数据结构**：

```java
public record LookupConfig(
    @NotNull Long objectId,          // 目标对象 ID
    @NotBlank String displayField    // 显示字段 code
) {}
```

**FieldRequest 扩展**：

```java
public record FieldRequest(
    // ... 原有字段 ...
    String type,                     // 新增 "lookup"
    LookupConfig lookup              // type=lookup 时必填
) {}
```

**DDL 生成**：

```sql
ALTER TABLE data_obj_2 ADD COLUMN customer_id BIGINT NOT NULL DEFAULT 0;
CREATE INDEX idx_data_obj_2_customer_id ON data_obj_2(customer_id);
```

### 1.3 CsvImportService

**接口**：

```java
public interface CsvImportService {
    byte[] generateTemplate(Long objectId);              // 下载模板
    ImportPreview dryRun(MultipartFile file, Long objectId);  // 校验
    ImportResult execute(MultipartFile file, Long objectId, ImportOptions opts);  // 执行
}
```

**导入策略**：

- **strict 模式**：任一行失败则整个事务回滚
- **skip-error 模式**：失败行记录到错误报告，成功行提交事务

### 1.4 AppTemplateService

**模板 JSON 结构**：

```json
{
  "version": "v1.0.2",
  "app": {
    "code": "crm",
    "name": "客户关系管理",
    "icon": "users",
    "description": "..."
  },
  "objects": [
    {
      "code": "customer",
      "name": "客户",
      "fields": [...]
    }
  ],
  "pages": [
    {
      "code": "new_customer",
      "type": "form",
      "schema": {...}
    }
  ],
  "workflows": [
    {
      "code": "customer_approval",
      "bpmn_xml": "..."
    }
  ],
  "includeData": false,
  "exportedAt": "2026-07-13T14:30:22Z"
}
```

**冲突策略**：

| 策略 | 行为 |
|------|------|
| REJECT | 拒绝导入（默认） |
| RENAME | 自动追加 `_v2` 后缀 |
| OVERWRITE | 覆盖现有（删除后重建） |
| MERGE | 保留现有，仅补缺失 |

### 1.5 RowLevelAuthService + DSL

**4 种内置策略**：

```java
public enum AuthStrategy {
    OWN,              // owner_id = ${currentUser.id}
    DEPT,             // dept_id = ${currentUser.deptId}
    ALL,              // 无过滤
    CUSTOM            // 用户自定义表达式
}
```

**DSL 语法**：

```
expr := term ( (AND | OR) term )*
term := column op value
op := = | != | > | < | >= | <= | contains | in
value := number | string | ${currentUser.field}
```

**示例**：

```
owner_id = ${currentUser.id} OR dept_id = ${currentUser.deptId}
status = "approved" AND amount > ${currentUser.maxApprovalAmount}
```

**安全白名单**：

- ✅ 允许：`${currentUser.id}`, `${currentUser.deptId}`, `${currentUser.role}`, `${currentUser.tenantId}` 等
- ❌ 禁止：`${java.*}`, `${System.*}`, 函数调用, 分号, 注释符

**应用方式**：

```java
// 在 AppObjectInstanceService.list() 中
String sql = buildBaseQuery(objectId);
String filter = rowLevelAuthService.apply(currentUser, objectId);
sql += " AND " + filter;  // 行级权限强制 AND
sql += addUserFilter(queryRequest);
```

---

## 二、缓存层

### 2.1 CaffeineConfig

```java
@Configuration
public class CaffeineConfig {
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
            "schema",       // AppObject schema
            "fields",       // AppObjectField list
            "authPolicy"    // RowLevelAuth policy
        );
        manager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(10_000)
            .recordStats());
        return manager;
    }
}
```

### 2.2 缓存使用点

| Service | 缓存 key | TTL | 失效时机 |
|---------|---------|-----|---------|
| AppObjectFieldService.list | `fields:{objectId}` | 5 min | 字段 add/update/delete 时 `cacheManager.getCache("fields").evict(key)` |
| AppObjectService.get | `schema:{objectId}` | 5 min | 对象 update/delete 时失效 |
| RowLevelAuthService.getPolicy | `authPolicy:{objectId}:{role}` | 5 min | 权限更新时失效 |

### 2.3 监控

启用 actuator：

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, metrics, prometheus
  metrics:
    enable.cache: true
```

Grafana 查询：`cache_gets_total{result="hit"}` / `cache_gets_total{result="miss"}`

---

## 三、ETag 304 协议

### 3.1 PublicFormController 增强

```java
@GetMapping("/public/forms/{formId}")
public ResponseEntity<ApiResponse<FormSchema>> getSchema(
        @PathVariable String formId,
        @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
    FormSchema schema = service.getSchema(formId);
    String etag = "\"" + schema.getVersion() + "\"";
    
    if (etag.equals(ifNoneMatch)) {
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                .header(HttpHeaders.ETAG, etag)
                .build();
    }
    
    return ResponseEntity.ok()
            .header(HttpHeaders.ETAG, etag)
            .body(ApiResponse.ok(schema, traceId));
}
```

### 3.2 客户端配合

```typescript
// PublicForm.tsx fetch with ETag
const cachedEtag = localStorage.getItem(`form-etag:${formId}`);
const resp = await fetch(`/api/public/forms/${formId}`, {
    headers: cachedEtag ? { 'If-None-Match': cachedEtag } : {}
});
if (resp.status === 304) {
    // 使用缓存的 schema
    schema = JSON.parse(localStorage.getItem(`form-schema:${formId}`));
} else {
    const newEtag = resp.headers.get('ETag');
    localStorage.setItem(`form-etag:${formId}`, newEtag);
    schema = await resp.json();
    localStorage.setItem(`form-schema:${formId}`, JSON.stringify(schema));
}
```

---

## 四、数据库 Schema 增量

### 4.1 新增表

```sql
-- 对象实例表（每个对象对应一张 data_obj_{id}）
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
);

-- 行级权限策略表
CREATE TABLE row_level_auth_policy (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    object_id BIGINT NOT NULL,
    role_code VARCHAR(64) NOT NULL,
    strategy VARCHAR(16) NOT NULL,        -- OWN/DEPT/ALL/CUSTOM
    custom_expression TEXT,               -- CUSTOM 策略时使用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_object_role (object_id, role_code)
);

-- 行级权限审计日志
CREATE TABLE row_level_auth_audit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    policy_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    action VARCHAR(16) NOT NULL,         -- CREATE/UPDATE/DELETE
    before_value TEXT,
    after_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_policy (policy_id),
    INDEX idx_actor (actor_id),
    INDEX idx_created (created_at)
);
```

### 4.2 lookup 字段 DDL 增量

```sql
-- 添加 lookup 字段时
ALTER TABLE data_obj_{oid} ADD COLUMN {field_code}_id BIGINT NOT NULL DEFAULT 0;
CREATE INDEX idx_data_obj_{oid}_{field_code}_id ON data_obj_{oid}({field_code}_id);

-- 删除 lookup 字段时（保留列做软删除，避免破坏历史数据）
-- v1.0.2 不真删列，仅在 schema 中标记为 deleted
```

### 4.3 Flyway 迁移脚本

- `V1.0.2__add_app_object_instance.sql`
- `V1.0.2__add_row_level_auth.sql`
- `V1.0.2__add_auth_audit.sql`

---

## 五、API 端点总览（v1.0.2 新增/修改）

### 5.1 新增端点（18 个）

| # | Method | Path | 说明 |
|---|--------|------|------|
| 1 | GET | /apps/{appId}/objects/{oid}/instances | 实例列表（分页+排序+过滤） |
| 2 | GET | /apps/{appId}/objects/{oid}/instances/{id} | 实例详情 |
| 3 | POST | /apps/{appId}/objects/{oid}/instances | 创建实例 |
| 4 | PUT | /apps/{appId}/objects/{oid}/instances/{id} | 更新实例 |
| 5 | DELETE | /apps/{appId}/objects/{oid}/instances/{id} | 删除实例 |
| 6 | POST | /apps/{appId}/objects/{oid}/instances/batch-delete | 批量删除 |
| 7 | POST | /apps/{appId}/objects/{oid}/instances/batch-update | 批量更新 |
| 8 | GET | /apps/{appId}/objects/{oid}/csv-template | 下载 CSV 模板 |
| 9 | POST | /apps/{appId}/objects/{oid}/csv-import | CSV 导入（dry-run + execute） |
| 10 | GET | /apps/{appId}/csv-export | CSV 导出 |
| 11 | GET | /apps/{appId}/template | 应用模板导出 |
| 12 | POST | /apps/import | 应用模板导入 |
| 13 | GET | /apps/{appId}/objects/{oid}/auth-policies | 行级权限列表 |
| 14 | PUT | /apps/{appId}/objects/{oid}/auth-policies/{role} | 更新某角色权限 |
| 15 | DELETE | /apps/{appId}/objects/{oid}/auth-policies/{role} | 删除权限 |
| 16 | GET | /apps/{appId}/objects/{oid}/auth-policies/audit | 权限审计日志 |
| 17 | GET | /public/forms/{formId} | PublicForm ETag 304 支持 |
| 18 | GET | /actuator/metrics/cache.gets | 缓存命中率监控 |

### 5.2 修改端点（向后兼容）

| Method | Path | 改动 |
|--------|------|------|
| GET | /apps/{appId}/objects | 加分页参数 (page, size)，默认 size=50 |
| POST/PUT/DELETE | /apps/{appId}/objects/{oid}/fields | lookup 字段支持 |

---

## 六、性能基准（目标值）

| 操作 | v1.0.1 实测 | v1.0.2 目标 |
|------|-------------|-------------|
| listObjects 第 1 页 (10000 对象) | ~300ms | < 200ms |
| listObjects 第 100 页 | ~5000ms | < 250ms |
| listFields (100 字段) | ~150ms | ~5ms (cache) |
| PublicForm GET (冷启动) | ~200ms | ~200ms |
| PublicForm GET (热缓存) | ~200ms | < 50ms (304) |
| 列表页 1000 行首屏 | ~3s | < 1.5s |

---

## 七、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| lookup 字段 DDL ALTER 锁表 | 高 | 用 `pt-online-schema-change` 或仅在空闲时段执行 |
| 行级权限 DSL 误用 | 高 | 严格白名单 + 只读沙箱 + 单元测试覆盖 |
| Caffeine 缓存与 schema 漂移 | 中 | 写操作显式 `cache.evict()` |
| CSV 导入 SQL 注入 | 高 | 用 `PreparedStatement` + 字段白名单 |
| 应用模板导入损坏数据 | 中 | 导入前 dry-run 显示差异 |

---

## 八、迁移与回滚

### 8.1 数据迁移

详见 [`07-migration-from-v1.0.1.md`](./07-migration-from-v1.0.1.md)

### 8.2 代码回滚

v1.0.2 不修改 v1.0.1 已有 API 的语义，回滚 v1.0.2 等于：
1. 关闭新端点（路由层屏蔽）
2. 保留数据表（前向兼容）
3. 缓存层可选启用/关闭

---

## 九、后续版本展望（不在 v1.0.2）

| 功能 | 留到版本 |
|------|---------|
| 公式字段 | v1.0.3 |
| 字段权限继承 + 覆盖 | v1.0.3 |
| 多字段条件批量更新 | v1.0.3 |
| Excel 导入导出 | v1.0.5 |
| 附件字段 | v1.0.5 |

---

## 十、文档链接

- 用户故事：[`01-user-stories.md`](./01-user-stories.md)
- Sprint 计划：[`02-sprint-plan.md`](./02-sprint-plan.md)
- 测试用例：[`03-test-cases.md`](./03-test-cases.md)
- 测试报告：[`04-test-report-template.md`](./04-test-report-template.md)
- Git 流程：[`06-git-branching-and-release.md`](./06-git-branching-and-release.md)
- 数据迁移：[`07-migration-from-v1.0.1.md`](./07-migration-from-v1.0.1.md)
- 前置版本架构：[`../v1.0.1/05-app-service-architecture.md`](../v1.0.1/05-app-service-architecture.md)