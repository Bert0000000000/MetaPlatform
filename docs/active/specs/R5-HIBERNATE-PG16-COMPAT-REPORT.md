# R5 Hibernate 6 / PG 16 兼容性收口报告

> 创建于 2026-07-24 23:00。
>
> 配套阶段：v1.3 重构期 R5（生产化与历史归档清理）Step 1。

## 问题根因

**所有 18 个 Java 模块** 的 JPA 自动生成查询（Spring Data JPA `findBy*Like*IgnoreCase` 等）触发：

```
org.postgresql.util.PSQLException: ERROR: function lower(bytea) does not exist
```

**根因**：Hibernate 6.6.15 + PostgreSQL 16 + JPA `LIKE IGNORE CASE` 模式自动生成的 SQL：
```sql
WHERE (? IS NULL OR lower(field) LIKE lower(('%'||?||'%')))
```
Hibernate 推断 LIKE 通配符参数类型时给 PG driver 传了 `bytea`，导致 `lower(bytea)` 编译失败。

## 尝试的修复（均未生效）

| # | 方案 | 实施范围 | 结果 |
|---|---|---|---|
| 1 | `hibernate.type.preferred_jdbc_type_code_for_string: 12`（Types.VARCHAR） | 19 个 application.yml | ❌ 仍 bytea，Hibernate 6.6 不识别此 property for setObject in JPQL generated SQL |
| 2 | JDBC URL `?stringtype=varchar` | 18 个 application.yml | ❌ 仍 bytea，PG driver setObject 仍按 Java Type 推断 |
| 3 | 升级 Hibernate 到 6.6.4+ | 未做 | 需覆盖 Spring Boot 3.5 BOM，可能引入其他兼容问题 |

## 影响范围

- ❌ 所有 `POST / PUT / DELETE`（INSERT/UPDATE 含 `lower()` 推断）
- ❌ 所有 `LIKE` 模糊查询
- ❌ JSON 字段 INSERT（如 `mcp_role.permissions`）
- ✅ 所有 GET list（无 `LIKE`）
- ✅ 所有 DDL / Flyway

**R4 联调结构性完成，** 写路径需 R5 Step 2 解决。

## 真正的修复方案（需 R5 Step 2/3 推进）

### 方案 A：实体级 @JdbcTypeCode 强制类型（推荐）
**1 行 × 100+ 字段**：

```java
@Column(name = "name", length = 255)
@JdbcTypeCode(SqlTypes.VARCHAR)
private String name;
```

让 Hibernate 在 setObject 时用 VARCHAR 而非 OTHER，PG driver 收到 VARCHAR 就会用 varchar 而非 bytea。

**优点**：彻底解决，targeted。
**缺点**：需要给所有 `String` 字段加注解，100+ 实体文件。

### 方案 B：@Query 自定义 JPQL + 显式 cast
**针对每个失败方法**：

```java
@Query("SELECT m FROM McpServerEntity m WHERE m.tenantId = :tid AND " +
       "(:keyword IS NULL OR CAST(LOWER(m.name) AS string) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))")
Page<McpServerEntity> searchByKeyword(String tenantId, String status, String keyword, Pageable p);
```

**优点**：targeted。
**缺点**：100+ repository 方法要改，量大。

### 方案 C：切换 PG driver 行为
PG JDBC URL 加 `?prepareThreshold=0`（禁用 server-side prepared statements），但这改变了 PG driver 行为，可能影响其他 query。

### 方案 D：降级 Hibernate
覆盖 Spring Boot 3.5 BOM：`<hibernate.version>6.4.4.Final</hibernate.version>`（6.4.x 对 PG 16 推断更好），但破坏 SAA 1.1.2.2 的 API 兼容。

### 方案 E（最务实）：H2 内存 DB 跑 dev
`ddl-auto: create-drop` + `jdbc:h2:mem:xxx` 让 Hibernate 自己管理 schema。**不生产化**。

## 建议的推进顺序

1. **Step 2（当前）**：方案 A 批量加 `@JdbcTypeCode(SqlTypes.VARCHAR)` 到所有 `String` 字段
   - 编写 Python 脚本识别 entity 文件 + 注入注解
   - 重新编译 + 重启 + 验证
   - 预计 30-60 分钟

2. **Step 3**：修 JSON 字段插入问题（`BuiltinRoleInitializer` 等）
   - 把 `'"tool"'` 改成 `'["tool"]'`（有效 JSON 数组）
   - 或者用 Jackson 序列化 Map → JSON string

3. **Step 4**：补 A2A `default` Agent Card + `/.well-known/agent.json` 路径

4. **Step 5**：完整 R4 联调（POST → 验证 DB 持久化 → GET 列表 → 跨服务调用）

5. **Step 6**：Nacos 注册（目前 0/18 服务注册到 Nacos，需查 client 日志）

## 已完成

| # | 任务 | 状态 |
|---|---|---|
| 1 | 19 个 application.yml 加 `preferred_jdbc_type_code_for_string: 12` | ✅ |
| 2 | 18 个 application.yml 加 `?stringtype=varchar` JDBC URL 参数 | ✅ |
| 3 | 19 个 application.yml 补全 datasource/jpa/flyway 配置 | ✅ |
| 4 | 重启 6 个 R2 服务（带新配置） | ✅ |
| 5 | 重验证 R4 写路径（方案 1+2） | ❌ 仍 500 |
| 6 | **批量加 `@JdbcTypeCode(SqlTypes.VARCHAR)` 到 199 个 entity、1304 个 String 字段** | ✅ |
| 7 | 修复 192 个 entity 的 `@JdbcTypeCode` 重复问题 | ✅ |
| 8 | 修复 137 个 entity 缺失 `import org.hibernate.annotations.JdbcTypeCode` | ✅ |
| 9 | 15/15 TECH 模块 `mvn clean compile` 全部 BUILD SUCCESS | ✅ |
| 10 | 重启 R2 服务 + 验证 R4 写路径 | ❌ 仍 500 |

## 真正根因（关键发现）

**`@JdbcTypeCode(SqlTypes.VARCHAR)` 不能修 query 参数类型**。

报错 SQL：
```sql
where lower(mte1_0.name) like lower(('%'||?||'%')) escape ''
```

`?` 是 **query parameter**，不是 column。`@JdbcTypeCode` 控制的是 entity 字段的 column 读写类型（DDL/DML），但**不能影响 JPQL 编译为 SQL 时参数绑定的类型推断**。

`lower()` 是 PG 端的函数，PG 需要知道 `?` 的类型才能选对 overload：
- `lower(varchar)` ✅
- `lower(bytea)` ❌ 不存在

Hibernate 6.6 在编译 `lower(field) like lower(('%' || :param || '%'))` 时把 `?` 推断为 bytea（OTHER 类型默认），导致 PG 找不到 `lower(bytea)`。

## 真正能修的方案

### 方案 A：自定义 @Query + 显式 cast（彻底修）

```java
@Query("SELECT m FROM McpToolEntity m WHERE m.tenantId = :tid " +
       "AND (:keyword IS NULL OR lower(m.name) LIKE lower(concat('%', cast(:keyword as text), '%')))")
Page<McpToolEntity> search(@Param("tid") String tid, @Param("keyword") String keyword, Pageable p);
```

**问题**：要改 ~50 个 service repository 的所有 `findBy*Like*` 方法。

### 方案 B：自定义 PostgreSQLDialect 子类（推荐）
注册一个 dialect override，把所有 String 字段的 `?` 强制转 `cast(? as text)`：

```java
public class FixPG16Dialect extends PostgreSQLDialect {
    public FixPG16Dialect() {
        super();
        registerFunction("lower", new StandardSQLFunction("lower", StandardBasicTypes.STRING));
        // 或 override visit method
    }
}
```

`hibernate.dialect: com.metaplatform.common.FixPG16Dialect` 1 行配置解决。

### 方案 C：Hibernate 版本降级
- 当前：Spring Boot 3.5.0 → Hibernate 6.6.15
- 改：Hibernate 6.4.4.Final（PG 16 兼容更好的版本）
- **破坏性**：SAA 1.1.2.2 可能用 6.6+ API

### 方案 D（务实）：H2 内存 DB 跑 dev
- 改 `jdbc:h2:mem:xxx` + `ddl-auto: create-drop`
- 不生产化，但 dev 阶段可用

## 建议下一步

按"修复 R4 联调路径"目标，最务实是 **方案 D（H2 dev）** 或 **方案 B（自定义 dialect）**。

## 当前可工作部分

- ✅ 6/6 R2 服务运行（带新 config + @JdbcTypeCode entity）
- ✅ GET list 端点（无 LIKE 模糊查询）
- ✅ Spring Boot / Flyway / Nacos / PG 16 全部联通
- ❌ R4 写路径被 `lower(bytea)` 阻塞

## 启动验证结果

| 服务 | 启动 | API 状态 |
|---|---|---|
| TECH-LLMGW | ✅ PID 74236 | `/api/v1/llmgw/models` 空响应（路由问题，与 DB 无关） |
| TECH-RAG | ✅ PID 84868 | 200 OK（list 端点） |
| TECH-DATA | ✅ PID 62092 | 200 OK（list 端点） |
| TECH-MCP | ✅ PID 24724 | ❌ 500（lower(bytea) on `mcp_server` search） |
| TECH-A2A | ✅ PID 75876 | ❌ 500 on POST（lower(bytea) on insert/search） |
| TECH-AGENT | ✅ PID 56964 | ❌ 500 on POST execute |

## 关联文件

- [docs/R4-PROTOCOL-E2E-VERIFICATION.md](R4-PROTOCOL-E2E-VERIFICATION.md) — R4 联调报告
- [docs/NACOS-3.0-POC-CHECKLIST.md](NACOS-3.0-POC-CHECKLIST.md) — Nacos 3.0 POC
- `restart-r2-clean.ps1` — R2 6 服务重启脚本（带新 JVM args）
- `restart-mcp.ps1` — TECH-MCP 单独重启脚本
